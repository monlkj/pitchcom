import type { IdentityProfile } from './accountIdentity';
import { managedTeams, ownsTeam, sameAccount } from './managerTeams';
import { normalizedEmail } from './memberIdentity';
import { appointActingManager, releaseActingManager } from './actingManager';

type SessionIdentity = { id: string; email?: string; authUserId?: string; identityVersion?: number };

/** Plan against the current server profile, never stale device membership fields. */
export function planTeamChange(users: IdentityProfile[], session: SessionIdentity, inputCode: string, leave: boolean, newRequestId: string) {
  const code = inputCode.trim().toUpperCase();
  const me = users.find(user => user.id === session.id && !user.transferredTo);
  if (!me || normalizedEmail(me.email) !== normalizedEmail(session.email) || me.authUserId !== session.authUserId || (me.identityVersion ?? 0) !== (session.identityVersion ?? 0)) throw new Error('계정이 변경되었습니다. 다시 로그인한 뒤 팀을 이동해 주세요.');
  const manager = me.role === 'manager';
  if (!code && !leave && !manager) throw new Error('팀 코드를 입력해 주세요.');
  if (me.teamCode === code && !(leave && me.transferReturnId)) return { unchanged: true, member: me, members: users, needsRequest: false };
  const owner = users.find(user => !user.transferredTo && !sameAccount(user, me) && ownsTeam(user, code));
  if (manager && code && owner) throw new Error('이 팀에는 이미 감독이 있습니다.');
  if (!manager && code && !users.some(user => !user.transferredTo && ownsTeam(user, code))) throw new Error('존재하지 않는 팀 코드예요.');
  const resumingOwnedTeam = Boolean(code && ownsTeam(me, code));
  const needsRequest = !manager && Boolean(code) && !resumingOwnedTeam;
  const member: IdentityProfile = {
    ...me, teamCode: code, joinApproved: manager, joinRequestId: needsRequest ? newRequestId : undefined,
    ...(leave && me.transferReturnId ? { requestTransferReturn: true } : {}),
    ...(manager ? { managedTeamCodes: [...new Set([...managedTeams(users, me), ...(code ? [code] : [])])] } : {}),
  };
  let members = users.map(user => user.id === me.id ? member : user);
  if (manager && me.teamCode && me.teamCode !== code) members = appointActingManager(members, me.teamCode) as IdentityProfile[];
  if (manager && code) members = releaseActingManager(members, code) as IdentityProfile[];
  return { unchanged: false, member, members, needsRequest };
}

/** A return can reactivate another profile ID; follow only this verified transition. */
export function resolveTeamChangeResult(users: IdentityProfile[], before: IdentityProfile): IdentityProfile | undefined {
  const current = users.find(user => user.id === before.id && !user.transferredTo && user.email === before.email && user.authUserId === before.authUserId);
  if (current && (current.identityVersion ?? 0) === (before.identityVersion ?? 0)) return current;
  return users.find(user => !user.transferredTo && user.email === before.email && user.authUserId === before.authUserId &&
    (user.teamReturn as { fromId?: string; fromIdentityVersion?: number } | undefined)?.fromId === before.id &&
    (user.teamReturn as { fromIdentityVersion?: number } | undefined)?.fromIdentityVersion === (before.identityVersion ?? 0));
}
