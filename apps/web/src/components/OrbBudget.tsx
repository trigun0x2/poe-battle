import { STARTING_BUDGET } from '@exile/sim';

/** The budget as a physical stack of orbs that visibly depletes. */
export function OrbBudget({ budget }: { budget: number }) {
  const total = Math.max(STARTING_BUDGET, budget);
  return (
    <div className="budget" role="status" aria-label={`${budget} chaos orbs remaining`}>
      <span className="count">{budget}</span>
      <div className="orb-stack" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`orb${i >= budget ? ' spent' : ''}`} />
        ))}
      </div>
    </div>
  );
}
