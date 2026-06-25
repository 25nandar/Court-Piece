import { useState } from 'react';
import { socket } from '../socket.js';

const SEAT_LABELS = ['South', 'West', 'North', 'East'];
const TEAM_LABELS = ['Team A', 'Team B', 'Team A', 'Team B'];

export default function Lobby({ room, onLeave }) {
  const isHost = room.hostId === socket.id;
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  function addBot() {
    socket.emit('lobby:add-bot', { code: room.code }, (res) => {
      if (!res?.ok) setError(res?.error || 'Failed');
    });
  }

  function startGame() {
    socket.emit('lobby:start', { code: room.code }, (res) => {
      if (!res?.ok) setError(res?.error || 'Failed');
    });
  }

  function copy() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function toggleOption(key) {
    socket.emit('lobby:set-options', {
      code: room.code,
      options: { [key]: !room.options[key] },
    });
  }

  function kick(id) {
    socket.emit('lobby:kick', { code: room.code, playerId: id });
  }

  const seats = [0, 1, 2, 3].map(
    (seat) => room.players.find((p) => p.seat === seat) || null,
  );

  return (
    <div className="lobby">
      <div className="lobby-card">
        <button className="ghost back" onClick={onLeave}>← Leave</button>
        <h1>
          Room <span className="code" onClick={copy} title="Click to copy">{room.code}</span>
        </h1>
        {copied && <div className="copy-hint">Copied to clipboard!</div>}
        <p className="hint">Share this code so friends can join. Fill empty seats with bots.</p>

        <div className="seats">
          {seats.map((p, i) => (
            <div key={i} className={`seat-row ${p ? 'filled' : 'empty'} team-${i % 2 === 0 ? 'A' : 'B'}`}>
              <span className="seat-label">
                {SEAT_LABELS[i]} <small>· {TEAM_LABELS[i]}</small>
              </span>
              <span className="seat-player">
                {p ? (
                  <>
                    {p.name}
                    {p.isBot && <span className="bot-tag">BOT</span>}
                    {p.id === room.hostId && <span className="host-tag">HOST</span>}
                    {p.id === socket.id && <span className="you-tag">YOU</span>}
                  </>
                ) : (
                  <span className="empty-text">(empty)</span>
                )}
              </span>
              {isHost && p && p.id !== room.hostId && (
                <button className="ghost small" onClick={() => kick(p.id)}>Remove</button>
              )}
            </div>
          ))}
        </div>

        <div className="teams-hint">
          <strong>Team A</strong> (South + North) vs <strong>Team B</strong> (East + West)
        </div>

        {isHost ? (
          <>
            <div className="lobby-actions">
              <button onClick={addBot} disabled={room.players.length >= 4}>
                + Add bot
              </button>
              <button
                className="primary"
                onClick={startGame}
                disabled={room.players.length !== 4}
              >
                Start game ({room.players.length}/4)
              </button>
            </div>

            <fieldset className="options">
              <legend>Rule options</legend>
              <label>
                <input
                  type="checkbox"
                  checked={!!room.options.redealIfNoCourtCardFirst5}
                  onChange={() => toggleOption('redealIfNoCourtCardFirst5')}
                />
                Re-deal if trump-caller has no court card in first 5 (max twice)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!room.options.thaapEnabled}
                  onChange={() => toggleOption('thaapEnabled')}
                />
                Enable Thaap (table-tap signal to partner)
              </label>
            </fieldset>
          </>
        ) : (
          <div className="hint center">Waiting for host to start the game…</div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
