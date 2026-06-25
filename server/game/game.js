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
    firstSevenTeam: 'pending',
    canStopDecision: null,
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
    firstSevenTeam: 'pending',
    canStopDecision: null,
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
  if (state.canStopDecision !== null) return { state, error: 'Decision pending' };
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

  let firstSevenTeam = state.firstSevenTeam;
  if (firstSevenTeam === 'pending') {
    firstSevenTeam = winnerTeam;
  } else if (firstSevenTeam && firstSevenTeam !== winnerTeam) {
    firstSevenTeam = null;
  }

  let next = {
    ...state,
    hands: newHands,
    currentTrick: [],
    leadSuit: null,
    turnSeat: winnerSeat,
    tricksWon,
    trickCount,
    firstSevenTeam,
    lastTrick: { trick: newTrick, winnerSeat },
  };

  // Baunie locked-in: 13 tricks played
  if (trickCount === 13) {
    const winningTeam = tricksWon.A >= 7 ? 'A' : 'B';
    return { state: finalizeHand(next, winningTeam) };
  }

  // Kot decision: same team won the first 7
  if (trickCount === 7 && firstSevenTeam !== null) {
    next = { ...next, canStopDecision: winnerSeat, phase: 'awaiting-stop' };
  }

  return { state: next };
}

export function decideStop(state, seat, stop) {
  if (state.phase !== 'awaiting-stop') return state;
  if (state.canStopDecision !== seat) return state;
  if (stop) {
    return finalizeHand(state, state.firstSevenTeam, 'kot');
  }
  return {
    ...state,
    phase: 'playing',
    canStopDecision: null,
  };
}

function finalizeHand(state, winnerTeam, forcedType) {
  let type = forcedType;
  if (!type) {
    if (state.tricksWon[winnerTeam] === 13) type = 'baunie';
    else type = 'win';
  }

  const score = {
    kots: { ...state.score.kots },
    streak: { ...state.score.streak },
  };
  const loserTeam = winnerTeam === 'A' ? 'B' : 'A';

  if (type === 'baunie') {
    score.kots[winnerTeam] += 52;
    score.streak[winnerTeam] = 0;
    score.streak[loserTeam] = 0;
  } else if (type === 'kot') {
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
    if (type === 'kot' || type === 'baunie') {
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
    canStopDecision: null,
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
