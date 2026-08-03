/** Daily seed derivation — same shops for everyone, one attempt, UTC days. */

export function dailySeed(date = new Date()): string {
  const d = date.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  return `daily:${d}`;
}

export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
