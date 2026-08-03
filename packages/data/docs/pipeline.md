# Data pipeline

```
src/entities/*.ts      vendored snapshot (hand-transcribed from RePoE /
      │                PoB data exports; gameplay-tuned numbers)
      ▼
scripts/ingest.ts      validate ids/slots/tags/stat-keys, merge overlay
      │                LAST, hash content → version
      ▼
dist/draft-pool.json   the only data artifact the app ever loads
```

- **Refreshing from RePoE**: the vendored files in `src/entities/` are a
  snapshot derived from the repoe-fork gh-pages exports. They are TypeScript
  on purpose — every entry is reviewed, tuned and typed. To refresh, diff
  names/bases against a fresh RePoE export and update entries by hand; the
  sim's stat vocabulary is deliberately *not* PoE's mod language (see
  schema.md), so numbers are gameplay decisions, not transcriptions.
- **`curation.yaml` is law**: the ingest script never writes to it, and it
  wins every merge conflict. Tier/price/exclusion changes belong there, not
  in the entity files.
- **Art assets**: any GGG-derived art must live in
  `apps/web/public/ggg-assets/` with `ATTRIBUTION.md` alongside — one
  directory, swappable wholesale. The v1 pool ships with **no** GGG art
  (typographic cards + glyphs), so the game is clean by default.
- **Determinism**: `version` is a content hash. The server stamps every
  submitted draft with the pool version it validated against; replays fetch
  the same version or refuse.
