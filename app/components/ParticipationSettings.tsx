'use client';
import { useEffect, useState } from 'react';
import { syncRead, syncWrite } from '../../lib/teamSync';
import { COACH_TYPES, getCoachTypes } from '../../lib/coachTypes';

export default function ParticipationSettings() {
  const [session, setSession] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { const s = JSON.parse(localStorage.getItem('pitchcom-session') || '{}'); setSession(s); setPlaying(s.playsAsPlayer === true); setTypes(getCoachTypes(s)); }, []);
  if (!session || !['manager', 'coach'].includes(session.role)) return null;
  const save = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const users = await syncRead('__global__', 'users', true);
      const me = Array.isArray(users) && users.find(u => u.id === session.id);
      const live = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
      if (!me || me.role !== session.role || me.teamCode !== session.teamCode || live.id !== session.id || live.teamCode !== session.teamCode) throw new Error('changed');
      const fields = { playsAsPlayer: playing, ...(session.role === 'manager' ? { coachTypes: types, coachType: types.join(' · ') } : {}) };
      const updated = users.map((u: any) => u.id === me.id ? { ...u, ...fields } : u);
      await syncWrite('__global__', 'users', updated, true);
      const current = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
      if (current.id !== session.id || current.teamCode !== session.teamCode) throw new Error('changed');
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      localStorage.setItem('pitchcom-session', JSON.stringify({ ...current, ...fields }));
      window.location.assign('/home');
    } catch { setMessage('저장하지 못했어요. 연결과 현재 계정을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  return <section style={{ maxWidth: 480, margin: '20px auto', padding: 20, borderRadius: 16, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}>
    <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>내 활동 설정</h2>
    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={playing} disabled={busy} onChange={e => setPlaying(e.target.checked)} />선수로도 활동</label>
    <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>대표 역할과 관리 권한은 유지돼요. 켜면 내 컨디션을 입력할 수 있어요. 선수 기록은 팀/선수 관리에서 기존 선수와 연결하거나 새로 등록해 주세요. 꺼도 기존 기록은 남아요.</p>
    {session.role === 'manager' && <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: '12px 0' }}><legend style={{ fontSize: 13, marginBottom: 8 }}>겸임하는 코치 업무 (여러 개 선택)</legend><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{COACH_TYPES.map(type => <label key={type} style={{ fontSize: 12 }}><input type="checkbox" checked={types.includes(type)} onChange={e => setTypes(current => e.target.checked ? [...current, type] : current.filter(t => t !== type))} />{type}</label>)}</div></fieldset>}
    <button disabled={busy} onClick={save} style={{ padding: '10px 16px', border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>{busy ? '저장 중…' : '활동 설정 저장'}</button>
    {message && <p role="alert">{message}</p>}
  </section>;
}
