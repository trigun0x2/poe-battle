/**
 * The draft state machine. Pure and deterministic: (pool, seed, action log)
 * fully determines the resulting state, which is how the server validates
 * client drafts — it replays the transcript and checks every rule itself.
 */

import { Rng } from './rng.js';
import {
  Build, BuildSlot, Entity, GearSlot, PoolIndex, Tier, buildEntityIds,
} from './types.js';

export const ROUNDS = 8;
export const STARTING_BUDGET = 40;
export const SHOP_SIZE = 5;
export const ASCENDANCY_ROUND = 3;
export const MAX_LOCKS = 2;
export const MAX_SUPPORTS = 4;
export const MAX_KEYSTONES = 2;

/** Tier weights per round (index 0 = round 1), [T1..T5]. */
const TIER_WEIGHTS: Record<number, [number, number, number, number, number]> = {
  1: [65, 35, 0, 0, 0],
  2: [52, 48, 0, 0, 0],
  3: [30, 40, 25, 5, 0],
  4: [15, 35, 35, 15, 0],
  5: [5, 25, 40, 25, 5],
  6: [0, 15, 35, 35, 15],
  7: [0, 5, 25, 45, 25],
  8: [0, 0, 15, 45, 40],
};

/** Highest tier a round is ever allowed to show (anti-cheat gate). */
export function maxTierForRound(round: number): Tier {
  const w = TIER_WEIGHTS[round];
  for (let t = 4; t >= 0; t--) if (w[t] > 0) return (t + 1) as Tier;
  return 1;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  unique: 46, skill: 18, support: 26, keystone: 10,
};

export interface Offer {
  entity: Entity;
  price: number;
  locked: boolean;
  sold: boolean;
}

export type DraftAction =
  | { t: 'buy'; i: number }
  | { t: 'lock'; i: number }
  | { t: 'unlock'; i: number }
  | { t: 'reroll' }
  | { t: 'rerollSlot'; i: number } // chaos event: Cartographer's Sextant
  | { t: 'mirror' }               // chaos event: duplicate a random offer
  | { t: 'vaal' }                 // chaos event: corrupt a random drafted item
  | { t: 'bias'; tag: string }    // audience vote: emphasise a tag next round
  | { t: 'next' }
  | { t: 'rename'; name: string };

export interface DraftState {
  seed: string;
  round: number;
  budget: number;
  shop: Offer[];
  rerollsThisRound: number;
  /** Audience-voted tag emphasis applied to the next generated shop. */
  biasTag?: string;
  build: Build;
  done: boolean;
  /** Full transcript — this is what gets submitted to the server. */
  log: DraftAction[];
  /** Set by the last vaal action, for the UI to stage the reveal. */
  lastVaal?: { id: string; outcome: 'brick' | 'upgrade' | 'none' };
}

export class DraftError extends Error {}

/** Escalating reroll price: by round bracket, +1 for each repeat in-round. */
export function rerollCost(round: number, rerollsThisRound: number): number {
  return 1 + Math.floor((round - 1) / 2) + rerollsThisRound;
}

function slotFor(entity: Entity, build: Build): BuildSlot | undefined {
  const s = entity.slot as GearSlot | undefined;
  if (!s) return undefined;
  if (s === 'ring') return !build.gear.ring1 ? 'ring1' : !build.gear.ring2 ? 'ring2' : undefined;
  if (s === 'flask') return !build.gear.flask1 ? 'flask1' : !build.gear.flask2 ? 'flask2' : undefined;
  return build.gear[s] ? undefined : s;
}

/** Why an offer can't be bought right now — or null if it can. */
export function purchaseBlock(state: DraftState, offer: Offer): string | null {
  if (offer.sold) return 'Sold';
  if (offer.price > state.budget) return 'Not enough orbs';
  const e = offer.entity;
  const owned = new Set(buildEntityIds(state.build));
  if (owned.has(e.id)) return 'Already drafted';
  switch (e.category) {
    case 'skill':
      return null; // a new main skill replaces the old one — commit or pivot
    case 'support':
      return state.build.supports.length >= MAX_SUPPORTS ? 'Support slots full' : null;
    case 'ascendancy':
      return state.build.ascendancy ? 'Ascended already' : null;
    case 'keystone':
      return state.build.keystones.length >= MAX_KEYSTONES ? 'Keystone limit' : null;
    case 'unique':
      return slotFor(e, state.build) ? null : 'Slot occupied';
  }
}

/** Weighted entity selection for one shop slot. */
function rollEntity(
  rng: Rng,
  pool: PoolIndex,
  state: Pick<DraftState, 'round' | 'build' | 'biasTag'>,
  exclude: Set<string>,
): Entity {
  const round = state.round;
  const tierW = TIER_WEIGHTS[round];
  const isAscRound = round === ASCENDANCY_ROUND && !state.build.ascendancy;
  const ownedTags = new Map<string, number>();
  const pi = pool;
  for (const id of buildEntityIds(state.build)) {
    const e = pi.byId.get(id);
    if (e) for (const tag of e.tags) ownedTags.set(tag, (ownedTags.get(tag) ?? 0) + 1);
  }
  const needsSkill = !state.build.skill && round >= 2;

  const candidates = pi.pool.entities.filter((e) => {
    if (exclude.has(e.id)) return false;
    if (e.category === 'ascendancy') return isAscRound;
    if (isAscRound) return false;
    return tierW[e.tier - 1] > 0;
  });

  return rng.weighted(candidates, (e) => {
    if (e.category === 'ascendancy') return 1;
    let w = tierW[e.tier - 1] * (CATEGORY_WEIGHTS[e.category] ?? 1);
    // Soft synergy bias: shared tags nudge, never guarantee.
    let shared = 0;
    for (const tag of e.tags) if (ownedTags.has(tag)) shared++;
    w *= Math.min(1.6, 1 + 0.15 * shared);
    if (state.biasTag && e.tags.includes(state.biasTag)) w *= 2.2;
    if (needsSkill && e.category === 'skill') w *= 2.5;
    if (e.category === 'support' && !state.build.skill) w *= 0.5;
    return w;
  });
}

function priceOf(e: Entity): number {
  return e.cost;
}

function rollShop(rng: Rng, pool: PoolIndex, state: DraftState, keep: Offer[]): Offer[] {
  const isAscRound = state.round === ASCENDANCY_ROUND && !state.build.ascendancy;
  const size = isAscRound ? 3 : SHOP_SIZE;
  const offers: Offer[] = keep.map((o) => ({ ...o, locked: false }));
  const exclude = new Set<string>(offers.map((o) => o.entity.id));
  for (const id of buildEntityIds(state.build)) exclude.add(id);
  while (offers.length < size) {
    const e = rollEntity(rng, pool, state, exclude);
    exclude.add(e.id);
    offers.push({ entity: e, price: isAscRound ? 0 : priceOf(e), locked: false, sold: false });
  }
  return offers;
}

/** The rng stream is re-derived per state so replays are exact. */
function draftRng(state: DraftState): Rng {
  return new Rng(`${state.seed}:r${state.round}:x${state.rerollsThisRound}:${state.log.length}`);
}

export function createDraft(pool: PoolIndex, seed: string): DraftState {
  const state: DraftState = {
    seed,
    round: 1,
    budget: STARTING_BUDGET,
    shop: [],
    rerollsThisRound: 0,
    build: { name: '', supports: [], keystones: [], gear: {} },
    done: false,
    log: [],
  };
  state.shop = rollShop(draftRng(state), pool, state, []);
  return state;
}

/**
 * Apply one action, returning a NEW state. Throws DraftError on any illegal
 * action — the server treats a throw during replay as a rejected submission.
 */
export function applyAction(pool: PoolIndex, state: DraftState, action: DraftAction): DraftState {
  if (state.done && action.t !== 'rename') throw new DraftError('Draft is sealed');
  const next: DraftState = {
    ...state,
    shop: state.shop.map((o) => ({ ...o })),
    build: {
      ...state.build,
      supports: [...state.build.supports],
      keystones: [...state.build.keystones],
      gear: { ...state.build.gear },
      corruptions: { ...(state.build.corruptions ?? {}) },
    },
    log: [...state.log, action],
    lastVaal: undefined,
  };

  switch (action.t) {
    case 'buy': {
      const offer = next.shop[action.i];
      if (!offer) throw new DraftError('No such offer');
      const block = purchaseBlock(next, offer);
      if (block) throw new DraftError(block);
      next.budget -= offer.price;
      offer.sold = true;
      offer.locked = false;
      const e = offer.entity;
      if (e.category === 'skill') next.build.skill = e.id;
      else if (e.category === 'support') next.build.supports.push(e.id);
      else if (e.category === 'ascendancy') next.build.ascendancy = e.id;
      else if (e.category === 'keystone') next.build.keystones.push(e.id);
      else {
        const slot = slotFor(e, state.build);
        if (!slot) throw new DraftError('Slot occupied');
        next.build.gear[slot] = e.id;
      }
      if (!next.build.name) next.build.name = ''; // named at seal time
      return next;
    }
    case 'lock': {
      const offer = next.shop[action.i];
      if (!offer || offer.sold) throw new DraftError('Cannot lock that');
      if (next.round >= ROUNDS) throw new DraftError('Nothing after the last round');
      const locks = next.shop.filter((o) => o.locked).length;
      if (offer.locked) return next; // idempotent
      if (locks >= MAX_LOCKS) throw new DraftError('Lock limit reached');
      offer.locked = true;
      return next;
    }
    case 'unlock': {
      const offer = next.shop[action.i];
      if (!offer) throw new DraftError('No such offer');
      offer.locked = false;
      return next;
    }
    case 'reroll': {
      const cost = rerollCost(next.round, next.rerollsThisRound);
      if (cost > next.budget) throw new DraftError('Not enough orbs to reroll');
      next.budget -= cost;
      next.rerollsThisRound += 1;
      const kept = next.shop.filter((o) => o.locked && !o.sold);
      next.shop = rollShop(draftRng(next), pool, next, kept);
      // rollShop clears the locked flag; restore it so locks survive rerolls
      for (let i = 0; i < kept.length; i++) next.shop[i].locked = true;
      return next;
    }
    case 'rerollSlot': {
      // Chaos event — free, replaces exactly one unsold offer.
      const offer = next.shop[action.i];
      if (!offer || offer.sold) throw new DraftError('Cannot reroll that slot');
      const rng = draftRng(next).fork(`sextant${action.i}`);
      const exclude = new Set(next.shop.map((o) => o.entity.id));
      for (const id of buildEntityIds(next.build)) exclude.add(id);
      const e = rollEntity(rng, pool, next, exclude);
      next.shop[action.i] = { entity: e, price: priceOf(e), locked: false, sold: false };
      return next;
    }
    case 'mirror': {
      // Chaos event — duplicate a random unsold offer into the shop.
      const rng = draftRng(next).fork('mirror');
      const source = next.shop.filter((o) => !o.sold);
      if (source.length === 0) throw new DraftError('Nothing to mirror');
      const chosen = rng.pick(source);
      next.shop.push({ ...chosen, locked: false });
      return next;
    }
    case 'vaal': {
      // Chaos event — corrupt a random drafted gear piece. 25/25/50.
      const rng = draftRng(next).fork('vaal');
      const slots = Object.keys(next.build.gear) as BuildSlot[];
      const uncorrupted = slots.filter((s) => !(next.build.corruptions ?? {})[next.build.gear[s]!]);
      if (uncorrupted.length === 0) throw new DraftError('Nothing to corrupt');
      const slot = rng.pick(uncorrupted);
      const id = next.build.gear[slot]!;
      const roll = rng.next();
      const outcome = roll < 0.25 ? 'brick' : roll < 0.5 ? 'upgrade' : 'none';
      if (outcome !== 'none') next.build.corruptions![id] = outcome;
      next.lastVaal = { id, outcome };
      return next;
    }
    case 'bias': {
      next.biasTag = action.tag;
      return next;
    }
    case 'next': {
      if (next.round >= ROUNDS) {
        next.done = true;
        return next;
      }
      const kept = next.shop.filter((o) => o.locked && !o.sold);
      next.round += 1;
      next.rerollsThisRound = 0;
      // A lock is consumed by the round transition: the offer persists once.
      next.shop = rollShop(draftRng(next), pool, next, kept);
      next.biasTag = undefined;
      return next;
    }
    case 'rename': {
      const name = action.name.trim().slice(0, 48);
      if (!name) throw new DraftError('A name is required');
      next.build.name = name;
      return next;
    }
  }
}

/**
 * Server-side validation: replay a transcript from the seed and confirm every
 * action was legal. Returns the final state (throws DraftError if not).
 */
export function replayDraft(pool: PoolIndex, seed: string, log: DraftAction[]): DraftState {
  let state = createDraft(pool, seed);
  for (const action of log) state = applyAction(pool, state, action);
  if (!state.done) throw new DraftError('Draft was not sealed');
  return state;
}
