/**
 * Storage abstraction. MemoryStore keeps dev/demo zero-dependency (with an
 * optional JSON snapshot on disk); PgStore is the production path, selected
 * automatically when DATABASE_URL is set. Same interface, same semantics.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import type { Build, DraftAction, FightResult, Sheet } from '@exile/sim';

export interface StoredBuild {
  id: string;
  playerId: string;
  playerName: string;
  mode: 'ladder' | 'daily';
  dailyKey?: string;
  seed: string;
  poolVersion: string;
  build: Build;
  sheet: Sheet;
  log: DraftAction[];
  elo: number;
  wins: number;
  losses: number;
  createdAt: string;
}

export interface StoredFight {
  id: string;
  buildA: string;
  buildB: string;
  seed: string;
  result: FightResult;
  createdAt: string;
}

export interface RoomChampion {
  roomCode: string;
  buildId: string;
  lineage: { name: string; playerName: string; defeated: number; crownedAt: string }[];
}

export interface Store {
  saveBuild(b: StoredBuild): Promise<void>;
  getBuild(id: string): Promise<StoredBuild | undefined>;
  updateRecord(id: string, elo: number, won: boolean): Promise<void>;
  ladder(limit: number): Promise<StoredBuild[]>;
  dailyLadder(dailyKey: string, limit: number): Promise<StoredBuild[]>;
  hasDailyAttempt(playerId: string, dailyKey: string): Promise<boolean>;
  /** Nearest-Elo opponent, excluding the player's own builds. */
  findOpponent(elo: number, excludePlayer: string): Promise<StoredBuild | undefined>;
  saveFight(f: StoredFight): Promise<void>;
  getFight(id: string): Promise<StoredFight | undefined>;
  getChampion(roomCode: string): Promise<RoomChampion | undefined>;
  setChampion(c: RoomChampion): Promise<void>;
}

// ── Memory (with JSON snapshot) ───────────────────────────────────────────

interface Snapshot {
  builds: StoredBuild[];
  fights: StoredFight[];
  champions: RoomChampion[];
}

export class MemoryStore implements Store {
  private builds = new Map<string, StoredBuild>();
  private fights = new Map<string, StoredFight>();
  private champions = new Map<string, RoomChampion>();

  constructor(private snapshotPath?: string) {
    if (snapshotPath && existsSync(snapshotPath)) {
      try {
        const snap = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot;
        for (const b of snap.builds) this.builds.set(b.id, b);
        for (const f of snap.fights) this.fights.set(f.id, f);
        for (const c of snap.champions) this.champions.set(c.roomCode, c);
      } catch {
        // corrupt snapshot: start clean rather than crash the server
      }
    }
  }

  private persist() {
    if (!this.snapshotPath) return;
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    const snap: Snapshot = {
      builds: [...this.builds.values()],
      fights: [...this.fights.values()],
      champions: [...this.champions.values()],
    };
    writeFileSync(this.snapshotPath, JSON.stringify(snap));
  }

  async saveBuild(b: StoredBuild) { this.builds.set(b.id, b); this.persist(); }
  async getBuild(id: string) { return this.builds.get(id); }
  async updateRecord(id: string, elo: number, won: boolean) {
    const b = this.builds.get(id);
    if (!b) return;
    b.elo = elo;
    if (won) b.wins++; else b.losses++;
    this.persist();
  }
  async ladder(limit: number) {
    return [...this.builds.values()]
      .filter((b) => b.mode === 'ladder')
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  }
  async dailyLadder(dailyKey: string, limit: number) {
    return [...this.builds.values()]
      .filter((b) => b.mode === 'daily' && b.dailyKey === dailyKey)
      .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.sheet.dps - a.sheet.dps)
      .slice(0, limit);
  }
  async hasDailyAttempt(playerId: string, dailyKey: string) {
    return [...this.builds.values()].some(
      (b) => b.mode === 'daily' && b.playerId === playerId && b.dailyKey === dailyKey,
    );
  }
  async findOpponent(elo: number, excludePlayer: string) {
    const candidates = [...this.builds.values()].filter(
      (b) => b.mode === 'ladder' && b.playerId !== excludePlayer,
    );
    candidates.sort((a, b) => Math.abs(a.elo - elo) - Math.abs(b.elo - elo));
    return candidates[0];
  }
  async saveFight(f: StoredFight) { this.fights.set(f.id, f); this.persist(); }
  async getFight(id: string) { return this.fights.get(id); }
  async getChampion(roomCode: string) { return this.champions.get(roomCode); }
  async setChampion(c: RoomChampion) { this.champions.set(c.roomCode, c); this.persist(); }
}

// ── Postgres ──────────────────────────────────────────────────────────────

export class PgStore implements Store {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS builds (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        mode TEXT NOT NULL,
        daily_key TEXT,
        seed TEXT NOT NULL,
        pool_version TEXT NOT NULL,
        data JSONB NOT NULL,
        elo INT NOT NULL DEFAULT 1000,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS builds_ladder ON builds (mode, elo DESC);
      CREATE INDEX IF NOT EXISTS builds_daily ON builds (mode, daily_key);
      CREATE TABLE IF NOT EXISTS fights (
        id TEXT PRIMARY KEY,
        build_a TEXT NOT NULL,
        build_b TEXT NOT NULL,
        seed TEXT NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS champions (
        room_code TEXT PRIMARY KEY,
        build_id TEXT NOT NULL,
        lineage JSONB NOT NULL DEFAULT '[]'
      );
    `);
  }

  private rowToBuild(r: any): StoredBuild {
    return {
      id: r.id, playerId: r.player_id, playerName: r.player_name, mode: r.mode,
      dailyKey: r.daily_key ?? undefined, seed: r.seed, poolVersion: r.pool_version,
      build: r.data.build, sheet: r.data.sheet, log: r.data.log,
      elo: r.elo, wins: r.wins, losses: r.losses,
      createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    };
  }

  async saveBuild(b: StoredBuild) {
    await this.pool.query(
      `INSERT INTO builds (id, player_id, player_name, mode, daily_key, seed, pool_version, data, elo, wins, losses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [b.id, b.playerId, b.playerName, b.mode, b.dailyKey ?? null, b.seed, b.poolVersion,
       JSON.stringify({ build: b.build, sheet: b.sheet, log: b.log }), b.elo, b.wins, b.losses],
    );
  }
  async getBuild(id: string) {
    const r = await this.pool.query('SELECT * FROM builds WHERE id = $1', [id]);
    return r.rows[0] ? this.rowToBuild(r.rows[0]) : undefined;
  }
  async updateRecord(id: string, elo: number, won: boolean) {
    await this.pool.query(
      `UPDATE builds SET elo = $2, wins = wins + $3, losses = losses + $4 WHERE id = $1`,
      [id, elo, won ? 1 : 0, won ? 0 : 1],
    );
  }
  async ladder(limit: number) {
    const r = await this.pool.query(
      `SELECT * FROM builds WHERE mode = 'ladder' ORDER BY elo DESC LIMIT $1`, [limit]);
    return r.rows.map((row: any) => this.rowToBuild(row));
  }
  async dailyLadder(dailyKey: string, limit: number) {
    const r = await this.pool.query(
      `SELECT * FROM builds WHERE mode = 'daily' AND daily_key = $1
       ORDER BY (wins - losses) DESC, (data->'sheet'->>'dps')::numeric DESC LIMIT $2`,
      [dailyKey, limit]);
    return r.rows.map((row: any) => this.rowToBuild(row));
  }
  async hasDailyAttempt(playerId: string, dailyKey: string) {
    const r = await this.pool.query(
      `SELECT 1 FROM builds WHERE mode = 'daily' AND player_id = $1 AND daily_key = $2 LIMIT 1`,
      [playerId, dailyKey]);
    return r.rows.length > 0;
  }
  async findOpponent(elo: number, excludePlayer: string) {
    const r = await this.pool.query(
      `SELECT * FROM builds WHERE mode = 'ladder' AND player_id != $1
       ORDER BY ABS(elo - $2) ASC LIMIT 1`, [excludePlayer, elo]);
    return r.rows[0] ? this.rowToBuild(r.rows[0]) : undefined;
  }
  async saveFight(f: StoredFight) {
    await this.pool.query(
      `INSERT INTO fights (id, build_a, build_b, seed, result) VALUES ($1,$2,$3,$4,$5)`,
      [f.id, f.buildA, f.buildB, f.seed, JSON.stringify(f.result)]);
  }
  async getFight(id: string) {
    const r = await this.pool.query('SELECT * FROM fights WHERE id = $1', [id]);
    if (!r.rows[0]) return undefined;
    const row = r.rows[0];
    return {
      id: row.id, buildA: row.build_a, buildB: row.build_b, seed: row.seed,
      result: row.result, createdAt: String(row.created_at),
    };
  }
  async getChampion(roomCode: string) {
    const r = await this.pool.query('SELECT * FROM champions WHERE room_code = $1', [roomCode]);
    if (!r.rows[0]) return undefined;
    return { roomCode: r.rows[0].room_code, buildId: r.rows[0].build_id, lineage: r.rows[0].lineage };
  }
  async setChampion(c: RoomChampion) {
    await this.pool.query(
      `INSERT INTO champions (room_code, build_id, lineage) VALUES ($1,$2,$3)
       ON CONFLICT (room_code) DO UPDATE SET build_id = $2, lineage = $3`,
      [c.roomCode, c.buildId, JSON.stringify(c.lineage)]);
  }
}

export async function createStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const store = new PgStore(url);
    await store.init();
    return store;
  }
  return new MemoryStore(process.env.SNAPSHOT_PATH ?? './.data/snapshot.json');
}
