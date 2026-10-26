import { participatesAsPlayer } from './playerParticipation';
import { syncRead, syncWrite } from './teamSync';

export interface FeatureSession { id: string; name: string; role: 'manager' | 'coach' | 'player'; teamCode: string; joinApproved?: boolean; playsAsPlayer?: boolean; }
export function featureSession(): FeatureSession {
  const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
  if (!session.id || !session.teamCode || !['manager', 'coach', 'player'].includes(session.role) || (session.role !== 'manager' && session.joinApproved !== true)) throw new Error('팀 가입 승인이 필요합니다.');
  return session;
}
export function sameFeatureSession(expected: FeatureSession) {
  const current = featureSession();
  if (current.id !== expected.id || current.teamCode !== expected.teamCode || current.role !== expected.role) throw new Error('계정이나 팀이 변경되었습니다. 다시 열어 주세요.');
}
export async function saveFeature(session: FeatureSession, key: string, value: unknown, staffOnly = false) {
  sameFeatureSession(session);
  const users = await syncRead('__global__', 'users', true);
  const actor = Array.isArray(users) && users.find(u => u.id === session.id && u.teamCode === session.teamCode && u.role === session.role && (u.role === 'manager' || u.joinApproved === true));
  if (!actor || (staffOnly && actor.role !== 'manager' && actor.role !== 'coach')) throw new Error('현재 팀에서 저장할 권한이 없습니다.');
  if (key.startsWith('condition:') && (!participatesAsPlayer(actor) || !key.endsWith(`:${actor.id}`))) throw new Error('본인의 선수 컨디션만 저장할 수 있습니다.');
  sameFeatureSession(session);
  await syncWrite(session.teamCode, key, value, true);
  sameFeatureSession(session);
}
export function koreaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
