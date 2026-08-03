/** PoE-flavored build name generator. Seeded, editable by the player after. */

import { Rng } from './rng.js';
import { Sheet } from './stats.js';

const PREFIXES = [
  'Kitten', 'Uber', 'Budget', 'Zoomancer', 'Fivehead', 'Juiced', 'Bricked',
  'Softcore', 'Ruthless', 'Vaal', 'Corrupted', 'Awakened', 'Divine', 'Mirror',
  'Sextant', 'Beachhead', 'Lab', 'Atlas', 'Nemesis', 'Turbo',
];
const CORES = [
  'Enjoyer', 'Andy', 'Respecter', 'Merchant', 'Goblin', 'Lich', 'Exile',
  'Occultist', 'Warlord', 'Templar', 'Scion', 'Slayer', 'Gladiator', 'Baron',
  'Widow', 'Herald', 'Prophet', 'Reaver', 'Saboteur', 'Anointed',
];
const TITLES = [
  'of the Beach', 'of Act Ten', 'the Twice-Corrupted', 'of the Eternal Lab',
  'the Chaos-Spammer', 'of Wraeclast', 'the Rerolled', 'of the Trade Chat',
  'the Six-Linked', 'of Standard League', 'the Zero-Div', 'of the Nightmare',
  'the Unascended', 'of the Rotgut', 'the Fated', 'of Highgate',
];

const TAG_WORDS: Record<string, string[]> = {
  fire: ['Cinder', 'Ignite', 'Ash'], cold: ['Frost', 'Shatter', 'Brine'],
  lightning: ['Storm', 'Spark', 'Volt'], chaos: ['Blight', 'Rot', 'Venom'],
  physical: ['Gore', 'Bleed', 'Steel'], minion: ['Horde', 'Bone', 'Puppet'],
  attack: ['Blade', 'Strike'], spell: ['Hex', 'Rune'], dot: ['Wither', 'Smoulder'],
  totem: ['Totem'], golem: ['Golem'], crit: ['Lucky'],
};

export function generateBuildName(seed: string, sheet: Pick<Sheet, 'skillTags'>): string {
  const rng = new Rng(`name:${seed}`);
  const tagWords = sheet.skillTags.flatMap((t) => TAG_WORDS[t] ?? []);
  const core = tagWords.length > 0 && rng.chance(0.7)
    ? `${rng.pick(tagWords)}${rng.pick(CORES).toLowerCase()}`
    : rng.pick(CORES);
  const name = `${rng.pick(PREFIXES)}${core}`;
  return rng.chance(0.55) ? `${name} ${rng.pick(TITLES)}` : name;
}
