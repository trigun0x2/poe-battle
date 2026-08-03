/**
 * A seeded draft bot: the local mock opponent, the ladder's cold-start
 * opponent, and the property-test driver are all this one function.
 */
import { Rng } from './rng.js';
import { DraftAction, DraftState, applyAction, createDraft, purchaseBlock } from './draft.js';
import { PoolIndex } from './types.js';
import { computeSheet } from './stats.js';
import { generateBuildName } from './names.js';

export interface BotResult {
  state: DraftState;
  log: DraftAction[];
}

export function botDraft(pool: PoolIndex, seed: string): BotResult {
  const rng = new Rng(`bot:${seed}`);
  let state = createDraft(pool, seed);
  const log: DraftAction[] = [];
  const act = (a: DraftAction) => {
    state = applyAction(pool, state, a);
    log.push(a);
  };
  while (!state.done) {
    for (let attempts = 0; attempts < 4; attempts++) {
      const buyable = state.shop
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => !purchaseBlock(state, o));
      if (buyable.length > 0 && rng.chance(0.75)) {
        // Prefer synergy: weight buyables by shared tags with the drafted skill.
        const skillTags = state.build.skill
          ? pool.byId.get(state.build.skill)?.tags ?? []
          : [];
        const choice = rng.weighted(buyable, ({ o }) => {
          let w = 1 + o.entity.tier;
          for (const t of o.entity.tags) if (skillTags.includes(t)) w += 2;
          return w;
        });
        act({ t: 'buy', i: choice.i });
      }
    }
    if (rng.chance(0.3) && state.budget > 6) act({ t: 'reroll' });
    if (rng.chance(0.4) && state.round < 8) {
      const lockable = state.shop
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => !o.sold && !o.locked);
      const locks = state.shop.filter((o) => o.locked).length;
      if (lockable.length > 0 && locks < 2) act({ t: 'lock', i: rng.pick(lockable).i });
    }
    act({ t: 'next' });
  }
  const sheet = computeSheet(pool, state.build, pool.pool.combos);
  act({ t: 'rename', name: generateBuildName(seed, sheet) });
  return { state, log };
}
