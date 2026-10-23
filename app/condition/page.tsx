'use client';
import { useEffect, useRef, useState } from 'react';
import FeaturePage, { featureStyles as ui } from '../components/FeaturePage';
import { featureSession, koreaDate, sameFeatureSession, saveFeature, type FeatureSession } from '../../lib/teamFeatures';
import { syncRead } from '../../lib/teamSync';

type Entry = { userId: string; name: string; date: string; condition: number; fatigue: number; sleep: number; note: string; updatedAt: string };
type Row = { id: string; name: string; entry: Entry | null };
const levels = ['휴식 필요', '좋지 않음', '보통', '좋음', '아주 좋음'];
const colors = ['#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9'];
const key = (date: string, userId: string) => `condition:${date}:${userId}`;
function validEntry(value: unknown, date: string, userId: string): value is Entry {
  const entry = value as Entry;
  return !!entry && entry.userId === userId && entry.date === date && Number.isInteger(entry.condition) && entry.condition >= 1 && entry.condition <= 5 && Number.isInteger(entry.fatigue) && entry.fatigue >= 1 && entry.fatigue <= 5 && Number.isFinite(entry.sleep) && entry.sleep >= 0 && entry.sleep <= 12 && typeof entry.note === 'string';
}

export default function ConditionPage() {
  const [session, setSession] = useState<FeatureSession | null>(null);
  const [date, setDate] = useState(koreaDate);
  const [condition, setCondition] = useState(3); const [fatigue, setFatigue] = useState(2); const [sleep, setSleep] = useState(7); const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]); const [existing, setExisting] = useState<Entry | null>(null);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  const staff = session?.role === 'manager' || session?.role === 'coach';
  useEffect(() => { try { setSession(featureSession()); } catch { setError('팀 가입 승인을 받은 뒤 이용할 수 있어요.'); setLoading(false); } }, []);
  useEffect(() => {
    if (!session) return;
    let active = true; setLoading(true); setError(''); setMessage(''); setRows([]); setExisting(null);
    void (async () => {
      try {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > koreaDate()) throw new Error('invalid date');
        if (staff) {
          const users = await syncRead('__global__', 'users', true);
          if (!Array.isArray(users)) throw new Error('invalid members');
          const players = users.filter(u => u.role === 'player' && u.teamCode === session.teamCode && (u.joinApproved === true || (u.joinApproved == null && !u.joinRequestId)));
          const entries: Row[] = await Promise.all(players.map(async player => {
            const data = await syncRead(session.teamCode, key(date, player.id), true);
            return { id: player.id, name: player.name, entry: validEntry(data, date, player.id) ? data : null };
          }));
          sameFeatureSession(session); if (active) setRows(entries);
        } else {
          const data = await syncRead(session.teamCode, key(date, session.id), true);
          sameFeatureSession(session); if (!active) return;
          const entry = validEntry(data, date, session.id) ? data : null;
          setExisting(entry); setCondition(entry?.condition ?? 3); setFatigue(entry?.fatigue ?? 2); setSleep(entry?.sleep ?? 7); setNote(entry?.note ?? '');
        }
      } catch { if (active) setError('컨디션을 불러오지 못했습니다. 날짜와 연결 상태를 확인하고 새로고침해 주세요.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [session, date, refresh, staff]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || session.role !== 'player' || loading || saving.current || error) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const entry: Entry = { userId: session.id, name: session.name, date, condition, fatigue, sleep, note: note.trim(), updatedAt: new Date().toISOString() };
      if (!validEntry(entry, date, session.id) || date > koreaDate()) throw new Error('invalid entry');
      await saveFeature(session, key(date, session.id), entry);
      setExisting(entry); setMessage('컨디션을 저장했어요.');
    } catch { setError('저장하지 못했습니다. 연결과 현재 팀 권한을 확인하고 새로고침해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const completed = rows.filter(row => row.entry);
  return <FeaturePage title="💪 컨디션" subtitle={staff ? '날짜별 선수 상태와 제출 현황을 확인해요' : '팀과 공유할 오늘의 상태를 남겨 주세요'}>
    <section style={{ ...ui.card, display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 12 }}>
      <label style={{ flex: 1, minWidth: 140, fontSize: 13 }}>기록 날짜 (한국 시간)<input aria-label="컨디션 날짜" type="date" max={koreaDate()} value={date} disabled={busy} onChange={e => { if (e.target.value) setDate(e.target.value); }} style={{ ...ui.input, minWidth: 0, marginTop: 6 }} /></label>
      <button disabled={busy || loading} onClick={() => setRefresh(n => n + 1)} style={ui.button}>새로고침</button>
    </section>
    {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>}
    {loading ? <p style={{ color: '#94a3b8' }}>컨디션 불러오는 중…</p> : staff ? <>
      <section style={ui.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>제출 {completed.length} / {rows.length}명</strong><span style={{ color: '#fbbf24', fontSize: 13 }}>휴식 확인 {completed.filter(row => row.entry!.condition <= 2 || row.entry!.fatigue >= 4).length}명</span></div>
        <p style={{ marginBottom: 0, color: '#94a3b8', fontSize: 12 }}>선수의 자기 평가예요. 상태가 좋지 않으면 직접 확인해 주세요.</p>
      </section>
      {!error && !rows.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>승인된 선수 계정이 아직 없어요.</p>}
      {rows.map(row => <article key={row.id} aria-label={`${row.name} 컨디션`} style={ui.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong style={{ overflowWrap: 'anywhere' }}>{row.name}</strong><span style={{ color: row.entry ? colors[row.entry.condition - 1] : '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>{row.entry ? levels[row.entry.condition - 1] : '미제출'}</span></div>
        {row.entry && <><p style={{ fontSize: 13, color: '#cbd5e1' }}>컨디션 {row.entry.condition}/5 · 피로도 {row.entry.fatigue}/5 · 수면 {row.entry.sleep}시간</p>{row.entry.note && <p style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 0 }}>{row.entry.note}</p>}</>}
      </article>)}
    </> : session?.role === 'player' && <form onSubmit={save} style={ui.card}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>{existing ? '내 컨디션 수정' : '내 컨디션 입력'}</h2>
      <fieldset disabled={busy || !!error} style={{ margin: 0, padding: 0, border: 0 }}><legend style={{ fontSize: 14, marginBottom: 10 }}>오늘의 컨디션</legend><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{levels.map((label, i) => <button key={label} type="button" aria-pressed={condition === i + 1} onClick={() => setCondition(i + 1)} style={{ ...ui.button, flex: '1 0 70px', borderColor: condition === i + 1 ? colors[i] : '#475569', color: condition === i + 1 ? colors[i] : '#94a3b8', fontSize: 12, padding: '12px 6px' }}>{i+1} · {label}</button>)}</div></fieldset>
      <label style={{ display: 'block', marginTop: 22, fontSize: 14 }}>피로도 {fatigue}/5 <span style={{ color: '#94a3b8', fontSize: 12 }}>(1 낮음 · 5 매우 높음)</span><input aria-label="피로도" type="range" min="1" max="5" step="1" value={fatigue} disabled={busy || !!error} onChange={e => setFatigue(Number(e.target.value))} style={{ width: '100%', margin: '14px 0' }} /></label>
      <label style={{ display: 'block', margin: '8px 0 18px', fontSize: 14 }}>수면 시간<input aria-label="수면 시간" type="number" min="0" max="12" step="0.5" required value={Number.isNaN(sleep) ? '' : sleep} disabled={busy || !!error} onChange={e => setSleep(e.target.value === '' ? NaN : Number(e.target.value))} style={{ ...ui.input, marginTop: 8 }} /></label>
      <label style={{ display: 'block', fontSize: 14 }}>팀에 공유할 메모 (선택)<textarea aria-label="컨디션 메모" maxLength={200} rows={3} value={note} disabled={busy || !!error} onChange={e => setNote(e.target.value)} placeholder="예: 오늘은 가벼운 훈련을 원해요." style={{ ...ui.input, resize: 'vertical', marginTop: 8 }} /></label>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: '#94a3b8' }}>컨디션은 팀 공유용으로 저장돼요. 감독·코치는 제출 현황을 확인할 수 있어요.</p>
      <button disabled={busy || !!error} style={{ ...ui.primary, width: '100%' }}>{busy ? '저장 중…' : existing ? '컨디션 수정 저장' : '컨디션 저장'}</button>
      {message && <p role="status" style={{ color: '#86efac', fontSize: 13 }}>{message}</p>}
    </form>}
  </FeaturePage>;
}
