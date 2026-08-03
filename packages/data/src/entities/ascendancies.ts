/** All 19 PoE1 ascendancies, distilled to an identity the sim can price. */
import type { Entity } from '@exile/sim';
import { a } from './helpers.js';

export const ascendancies: Entity[] = [
  // Duelist
  a('Slayer', 'Duelist', ['attack', 'physical', 'leech'], { moreDamage: 20, leech: 2, life: 100 }, 'Kill. Overkill. Repeat.'),
  a('Gladiator', 'Duelist', ['attack', 'physical', 'block', 'dot'], { block: 25, moreDamage: 12, life: 100 }, 'The crowd demands blood. Provide.'),
  a('Champion', 'Duelist', ['attack', 'armour'], { moreDamage: 15, armour: 500, life: 150 }, 'Stand tall. Never yield.'),
  // Marauder
  a('Juggernaut', 'Marauder', ['armour', 'physical', 'life'], { armour: 1500, life: 250, regen: 1.5 }, 'Unstoppable is not a metaphor.'),
  a('Berserker', 'Marauder', ['attack', 'physical', 'speed'], { moreDamage: 40, incSpeed: 12, life: -100 }, 'Rage is a resource. Spend it all.'),
  a('Chieftain', 'Marauder', ['fire', 'totem', 'life'], { moreDamage: 22, resFire: 30, regen: 2, life: 100 }, 'Ngamahu\'s flame burns in your chest.'),
  // Ranger
  a('Deadeye', 'Ranger', ['bow', 'projectile', 'speed'], { moreDamage: 25, incSpeed: 10, evasion: 300 }, 'One shot, one screen.'),
  a('Raider', 'Ranger', ['attack', 'speed', 'evasion'], { incSpeed: 25, evasion: 1000, suppress: 25 }, 'Never stop moving.'),
  a('Pathfinder', 'Ranger', ['flask', 'chaos', 'elemental'], { moreDamage: 20, regen: 1.5, resAll: 8 }, 'The flask is always half full.'),
  // Shadow
  a('Assassin', 'Shadow', ['crit', 'chaos', 'speed'], { critChance: 25, critMulti: 45, evasion: 200 }, 'The perfect kill needs no witness.'),
  a('Saboteur', 'Shadow', ['trap', 'mine', 'elemental'], { moreDamage: 25, penetration: 10, life: 80 }, 'Light the fuse. Walk away.'),
  a('Trickster', 'Shadow', ['es', 'dot', 'chaos', 'evasion'], { es: 300, evasion: 500, suppress: 20, moreDamage: 10 }, 'Heads I win, tails you lose.'),
  // Templar
  a('Inquisitor', 'Templar', ['spell', 'elemental', 'crit'], { penetration: 15, critChance: 15, regen: 1.5 }, 'Judgement is best delivered personally.'),
  a('Hierophant', 'Templar', ['totem', 'spell', 'mana'], { moreDamage: 20, es: 200, flagMoM: 1 }, 'Faith, arranged in formation.'),
  a('Guardian', 'Templar', ['minion', 'aura', 'armour'], { armour: 800, es: 200, regen: 1.5, block: 12, moreDamage: 10 }, 'A shield for every believer.'),
  // Witch
  a('Necromancer', 'Witch', ['minion'], { moreDamage: 35, es: 150, life: 80 }, 'Death is a promotion.'),
  a('Occultist', 'Witch', ['chaos', 'cold', 'curse', 'es'], { es: 400, moreDamage: 20 }, 'The void whispers back.'),
  a('Elementalist', 'Witch', ['fire', 'cold', 'lightning', 'golem', 'elemental'], { moreDamage: 25, penetration: 8, resAll: 8 }, 'Why choose an element when you can have them all?'),
  // Scion
  a('Ascendant', 'Scion', ['attack', 'spell'], { incDamage: 30, life: 150, resAll: 10 }, 'A little of everything. A lot of nothing.'),
];
