import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FightEvent } from '@exile/sim';
import { loadLastFight, pool, useDraft } from '../store';
import * as sound from '../lib/sound';

/** Damage numbers count up — typography is the combat visualization. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const dur = 320;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="dmg">{shown.toLocaleString('en-US')}</span>;
}

function LogLine({ ev, mine }: { ev: FightEvent; mine: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const cls = ['log-line', ev.kind, mine ? 'mine' : '', shown ? 'shown' : ''].filter(Boolean).join(' ');
  if (ev.kind === 'kill') {
    return <div className={`kill-line ${shown ? 'shown' : ''}`} role="text">{ev.text.replace(/^Turn \d+: /, '')}</div>;
  }
  // Split the text around the damage number so it can count up.
  const numText = ev.damage?.toLocaleString('en-US');
  const parts = numText ? ev.text.split(numText) : [ev.text];
  return (
    <p className={cls}>
      {parts[0]}
      {numText && ev.damage !== undefined && <CountUp value={ev.damage} />}
      {parts[1] ?? ''}
    </p>
  );
}

export function FightPage() {
  const navigate = useNavigate();
  const stored = useDraft((s) => s.fightPkg);
  const draftState = useDraft((s) => s.state);
  const mode = useDraft((s) => s.mode);
  const pkg = useMemo(() => stored ?? loadLastFight(), [stored]);
  const [cursor, setCursor] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  const events = pkg?.result.events ?? [];

  useEffect(() => {
    if (!pkg) return;
    if (cursor >= events.length) { setDone(true); return; }
    const ev = events[cursor];
    if (ev.kind === 'hit' || ev.kind === 'crit') sound.hit(ev.kind === 'crit');
    if (ev.kind === 'kill') sound.toll();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pace = reduced ? 30 : Math.min(760, Math.max(320, 20000 / events.length));
    timer.current = window.setTimeout(() => setCursor((c) => c + 1), ev.kind === 'kill' ? 1200 : pace);
    return () => window.clearTimeout(timer.current);
  }, [cursor, pkg, events]);

  if (!pkg) {
    return (
      <main className="fight">
        <div className="vs"><h1 className="names display">No fight to replay.</h1></div>
        <div className="verdict-row">
          <div className="actions"><Link className="btn primary" to="/draft">Draft a build</Link></div>
        </div>
      </main>
    );
  }

  const visible = events.slice(0, cursor);
  const last = visible.at(-1);
  const won = pkg.result.winner === 0;
  const hp = last?.hpAfter ?? [1, 1];

  // Wordle-style spoiler-free share for the daily: tier emoji per round.
  const shareText = (() => {
    if (mode !== 'daily' || !draftState) return null;
    // Spoiler-free, Wordle-share style: one tier emoji per drafted pick.
    const tierEmoji = ['▫️', '🟩', '🟦', '🟪', '🟧'];
    const picks = [
      draftState.build.skill, ...draftState.build.supports,
      draftState.build.ascendancy, ...draftState.build.keystones,
      ...Object.values(draftState.build.gear),
    ].filter((x): x is string => !!x);
    const row = picks
      .map((id) => tierEmoji[(pool.byId.get(id)?.tier ?? 1) - 1])
      .join('');
    return [
      `Exile Draft — daily ${new Date().toISOString().slice(0, 10)}`,
      row || '➖',
      `${won ? '⚔️ victory' : '💀 defeat'} in ${pkg.result.turns} turns · ${draftState.budget} orbs unspent`,
      'one seed · one attempt',
    ].join('\n');
  })();

  return (
    <main className="fight">
      <div className="vs">
        <h1 className="names display">
          <span className="fighter-a">{pkg.you.name}</span>
          <span className="amp">against</span>
          <span className="fighter-b">{pkg.opponent.name}</span>
        </h1>
        <p className="sub">
          {pkg.exhibition ? 'Exhibition — the ladder was unreachable, so the Machine stepped in. · ' : ''}
          {pkg.you.sheet.skillName}{pkg.you.sheet.ascendancyName ? ` ${pkg.you.sheet.ascendancyName}` : ''} vs {pkg.opponent.sheet.skillName}{pkg.opponent.sheet.ascendancyName ? ` ${pkg.opponent.sheet.ascendancyName}` : ''}
        </p>
      </div>

      <div className="hp-whisper" aria-hidden="true">
        <span>{pkg.you.name} <span className="pct">{Math.round(hp[0] * 100)}%</span></span>
        <span><span className="pct">{Math.round(hp[1] * 100)}%</span> {pkg.opponent.name}</span>
      </div>

      <div className="fight-log" aria-live="polite">
        {visible.map((ev, i) => (
          <LogLine key={i} ev={ev} mine={ev.attacker === 0} />
        ))}
      </div>

      {!done && cursor < events.length && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button className="btn" onClick={() => { window.clearTimeout(timer.current); setCursor(events.length); }}>
            Skip to the end
          </button>
        </div>
      )}

      {done && (
        <div className="verdict-row">
          <div className={`outcome display ${won ? 'win' : 'loss'}`}>
            {won ? 'Victory.' : 'Defeat.'}
            {pkg.crowned ? ' You are the room champion.' : ''}
          </div>
          <p className="detail">
            {won
              ? `${pkg.you.name} walks out with ${pkg.result.winnerHpPct}% remaining.`
              : `${pkg.opponent.name} stands over you with ${pkg.result.winnerHpPct}% remaining.`}
            {typeof pkg.eloDelta === 'number' ? ` Rating ${pkg.eloDelta >= 0 ? '+' : ''}${pkg.eloDelta}.` : ''}
          </p>
          {shareText && (
            <div className="share-card">
              <div className="smallcaps" style={{ color: 'var(--text-faint)' }}>Share the day</div>
              <pre className="emoji-rows" style={{ fontFamily: 'var(--sans)', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{shareText}</pre>
              <button className="btn" onClick={() => navigator.clipboard.writeText(shareText)}>Copy result</button>
            </div>
          )}
          <div className="actions">
            <button className="btn primary" onClick={() => navigate(mode === 'daily' ? '/' : '/draft')}>
              {mode === 'daily' ? 'Back to the beach' : 'Draft again'}
            </button>
            <Link className="btn" to="/ladder">The standings</Link>
            <button className="btn" onClick={() => { setCursor(0); setDone(false); }}>Replay</button>
          </div>
        </div>
      )}
    </main>
  );
}
