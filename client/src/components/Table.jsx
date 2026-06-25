import { useMemo, useState, useEffect } from 'react';
import { socket } from '../socket.js';
import Hand from './Hand.jsx';
import Card from './Card.jsx';

const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_NAME = { hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades' };

function relativeSeat(mySeat, otherSeat) {
  const diff = (otherSeat - mySeat + 4) % 4;
  return ['bottom', 'right', 'top', 'left'][diff];
}

function teamOf(seat) {
  return seat % 2 === 0 ? 'A' : 'B';
}

export default function Table({ room, onLeave }) {
  const me = room.players.find((p) => p.id === socket.id) || null;
  const mySeat = me?.seat ?? 0;
  const myHand = room.myHand || [];
  const isMyTurn = me ? room.turnSeat === mySeat : false;
  const isTrumpCaller = me ? room.trumpCallerSeat === mySeat : false;
  const isHost = me ? room.hostId === me.id : false;

  const legalSet = useMemo(() => {
    if (!isMyTurn || room.phase !== 'playing') return null;
    if (!room.leadSuit) return new Set(myHand.map((c) => `${c.rank}_${c.suit}`));
    const followers = myHand.filter((c) => c.suit === room.leadSuit);
    const playable = followers.length > 0 ? followers : myHand;
    return new Set(playable.map((c) => `${c.rank}_${c.suit}`));
  }, [myHand, isMyTurn, room.leadSuit, room.phase]);

  const [thaapPing, setThaapPing] = useState(null);
  useEffect(() => {
    if (!room.thaapSignal) return;
    setThaapPing(room.thaapSignal);
    const t = setTimeout(() => setThaapPing(null), 2200);
    return () => clearTimeout(t);
  }, [room.thaapSignal?.ts]);

  const [hideLastTrick, setHideLastTrick] = useState(false);
  useEffect(() => {
    if (room.currentTrick.length > 0 || !room.lastTrick) {
      setHideLastTrick(false);
      return;
    }
    setHideLastTrick(false);
    const t = setTimeout(() => setHideLastTrick(true), 1400);
    return () => clearTimeout(t);
  }, [room.currentTrick.length, room.lastTrick?.winnerSeat, room.lastTrick?.trick?.length]);

  if (!me) return <div className="loading">Joining game…</div>;

  const playersByPos = {};
  for (const p of room.players) {
    playersByPos[relativeSeat(mySeat, p.seat)] = p;
  }

  function playCard(card) { socket.emit('game:play-card', { code: room.code, card }); }
  function callTrump(suit) { socket.emit('game:call-trump', { code: room.code, suit }); }
  function requestRedeal() { socket.emit('game:request-redeal', { code: room.code }); }
  function decideStop(stop) { socket.emit('game:decide-stop', { code: room.code, stop }); }
  function thaap() { socket.emit('game:thaap', { code: room.code }); }
  function nextHand() { socket.emit('game:next-hand', { code: room.code }); }

  const showingLast = room.currentTrick.length === 0 && room.lastTrick && !hideLastTrick;
  const displayedTrick = room.currentTrick.length > 0
    ? room.currentTrick
    : (showingLast ? room.lastTrick.trick : []);
  const trickWinnerSeat = showingLast ? room.lastTrick.winnerSeat : null;

  return (
    <div className="table-wrap">
      <header className="table-header">
        <button className="ghost small back" onClick={onLeave}>← Leave</button>
        <div className="header-mid">
          Room <strong>{room.code}</strong>
          {room.trump && (
            <span className={`trump-tag ${room.trump}`}>
              Trump: {SUIT_SYMBOL[room.trump]} {SUIT_NAME[room.trump]}
            </span>
          )}
        </div>
        <div className="scores">
          <span className="team-A-score">
            <strong>A</strong> {room.score.kots.A} kot
            <small> · streak {room.score.streak.A}</small>
          </span>
          <span className="team-B-score">
            <strong>B</strong> {room.score.kots.B} kot
            <small> · streak {room.score.streak.B}</small>
          </span>
        </div>
      </header>

      <div className="table">
        {['top', 'left', 'right'].map((pos) => {
          const p = playersByPos[pos];
          if (!p) return null;
          const handCount = room.handCounts?.[p.seat] ?? 0;
          return (
            <PlayerSpot
              key={pos}
              pos={pos}
              player={p}
              handCount={handCount}
              isTurn={room.turnSeat === p.seat}
              isCaller={room.trumpCallerSeat === p.seat}
              isDealer={room.dealerSeat === p.seat}
              thaapActive={thaapPing?.seat === p.seat}
            />
          );
        })}

        <div className="trick-area">
          {displayedTrick.map(({ seat, card }) => {
            const pos = relativeSeat(mySeat, seat);
            return (
              <div
                key={seat}
                className={`played-card played-${pos} ${trickWinnerSeat === seat ? 'winner' : ''}`}
              >
                <Card card={card} />
                {trickWinnerSeat === seat && <div className="winner-badge">WIN</div>}
              </div>
            );
          })}
          {room.phase === 'trump-call' && (
            <div className="trump-call-banner">
              {isTrumpCaller ? (
                <>You're the trump caller — pick a suit below.</>
              ) : (
                <>
                  {room.players.find((p) => p.seat === room.trumpCallerSeat)?.name} is
                  choosing trump…
                </>
              )}
            </div>
          )}
          {room.phase === 'awaiting-stop' && room.canStopDecision !== mySeat && (
            <div className="stop-banner">
              {room.players.find((p) => p.seat === room.canStopDecision)?.name} is
              deciding: stop for kot, or go for baunie?
            </div>
          )}
        </div>
      </div>

      <div className="bottom-bar">
        <div className="my-info">
          <div>
            <strong>{me.name}</strong>
            <span className={`team-pill team-${teamOf(mySeat)}`}>Team {teamOf(mySeat)}</span>
            <span className="trick-count">
              Tricks A {room.tricksWon.A} – B {room.tricksWon.B}
            </span>
            {isMyTurn && room.phase === 'playing' && (
              <span className="your-turn">YOUR TURN</span>
            )}
          </div>
          <div className="bottom-actions">
            {room.options.thaapEnabled && room.phase === 'playing' && (
              <button className="thaap-btn" onClick={thaap} title="Signal partner to repeat lead suit">
                Thaap
              </button>
            )}
          </div>
        </div>
        <Hand
          cards={myHand}
          onPlay={isMyTurn && room.phase === 'playing' ? playCard : undefined}
          legalSet={legalSet}
          disabled={!isMyTurn || room.phase !== 'playing'}
        />
        {room.phase === 'trump-call' && !isTrumpCaller && myHand.length === 0 && (
          <div className="hidden-hand-note">
            Your cards stay hidden until the trump is called.
          </div>
        )}
      </div>

      {/* Trump call modal */}
      {room.phase === 'trump-call' && isTrumpCaller && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Call trump</h2>
            <p className="hint">Your first 5 cards:</p>
            <div className="modal-hand">
              {myHand.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
            <p className="hint center">Pick the suit that gives you the best chance.</p>
            <div className="trump-buttons">
              {['hearts', 'diamonds', 'clubs', 'spades'].map((s) => (
                <button
                  key={s}
                  className={`trump-btn trump-${s}`}
                  onClick={() => callTrump(s)}
                >
                  <span className="big-suit">{SUIT_SYMBOL[s]}</span>
                  {SUIT_NAME[s]}
                </button>
              ))}
            </div>
            {room.canRedeal && (
              <button className="ghost wide" onClick={requestRedeal}>
                Request re-deal — no court cards ({2 - room.redealCount} re-deal
                {2 - room.redealCount === 1 ? '' : 's'} left)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stop-or-continue modal */}
      {room.phase === 'awaiting-stop' && room.canStopDecision === mySeat && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Take the kot?</h2>
            <p>
              Your team won the first 7 tricks. <strong>Stop now</strong> to claim a
              kot, or <strong>play on</strong> — win <em>all</em> remaining tricks for
              a baunie (52 kots!), but if you drop a single trick it counts as only a
              simple win.
            </p>
            <div className="modal-actions">
              <button className="primary" onClick={() => decideStop(true)}>
                Stop · take kot
              </button>
              <button onClick={() => decideStop(false)}>Continue · go for baunie</button>
            </div>
          </div>
        </div>
      )}

      {/* Hand-end modal */}
      {room.phase === 'hand-end' && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>
              Team {room.lastWinnerTeam} wins
              {room.lastWinnerType === 'baunie' && ' — BAUNIE! 🏆'}
              {room.lastWinnerType === 'kot' && ' — KOT!'}
              {room.lastWinnerType === 'win' && ''}
            </h2>
            <p>
              Tricks: A {room.tricksWon.A} – B {room.tricksWon.B}
            </p>
            <p className="hint">
              Score: Team A — {room.score.kots.A} kot · streak {room.score.streak.A} ·
              Team B — {room.score.kots.B} kot · streak {room.score.streak.B}
            </p>
            {room.handHistory.length > 0 && (
              <details className="history">
                <summary>Hand history ({room.handHistory.length})</summary>
                <ol>
                  {room.handHistory.map((h, i) => (
                    <li key={i}>
                      Team {h.winnerTeam} ({h.type}) · {h.tricksA}–{h.tricksB} · trump
                      {' '}
                      {SUIT_SYMBOL[h.trump]}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {isHost ? (
              <button className="primary wide" onClick={nextHand}>
                Deal next hand
              </button>
            ) : (
              <p className="hint center">Waiting for host to deal next hand…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSpot({ pos, player, handCount, isTurn, isCaller, isDealer, thaapActive }) {
  return (
    <div className={`player-spot ${pos} ${isTurn ? 'active' : ''}`}>
      <div className="player-info">
        <strong>
          {player.name}
          {player.isBot && ' 🤖'}
        </strong>
        <div className="player-tags">
          <span className={`team team-${teamOf(player.seat)}`}>
            {teamOf(player.seat)}
          </span>
          {isCaller && <span className="tag caller">Caller</span>}
          {isDealer && <span className="tag dealer">Dealer</span>}
          {!player.connected && <span className="tag offline">Offline</span>}
        </div>
      </div>
      <div className={`mini-hand mini-${pos}`}>
        {Array.from({ length: handCount }).map((_, i) => (
          <Card key={i} facedown size="mini" />
        ))}
      </div>
      {thaapActive && <div className="thaap-ping">THAAP! ↺ Repeat lead</div>}
    </div>
  );
}
