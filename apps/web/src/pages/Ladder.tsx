import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchDaily, fetchDailyLeaderboard, fetchLadder } from '../lib/api';

interface Row {
  rank: number; name: string; playerName: string;
  elo?: number; wins: number; losses: number;
  skill?: string; ascendancy?: string; dps: number; ehp: number;
}

export function LadderPage() {
  const daily = useLocation().pathname.includes('daily');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [dailyKey, setDailyKey] = useState('');

  useEffect(() => {
    (daily ? fetchDailyLeaderboard() : fetchLadder()).then((r) => setRows(r as Row[]));
    if (daily) void fetchDaily().then((d) => setDailyKey(d.key));
  }, [daily]);

  return (
    <main className="ladder-page">
      <h1 className="display">{daily ? `The Daily — ${dailyKey}` : 'The Standings'}</h1>
      {rows === null ? (
        <p style={{ color: 'var(--text-dim)' }}>Consulting the ledger…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>
          Nothing recorded yet{daily ? ' today' : ''}. The ledger opens when the server is running —
          or be the first name in it.
        </p>
      ) : (
        <table className="ladder">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Build</th>
              <th scope="col">Exile</th>
              {!daily && <th scope="col">Rating</th>}
              <th scope="col">W–L</th>
              <th scope="col">DPS</th>
              <th scope="col">EHP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank}>
                <td className="num">{r.rank}</td>
                <td className="build">{r.name}{r.skill ? <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--sans)', fontSize: '0.75rem' }}> · {r.skill}{r.ascendancy ? ` ${r.ascendancy}` : ''}</span> : null}</td>
                <td>{r.playerName}</td>
                {!daily && <td className="num">{r.elo}</td>}
                <td className="num">{r.wins}–{r.losses}</td>
                <td className="num">{r.dps.toLocaleString('en-US')}</td>
                <td className="num">{r.ehp.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
