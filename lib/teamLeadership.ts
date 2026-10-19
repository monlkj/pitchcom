export type LeaderMember = { id: string; role: string; teamCode: string; joinApproved?: boolean; joinRequestId?: string };
export type Leadership = { captainId: string | null; captainRequestId: string | null; viceCaptainId: string | null; viceCaptainRequestId: string | null };
export const EMPTY_LEADERSHIP: Leadership = { captainId: null, captainRequestId: null, viceCaptainId: null, viceCaptainRequestId: null };
export function resolveLeadership(value: Partial<Leadership> | null, members: LeaderMember[], code: string): Leadership {
  const valid = (id: string | null | undefined, request: string | null | undefined) => members.some(member => member.id === id && member.role === 'player' && member.teamCode === code && member.joinApproved === true && (member.joinRequestId ?? null) === (request ?? null));
  const captainId = valid(value?.captainId, value?.captainRequestId) ? value!.captainId! : null;
  const viceCaptainId = valid(value?.viceCaptainId, value?.viceCaptainRequestId) && value?.viceCaptainId !== captainId ? value!.viceCaptainId! : null;
  return { captainId, captainRequestId: captainId ? value?.captainRequestId ?? null : null, viceCaptainId, viceCaptainRequestId: viceCaptainId ? value?.viceCaptainRequestId ?? null : null };
}
