import Card from './Card.jsx';

const SUIT_ORDER = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function sortHand(cards) {
  return [...cards].sort((a, b) => {
    if (SUIT_ORDER[a.suit] !== SUIT_ORDER[b.suit])
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
}

export default function Hand({ cards, onPlay, legalSet, disabled }) {
  const sorted = sortHand(cards);
  return (
    <div className="hand">
      {sorted.map((c) => {
        const id = `${c.rank}_${c.suit}`;
        const legal = !legalSet || legalSet.has(id);
        return (
          <Card
            key={id}
            card={c}
            disabled={disabled || !legal}
            onClick={onPlay ? () => onPlay(c) : undefined}
            className={!legal && !disabled ? 'illegal' : legal && !disabled ? 'playable' : ''}
          />
        );
      })}
    </div>
  );
}
