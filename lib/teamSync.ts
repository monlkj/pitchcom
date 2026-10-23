import { supabase } from './supabase';
import { isDeletedAccount, refreshDeletedAccounts } from './accountDeletion';

function canUseTeam(teamCode: string) {
  if (teamCode === '__global__') return true;
  if (typeof window === 'undefined') return false;
  const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
  return !isDeletedAccount(session.id) && session.teamCode === teamCode && (session.role === 'manager' || session.joinApproved === true);
}

export async function syncRead(teamCode: string, key: string, strict = false): Promise<any | null> {
  if (!supabase || !teamCode) { if (strict) throw new Error('서버 연결 필요'); return null; }
  if (key !== 'join-requests' && !canUseTeam(teamCode)) return null;
  try {
    const query = supabase.from('team_shared_data').select('data').eq('team_code', teamCode).eq('data_key', key);
    const { data, error } = (key === 'leadership' || key === 'tactics' || key.startsWith('condition:')) ? await query.maybeSingle() : await query.single();
    if (error) { if (strict) throw error; return null; }
    if (!data || (key !== 'join-requests' && !canUseTeam(teamCode))) return null;
    if (teamCode === '__global__' && key === 'users') {
      const deleted = await refreshDeletedAccounts();
      return Array.isArray(data.data) ? data.data.filter((user: { id: string }) => !deleted.has(user.id)) : data.data;
    }
    return (data as any).data;
  } catch (error) { if (strict) throw error; return null; }
}

export async function syncWrite(teamCode: string, key: string, value: any, strict = false): Promise<void> {
  if (!supabase || !teamCode) { if (strict) throw new Error('팀 변경을 저장하려면 서버 연결이 필요합니다.'); return; }
  if (key !== 'join-requests' && !canUseTeam(teamCode)) { if (strict) throw new Error('현재 팀에서 저장할 권한이 없습니다.'); return; }
  try {
    if (teamCode === '__global__' && key === 'users') {
      const deleted = await refreshDeletedAccounts();
      value = value.filter((user: { id: string }) => !deleted.has(user.id));
    }
    const { error } = await supabase.from('team_shared_data').upsert({
      team_code: teamCode,
      data_key: key,
      data: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'team_code,data_key' });
    if (error && strict) throw error;
  } catch (error) { if (strict) throw error; }
}
