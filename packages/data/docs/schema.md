# `draft-pool.json` schema

Emitted by `scripts/ingest.ts`. Single source of truth at runtime — the
client and server both load it; **nothing** calls RePoE/wiki/poe.ninja at
runtime.

```jsonc
{
  "version": "a1b2c3d4e5f6",     // sha256 of content, first 12 hex chars
  "generatedAt": "ISO-8601",
  "entities": [ Entity ],
  "combos":   [ ComboFlag ]
}
```

## Entity

| field      | type      | notes |
|------------|-----------|-------|
| `id`       | string    | kebab-case slug, unique across the pool |
| `category` | enum      | `unique` \| `skill` \| `support` \| `ascendancy` \| `keystone` |
| `name`     | string    | display name, rarity-colored in UI by category |
| `base`     | string?   | base type line ("Leather Cap", "Skill Gem", class name) |
| `slot`     | enum?     | uniques only: `weapon` `offhand` `helmet` `body` `gloves` `boots` `belt` `ring` `amulet` `flask` |
| `tier`     | 1–5       | round gating: rounds 1–2 show T1–2 … rounds 7–8 show T3–5 |
| `cost`     | number    | chaos orb price (tier default, overridable in curation) |
| `tags`     | string[]  | synergy vocabulary — shop bias + sim tag-match bonus |
| `stats`    | object    | the sim's inputs, see below |
| `flavor`   | string?   | italic serif line on the card (original text, PoE-inspired) |
| `art`      | string?   | reference into `apps/web/public/ggg-assets/` (isolated, attributed) |

## Stats vocabulary

Unknown keys are rejected by ingest but *ignored* by the sim, so the schema
can grow without breaking old builds (the v2 PoB-backed scorer slots in here).

- **Skill-only**: `baseDamage` (avg hit), `baseSpeed` (uses/sec), `baseCrit` (%)
- **Offense**: `flatDamage`, `incDamage` (additive %), `moreDamage`
  (multiplicative %, stacks by product), `incSpeed`, `critChance`,
  `critMulti`, `penetration`, `dotMulti`
- **Defense**: `life`, `incLife`, `es`, `incEs`, `armour`, `evasion`,
  `block`, `spellBlock`, `suppress`, `resAll`, `resFire/Cold/Lightning/Chaos`,
  `maxRes` (raises the 75% cap)
- **Recovery**: `regen` (% pool/sec), `leech` (% damage dealt)
- **Flags** (value 1): `flagCI`, `flagMoM`, `flagEB`, `flagVaalPact`,
  `flagEO`, `flagRT`, `flagLowLife`, `flagIronReflexes`, `flagAcro`,
  `flagBloodMagic`, `flagEternalYouth`, `flagGlancing`

## ComboFlag

```jsonc
{
  "id": "golemancer-online",
  "name": "Golemancer Online",
  "requiresAscendancy": "elementalist",   // optional
  "requiresIds": ["mjolner"],             // optional, ALL must be drafted
  "requiresTag": { "tag": "golem", "count": 2 },  // optional
  "multiplier": 1.5,                       // explicit DPS multiplier
  "line": "GOLEMANCER ONLINE. The constructs march."  // announced in fight log
}
```

## Curation overlay (`curation.yaml`)

Never touched by ingest; merged **last** and wins every conflict:
`excludes`, `tierOverrides`, `priceOverrides`, `combos`.
