import { createHash, timingSafeEqual } from 'node:crypto';
import { supabase } from '../../../lib/supabase';
import { hashTemporaryPassword, verifyTemporaryPassword, type TemporaryCredential } from '../../../lib/temporaryAccounts';
import { activeProfiles, type IdentityProfile } from '../../../lib/accountIdentity';

export const runtime = 'nodejs';
const normalized = (value: string) => value.trim().toLowerCase();
const digest = (value: string) => createHash('sha256').update(value).digest();
const reply = (error: string, status = 400) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const attempts = new Map<string, { count: number; until: number }>();
async function passwordMatches(profile: IdentityProfile, password: unknown) {
  if (profile.authUserId || typeof password !== 'string' || !password || password.length > 256) return false;
  return profile.temporaryCredential ? verifyTemporaryPassword(password, profile.temporaryCredential as TemporaryCredential)
    : typeof profile.password === 'string' && timingSafeEqual(digest(profile.password), digest(password));
}
async function google(token: unknown) {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('구글 계정으로 본인 인증을 진행해 주세요.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email || !data.user.identities?.some((identity: { provider: string }) => identity.provider === 'google')) throw new Error('구글 계정 본인 인증에 실패했습니다. 다시 인증해 주세요.');
  return data.user;
}
// Existing target data is never silently combined or overwritten.
async function targetIsUnused(target: IdentityProfile) {
  if (target.teamCode || (Array.isArray(target.managedTeamCodes) && target.managedTeamCodes.length)) return false;
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('team_shared_data').select('team_code,data_key,data').range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('전환할 계정의 기존 기록을 확인하지 못했습니다.');
    for (const row of data) {
      if (row.team_code === '__global__' && row.data_key === 'users') continue;
      if (String(row.data_key).includes(target.id) || JSON.stringify(row.data).includes(target.id)) return false;
    }
    if (data.length < 500) return true;
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) { try { if (new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host)) return reply('허용되지 않은 요청입니다.', 403); } catch { return reply('허용되지 않은 요청입니다.', 403); } }
  if (!request.headers.get('content-type')?.includes('application/json') || Number(request.headers.get('content-length') || 0) > 24000) return reply('잘못된 요청입니다.');
  if (!supabase) return reply('서버 연결 설정을 확인해 주세요.', 503);
  let input;
  try { input = await request.json(); } catch { return reply('잘못된 요청입니다.'); }
  if (!input || !['preview','commit'].includes(input.action) || typeof input.sourceIdentifier !== 'string' || !input.sourceIdentifier.trim() || input.sourceIdentifier.length > 254 || !['temporary','google'].includes(input.targetType)) return reply('지금까지 사용한 계정과 전환할 계정을 입력해 주세요.');
  const attemptKey = digest(normalized(input.sourceIdentifier)).toString('hex');
  const previous = attempts.get(attemptKey); const now = Date.now();
  if (previous && previous.until > now && previous.count >= 5) return reply('확인을 너무 많이 시도했습니다. 잠시 후 다시 시도해 주세요.', 429);
  try {
    const snapshot = await supabase.from('team_shared_data').select('data,updated_at').eq('team_code', '__global__').eq('data_key', 'users').single();
    if (snapshot.error || !Array.isArray(snapshot.data?.data) || !snapshot.data.updated_at) return reply('계정 정보를 확인하지 못했습니다.', 503);
    const stored: IdentityProfile[] = snapshot.data.data;
    const profiles = activeProfiles(stored);
    const sources = profiles.filter(profile => normalized(profile.email) === normalized(input.sourceIdentifier));
    if (sources.length !== 1) throw new Error(sources.length > 1 ? '같은 아이디의 계정이 여러 개라 자동 전환할 수 없습니다. 계정을 정리한 뒤 진행해 주세요.' : '지금까지 사용한 계정의 본인 확인 정보를 확인해 주세요.');
    const source = sources[0];
    if (source.authUserId) { if ((await google(input.sourceGoogleToken)).id !== source.authUserId) throw new Error('지금까지 사용한 구글 계정으로 로그인해 주세요.'); }
    else if (!await passwordMatches(source, input.sourcePassword)) throw new Error('지금까지 사용한 계정의 비밀번호가 맞지 않습니다.');
    let identifier: string; let authUserId: string | undefined; let target: IdentityProfile | undefined;
    if (input.targetType === 'google') {
      const user = await google(input.targetGoogleToken); identifier = normalized(user.email!); authUserId = user.id;
      const matches = profiles.filter(profile => profile.authUserId === user.id || normalized(profile.email) === identifier);
      if (matches.length > 1) throw new Error('전환할 계정이 중복되어 있습니다. 계정을 정리한 뒤 진행해 주세요.');
      target = matches[0];
      if (target && target.authUserId !== user.id) throw new Error('이 이메일에 임시 계정이 있습니다. 먼저 임시 계정 본인 확인으로 전환해 주세요.');
    } else {
      if (typeof input.targetIdentifier !== 'string' || !input.targetIdentifier.trim() || /\s/.test(input.targetIdentifier.trim()) || input.targetIdentifier.length > 254 || typeof input.targetPassword !== 'string' || input.targetPassword.length < 4 || input.targetPassword.length > 256 || input.targetPassword !== input.targetConfirmation) throw new Error('전환할 아이디와 4자 이상 비밀번호·확인 비밀번호를 확인해 주세요.');
      identifier = normalized(input.targetIdentifier);
      const matches = profiles.filter(profile => normalized(profile.email) === identifier);
      if (matches.length > 1) throw new Error('전환할 계정이 중복되어 있습니다.');
      target = matches[0];
      if (target && !await passwordMatches(target, input.targetPassword)) throw new Error('전환할 임시 계정의 비밀번호가 맞지 않거나 구글 로그인 계정입니다.');
    }
    if (source.id === target?.id || normalized(source.email) === identifier) throw new Error('현재 계정과 다른 계정을 선택해 주세요.');
    const deleted = await supabase.from('team_shared_data').select('data').eq('team_code', '__global__').like('data_key', 'deleted-user:%');
    if (deleted.error) return reply('계정 상태를 확인하지 못했습니다.', 503);
    const deletedIds = new Set((deleted.data || []).map((row: { data: { id: string } }) => row.data?.id));
    if (deletedIds.has(source.id) || (target && deletedIds.has(target.id))) throw new Error('삭제된 계정으로는 전환할 수 없습니다.');
    if (target && !await targetIsUnused(target)) throw new Error('전환할 계정에도 팀이나 활동 기록이 있습니다. 기존 정보를 덮어쓰지 않도록 전환을 중단했습니다. 사용하지 않은 계정을 선택해 주세요.');
    const summary = { sourceIdentifier: source.email, targetIdentifier: identifier, name: source.name, role: source.role, teamCode: source.teamCode, revision: snapshot.data.updated_at };
    if (input.action === 'preview') { attempts.delete(attemptKey); return Response.json({ preview: summary }, { headers: { 'Cache-Control': 'no-store' } }); }
    if (input.revision !== snapshot.data.updated_at) return reply('계정 정보가 변경되었습니다. 전환 내용을 다시 확인해 주세요.', 409);
    const { password: _password, temporaryCredential: _credential, authUserId: _auth, accountType: _type, ...preserved } = source;
    const updated = { ...preserved, email: identifier, identityVersion: (Number(source.identityVersion) || 0) + 1, identityChangedAt: new Date().toISOString(),
      ...(authUserId ? { authUserId } : { accountType: 'temporary', temporaryCredential: await hashTemporaryPassword(input.targetPassword) }) };
    const next = stored.map(profile => profile.id === source.id ? updated : target && profile.id === target.id ? {
      id: profile.id, name: profile.name, email: '', role: profile.role, teamCode: '', transferredTo: source.id,
      formerIdentifier: profile.email, transferredAt: new Date().toISOString(),
    } : profile);
    // One compare-and-swap UPDATE changes the identity and archives an unused target atomically.
    const saved = await supabase.from('team_shared_data').update({ data: next, updated_at: new Date().toISOString() })
      .eq('team_code', '__global__').eq('data_key', 'users').eq('updated_at', snapshot.data.updated_at).select('updated_at');
    if (saved.error) return reply('계정 전환을 저장하지 못했습니다. 다시 확인해 주세요.', 503);
    if (!saved.data?.length) return reply('다른 변경이 먼저 저장되었습니다. 전환 내용을 다시 확인해 주세요.', 409);
    attempts.delete(attemptKey);
    return Response.json({ transferred: true, summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (failure) {
    attempts.set(attemptKey, { count: previous && previous.until > now ? previous.count + 1 : 1, until: now + 60000 });
    return reply(failure instanceof Error ? failure.message : '계정 전환을 확인하지 못했습니다. 연결 상태를 확인해 주세요.');
  }
}
