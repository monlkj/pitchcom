import { createHash, timingSafeEqual } from 'node:crypto';
import { verifyTemporaryPassword } from '../../../lib/temporaryAccounts';
import { supabase } from '../../../lib/supabase';

export const runtime = 'nodejs';
const failures = new Map<string, { count: number; until: number }>();
const digest = (text: string) => createHash('sha256').update(text).digest();
const emailKey = (email: string) => email.trim().toLowerCase();
const respond = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get('host') || new URL(request.url).host;
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== host) return respond('허용되지 않은 요청입니다.', 403);
    } catch { return respond('허용되지 않은 요청입니다.', 403); }
  }
  if (!request.headers.get('content-type')?.includes('application/json')) return respond('잘못된 요청입니다.', 400);
  if (Number(request.headers.get('content-length') || 0) > 8192) return respond('요청이 너무 큽니다.', 413);
  if (!supabase) return respond('서버 연결을 확인해 주세요.', 503);
  let input;
  try { input = await request.json(); } catch { return respond('잘못된 요청입니다.', 400); }
  const { email, password, teamCode, confirmation, problems } = input ?? {};
  if (typeof email !== 'string' || email.length > 254 || !email.trim() || typeof password !== 'string' || !password || password.length > 1024 || typeof teamCode !== 'string' || teamCode.length > 100 || !teamCode.trim()) return respond('이메일·비밀번호·팀 코드를 모두 입력하세요. 무소속은 “무소속”을 입력하세요.', 400);
  if (confirmation !== '계정 삭제') return respond('확인 문구 “계정 삭제”를 정확히 입력하세요.', 400);
  // Arithmetic is an accidental-deletion check, not authentication or a CAPTCHA.
  if (!Array.isArray(problems) || problems.length !== 2 || !problems.every(p => p && Number.isInteger(p.a) && Number.isInteger(p.b) && p.a >= 1 && p.a <= 9 && p.b >= 1 && p.b <= 9 && Number.isInteger(p.answer) && p.answer === p.a + p.b)) return respond('덧셈 문제 두 개를 모두 맞혀 주세요.', 400);
  const key = digest(emailKey(email)).toString('hex');
  const now = Date.now();
  const previous = failures.get(key);
  if (previous && previous.until > now && previous.count >= 5) return respond('확인을 너무 많이 시도했습니다. 잠시 후 다시 시도하세요.', 429);
  if (failures.size > 1000) for (const [id, item] of failures) if (item.until <= now) failures.delete(id);
  try {
    const { data, error } = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').eq('data_key', 'users').single();
    if (error || !Array.isArray(data?.data)) throw new Error('read failed');
    const users: any[] = data.data;
    const matches = users.filter(user => typeof user.email === 'string' && emailKey(user.email) === emailKey(email));
    const expectedCode = teamCode.trim() === '무소속' ? '' : teamCode.trim().toUpperCase();
    let target;
    for (const user of matches) {
      if (!['coach', 'player'].includes(user.role) || user.teamCode !== expectedCode || user.authUserId) continue;
      const valid = user.temporaryCredential
        ? await verifyTemporaryPassword(password, user.temporaryCredential)
        : typeof user.password === 'string' && timingSafeEqual(digest(user.password), digest(password));
      if (valid) { target = user; break; }
    }
    if (!target || matches.some(user => user.role === 'manager' || user.authUserId)) {
      failures.set(key, { count: previous && previous.until > now ? previous.count + 1 : 1, until: now + 60000 });
      return respond('이메일·비밀번호·소속 팀 정보가 일치하지 않거나 삭제할 수 없는 계정입니다.', 400);
    }
    const ids = new Set(matches.map(user => user.id));
    for (const id of ids) {
      const result = await supabase.from('team_shared_data').upsert({ team_code: '__global__', data_key: `deleted-user:${id}`, data: { id }, updated_at: new Date().toISOString() }, { onConflict: 'team_code,data_key' });
      if (result.error) throw result.error;
    }
    // Re-read before updating so unrelated accounts created during validation are retained.
    const fresh = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').eq('data_key', 'users').single();
    const markers = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').like('data_key', 'deleted-user:%');
    if (fresh.error || markers.error || !Array.isArray(fresh.data?.data)) throw new Error('cleanup failed');
    const deleted = new Set((markers.data || []).map((row: any) => row.data?.id));
    const updated = fresh.data.data.filter((user: { id: string }) => !deleted.has(user.id) && !ids.has(user.id));
    const saved = await supabase.from('team_shared_data').upsert({ team_code: '__global__', data_key: 'users', data: updated, updated_at: new Date().toISOString() }, { onConflict: 'team_code,data_key' });
    if (saved.error) throw saved.error;
    failures.delete(key);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return respond('삭제를 완료하지 못했습니다. 일부 처리되었을 수 있으니 계정 상태를 확인하고 다시 시도하세요.', 503);
  }
}
