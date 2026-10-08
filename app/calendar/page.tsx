'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'game' | 'practice' | 'meeting' | 'other';
  time?: string;
  note?: string;
  attendance: Record<string, 'yes' | 'no' | 'maybe'>;
}

const TYPE_LABEL: Record<string, string> = { game: '⚾ 경기', practice: '🏃 훈련', meeting: '📋 미팅', other: '📌 기타' };
const TYPE_COLOR: Record<string, string> = { game: '#ef4444', practice: '#10b981', meeting: '#3b82f6', other: '#f59e0b' };
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [myId, setMyId] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'practice' as CalEvent['type'], time: '', note: '' });
  const [editId, setEditId] = useState('');

  const canEdit = role === 'manager' || role === 'coach';
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const s = JSON.parse(raw);
    setRole(s.role ?? '');
    setMyId(s.id ?? '');
    setTeamCode(s.teamCode ?? '');
    const cached = JSON.parse(localStorage.getItem('pitchcom-calendar') || '[]');
    setEvents(cached);
    if (s.teamCode) {
      syncRead(s.teamCode, 'calendar').then(d => {
        if (Array.isArray(d)) { setEvents(d); localStorage.setItem('pitchcom-calendar', JSON.stringify(d)); }
      });
    }
  }, [router]);

  const save = async (next: CalEvent[]) => {
    setEvents(next);
    localStorage.setItem('pitchcom-calendar', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'calendar', next);
  };

  const addEvent = async () => {
    if (!form.title.trim() || !selectedDate) return;
    const ev: CalEvent = { id: Date.now().toString(), date: selectedDate, title: form.title.trim(), type: form.type, time: form.time, note: form.note, attendance: {} };
    await save([...events, ev]);
    setAdding(false);
    setForm({ title: '', type: 'practice', time: '', note: '' });
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('일정을 삭제할까요?')) return;
    await save(events.filter(e => e.id !== id));
  };

  const respond = async (evId: string, ans: 'yes' | 'no' | 'maybe') => {
    const next = events.map(e => e.id === evId ? { ...e, attendance: { ...e.attendance, [myId]: ans } } : e);
    await save(next);
  };

  // 달력 생성
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const dateStr = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>📅 팀 달력</h1>
      </div>

      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDate(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>‹</button>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>{viewYear}년 {viewMonth + 1}월</span>
        <button onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDate(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>›</button>
      </div>

      {/* 달력 그리드 */}
      <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#ef4444' : i === 6 ? '#60a5fa' : '#64748b' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#0f172a' }}>
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} style={{ background: '#1e293b', minHeight: 52 }} />;
            const ds = dateStr(d);
            const evs = events.filter(e => e.date === ds);
            const isToday = ds === todayStr;
            const isSel = ds === selectedDate;
            const isSun = idx % 7 === 0;
            const isSat = idx % 7 === 6;
            return (
              <div key={idx} onClick={() => setSelectedDate(isSel ? '' : ds)} style={{
                background: isSel ? '#1e3a5f' : '#1e293b', minHeight: 52, padding: '6px 4px', cursor: 'pointer',
                border: isSel ? '1.5px solid #3b82f6' : '1.5px solid transparent',
              }}>
                <div style={{ fontSize: 13, fontWeight: isToday ? 900 : 500, color: isToday ? '#3b82f6' : isSun ? '#ef4444' : isSat ? '#60a5fa' : '#f8fafc',
                  width: 22, height: 22, borderRadius: '50%', background: isToday ? '#1e3a5f' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2px' }}>{d}</div>
                {evs.slice(0, 2).map(e => (
                  <div key={e.id} style={{ fontSize: 9, background: TYPE_COLOR[e.type] + '33', color: TYPE_COLOR[e.type], borderRadius: 3, padding: '1px 3px', marginBottom: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.title}</div>
                ))}
                {evs.length > 2 && <div style={{ fontSize: 9, color: '#64748b' }}>+{evs.length - 2}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 패널 */}
      {selectedDate && (
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
              {viewMonth + 1}월 {parseInt(selectedDate.split('-')[2])}일 ({DAYS[new Date(selectedDate).getDay()]})
            </span>
            {canEdit && !adding && (
              <button onClick={() => { setAdding(true); setEditId(''); }} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 추가</button>
            )}
          </div>

          {adding && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="일정 제목" style={inp} autoFocus />
              <div style={{ display: 'flex', gap: 6 }}>
                {(['game','practice','meeting','other'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${form.type === t ? TYPE_COLOR[t] : '#334155'}`, background: form.type === t ? TYPE_COLOR[t] + '33' : 'transparent', color: form.type === t ? TYPE_COLOR[t] : '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{TYPE_LABEL[t]}</button>
                ))}
              </div>
              <input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="시간 (예: 14:00)" type="time" style={inp} />
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="메모 (선택)" style={inp} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addEvent} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                <button onClick={() => setAdding(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          )}

          {dayEvents.length === 0 && !adding ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>일정이 없어요</div>
          ) : dayEvents.map(e => {
            const myAns = e.attendance[myId];
            const yes = Object.values(e.attendance).filter(v => v === 'yes').length;
            const no = Object.values(e.attendance).filter(v => v === 'no').length;
            const maybe = Object.values(e.attendance).filter(v => v === 'maybe').length;
            return (
              <div key={e.id} style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, background: TYPE_COLOR[e.type] + '33', color: TYPE_COLOR[e.type], borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{TYPE_LABEL[e.type]}</span>
                      {e.time && <span style={{ fontSize: 12, color: '#64748b' }}>{e.time}</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{e.title}</div>
                    {e.note && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{e.note}</div>}
                  </div>
                  {canEdit && <button onClick={() => deleteEvent(e.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 16, cursor: 'pointer' }}>🗑️</button>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {(['yes','maybe','no'] as const).map(ans => {
                    const labels: Record<string, string> = { yes: '✅ 참석', maybe: '🤔 미정', no: '❌ 불참' };
                    const counts: Record<string, number> = { yes, maybe, no };
                    return (
                      <button key={ans} onClick={() => respond(e.id, ans)} style={{ flex: 1, padding: '7px 4px', borderRadius: 9, border: `1.5px solid ${myAns === ans ? '#3b82f6' : '#334155'}`, background: myAns === ans ? '#1e3a5f' : 'transparent', color: myAns === ans ? '#60a5fa' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {labels[ans]} {counts[ans] > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>{counts[ans]}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
