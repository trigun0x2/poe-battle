/** Anonymous identity + tiny local persistence. */

const ID_KEY = 'exile-draft:player-id';
const NAME_KEY = 'exile-draft:player-name';
const DAILY_KEY = 'exile-draft:daily-done';

export function playerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function playerName(): string {
  return localStorage.getItem(NAME_KEY) ?? 'Anonymous Exile';
}
export function setPlayerName(name: string) {
  localStorage.setItem(NAME_KEY, name.slice(0, 32));
}

export function dailyDone(key: string): boolean {
  return localStorage.getItem(DAILY_KEY) === key;
}
export function markDailyDone(key: string) {
  localStorage.setItem(DAILY_KEY, key);
}
