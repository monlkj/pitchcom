'use client';
import { useEffect, useState } from 'react';
import { normalizedEmail } from '../../../lib/memberIdentity';
import { syncRead, syncWrite } from '../../../lib/teamSync';
import { EMPTY_LEADERSHIP, isEligibleLeader, resolveLeadership, type Leadership, type LeaderMember } from '../../../lib/teamLeadership';

type Member = LeaderMember & { name: string; email: string };
export default function TeamLeadership({ teamCode, members, onChange }: { teamCode: string; members: Member[]; onChange: (value: Leadership) => void }) {
  const [value, setValue] = useState<Leadership>(EMPTY_LEADERSHIP);
  const [captain, setCaptain] = useState('');
  const [vice, setVice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const eligible = members.filter(m => isEligibleLeader(m, teamCode));
  useEffect(() => {
    let active = true;
    setLoaded(false);
    void syncRead(teamCode, 'leadership', true).then(saved => {
      if (!active) return;
      const next = resolveLeadership(saved, members, teamCode);
      setValue(next); setCaptain(next.captainId || ''); setVice(next.viceCaptainId || ''); onChange(next); setLoaded(true);
    }).catch(() => { if (active) setMessage('직책 정보를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); });
    return () => { active = false; };
  }, [teamCode, members]); // Parent passes current team members after each membership update.
  const appoint = async (position: 'captain' | 'viceCaptain', id: string) => {
    if (busy || !loaded) return;
    setBusy(true); setMessage('');
    try {
      const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
      const users: Member[] = (await syncRead('__global__', 'users', true)) ?? [];
      if (session.teamCode !== teamCode || session.role !== 'manager' || !users.some(u => (u.id === session.id || (normalizedEmail(session.email) && normalizedEmail(u.email) === normalizedEmail(session.email))) && u.role === 'manager' && u.teamCode === teamCode)) throw new Error('권한 변경');
      const target = id ? users.find(u => u.id === id && isEligibleLeader(u, teamCode)) : null;
      if (id && !target) throw new Error('선수 상태 변경');
      const saved = await syncRead(teamCode, 'leadership', true);
      const next = resolveLeadership(saved, users, teamCode);
      if (position === 'captain') {
        next.captainId = id || null; next.captainRequestId = target?.joinRequestId ?? null;
        if (next.viceCaptainId === id) { next.viceCaptainId = null; next.viceCaptainRequestId = null; }
      } else {
        if (id && next.captainId === id) throw new Error('주장은 부주장을 겸할 수 없습니다.');
        next.viceCaptainId = id || null; next.viceCaptainRequestId = target?.joinRequestId ?? null;
      }
      await syncWrite(teamCode, 'leadership', next, true);
      setValue(next); setCaptain(next.captainId || ''); setVice(next.viceCaptainId || ''); onChange(next);
      setMessage(id ? `${position === 'captain' ? '주장' : '부주장'}을 임명했습니다.` : '직책을 해제했습니다.');
    } catch (error) { setMessage(error instanceof Error && error.message === '주장은 부주장을 겸할 수 없습니다.' ? error.message : '저장하지 못했습니다. 연결 상태와 선수의 가입 승인 상태를 확인하세요.'); }
    finally { setBusy(false); }
  };
  return <section style={{ padding: 18, border: '1px solid #334155', borderRadius: 16, background: '#1e293b', marginBottom: 20 }}>
    <h2 style={{ margin: '0 0 10px', fontSize: 16, color: '#f8fafc' }}>주장 · 부주장</h2>
    <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>승인된 선수 중 각각 1명까지 임명합니다. 가입 승인·계정 관리 권한은 감독에게 유지됩니다.</p>
    {([{ key: 'captain' as const, label: '주장', selected: captain, set: setCaptain, current: value.captainId }, { key: 'viceCaptain' as const, label: '부주장', selected: vice, set: setVice, current: value.viceCaptainId }]).map(item => <div key={item.key} style={{ marginTop: 14 }}>
      <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 8 }}>{item.label}: {eligible.find(m => m.id === item.current)?.name || '미지정'}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <select aria-label={`${item.label} 선수 선택`} disabled={busy || !loaded} value={item.selected} onChange={e => item.set(e.target.value)} style={{ flex: 1, minWidth: 0, padding: 10, borderRadius: 9, background: '#0f172a', color: '#f8fafc', border: '1px solid #475569' }}>
          <option value="">미지정 (해제)</option>{eligible.filter(m => item.key !== 'viceCaptain' || m.id !== value.captainId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button disabled={busy || !loaded} onClick={() => appoint(item.key, item.selected)} style={{ padding: '10px 14px', borderRadius: 9, border: 0, color: '#fff', background: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap' }}>{item.label} {item.selected ? '임명' : '해제'}</button>
      </div>
    </div>)}
    {!eligible.length && <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 12 }}>가입한 선수 계정이 없습니다. 선수 관리에만 등록한 명단은 이 목록과 별개입니다.</p>}
    {message && <p role="status" style={{ marginTop: 12, color: '#93c5fd', fontSize: 12 }}>{message}</p>}
  </section>;
}
