/**
 * Build-time ingest: merges the vendored entity snapshot (hand-transcribed
 * from RePoE/PoB exports — see docs/pipeline.md) with the hand-curated
 * overlay (curation.yaml, merged LAST), validates everything against the
 * sim's schema, and emits a single versioned draft-pool.json.
 *
 * Zero runtime dependency on external APIs: this runs at build time only.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { ComboFlag, DraftPool, Entity, Tier } from '@exile/sim';
import { uniques } from '../src/entities/uniques.js';
import { skills } from '../src/entities/skills.js';
import { supports } from '../src/entities/supports.js';
import { ascendancies } from '../src/entities/ascendancies.js';
import { keystones } from '../src/entities/keystones.js';
import { TIER_COST } from '../src/entities/helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

interface Curation {
  excludes?: string[];
  tierOverrides?: Record<string, Tier>;
  priceOverrides?: Record<string, number>;
  combos?: ComboFlag[];
}

const KNOWN_STATS = new Set([
  'baseDamage', 'baseSpeed', 'baseCrit',
  'flatDamage', 'incDamage', 'moreDamage', 'incSpeed', 'critChance', 'critMulti',
  'penetration', 'dotMulti',
  'life', 'incLife', 'es', 'incEs', 'armour', 'evasion', 'block', 'spellBlock',
  'suppress', 'resAll', 'resFire', 'resCold', 'resLightning', 'resChaos', 'maxRes',
  'regen', 'leech',
  'flagCI', 'flagMoM', 'flagEB', 'flagVaalPact', 'flagEO', 'flagRT', 'flagLowLife',
  'flagIronReflexes', 'flagAcro', 'flagBloodMagic', 'flagEternalYouth', 'flagGlancing',
]);

function fail(msg: string): never {
  console.error(`✗ ingest failed: ${msg}`);
  process.exit(1);
}

const curation = parseYaml(readFileSync(join(root, 'curation.yaml'), 'utf8')) as Curation;

let entities: Entity[] = [...uniques, ...skills, ...supports, ...ascendancies, ...keystones];

// ── overlay: merged last, wins every conflict ─────────────────────────────
const excludes = new Set(curation.excludes ?? []);
entities = entities.filter((e) => !excludes.has(e.id));
for (const [id, tier] of Object.entries(curation.tierOverrides ?? {})) {
  const e = entities.find((x) => x.id === id) ?? fail(`tierOverrides: unknown id "${id}"`);
  e.tier = tier;
  e.cost = TIER_COST[tier];
}
for (const [id, cost] of Object.entries(curation.priceOverrides ?? {})) {
  const e = entities.find((x) => x.id === id) ?? fail(`priceOverrides: unknown id "${id}"`);
  e.cost = cost;
}

// ── validate ──────────────────────────────────────────────────────────────
const seen = new Set<string>();
for (const e of entities) {
  if (seen.has(e.id)) fail(`duplicate id "${e.id}"`);
  seen.add(e.id);
  if (e.category === 'unique' && !e.slot) fail(`unique "${e.id}" has no slot`);
  if (e.tags.length === 0) fail(`"${e.id}" has no tags`);
  if (!(e.tier >= 1 && e.tier <= 5)) fail(`"${e.id}" bad tier ${e.tier}`);
  for (const key of Object.keys(e.stats)) {
    if (!KNOWN_STATS.has(key)) fail(`"${e.id}" has unknown stat "${key}"`);
  }
  if (e.category === 'skill' && !e.stats.baseDamage) fail(`skill "${e.id}" missing baseDamage`);
}
const combos = curation.combos ?? [];
for (const c of combos) {
  for (const id of c.requiresIds ?? []) {
    if (!seen.has(id)) fail(`combo "${c.id}" requires unknown id "${id}"`);
  }
  if (c.requiresAscendancy && !seen.has(c.requiresAscendancy)) {
    fail(`combo "${c.id}" requires unknown ascendancy "${c.requiresAscendancy}"`);
  }
}

// ── emit ──────────────────────────────────────────────────────────────────
const body = JSON.stringify({ entities, combos });
const version = createHash('sha256').update(body).digest('hex').slice(0, 12);
const pool: DraftPool = {
  version,
  generatedAt: new Date().toISOString(),
  entities,
  combos,
};
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'draft-pool.json'), JSON.stringify(pool, null, 1));

const byCat = entities.reduce<Record<string, number>>((acc, e) => {
  acc[e.category] = (acc[e.category] ?? 0) + 1;
  return acc;
}, {});
console.log(`✓ draft-pool.json v${version}`);
console.log(`  ${entities.length} entities:`, byCat, `+ ${combos.length} combos`);
