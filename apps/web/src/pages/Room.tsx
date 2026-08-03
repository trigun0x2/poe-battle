import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../lib/api';

/** Streamer lobby: mint a room, hand out the links, start drafting. */
export function RoomPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const mint = async () => {
    try {
      setCode(await createRoom());
      setErr(null);
    } catch {
      setErr('The server is unreachable — stream rooms need it running.');
    }
  };

  const origin = window.location.origin;

  return (
    <main className="room-page">
      <h1 className="display" style={{ fontSize: '2.2rem' }}>Stream Mode</h1>
      <p style={{ color: 'var(--text-dim)', marginTop: '0.6rem', maxWidth: '54ch' }}>
        Create a room, put the join code on screen, and draft while your audience
        votes the shops, corrupts your gear, and — when you're done — challenges
        the build that beat them all. The champion holds the room until someone
        takes it from them.
      </p>

      {!code ? (
        <div style={{ marginTop: '1.6rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn primary" onClick={mint}>Create a room</button>
          <span style={{ color: 'var(--text-faint)' }}>or join one:</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={5}
            aria-label="Room code"
            style={{ background: 'var(--ground-2)', border: '1px solid var(--line)', color: 'var(--text)', padding: '0.6rem 0.9rem', width: '7ch', letterSpacing: '0.3em', textAlign: 'center' }}
          />
          <button className="btn" disabled={joinCode.length < 5} onClick={() => navigate(`/r/${joinCode}`)}>Join as audience</button>
          {err && <p style={{ color: 'var(--crimson-bright)', width: '100%' }}>{err}</p>}
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <div className="smallcaps" style={{ color: 'var(--text-faint)' }}>Room code</div>
          <div className="room-code">{code}</div>
          <ul style={{ listStyle: 'none', marginTop: '1.4rem', color: 'var(--text-dim)', fontSize: '0.9rem', display: 'grid', gap: '0.5rem' }}>
            <li>Audience page — <code style={{ color: 'var(--gold)' }}>{origin}/r/{code}</code></li>
            <li>OBS overlay (transparent) — <code style={{ color: 'var(--gold)' }}>{origin}/overlay/{code}</code></li>
          </ul>
          <div style={{ marginTop: '1.8rem', display: 'flex', gap: '0.9rem' }}>
            <button className="btn primary" onClick={() => navigate(`/host/${code}`)}>Start drafting live</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText(`${origin}/r/${code}`)}>Copy audience link</button>
          </div>
        </div>
      )}
    </main>
  );
}
