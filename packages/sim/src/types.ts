/** Shared entity + build types. `draft-pool.json` conforms to these. */

export type Category = 'unique' | 'skill' | 'support' | 'ascendancy' | 'keystone';

/** Slot an entity occupies in the pool (rings/flasks collapse to one). */
export type GearSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'ring'
  | 'amulet'
  | 'flask';

/** Concrete build slots (rings/flasks split into numbered slots). */
export type BuildSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'ring1'
  | 'ring2'
  | 'amulet'
  | 'flask1'
  | 'flask2';

export const BUILD_SLOTS: BuildSlot[] = [
  'weapon', 'offhand', 'helmet', 'body', 'gloves', 'boots',
  'belt', 'ring1', 'ring2', 'amulet', 'flask1', 'flask2',
];

export type Tier = 1 | 2 | 3 | 4 | 5;

/**
 * The sim's numeric vocabulary. Unknown keys are ignored, so the schema can
 * grow (a PoB-backed scorer in v2 can add keys without breaking v1 builds).
 *
 * Offense   : baseDamage, baseSpeed, baseCrit (skills only);
 *             flatDamage, incDamage, moreDamage, incSpeed, critChance,
 *             critMulti, penetration, dotMulti (percentages unless noted)
 * Defense   : life, es, armour, evasion, block, spellBlock, suppress,
 *             resAll, resFire, resCold, resLightning, resChaos, maxRes
 * Recovery  : regen (% of pool/s), leech (% of damage dealt/s)
 * Flags (1) : flagCI, flagMoM, flagEB, flagVaalPact, flagEO, flagRT,
 *             flagLowLife, flagIronReflexes, flagAcro, flagBloodMagic,
 *             flagEternalYouth, flagGlancing
 */
export type Stats = Record<string, number>;

export interface Entity {
  id: string;
  category: Category;
  name: string;
  /** Base type line, e.g. "Leather Cap" — shown under the name like a tooltip. */
  base?: string;
  slot?: GearSlot;
  tier: Tier;
  cost: number;
  tags: string[];
  stats: Stats;
  flavor?: string;
  /** Reference into the isolated art directory; may be absent (glyph fallback). */
  art?: string;
}

export interface ComboFlag {
  id: string;
  name: string;
  /** All listed entity ids must be present in the build. */
  requiresIds?: string[];
  /** Requires at least `count` drafted entities carrying `tag`. */
  requiresTag?: { tag: string; count: number };
  requiresAscendancy?: string;
  /** DPS multiplier, e.g. 1.5. */
  multiplier: number;
  line: string;
}

export interface DraftPool {
  version: string;
  generatedAt: string;
  entities: Entity[];
  combos: ComboFlag[];
}

export interface Build {
  name: string;
  skill?: string;
  supports: string[];
  ascendancy?: string;
  keystones: string[];
  gear: Partial<Record<BuildSlot, string>>;
  /** Vaal-corrupted entity ids (stream mode), mapped to outcome. */
  corruptions?: Record<string, 'brick' | 'upgrade'>;
}

export interface PoolIndex {
  byId: Map<string, Entity>;
  pool: DraftPool;
}

export function indexPool(pool: DraftPool): PoolIndex {
  return { byId: new Map(pool.entities.map((e) => [e.id, e])), pool };
}

export function buildEntityIds(build: Build): string[] {
  return [
    build.skill,
    ...build.supports,
    build.ascendancy,
    ...build.keystones,
    ...Object.values(build.gear),
  ].filter((x): x is string => !!x);
}
