'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Player { id: string; name: string; number: string; position: string[]; }
interface Team { id: string; name: string; players: Player[]; }
interface Formation { id: string; name: string; slots: Record<string, string>; }

const POS_KEYS = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', 'DH'];

const POS_COORDS: Record<string, [number, number]> = {
  '투수':  [280, 232],
  '포수':  [280, 358],
  '1루수': [388, 258],
  '2루수': [336, 166],
  '3루수': [172, 258],
  '유격수':[224, 166],
  '좌익수':[118, 82],
  '중견수':[280, 54],
  '우익수':[442, 82],
};

const POS_ABBR: Record<string, string> = {
  '투수':'P','포수':'C','1루수':'1B','2루수':'2B',
  '3루수':'3B','유격수':'SS','좌익수':'LF','중견수':'CF','우익수':'RF',
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
          if (rf.length > 0) { setActiveFormationId(rf[0].id); setSlots(rf[0].slots); }
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
      saveFormations(formations.map(f => f.id === activeFormationId ? { ...f, slots: next } : f));
    }
  };

  const removeSlot = (pos: string) => {
    const next = { ...slots };
    delete next[pos];
    setSlots(next);
    if (activeFormationId) {
      saveFormations(formations.map(f => f.id === activeFormationId ? { ...f, slots: next } : f));
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
  const filledCount = POS_KEYS.filter(p => slots[p]).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', padding: '0 0 32px', maxWidth: 560, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ padding: '20px 16px 12px', background: 'linear-gradient(180deg, #0f172a 0%, #0b1120 100%)', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>수비 포지션</h1>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {filledCount}/9 배치됨 {slots['DH'] ? '+ DH' : ''}
            </div>
          </div>
        </div>

        {/* 배형 탭 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {formations.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button onClick={() => selectFormation(f)} style={{
                padding: '6px 14px', borderRadius: 20,
                border: activeFormationId === f.id ? '1.5px solid #3b82f6' : '1.5px solid #1e293b',
                background: activeFormationId === f.id ? '#1e3a5f' : '#1e293b',
                color: activeFormationId === f.id ? '#60a5fa' : '#64748b',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{f.name}</button>
              {canEdit && activeFormationId === f.id && (
                <button onClick={() => deleteFormation(f.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 15, cursor: 'pointer', padding: '0 2px' }}>×</button>
              )}
            </div>
          ))}
          {canEdit && (savingForm ? (
            <div style={{ display: 'flex', gap: 5 }}>
              <input autoFocus value={newFormName} onChange={e => setNewFormName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFormation()} placeholder="배형 이름"
                style={{ padding: '6px 12px', borderRadius: 10, border: '1.5px solid #3b82f6', background: '#0f172a', color: '#f8fafc', fontSize: 12, outline: 'none', width: 90 }} />
              <button onClick={addFormation} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
              <button onClick={() => { setSavingForm(false); setNewFormName(''); }} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>취소</button>
            </div>
          ) : (
            <button onClick={() => setSavingForm(true)} style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1.5px dashed #334155', background: 'transparent',
              color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ 배형 추가</button>
          ))}
        </div>
      </div>

      {/* 야구장 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid #1e3a5f', boxShadow: '0 0 40px #0a1628' }}>
          <svg viewBox="0 0 560 410" style={{ width: '100%', display: 'block' }}>
            <defs>
              <radialGradient id="grassGrad" cx="50%" cy="60%" r="60%">
                <stop offset="0%" stopColor="#1a5c2a" />
                <stop offset="100%" stopColor="#0d3a18" />
              </radialGradient>
              <radialGradient id="dirtGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7a5030" />
                <stop offset="100%" stopColor="#5a3820" />
              </radialGradient>
            </defs>

            {/* 배경 잔디 */}
            <rect width="560" height="410" fill="#0d3a18" />
            <ellipse cx="280" cy="240" rx="245" ry="215" fill="url(#grassGrad)" />

            {/* 파울 라인 */}
            <line x1="280" y1="358" x2="60" y2="10" stroke="#ffffff28" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="280" y1="358" x2="500" y2="10" stroke="#ffffff28" strokeWidth="1.5" strokeDasharray="6 4" />

            {/* 외야 잔디 줄무늬 */}
            {[0.35, 0.55, 0.75].map((r, i) => (
              <ellipse key={i} cx="280" cy="240" rx={245 * r} ry={215 * r} fill="none" stroke="#ffffff06" strokeWidth="18" />
            ))}

            {/* 내야 흙 */}
            <polygon points="280,358 390,248 280,138 170,248" fill="url(#dirtGrad)" />

            {/* 내야 원 (마운드 주변) */}
            <circle cx="280" cy="248" r="72" fill="none" stroke="#ffffff10" strokeWidth="1" />

            {/* 베이스 라인 */}
            <line x1="280" y1="358" x2="390" y2="248" stroke="#ffffff30" strokeWidth="1.5" />
            <line x1="390" y1="248" x2="280" y2="138" stroke="#ffffff30" strokeWidth="1.5" />
            <line x1="280" y1="138" x2="170" y2="248" stroke="#ffffff30" strokeWidth="1.5" />
            <line x1="170" y1="248" x2="280" y2="358" stroke="#ffffff30" strokeWidth="1.5" />

            {/* 베이스 */}
            {[['280','138'],['390','248'],['170','248']].map(([x,y], i) => (
              <rect key={i} x={+x-6} y={+y-6} width="12" height="12" rx="2" fill="#fff" opacity="0.9" transform={`rotate(45,${x},${y})`} />
            ))}
            {/* 홈플레이트 */}
            <polygon points="280,368 272,358 280,350 288,358" fill="#fff" opacity="0.9" />

            {/* 투수판 */}
            <rect x="273" y="228" width="14" height="7" rx="2" fill="#ffffffaa" />

            {/* 포지션 노드 */}
            {POS_KEYS.filter(p => p !== 'DH').map(pos => {
              const [cx, cy] = POS_COORDS[pos];
              const player = playerInSlot(pos);
              const isActive = pickingPos === pos;
              const abbr = POS_ABBR[pos];
              return (
                <g key={pos} onClick={() => canEdit && setPickingPos(isActive ? '' : pos)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  {/* 글로우 */}
                  {isActive && <circle cx={cx} cy={cy} r="34" fill="#3b82f620" />}
                  {/* 배경 원 */}
                  <circle cx={cx} cy={cy} r="26"
                    fill={isActive ? '#1e3a5f' : player ? '#0f2a4a' : '#00000050'}
                    stroke={isActive ? '#60a5fa' : player ? '#3b82f688' : '#ffffff22'}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {player ? (
                    <>
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="#93c5fd" fontSize="11" fontWeight="800">#{player.number || '?'}</text>
                      <text x={cx} y={cy + 8} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="800">
                        {player.name.length > 3 ? player.name.slice(0, 3) : player.name}
                      </text>
                    </>
                  ) : (
                    <>
                      <text x={cx} y={cy - 2} textAnchor="middle" fill="#ffffff50" fontSize="11" fontWeight="700">{abbr}</text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fill="#ffffff30" fontSize="9">{pos}</text>
                    </>
                  )}
                  {/* 삭제 버튼 */}
                  {canEdit && player && (
                    <g onClick={ev => { ev.stopPropagation(); removeSlot(pos); }}>
                      <circle cx={cx + 20} cy={cy - 20} r="9" fill="#ef4444cc" />
                      <text x={cx + 20} y={cy - 16} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* DH 슬롯 */}
        <div style={{ marginTop: 12, background: '#1e293b', borderRadius: 14, padding: '12px 16px', border: slots['DH'] ? '1.5px solid #3b82f644' : '1.5px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b' }}>DH</span>
          </div>
          {playerInSlot('DH') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#93c5fd' }}>
                #{playerInSlot('DH')!.number || '?'}
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', flex: 1 }}>{playerInSlot('DH')!.name}</span>
              {canEdit && (
                <button onClick={() => removeSlot('DH')} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#ef444422', color: '#ef4444', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              )}
            </div>
          ) : (
            <button onClick={() => canEdit && setPickingPos(pickingPos === 'DH' ? '' : 'DH')}
              style={{ flex: 1, padding: '8px 0', background: 'transparent', border: 'none', color: canEdit ? (pickingPos === 'DH' ? '#60a5fa' : '#475569') : '#334155', fontSize: 14, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', textAlign: 'left' }}>
              {canEdit ? (pickingPos === 'DH' ? '▲ 지정타자 선택 중...' : '+ 지정타자(DH) 배치') : '지정타자 없음'}
            </button>
          )}
        </div>

        {/* 선수 선택 패널 */}
        {pickingPos && canEdit && (
          <div style={{ marginTop: 12, background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #3b82f644' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e3a5f' }}>
              <div>
                <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>{pickingPos}</span>
                <span style={{ fontSize: 12, color: '#60a5fa' }}> 포지션 선수 선택</span>
              </div>
              <button onClick={() => setPickingPos('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            {allPlayers.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>먼저 팀에 선수를 추가해주세요</div>
            ) : allPlayers.map((p, i) => {
              const alreadyAt = POS_KEYS.find(pos => slots[pos] === p.id);
              return (
                <div key={p.id} onClick={() => assignPlayer(p.id)}
                  style={{ padding: '11px 16px', borderBottom: i < allPlayers.length - 1 ? '1px solid #0f172a' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: alreadyAt ? 0.4 : 1, background: alreadyAt ? '#0f172a' : 'transparent', transition: 'background 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#60a5fa', border: '1px solid #1e3a5f' }}>
                    #{p.number || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')}</div>
                  </div>
                  {alreadyAt ? (
                    <span style={{ fontSize: 11, background: '#1e3a5f', color: '#60a5fa', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{alreadyAt}</span>
                  ) : (
                    <span style={{ fontSize: 18, color: '#334155' }}>+</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {formations.length === 0 && !savingForm && canEdit && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🗺️</div>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>배형을 추가해서 수비 배치를 만들어보세요</p>
            <button onClick={() => setSavingForm(true)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ 첫 배형 만들기</button>
          </div>
        )}
      </div>
    </div>
  );
}
