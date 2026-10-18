import { supabase } from './supabase';

const CACHE = 'pitchcomDeletedAccountIds';
export function isDeletedAccount(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return JSON.parse(localStorage.getItem(CACHE) || '[]').includes(id); } catch { return false; }
}
export function withoutDeletedAccounts<T extends { id: string }>(users: T[]): T[] {
  return users.filter(user => !isDeletedAccount(user.id));
}
export async function refreshDeletedAccounts(): Promise<Set<string>> {
  if (!supabase) throw new Error('계정 상태를 확인하려면 서버 연결이 필요합니다.');
  const { data, error } = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').like('data_key', 'deleted-user:%');
  if (error) throw error;
  const deleted = new Set<string>((data || []).map((row: any) => row.data?.id).filter((id: unknown) => typeof id === 'string'));
  // A deletion is permanent for an account ID, even if a later response is stale.
  for (const id of JSON.parse(localStorage.getItem(CACHE) || '[]')) deleted.add(id);
  localStorage.setItem(CACHE, JSON.stringify([...deleted]));
  const local = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
  localStorage.setItem('pitchcom-users', JSON.stringify(local.filter((u: { id: string }) => !deleted.has(u.id))));
  return deleted;
}
export async function markAccountsDeleted(ids: string[]): Promise<void> {
  if (!supabase) throw new Error('서버 연결 필요');
  for (const id of ids) {
    const { error } = await supabase.from('team_shared_data').upsert({
      team_code: '__global__', data_key: `deleted-user:${id}`,
      data: { id }, updated_at: new Date().toISOString(),
    }, { onConflict: 'team_code,data_key' });
    if (error) throw error;
  }
  await refreshDeletedAccounts();
}
