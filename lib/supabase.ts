import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = url ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: typeof window === 'undefined' || window.location.pathname !== '/account-transfer/google' } }) : null as any;
