import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { roomSocketUrl } from '../lib/api';

interface HostState {
  round: number; budget: number; name: string;
  shop: { name: string; category: string; price: number; sold: boolean; locked: boolean }[];
  sheet: { dps: number; ehp: number; skill: string; asc?: string } | null;
}

/** OBS browser-source view: transparent background, legible at 1080p. */
export function OverlayPage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<HostState | null>(null);

  useEffect(() => {
    document.body.style.background = 'transparent';
    let socket: WebSocket | null = null;
    let retry = 0;
    const connect = () => {
      socket = new WebSocket(roomSocketUrl(code, 'viewer'));
      socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') setState(msg.payload);
      };
      socket.onclose = () => {
        retry = Math.min(retry + 1, 5);
        window.setTimeout(connect, retry * 2000);
      };
    };
    connect();
    return () => { socket?.close(); document.body.style.background = ''; };
  }, [code]);

  if (!state) return <div className="overlay-root" />;

  return (
    <div className="overlay-root">
      <div className="panel">
        <h3>Round {state.round} · {state.budget} ⬤</h3>
        <ul>
          {state.shop.filter((o) => !o.sold).map((o, i) => (
            <li key={i} className="offer">
              <span className="nm">{o.locked ? '🔒 ' : ''}{o.name}</span>
              <span>{o.price}</span>
            </li>
          ))}
        </ul>
      </div>
      {state.sheet && (
        <div className="panel">
          <h3>{state.name || 'The build'}</h3>
          <ul>
            <li className="offer"><span>{state.sheet.skill}{state.sheet.asc ? ` · ${state.sheet.asc}` : ''}</span></li>
            <li className="offer"><span>DPS</span><span>{state.sheet.dps.toLocaleString('en-US')}</span></li>
            <li className="offer"><span>EHP</span><span>{state.sheet.ehp.toLocaleString('en-US')}</span></li>
          </ul>
        </div>
      )}
    </div>
  );
}
