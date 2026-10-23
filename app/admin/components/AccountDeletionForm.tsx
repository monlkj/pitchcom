'use client';
import { useEffect, useState } from 'react';

type Problem = { a: number; b: number; answer: string };
const generate = (): Problem[] => Array.from({ length: 2 }, () => { const values = crypto.getRandomValues(new Uint32Array(2)); return { a: values[0] % 9 + 1, b: values[1] % 9 + 1, answer: '' }; });

export default function AccountDeletionForm({ onDeleted }: { onDeleted: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setProblems(generate()); }, []);
  const style = { width: '100%', padding: '11px 12px', borderRadius: 9, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: 14 };
  const reset = () => { setEmail(''); setPassword(''); setTeamCode(''); setConfirmation(''); setProblems(generate()); setMessage(''); setShowPassword(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (confirmation !== '계정 삭제' || problems.length !== 2 || problems.some(p => !p.answer.trim() || Number(p.answer) !== p.a + p.b)) { setMessage('확인 문구와 덧셈 정답을 확인하세요.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/account-deletion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, teamCode, confirmation, problems: problems.map(p => ({ ...p, answer: Number(p.answer) })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '삭제하지 못했습니다.');
      reset();
      setMessage('계정이 삭제되었습니다. 기존 로그인도 온라인 상태에서 확인 후 해제됩니다.');
      await onDeleted();
    } catch (error) { setPassword(''); setMessage(error instanceof Error ? error.message : '연결 상태를 확인하고 다시 시도하세요.'); }
    finally { setBusy(false); }
  };
  return <details style={{ marginTop: 24, padding: 18, border: '1px solid #ef444455', borderRadius: 14, background: '#1e293b' }}>
    <summary style={{ color: '#fca5a5', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>다른 팀·무소속 계정 삭제</summary>
    <p style={{ margin: '14px 0', color: '#cbd5e1', fontSize: 12, lineHeight: 1.8 }}>선수·코치 계정에만 적용됩니다. 대상 계정의 비밀번호를 직접 확인해야 하며, 감독 계정은 삭제할 수 없습니다. 수학 문제는 실수 방지용입니다. 삭제 후 복구할 수 없습니다.</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ color: '#cbd5e1', fontSize: 12 }}>대상 계정 아이디 또는 이메일<input type="text" placeholder="가입 시 입력한 이메일 또는 아이디" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} style={style} /></label>
      <label style={{ color: '#cbd5e1', fontSize: 12 }}>대상 계정 비밀번호<input type={showPassword ? 'text' : 'password'} required maxLength={1024} autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} style={style} /></label>
      <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} style={{ justifySelf: 'end', border: 0, background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>{showPassword ? '입력한 비밀번호 숨기기' : '입력한 비밀번호 보기'}</button>
      <label style={{ color: '#cbd5e1', fontSize: 12 }}>대상 소속 팀 코드 (소속이 없으면 ‘무소속’)<input required maxLength={100} value={teamCode} onChange={e => setTeamCode(e.target.value)} style={style} /></label>
      <label style={{ color: '#cbd5e1', fontSize: 12 }}>확인 문구: 계정 삭제<input required value={confirmation} onChange={e => setConfirmation(e.target.value)} style={style} /></label>
      {problems.map((problem, i) => <label key={i} style={{ color: '#cbd5e1', fontSize: 12 }}>문제 {i + 1}: {problem.a} + {problem.b} = ?<input required type="number" inputMode="numeric" value={problem.answer} onChange={e => setProblems(previous => previous.map((p, index) => index === i ? { ...p, answer: e.target.value } : p))} style={style} /></label>)}
      <button type="submit" disabled={busy || problems.length !== 2} style={{ padding: 12, border: 0, borderRadius: 9, background: '#b91c1c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{busy ? '삭제 확인 중…' : '입력한 계정 삭제'}</button>
      <button type="button" disabled={busy} onClick={reset} style={{ padding: 12, border: '1px solid #475569', borderRadius: 9, background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>다시 입력하기</button>
    </form>
    {message && <p role="status" style={{ marginTop: 12, color: '#fca5a5', fontSize: 12, lineHeight: 1.8 }}>{message}</p>}
  </details>;
}
