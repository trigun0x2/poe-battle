import { create } from 'zustand';
import {
  ComboFlag, DraftAction, DraftError, DraftState, Sheet, applyAction,
  computeSheet, createDraft, generateBuildName, purchaseBlock,
} from '@exile/sim';
import { FightPackage, challengeRoom, pool, submitDraft } from './lib/api';
import * as sound from './lib/sound';
import { markDailyDone } from './lib/persist';

export type DraftMode = 'ladder' | 'daily' | 'challenge';

const FIGHT_KEY = 'exile-draft:last-fight';

export function loadLastFight(): FightPackage | null {
  try {
    const raw = sessionStorage.getItem(FIGHT_KEY);
    return raw ? (JSON.parse(raw) as FightPackage) : null;
  } catch { return null; }
}

interface DraftStore {
  mode: DraftMode;
  roomCode?: string;
  dailyKey?: string;
  seed: string;
  state: DraftState | null;
  sheet: Sheet | null;
  toast: string | null;
  submitting: boolean;
  fightPkg: FightPackage | null;
  /** Staged Vaal reveal: set when a corruption resolves, cleared by the UI. */
  vaalReveal: { name: string; outcome: 'brick' | 'upgrade' | 'none' } | null;
  /** Monotonic counter that keys the shop DOM so deal-in animations replay. */
  shopEpoch: number;

  begin(mode: DraftMode, seed: string, opts?: { roomCode?: string; dailyKey?: string }): void;
  act(action: DraftAction, opts?: { silent?: boolean }): boolean;
  buy(i: number): void;
  toggleLock(i: number): void;
  reroll(): void;
  next(): void;
  rename(name: string): void;
  applyChaos(kind: 'vaal' | 'mirror' | 'rerollSlot'): void;
  applyBias(tag: string): void;
  seal(): Promise<FightPackage | null>;
  clearToast(): void;
  clearVaal(): void;
  suggestedName(): string;
}

export const useDraft = create<DraftStore>((set, get) => ({
  mode: 'ladder',
  seed: '',
  state: null,
  sheet: null,
  toast: null,
  submitting: false,
  fightPkg: null,
  vaalReveal: null,
  shopEpoch: 0,

  begin(mode, seed, opts) {
    const state = createDraft(pool, seed);
    set({
      mode, seed, state,
      roomCode: opts?.roomCode, dailyKey: opts?.dailyKey,
      sheet: computeSheet(pool, state.build, pool.pool.combos),
      fightPkg: null, toast: null, vaalReveal: null,
      shopEpoch: get().shopEpoch + 1,
    });
  },

  act(action, opts) {
    const { state } = get();
    if (!state) return false;
    try {
      const next = applyAction(pool, state, action);
      const patch: Partial<DraftStore> = {
        state: next,
        sheet: computeSheet(pool, next.build, pool.pool.combos),
      };
      if (action.t === 'reroll' || action.t === 'next') {
        patch.shopEpoch = get().shopEpoch + 1;
      }
      if (action.t === 'vaal' && next.lastVaal) {
        const entity = pool.byId.get(next.lastVaal.id);
        patch.vaalReveal = { name: entity?.name ?? '?', outcome: next.lastVaal.outcome };
      }
      set(patch);
      return true;
    } catch (err) {
      if (err instanceof DraftError && !opts?.silent) {
        set({ toast: err.message });
        window.setTimeout(() => get().clearToast(), 2600);
      }
      return false;
    }
  },

  buy(i) {
    const offer = get().state?.shop[i];
    if (get().act({ t: 'buy', i })) sound.click();
    else if (offer) sound.hit(false);
  },

  toggleLock(i) {
    const offer = get().state?.shop[i];
    if (!offer) return;
    if (get().act({ t: offer.locked ? 'unlock' : 'lock', i })) sound.click();
  },

  reroll() {
    if (get().act({ t: 'reroll' })) {
      sound.burn();
      for (let i = 0; i < 5; i++) sound.shink(180 + i * 60);
    }
  },

  next() {
    if (get().act({ t: 'next' })) {
      for (let i = 0; i < 5; i++) sound.shink(i * 60);
    }
  },

  rename(name) {
    get().act({ t: 'rename', name });
  },

  applyChaos(kind) {
    const { state } = get();
    if (!state) return;
    if (kind === 'vaal') {
      if (get().act({ t: 'vaal' }, { silent: true })) sound.vaal();
    } else if (kind === 'mirror') {
      if (get().act({ t: 'mirror' }, { silent: true })) sound.shink();
    } else {
      const candidates = state.shop.map((o, i) => ({ o, i })).filter(({ o }) => !o.sold);
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)].i;
      if (get().act({ t: 'rerollSlot', i: pick }, { silent: true })) sound.burn();
    }
  },

  applyBias(tag) {
    get().act({ t: 'bias', tag }, { silent: true });
  },

  suggestedName() {
    const { seed, sheet } = get();
    return generateBuildName(seed, sheet ?? { skillTags: [] });
  },

  async seal() {
    const { state, seed, mode, sheet, roomCode, dailyKey } = get();
    if (!state || !sheet || get().submitting) return null;
    set({ submitting: true });
    try {
      let working = state;
      if (!working.done) {
        // Should not happen (UI seals only after round 8), but be safe.
        set({ submitting: false, toast: 'Finish the draft first' });
        return null;
      }
      if (!working.build.name) {
        working = applyAction(pool, working, { t: 'rename', name: get().suggestedName() });
        set({ state: working });
      }
      const finalSheet = computeSheet(pool, working.build, pool.pool.combos);
      const pkg = mode === 'challenge' && roomCode
        ? await challengeRoom(roomCode, seed, working.log, working.build.name, finalSheet)
        : await submitDraft(mode === 'daily' ? 'daily' : 'ladder', seed, working.log, working.build.name, finalSheet);
      if (mode === 'daily' && dailyKey) markDailyDone(dailyKey);
      sessionStorage.setItem(FIGHT_KEY, JSON.stringify(pkg));
      set({ fightPkg: pkg, submitting: false });
      return pkg;
    } catch (err) {
      set({ submitting: false, toast: err instanceof Error ? err.message : 'Submission failed' });
      window.setTimeout(() => get().clearToast(), 3200);
      return null;
    }
  },

  clearToast() { set({ toast: null }); },
  clearVaal() { set({ vaalReveal: null }); },
}));

export { pool, purchaseBlock };
export type { ComboFlag };
