/**
 * The Arena. Seeded, replayable, and narrated. Fights resolve as alternating
 * exchanges over simulated time; defensive layers roll per exchange. Variance
 * is tuned so a clearly weaker build still steals ~15–20% of fights.
 */

import { Rng } from './rng.js';
import { Sheet } from './stats.js';

export interface FightEvent {
  turn: number;
  attacker: 0 | 1;
  kind: 'hit' | 'crit' | 'evade' | 'block' | 'suppress' | 'combo' | 'kill' | 'open' | 'tick';
  damage?: number;
  text: string;
  hpAfter: [number, number]; // remaining EHP fractions, 0..1
}

export interface FightResult {
  winner: 0 | 1;
  loser: 0 | 1;
  turns: number;
  events: FightEvent[];
  /** Remaining EHP fraction of the winner — the margin of victory. */
  winnerHpPct: number;
  seed: string;
}

const EXCHANGE_SECONDS = 0.8;
const MAX_TURNS = 24;
/** Damage roll spread — the main source of honest upsets. */
const VARIANCE_LO = 0.7;
const VARIANCE_HI = 1.3;

interface Fighter {
  sheet: Sheet;
  hp: number;   // current pooled EHP
  max: number;
}

function mitigate(rng: Rng, atk: Sheet, def: Sheet, raw: number): { dmg: number; kind: FightEvent['kind'] } {
  const isSpell = atk.skillTags.includes('spell') || atk.skillTags.includes('dot');
  const isAttack = !isSpell;

  // Evasion vs attacks: soft chance curve, never a hard wall.
  if (isAttack && def.evasion > 0) {
    const evadeChance = Math.min(0.6, def.evasion / (def.evasion + 4000));
    if (rng.chance(evadeChance)) return { dmg: 0, kind: 'evade' };
  }
  // Block rolls against everything (spell block folded into block for the sim).
  if (def.block > 0 && rng.chance(def.block / 100)) return { dmg: 0, kind: 'block' };

  let dmg = raw;
  // Spell suppression: rolls per exchange, halves what it catches.
  let kind: FightEvent['kind'] = 'hit';
  if (isSpell && def.suppress > 0 && rng.chance(def.suppress / 100)) {
    dmg *= 0.5;
    kind = 'suppress';
  }
  // Armour vs the physical share; resists vs the elemental share.
  const eleTags = ['fire', 'cold', 'lightning'];
  const isEle = atk.skillTags.some((t) => eleTags.includes(t));
  const isChaos = atk.skillTags.includes('chaos');
  if (isChaos && def.chaosImmune) return { dmg: 0, kind: 'evade' };
  if (isEle) {
    const effRes = Math.max(-60, def.resists - atk.penetration);
    dmg *= 1 - effRes / 100;
  } else if (!isChaos) {
    const dr = Math.min(0.75, def.armour / (def.armour + 5 * Math.max(1, raw)));
    dmg *= 1 - dr;
  } else {
    dmg *= 1 - Math.min(75, Math.max(-60, def.resists - 40)) / 100; // chaos res runs low
  }
  return { dmg: Math.max(0, dmg), kind };
}

const HIT_LINES = [
  '{A}\'s {skill} tears into {B} for {n}.',
  '{A} channels {skill} — {n} damage lands.',
  '{skill} finds a gap. {B} takes {n}.',
  '{B} eats {n} from {A}\'s {skill}.',
];
const CRIT_LINES = [
  'CRITICAL. {A}\'s {skill} detonates for {n}.',
  '{A} rolls a crit — {skill} hits for {n}.',
];
const EVADE_LINES = ['{B} phases through {A}\'s {skill}.', '{A} swings. {B} is elsewhere.'];
const BLOCK_LINES = ['{B} turns {A}\'s {skill} on shield.', 'Blocked. {B} doesn\'t flinch.'];
const SUPPRESS_LINES = ['{B} suppresses the worst of {skill} — {n} slips through.'];
const KILL_LINES = [
  '{B} is shattered.',
  '{B} returns to the beach.',
  '{B}\'s corpse hits the ground before the loot does.',
  'Silence. {B} is gone.',
];

function fmt(template: string, a: Sheet, b: Sheet, n?: number): string {
  return template
    .replaceAll('{A}', a.name)
    .replaceAll('{B}', b.name)
    .replaceAll('{skill}', a.skillName)
    .replaceAll('{n}', n === undefined ? '' : n.toLocaleString('en-US'));
}

export function fight(a: Sheet, b: Sheet, seed: string): FightResult {
  const rng = new Rng(`arena:${seed}`);
  const f: [Fighter, Fighter] = [
    { sheet: a, hp: a.ehp, max: a.ehp },
    { sheet: b, hp: b.ehp, max: b.ehp },
  ];
  // Per-fight "form" roll: the fight-level luck that makes upsets possible
  // without making any single exchange feel random-for-random's-sake.
  const form: [number, number] = [rng.range(0.75, 1.25), rng.range(0.75, 1.25)];
  const events: FightEvent[] = [];
  const hpPct = (): [number, number] => [
    Math.max(0, f[0].hp / f[0].max),
    Math.max(0, f[1].hp / f[1].max),
  ];

  events.push({
    turn: 0, attacker: 0, kind: 'open', hpAfter: hpPct(),
    text: `${a.name} versus ${b.name}. The arena holds its breath.`,
  });
  for (const c of a.combos) events.push({
    turn: 0, attacker: 0, kind: 'combo', hpAfter: hpPct(), text: `${a.name}: ${c.line}`,
  });
  for (const c of b.combos) events.push({
    turn: 0, attacker: 1, kind: 'combo', hpAfter: hpPct(), text: `${b.name}: ${c.line}`,
  });

  let first: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  let turn = 0;
  while (turn < MAX_TURNS) {
    turn++;
    for (const who of [first, (1 - first) as 0 | 1]) {
      const atk = f[who];
      const def = f[1 - who];
      const raw = atk.sheet.dps * EXCHANGE_SECONDS * form[who] * rng.range(VARIANCE_LO, VARIANCE_HI);
      const isCrit = rng.chance(atk.sheet.critChance / 100);
      const { dmg, kind } = mitigate(rng, atk.sheet, def.sheet, raw * (isCrit ? 1.15 : 1));
      const dealt = Math.round(dmg);
      def.hp -= dealt;
      // Leech: attacker recovers a slice of damage dealt, capped per exchange.
      if (atk.sheet.leechPct > 0 && dealt > 0) {
        atk.hp = Math.min(atk.max, atk.hp + Math.min(atk.max * 0.08, dealt * (atk.sheet.leechPct / 100)));
      }
      const lines =
        kind === 'evade' ? EVADE_LINES :
        kind === 'block' ? BLOCK_LINES :
        kind === 'suppress' ? SUPPRESS_LINES :
        isCrit ? CRIT_LINES : HIT_LINES;
      events.push({
        turn, attacker: who, kind: dealt > 0 && isCrit ? 'crit' : kind,
        damage: dealt || undefined,
        text: `Turn ${turn}: ${fmt(rng.pick(lines), atk.sheet, def.sheet, dealt || undefined)}`,
        hpAfter: hpPct(),
      });
      if (def.hp <= 0) {
        const winner = who;
        events.push({
          turn, attacker: who, kind: 'kill', hpAfter: hpPct(),
          text: `Turn ${turn}: ${fmt(rng.pick(KILL_LINES), atk.sheet, def.sheet)}`,
        });
        return {
          winner, loser: (1 - winner) as 0 | 1, turns: turn, events,
          winnerHpPct: Math.max(0, Math.round((f[winner].hp / f[winner].max) * 100)),
          seed,
        };
      }
    }
    // Recovery ticks between turns.
    for (const x of f) {
      if (x.sheet.recoveryPerSec > 0 && x.hp < x.max) {
        x.hp = Math.min(x.max, x.hp + x.sheet.recoveryPerSec * EXCHANGE_SECONDS);
      }
    }
  }
  // Timeout: tie broken by remaining EHP percentage.
  const [pa, pb] = hpPct();
  const winner: 0 | 1 = pa === pb ? first : pa > pb ? 0 : 1;
  events.push({
    turn, attacker: winner, kind: 'kill', hpAfter: hpPct(),
    text: `The arena calls it: ${f[winner].sheet.name} stands taller (${Math.round(Math.max(pa, pb) * 100)}% to ${Math.round(Math.min(pa, pb) * 100)}%).`,
  });
  return {
    winner, loser: (1 - winner) as 0 | 1, turns: turn, events,
    winnerHpPct: Math.round(Math.max(pa, pb) * 100), seed,
  };
}
