import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ASCENDANCY_ROUND, MAX_LOCKS, ROUNDS, purchaseBlock, rerollCost,
} from '@exile/sim';
import { DraftMode, useDraft } from '../store';
import { ItemCard } from '../components/ItemCard';
import { OrbBudget } from '../components/OrbBudget';
import { BuildDoll } from '../components/BuildDoll';
import { burnRects } from '../lib/fx';
import { fetchDaily, roomSocketUrl } from '../lib/api';
import { dailyDone } from '../lib/persist';
import * as sound from '../lib/sound';

export function DraftPage({ mode: modeProp }: { mode: DraftMode }) {
  const params = useParams<{ code?: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const store = useDraft();
  const { state, sheet, shopEpoch, submitting } = store;
  const shopRef = useRef<HTMLDivElement>(null);
  const hostWs = useRef<WebSocket | null>(null);
  const [sealOpen, setSealOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [viewers, setViewers] = useState(0);
  const [voteNote, setVoteNote] = useState<string | null>(null);
  const [dailyBlocked, setDailyBlocked] = useState(false);
  const isHost = !!params.code && modeProp !== 'challenge' && search.get('role') !== 'challenger';
  const roomCode = params.code;

  // ── begin a draft on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (modeProp === 'daily') {
        const daily = await fetchDaily();
        if (cancelled) return;
        if (dailyDone(daily.key)) { setDailyBlocked(true); return; }
        store.begin('daily', daily.seed, { dailyKey: daily.key });
      } else if (modeProp === 'challenge' && roomCode) {
        store.begin('challenge', `challenge:${roomCode}:${crypto.randomUUID()}`, { roomCode });
      } else {
        store.begin('ladder', `ladder:${crypto.randomUUID()}`, isHost && roomCode ? { roomCode } : undefined);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeProp, roomCode]);

  // ── stream-room host wiring ───────────────────────────────────────────
  useEffect(() => {
    if (!isHost || !roomCode) return;
    const ws = new WebSocket(roomSocketUrl(roomCode, 'host'));
    hostWs.current = ws;
    ws.onopen = () => broadcastState();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'chaos') {
        useDraft.getState().applyChaos(msg.kind);
      } else if (msg.type === 'voteResult' && msg.tag) {
        useDraft.getState().applyBias(msg.tag);
        setVoteNote(`Chat chose: ${msg.tag} — next shop leans in`);
        window.setTimeout(() => setVoteNote(null), 3500);
      } else if (msg.type === 'viewers') {
        setViewers(msg.count);
      }
    };
    return () => { ws.close(); hostWs.current = null; };
  }, [isHost, roomCode]);

  // Broadcast a compact summary to the room whenever the draft changes.
  const broadcastState = () => {
    const { state: s, sheet: sh } = useDraft.getState();
    const ws = hostWs.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !s) return;
    ws.send(JSON.stringify({
      type: 'state',
      payload: {
        round: s.round,
        budget: s.budget,
        name: s.build.name,
        shop: s.shop.map((o) => ({
          name: o.entity.name, category: o.entity.category, price: o.price,
          sold: o.sold, locked: o.locked,
        })),
        sheet: sh ? { dps: sh.dps, ehp: sh.ehp, skill: sh.skillName, asc: sh.ascendancyName } : null,
      },
    }));
  };
  useEffect(() => {
    if (isHost) broadcastState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state, sheet]);

  const locksUsed = state?.shop.filter((o) => o.locked).length ?? 0;
  const isAscRound = state?.round === ASCENDANCY_ROUND && !state.build.ascendancy;
  const rrCost = state ? rerollCost(state.round, state.rerollsThisRound) : 0;

  const roundSub = useMemo(() => {
    if (!state) return '';
    if (isAscRound) return 'The trial is complete. Choose your ascendancy — this one is free.';
    if (state.round <= 2) return 'Leveling gear and honest gems. Everyone starts on the beach.';
    if (state.round <= 4) return 'The campaign stretch. Commit to an archetype, or keep your options open.';
    if (state.round <= 6) return 'Maps. The pool deepens and the prices climb.';
    return 'The chase. If a Mageblood is coming, it is coming now.';
  }, [state, isAscRound]);

  if (dailyBlocked) {
    return (
      <main className="home">
        <h1 className="display" style={{ fontSize: '2.4rem' }}>One attempt per day.</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: '1rem', maxWidth: '44ch' }}>
          You have already drafted today's seed. The next seed arrives at UTC midnight —
          come back and see whether the shops love you tomorrow.
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.9rem' }}>
          <button className="btn" onClick={() => navigate('/daily/leaderboard')}>Today's ladder</button>
          <button className="btn primary" onClick={() => navigate('/draft')}>Draft the ladder instead</button>
        </div>
      </main>
    );
  }

  if (!state) return <main className="stage"><p style={{ color: 'var(--text-dim)' }}>Shuffling the shops…</p></main>;

  const doReroll = () => {
    const rects = shopRef.current
      ? [...shopRef.current.querySelectorAll('.card')].map((el) => el.getBoundingClientRect())
      : [];
    const before = state.budget;
    store.reroll();
    if (useDraft.getState().state?.budget !== before) burnRects(rects);
  };

  const advance = () => {
    if (state.round >= ROUNDS) {
      setNameDraft(store.suggestedName());
      setSealOpen(true);
    } else {
      store.next();
    }
  };

  const seal = async () => {
    store.rename(nameDraft || store.suggestedName());
    store.act({ t: 'next' }, { silent: true }); // round 8 → done
    const pkg = await useDraft.getState().seal();
    if (pkg) {
      setSealOpen(false);
      sound.toll();
      navigate('/fight');
    }
  };

  return (
    <main className="stage">
      <div className="stage-head">
        <div>
          <h1 className="round-title">
            {isAscRound ? 'The Ascendancy' : <>Round <span className="n">{state.round}</span> <span style={{ color: 'var(--text-faint)' }}>/ {ROUNDS}</span></>}
          </h1>
          <p className="round-sub">{roundSub}</p>
          {isHost && (
            <p className="round-sub" style={{ color: 'var(--gold)' }}>
              Room {roomCode} · {viewers} watching{voteNote ? ` · ${voteNote}` : ''}
            </p>
          )}
        </div>
        <OrbBudget budget={state.budget} />
      </div>

      <BuildDoll build={state.build} sheet={sheet} name={state.build.name} />

      <section aria-label="The shop">
        <div className="shop" ref={shopRef} key={shopEpoch}>
          {state.shop.map((offer, i) => (
            <ItemCard
              key={`${shopEpoch}-${i}-${offer.entity.id}`}
              offer={offer}
              index={i}
              dealIndex={i}
              blockReason={purchaseBlock(state, offer)}
              canLock={state.round < ROUNDS && (offer.locked || locksUsed < MAX_LOCKS)}
              onBuy={() => store.buy(i)}
              onToggleLock={() => store.toggleLock(i)}
            />
          ))}
        </div>
        <div className="shop-actions">
          <button
            className="btn danger"
            onClick={doReroll}
            disabled={state.budget < rrCost}
            aria-label={`Reroll the shop for ${rrCost} chaos orbs`}
          >
            Reroll <span className="cost">— {rrCost}</span>
          </button>
          <button className="btn primary" onClick={advance} disabled={submitting}>
            {state.round >= ROUNDS ? 'Seal the Build' : 'Next Round'}
          </button>
          <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
            {locksUsed}/{MAX_LOCKS} locks · locked offers follow you to the next round
          </span>
        </div>
      </section>

      {sealOpen && (
        <div className="vaal-reveal" role="dialog" aria-label="Name your build">
          <div className="inner">
            <div className="smallcaps" style={{ color: 'var(--text-faint)' }}>The build is drafted</div>
            <h2 className="display" style={{ fontSize: '1.9rem', margin: '0.5rem 0 1rem' }}>Name it, and seal it.</h2>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={48}
              aria-label="Build name"
              style={{
                background: 'var(--ground-2)', border: '1px solid var(--line)',
                color: 'var(--text)', padding: '0.7rem 1rem', width: '100%',
                fontFamily: 'var(--serif)', fontSize: '1.05rem', textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', marginTop: '1.3rem' }}>
              <button className="btn" onClick={() => setNameDraft(store.suggestedName())}>Roll another name</button>
              <button className="btn primary" onClick={seal} disabled={submitting}>
                {submitting ? 'Sealing…' : 'Seal & Fight'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
