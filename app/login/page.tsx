'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TEAM_PASSWORD = 'pitchcom1234';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!password) { setError('비밀번호를 입력해주세요'); return; }
    setLoading(true);
    setTimeout(() => {
      if (password === TEAM_PASSWORD) {
        localStorage.setItem('pitchcom-auth', 'true');
        router.push('/');
      } else {
        setError('비밀번호가 틀렸어요');
        setLoading(false);
      }
    }, 300);
  };

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-10deg); }
          50% { transform: translateY(-18px) rotate(10deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(5deg); }
          50% { transform: translateY(-12px) rotate(-5deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #475569; }
        input:focus { border-color: #3b82f6 !important; outline: none; }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59,130,246,0.4); }
        .submit-btn:active { transform: translateY(0); }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 40%, #0c1a3a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', overflow: 'hidden',
      }}>

        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '8%', left: '6%', fontSize: 80, opacity: 0.06, animation: 'float 6s ease-in-out infinite' }}>⚾</div>
          <div style={{ position: 'absolute', top: '20%', right: '8%', fontSize: 56, opacity: 0.05, animation: 'float2 5s ease-in-out infinite' }}>⚾</div>
          <div style={{ position: 'absolute', bottom: '15%', left: '12%', fontSize: 48, opacity: 0.04, animation: 'float 7s ease-in-out infinite 1s' }}>⚾</div>
          <div style={{ position: 'absolute', bottom: '8%', right: '10%', fontSize: 72, opacity: 0.05, animation: 'float2 8s ease-in-out infinite 0.5s' }}>⚾</div>
          <div style={{ position: 'absolute', top: -120, left: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' }} />
        </div>

        <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn 0.5s ease-out', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, margin: '0 auto 16px',
              boxShadow: '0 12px 40px rgba(59,130,246,0.35)',
            }}>⚾</div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: -1, color: '#f8fafc' }}>PitchCom</h1>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>야구 실시간 투구 신호 시스템</p>
          </div>

          <div style={{
            background: 'rgba(30,41,59,0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.07)',
            padding: '32px 28px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>로그인</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoFocus
                style={{
                  width: '100%', padding: '15px 16px', borderRadius: 12,
                  border: `1.5px solid ${error ? '#ef4444' : '#1e3a5f'}`,
                  background: '#0f172a', color: '#f8fafc', fontSize: 16,
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
              />

              {error && (
                <div style={{
                  padding: '11px 14px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', fontSize: 13, fontWeight: 600,
                }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                className="submit-btn"
                onClick={handleLogin}
                disabled={loading}
                style={{
                  padding: '15px', borderRadius: 13, border: 'none',
                  background: loading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: '#fff', fontSize: 16, fontWeight: 900,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? '확인 중...' : '입장하기 →'}
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#334155' }}>
            ⚾ KBO 디지털 피치컴 시스템
          </p>
        </div>
      </div>
    </>
  );
}
