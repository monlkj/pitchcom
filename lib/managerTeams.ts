import { normalizedEmail } from './memberIdentity';
type Account = { id: string; email?: string; role?: string; teamCode?: string; managedTeamCodes?: string[] };
export function sameAccount(a: Account, b: Account): boolean {
  return a.id === b.id || Boolean(normalizedEmail(a.email) && normalizedEmail(a.email) === normalizedEmail(b.email));
}
export function managedTeams(users: Account[], session: Account): string[] {
  const records = [session, ...users.filter(user => user.role === 'manager' && sameAccount(user, session))];
  return [...new Set(records.flatMap(user => [...(user.managedTeamCodes || []), user.teamCode || '']).filter(code => typeof code === 'string').map(code => code.trim().toUpperCase()).filter(Boolean))];
}
