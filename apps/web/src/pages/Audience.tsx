import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchRoom, roomSocketUrl } from '../lib/api';

const VOTE_TAGS = ['fire', 'cold', 'lightning', 'physical', 'chaos', 'minion', 'crit', 'speed'];
const CHAOS = [
  { kind: 'vaal', label: 'Vaal It', desc: 'Corrupt a random drafted item. 25% brick · 25% upgrade' },
  { kind: 'mirror', label: 'Mirror of Delusion', desc: 'Duplicate a random shop offer' },
  { kind: 'rerollSlot', label: "Cartographer's Sextant", desc: 'Reroll one shop slot' },
] as const;

interface HostState {
  round: number; budget: number; name: string;
  shop: { name: string; category: string; price: number; sold: boolean; locked: boolean }[];
  sheet: { dps: number; ehp: number; skill: string; asc?: string } | null;
}

export function AudiencePage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<HostState | null>(null);
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [champion, setChampion] = useState<{ name: string; playerName: string } | null>(null);
  const [lineage, setLineage] = useState<{ name: string; playerName: string; defeated: number }[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    void fetchRoom(code).then((r) => {
      if (r) { setChampion(r.champion); setLineage(r.lineage); }
    });
    const socket = new WebSocket(roomSocketUrl(code, 'viewer'));
    ws.current = socket;
    socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state') setState(msg.payload);
      else if (msg.type === 'votes') setTallies(msg.tallies);
      else if (msg.type === 'chaosFired') {
        setNote(`Chaos unleashed: ${msg.kind}`);
        window.setTimeout(() => setNote(null), 2500);
      } else if (msg.type === 'chaosDenied') {
        setNote('The orbs need time to recharge.');
        window.setTimeout(() => setNote(null), 2500);
      }
    };
    return () => socket.close();
  }, [code]);

  const vote = (tag: string) => {
    setMyVote(tag);
    ws.current?.send(JSON.stringify({ type: 'vote', tag }));
  };
  const chaos = (kind: string) => {
    ws.current?.send(JSON.stringify({ type: 'chaos', kind }));
  };

  return (
    <main className="room-page">
      <div className="smallcaps" style={{ color: 'var(--text-faint)' }}>Room</div>
      <h1 className="room-code" style={{ fontSize: '2.2rem' }}>{code}</h1>

      {state ? (
        <section style={{ marginTop: '1rem' }} aria-live="polite">
          <p style={{ color: 'var(--text-dim)' }}>
            Round {state.round} · {state.budget} orbs
            {state.sheet ? ` · ${state.sheet.skill}${state.sheet.asc ? ` ${state.sheet.asc}` : ''} · ${state.sheet.dps.toLocaleString('en-US')} DPS` : ''}
          </p>
          <ul style={{ listStyle: 'none', marginTop: '0.6rem', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            {state.shop.map((o, i) => (
              <li key={i} style={{ padding: '0.15rem 0', opacity: o.sold ? 0.4 : 1 }}>
                {o.locked ? '🔒 ' : ''}{o.name} <span style={{ color: 'var(--gold)' }}>({o.price})</span>{o.sold ? ' — drafted' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p style={{ color: 'var(--text-dim)', marginTop: '1rem' }}>Waiting for the streamer's draft…</p>
      )}

      <div className="rule smallcaps" style={{ marginTop: '2rem' }}>Vote the next shop</div>
      <div className="vote-grid" role="group" aria-label="Vote which category the next shop emphasises">
        {VOTE_TAGS.map((tag) => (
          <button
            key={tag}
            className={`vote-btn${myVote === tag ? ' chosen' : ''}`}
            onClick={() => vote(tag)}
            aria-pressed={myVote === tag}
          >
            {tag}
            <span className="tally">{tallies[tag] ?? 0} votes</span>
          </button>
        ))}
      </div>

      <div className="rule smallcaps" style={{ marginTop: '2rem' }}>Chaos</div>
      <div className="chaos-row">
        {CHAOS.map((c) => (
          <button key={c.kind} className="chaos-btn" onClick={() => chaos(c.kind)} title={c.desc}>
            {c.label}
          </button>
        ))}
      </div>
      {note && <p style={{ color: 'var(--gold)', marginTop: '0.8rem' }} role="status">{note}</p>}

      <div className="rule smallcaps" style={{ marginTop: '2.4rem' }}>The Champion</div>
      {champion ? (
        <p style={{ marginTop: '0.6rem' }}>
          <span style={{ color: 'var(--unique)', fontFamily: 'var(--serif)' }}>{champion.name}</span>
          <span style={{ color: 'var(--text-dim)' }}> — held by {champion.playerName}</span>
        </p>
      ) : (
        <p style={{ color: 'var(--text-dim)', marginTop: '0.6rem' }}>The throne is empty.</p>
      )}
      <ul className="lineage">
        {lineage.map((l, i) => (
          <li key={i}>
            <span>{i === 0 ? <span className="crown">♛ </span> : ''}{l.name} <span style={{ color: 'var(--text-faint)' }}>({l.playerName})</span></span>
            <span style={{ color: 'var(--text-faint)' }}>{l.defeated} defended</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '1.6rem' }}>
        <Link className="btn primary" to={`/challenge/${code}`}>Draft a challenger</Link>
      </div>
    </main>
  );
}
