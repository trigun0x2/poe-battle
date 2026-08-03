import type { Offer } from '@exile/sim';
import { CATEGORY_LABEL, TIER_GLYPH, statLines } from './statsText';

interface Props {
  offer: Offer;
  index: number;
  blockReason: string | null;
  canLock: boolean;
  onBuy: () => void;
  onToggleLock: () => void;
  dealIndex: number;
}

export function ItemCard({ offer, index, blockReason, canLock, onBuy, onToggleLock, dealIndex }: Props) {
  const e = offer.entity;
  const lines = statLines(e);
  const classes = [
    'card', `r-${e.category}`, 'dealing',
    offer.locked ? 'locked' : '',
    offer.sold ? 'sold' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={classes}
      style={{ '--deal-i': dealIndex } as React.CSSProperties}
      aria-label={`Offer ${index + 1}: ${e.name}, ${CATEGORY_LABEL[e.category]}, tier ${e.tier}, ${offer.price} chaos orbs${offer.sold ? ', drafted' : ''}${offer.locked ? ', locked' : ''}`}
    >
      <div className="cat smallcaps">
        {CATEGORY_LABEL[e.category]}
        <span className="tier" aria-label={`tier ${e.tier}`}>{TIER_GLYPH[e.tier - 1]}</span>
      </div>
      <h3 className="name">{e.name}</h3>
      {e.base && <div className="base">{e.base}</div>}
      <ul className="stats">
        {lines.slice(0, 5).map((l) => <li key={l}>{l}</li>)}
        {e.tags.length > 0 && (
          <li style={{ marginTop: 4, fontSize: '0.68rem', letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
            {e.tags.slice(0, 4).join(' · ')}
          </li>
        )}
      </ul>
      {e.flavor && <p className="flavor">{e.flavor}</p>}
      <div className="buy-row">
        <span className="price" aria-label={`${offer.price} chaos orbs`}>
          <span className="orb" aria-hidden="true" />
          {offer.price === 0 ? 'free' : offer.price}
        </span>
        <span>
          {!offer.sold && canLock && (
            <button className="mini-btn" onClick={onToggleLock}>
              {offer.locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          <button
            className="mini-btn buy"
            onClick={onBuy}
            disabled={!!blockReason}
            title={blockReason ?? undefined}
          >
            {offer.sold ? 'Drafted' : blockReason && blockReason !== 'Not enough orbs' ? blockReason : 'Buy'}
          </button>
        </span>
      </div>
    </article>
  );
}
