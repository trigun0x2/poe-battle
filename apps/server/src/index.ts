/**
 * Exile Draft server. Authoritative: the client never decides prices or
 * outcomes — drafts arrive as transcripts and are replayed against the same
 * seeded rules, fights are resolved here and replayed client-side from the
 * stored seed.
 */
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  Build, DraftAction, DraftError, DraftPool, FightResult, Sheet, botDraft,
  computeSheet, dailyKey, dailySeed, fight, generateBuildName, indexPool,
  replayDraft,
} from '@exile/sim';
import pool from '@exile/data';
import { RoomHub } from './rooms.js';
import { StoredBuild, createStore } from './store.js';

const pi = indexPool(pool as unknown as DraftPool);
const store = await createStore();
const hub = new RoomHub();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
await app.register(cors, { origin: true });
await app.register(websocket);

const ELO_K = 32;
function eloDelta(winner: number, loser: number): number {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  return Math.round(ELO_K * (1 - expected));
}

interface SubmitBody {
  seed: string;
  mode: 'ladder' | 'daily';
  log: DraftAction[];
  playerId: string;
  playerName?: string;
}

function validateSubmission(body: SubmitBody): { build: Build; sheet: Sheet } {
  const state = replayDraft(pi, body.seed, body.log);
  const build = state.build;
  if (!build.name) build.name = generateBuildName(body.seed, computeSheet(pi, build, []));
  const sheet = computeSheet(pi, build, pi.pool.combos);
  return { build, sheet };
}

/** Ladder cold start: a seeded bot build so the first player has a rival. */
async function mockOpponent(seedBase: string): Promise<StoredBuild> {
  const seed = `mock:${seedBase}`;
  const { state } = botDraft(pi, seed);
  const sheet = computeSheet(pi, state.build, pi.pool.combos);
  return {
    id: `mock-${seedBase}`, playerId: 'the-machine', playerName: 'Wraeclast Itself',
    mode: 'ladder', seed, poolVersion: pi.pool.version, build: state.build, sheet,
    log: [], elo: 1000, wins: 0, losses: 0, createdAt: new Date().toISOString(),
  };
}

app.get('/api/health', async () => ({ ok: true, poolVersion: pi.pool.version }));

app.get('/api/pool', async () => pool);

app.get('/api/daily', async () => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return { seed: dailySeed(now), key: dailyKey(now), resetsAt: next.toISOString() };
});

app.post<{ Body: SubmitBody }>('/api/submit', async (req, reply) => {
  const body = req.body;
  if (!body?.seed || !Array.isArray(body.log) || !body.playerId) {
    return reply.code(400).send({ error: 'seed, log and playerId are required' });
  }
  if (body.mode === 'daily') {
    if (body.seed !== dailySeed()) {
      return reply.code(400).send({ error: 'That is not today\'s seed' });
    }
    if (await store.hasDailyAttempt(body.playerId, dailyKey())) {
      return reply.code(409).send({ error: 'One attempt per day. The seed resets at UTC midnight.' });
    }
  }
  let build: Build, sheet: Sheet;
  try {
    ({ build, sheet } = validateSubmission(body));
  } catch (err) {
    if (err instanceof DraftError) {
      return reply.code(422).send({ error: `Draft rejected: ${err.message}` });
    }
    throw err;
  }

  const stored: StoredBuild = {
    id: randomUUID(), playerId: body.playerId,
    playerName: (body.playerName ?? 'Anonymous Exile').slice(0, 32),
    mode: body.mode === 'daily' ? 'daily' : 'ladder',
    dailyKey: body.mode === 'daily' ? dailyKey() : undefined,
    seed: body.seed, poolVersion: pi.pool.version,
    build, sheet, log: body.log,
    elo: 1000, wins: 0, losses: 0, createdAt: new Date().toISOString(),
  };
  await store.saveBuild(stored);

  const opponent =
    (await store.findOpponent(stored.elo, stored.playerId)) ??
    (await mockOpponent(stored.id.slice(0, 8)));
  const fightSeed = `${stored.id}:${opponent.id}:${pi.pool.version}`;
  const result: FightResult = fight(sheet, opponent.sheet, fightSeed);

  const won = result.winner === 0;
  const delta = won ? eloDelta(stored.elo, opponent.elo) : -eloDelta(opponent.elo, stored.elo);
  await store.updateRecord(stored.id, stored.elo + delta, won);
  if (!opponent.id.startsWith('mock-')) {
    await store.updateRecord(opponent.id, opponent.elo - delta, !won);
  }

  const fightId = randomUUID();
  await store.saveFight({
    id: fightId, buildA: stored.id, buildB: opponent.id, seed: fightSeed,
    result, createdAt: new Date().toISOString(),
  });

  return {
    buildId: stored.id, fightId, result,
    you: { name: build.name, sheet },
    opponent: { name: opponent.build.name, playerName: opponent.playerName, sheet: opponent.sheet },
    eloDelta: delta,
  };
});

app.get('/api/ladder', async () => {
  const top = await store.ladder(50);
  return top.map((b, i) => ({
    rank: i + 1, buildId: b.id, name: b.build.name, playerName: b.playerName,
    elo: b.elo, wins: b.wins, losses: b.losses,
    skill: b.sheet.skillName, ascendancy: b.sheet.ascendancyName,
    dps: b.sheet.dps, ehp: b.sheet.ehp,
  }));
});

app.get('/api/daily/leaderboard', async () => {
  const top = await store.dailyLadder(dailyKey(), 50);
  return top.map((b, i) => ({
    rank: i + 1, name: b.build.name, playerName: b.playerName,
    wins: b.wins, losses: b.losses, dps: b.sheet.dps, ehp: b.sheet.ehp,
  }));
});

app.get<{ Params: { id: string } }>('/api/fight/:id', async (req, reply) => {
  const f = await store.getFight(req.params.id);
  if (!f) return reply.code(404).send({ error: 'No such fight' });
  const [a, b] = await Promise.all([store.getBuild(f.buildA), store.getBuild(f.buildB)]);
  return { ...f, you: a ? { name: a.build.name, sheet: a.sheet } : null, opponent: b ? { name: b.build.name, sheet: b.sheet } : null };
});

// ── Stream rooms ─────────────────────────────────────────────────────────

app.post<{ Body: { hostId: string } }>('/api/room', async (req, reply) => {
  if (!req.body?.hostId) return reply.code(400).send({ error: 'hostId required' });
  const room = hub.create(req.body.hostId);
  return { code: room.code };
});

app.get<{ Params: { code: string } }>('/api/room/:code', async (req, reply) => {
  const room = hub.get(req.params.code);
  if (!room) return reply.code(404).send({ error: 'No such room' });
  const champion = await store.getChampion(room.code);
  let championBuild = null;
  if (champion) {
    const b = await store.getBuild(champion.buildId);
    if (b) championBuild = { name: b.build.name, playerName: b.playerName, sheet: b.sheet };
  }
  return { code: room.code, viewers: room.viewers.size, champion: championBuild, lineage: champion?.lineage ?? [] };
});

app.post<{ Params: { code: string }; Body: SubmitBody }>(
  '/api/room/:code/challenge',
  async (req, reply) => {
    const room = hub.get(req.params.code);
    if (!room) return reply.code(404).send({ error: 'No such room' });
    let build: Build, sheet: Sheet;
    try {
      ({ build, sheet } = validateSubmission(req.body));
    } catch (err) {
      if (err instanceof DraftError) {
        return reply.code(422).send({ error: `Draft rejected: ${err.message}` });
      }
      throw err;
    }
    const stored: StoredBuild = {
      id: randomUUID(), playerId: req.body.playerId,
      playerName: (req.body.playerName ?? 'Anonymous Exile').slice(0, 32),
      mode: 'ladder', seed: req.body.seed, poolVersion: pi.pool.version,
      build, sheet, log: req.body.log, elo: 1000, wins: 0, losses: 0,
      createdAt: new Date().toISOString(),
    };
    await store.saveBuild(stored);

    const champion = await store.getChampion(room.code);
    const champBuild = champion ? await store.getBuild(champion.buildId) : undefined;
    if (!champBuild) {
      await store.setChampion({
        roomCode: room.code, buildId: stored.id,
        lineage: [{ name: build.name, playerName: stored.playerName, defeated: 0, crownedAt: stored.createdAt }],
      });
      return { crowned: true, result: null, champion: { name: build.name, sheet } };
    }

    const fightSeed = `room:${room.code}:${stored.id}:${champBuild.id}`;
    const result = fight(sheet, champBuild.sheet, fightSeed);
    const won = result.winner === 0;
    const lineage = champion!.lineage;
    if (won) {
      lineage.unshift({ name: build.name, playerName: stored.playerName, defeated: 0, crownedAt: new Date().toISOString() });
    } else {
      lineage[0] = { ...lineage[0], defeated: lineage[0].defeated + 1 };
    }
    await store.setChampion({ roomCode: room.code, buildId: won ? stored.id : champBuild.id, lineage: lineage.slice(0, 20) });
    const fightId = randomUUID();
    await store.saveFight({ id: fightId, buildA: stored.id, buildB: champBuild.id, seed: fightSeed, result, createdAt: new Date().toISOString() });
    return {
      crowned: won, fightId, result,
      you: { name: build.name, sheet },
      opponent: { name: champBuild.build.name, playerName: champBuild.playerName, sheet: champBuild.sheet },
    };
  },
);

app.get<{ Params: { code: string }; Querystring: { role?: string; viewerId?: string } }>(
  '/ws/room/:code',
  { websocket: true },
  (conn, req) => {
    // @fastify/websocket v10 hands us a SocketStream; the ws lives on .socket
    const socket = (conn as unknown as { socket?: import('ws').WebSocket }).socket
      ?? (conn as unknown as import('ws').WebSocket);
    const room = hub.get(req.params.code);
    if (!room) { socket.close(4004, 'no such room'); return; }
    const role = req.query.role === 'host' ? 'host' : 'viewer';
    if (role === 'host') hub.connectHost(room, socket);
    else hub.connectViewer(room, socket, req.query.viewerId || randomUUID());
  },
);

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '0.0.0.0' });
console.log(`⚔ Exile Draft server on :${port} (pool v${pi.pool.version})`);
