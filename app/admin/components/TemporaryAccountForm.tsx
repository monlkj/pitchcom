'use client';

import { useRef, useState } from 'react';
import { syncRead, syncWrite } from '../../../lib/teamSync';
import { COACH_TYPES } from '../../../lib/coachTypes';
import { supabase } from '../../../lib/supabase';
import { hashTemporaryPassword, randomCredential } from '../../../lib/temporaryAccounts';

export default function TemporaryAccountForm({ teamCode, onCreated }: { teamCode: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'player' | 'coach'>('player');
  const [coachTypes, setCoachTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [issued, setIssued] = useState<{ name: string; loginId: string; password: string } | null>(null);
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: 15 };
  const issue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    if (!name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if (role === 'coach' && !coachTypes.length) { setError('코치 유형을 하나 이상 선택해 주세요.'); return; }
    inFlight.current = true; setBusy(true); setIssued(null); setCopied(false);
    try {
      const raw = localStorage.getItem('pitchcom-session');
      const session = JSON.parse(raw || '{}');
      const users = await syncRead('__global__', 'users', true);
      if (!Array.isArray(users)) throw new Error('계정 목록을 확인할 수 없습니다.');
      const actor = users.find(u => u.id === session.id && u.role === 'manager' && u.teamCode === teamCode);
      if (!teamCode || !actor || session.role !== 'manager' || session.teamCode !== teamCode) throw new Error('현재 팀 감독만 발급할 수 있습니다.');
      if (actor.authUserId) {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || data.user?.id !== actor.authUserId) throw new Error('감독 계정으로 다시 로그인해 주세요.');
      }
      let loginId: string;
      do { loginId = `pc-${randomCredential(5)}`; } while (users.some(u => u.email?.toLowerCase() === loginId));
      const password = randomCredential();
      const temporaryCredential = await hashTemporaryPassword(password);
      if (localStorage.getItem('pitchcom-session') !== raw) throw new Error('계정이나 팀이 변경되었습니다. 다시 시도해 주세요.');
      const user = { id: crypto.randomUUID(), name: name.trim(), email: loginId, accountType: 'temporary',
        temporaryCredential, role, teamCode, joinApproved: true, createdBy: actor.id, createdAt: new Date().toISOString(),
        ...(role === 'coach' ? { coachTypes, coachType: coachTypes.join(' · ') } : {}) };
      await syncWrite('__global__', 'users', [...users, user], true);
      // Never retain the newly generated plaintext password in browser storage.
      localStorage.setItem('pitchcom-users', JSON.stringify([...users, user]));
      setIssued({ name: user.name, loginId, password }); setName('');
      onCreated();
    } catch (failure) { setError(failure instanceof Error ? failure.message : '발급하지 못했습니다. 연결 상태를 확인해 주세요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section style={{ marginBottom: 20, padding: 18, border: '1px solid #334155', borderRadius: 16, background: '#1e293b' }}>
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setIssued(null); setError(''); }} disabled={busy} style={{ background: 'none', border: 'none', color: '#93c5fd', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>임시 계정 발급 {open ? '▴' : '▾'}</button>
    {open && <>
      <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>구글 계정 없이 사용할 선수·코치 계정을 발급해요. 감독이 발급하므로 이 팀에 바로 승인됩니다. 다른 팀으로 이동하면 해당 감독의 승인이 필요해요.</p>
      <form onSubmit={issue} style={{ display: 'grid', gap: 12 }}>
        <label style={{ color: '#cbd5e1', fontSize: 13 }}>이름<input aria-label="임시 계정 이름" maxLength={60} value={name} onChange={e => setName(e.target.value)} disabled={busy} style={input} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 13 }}>역할<select aria-label="임시 계정 역할" value={role} onChange={e => setRole(e.target.value as 'player' | 'coach')} disabled={busy} style={input}><option value="player">선수</option><option value="coach">코치</option></select></label>
        {role === 'coach' && <fieldset style={{ border: '1px solid #475569', borderRadius: 10, color: '#cbd5e1' }}><legend>코치 유형 (여러 개 선택 가능)</legend>{COACH_TYPES.map(type => <label key={type} style={{ display: 'block', padding: 6 }}><input type="checkbox" checked={coachTypes.includes(type)} disabled={busy} onChange={() => setCoachTypes(current => current.includes(type) ? current.filter(v => v !== type) : [...current, type])} /> {type}</label>)}</fieldset>}
        <button disabled={busy} style={{ padding: 12, border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 800 }}>{busy ? '발급 중…' : '계정 발급하기'}</button>
      </form>
      {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
      {issued && <div role="status" style={{ marginTop: 16, padding: 14, background: '#0f172a', borderRadius: 12, color: '#cbd5e1', overflowWrap: 'anywhere' }}>
        <strong>{issued.name}님의 임시 계정을 발급했어요.</strong>
        <p style={{ fontSize: 13 }}>비밀번호는 이 화면에서만 확인할 수 있어요. 계정을 사용할 사람에게 전달해 주세요.</p>
        <label>아이디<input aria-label="발급 아이디" value={issued.loginId} readOnly style={input} /></label>
        <label>비밀번호<input aria-label="발급 비밀번호" value={issued.password} readOnly style={input} /></label>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`PitchCom 임시 계정\n아이디: ${issued.loginId}\n비밀번호: ${issued.password}\nhttps://pitchcom-three.vercel.app/login\nGoogle 로그인 아래의 임시 계정으로 로그인에서 입력하세요.`); setCopied(true); } catch { setError('복사하지 못했습니다. 아이디와 비밀번호를 직접 복사해 주세요.'); } }} style={{ marginTop: 12, padding: 10, background: '#1e3a5f', color: '#fff', border: 0, borderRadius: 8 }}>{copied ? '복사 완료' : '발급 정보 복사'}</button>
        <button type="button" onClick={() => setIssued(null)} style={{ marginLeft: 8, padding: 10, background: 'transparent', color: '#94a3b8', border: 0 }}>발급 정보 닫기</button>
      </div>}
    </>}
  </section>;
}
