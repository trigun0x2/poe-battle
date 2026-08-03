# Exile Draft

**Draft a broken build in five minutes, then watch it fight.**

A web autobattler-style drafting game built on Path of Exile 1 content: eight
rounds of randomized shops filled with real uniques, skill gems, supports,
keystones and ascendancies; a budget of 40 Chaos Orbs; and a seeded, narrated
arena where sealed builds fight each other. Built for solo ladder play, a
shared daily seed, and live streamer rooms with audience chaos.

> Exile Draft is a fan-made tribute. It is **not affiliated with, endorsed
> by, or supported by Grinding Gear Games**. Path of Exile is a trademark of
> Grinding Gear Games. No pay-to-win mechanics of any kind.

## Layout

```
packages/sim      Pure, seeded, dependency-free game engine (draft rules,
                  stat aggregation, arena combat, narration, bot, names).
                  Shared verbatim by server (authoritative) and client (replay).
packages/data     Curated draft pool: ~330 entities + combo flags.
                  `curation.yaml` (never touched by ingest, merged last) →
                  `scripts/ingest.ts` → versioned `dist/draft-pool.json`.
                  Docs: packages/data/docs/{schema,pipeline}.md
apps/server       Fastify + WebSockets. Transcript validation (anti-cheat),
                  Elo-lite ladder, daily seed, stream rooms, room champions.
                  Postgres when DATABASE_URL is set; in-memory + JSON snapshot
                  otherwise.
apps/web          React + Vite + Zustand. The draft stage, canvas ember reroll,
                  the Vaal moment, kinetic-type fight replay, audience page,
                  OBS overlay, daily share card, WebAudio foley.
```

## Run it

```bash
npm install
npm run data          # build packages/data/dist/draft-pool.json
npm run dev:server    # Fastify on :8787 (in one terminal)
npm run dev           # Vite on :5173 (in another; proxies /api and /ws)
```

Or the whole stack with Postgres:

```bash
docker compose up --build   # web on :5173, api on :8787, postgres on :5432
```

The client also works with no server at all — drafts then resolve as
exhibition fights against a seeded bot, clearly labelled.

## Deploy (Fly.io)

One Fly app serves the API, WebSockets, and the built web client from the
same origin (`fly.toml` + `Dockerfile.fly`):

```bash
fly launch --copy-config --no-deploy    # pick a unique app name
fly postgres create && fly postgres attach <pg-app>   # sets DATABASE_URL
fly deploy
```

Without Postgres the server uses the in-memory snapshot store; create a
volume (`fly volumes create exile_data --size 1`) so the snapshot at
`/data/snapshot.json` survives restarts.

## Test

```bash
npm test                                   # sim determinism property tests
npm run typecheck                          # all workspaces
cd apps/web && npx playwright test         # draft → submit → fight → replay
# on machines with a preinstalled chromium:
# PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npx playwright test
```

## Design notes

- **Determinism is the anti-cheat.** A draft is a `(seed, action log)`
  transcript. The server replays every submission against the same rules —
  budget math, tier gating, slot legality — and rejects anything that doesn't
  reproduce. The client never decides prices or outcomes.
- **Fights are replayable artifacts.** The arena sim is seeded; the narrated
  log the server stored is the same one the client re-plays, event for event.
- **Upsets are tuned, not accidental**: per-fight form rolls + per-exchange
  variance land the aggregate underdog win rate in the ~15–20% band
  (property-tested).
- **Stream rooms grant no power.** Audience votes and chaos events
  ("Vaal It", "Mirror of Delusion", "Cartographer's Sextant") land in the
  host's transcript as ordinary actions and are re-validated at submission.
- **Art direction — "Occult Editorial."** Fraunces display serif over Inter,
  warm near-black ground, restrained gold for currency, one crimson reserved
  exclusively for corruption. Rarity colors appear only on item names. Full
  `prefers-reduced-motion` support; WCAG-AA-tuned rarity variants; the whole
  draft is keyboard-playable.
- **GGG-derived art** (none shipped in v1) must live in
  `apps/web/public/ggg-assets/` with attribution — one directory, swappable
  wholesale, per the fan content policy.
