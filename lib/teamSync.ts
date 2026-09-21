import { supabase } from './supabase';

export async function syncRead(teamCode: string, key: string): Promise<any | null> {
  if (!supabase || !teamCode) return null;
  try {
    const { data, error } = await supabase
      .from('team_shared_data')
      .select('data')
      .eq('team_code', teamCode)
      .eq('data_key', key)
      .single();
    if (error || !data) return null;
    return (data as any).data;
  } catch { return null; }
}

export async function syncWrite(teamCode: string, key: string, value: any): Promise<void> {
  if (!supabase || !teamCode) return;
  try {
    await supabase.from('team_shared_data').upsert({
      team_code: teamCode,
      data_key: key,
      data: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'team_code,data_key' });
  } catch {}
}
