import type { Entity, GearSlot, Stats, Tier } from '@exile/sim';

export const TIER_COST: Record<Tier, number> = { 1: 2, 2: 3, 3: 5, 4: 8, 5: 12 };

const slug = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Unique item. */
export function u(
  name: string, base: string, slot: GearSlot, tier: Tier,
  tags: string[], stats: Stats, flavor?: string,
): Entity {
  return { id: slug(name), category: 'unique', name, base, slot, tier, cost: TIER_COST[tier], tags, stats, flavor };
}

/** Skill gem. */
export function g(
  name: string, tier: Tier, tags: string[],
  baseDamage: number, baseSpeed: number, baseCrit: number, flavor?: string,
): Entity {
  return {
    id: slug(name), category: 'skill', name, base: 'Skill Gem', tier, cost: TIER_COST[tier],
    tags, stats: { baseDamage, baseSpeed, baseCrit }, flavor,
  };
}

/** Support gem. */
export function s(name: string, tier: Tier, tags: string[], stats: Stats, flavor?: string): Entity {
  return {
    id: slug(name), category: 'support', name, base: 'Support Gem', tier, cost: TIER_COST[tier],
    tags, stats, flavor,
  };
}

/** Ascendancy. */
export function a(name: string, cls: string, tags: string[], stats: Stats, flavor?: string): Entity {
  return {
    id: slug(name), category: 'ascendancy', name, base: cls, tier: 3, cost: 0, tags, stats, flavor,
  };
}

/** Keystone. */
export function k(name: string, tier: Tier, tags: string[], stats: Stats, flavor?: string): Entity {
  return {
    id: slug(name), category: 'keystone', name, base: 'Keystone Passive', tier, cost: TIER_COST[tier],
    tags, stats, flavor,
  };
}
