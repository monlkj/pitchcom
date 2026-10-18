// Team data must never fall back to a different team's browser cache.
const GLOBAL = new Set(['pitchcom-session', 'pitchcom-users']);
const PREFIX = 'pitchcom-cache:';
export function migrateTeamCache() {
  if (localStorage.getItem('pitchcom-cache-migrated')) return;
  const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('pitchcom-') || GLOBAL.has(key) || key.startsWith(PREFIX)) continue;
    localStorage.setItem(`${PREFIX}${encodeURIComponent(session.teamCode || '__unassigned__')}:${key}`, localStorage.getItem(key)!);
    localStorage.removeItem(key);
  }
  localStorage.setItem('pitchcom-cache-migrated', '1');
}
function scopedKey(key: string): string | null {
  migrateTeamCache();
  const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
  if (!session.teamCode || (session.role !== 'manager' && session.joinApproved !== true)) return null;
  return `${PREFIX}${encodeURIComponent(session.teamCode)}:${key}`;
}
export const teamStorage = {
  getItem(key: string) { const scoped = scopedKey(key); return scoped ? localStorage.getItem(scoped) : null; },
  setItem(key: string, value: string) { const scoped = scopedKey(key); if (scoped) localStorage.setItem(scoped, value); },
  removeItem(key: string) { const scoped = scopedKey(key); if (scoped) localStorage.removeItem(scoped); },
};
