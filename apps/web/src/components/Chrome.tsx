import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { isMuted, setMuted } from '../lib/sound';

export function Chrome() {
  const [muted, setM] = useState(isMuted());
  return (
    <header className="chrome">
      <Link to="/" className="wordmark">Exile <em>Draft</em></Link>
      <nav aria-label="Main">
        <NavLink to="/draft">Ladder</NavLink>
        <NavLink to="/daily">Daily</NavLink>
        <NavLink to="/ladder">Standings</NavLink>
        <button
          className="mute-btn"
          aria-pressed={muted}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          onClick={() => { setMuted(!muted); setM(!muted); }}
        >
          {muted ? 'sound off' : 'sound on'}
        </button>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      Exile Draft is a fan-made tribute and is <strong>not associated with,
      affiliated with, endorsed by, or supported by Grinding Gear Games</strong> in
      any way. Path of Exile is a trademark of Grinding Gear Games.
    </footer>
  );
}
