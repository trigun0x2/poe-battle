/**
 * API client. The server is authoritative for the ladder; when it's
 * unreachable (static demo, offline dev) we degrade to a local fight
 * against a seeded bot — clearly labelled as an exhibition match.
 */
import {
  DraftAction, DraftPool, FightResult, Sheet, botDraft, computeSheet, fight,
  indexPool,
} from '@exile/sim';
import poolJson from '@exile/data';
import { playerId, playerName } from './persist';

export const pool = indexPool(poolJson as unknown as DraftPool);

const BASE = import.meta.env.VITE_API_URL ?? '';

export interface FightPackage {
  fightId?: string;
  result: FightResult;
  you: { name: string; sheet: Sheet };
  opponent: { name: string; playerName?: string; sheet: Sheet };
  eloDelta?: number;
  exhibition?: boolean;
  crowned?: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  return data as T;
}

export class ApiError extends Error {
  constructor(msg: string, public status: number) { super(msg); }
}

function localExhibition(seed: string, log: DraftAction[], buildName: string, sheet: Sheet): FightPackage {
  const rival = botDraft(pool, `rival:${seed}`);
  const rivalSheet = computeSheet(pool, rival.state.build, pool.pool.combos);
  const result = fight(sheet, rivalSheet, `exhibition:${seed}`);
  return {
    result,
    you: { name: buildName, sheet },
    opponent: { name: rival.state.build.name, playerName: 'The Machine', sheet: rivalSheet },
    exhibition: true,
  };
}

export async function submitDraft(
  mode: 'ladder' | 'daily',
  seed: string,
  log: DraftAction[],
  buildName: string,
  sheet: Sheet,
): Promise<FightPackage> {
  try {
    return await post<FightPackage>('/api/submit', {
      seed, mode, log, playerId: playerId(), playerName: playerName(),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) throw err;
    return localExhibition(seed, log, buildName, sheet);
  }
}

export async function challengeRoom(
  code: string, seed: string, log: DraftAction[], buildName: string, sheet: Sheet,
): Promise<FightPackage> {
  try {
    const res = await post<FightPackage & { champion?: unknown }>(
      `/api/room/${code}/challenge`,
      { seed, mode: 'ladder', log, playerId: playerId(), playerName: playerName() },
    );
    if (!res.result) {
      // First blood: crowned without a fight.
      return { ...localExhibition(seed, log, buildName, sheet), crowned: true };
    }
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) throw err;
    return localExhibition(seed, log, buildName, sheet);
  }
}

export async function fetchDaily(): Promise<{ seed: string; key: string; resetsAt: string }> {
  try {
    const res = await fetch(`${BASE}/api/daily`);
    if (res.ok) return await res.json();
  } catch { /* fall through to local derivation */ }
  const key = new Date().toISOString().slice(0, 10);
  return { seed: `daily:${key}`, key, resetsAt: '' };
}

export async function fetchLadder(): Promise<unknown[]> {
  try {
    const res = await fetch(`${BASE}/api/ladder`);
    if (res.ok) return await res.json();
  } catch { /* server down */ }
  return [];
}

export async function fetchDailyLeaderboard(): Promise<unknown[]> {
  try {
    const res = await fetch(`${BASE}/api/daily/leaderboard`);
    if (res.ok) return await res.json();
  } catch { /* server down */ }
  return [];
}

export async function createRoom(): Promise<string> {
  const { code } = await post<{ code: string }>('/api/room', { hostId: playerId() });
  return code;
}

export async function fetchRoom(code: string): Promise<{
  code: string; viewers: number;
  champion: { name: string; playerName: string; sheet: Sheet } | null;
  lineage: { name: string; playerName: string; defeated: number; crownedAt: string }[];
} | null> {
  try {
    const res = await fetch(`${BASE}/api/room/${code}`);
    if (res.ok) return await res.json();
  } catch { /* no room */ }
  return null;
}

export function roomSocketUrl(code: string, role: 'host' | 'viewer'): string {
  const base = BASE || window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/ws/room/${code}`;
  url.search = `?role=${role}&viewerId=${playerId()}`;
  return url.toString();
}
