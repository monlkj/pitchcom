'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f43f5e'];

interface Pitcher { id: string; name: string; pitches: string[]; }

function speak(text: string) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 0.85; u.volume = 1;
  window.speechSynthesis.speak(u);
}

export default function SignalPage() {
  const router = useRouter();
  const [pitchers, setPitchers] = useState<Pitcher[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingPitcher, setAddingPitcher] = useState(false);
  const [newPitcherName, setNewPitcherName] = useState('');
  const [newPitchName, setNewPitchName] = useState('');
  const [pendingPitch, setPendingPitch] = useState('');
  const [lastPitch, setLastPitch] = useState('');
  const [flash, setFlash] = useState(false);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [recorded, setRecorded] = useState<'strike'|'ball'|null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-pitchers-v2');
    if (raw) {
      const data = JSON.parse(raw) as Pitcher[];
      setPitchers(data);
      if (data.length > 0) setSelectedId(data[0].id);
    }
  }, []);

  const save = (next: Pitcher[]) => {
    setPitchers(next);
    localStorage.setItem('pitchcom-pitchers-v2', JSON.stringify(next));
  };

  const addPitcher = () => {
    const name = newPitcherName.trim();
    if (!name) return;
    const p: Pitcher = { id: Date.now().toString(), name, pitches: [] };
    const next = [...pitchers, p];
    save(next);
    setSelectedId(p.id);
    setNewPitcherName('');
    setAddingPitcher(false);
    setDropdownOpen(false);
    setEditMode(true);
  };

  const removePitcher = (id: string) => {
    const next = pitchers.filter(p => p.id !== id);
    save(next);
    setSelectedId(next[0]?.id ?? '');
    setEditMode(false);
  };

  const addPitch = () => {
    const name = newPitchName.trim();
    if (!name) return;
    const next = pitchers.map(p =>
      p.id === selectedId ? { ...p, pitches: [...p.pitches, name] } : p
    );
    save(next);
    setNewPitchName('');
  };

  const removePitch = (pitch: string) => {
    const next = pitchers.map(p =>
      p.id === selectedId ? { ...p, pitches: p.pitches.filter(x => x !== pitch) } : p
    );
    save(next);
  };

  // 사인 전송 — TTS만 재생, 기록 안 함
  const sendSignal = (pitch: string) => {
    speak(pitch);
    setPendingPitch(pitch);
    setRecorded(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };

  // 투구 완료 — 스트라이크/볼 선택 대기
  const confirmPitch = () => {
    if (!pendingPitch) return;
    setAwaitingResult(true);
  };

  // 스트라이크 or 볼 선택 후 기록
  const recordResult = (result: 'strike' | 'ball') => {
    const raw = localStorage.getItem('pitchcom-stats');
    const stats = raw ? JSON.parse(raw) : [];
    const pitcher = pitchers.find(p => p.id === selectedId);
    stats.push({ pitch: pendingPitch, pitcher: pitcher?.name ?? '', result, date: new Date().toISOString().slice(0, 10), time: Date.now() });
    localStorage.setItem('pitchcom-stats', JSON.stringify(stats));
    setLastPitch(pendingPitch);
    setPendingPitch('');
    setAwaitingResult(false);
    setRecorded(result);
    setTimeout(() => setRecorded(null), 1500);
  };

  const current = pitchers.find(p => p.id === selectedId);
  const pitchColor = (i: number) => COLORS[i % COLORS.length];
  const pendingColor = current ? COLORS[(current.pitches.indexOf(pendingPitch)) % COLORS.length] : '#3b82f6';

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>⚡ 신호 전송</h1>
        {current && (
          <button onClick={() => setEditMode(e => !e)} style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 10,
            border: `1.5px solid ${editMode ? '#3b82f6' : '#334155'}`,
            background: editMode ? '#1d4ed822' : 'transparent',
            color: editMode ? '#60a5fa' : '#64748b',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {editMode ? '✅ 완료' : '✏️ 편집'}
          </button>
        )}
      </div>

      {/* 투수 드롭다운 */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <button onClick={() => { setDropdownOpen(o => !o); setAddingPitcher(false); }} style={{
          width: '100%', padding: '14px 18px', borderRadius: 14,
          border: `2px solid ${dropdownOpen ? '#3b82f6' : '#1e293b'}`,
          background: '#1e293b', color: '#f8fafc',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{current?.name || '투수를 선택하세요'}</span>
          <span style={{ fontSize: 12, color: '#64748b', transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#1e293b', borderRadius: 14, border: '1.5px solid #334155',
            zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {pitchers.map(p => (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setDropdownOpen(false); setEditMode(false); }} style={{
                padding: '14px 18px', cursor: 'pointer',
                background: selectedId === p.id ? '#1d4ed8' : 'transparent',
                color: '#f8fafc', borderBottom: '1px solid #0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{p.pitches.join(' · ') || '구종 없음'}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removePitcher(p.id); }}
                  style={{ background: '#334155', border: 'none', color: '#94a3b8', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
            ))}
            {addingPitcher ? (
              <div style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                <input autoFocus value={newPitcherName} onChange={e => setNewPitcherName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPitcher()}
                  placeholder="투수 이름"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none' }} />
                <button onClick={addPitcher} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            ) : (
              <div onClick={() => setAddingPitcher(true)}
                style={{ padding: '13px 18px', cursor: 'pointer', color: '#60a5fa', fontSize: 14, fontWeight: 700 }}>+ 투수 추가</div>
            )}
          </div>
        )}
      </div>

      {/* 편집 모드 */}
      {editMode && current && (
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '16px', marginBottom: 14 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{current.name}의 구종</p>

          {/* 기존 구종 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {current.pitches.map((pitch, i) => (
              <div key={pitch} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 12,
                background: '#0f172a', border: `1.5px solid ${pitchColor(i)}44`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: pitchColor(i), flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{pitch}</span>
                </div>
                <button onClick={() => removePitch(pitch)} style={{
                  background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: '2px 6px',
                }}>×</button>
              </div>
            ))}
          </div>

          {/* 구종 추가 입력 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newPitchName}
              onChange={e => setNewPitchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPitch()}
              placeholder="구종 이름 입력 (예: 빠른직구, 낙차커브)"
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 11,
                border: '1.5px solid #334155', background: '#0f172a',
                color: '#f8fafc', fontSize: 14, outline: 'none',
              }}
            />
            <button onClick={addPitch} style={{
              padding: '11px 16px', borderRadius: 11, border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>추가</button>
          </div>
        </div>
      )}

      {/* 사인 상태 + 완료 버튼 */}
      {!editMode && (
        <div style={{ marginBottom: 16 }}>
          {/* 현재 사인 */}
          <div style={{
            borderRadius: 16, padding: '16px 20px', textAlign: 'center',
            background: flash ? `${pendingColor}22` : '#1e293b',
            border: `2px solid ${pendingPitch ? pendingColor : '#334155'}`,
            transition: 'all 0.2s', minHeight: 68,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: pendingPitch ? 10 : 0,
          }}>
            {recorded ? (
              <div style={{ color: recorded === 'strike' ? '#ef4444' : '#3b82f6', fontSize: 16, fontWeight: 800 }}>
                {recorded === 'strike' ? '🔥 스트라이크!' : '💧 볼!'} 기록 완료
              </div>
            ) : pendingPitch ? (
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>현재 사인 (미기록)</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: pendingColor }}>● {pendingPitch}</div>
              </div>
            ) : lastPitch ? (
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>마지막 기록</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>● {lastPitch}</div>
              </div>
            ) : (
              <span style={{ color: '#334155', fontSize: 14 }}>구종 버튼을 누르면 이어폰으로 전달됩니다</span>
            )}
          </div>

          {/* 투구 완료 버튼 */}
          {pendingPitch && !awaitingResult && (
            <button onClick={confirmPitch} style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #15803d)',
              color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
            }}>
              ✅ 투구 완료 — 기록하기
            </button>
          )}

          {/* 스트라이크 / 볼 선택 */}
          {awaitingResult && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => recordResult('strike')} style={{
                flex: 1, padding: '18px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                color: '#fff', fontSize: 17, fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
              }}>🔥 스트라이크</button>
              <button onClick={() => recordResult('ball')} style={{
                flex: 1, padding: '18px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff', fontSize: 17, fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}>💧 볼</button>
            </div>
          )}
        </div>
      )}

      {/* 구종 버튼 */}
      {!editMode && (
        current?.pitches && current.pitches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {current.pitches.map((pitch, i) => (
              <button key={pitch} onClick={() => sendSignal(pitch)} style={{
                padding: '22px 14px', borderRadius: 16,
                border: `2px solid ${lastPitch === pitch ? pitchColor(i) : '#1e293b'}`,
                background: lastPitch === pitch ? `${pitchColor(i)}22` : '#1e293b',
                color: '#f8fafc', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: pitchColor(i), flexShrink: 0 }} />
                <span style={{ fontSize: 17, fontWeight: 800 }}>{pitch}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              {current ? '✏️ 편집 버튼을 눌러 구종을 추가하세요' : '투수를 먼저 선택해주세요'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
