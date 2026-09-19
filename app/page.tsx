'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const MENUS = [
  { href: '/signal', emoji: '⚡', label: '신호 전송', desc: '구종 선택 → 이어폰으로 전달', color: '#3b82f6' },
  { href: '/stats', emoji: '📊', label: '투구 통계', desc: '구종별 기록 및 분석', color: '#10b981' },
  { href: '/team', emoji: '👥', label: '팀/선수 관리', desc: '팀과 선수 등록 관리', color: '#f59e0b' },
];

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [teamCode, setTeamCode] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    setUserName(session.name ?? '');
    setUserRole(session.role ?? '');
    setTeamCode(session.teamCode ?? '');
    setReady(true);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('pitchcom-session');
    router.push('/login');
  };

  if (!ready) return null;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .menu-card:hover { transform: translateY(-4px); }
        .menu-card { transition: transform 0.2s; }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #0c1a3a 100%)', padding: '0 0 40px' }}>

        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>⚾</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>PitchCom</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{userName}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                {userRole === 'manager' ? '🧢 감독' : '📋 코치'} · {teamCode}
              </div>
            </div>
            <button onClick={logout} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              로그아웃
            </button>
          </div>
        </div>

        <div style={{ padding: '36px 24px', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#f8fafc' }}>무엇을 할까요?</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {MENUS.map((m, i) => (
              <button
                key={m.href}
                className="menu-card"
                onClick={() => router.push(m.href)}
                style={{
                  padding: '24px 22px', borderRadius: 20,
                  border: `1.5px solid ${m.color}22`,
                  background: `linear-gradient(135deg, ${m.color}11, ${m.color}06)`,
                  color: '#f8fafc', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 18,
                  animation: `fadeUp 0.4s ease-out ${i * 0.08}s both`,
                  boxShadow: `0 4px 24px ${m.color}11`,
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: `${m.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {m.emoji}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{m.desc}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
