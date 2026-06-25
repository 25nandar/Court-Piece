import {
  createDeck,
  shuffle,
  dealFirstFive,
  dealRemainingEight,
  hasCourtCard,
  cardEq,
  removeCard,
} from './deck.js';
import { teamOf, partnerOf, nextSeat, legalPlays, trickWinnerSeat } from './rules.js';

export function createGame({ players, options = {}, firstTrumpCaller = 0 }) {
  return {
    phase: 'lobby',
    players,
    options: {
      redealIfNoCourtCardFirst5: true,
      thaapEnabled: true,
      ...options,
    },
    trumpCallerSeat: firstTrumpCaller,
    dealerSeat: (firstTrumpCaller - 1 + 4) % 4,
    trump: null,
    hands: [[], [], [], []],
    currentTrick: [],
    leadSuit: null,
    turnSeat: null,
    tricksWon: { A: 0, B: 0 },
    trickCount: 0,
    handOver: false,
    handHistory: [],
    score: {
      kots: { A: 0, B: 0 },
      streak: { A: 0, B: 0 },
    },
    redealCount: 0,
    pendingOutcome: null,
    lastTrick: null,
    lastWinnerTeam: null,
    lastWinnerType: null,
    thaapSignal: null,
    _remainingDeck: null,
    _nextCaller: null,
  };
}

export function startHand(state) {
  const deck = shuffle(createDeck());
  const hands = dealFirstFive(deck);
  return {
    ...state,
    phase: 'trump-call',
    hands,
    _remainingDeck: deck,
    trump: null,
    currentTrick: [],
    leadSuit: null,
    turnSeat: null,
    tricksWon: { A: 0, B: 0 },
    trickCount: 0,
    pendingOutcome: null,
    handOver: false,
    lastTrick: null,
    lastWinnerTeam: null,
    lastWinnerType: null,
    thaapSignal: null,
  };
}

export function canRequestRedeal(state) {
  if (!state.options.redealIfNoCourtCardFirst5) return false;
  if (state.phase !== 'trump-call') return false;
  if (state.redealCount >= 2) return false;
  return !hasCourtCard(state.hands[state.trumpCallerSeat]);
}

export function requestRedeal(state) {
  if (!canRequestRedeal(state)) return state;
  const deck = shuffle(createDeck());
  const hands = dealFirstFive(deck);
  return {
    ...state,
    hands,
    _remainingDeck: deck,
    redealCount: state.redealCount + 1,
  };
}

export function callTrump(state, suit) {
  if (state.phase !== 'trump-call') return state;
  if (!['hearts', 'diamonds', 'clubs', 'spades'].includes(suit)) return state;
  const deck = state._remainingDeck;
  const hands = dealRemainingEight(deck, state.hands);
  return {
    ...state,
    phase: 'playing',
    trump: suit,
    hands,
    turnSeat: state.trumpCallerSeat,
    redealCount: 0,
    _remainingDeck: null,
  };
}

export function playCard(state, seat, card) {
  if (state.phase !== 'playing') return { state, error: 'Not in playing phase' };
  if (state.turnSeat !== seat) return { state, error: 'Not your turn' };
  const hand = state.hands[seat];
  const legal = legalPlays(hand, state.leadSuit);
  if (!legal.some((c) => cardEq(c, card))) return { state, error: 'Illegal play' };

  const newHands = state.hands.map((h, i) => (i === seat ? removeCard(h, card) : h));
  const newTrick = [...state.currentTrick, { seat, card }];
  const newLead = state.leadSuit ?? card.suit;

  if (newTrick.length < 4) {
    return {
      state: {
        ...state,
        hands: newHands,
        currentTrick: newTrick,
        leadSuit: newLead,
        turnSeat: nextSeat(seat),
      },
    };
  }

  // Trick complete
  const winnerSeat = trickWinnerSeat(newTrick, newLead, state.trump);
  const winnerTeam = teamOf(winnerSeat);
  const tricksWon = {
    A: state.tricksWon.A + (winnerTeam === 'A' ? 1 : 0),
    B: state.tricksWon.B + (winnerTeam === 'B' ? 1 : 0),
  };
  const trickCount = state.trickCount + 1;

  const next = {
    ...state,
    hands: newHands,
    currentTrick: [],
    leadSuit: null,
    turnSeat: winnerSeat,
    tricksWon,
    trickCount,
    lastTrick: { trick: newTrick, winnerSeat },
  };

  // The hand ends the moment a team reaches 7 trick wins — no stop/continue
  // decision. A 7-0 sweep is a kot; any other 7th-trick win is a simple win.
  if (tricksWon.A >= 7 || tricksWon.B >= 7) {
    const winningTeam = tricksWon.A >= 7 ? 'A' : 'B';
    const loserTeam = winningTeam === 'A' ? 'B' : 'A';
    const type = tricksWon[loserTeam] === 0 ? 'kot' : 'win';
    return { state: finalizeHand(next, winningTeam, type) };
  }

  return { state: next };
}

function finalizeHand(state, winnerTeam, type) {
  const score = {
    kots: { ...state.score.kots },
    streak: { ...state.score.streak },
  };
  const loserTeam = winnerTeam === 'A' ? 'B' : 'A';

  if (type === 'kot') {
    score.kots[winnerTeam] += 1;
    score.streak[winnerTeam] = 0;
    score.streak[loserTeam] = 0;
  } else {
    score.streak[winnerTeam] += 1;
    score.streak[loserTeam] = 0;
    if (score.streak[winnerTeam] >= 7) {
      score.kots[winnerTeam] += 1;
      score.streak[winnerTeam] = 0;
    }
  }

  const callerTeam = teamOf(state.trumpCallerSeat);
  let nextCaller;
  if (callerTeam === winnerTeam) {
    if (type === 'kot') {
      nextCaller = partnerOf(state.trumpCallerSeat);
    } else {
      nextCaller = state.trumpCallerSeat;
    }
  } else {
    nextCaller = nextSeat(state.trumpCallerSeat);
  }

  return {
    ...state,
    phase: 'hand-end',
    handOver: true,
    pendingOutcome: type,
    lastWinnerTeam: winnerTeam,
    lastWinnerType: type,
    score,
    handHistory: [
      ...state.handHistory,
      {
        winnerTeam,
        type,
        tricksA: state.tricksWon.A,
        tricksB: state.tricksWon.B,
        trumpCallerSeat: state.trumpCallerSeat,
        trump: state.trump,
      },
    ],
    _nextCaller: nextCaller,
  };
}

export function startNextHand(state) {
  if (state.phase !== 'hand-end') return state;
  const next = {
    ...state,
    trumpCallerSeat: state._nextCaller,
    dealerSeat: (state._nextCaller - 1 + 4) % 4,
    _nextCaller: null,
  };
  return startHand(next);
}

export function thaap(state, seat) {
  if (state.phase !== 'playing') return state;
  if (!state.options.thaapEnabled) return state;
  return { ...state, thaapSignal: { seat, ts: Date.now() } };
}
