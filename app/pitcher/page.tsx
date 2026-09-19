'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Suspense } from 'react';

const PITCH_COLORS: Record<string, string> = {
  직구: '#ef4444', 투심: '#f97316', 커브: '#eab308', 슬라이더: '#22c55e',
  체인지업: '#3b82f6', 포크볼: '#8b5cf6', 싱커: '#06b6d4', 커터: '#ec4899',
};
const PITCH_EMOJIS: Record<string, string> = {
  직구: '🔴', 투심: '🟠', 커브: '🟡', 슬라이더: '🟢',
  체인지업: '🔵', 포크볼: '🟣', 싱커: '🩵', 커터: '🩷',
};

function PitcherContent() {
  const params = useSearchParams();
  const room = params.get('room') || 'DEFAULT';

  const [myName, setMyName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [registered, setRegistered] = useState(false);

  const [signal, setSignal] = useState<{ pitch: string; location: string; pitcher: string; time: number } | null>(null);
  const [history, setHistory] = useState<Array<{ pitch: string; location: string; pitcher: string; time: number }>>([]);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!registered) return;

    const channel = supabase
      .channel(`pitchcom-${room}`)
      .on('broadcast', { event: 'pitch' }, ({ payload }) => {
        if (payload.pitcher && payload.pitcher !== myName) return;
        setSignal(payload);
        setHistory(prev => [payload, ...prev].slice(0, 10));
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
        // 음성으로 읽기
        const utter = new SpeechSynthesisUtterance(payload.pitch);
        utter.lang = 'ko-KR';
        utter.rate = 0.9;
        utter.volume = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      })
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => { channel.unsubscribe(); };
  }, [registered, myName, room]);

  const register = () => {
    const name = nameInput.trim();
    if (!name) return;
    setMyName(name);
    setRegistered(true);
  };

  const color = signal ? (PITCH_COLORS[signal.pitch] ?? '#94a3b8') : '#1e293b';

  if (!registered) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>⚾</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>투수 등록</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>방 코드: {room}</p>
        </div>
        <div style={{
          background: '#1e293b', borderRadius: 20, padding: '28px 28px',
          width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>내 이름 입력</label>
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && register()}
            placeholder="예: 홍길동"
            style={{
              padding: '13px 16px', borderRadius: 12,
              border: '1.5px solid #334155', background: '#0f172a',
              color: '#f8fafc', fontSize: 16, fontWeight: 700, outline: 'none',
            }}
          />
          <button
            onClick={register}
            style={{
              padding: '15px', borderRadius: 13, border: 'none',
              background: 'linear-gradient(135deg, #10b981, #047857)',
              color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            }}
          >
            ⚾ 입장하기
          </button>
        </div>
        <a href="/" style={{ color: '#475569', fontSize: 13, textDecoration: 'none' }}>← 홈으로</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 22 }}>←</a>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>⚾ {myName} 투수</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>방 코드: {room}</p>
        </div>
        <div style={{
          marginLeft: 'auto', padding: '5px 12px', borderRadius: 20,
          background: connected ? '#064e3b' : '#1e293b',
          color: connected ? '#22c55e' : '#64748b',
          fontSize: 12, fontWeight: 700,
          border: `1px solid ${connected ? '#22c55e' : '#334155'}`,
        }}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </div>
      </div>

      <div style={{
        borderRadius: 24, padding: '48px 32px', textAlign: 'center',
        background: flash ? `${color}33` : '#1e293b',
        border: `3px solid ${signal ? color : '#334155'}`,
        marginBottom: 24, transition: 'all 0.2s',
        minHeight: 220, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {signal ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 8 }}>{PITCH_EMOJIS[signal.pitch] ?? '⚾'}</div>
            <div style={{ fontSize: 52, fontWeight: 900, color, lineHeight: 1 }}>{signal.pitch}</div>
            {signal.location && (
              <div style={{
                marginTop: 12, padding: '6px 18px', borderRadius: 20,
                background: '#0f172a', color: '#94a3b8', fontSize: 16, fontWeight: 700,
              }}>
                {signal.location}
              </div>
            )}
            <div style={{ marginTop: 16, fontSize: 11, color: '#475569' }}>
              {new Date(signal.time).toLocaleTimeString('ko-KR')}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
            <p style={{ margin: 0, color: '#475569', fontSize: 16, fontWeight: 600 }}>
              포수의 신호를 기다리는 중...
            </p>
          </>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #334155' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 700 }}>최근 신호 기록</p>
          </div>
          {history.map((h, i) => (
            <div key={h.time} style={{
              padding: '12px 18px',
              borderBottom: i < history.length - 1 ? '1px solid #0f172a' : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: 1 - i * 0.08,
            }}>
              <span style={{ fontSize: 20 }}>{PITCH_EMOJIS[h.pitch] ?? '⚾'}</span>
              <span style={{ fontWeight: 800, color: PITCH_COLORS[h.pitch] ?? '#f8fafc' }}>{h.pitch}</span>
              {h.location && <span style={{ color: '#64748b', fontSize: 13 }}>{h.location}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
                {new Date(h.time).toLocaleTimeString('ko-KR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PitcherPage() {
  return <Suspense><PitcherContent /></Suspense>;
}
