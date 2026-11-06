import { getCoachTypes } from './coachTypes';

export type ActingManager = { role?: string; teamCode?: string; joinApproved?: boolean; joinRequestId?: string; actingManagerFor?: string[]; coachType?: string; coachTypes?: string[] };

export function isApproved(member: ActingManager | null | undefined): boolean {
  if (!member) return false;
  return member.joinApproved === true || (member.joinApproved == null && !member.joinRequestId);
}

export function isActingManager(member: ActingManager | null | undefined, teamCode: string): boolean {
  return !!member && member.role === 'coach' && isApproved(member) && Array.isArray(member.actingManagerFor) && member.actingManagerFor.includes(teamCode);
}

export function isTeamManager(member: ActingManager | null | undefined, teamCode: string): boolean {
  return !!member && (member.role === 'manager' || isActingManager(member, teamCode));
}

/** The head coach is only temporary while the owning director is elsewhere. */
export function appointActingManager<T extends ActingManager>(members: T[], teamCode: string): T[] {
  const headCoach = members.find(member => member.role === 'coach' && member.teamCode === teamCode && isApproved(member) && getCoachTypes(member).includes('수석코치'));
  if (!headCoach) return members;
  return members.map(member => member === headCoach
    ? { ...member, actingManagerFor: [...new Set([...(member.actingManagerFor || []), teamCode])] }
    : member);
}

export function releaseActingManager<T extends ActingManager>(members: T[], teamCode: string): T[] {
  return members.map(member => !Array.isArray(member.actingManagerFor) || !member.actingManagerFor.includes(teamCode)
    ? member
    : { ...member, actingManagerFor: member.actingManagerFor.filter(code => code !== teamCode) });
}
