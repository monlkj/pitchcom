'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Player { id: string; name: string; number: string; position: string[]; }
interface Team { id: string; name: string; players: Player[]; }
interface Formation { id: string; name: string; slots: Record<string, string>; } // posKey → playerId

const POS_KEYS = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', 'DH'];

// SVG 좌표 (560x480 뷰박스 기준)
const POS_COORDS: Record<string, [number, number]> = {
  '투수': [280, 230],
  '포수': [280, 360],
  '1루수': [390, 260],
  '2루수': [340, 170],
  '3루수': [170, 260],
  '유격수': [220, 170],
  '좌익수': [120, 80],
  '중견수': [280, 55],
  '우익수': [440, 80],
  'DH': [500, 380],
};

export default function FieldPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [activeFormationId, setActiveFormationId] = useState('');
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [pickingPos, setPickingPos] = useState('');
  const [newFormName, setNewFormName] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  const canEdit = role === 'manager' || role === 'coach';
  const allPlayers: Player[] = teams.flatMap(t => t.players);

  const activeFormation = formations.find(f => f.id === activeFormationId);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const s = JSON.parse(raw);
    setRole(s.role ?? '');
    setTeamCode(s.teamCode ?? '');

    const t = JSON.parse(localStorage.getItem('pitchcom-teams') || '[]') as Team[];
    setTeams(t);
    const f = JSON.parse(localStorage.getItem('pitchcom-formations') || '[]') as Formation[];
    setFormations(f);
    if (f.length > 0) { setActiveFormationId(f[0].id); setSlots(f[0].slots); }

    if (s.teamCode) {
      Promise.all([syncRead(s.teamCode, 'teams'), syncRead(s.teamCode, 'field-formations')]).then(([rt, rf]) => {
        if (Array.isArray(rt)) { setTeams(rt); localStorage.setItem('pitchcom-teams', JSON.stringify(rt)); }
        if (Array.isArray(rf)) {
          setFormations(rf); localStorage.setItem('pitchcom-formations', JSON.stringify(rf));
          if (rf.length > 0 && !activeFormationId) { setActiveFormationId(rf[0].id); setSlots(rf[0].slots); }
        }
      });
    }
  }, [router]);

  const saveFormations = async (next: Formation[]) => {
    setFormations(next);
    localStorage.setItem('pitchcom-formations', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'field-formations', next);
  };

  const assignPlayer = (pid: string) => {
    if (!pickingPos || !canEdit) return;
    const next = { ...slots, [pickingPos]: pid };
    setSlots(next);
    setPickingPos('');
    if (activeFormationId) {
      const nextForms = formations.map(f => f.id === activeFormationId ? { ...f, slots: next } : f);
      saveFormations(nextForms);
    }
  };

  const removeSlot = (pos: string) => {
    const next = { ...slots };
    delete next[pos];
    setSlots(next);
    if (activeFormationId) {
      const nextForms = formations.map(f => f.id === activeFormationId ? { ...f, slots: next } : f);
      saveFormations(nextForms);
    }
  };

  const addFormation = async () => {
    if (!newFormName.trim()) return;
    const nf: Formation = { id: Date.now().toString(), name: newFormName.trim(), slots: {} };
    const next = [...formations, nf];
    await saveFormations(next);
    setActiveFormationId(nf.id);
    setSlots({});
    setNewFormName('');
    setSavingForm(false);
  };

  const deleteFormation = async (id: string) => {
    if (!confirm('이 배형을 삭제할까요?')) return;
    const next = formations.filter(f => f.id !== id);
    await saveFormations(next);
    if (activeFormationId === id) {
      setActiveFormationId(next[0]?.id ?? '');
      setSlots(next[0]?.slots ?? {});
    }
  };

  const selectFormation = (f: Formation) => {
    setActiveFormationId(f.id);
    setSlots(f.slots);
    setPickingPos('');
  };

  const playerInSlot = (pos: string) => allPlayers.find(p => p.id === slots[pos]);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>🗺️ 수비 포지션</h1>
      </div>

      {/* 배형 선택 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {formations.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => selectFormation(f)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: activeFormationId === f.id ? '#3b82f6' : '#1e293b', color: activeFormationId === f.id ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{f.name}</button>
            {canEdit && <span onClick={() => deleteFormation(f.id)} style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>×</span>}
          </div>
        ))}
        {canEdit && (savingForm ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input autoFocus value={newFormName} onChange={e => setNewFormName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFormation()} placeholder="배형 이름"
              style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#1e293b', color: '#f8fafc', fontSize: 13, outline: 'none', width: 100 }} />
            <button onClick={addFormation} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
          </div>
        ) : (
          <button onClick={() => setSavingForm(true)} style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px dashed #334155', background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ 배형</button>
        ))}
      </div>

      {/* 야구장 SVG */}
      <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <svg viewBox="0 0 560 420" style={{ width: '100%' }}>
          {/* 외야 잔디 */}
          <ellipse cx="280" cy="220" rx="230" ry="200" fill="#134e1c" />
          {/* 내야 흙 */}
          <polygon points="280,350 390,240 280,130 170,240" fill="#8b5e3c" />
          {/* 파울 라인 */}
          <line x1="280" y1="350" x2="80" y2="20" stroke="#ffffff44" strokeWidth="1.5" />
          <line x1="280" y1="350" x2="480" y2="20" stroke="#ffffff44" strokeWidth="1.5" />
          {/* 베이스 */}
          {[['280','130'],['390','240'],['280','350'],['170','240']].map(([x,y], i) => (
            <rect key={i} x={+x-7} y={+y-7} width="14" height="14" rx="2" fill={i === 2 ? '#1e293b' : '#fff'} transform={`rotate(45,${x},${y})`} />
          ))}
          {/* 투수판 */}
          <rect x="272" y="222" width="16" height="8" rx="2" fill="#fff8" />
          {/* 포지션 노드 */}
          {POS_KEYS.filter(p => p !== 'DH').map(pos => {
            const [cx, cy] = POS_COORDS[pos];
            const player = playerInSlot(pos);
            const isActive = pickingPos === pos;
            return (
              <g key={pos} onClick={() => canEdit && setPickingPos(isActive ? '' : pos)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                <circle cx={cx} cy={cy} r="22" fill={isActive ? '#3b82f6' : player ? '#1e3a5f' : '#0f172a88'} stroke={isActive ? '#60a5fa' : player ? '#3b82f6' : '#334155'} strokeWidth="1.5" />
                {player ? (
                  <>
                    <text x={cx} y={cy - 5} textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="700">#{player.number || '—'}</text>
                    <text x={cx} y={cy + 7} textAnchor="middle" fill="#93c5fd" fontSize="9">{player.name.length > 4 ? player.name.slice(0, 4) : player.name}</text>
                  </>
                ) : (
                  <text x={cx} y={cy + 4} textAnchor="middle" fill="#475569" fontSize="9">{pos}</text>
                )}
                {canEdit && player && (
                  <text x={cx + 16} y={cy - 14} fill="#ef4444" fontSize="13" style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); removeSlot(pos); }}>×</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* DH 슬롯 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e293b', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', minWidth: 36 }}>DH</span>
        {playerInSlot('DH') ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>#{playerInSlot('DH')!.number || '—'}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{playerInSlot('DH')!.name}</span>
            {canEdit && <button onClick={() => removeSlot('DH')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer', marginLeft: 'auto' }}>×</button>}
          </div>
        ) : (
          <button onClick={() => canEdit && setPickingPos(pickingPos === 'DH' ? '' : 'DH')} style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: `1.5px solid ${pickingPos === 'DH' ? '#3b82f6' : '#334155'}`, background: pickingPos === 'DH' ? '#1e3a5f' : 'transparent', color: '#475569', fontSize: 13, cursor: canEdit ? 'pointer' : 'default', textAlign: 'left' }}>
            {canEdit ? '탭하여 선수 선택' : '—'}
          </button>
        )}
      </div>

      {/* 선수 선택 패널 */}
      {pickingPos && canEdit && (
        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>{pickingPos} 선수 선택</p>
            <button onClick={() => setPickingPos('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          {allPlayers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>선수를 먼저 추가해주세요</div>
          ) : allPlayers.map((p, i) => {
            const alreadyAt = POS_KEYS.find(pos => slots[pos] === p.id);
            return (
              <div key={p.id} onClick={() => assignPlayer(p.id)} style={{ padding: '12px 16px', borderBottom: i < allPlayers.length - 1 ? '1px solid #0f172a' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: alreadyAt ? 0.45 : 1, background: alreadyAt ? '#0f172a' : 'transparent' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')}</div>
                </div>
                {alreadyAt && <span style={{ fontSize: 11, color: '#475569' }}>{alreadyAt}</span>}
              </div>
            );
          })}
        </div>
      )}

      {formations.length === 0 && canEdit && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗺️</div>
          <p style={{ margin: 0 }}>+ 배형 버튼으로 수비 배치를 만들어보세요</p>
        </div>
      )}
    </div>
  );
}
