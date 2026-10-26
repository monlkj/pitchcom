import type { IdentityProfile } from './accountIdentity';

export function ownedTeamCodes(profile: IdentityProfile): string[] {
  const own = profile.role === 'manager' ? [...(Array.isArray(profile.managedTeamCodes) ? profile.managedTeamCodes : []), profile.teamCode] : [];
  return [...new Set([...own, ...(Array.isArray(profile.reservedManagedTeamCodes) ? profile.reservedManagedTeamCodes : [])].filter((code): code is string => typeof code === 'string' && !!code.trim()).map(code => code.trim().toUpperCase()))];
}
export function archiveTransferProfile(profile: IdentityProfile, activeId: string): IdentityProfile {
  const { password: _password, temporaryCredential: _credential, authUserId: _auth, accountType: _type, ...snapshot } = profile;
  return { ...snapshot, email: '', transferredTo: activeId, formerIdentifier: profile.email, transferredAt: new Date().toISOString() };
}

function parkedFor(profile: IdentityProfile, activeId: string, profiles: IdentityProfile[]): boolean {
  const visited = new Set<string>([profile.id]);
  let next = profile.transferredTo;
  while (next) {
    if (next === activeId) return true;
    if (visited.has(next)) return false;
    visited.add(next);
    next = profiles.find(candidate => candidate.id === next)?.transferredTo;
  }
  return false;
}

/** Applied only to saved membership changes, never on reads. */
export function restoreTransferTeams(incoming: IdentityProfile[], stored: IdentityProfile[]): { profiles: IdentityProfile[]; restored: boolean } {
  let profiles = incoming; let restored = false;
  for (const live of stored) {
    if (live.transferredTo) continue;
    const exit = profiles.find(profile => profile.id === live.id);
    if (!exit || exit.transferredTo || (exit.identityVersion ?? 0) !== (live.identityVersion ?? 0)) continue;
    // An original director can later type an owned code to resume that parked
    // director profile. This never grants coach/player memberships approval.
    const resumeManager = !!exit.teamCode && exit.teamCode !== live.teamCode;
    const parked = resumeManager
      ? profiles.find(profile => parkedFor(profile, live.id, profiles) && profile.role === 'manager' && ownedTeamCodes(profile).includes(exit.teamCode))
      : (live.teamCode || exit.requestTransferReturn === true) && !exit.teamCode && typeof live.transferReturnId === 'string'
        ? profiles.find(profile => profile.id === live.transferReturnId && profile.transferredTo === live.id)
        : undefined;
    if (!parked) {
      if ((live.teamCode || exit.requestTransferReturn === true) && !exit.teamCode && live.transferReturnId) throw new Error('보관한 이전 계정을 확인하지 못했습니다. 팀 변경을 다시 시도해 주세요.');
      continue;
    }
    if (profiles.filter(p => p.id === parked.id).length !== 1 || profiles.filter(p => p.id === live.id).length !== 1) throw new Error('계정 고유번호가 중복되어 복귀할 수 없습니다.');
    const { transferredTo: _to, formerIdentifier: _former, transferredAt: _at, ...previous } = parked;
    const returned: IdentityProfile = {
      ...previous, ...(resumeManager ? { teamCode: exit.teamCode, joinApproved: true, joinRequestId: undefined, transferReturnId: live.id } : {}), email: live.email, authUserId: live.authUserId, password: live.password,
      temporaryCredential: live.temporaryCredential, accountType: live.accountType,
      identityVersion: Math.max(Number(parked.identityVersion) || 0, Number(live.identityVersion) || 0) + 1,
      identityChangedAt: new Date().toISOString(),
      reservedManagedTeamCodes: [...new Set([...ownedTeamCodes(live), ...ownedTeamCodes(parked)])],
      teamReturn: { fromId: live.id, fromIdentityVersion: live.identityVersion ?? 0, teamCode: resumeManager ? exit.teamCode : previous.teamCode, at: new Date().toISOString() },
      ...(exit.removalNotice ? { removalNotice: exit.removalNotice } : {}),
    };
    // Keep the departed team's original profile and all referenced history, but
    // never retain a second usable credential or a reciprocal transfer cycle.
    const archived = archiveTransferProfile({ ...(resumeManager ? live : exit), transferReturnId: undefined, requestTransferReturn: undefined }, returned.id);
    profiles = profiles.map(profile => profile.id === live.id ? archived : profile.id === parked.id ? returned : profile);
    restored = true;
  }
  return { profiles, restored };
}
