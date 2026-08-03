import { describe, expect, it } from 'vitest';
import pool from '../../data/dist/draft-pool.json';
import {
  DraftAction, DraftPool, Rng, applyAction, botDraft as simBot, computeSheet,
  createDraft, fight, generateBuildName, indexPool, maxTierForRound,
  purchaseBlock, replayDraft,
} from '../src/index.js';

const pi = indexPool(pool as unknown as DraftPool);

function botDraft(seed: string): { log: DraftAction[]; stateJson: string } {
  const { state, log } = simBot(pi, seed);
  return { log, stateJson: JSON.stringify(state) };
}

describe('draft determinism', () => {
  it('same seed + same actions → identical state (100 seeds)', () => {
    for (let i = 0; i < 100; i++) {
      const seed = `prop-seed-${i}`;
      const a = botDraft(seed);
      const b = botDraft(seed);
      expect(b.stateJson).toBe(a.stateJson);
    }
  });

  it('server replay of a transcript reproduces the exact final build', () => {
    for (let i = 0; i < 25; i++) {
      const seed = `replay-${i}`;
      const { log, stateJson } = botDraft(seed);
      const replayed = replayDraft(pi, seed, log);
      expect(JSON.stringify(replayed)).toBe(stateJson);
    }
  });

  it('tampered transcripts are rejected', () => {
    const seed = 'tamper';
    const { log } = botDraft(seed);
    // Grant yourself a free Headhunter by inventing a buy at a bogus index.
    const forged = [...log.slice(0, -1), { t: 'buy', i: 99 } as DraftAction];
    expect(() => replayDraft(pi, seed, forged)).toThrow();
  });

  it('budget never goes negative and tier gating holds', () => {
    for (let i = 0; i < 40; i++) {
      const rng = new Rng(`gate-${i}`);
      let state = createDraft(pi, `gate-seed-${i}`);
      while (!state.done) {
        expect(state.budget).toBeGreaterThanOrEqual(0);
        const maxTier = maxTierForRound(state.round);
        for (const o of state.shop) {
          // Locked offers may carry a lower-tier item forward; the gate is
          // one-way — nothing above the round's ceiling may ever appear.
          if (o.entity.category !== 'ascendancy') {
            expect(o.entity.tier).toBeLessThanOrEqual(maxTier);
          }
        }
        const buyable = state.shop.filter((o) => !purchaseBlock(state, o));
        if (buyable.length > 0 && rng.chance(0.5)) {
          state = applyAction(pi, state, { t: 'buy', i: state.shop.indexOf(rng.pick(buyable)) });
        }
        state = applyAction(pi, state, { t: 'next' });
      }
    }
  });
});

describe('arena determinism', () => {
  function sheets(seedA: string, seedB: string) {
    const a = replayDraft(pi, seedA, botDraft(seedA).log);
    const b = replayDraft(pi, seedB, botDraft(seedB).log);
    return [
      computeSheet(pi, a.build, pi.pool.combos),
      computeSheet(pi, b.build, pi.pool.combos),
    ] as const;
  }

  it('same sheets + same seed → identical fight, event for event (50 pairs)', () => {
    for (let i = 0; i < 50; i++) {
      const [sa, sb] = sheets(`fa-${i}`, `fb-${i}`);
      const r1 = fight(sa, sb, `arena-${i}`);
      const r2 = fight(sa, sb, `arena-${i}`);
      expect(JSON.stringify(r2)).toBe(JSON.stringify(r1));
      expect(r1.events.at(-1)?.kind).toBe('kill');
    }
  });

  it('upsets are possible but rare: ~15–20% aggregate underdog win rate', () => {
    // Many bot-vs-bot matchups; the underdog is the lower dps×ehp side.
    let fights = 0;
    let underdogWins = 0;
    for (let i = 0; i < 120; i++) {
      const [sa, sb] = sheets(`ua-${i}`, `ub-${i}`);
      const power = (s: typeof sa) => s.dps * s.ehp;
      if (Math.abs(power(sa) - power(sb)) / Math.max(power(sa), power(sb)) < 0.1) continue;
      const underdog = power(sa) < power(sb) ? 0 : 1;
      for (let j = 0; j < 3; j++) {
        const r = fight(sa, sb, `upset-${i}-${j}`);
        fights++;
        if (r.winner === underdog) underdogWins++;
      }
    }
    const rate = underdogWins / fights;
    expect(fights).toBeGreaterThan(100);
    expect(rate).toBeGreaterThan(0.08);
    expect(rate).toBeLessThan(0.32);
  });
});

describe('names', () => {
  it('is deterministic per seed', () => {
    expect(generateBuildName('x', { skillTags: ['fire'] }))
      .toBe(generateBuildName('x', { skillTags: ['fire'] }));
  });
});
