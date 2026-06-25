const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLOR = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };

export default function Card({ card, facedown, onClick, disabled, className = '', size = 'normal' }) {
  if (facedown || !card) {
    return (
      <div className={`card facedown size-${size} ${className}`}>
        <div className="card-back" />
      </div>
    );
  }
  const color = SUIT_COLOR[card.suit];
  const sym = SUIT_SYMBOL[card.suit];
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      className={`card size-${size} ${color} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={Cmp === 'button' ? disabled : undefined}
      type={Cmp === 'button' ? 'button' : undefined}
    >
      <span className="corner top-left">
        <span className="rank">{card.rank}</span>
        <span className="symbol">{sym}</span>
      </span>
      <span className="suit-big">{sym}</span>
      <span className="corner bottom-right">
        <span className="rank">{card.rank}</span>
        <span className="symbol">{sym}</span>
      </span>
    </Cmp>
  );
}
