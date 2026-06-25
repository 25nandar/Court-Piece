import { randomBytes } from 'crypto';

const rooms = new Map();

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous
const BOT_NAMES = ['Bot Bilal', 'Bot Asha', 'Bot Karim', 'Bot Zara'];

function genCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  if (rooms.has(code)) return genCode();
  return code;
}

function firstFreeSeat(room) {
  const used = new Set(room.players.map((p) => p.seat));
  for (let i = 0; i < 4; i++) if (!used.has(i)) return i;
  return -1;
}

export function createRoom({ hostId, hostName }) {
  const code = genCode();
  const room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, isBot: false, seat: 0, connected: true }],
    game: null,
    options: {
      redealIfNoCourtCardFirst5: true,
      thaapEnabled: true,
    },
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function getRoomByPlayer(playerId) {
  for (const r of rooms.values()) {
    if (r.players.some((p) => p.id === playerId)) return r;
  }
  return null;
}

export function joinRoom(code, { id, name }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.game) return { error: 'Game already started' };
  const seat = firstFreeSeat(room);
  if (seat === -1) return { error: 'Room full' };
  room.players.push({ id, name, isBot: false, seat, connected: true });
  return { room };
}

export function addBot(code, hostId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only host can add bots' };
  if (room.game) return { error: 'Game already started' };
  const seat = firstFreeSeat(room);
  if (seat === -1) return { error: 'Room full' };
  const botId = `bot_${seat}_${randomBytes(3).toString('hex')}`;
  room.players.push({
    id: botId,
    name: BOT_NAMES[seat],
    isBot: true,
    seat,
    connected: true,
  });
  return { room };
}

export function removePlayer(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0 || room.players.every((p) => p.isBot)) {
    rooms.delete(code);
    return null;
  }
  return room;
}

export function setOptions(code, hostId, options) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only host can change options' };
  if (room.game) return { error: 'Game already started' };
  room.options = { ...room.options, ...options };
  return { room };
}
