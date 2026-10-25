export interface IdentityProfile {
  id: string; name: string; email: string; role: string; teamCode: string;
  authUserId?: string; password?: string; temporaryCredential?: unknown;
  transferredTo?: string; identityVersion?: number;
  [key: string]: unknown;
}
export const activeProfiles = <T extends { transferredTo?: string }>(profiles: T[]) => profiles.filter(profile => !profile.transferredTo);
// An identity change must not be undone by a browser still holding an older profile.
export function preserveIdentityChanges(incoming: IdentityProfile[], stored: IdentityProfile[]): IdentityProfile[] {
  const next = incoming.map(profile => {
    const live = stored.find(user => user.id === profile.id);
    if (live?.transferredTo) return live;
    if (!live || (Number(live.identityVersion) || 0) <= (Number(profile.identityVersion) || 0)) return profile;
    const { password: _password, temporaryCredential: _credential, authUserId: _auth, accountType: _type, ...rest } = profile;
    return { ...rest, email: live.email, authUserId: live.authUserId, temporaryCredential: live.temporaryCredential,
      password: live.password, accountType: live.accountType, identityVersion: live.identityVersion, identityChangedAt: live.identityChangedAt } as IdentityProfile;
  });
  for (const live of stored) if ((live.transferredTo || live.identityVersion) && !next.some(user => user.id === live.id)) next.push(live);
  return next;
}
