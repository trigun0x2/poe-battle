/**
 * Build → combat sheet. A tribute with honest depth, not a PoB clone:
 * one damage pipeline, layered mitigation, recovery, and hand-tagged combos.
 */

import { Build, ComboFlag, Entity, PoolIndex, buildEntityIds } from './types.js';

export interface Sheet {
  name: string;
  skillName: string;
  skillTags: string[];
  ascendancyName?: string;
  dps: number;
  hitDamage: number;
  speed: number;
  critChance: number;
  critMulti: number;
  penetration: number;
  life: number;
  es: number;
  ehp: number;
  armour: number;
  evasion: number;
  block: number;
  suppress: number;
  resists: number; // effective average elemental resistance, capped
  chaosImmune: boolean;
  momBuffer: number; // extra effective pool from MoM-style layers
  recoveryPerSec: number;
  leechPct: number;
  combos: { name: string; line: string; multiplier: number }[];
  synergyBonusPct: number;
  flags: Record<string, boolean>;
}

const DEFAULT_SKILL: Entity = {
  id: 'default-attack', category: 'skill', name: 'Default Attack', tier: 1, cost: 0,
  tags: ['attack', 'physical'],
  stats: { baseDamage: 55, baseSpeed: 1.2, baseCrit: 5 },
};

function corruptionScale(build: Build, id: string): number {
  const c = build.corruptions?.[id];
  return c === 'brick' ? 0.35 : c === 'upgrade' ? 1.35 : 1;
}

export function computeSheet(pool: PoolIndex, build: Build, combos: ComboFlag[]): Sheet {
  const ids = buildEntityIds(build);
  const entities = ids
    .map((id) => pool.byId.get(id))
    .filter((e): e is Entity => !!e);

  const skill = (build.skill && pool.byId.get(build.skill)) || DEFAULT_SKILL;
  const asc = build.ascendancy ? pool.byId.get(build.ascendancy) : undefined;

  // --- accumulate ---------------------------------------------------------
  const sum: Record<string, number> = {};
  const moreMults: number[] = [];
  const flags: Record<string, boolean> = {};
  for (const e of entities) {
    const scale = corruptionScale(build, e.id);
    for (const [k, v] of Object.entries(e.stats)) {
      if (k.startsWith('flag')) { if (v) flags[k] = true; continue; }
      if (k === 'moreDamage') { moreMults.push(1 + (v * scale) / 100); continue; }
      if (k.startsWith('base')) continue; // skill-only inputs
      sum[k] = (sum[k] ?? 0) + v * scale;
    }
  }
  const S = (k: string) => sum[k] ?? 0;

  // --- offense ------------------------------------------------------------
  const isDot = skill.tags.includes('dot');
  const baseDamage = (skill.stats.baseDamage ?? 50) * corruptionScale(build, skill.id);
  const baseSpeed = skill.stats.baseSpeed ?? 1;
  const flatDamage = S('flatDamage');
  const incDamage = S('incDamage');
  let speed = baseSpeed * (1 + S('incSpeed') / 100);

  // Tag synergy: each support/item tag shared with the skill = +4% more, cap +60%.
  let sharedTags = 0;
  for (const e of entities) {
    if (e.id === skill.id) continue;
    for (const t of e.tags) if (skill.tags.includes(t)) sharedTags++;
  }
  const synergyBonusPct = Math.min(60, sharedTags * 4);

  let critChance = Math.min(95, (skill.stats.baseCrit ?? 5) + S('critChance'));
  let critMulti = 150 + S('critMulti');
  if (flags.flagRT) { critChance = 0; moreMults.push(1.1); }
  if (flags.flagEO) { critChance = 0; moreMults.push(1.4); }
  if (isDot) { critChance = 0; moreMults.push(1 + S('dotMulti') / 100); }
  const critFactor = 1 + (critChance / 100) * ((critMulti - 100) / 100);

  const comboHits: Sheet['combos'] = [];
  for (const combo of combos) {
    if (combo.requiresAscendancy && build.ascendancy !== combo.requiresAscendancy) continue;
    if (combo.requiresIds && !combo.requiresIds.every((id) => ids.includes(id))) continue;
    if (combo.requiresTag) {
      let n = 0;
      for (const e of entities) if (e.tags.includes(combo.requiresTag.tag)) n++;
      if (n < combo.requiresTag.count) continue;
    }
    comboHits.push({ name: combo.name, line: combo.line, multiplier: combo.multiplier });
  }

  let dps =
    (baseDamage + flatDamage) *
    (1 + incDamage / 100) *
    moreMults.reduce((a, b) => a * b, 1) *
    speed *
    critFactor *
    (1 + synergyBonusPct / 100);
  for (const c of comboHits) dps *= c.multiplier;
  if (flags.flagLowLife) dps *= 1.3; // Pain Attunement-style payoff

  // --- defense ------------------------------------------------------------
  const BASE_LIFE = 1000;
  let life = Math.max(1, (BASE_LIFE + S('life')) * (1 + S('incLife') / 100));
  let es = S('es') * (1 + S('incEs') / 100);
  if (flags.flagCI) { life = 1; }
  if (flags.flagEB) { es = es * 0.6; } // ES feeds the mind, not the body
  if (flags.flagEternalYouth) { /* handled in recovery below */ }

  const maxRes = 75 + S('maxRes');
  const resists = Math.min(maxRes, S('resAll') + (S('resFire') + S('resCold') + S('resLightning')) / 3);
  const armour = flags.flagIronReflexes ? S('armour') + S('evasion') : S('armour');
  const evasion = flags.flagIronReflexes ? 0 : S('evasion') * (flags.flagAcro ? 1.3 : 1);
  const block = Math.min(75, S('block') + (flags.flagGlancing ? 25 : 0));
  const suppress = Math.min(100, S('suppress'));
  const momBuffer = flags.flagMoM ? (life + es) * 0.18 : 0;
  const ehp = life + es + momBuffer;

  // --- recovery -----------------------------------------------------------
  let regenPct = S('regen');
  if (flags.flagVaalPact) regenPct = 0;
  if (flags.flagEternalYouth) regenPct = regenPct / 2 + 2;
  let leechPct = S('leech') * (flags.flagVaalPact ? 2 : 1);
  const recoveryPerSec = (regenPct / 100) * (life + es);

  return {
    name: build.name || 'Nameless Exile',
    skillName: skill.name,
    skillTags: skill.tags,
    ascendancyName: asc?.name,
    dps: Math.round(dps),
    hitDamage: Math.round(dps / Math.max(0.1, speed)),
    speed: Math.round(speed * 100) / 100,
    critChance, critMulti,
    penetration: S('penetration'),
    life: Math.round(life),
    es: Math.round(es),
    ehp: Math.round(ehp),
    armour: Math.round(armour),
    evasion: Math.round(evasion),
    block, suppress,
    resists: Math.round(resists),
    chaosImmune: !!flags.flagCI,
    momBuffer: Math.round(momBuffer),
    recoveryPerSec: Math.round(recoveryPerSec),
    leechPct,
    combos: comboHits,
    synergyBonusPct,
    flags,
  };
}
