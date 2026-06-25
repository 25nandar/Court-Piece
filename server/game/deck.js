export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
export const COURT_RANKS = new Set(['J', 'Q', 'K', 'A']);

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Single Sar dealing pattern: 5 cards to each player, trump called, then 4 + 4 more.
export function dealFirstFive(deck) {
  const hands = [[], [], [], []];
  for (let i = 0; i < 5; i++) {
    for (let seat = 0; seat < 4; seat++) {
      hands[seat].push(deck.pop());
    }
  }
  return hands;
}

export function dealRemainingEight(deck, hands) {
  for (let batch = 0; batch < 2; batch++) {
    for (let i = 0; i < 4; i++) {
      for (let seat = 0; seat < 4; seat++) {
        hands[seat].push(deck.pop());
      }
    }
  }
  return hands;
}

export function hasCourtCard(hand) {
  return hand.some((c) => COURT_RANKS.has(c.rank));
}

export function cardEq(a, b) {
  return a && b && a.rank === b.rank && a.suit === b.suit;
}

export function removeCard(hand, card) {
  const idx = hand.findIndex((c) => cardEq(c, card));
  if (idx === -1) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}
