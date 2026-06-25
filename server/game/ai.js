import { RANK_VALUE, COURT_RANKS, SUITS } from './deck.js';
import { legalPlays, teamOf, partnerOf, trickWinnerSeat } from './rules.js';

export function aiCallTrump(hand) {
  const scores = {};
  for (const s of SUITS) scores[s] = 0;
  for (const c of hand) {
    scores[c.suit] += 1;
    if (COURT_RANKS.has(c.rank)) scores[c.suit] += 1.5;
    if (c.rank === 'A') scores[c.suit] += 1;
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

export function aiPlay(state, seat) {
  const hand = state.hands[seat];
  const legal = legalPlays(hand, state.leadSuit);
  const trick = state.currentTrick;
  const trump = state.trump;
  const leadSuit = state.leadSuit;
  const partner = partnerOf(seat);

  const byRankAsc = (a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  const byRankDesc = (a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank];

  // Leading
  if (trick.length === 0) {
    const nonTrump = legal.filter((c) => c.suit !== trump);
    if (nonTrump.length > 0) return [...nonTrump].sort(byRankDesc)[0];
    return [...legal].sort(byRankDesc)[0];
  }

  const currentWinner = trickWinnerSeat(trick, leadSuit, trump);
  const partnerWinning = currentWinner === partner;
  const winnerCard = trick.find((t) => t.seat === currentWinner).card;

  const followers = legal.filter((c) => c.suit === leadSuit);

  if (followers.length > 0) {
    if (partnerWinning) {
      return [...followers].sort(byRankAsc)[0];
    }
    const opponentTrumped = winnerCard.suit === trump && leadSuit !== trump;
    if (opponentTrumped) {
      return [...followers].sort(byRankAsc)[0];
    }
    const winners = followers.filter(
      (c) => RANK_VALUE[c.rank] > RANK_VALUE[winnerCard.rank],
    );
    if (winners.length > 0) {
      return [...winners].sort(byRankAsc)[0];
    }
    return [...followers].sort(byRankAsc)[0];
  }

  // Cannot follow suit
  if (partnerWinning) {
    const nonTrumps = legal.filter((c) => c.suit !== trump);
    if (nonTrumps.length > 0) return [...nonTrumps].sort(byRankAsc)[0];
    return [...legal].sort(byRankAsc)[0];
  }

  const trumps = legal.filter((c) => c.suit === trump);
  if (trumps.length > 0) {
    if (winnerCard.suit === trump) {
      const better = trumps.filter(
        (t) => RANK_VALUE[t.rank] > RANK_VALUE[winnerCard.rank],
      );
      if (better.length > 0) return [...better].sort(byRankAsc)[0];
    } else {
      return [...trumps].sort(byRankAsc)[0];
    }
  }

  const nonTrumps = legal.filter((c) => c.suit !== trump);
  if (nonTrumps.length > 0) return [...nonTrumps].sort(byRankAsc)[0];
  return [...legal].sort(byRankAsc)[0];
}
