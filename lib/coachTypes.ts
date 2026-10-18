export const COACH_TYPES = ['수석코치', '타격코치', '투수코치', '주루코치', '배터리코치', '수비코치'];
export type CoachFields = { coachType?: string; coachTypes?: string[] };
export function getCoachTypes(value: CoachFields): string[] {
  const types = Array.isArray(value.coachTypes) && value.coachTypes.length
    ? value.coachTypes : (value.coachType || '').split(/\s*[·,/]\s*/);
  return [...new Set(types.filter(type => typeof type === 'string').map(type => type.trim()).filter(Boolean))];
}
export function coachLabel(value: CoachFields): string {
  return getCoachTypes(value).join(' · ') || '코치';
}
