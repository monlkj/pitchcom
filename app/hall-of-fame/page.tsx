'use client';

import { useEffect, useRef, useState } from 'react';
import FeaturePage, { featureStyles as ui } from '../components/FeaturePage';
import { featureSession, koreaDate, sameFeatureSession, saveFeature, type FeatureSession } from '../../lib/teamFeatures';
import { syncRead } from '../../lib/teamSync';

const KEY = 'hall-of-fame';
const CATEGORIES = ['이달의 선수', '경기 MVP', '첫 기록', '기록 달성', '팀 공헌', '기타'] as const;
type Category = typeof CATEGORIES[number];
type Draft = { title: string; recipient: string; category: Category; date: string; description: string };
type Award = Draft & { id: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string };
const blank = (): Draft => ({ title: '', recipient: '', category: '이달의 선수', date: koreaDate(), description: '' });
async function readAwards(teamCode: string): Promise<Award[]> {
  const value = await syncRead(teamCode, KEY, true);
  if (value !== null && !Array.isArray(value)) throw new Error('invalid awards');
  return value ?? [];
}

export default function HallOfFamePage() {
  const [session, setSession] = useState<FeatureSession | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState(''); const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState('전체'); const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  const staff = session?.role === 'manager' || session?.role === 'coach';

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void (async () => {
      try {
        const current = featureSession(); setSession(current);
        const [entries, teams, users] = await Promise.all([readAwards(current.teamCode), syncRead(current.teamCode, 'teams'), syncRead('__global__', 'users')]);
        sameFeatureSession(current); if (!active) return;
        const rosterNames: string[] = Array.isArray(teams) ? teams.flatMap(team => (team.players || []).map((player: { name: string }) => player.name)) : [];
        const accountNames: string[] = Array.isArray(users) ? users.filter(user => user.teamCode === current.teamCode && user.role === 'player' && user.joinApproved !== false).map(user => user.name) : [];
        setNames([...new Set([...rosterNames, ...accountNames].filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko')));
        setAwards(entries); setLoaded(true);
      } catch { if (active) { setLoaded(false); setError('명예의 전당을 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.'); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [refresh]);

  const closeForm = () => { setFormOpen(false); setEditing(''); setDraft(blank()); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !staff || !loaded || saving.current) return;
    setError(''); setMessage('');
    if (!draft.title.trim() || !draft.recipient.trim()) { setError('제목과 선수 이름을 입력해 주세요.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date > koreaDate()) { setError('오늘까지의 수상·기록 날짜를 입력해 주세요.'); return; }
    saving.current = true; setBusy(true);
    try {
      const latest = await readAwards(session.teamCode);
      const existing = latest.find(award => award.id === editing);
      if (editing && !existing) throw new Error('award removed');
      const now = new Date().toISOString();
      const award: Award = { ...draft, title: draft.title.trim(), recipient: draft.recipient.trim(), description: draft.description.trim(),
        id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, createdBy: existing?.createdBy || session.name, updatedAt: now, updatedBy: session.name };
      const next = [...latest.filter(item => item.id !== award.id), award];
      await saveFeature(session, KEY, next, true);
      setAwards(next); closeForm(); setMessage(editing ? '기념 기록을 수정했어요.' : '명예의 전당에 등록했어요.');
    } catch { setError('저장하지 못했습니다. 연결과 현재 팀 권한을 확인해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const remove = async (award: Award) => {
    if (!session || !staff || saving.current || !confirm(`${award.recipient}님의 “${award.title}” 기록을 삭제할까요?`)) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const latest = await readAwards(session.teamCode);
      const next = latest.filter(item => item.id !== award.id);
      await saveFeature(session, KEY, next, true);
      setAwards(next); if (editing === award.id) closeForm(); setMessage('기념 기록을 삭제했어요.');
    } catch { setError('삭제하지 못했습니다. 연결과 현재 팀 권한을 확인해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const needle = query.trim().toLocaleLowerCase();
  const visible = awards.filter(award => (category === '전체' || award.category === category) && (!needle || `${award.recipient} ${award.title} ${award.description}`.toLocaleLowerCase().includes(needle)))
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return <FeaturePage title="🏅 명예의 전당" subtitle="우리 팀의 빛나는 순간을 오래 기억해요">
    <section style={{ ...ui.card, background: 'linear-gradient(135deg, #322b19, #1e293b)', borderColor: '#a77e3444' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span aria-hidden="true" style={{ fontSize: 44 }}>🏆</span><div><h2 style={{ fontSize: 18, margin: '0 0 6px', color: '#fde68a' }}>함께 만든 자랑스러운 기록</h2><p style={{ color: '#cbd5e1', fontSize: 13, margin: 0 }}>이달의 선수부터 첫 안타, 팀을 위한 순간까지</p></div></div>
      {loaded && <p style={{ color: '#fcd34d', fontSize: 13, marginBottom: 0 }}>기념 기록 {awards.length}개 · 주인공 {new Set(awards.map(award => award.recipient)).size}명</p>}
    </section>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {staff && <button disabled={!loaded || busy || loading} onClick={() => { setEditing(''); setDraft(blank()); setFormOpen(true); setError(''); setMessage(''); }} style={ui.primary}>＋ 기념 기록 등록</button>}
      <button disabled={busy || loading} onClick={() => { setMessage(''); setRefresh(n => n + 1); }} style={ui.button}>새로고침</button>
    </div>
    {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>}
    {message && <p role="status" style={{ color: '#86efac', fontSize: 14 }}>{message}</p>}
    {loaded && !loading && staff && formOpen && <form aria-label="기념 기록 작성" onSubmit={save} style={ui.card}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>{editing ? '기념 기록 수정' : '새 기념 기록'}</h2>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14, minWidth: 0 }}>
        <label style={{ fontSize: 13 }}>제목<input aria-label="기념 기록 제목" maxLength={60} value={draft.title} onChange={e => setDraft(old => ({ ...old, title: e.target.value }))} placeholder="예: 시즌 첫 홈런" style={{ ...ui.input, marginTop: 6 }} /></label>
        <label style={{ fontSize: 13 }}>선수 이름<input aria-label="기념 기록 선수 이름" list="honor-players" maxLength={40} value={draft.recipient} onChange={e => setDraft(old => ({ ...old, recipient: e.target.value }))} placeholder="선수를 선택하거나 이름을 입력하세요" style={{ ...ui.input, marginTop: 6 }} /><datalist id="honor-players">{names.map(name => <option key={name} value={name} />)}</datalist></label>
        <label style={{ fontSize: 13 }}>종류<select aria-label="기념 기록 종류" value={draft.category} onChange={e => setDraft(old => ({ ...old, category: e.target.value as Category }))} style={{ ...ui.input, marginTop: 6 }}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label style={{ fontSize: 13 }}>수상·기록 날짜<input aria-label="기념 기록 날짜" type="date" required max={koreaDate()} value={draft.date} onChange={e => setDraft(old => ({ ...old, date: e.target.value }))} style={{ ...ui.input, marginTop: 6, minWidth: 0 }} /></label>
        <label style={{ fontSize: 13 }}>기념할 내용<textarea aria-label="기념 기록 내용" maxLength={1000} rows={3} value={draft.description} onChange={e => setDraft(old => ({ ...old, description: e.target.value }))} placeholder="어떤 순간이었는지 팀원들에게 들려주세요." style={{ ...ui.input, marginTop: 6, resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', gap: 8 }}><button style={ui.primary}>{busy ? '저장 중…' : '기념 기록 저장'}</button><button type="button" onClick={closeForm} style={ui.button}>취소</button></div>
      </fieldset>
    </form>}
    {loading ? <p style={{ color: '#94a3b8' }}>명예의 전당 불러오는 중…</p> : loaded && <>
      <section style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        <input aria-label="명예의 전당 검색" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="선수 이름이나 기록 검색" style={ui.input} />
        <select aria-label="명예의 전당 종류 필터" value={category} onChange={e => setCategory(e.target.value)} style={ui.input}><option>전체</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select>
      </section>
      {!visible.length && <section style={{ ...ui.card, padding: '30px 18px', textAlign: 'center' }}><div style={{ fontSize: 36 }}>🏅</div><p style={{ color: '#cbd5e1' }}>{awards.length ? '검색 조건에 맞는 기록이 없어요.' : '아직 등록된 기념 기록이 없어요.'}</p><p style={{ color: '#94a3b8', fontSize: 12 }}>{awards.length ? '다른 이름이나 종류로 찾아보세요.' : staff ? '팀의 첫 번째 자랑스러운 순간을 등록해 보세요.' : '감독·코치가 등록하면 여기에 표시돼요.'}</p></section>}
      {visible.map(award => <article key={award.id} aria-label={`${award.recipient} ${award.title}`} style={{ ...ui.card, borderColor: '#c2984544' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}><span style={{ padding: '4px 8px', borderRadius: 7, background: '#44371f', color: '#fde68a', fontSize: 11 }}>{award.category}</span><time dateTime={award.date} style={{ color: '#94a3b8', fontSize: 12 }}>{award.date.replaceAll('-', '.')}</time></div>
        <p style={{ color: '#fcd34d', fontSize: 14, fontWeight: 800, margin: '0 0 7px', overflowWrap: 'anywhere' }}>⭐ {award.recipient}</p>
        <h2 style={{ fontSize: 19, margin: '0 0 10px', overflowWrap: 'anywhere' }}>{award.title}</h2>
        {award.description && <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{award.description}</p>}
        {staff && <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button disabled={busy} aria-label={`${award.title} 수정`} onClick={() => { setEditing(award.id); setDraft({ title: award.title, recipient: award.recipient, category: award.category, date: award.date, description: award.description }); setFormOpen(true); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={ui.button}>수정</button><button disabled={busy} aria-label={`${award.title} 삭제`} onClick={() => remove(award)} style={{ ...ui.button, color: '#fca5a5' }}>삭제</button></div>}
      </article>)}
    </>}
  </FeaturePage>;
}
