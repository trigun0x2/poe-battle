/** Humanize sim stats into tooltip lines. No information by color alone. */
import type { Entity } from '@exile/sim';

export const FLAG_LABELS: Record<string, string> = {
  flagCI: 'Chaos Inoculation: immune to chaos, life becomes 1',
  flagMoM: 'Mind over Matter: mind absorbs a share of damage',
  flagEB: 'Eldritch Battery: energy shield fuels power instead',
  flagVaalPact: 'Vaal Pact: doubled leech, no regeneration',
  flagEO: 'Elemental Overload: big damage, no crits',
  flagRT: 'Resolute Technique: never miss, never crit',
  flagLowLife: 'Low-life power: 30% more damage',
  flagIronReflexes: 'Iron Reflexes: evasion becomes armour',
  flagAcro: 'Acrobatics: 30% more evasion',
  flagBloodMagic: 'Blood Magic: life is the only resource',
  flagEternalYouth: 'Eternal Youth: recovery flows differently',
  flagGlancing: 'Glancing Blows: much more block, blocks bleed through',
};

const pct = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

const LINES: Record<string, (v: number) => string> = {
  baseDamage: (v) => `${v} base damage`,
  baseSpeed: (v) => `${v} uses per second`,
  baseCrit: (v) => (v > 0 ? `${v}% base critical chance` : 'cannot crit'),
  flatDamage: (v) => `+${v} added damage`,
  incDamage: (v) => `${pct(v)} increased damage`,
  moreDamage: (v) => `${Math.abs(v)}% ${v >= 0 ? 'more' : 'less'} damage`,
  incSpeed: (v) => `${pct(v)} attack and cast speed`,
  critChance: (v) => `${pct(v)} critical strike chance`,
  critMulti: (v) => `${pct(v)} critical strike multiplier`,
  penetration: (v) => `${v}% resistance penetration`,
  dotMulti: (v) => `${pct(v)} damage over time multiplier`,
  life: (v) => `${v > 0 ? '+' : ''}${v} maximum life`,
  incLife: (v) => `${pct(v)} increased maximum life`,
  es: (v) => `${v > 0 ? '+' : ''}${v} energy shield`,
  incEs: (v) => `${pct(v)} increased energy shield`,
  armour: (v) => `${v > 0 ? '+' : ''}${v} armour`,
  evasion: (v) => `${v > 0 ? '+' : ''}${v} evasion`,
  block: (v) => `${pct(v)} block chance`,
  spellBlock: (v) => `${pct(v)} spell block`,
  suppress: (v) => `${pct(v)} spell suppression`,
  resAll: (v) => `${pct(v)} to all resistances`,
  resFire: (v) => `${pct(v)} fire resistance`,
  resCold: (v) => `${pct(v)} cold resistance`,
  resLightning: (v) => `${pct(v)} lightning resistance`,
  resChaos: (v) => `${pct(v)} chaos resistance`,
  maxRes: (v) => `${pct(v)} to maximum resistances`,
  regen: (v) => `${v}% recovery per second`,
  leech: (v) => `${v}% of damage leeched`,
};

export function statLines(entity: Entity): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(entity.stats)) {
    if (key.startsWith('flag')) {
      const label = FLAG_LABELS[key];
      if (label) out.push(label);
      continue;
    }
    const fmt = LINES[key];
    if (fmt && value !== 0) out.push(fmt(value));
  }
  return out;
}

export const CATEGORY_LABEL: Record<Entity['category'], string> = {
  unique: 'Unique',
  skill: 'Skill Gem',
  support: 'Support Gem',
  ascendancy: 'Ascendancy',
  keystone: 'Keystone',
};

export const TIER_GLYPH = ['·', '··', '···', '····', '·····'];
