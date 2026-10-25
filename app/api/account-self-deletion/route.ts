import { createHash, timingSafeEqual } from 'node:crypto';
import { supabase } from '../../../lib/supabase';
import { verifyTemporaryPassword } from '../../../lib/temporaryAccounts';

export const runtime = 'nodejs';
const failures = new Map<string, { count: number; until: number }>();
const digest = (value: string) => createHash('sha256').update(value).digest();
const reply = (error: string, status = 400) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) { try { if (new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host)) return reply('허용되지 않은 요청입니다.', 403); } catch { return reply('허용되지 않은 요청입니다.', 403); } }
  if (!request.headers.get('content-type')?.includes('application/json') || Number(request.headers.get('content-length') || 0) > 16000) return reply('잘못된 요청입니다.');
  if (!supabase) return reply('서버 연결을 확인해 주세요.', 503);
  let input;
  try { input = await request.json(); } catch { return reply('잘못된 요청입니다.'); }
  if (!input || typeof input.userId !== 'string' || !input.userId || input.userId.length > 254) return reply('삭제할 계정을 확인해 주세요.');
  const { problems } = input;
  // Arithmetic is only an accidental-deletion check. Password/Google proof authenticates the owner.
  if (!Array.isArray(problems) || problems.length !== 2 || !problems.every(p => p && Number.isInteger(p.a) && Number.isInteger(p.b) && p.a >= 1 && p.a <= 9 && p.b >= 1 && p.b <= 9 && Number.isInteger(p.answer) && p.answer === p.a + p.b)) return reply('수학 문제 두 개를 모두 맞혀 주세요.');
  const throttleKey = digest(input.userId).toString('hex'); const now = Date.now(); const previous = failures.get(throttleKey);
  if (previous && previous.until > now && previous.count >= 5) return reply('확인을 너무 많이 시도했습니다. 잠시 후 다시 시도해 주세요.', 429);
  if (failures.size > 1000) for (const [key, value] of failures) if (value.until <= now) failures.delete(key);
  try {
    const result = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').eq('data_key', 'users').single();
    if (result.error || !Array.isArray(result.data?.data)) return reply('계정 상태를 확인하지 못했습니다.', 503);
    const user = result.data.data.find((profile: { id: string; transferredTo?: string }) => profile.id === input.userId && !profile.transferredTo);
    if (!user) return reply('삭제할 계정이 없거나 이미 삭제되었습니다.');
    let authenticated = false;
    if (user.authUserId) {
      if (input.confirmation !== '계정 삭제' || input.confirmationAgain !== '계정 삭제' || typeof input.googleToken !== 'string' || input.googleToken.length > 8192) return reply('구글 본인 확인과 “계정 삭제” 확인 문구 두 칸을 입력해 주세요.');
      const verified = await supabase.auth.getUser(input.googleToken);
      authenticated = !verified.error && verified.data.user?.id === user.authUserId;
    } else {
      if (typeof input.password !== 'string' || !input.password || input.password.length > 256 || input.password !== input.passwordAgain) return reply('비밀번호 두 칸을 동일하게 입력해 주세요.');
      authenticated = user.temporaryCredential ? await verifyTemporaryPassword(input.password, user.temporaryCredential)
        : typeof user.password === 'string' && timingSafeEqual(digest(user.password), digest(input.password));
    }
    if (!authenticated) {
      failures.set(throttleKey, { count: previous && previous.until > now ? previous.count + 1 : 1, until: now + 60000 });
      return reply('비밀번호 또는 구글 본인 확인 정보가 맞지 않습니다.');
    }
    const marker = await supabase.from('team_shared_data').upsert({ team_code: '__global__', data_key: `deleted-user:${user.id}`, data: { id: user.id }, updated_at: new Date().toISOString() }, { onConflict: 'team_code,data_key' });
    if (marker.error) return reply('삭제를 저장하지 못했습니다. 다시 시도해 주세요.', 503);
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = await supabase.from('team_shared_data').select('data,updated_at').eq('team_code', '__global__').eq('data_key', 'users').single();
      if (latest.error || !Array.isArray(latest.data?.data) || !latest.data.updated_at) break;
      const next = latest.data.data.filter((profile: { id: string }) => profile.id !== user.id);
      const saved = await supabase.from('team_shared_data').update({ data: next, updated_at: new Date().toISOString() })
        .eq('team_code', '__global__').eq('data_key', 'users').eq('updated_at', latest.data.updated_at).select('updated_at');
      if (saved.error) break;
      if (saved.data?.length) { failures.delete(throttleKey); return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } }); }
    }
    return reply('계정은 사용 중지되었지만 삭제 정리를 완료하지 못했습니다. 이 화면에서 다시 시도해 주세요.', 503);
  } catch { return reply('삭제를 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.', 503); }
}
