import { activeProfiles, preserveIdentityChanges } from './accountIdentity';
import { restoreTransferTeams } from './transferTeamReturn';
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
    const { data, error } = ((teamCode === '__global__' && key === 'users') || key === 'leadership' || key === 'tactics' || key === 'hall-of-fame' || key === 'messages' || key.startsWith('message-hidden:') || key.startsWith('condition:')) ? await query.maybeSingle() : await query.single();
    if (error) { if (strict) throw error; return null; }
    if (!data || (key !== 'join-requests' && !canUseTeam(teamCode))) return null;
    if (teamCode === '__global__' && key === 'users') {
      const deleted = await refreshDeletedAccounts();
      return Array.isArray(data.data) ? activeProfiles(data.data.filter((user: { id: string }) => !deleted.has(user.id))) : data.data;
    }
    return (data as any).data;
  } catch (error) { if (strict) throw error; return null; }
}

export async function syncWrite(teamCode: string, key: string, value: any, strict = false): Promise<void> {
  if (!supabase || !teamCode) { if (strict) throw new Error('팀 변경을 저장하려면 서버 연결이 필요합니다.'); return; }
  if (key !== 'join-requests' && !canUseTeam(teamCode)) { if (strict) throw new Error('현재 팀에서 저장할 권한이 없습니다.'); return; }
  try {
    if (teamCode === '__global__' && key === 'users') {
      const latest = await supabase.from('team_shared_data').select('data,updated_at').eq('team_code', '__global__').eq('data_key', 'users').maybeSingle();
      if (latest.error) throw latest.error;
      if (Array.isArray(latest.data?.data)) value = preserveIdentityChanges(value, latest.data.data);
      const deleted = await refreshDeletedAccounts();
      value = value.filter((user: { id: string }) => !deleted.has(user.id));
      if (Array.isArray(latest.data?.data)) {
        const result = restoreTransferTeams(value, latest.data.data);
        value = result.profiles;
        if (result.restored) {
          if (!latest.data.updated_at) throw new Error('계정 변경 버전을 확인하지 못했습니다.');
          const saved = await supabase.from('team_shared_data').update({ data: value, updated_at: new Date().toISOString() })
            .eq('team_code', '__global__').eq('data_key', 'users').eq('updated_at', latest.data.updated_at).select('updated_at');
          if (saved.error || !saved.data?.length) throw new Error('다른 계정 변경이 있어 이전 팀 복귀를 저장하지 못했습니다. 다시 시도해 주세요.');
          return;
        }
      }
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
