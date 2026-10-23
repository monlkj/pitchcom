'use client';
import { useEffect, useRef, useState } from 'react';
import FeaturePage, { featureStyles as ui } from '../components/FeaturePage';
import { featureSession, sameFeatureSession, saveFeature, type FeatureSession } from '../../lib/teamFeatures';
import { syncRead } from '../../lib/teamSync';

type Point = { x: number; y: number };
type Marker = Point & { id: string; label: string; player: string };
type Arrow = { start: Point; end: Point };
type Board = { id: string; title: string; notes: string; markers: Marker[]; arrows: Arrow[]; updatedAt: string; updatedBy: string };
const initial = (): Marker[] => [
  ['P', '투수', 250, 315], ['C', '포수', 250, 448], ['1B', '1루수', 355, 320], ['2B', '2루수', 310, 235],
  ['3B', '3루수', 145, 320], ['SS', '유격수', 190, 235], ['LF', '좌익수', 105, 155], ['CF', '중견수', 250, 95], ['RF', '우익수', 395, 155],
].map(([id, label, x, y]) => ({ id: String(id), label: String(label), x: Number(x), y: Number(y), player: '' }));

export default function TacticsPage() {
  const [session, setSession] = useState<FeatureSession | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [id, setId] = useState(''); const [title, setTitle] = useState(''); const [notes, setNotes] = useState('');
  const [markers, setMarkers] = useState<Marker[]>(initial); const [arrows, setArrows] = useState<Arrow[]>([]);
  const [selected, setSelected] = useState('P'); const [roster, setRoster] = useState<string[]>([]);
  const [draw, setDraw] = useState(false); const [preview, setPreview] = useState<Arrow | null>(null);
  const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [dirty, setDirty] = useState(false);
  const svg = useRef<SVGSVGElement>(null); const saving = useRef(false);
  const gesture = useRef<{ pointer: number; marker?: string; start?: Point } | null>(null);
  const canEdit = session?.role === 'manager' || session?.role === 'coach';
  const current = markers.find(marker => marker.id === selected);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const s = featureSession(); setSession(s);
        const [saved, teams] = await Promise.all([syncRead(s.teamCode, 'tactics', true), syncRead(s.teamCode, 'teams')]);
        sameFeatureSession(s); if (!active) return;
        setBoards(Array.isArray(saved) ? saved : []);
        setRoster(Array.isArray(teams) ? [...new Set<string>(teams.flatMap(t => (t.players || []).map((p: { name: string }) => p.name)))] : []);
        if (Array.isArray(saved) && saved.length) open(saved[0]);
        setLoaded(true);
      } catch { if (active) setError('작전판을 불러오지 못했습니다. 연결을 확인하고 다시 열어 주세요.'); }
    })();
    return () => { active = false; };
  }, []);
  function open(board: Board) { setId(board.id); setTitle(board.title); setNotes(board.notes); setMarkers(board.markers); setArrows(board.arrows); setDirty(false); setPreview(null); setMessage(''); setSelected('P'); }
  const point = (event: React.PointerEvent): Point => {
    const box = svg.current!.getBoundingClientRect();
    return { x: Math.max(25, Math.min(475, (event.clientX - box.left) * 500 / box.width)), y: Math.max(30, Math.min(470, (event.clientY - box.top) * 500 / box.height)) };
  };
  const finish = () => {
    if (gesture.current?.start && preview && Math.hypot(preview.end.x - preview.start.x, preview.end.y - preview.start.y) > 8) { setArrows(previous => [...previous, preview].slice(-50)); setDirty(true); }
    gesture.current = null; setPreview(null);
  };
  const save = async () => {
    if (!session || !canEdit || !loaded || saving.current) return;
    if (!title.trim()) { setError('작전 이름을 입력해 주세요.'); return; }
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const latest = await syncRead(session.teamCode, 'tactics', true);
      if (latest !== null && !Array.isArray(latest)) throw new Error('invalid boards');
      const board: Board = { id: id || crypto.randomUUID(), title: title.trim(), notes: notes.trim(), markers, arrows, updatedAt: new Date().toISOString(), updatedBy: session.name };
      const next = [...(latest || []).filter((b: Board) => b.id !== board.id), board];
      await saveFeature(session, 'tactics', next, true);
      setId(board.id); setBoards(next); setDirty(false); setMessage('팀 작전판을 저장했어요.');
    } catch { setError('저장하지 못했습니다. 연결과 현재 팀 권한을 확인해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const remove = async () => {
    if (!session || !id || !canEdit || saving.current || !confirm('이 작전판을 삭제할까요?')) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const latest = await syncRead(session.teamCode, 'tactics', true);
      const next = (Array.isArray(latest) ? latest : []).filter((b: Board) => b.id !== id);
      await saveFeature(session, 'tactics', next, true); setBoards(next); fresh(); setMessage('작전판을 삭제했어요.');
    } catch { setError('삭제하지 못했습니다. 다시 시도해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  function fresh() { setId(''); setTitle(''); setNotes(''); setMarkers(initial()); setArrows([]); setDirty(false); setMessage(''); setSelected('P'); }
  return <FeaturePage title="📋 작전판" subtitle="수비 움직임과 중계 플레이를 함께 확인해요">
    {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>}
    {!loaded ? <p style={{ color: '#94a3b8' }}>작전판 불러오는 중…</p> : <>
      <section style={ui.card}>
        <label style={{ fontSize: 13, color: '#94a3b8' }}>저장된 작전<select aria-label="저장된 작전" value={id} disabled={busy} onChange={e => { const board = boards.find(b => b.id === e.target.value); if (board) open(board); else fresh(); }} style={{ ...ui.input, marginTop: 6 }}><option value="">새 작전</option>{boards.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}</select></label>
        {canEdit ? <p style={{ marginBottom: 0, fontSize: 12, color: '#94a3b8' }}>포지션을 드래그해 옮기거나, 화살표 모드에서 이동 방향을 그려 보세요.</p> : <p style={{ marginBottom: 0, fontSize: 12, color: '#94a3b8' }}>감독·코치가 저장한 작전을 확인할 수 있어요.</p>}
      </section>
      {canEdit && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button disabled={busy} aria-pressed={!draw} onClick={() => setDraw(false)} style={{ ...ui.button, borderColor: !draw ? '#60a5fa' : '#475569' }}>위치 이동</button>
        <button disabled={busy} aria-pressed={draw} onClick={() => setDraw(true)} style={{ ...ui.button, borderColor: draw ? '#60a5fa' : '#475569' }}>화살표 그리기</button>
        <button disabled={busy || !arrows.length} onClick={() => { setArrows(old => old.slice(0, -1)); setDirty(true); }} style={ui.button}>화살표 되돌리기</button>
      </div>}
      <svg ref={svg} viewBox="0 0 500 500" role="group" aria-label="야구 작전판" style={{ display: 'block', width: '100%', background: '#112b29', borderRadius: 20, border: '1px solid #365653', boxSizing: 'border-box', touchAction: canEdit ? 'none' : 'auto' }}
        onPointerDown={e => { if (!canEdit || busy || !draw) return; e.preventDefault(); const start = point(e); gesture.current = { pointer: e.pointerId, start }; e.currentTarget.setPointerCapture(e.pointerId); setPreview({ start, end: start }); }}
        onPointerMove={e => { const g = gesture.current; if (!g || g.pointer !== e.pointerId || busy || !canEdit) return; const end = point(e); if (g.marker) { setMarkers(old => old.map(m => m.id === g.marker ? { ...m, ...end } : m)); setDirty(true); } else if (g.start) setPreview({ start: g.start, end }); }}
        onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setPreview(null); }}>
        <defs><marker id="tactics-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#fbbf24" strokeWidth="1.5" /></marker></defs>
        <path d="M250 430 L35 215 Q250 -55 465 215 Z" fill="#194a3e" stroke="#467c68" strokeWidth="2" />
        <path d="M250 405 L140 295 L250 185 L360 295 Z" fill="#796044" opacity=".7" />
        <path d="M35 215 L250 430 L465 215 M250 405 L140 295 L250 185 L360 295 Z" fill="none" stroke="#e2e8f0" strokeWidth="2" opacity=".65" />
        {[ [250,185], [140,295], [360,295], [250,405] ].map(([x,y]) => <rect key={`${x}-${y}`} x={x-5} y={y-5} width="10" height="10" fill="#f8fafc" transform={`rotate(45 ${x} ${y})`} />)}
        <circle cx="250" cy="315" r="14" fill="#98794d" />
        {[...arrows, ...(preview ? [preview] : [])].map((a,i) => <line key={i} x1={a.start.x} y1={a.start.y} x2={a.end.x} y2={a.end.y} stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" markerEnd="url(#tactics-arrow)" pointerEvents="none" />)}
        {markers.map(marker => <g key={marker.id} role="button" tabIndex={canEdit ? 0 : -1} aria-label={`${marker.label} 위치`} aria-disabled={!canEdit || busy}
          onPointerDown={e => { if (!canEdit || busy || draw) return; e.stopPropagation(); e.preventDefault(); setSelected(marker.id); gesture.current = { pointer: e.pointerId, marker: marker.id }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onKeyDown={e => { if (!canEdit || busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault(); setSelected(marker.id); setMarkers(old => old.map(m => m.id === marker.id ? { ...m, x: Math.max(25, Math.min(475, m.x + (e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0))), y: Math.max(30, Math.min(470, m.y + (e.key === 'ArrowDown' ? 5 : e.key === 'ArrowUp' ? -5 : 0))) } : m)); setDirty(true); }}
          style={{ cursor: canEdit ? 'grab' : 'default' }}>
          <circle cx={marker.x} cy={marker.y} r="23" fill={selected === marker.id ? '#2563eb' : '#0f172a'} stroke="#93c5fd" strokeWidth="2" />
          <text x={marker.x} y={marker.y+5} textAnchor="middle" fill="white" fontSize="14" fontWeight="800" pointerEvents="none">{marker.id}</text>
          <text x={marker.x} y={marker.y+38} textAnchor="middle" fill="#f1f5f9" fontSize="13" pointerEvents="none">{marker.player || marker.label}</text>
        </g>)}
      </svg>
      <section style={{ ...ui.card, marginTop: 16 }}>
        {canEdit ? <>
          <label style={{ fontSize: 13 }}>작전 이름<input aria-label="작전 이름" maxLength={60} value={title} disabled={busy} onChange={e => { setTitle(e.target.value); setDirty(true); }} placeholder="예: 무사 1루 번트 수비" style={{ ...ui.input, margin: '6px 0 12px' }} /></label>
          <label style={{ fontSize: 13 }}>{current?.label} 이름<input aria-label="선택한 포지션 이름" list="tactics-roster" maxLength={15} value={current?.player || ''} disabled={busy} onChange={e => { setMarkers(old => old.map(m => m.id === selected ? { ...m, player: e.target.value } : m)); setDirty(true); }} placeholder="선수 이름 (선택)" style={{ ...ui.input, margin: '6px 0 12px' }} /><datalist id="tactics-roster">{roster.map(name => <option key={name} value={name} />)}</datalist></label>
          <label style={{ fontSize: 13 }}>작전 설명<textarea aria-label="작전 설명" value={notes} maxLength={1000} disabled={busy} onChange={e => { setNotes(e.target.value); setDirty(true); }} rows={3} placeholder="각 포지션의 움직임을 적어 주세요." style={{ ...ui.input, margin: '6px 0 12px', resize: 'vertical' }} /></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button disabled={busy} onClick={save} style={ui.primary}>{busy ? '저장 중…' : '작전 저장'}</button><button disabled={busy} onClick={fresh} style={ui.button}>새 작전</button><button disabled={busy} onClick={() => { setMarkers(initial()); setArrows([]); setDirty(true); }} style={ui.button}>배치 초기화</button>{id && <button disabled={busy} onClick={remove} style={{ ...ui.button, color: '#fca5a5' }}>작전 삭제</button>}</div>
          {dirty && <p style={{ color: '#fbbf24', fontSize: 12 }}>저장하지 않은 변경 사항이 있어요.</p>}
        </> : <><h2 style={{ fontSize: 17 }}>{title || '아직 저장된 작전이 없어요'}</h2><p style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: 14 }}>{notes}</p></>}
        {message && <p role="status" style={{ color: '#86efac', fontSize: 13 }}>{message}</p>}
      </section>
    </>}
  </FeaturePage>;
}
