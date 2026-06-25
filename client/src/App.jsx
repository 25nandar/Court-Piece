import { useEffect, useState } from 'react';
import { socket } from './socket.js';
import Lobby from './components/Lobby.jsx';
import Table from './components/Table.jsx';

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('cp_name') || '');
  const [view, setView] = useState('home');
  const [roomState, setRoomState] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function onState(s) {
      setRoomState(s);
      if (s.phase === 'lobby') setView('lobby');
      else setView('game');
    }
    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  function saveName(n) {
    setName(n);
    localStorage.setItem('cp_name', n);
  }

  function createRoom() {
    if (!name.trim()) return setError('Enter a nickname first');
    setError(null);
    socket.emit('lobby:create', { name: name.trim() }, (res) => {
      if (!res?.ok) return setError(res?.error || 'Failed to create room');
    });
  }

  function joinRoom() {
    if (!name.trim()) return setError('Enter a nickname first');
    if (!joinCode.trim()) return setError('Enter a room code');
    setError(null);
    socket.emit(
      'lobby:join',
      { name: name.trim(), code: joinCode.trim() },
      (res) => {
        if (!res?.ok) return setError(res?.error || 'Failed to join');
      },
    );
  }

  function leaveBack() {
    window.location.reload();
  }

  if (view === 'home') {
    return (
      <div className="home">
        <div className="home-card">
          <h1>Court Piece</h1>
          <p className="tagline">Single Sar · Rang · Hokm</p>
          {!connected && <div className="warn">Connecting to server…</div>}
          <label>
            Nickname
            <input
              type="text"
              value={name}
              onChange={(e) => saveName(e.target.value)}
              placeholder="e.g. Rajas"
              maxLength={20}
              autoFocus
            />
          </label>
          <div className="home-actions">
            <button className="primary" onClick={createRoom} disabled={!connected}>
              Create room
            </button>
            <div className="or"><span>or</span></div>
            <div className="join-block">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={6}
              />
              <button onClick={joinRoom} disabled={!connected}>Join</button>
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <details className="rules">
            <summary>How to play</summary>
            <ul>
              <li>4 players in fixed partnerships (seats across each other).</li>
              <li>Trump-caller (player after dealer) gets first 5 cards, picks the trump suit.</li>
              <li>Remaining 8 cards dealt to everyone. Trump-caller leads trick 1.</li>
              <li>Follow suit if you can; otherwise play any card (including a trump = <em>kaat</em>).</li>
              <li>Highest trump wins, else highest card of suit led.</li>
              <li>The hand ends the moment a team reaches 7 tricks. Winning all 7 while the opponents stay on 0 (a 7-0 sweep) = a <strong>kot</strong>.</li>
              <li>7 consecutive simple wins also count as 1 kot.</li>
            </ul>
          </details>
        </div>
      </div>
    );
  }

  if (!roomState) return <div className="loading">Connecting…</div>;

  if (view === 'lobby' || roomState.phase === 'lobby') {
    return <Lobby room={roomState} onLeave={leaveBack} />;
  }
  return <Table room={roomState} onLeave={leaveBack} />;
}
