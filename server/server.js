import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import {
  createRoom,
  getRoom,
  joinRoom,
  addBot,
  removePlayer,
  getRoomByPlayer,
  setOptions,
} from './rooms.js';
import {
  createGame,
  startHand,
  callTrump,
  requestRedeal,
  playCard,
  decideStop,
  startNextHand,
  thaap,
  canRequestRedeal,
} from './game/game.js';
import { aiCallTrump, aiPlay, aiStopDecision } from './game/ai.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3001;

function publicRoomState(room, viewerId) {
  const base = {
    code: room.code,
    hostId: room.hostId,
    options: room.options,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      seat: p.seat,
      connected: p.connected,
    })),
  };
  if (!room.game) {
    return { ...base, phase: 'lobby' };
  }
  const g = room.game;
  const viewer = room.players.find((p) => p.id === viewerId);
  const viewerSeat = viewer ? viewer.seat : null;
  const isCaller = viewerSeat === g.trumpCallerSeat;
  // Hide hands during trump-call from non-callers
  const myHand =
    viewerSeat === null
      ? []
      : g.phase === 'trump-call' && !isCaller
      ? []
      : g.hands[viewerSeat];

  return {
    ...base,
    phase: g.phase,
    trumpCallerSeat: g.trumpCallerSeat,
    dealerSeat: g.dealerSeat,
    trump: g.trump,
    currentTrick: g.currentTrick,
    leadSuit: g.leadSuit,
    turnSeat: g.turnSeat,
    tricksWon: g.tricksWon,
    trickCount: g.trickCount,
    handOver: g.handOver,
    score: g.score,
    handHistory: g.handHistory,
    redealCount: g.redealCount,
    canStopDecision: g.canStopDecision,
    pendingOutcome: g.pendingOutcome,
    lastTrick: g.lastTrick,
    lastWinnerTeam: g.lastWinnerTeam,
    lastWinnerType: g.lastWinnerType,
    thaapSignal: g.thaapSignal,
    handCounts: g.hands.map((h) => h.length),
    myHand,
    mySeat: viewerSeat,
    canRedeal: isCaller && canRequestRedeal(g),
  };
}

function broadcastRoom(room) {
  for (const p of room.players) {
    if (p.isBot) continue;
    io.to(p.id).emit('room:state', publicRoomState(room, p.id));
  }
}

function maybeRunBotTurn(room) {
  if (!room.game) return;
  const g = room.game;

  if (g.phase === 'trump-call') {
    const caller = room.players.find((p) => p.seat === g.trumpCallerSeat);
    if (caller?.isBot) {
      setTimeout(() => {
        if (!room.game || room.game.phase !== 'trump-call') return;
        const suit = aiCallTrump(room.game.hands[room.game.trumpCallerSeat]);
        room.game = callTrump(room.game, suit);
        broadcastRoom(room);
        maybeRunBotTurn(room);
      }, 900);
    }
    return;
  }

  if (g.phase === 'playing') {
    const cur = room.players.find((p) => p.seat === g.turnSeat);
    if (cur?.isBot) {
      setTimeout(() => {
        if (!room.game || room.game.phase !== 'playing') return;
        const seat = room.game.turnSeat;
        const card = aiPlay(room.game, seat);
        const result = playCard(room.game, seat, card);
        if (result.error) {
          console.error('Bot play error:', result.error);
          return;
        }
        room.game = result.state;
        broadcastRoom(room);
        setTimeout(() => maybeRunBotTurn(room), 700);
      }, 900);
    }
    return;
  }

  if (g.phase === 'awaiting-stop') {
    const decider = room.players.find((p) => p.seat === g.canStopDecision);
    if (decider?.isBot) {
      setTimeout(() => {
        if (!room.game || room.game.phase !== 'awaiting-stop') return;
        const seat = room.game.canStopDecision;
        room.game = decideStop(room.game, seat, aiStopDecision());
        broadcastRoom(room);
        maybeRunBotTurn(room);
      }, 900);
    }
    return;
  }
}

io.on('connection', (socket) => {
  socket.on('lobby:create', ({ name }, ack) => {
    const room = createRoom({ hostId: socket.id, hostName: name?.trim() || 'Host' });
    socket.join(room.code);
    ack?.({ ok: true, code: room.code, mySeat: 0 });
    broadcastRoom(room);
  });

  socket.on('lobby:join', ({ name, code }, ack) => {
    if (!code) return ack?.({ ok: false, error: 'Code required' });
    const upper = String(code).trim().toUpperCase();
    const result = joinRoom(upper, { id: socket.id, name: name?.trim() || 'Player' });
    if (result.error) return ack?.({ ok: false, error: result.error });
    socket.join(upper);
    const seat = result.room.players.find((p) => p.id === socket.id).seat;
    ack?.({ ok: true, code: upper, mySeat: seat });
    broadcastRoom(result.room);
  });

  socket.on('lobby:add-bot', ({ code }, ack) => {
    const result = addBot(code, socket.id);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(result.room);
  });

  socket.on('lobby:kick', ({ code, playerId }, ack) => {
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id)
      return ack?.({ ok: false, error: 'Not host' });
    if (playerId === socket.id)
      return ack?.({ ok: false, error: 'Cannot kick yourself' });
    const updated = removePlayer(code, playerId);
    ack?.({ ok: true });
    if (updated) broadcastRoom(updated);
  });

  socket.on('lobby:set-options', ({ code, options }, ack) => {
    const result = setOptions(code, socket.id, options);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(result.room);
  });

  socket.on('lobby:start', ({ code }, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'Room not found' });
    if (room.hostId !== socket.id)
      return ack?.({ ok: false, error: 'Only host can start' });
    if (room.players.length !== 4)
      return ack?.({ ok: false, error: 'Need exactly 4 players or bots' });

    const players = [...room.players].sort((a, b) => a.seat - b.seat);
    const firstCaller = Math.floor(Math.random() * 4);
    let game = createGame({
      players: players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
      options: room.options,
      firstTrumpCaller: firstCaller,
    });
    game = startHand(game);
    room.game = game;
    ack?.({ ok: true });
    broadcastRoom(room);
    maybeRunBotTurn(room);
  });

  socket.on('game:call-trump', ({ code, suit }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.seat !== room.game.trumpCallerSeat)
      return ack?.({ ok: false, error: 'Not trump caller' });
    room.game = callTrump(room.game, suit);
    ack?.({ ok: true });
    broadcastRoom(room);
    maybeRunBotTurn(room);
  });

  socket.on('game:request-redeal', ({ code }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.seat !== room.game.trumpCallerSeat)
      return ack?.({ ok: false, error: 'Not trump caller' });
    if (!canRequestRedeal(room.game))
      return ack?.({ ok: false, error: 'Cannot re-deal' });
    room.game = requestRedeal(room.game);
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('game:play-card', ({ code, card }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return ack?.({ ok: false, error: 'Not in game' });
    const result = playCard(room.game, player.seat, card);
    if (result.error) return ack?.({ ok: false, error: result.error });
    room.game = result.state;
    ack?.({ ok: true });
    broadcastRoom(room);
    setTimeout(() => maybeRunBotTurn(room), 500);
  });

  socket.on('game:decide-stop', ({ code, stop }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return ack?.({ ok: false, error: 'Not in game' });
    room.game = decideStop(room.game, player.seat, !!stop);
    ack?.({ ok: true });
    broadcastRoom(room);
    maybeRunBotTurn(room);
  });

  socket.on('game:thaap', ({ code }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return ack?.({ ok: false, error: 'Not in game' });
    room.game = thaap(room.game, player.seat);
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('game:next-hand', ({ code }, ack) => {
    const room = getRoom(code);
    if (!room?.game) return ack?.({ ok: false, error: 'No game' });
    if (room.hostId !== socket.id)
      return ack?.({ ok: false, error: 'Only host can start next hand' });
    room.game = startNextHand(room.game);
    ack?.({ ok: true });
    broadcastRoom(room);
    maybeRunBotTurn(room);
  });

  socket.on('disconnect', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    if (!room.game) {
      const updated = removePlayer(room.code, socket.id);
      if (updated) broadcastRoom(updated);
      return;
    }
    const p = room.players.find((pp) => pp.id === socket.id);
    if (p) p.connected = false;
    broadcastRoom(room);
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

httpServer.listen(PORT, () => {
  console.log(`Court Piece server listening on http://localhost:${PORT}`);
});
