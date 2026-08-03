/** Keystone passives — the tradeoffs. Flags are interpreted by the sim. */
import type { Entity } from '@exile/sim';
import { k } from './helpers.js';

export const keystones: Entity[] = [
  k('Chaos Inoculation', 3, ['es', 'chaos'], { flagCI: 1, es: 200 }, 'Life is overrated anyway.'),
  k('Mind Over Matter', 2, ['mana'], { flagMoM: 1 }, 'The mind bleeds so the body doesn\'t.'),
  k('Eldritch Battery', 2, ['es', 'mana', 'spell'], { flagEB: 1, incDamage: 25 }, 'Burn the shield to feed the storm.'),
  k('Vaal Pact', 3, ['leech'], { flagVaalPact: 1 }, 'Instant gratification, eternal hunger.'),
  k('Elemental Overload', 2, ['elemental', 'spell', 'attack'], { flagEO: 1 }, 'Luck, industrialised.'),
  k('Resolute Technique', 1, ['attack', 'melee'], { flagRT: 1 }, 'Never miss. Never crit. Never worry.'),
  k('Pain Attunement', 3, ['spell', 'lowlife'], { flagLowLife: 1 }, 'Suffering sharpens the mind.'),
  k('Iron Reflexes', 2, ['armour', 'evasion'], { flagIronReflexes: 1 }, 'Stand and take it.'),
  k('Acrobatics', 2, ['evasion'], { flagAcro: 1 }, 'The best armour is elsewhere-ness.'),
  k('Unwavering Stance', 2, ['armour'], { armour: 600 }, 'Cannot be moved. Will not be moved.'),
  k('Ghost Reaver', 2, ['es', 'leech'], { leech: 1.5, es: 80 }, 'Feed the shell, starve the flesh.'),
  k('Zealot\'s Oath', 2, ['es', 'regen'], { regen: 1.5, es: 60 }),
  k('Elemental Equilibrium', 2, ['elemental'], { penetration: 12 }, 'Balance, violently enforced.'),
  k('Avatar of Fire', 2, ['fire'], { moreDamage: 30 }, 'All things end in flame.'),
  k('Point Blank', 2, ['projectile', 'bow'], { moreDamage: 25 }, 'Closer. Closer. There.'),
  k('Iron Grip', 1, ['physical', 'projectile'], { incDamage: 30 }),
  k('Blood Magic', 2, ['life'], { life: 250, flagBloodMagic: 1 }, 'Every spell, paid in blood.'),
  k('Eternal Youth', 2, ['life', 'es'], { flagEternalYouth: 1 }, 'Forever is a long time to bleed.'),
  k('Glancing Blows', 2, ['block'], { flagGlancing: 1, life: -100 }, 'Half a wound is still a wound.'),
  k('Minion Instability', 2, ['minion', 'fire'], { moreDamage: 25 }, 'They explode. It\'s a feature.'),
  k('Wicked Ward', 2, ['es'], { es: 150 }),
  k('Divine Shield', 2, ['armour', 'es'], { es: 100, armour: 300 }),
  k('Supreme Ego', 3, ['aura'], { moreDamage: 20 }, 'One is the strongest number.'),
  k('Crimson Dance', 2, ['physical', 'dot'], { dotMulti: 25 }, 'Eight wounds, one waltz.'),
  k('Arrow Dancing', 1, ['evasion', 'bow'], { evasion: 800 }),
  k('The Agnostic', 2, ['life', 'regen'], { regen: 3 }, 'Belief is a resource. Doubt is armour.'),
];
