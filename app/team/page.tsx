'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Player { id: string; name: string; number: string; position: string[]; }
interface Team { id: string; name: string; players: Player[]; }
interface BatStats { pa: number; ab: number; h: number; d: number; t: number; hr: number; bb: number; hbp: number; rbi: number; r: number; so: number; }
interface PitStats { ip: number; ha: number; er: number; bb: number; k: number; hbp: number; hr: number; }
type AllBat = Record<string, BatStats>;
type AllPit = Record<string, PitStats>;

const POSITIONS = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', 'DH'];
const TABS = ['선수 관리', '타자 기록', '투수 기록', '타순', '로테이션'] as const;
const EMPTY_BAT: BatStats = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, rbi: 0, r: 0, so: 0 };
const EMPTY_PIT: PitStats = { ip: 0, ha: 0, er: 0, bb: 0, k: 0, hbp: 0, hr: 0 };

const fmt = (n: number, d = 3) => isNaN(n) || !isFinite(n) ? '—' : n.toFixed(d).replace(/^0\./, '.');
const fmt2 = (n: number) => fmt(n, 2);

function calcBat(s: BatStats) {
  const avg = s.ab > 0 ? s.h / s.ab : NaN;
  const obp = s.pa > 0 ? (s.h + s.bb + s.hbp) / s.pa : NaN;
  const slg = s.ab > 0 ? (s.h + s.d + 2 * s.t + 3 * s.hr) / s.ab : NaN;
  const kpct = s.pa > 0 ? s.so / s.pa : NaN;
  return { avg, obp, slg, ops: obp + slg, kpct };
}

function calcPit(s: PitStats) {
  const era = s.ip > 0 ? (s.er * 9) / s.ip : NaN;
  const whip = s.ip > 0 ? (s.bb + s.ha) / s.ip : NaN;
  const kper9 = s.ip > 0 ? (s.k * 9) / s.ip : NaN;
  const bbhbpPerIp = s.ip > 0 ? (s.bb + s.hbp) * 9 / s.ip : NaN;
  const kbb = s.ip > 0 ? (s.k - s.bb) * 9 / s.ip : NaN;
  return { era, whip, kper9, bbhbpPerIp, kbb };
}

export default function TeamPage() {
  const router = useRouter();
  const [isManager, setIsManager] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<typeof TABS[number]>('선수 관리');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState<{ name: string; number: string; position: string[] }>({ name: '', number: '', position: [] });
  const [allBat, setAllBat] = useState<AllBat>({});
  const [allPit, setAllPit] = useState<AllPit>({});
  const [editingId, setEditingId] = useState('');
  const [batForm, setBatForm] = useState<BatStats>(EMPTY_BAT);
  const [pitForm, setPitForm] = useState<PitStats>(EMPTY_PIT);
  const [lineups, setLineups] = useState<Record<string, string[]>>({});
  const [rotations, setRotations] = useState<Record<string, string[]>>({});
  const [pickingSlot, setPickingSlot] = useState<{ type: 'lineup'|'rotation'; idx: number } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    setIsManager(session.role === 'manager');
    const code = session.teamCode ?? '';
    setTeamCode(code);

    // localStorage 캐시 우선 표시
    const t = JSON.parse(localStorage.getItem('pitchcom-teams') || '[]') as Team[];
    setTeams(t);
    if (t.length > 0) setSelectedTeam(t[0].id);
    setAllBat(JSON.parse(localStorage.getItem('pitchcom-bat-stats') || '{}'));
    setAllPit(JSON.parse(localStorage.getItem('pitchcom-pit-stats') || '{}'));
    setLineups(JSON.parse(localStorage.getItem('pitchcom-lineups') || '{}'));
    setRotations(JSON.parse(localStorage.getItem('pitchcom-rotations') || '{}'));

    // Supabase에서 최신 팀 데이터 동기화
    if (code) {
      setSyncing(true);
      Promise.all([
        syncRead(code, 'teams'),
        syncRead(code, 'bat-stats'),
        syncRead(code, 'pit-stats'),
        syncRead(code, 'lineups'),
        syncRead(code, 'rotations'),
      ]).then(([rTeams, rBat, rPit, rLineups, rRotations]) => {
        setSyncing(false);
        if (rTeams && Array.isArray(rTeams) && rTeams.length > 0) {
          setTeams(rTeams); setSelectedTeam(rTeams[0].id);
          localStorage.setItem('pitchcom-teams', JSON.stringify(rTeams));
        }
        if (rBat) { setAllBat(rBat); localStorage.setItem('pitchcom-bat-stats', JSON.stringify(rBat)); }
        if (rPit) { setAllPit(rPit); localStorage.setItem('pitchcom-pit-stats', JSON.stringify(rPit)); }
        if (rLineups) { setLineups(rLineups); localStorage.setItem('pitchcom-lineups', JSON.stringify(rLineups)); }
        if (rRotations) { setRotations(rRotations); localStorage.setItem('pitchcom-rotations', JSON.stringify(rRotations)); }
      });
    }
  }, [router]);

  const saveTeams = (next: Team[]) => { setTeams(next); localStorage.setItem('pitchcom-teams', JSON.stringify(next)); syncWrite(teamCode, 'teams', next); };
  const saveBat = (next: AllBat) => { setAllBat(next); localStorage.setItem('pitchcom-bat-stats', JSON.stringify(next)); syncWrite(teamCode, 'bat-stats', next); };
  const savePit = (next: AllPit) => { setAllPit(next); localStorage.setItem('pitchcom-pit-stats', JSON.stringify(next)); syncWrite(teamCode, 'pit-stats', next); };

  const addTeam = () => {
    const name = newTeamName.trim(); if (!name) return;
    const next = [...teams, { id: Date.now().toString(), name, players: [] }];
    saveTeams(next); setSelectedTeam(next[next.length - 1].id); setNewTeamName(''); setAddingTeam(false);
  };
  const removeTeam = (id: string) => {
    if (!confirm('팀을 삭제할까요?')) return;
    const next = teams.filter(t => t.id !== id);
    saveTeams(next); setSelectedTeam(next[0]?.id ?? '');
  };
  const addPlayer = () => {
    if (!playerForm.name.trim()) return;
    const p = { id: Date.now().toString(), ...playerForm, name: playerForm.name.trim() };
    saveTeams(teams.map(t => t.id === selectedTeam ? { ...t, players: [...t.players, p] } : t));
    setPlayerForm({ name: '', number: '', position: [] }); setAddingPlayer(false);
  };
  const saveEditPlayer = () => {
    if (!editingPlayer || !playerForm.name.trim()) return;
    saveTeams(teams.map(t => t.id === selectedTeam
      ? { ...t, players: t.players.map(p => p.id === editingPlayer.id ? { ...p, ...playerForm, name: playerForm.name.trim() } : p) }
      : t));
    setEditingPlayer(null);
  };
  const removePlayer = (pid: string) => {
    saveTeams(teams.map(t => t.id === selectedTeam ? { ...t, players: t.players.filter(p => p.id !== pid) } : t));
  };
  const currentTeam = teams.find(t => t.id === selectedTeam);
  const allPlayers = teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })));

  const bf = (k: keyof BatStats, v: string) => setBatForm(f => ({ ...f, [k]: Math.max(0, parseInt(v) || 0) }));
  const pf = (k: keyof PitStats, v: string) => setPitForm(f => ({ ...f, [k]: k === 'ip' ? Math.max(0, parseFloat(v) || 0) : Math.max(0, parseInt(v) || 0) }));

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>👥 팀/선수 관리</h1>
        {syncing && <span style={{ fontSize: 11, color: '#3b82f6' }}>동기화 중...</span>}
        {!isManager && !syncing && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', background: '#1e293b', padding: '4px 10px', borderRadius: 20 }}>읽기 전용</span>}
      </div>

      <div style={{ display: 'flex', background: '#1e293b', borderRadius: 14, padding: 4, marginBottom: 20, gap: 3, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setEditingId(''); setPickingSlot(null); }} style={{
            flex: '1 1 0', padding: '9px 4px', borderRadius: 10, border: 'none',
            background: tab === t ? '#3b82f6' : 'transparent',
            color: tab === t ? '#fff' : '#64748b',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
          }}>{t}</button>
        ))}
      </div>

      {/* ─── 선수 관리 ─── */}
      {tab === '선수 관리' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
            {teams.map(t => (
              <button key={t.id} onClick={() => setSelectedTeam(t.id)} style={{
                padding: '9px 16px', borderRadius: 20, border: 'none',
                background: selectedTeam === t.id ? '#3b82f6' : '#1e293b',
                color: selectedTeam === t.id ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.name}
                {isManager && (
                  <span onClick={e => { e.stopPropagation(); removeTeam(t.id); }} style={{ fontSize: 13, color: selectedTeam === t.id ? 'rgba(255,255,255,0.5)' : '#475569' }}>×</span>
                )}
              </button>
            ))}
            {isManager && (addingTeam ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTeam()} placeholder="팀 이름"
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#1e293b', color: '#f8fafc', fontSize: 13, outline: 'none', width: 100 }} />
                <button onClick={addTeam} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            ) : (
              <button onClick={() => setAddingTeam(true)} style={{ padding: '9px 14px', borderRadius: 20, border: '1.5px dashed #334155', background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ 팀</button>
            ))}
          </div>

          {currentTeam ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>선수 {currentTeam.players.length}명</span>
                {isManager && (
                  <button onClick={() => { setAddingPlayer(true); setEditingPlayer(null); setPlayerForm({ name: '', number: '', position: [] }); }}
                    style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ 선수 추가</button>
                )}
              </div>

              {isManager && addingPlayer && (
                <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={playerForm.number} onChange={e => setPlayerForm(f => ({ ...f, number: e.target.value }))} placeholder="번호"
                      style={{ width: 60, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none' }} />
                    <input value={playerForm.name} onChange={e => setPlayerForm(f => ({ ...f, name: e.target.value }))} placeholder="이름"
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {POSITIONS.map(pos => {
                      const on = playerForm.position.includes(pos);
                      return <button key={pos} type="button" onClick={() => setPlayerForm(f => ({ ...f, position: on ? f.position.filter(x => x !== pos) : [...f.position, pos] }))} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${on ? '#10b981' : '#334155'}`, background: on ? '#065f46' : 'transparent', color: on ? '#6ee7b7' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{pos}</button>;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addPlayer} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>추가</button>
                    <button onClick={() => setAddingPlayer(false)} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              )}

              {isManager && editingPlayer && (
                <div style={{ background: '#1e3a5f', borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>선수 정보 수정</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={playerForm.number} onChange={e => setPlayerForm(f => ({ ...f, number: e.target.value }))} placeholder="번호"
                      style={{ width: 60, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #1e40af', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none' }} />
                    <input value={playerForm.name} onChange={e => setPlayerForm(f => ({ ...f, name: e.target.value }))} placeholder="이름"
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #1e40af', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {POSITIONS.map(pos => {
                      const on = playerForm.position.includes(pos);
                      return <button key={pos} type="button" onClick={() => setPlayerForm(f => ({ ...f, position: on ? f.position.filter(x => x !== pos) : [...f.position, pos] }))} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${on ? '#3b82f6' : '#1e40af'}`, background: on ? '#1e3a8a' : 'transparent', color: on ? '#93c5fd' : '#4b6ead', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{pos}</button>;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEditPlayer} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                    <button onClick={() => setEditingPlayer(null)} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              )}

              {currentTeam.players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}><p style={{ margin: 0 }}>{isManager ? '선수를 추가해보세요' : '등록된 선수가 없어요'}</p></div>
              ) : (
                <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
                  {currentTeam.players.map((p, i) => (
                    <div key={p.id} style={{ padding: '14px 18px', borderBottom: i < currentTeam.players.length - 1 ? '1px solid #0f172a' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')}</div>
                      </div>
                      {isManager && (
                        <>
                          <button onClick={() => { setEditingPlayer(p); setAddingPlayer(false); setPlayerForm({ name: p.name, number: p.number, position: Array.isArray(p.position) ? p.position : [p.position] }); }}
                            style={{ background: 'none', border: '1px solid #334155', borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer', padding: '5px 10px' }}>수정</button>
                          <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer' }}>🗑️</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}><p>{isManager ? '팀을 먼저 추가해주세요' : '등록된 팀이 없어요'}</p></div>
          )}
        </>
      )}

      {/* ─── 타자 기록 ─── */}
      {tab === '타자 기록' && (
        <>
          {allPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏏</div>
              <p style={{ margin: 0 }}>선수 관리 탭에서 선수를 먼저 추가해주세요</p>
            </div>
          ) : allPlayers.map(p => {
            const s = allBat[p.id] ?? EMPTY_BAT;
            const c = calcBat(s);
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #0f172a' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')} · {p.teamName}</div>
                  </div>
                  {isManager && (
                    <button onClick={() => { if (isEditing) { setEditingId(''); } else { setEditingId(p.id); setBatForm(allBat[p.id] ?? { ...EMPTY_BAT }); } }} style={{
                      padding: '7px 14px', borderRadius: 9, border: `1px solid ${isEditing ? '#334155' : '#3b82f6'}`,
                      background: isEditing ? 'transparent' : '#1e3a5f', color: isEditing ? '#64748b' : '#60a5fa',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{isEditing ? '닫기' : '입력'}</button>
                  )}
                </div>

                {isManager && isEditing && (
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #0f172a', background: '#0f1e35' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                      {([['타석','pa'],['타수','ab'],['안타','h'],['볼넷','bb'],['2루타','d'],['3루타','t'],['홈런','hr'],['사구','hbp'],['타점','rbi'],['득점','r'],['삼진','so']] as [string, keyof BatStats][]).map(([label, key]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{label}</label>
                          <input type="number" min="0" value={batForm[key]} onChange={e => bf(key, e.target.value)}
                            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', width: '100%' }} />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { saveBat({ ...allBat, [p.id]: batForm }); setEditingId(''); }}
                      style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  </div>
                )}

                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[['타석',s.pa],['타수',s.ab],['안타',s.h],['2루타',s.d],['3루타',s.t],['홈런',s.hr],['볼넷',s.bb],['사구',s.hbp],['타점',s.rbi],['득점',s.r],['삼진',s.so]].map(([label, val]) => (
                      <div key={label as string} style={{ background: '#0f172a', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 44 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>{val as number}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{label as string}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {[['타율',fmt(c.avg),'#f8fafc'],['출루율',fmt(c.obp),'#22c55e'],['장타율',fmt(c.slg),'#f59e0b'],['OPS',fmt(c.ops),'#a78bfa'],['K%',fmt(c.kpct),'#ef4444']].map(([label, val, color]) => (
                      <div key={label as string} style={{ background: '#0f172a', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: color as string }}>{val as string}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{label as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ─── 투수 기록 ─── */}
      {tab === '투수 기록' && (
        <>
          {allPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚾</div>
              <p style={{ margin: 0 }}>선수 관리 탭에서 선수를 먼저 추가해주세요</p>
            </div>
          ) : allPlayers.map(p => {
            const s = allPit[p.id] ?? EMPTY_PIT;
            const c = calcPit(s);
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #0f172a' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')} · {p.teamName}</div>
                  </div>
                  {isManager && (
                    <button onClick={() => { if (isEditing) { setEditingId(''); } else { setEditingId(p.id); setPitForm(allPit[p.id] ?? { ...EMPTY_PIT }); } }} style={{
                      padding: '7px 14px', borderRadius: 9, border: `1px solid ${isEditing ? '#334155' : '#f97316'}`,
                      background: isEditing ? 'transparent' : '#1c1107', color: isEditing ? '#64748b' : '#fb923c',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{isEditing ? '닫기' : '입력'}</button>
                  )}
                </div>

                {isManager && isEditing && (
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #0f172a', background: '#0f1e35' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      {([['이닝(IP)','ip'],['피안타','ha'],['자책점','er'],['볼넷','bb'],['탈삼진','k'],['사구','hbp'],['피홈런','hr']] as [string, keyof PitStats][]).map(([label, key]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{label}</label>
                          <input type="number" min="0" step={key === 'ip' ? '0.1' : '1'} value={pitForm[key]} onChange={e => pf(key, e.target.value)}
                            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', width: '100%' }} />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { savePit({ ...allPit, [p.id]: pitForm }); setEditingId(''); }}
                      style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  </div>
                )}

                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[['이닝',s.ip],['피안타',s.ha],['자책점',s.er],['볼넷',s.bb],['탈삼진',s.k],['사구',s.hbp],['피홈런',s.hr]].map(([label, val]) => (
                      <div key={label as string} style={{ background: '#0f172a', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 48 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>{typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(1) : val as number}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{label as string}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {[['ERA',fmt2(c.era),'#ef4444'],['K-BB/9',fmt2(c.kbb),'#22c55e'],['WHIP',fmt2(c.whip),'#f97316'],['K/9',fmt2(c.kper9),'#60a5fa'],['(BB+HBP)/9',fmt2(c.bbhbpPerIp),'#a78bfa']].map(([label, val, color]) => (
                      <div key={label as string} style={{ background: '#0f172a', borderRadius: 10, padding: '12px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: color as string }}>{val as string}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ─── 타순 ─── */}
      {tab === '타순' && (() => {
        const teamPlayers = currentTeam?.players ?? [];
        const lineup: string[] = lineups[selectedTeam] ?? Array(9).fill('');
        const saveLineup = (next: string[]) => {
          const n = { ...lineups, [selectedTeam]: next };
          setLineups(n); localStorage.setItem('pitchcom-lineups', JSON.stringify(n)); syncWrite(teamCode, 'lineups', n);
        };
        const assignPlayer = (pid: string) => {
          if (!pickingSlot || pickingSlot.type !== 'lineup') return;
          const next = [...lineup]; next[pickingSlot.idx] = pid;
          saveLineup(next); setPickingSlot(null);
        };
        const clearSlot = (idx: number) => {
          const next = [...lineup]; next[idx] = '';
          saveLineup(next);
        };
        return (
          <>
            {!currentTeam ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}><p>팀을 먼저 선택해주세요</p></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                  {teams.map(t => (
                    <button key={t.id} onClick={() => { setSelectedTeam(t.id); setPickingSlot(null); }} style={{
                      padding: '8px 14px', borderRadius: 20, border: 'none',
                      background: selectedTeam === t.id ? '#3b82f6' : '#1e293b',
                      color: selectedTeam === t.id ? '#fff' : '#94a3b8',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>{t.name}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: pickingSlot?.type === 'lineup' ? 16 : 0 }}>
                  {Array.from({ length: 9 }, (_, i) => {
                    const pid = lineup[i];
                    const player = teamPlayers.find(p => p.id === pid);
                    const isActive = pickingSlot?.type === 'lineup' && pickingSlot.idx === i;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#60a5fa', flexShrink: 0 }}>{i + 1}</div>
                        <button onClick={() => isManager && setPickingSlot(isActive ? null : { type: 'lineup', idx: i })} style={{
                          flex: 1, padding: '12px 16px', borderRadius: 12, border: `2px solid ${isActive ? '#3b82f6' : player ? '#1e293b' : '#334155'}`,
                          background: isActive ? '#1e3a5f' : player ? '#1e293b' : 'transparent',
                          color: player ? '#f8fafc' : '#475569', cursor: isManager ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        }}>
                          {player ? (
                            <>
                              <span style={{ fontSize: 12, color: '#64748b', minWidth: 20 }}>#{player.number || '—'}</span>
                              <span style={{ fontSize: 15, fontWeight: 700 }}>{player.name}</span>
                              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>{player.position}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: 13 }}>{isManager ? '탭하여 선수 선택' : '—'}</span>
                          )}
                        </button>
                        {isManager && player && <button onClick={() => clearSlot(i)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}>×</button>}
                      </div>
                    );
                  })}
                </div>

                {isManager && pickingSlot?.type === 'lineup' && (
                  <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f172a' }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>{pickingSlot.idx + 1}번 타순 선수 선택</p>
                    </div>
                    {teamPlayers.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>선수 관리 탭에서 선수를 먼저 추가해주세요</div>
                    ) : teamPlayers.map((p, i) => (
                      <div key={p.id} onClick={() => assignPlayer(p.id)} style={{
                        padding: '12px 16px', borderBottom: i < teamPlayers.length - 1 ? '1px solid #0f172a' : 'none',
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        background: lineup.includes(p.id) ? '#0f172a' : 'transparent',
                        opacity: lineup.includes(p.id) ? 0.4 : 1,
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{(Array.isArray(p.position) ? p.position : [p.position]).join(' · ')}</div>
                        </div>
                        {lineup.includes(p.id) && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>{lineup.indexOf(p.id) + 1}번 배치됨</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}

      {/* ─── 로테이션 ─── */}
      {tab === '로테이션' && (() => {
        const teamPlayers = currentTeam?.players ?? [];
        const pitchers = teamPlayers.filter(p => (Array.isArray(p.position) ? p.position : [p.position]).includes('투수'));
        const rotation: string[] = rotations[selectedTeam] ?? Array(6).fill('');
        const saveRotation = (next: string[]) => {
          const n = { ...rotations, [selectedTeam]: next };
          setRotations(n); localStorage.setItem('pitchcom-rotations', JSON.stringify(n)); syncWrite(teamCode, 'rotations', n);
        };
        const assignPitcher = (pid: string) => {
          if (!pickingSlot || pickingSlot.type !== 'rotation') return;
          const next = [...rotation]; next[pickingSlot.idx] = pid;
          saveRotation(next); setPickingSlot(null);
        };
        const clearSlot = (idx: number) => {
          const next = [...rotation]; next[idx] = '';
          saveRotation(next);
        };
        const SLOT_LABELS = ['1선발', '2선발', '3선발', '4선발', '5선발', '불펜/마무리'];
        const SLOT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#64748b'];
        return (
          <>
            {!currentTeam ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}><p>팀을 먼저 선택해주세요</p></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                  {teams.map(t => (
                    <button key={t.id} onClick={() => { setSelectedTeam(t.id); setPickingSlot(null); }} style={{
                      padding: '8px 14px', borderRadius: 20, border: 'none',
                      background: selectedTeam === t.id ? '#3b82f6' : '#1e293b',
                      color: selectedTeam === t.id ? '#fff' : '#94a3b8',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>{t.name}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {SLOT_LABELS.map((label, i) => {
                    const pid = rotation[i];
                    const player = teamPlayers.find(p => p.id === pid);
                    const isActive = pickingSlot?.type === 'rotation' && pickingSlot.idx === i;
                    const color = SLOT_COLORS[i];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 64, fontSize: 11, fontWeight: 800, color, textAlign: 'center', flexShrink: 0 }}>{label}</div>
                        <button onClick={() => isManager && setPickingSlot(isActive ? null : { type: 'rotation', idx: i })} style={{
                          flex: 1, padding: '13px 16px', borderRadius: 12, border: `2px solid ${isActive ? color : player ? `${color}44` : '#334155'}`,
                          background: isActive ? `${color}22` : player ? `${color}11` : 'transparent',
                          color: player ? '#f8fafc' : '#475569', cursor: isManager ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        }}>
                          {player ? (
                            <>
                              <span style={{ fontSize: 12, color: '#64748b', minWidth: 20 }}>#{player.number || '—'}</span>
                              <span style={{ fontSize: 15, fontWeight: 700 }}>{player.name}</span>
                              {allPit[player.id] && <span style={{ fontSize: 11, color, marginLeft: 'auto' }}>ERA {fmt2(calcPit(allPit[player.id]).era)}</span>}
                            </>
                          ) : (
                            <span style={{ fontSize: 13 }}>{isManager ? '탭하여 투수 선택' : '—'}</span>
                          )}
                        </button>
                        {isManager && player && <button onClick={() => clearSlot(i)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}>×</button>}
                      </div>
                    );
                  })}
                </div>

                {isManager && pickingSlot?.type === 'rotation' && (
                  <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f172a' }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#fb923c', fontWeight: 700 }}>{SLOT_LABELS[pickingSlot.idx]} 선택</p>
                    </div>
                    {pitchers.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>포지션이 '투수'인 선수를 먼저 추가해주세요</div>
                    ) : pitchers.map((p, i) => {
                      const ps = allPit[p.id];
                      const pc = ps ? calcPit(ps) : null;
                      return (
                        <div key={p.id} onClick={() => assignPitcher(p.id)} style={{
                          padding: '12px 16px', borderBottom: i < pitchers.length - 1 ? '1px solid #0f172a' : 'none',
                          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                          background: rotation.includes(p.id) ? '#0f172a' : 'transparent',
                          opacity: rotation.includes(p.id) ? 0.4 : 1,
                        }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#94a3b8' }}>{p.number || '—'}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                            {pc && <div style={{ fontSize: 11, color: '#64748b' }}>ERA {fmt2(pc.era)} · WHIP {fmt2(pc.whip)} · K/9 {fmt2(pc.kper9)}</div>}
                          </div>
                          {rotation.includes(p.id) && <span style={{ fontSize: 11, color: '#475569' }}>{SLOT_LABELS[rotation.indexOf(p.id)]}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
