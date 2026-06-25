import { RANK_VALUE } from './deck.js';

// Seats 0 & 2 are Team A; seats 1 & 3 are Team B. Partner sits across.
export function teamOf(seat) {
  return seat % 2 === 0 ? 'A' : 'B';
}

export function partnerOf(seat) {
  return (seat + 2) % 4;
}

// Turn order is counter-clockwise: 0 -> 1 -> 2 -> 3 -> 0.
export function nextSeat(seat) {
  return (seat + 1) % 4;
}

export function legalPlays(hand, leadSuit) {
  if (!leadSuit) return [...hand];
  const followers = hand.filter((c) => c.suit === leadSuit);
  return followers.length > 0 ? followers : [...hand];
}

export function trickWinnerSeat(trick, leadSuit, trump) {
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i].card, winner.card, leadSuit, trump)) {
      winner = trick[i];
    }
  }
  return winner.seat;
}

function beats(a, b, leadSuit, trump) {
  const aT = a.suit === trump;
  const bT = b.suit === trump;
  if (aT !== bT) return aT;
  if (aT && bT) return RANK_VALUE[a.rank] > RANK_VALUE[b.rank];
  const aL = a.suit === leadSuit;
  const bL = b.suit === leadSuit;
  if (aL !== bL) return aL;
  return RANK_VALUE[a.rank] > RANK_VALUE[b.rank];
}
