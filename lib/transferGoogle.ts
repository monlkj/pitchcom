import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null = null;
export function transferGoogle() {
  if (typeof window === 'undefined') throw new Error('브라우저에서 구글 인증을 진행해 주세요.');
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('서버 연결 설정을 확인해 주세요.');
    client = createClient(url, key, { auth: { flowType: 'pkce', storageKey: 'pitchcom-transfer-google', detectSessionInUrl: window.location.pathname === '/account-transfer/google' } });
  }
  return client;
}
