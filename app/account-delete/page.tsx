'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import FeaturePage, { featureStyles as ui } from '../components/FeaturePage';
import { supabase } from '../../lib/supabase';
import { transferGoogle } from '../../lib/transferGoogle';
import { verifyGooglePopup } from '../../lib/verifyGooglePopup';

type Problem = { a: number; b: number; answer: string };
const newProblems = (): Problem[] => Array.from({ length: 2 }, () => ({ a: Math.floor(Math.random()*9)+1, b: Math.floor(Math.random()*9)+1, answer: '' }));
export default function AccountDeletePage() {
  const [user, setUser] = useState<{ id: string; email: string; role?: string; authUserId?: string } | null>(null);
  const [password, setPassword] = useState(''); const [again, setAgain] = useState('');
  const [confirmation, setConfirmation] = useState(''); const [confirmationAgain, setConfirmationAgain] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [googleToken, setGoogleToken] = useState(''); const [googleEmail, setGoogleEmail] = useState(''); const [authenticating, setAuthenticating] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  const inFlight = useRef(false); const authAbort = useRef<AbortController | null>(null);
  useEffect(() => { setUser(JSON.parse(localStorage.getItem('pitchcom-session') || 'null')); setProblems(newProblems()); return () => { authAbort.current?.abort(); void transferGoogle().auth.signOut({ scope: 'local' }); }; }, []);
  const authorize = async () => {
    if (busy || authenticating) return;
    setAuthenticating(true); setError(''); setGoogleToken(''); setGoogleEmail('');
    authAbort.current?.abort(); authAbort.current = new AbortController();
    try {
      const proof = await verifyGooglePopup(authAbort.current.signal);
      if (authAbort.current.signal.aborted) return;
      setGoogleToken(proof.token); setGoogleEmail(proof.email);
    } catch (failure) { if (!authAbort.current?.signal.aborted) setError(failure instanceof Error ? failure.message : '구글 본인 확인을 완료하지 못했습니다.'); }
    finally { setAuthenticating(false); }
  };
  const reset = () => { setPassword(''); setAgain(''); setConfirmation(''); setConfirmationAgain(''); setGoogleToken(''); setGoogleEmail(''); setProblems(newProblems()); setError(''); };
  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || inFlight.current || authenticating) return;
    setError('');
    if (!user.authUserId && (!password || password !== again)) { setError('비밀번호 두 칸을 동일하게 입력해 주세요.'); return; }
    if (user.authUserId && (!googleToken || confirmation !== '계정 삭제' || confirmationAgain !== '계정 삭제')) { setError('구글 본인 확인과 확인 문구 두 칸을 완료해 주세요.'); return; }
    if (problems.length !== 2 || problems.some(problem => !problem.answer.trim() || Number(problem.answer) !== problem.a + problem.b)) { setError('수학 문제 두 개를 모두 맞혀 주세요.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch('/api/account-self-deletion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, password, passwordAgain: again, googleToken, confirmation, confirmationAgain, problems: problems.map(problem => ({ ...problem, answer: Number(problem.answer) })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '계정을 삭제하지 못했습니다.');
      setDone(true); setPassword(''); setAgain(''); setGoogleToken('');
      localStorage.removeItem('pitchcom-session'); localStorage.removeItem('pitchcom-users');
      await Promise.allSettled([supabase.auth.signOut({ scope: 'local' }), transferGoogle().auth.signOut({ scope: 'local' })]);
    } catch (failure) { setPassword(''); setAgain(''); setError(failure instanceof Error ? failure.message : '계정을 삭제하지 못했습니다. 다시 시도해 주세요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <FeaturePage title="계정 삭제" subtitle="사용 중인 PitchCom 계정을 삭제해요">
    {done ? <section style={ui.card}><h2 style={{ color: '#86efac', fontSize: 18 }}>계정이 삭제되었습니다.</h2><p style={{ color: '#94a3b8', fontSize: 14 }}>기존 로그인도 온라인 확인 후 해제됩니다.</p><Link href="/login" style={{ ...ui.primary, display: 'inline-block', textDecoration: 'none' }}>로그인 화면으로</Link></section> : <>
      <section style={ui.card}><strong style={{ color: '#fca5a5' }}>삭제 후 이 계정으로 로그인할 수 없어요.</strong><p style={{ color: '#cbd5e1', overflowWrap: 'anywhere', fontSize: 13 }}>{user?.email}</p>{user?.role === 'manager' && <p style={{ color: '#fca5a5', fontSize: 13 }}>감독 계정을 삭제하면 이 계정의 팀 관리 권한도 사라집니다.</p>}<p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.8 }}>{user?.authUserId ? '구글 계정은 별도 비밀번호가 없어요. 구글 본인 확인과 확인 문구 두 번, 수학 문제 두 개를 완료해 주세요.' : '현재 비밀번호를 두 번 입력하고 수학 문제 두 개를 맞혀 주세요.'}</p></section>
      {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>}
      <form onSubmit={remove} onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault(); }} style={ui.card}>
        <fieldset disabled={busy || authenticating} style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 16, minWidth: 0 }}>
          {user?.authUserId ? <>
            <button type="button" onClick={authorize} style={ui.primary}>Google 계정 본인 확인</button>
            {googleEmail && <p style={{ color: '#86efac', fontSize: 13, overflowWrap: 'anywhere' }}>인증 완료: {googleEmail}</p>}
            <label style={{ fontSize: 13 }}>계정 삭제 입력<input aria-label="삭제 확인 문구" required value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="계정 삭제" style={{ ...ui.input, marginTop: 6 }} /></label>
            <label style={{ fontSize: 13 }}>계정 삭제 다시 입력<input aria-label="삭제 확인 문구 다시 입력" required value={confirmationAgain} onChange={e => setConfirmationAgain(e.target.value)} placeholder="계정 삭제" style={{ ...ui.input, marginTop: 6 }} /></label>
          </> : <>
            <label style={{ fontSize: 13 }}>현재 비밀번호<input aria-label="삭제 비밀번호" type="password" required maxLength={256} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
            <label style={{ fontSize: 13 }}>비밀번호 다시 입력<input aria-label="삭제 비밀번호 다시 입력" type="password" required maxLength={256} autoComplete="off" value={again} onChange={e => setAgain(e.target.value)} style={{ ...ui.input, marginTop: 6 }} /></label>
          </>}
          {problems.map((problem,index) => <label key={index} style={{ fontSize: 14 }}>문제 {index+1}: {problem.a} + {problem.b} =<input aria-label={`삭제 수학 문제 ${index+1}`} required inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} value={problem.answer} onChange={e => setProblems(current => current.map((p,i) => i === index ? { ...p, answer: e.target.value } : p))} style={{ ...ui.input, marginTop: 6 }} /></label>)}
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>수학 문제는 실수로 삭제하는 일을 줄이기 위한 확인이에요.</p>
          <button disabled={!user || problems.length !== 2} style={{ ...ui.primary, background: '#b91c1c' }}>{busy ? '삭제 중…' : '계정 영구 삭제'}</button>
          <button type="button" onClick={reset} style={ui.button}>다시 입력하기</button>
        </fieldset>
        {authenticating && <p role="status" style={{ color: '#93c5fd' }}>팝업에서 삭제할 계정을 선택해 주세요.</p>}
      </form>
    </>}
  </FeaturePage>;
}
