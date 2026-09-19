'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Suspense } from 'react';

const DEFAULT_PITCHES = [
  { label: '직구', sub: 'Fastball', color: '#ef4444', emoji: '🔴' },
  { label: '투심', sub: 'Two-Seam', color: '#f97316', emoji: '🟠' },
  { label: '커브', sub: 'Curveball', color: '#eab308', emoji: '🟡' },
  { label: '슬라이더', sub: 'Slider', color: '#22c55e', emoji: '🟢' },
  { label: '체인지업', sub: 'Changeup', color: '#3b82f6', emoji: '🔵' },
  { label: '포크볼', sub: 'Forkball', color: '#8b5cf6', emoji: '🟣' },
  { label: '싱커', sub: 'Sinker', color: '#06b6d4', emoji: '🩵' },
  { label: '커터', sub: 'Cutter', color: '#ec4899', emoji: '🩷' },
];

function CatcherContent() {
  const params = useSearchParams();
  const room = params.get('room') || 'DEFAULT';
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [pitchers, setPitchers] = useState<string[]>([]);
  const [selectedPitcher, setSelectedPitcher] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newPitcherInput, setNewPitcherInput] = useState('');
  const [addingPitcher, setAddingPitcher] = useState(false);

  const [selectedPitch, setSelectedPitch] = useState('');
  const [lastSent, setLastSent] = useState<{ pitch: string; pitcher: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`pitchcom-pitchers-${room}`);
    if (saved) {
      const list = JSON.parse(saved) as string[];
      setPitchers(list);
      if (list.length > 0) setSelectedPitcher(list[0]);
    }
    channelRef.current = supabase.channel(`pitchcom-${room}`);
    channelRef.current.subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [room]);

  const savePitchers = (list: string[]) => {
    localStorage.setItem(`pitchcom-pitchers-${room}`, JSON.stringify(list));
    setPitchers(list);
  };

  const addPitcher = () => {
    const name = newPitcherInput.trim();
    if (!name || pitchers.includes(name)) return;
    const next = [...pitchers, name];
    savePitchers(next);
    setSelectedPitcher(name);
    setNewPitcherInput('');
    setAddingPitcher(false);
    setDropdownOpen(false);
  };

  const sendSignal = async (pitch: string) => {
    if (sending) return;
    setSending(true);
    setSelectedPitch(pitch);
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'pitch',
      payload: { pitch, pitcher: selectedPitcher, time: Date.now() },
    });
    setLastSent({ pitch, pitcher: selectedPitcher });
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
    setSending(false);
  };

  const pitchColor = DEFAULT_PITCHES.find(p => p.label === lastSent?.pitch)?.color ?? '#3b82f6';

  return (
    <div style={{ minHeight: '100vh', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 22 }}>←</a>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🦺 포수 패널</h1>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569', background: '#1e293b', padding: '4px 10px', borderRadius: 10 }}>
          {room}
        </span>
      </div>

      {/* 투수 드롭다운 */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <button
          onClick={() => { setDropdownOpen(o => !o); setAddingPitcher(false); }}
          style={{
            width: '100%', padding: '14px 18px',
            borderRadius: 14, border: '2px solid #334155',
            background: '#1e293b', color: '#f8fafc',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>{selectedPitcher || '투수를 선택하세요'}</span>
          <span style={{ fontSize: 12, color: '#64748b', transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#1e293b', borderRadius: 14, border: '1.5px solid #334155',
            zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {pitchers.map(name => (
              <div
                key={name}
                onClick={() => { setSelectedPitcher(name); setDropdownOpen(false); }}
                style={{
                  padding: '14px 18px', cursor: 'pointer', fontSize: 15, fontWeight: 700,
                  background: selectedPitcher === name ? '#1d4ed8' : 'transparent',
                  color: '#f8fafc', borderBottom: '1px solid #0f172a',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                {name}
                {selectedPitcher === name && <span style={{ color: '#60a5fa' }}>✓</span>}
              </div>
            ))}

            {/* 투수 추가 */}
            {addingPitcher ? (
              <div style={{ padding: '12px 14px', display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newPitcherInput}
                  onChange={e => setNewPitcherInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPitcher()}
                  placeholder="투수 이름"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 9,
                    border: '1.5px solid #334155', background: '#0f172a',
                    color: '#f8fafc', fontSize: 14, outline: 'none',
                  }}
                />
                <button onClick={addPitcher} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            ) : (
              <div
                onClick={() => setAddingPitcher(true)}
                style={{ padding: '13px 18px', cursor: 'pointer', color: '#60a5fa', fontSize: 14, fontWeight: 700 }}
              >
                + 투수 추가
              </div>
            )}
          </div>
        )}
      </div>

      {/* 전송 결과 표시 */}
      <div style={{
        borderRadius: 16, padding: '18px 20px', marginBottom: 16,
        background: flash && lastSent ? `${pitchColor}22` : '#1e293b',
        border: `2px solid ${lastSent ? pitchColor : '#334155'}`,
        textAlign: 'center', minHeight: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        {lastSent ? (
          <div>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              {lastSent.pitcher && `${lastSent.pitcher} →`} 전송 완료
            </span>
            <div style={{ fontSize: 28, fontWeight: 900, color: pitchColor, marginTop: 2 }}>
              {DEFAULT_PITCHES.find(p => p.label === lastSent.pitch)?.emoji} {lastSent.pitch}
            </div>
          </div>
        ) : (
          <span style={{ color: '#475569', fontSize: 14 }}>구종을 선택하면 즉시 전송됩니다</span>
        )}
      </div>

      {/* 구종 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {DEFAULT_PITCHES.map(p => (
          <button
            key={p.label}
            onClick={() => sendSignal(p.label)}
            disabled={sending}
            style={{
              padding: '20px 14px', borderRadius: 16,
              border: `2.5px solid ${lastSent?.pitch === p.label ? p.color : '#1e293b'}`,
              background: lastSent?.pitch === p.label ? `${p.color}22` : '#1e293b',
              color: '#f8fafc', cursor: sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              transition: 'all 0.15s', opacity: sending ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: 26 }}>{p.emoji}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{p.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CatcherPage() {
  return <Suspense><CatcherContent /></Suspense>;
}
