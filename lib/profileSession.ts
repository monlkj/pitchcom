import type { IdentityProfile } from './accountIdentity';

/** Whitelist session fields; credentials never enter the application session. */
export function profileSession(user: IdentityProfile, authUserId: string | undefined = user.authUserId) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role, authUserId,
    identityVersion: user.identityVersion, teamCode: user.teamCode,
    joinApproved: user.joinApproved, joinRequestId: user.joinRequestId,
    coachType: user.coachType, coachTypes: user.coachTypes, playsAsPlayer: user.playsAsPlayer,
    managedTeamCodes: user.managedTeamCodes, reservedManagedTeamCodes: user.reservedManagedTeamCodes,
    removalNotice: user.removalNotice, transferReturnId: user.transferReturnId, teamReturn: user.teamReturn,
  };
}
