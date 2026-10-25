'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import FeaturePage, { featureStyles as ui } from '../components/FeaturePage';
import { supabase } from '../../lib/supabase';
import { transferGoogle } from '../../lib/transferGoogle';

type Session = { id: string; email: string; authUserId?: string };
type Preview = { sourceIdentifier: string; targetIdentifier: string; name: string; role: string; teamCode: string; revision: string };
export default function AccountTransferPage() {
  const [source, setSource] = useState<Session | null>(null);
  const [sourceIdentifier, setSourceIdentifier] = useState(''); const [sourcePassword, setSourcePassword] = useState('');
  const [targetType, setTargetType] = useState<'temporary' | 'google'>('temporary');
  const [targetIdentifier, setTargetIdentifier] = useState(''); const [targetPassword, setTargetPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [googleToken, setGoogleToken] = useState(''); const [googleEmail, setGoogleEmail] = useState('');
  const [authenticating, setAuthenticating] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null); const [done, setDone] = useState(false);
  const inFlight = useRef(false); const popup = useRef<Window | null>(null); const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
    setSource(session); setSourceIdentifier(session.email || '');
    return () => { if (polling.current) clearInterval(polling.current); popup.current?.close(); void transferGoogle().auth.signOut({ scope: 'local' }); };
  }, []);
  const authorizeGoogle = async () => {
    if (authenticating || busy) return;
    const authWindow = window.open('about:blank', 'pitchcom-transfer-auth', 'width=520,height=720');
    if (!authWindow) { setError('팝업이 차단됐습니다. 이 사이트의 팝업을 허용해 주세요.'); return; }
    popup.current = authWindow; setAuthenticating(true); setError(''); setGoogleToken(''); setGoogleEmail('');
    try {
      const auth = transferGoogle(); await auth.auth.signOut({ scope: 'local' });
      const { data, error: authError } = await auth.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: `${window.location.origin}/account-transfer/google`, queryParams: { prompt: 'select_account' } } });
      if (authError || !data.url) throw new Error('구글 인증을 시작하지 못했습니다.');
      authWindow.location.href = data.url;
      let checking = false; let count = 0;
      polling.current = setInterval(async () => {
        if (checking) return; checking = true;
        try {
          const { data: token } = await auth.auth.getSession();
          if (token.session) {
            const verified = await auth.auth.getUser();
            if (!verified.error && verified.data.user?.email) {
              setGoogleToken(token.session.access_token); setGoogleEmail(verified.data.user.email); setPreview(null); setAuthenticating(false);
              if (polling.current) clearInterval(polling.current); authWindow.close(); return;
            }
          }
          if (++count > 300 || authWindow.closed) { if (polling.current) clearInterval(polling.current); setAuthenticating(false); setError('구글 인증을 완료하지 못했습니다. 다시 인증해 주세요.'); }
        } catch { if (polling.current) clearInterval(polling.current); setAuthenticating(false); setError('구글 인증 상태를 확인하지 못했습니다. 다시 시도해 주세요.'); } finally { checking = false; }
      }, 1000);
    } catch (failure) { authWindow.close(); setAuthenticating(false); setError(failure instanceof Error ? failure.message : '구글 인증을 시작하지 못했습니다.'); }
  };
  const submit = async (action: 'preview' | 'commit') => {
    if (!source || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      let sourceGoogleToken: string | undefined;
      if (source.authUserId) {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError || !data.session) throw new Error('지금까지 사용한 구글 계정으로 다시 로그인해 주세요.');
        sourceGoogleToken = data.session.access_token;
      }
      const response = await fetch('/api/account-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, sourceIdentifier, sourcePassword, sourceGoogleToken, targetType, targetIdentifier, targetPassword, targetConfirmation: confirmation, targetGoogleToken: googleToken, revision: preview?.revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '계정 전환을 진행하지 못했습니다.');
      if (action === 'preview') setPreview(result.preview);
      else {
        setDone(true); setSourcePassword(''); setTargetPassword(''); setConfirmation(''); setGoogleToken('');
        localStorage.removeItem('pitchcom-session'); localStorage.removeItem('pitchcom-users');
        await Promise.allSettled([supabase.auth.signOut({ scope: 'local' }), transferGoogle().auth.signOut({ scope: 'local' })]);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : '연결 상태를 확인하고 다시 시도해 주세요.'); if (action === 'commit') setPreview(null); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <FeaturePage title="🔄 계정 전환" subtitle="팀과 내 기록을 유지하고 로그인 계정만 바꿔요">
    {done ? <section style={ui.card}><h2 style={{ color: '#86efac', fontSize: 18 }}>계정 전환이 완료됐어요.</h2><p style={{ color: '#cbd5e1', lineHeight: 1.8 }}>기존 팀·역할·승인·기록은 그대로예요. 앞으로 사용할 계정으로 다시 로그인해 주세요.</p><Link href="/login" style={{ ...ui.primary, display: 'inline-block', textDecoration: 'none' }}>새 계정으로 로그인</Link></section> : <>
      <section style={ui.card}><p style={{ color: '#cbd5e1', margin: 0, fontSize: 13, lineHeight: 1.8 }}>지금까지 사용한 계정과 앞으로 사용할 계정 모두 본인 확인이 필요해요. 전환 뒤에는 이전 로그인 정보로 기존 기록에 들어갈 수 없어요.</p></section>
      {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>}
      {preview ? <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>전환할 내용을 확인해 주세요</h2>
        <p style={{ color: '#94a3b8', overflowWrap: 'anywhere' }}>{preview.sourceIdentifier} → <strong style={{ color: '#93c5fd' }}>{preview.targetIdentifier}</strong></p>
        <p style={{ lineHeight: 1.8 }}>유지할 이름: {preview.name}<br/>역할: {preview.role === 'manager' ? '감독' : preview.role === 'coach' ? '코치' : '선수'}<br/>팀: {preview.teamCode || '무소속'}</p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>팀 기록, 승인 상태, 주장·부주장, 메시지와 개인 기록은 기존 고유번호로 유지됩니다.</p>
        <button disabled={busy} onClick={() => submit('commit')} style={ui.primary}>{busy ? '전환 중…' : '이 정보로 계정 전환'}</button>
        <button disabled={busy} onClick={() => setPreview(null)} style={{ ...ui.button, marginLeft: 8 }}>다시 입력</button>
      </section> : <form onSubmit={event => { event.preventDefault(); void submit('preview'); }} style={{ ...ui.card, display: 'grid', gap: 16 }}>
        <fieldset disabled={busy || authenticating} style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 12, minWidth: 0 }}>
          <legend style={{ fontWeight: 800, marginBottom: 12 }}>지금까지 사용한 계정</legend>
          <label style={{ fontSize: 13 }}>아이디 또는 이메일<input aria-label="지금까지 사용한 계정" required maxLength={254} value={sourceIdentifier} onChange={e => setSourceIdentifier(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
          {source?.authUserId ? <p style={{ color: '#94a3b8', fontSize: 12 }}>현재 로그인한 구글 계정으로 본인 확인합니다.</p> : <label style={{ fontSize: 13 }}>기존 비밀번호<input aria-label="기존 계정 비밀번호" type="password" required autoComplete="current-password" maxLength={256} value={sourcePassword} onChange={e => setSourcePassword(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>}
        </fieldset>
        <fieldset disabled={busy || authenticating} style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 12, minWidth: 0 }}>
          <legend style={{ fontWeight: 800, marginBottom: 12 }}>앞으로 사용할 계정</legend>
          <select aria-label="전환할 계정 종류" value={targetType} onChange={e => { setTargetType(e.target.value as 'temporary' | 'google'); setTargetPassword(''); setConfirmation(''); setError(''); }} style={ui.input}><option value="temporary">임시 계정</option><option value="google">Google 계정</option></select>
          {targetType === 'temporary' ? <>
            <label style={{ fontSize: 13 }}>앞으로 사용할 아이디 (기존 또는 새 아이디)<input aria-label="전환할 임시 계정" required maxLength={254} autoCapitalize="none" placeholder="예)example@naver.com" value={targetIdentifier} onChange={e => setTargetIdentifier(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
            <label style={{ fontSize: 13 }}>비밀번호 (4자 이상)<input aria-label="전환할 계정 비밀번호" type="password" required minLength={4} maxLength={256} autoComplete="new-password" value={targetPassword} onChange={e => setTargetPassword(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
            <label style={{ fontSize: 13 }}>확인 비밀번호<input aria-label="전환할 계정 확인 비밀번호" type="password" required maxLength={256} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
          </> : <><button type="button" onClick={authorizeGoogle} style={ui.primary}>전환할 Google 계정 인증</button>{googleEmail && <p style={{ color: '#86efac', overflowWrap: 'anywhere', fontSize: 13 }}>인증 완료: {googleEmail}</p>}</>}
        </fieldset>
        {authenticating && <p role="status" style={{ color: '#93c5fd' }}>팝업에서 구글 계정을 선택해 주세요.</p>}
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.8 }}>전환할 계정에 이미 팀이나 활동 기록이 있으면 자동으로 합치거나 덮어쓰지 않아요.</p>
        <button disabled={busy || authenticating || (targetType === 'google' && !googleToken)} style={ui.primary}>{busy ? '확인 중…' : '전환 내용 확인'}</button>
      </form>}
    </>}
  </FeaturePage>;
}
