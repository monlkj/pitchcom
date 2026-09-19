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
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (!session.teamCode) { router.push('/teamcode'); return; }
    setUserName(session.name ?? '');
    setUserRole(session.role ?? '');
    setTeamCode(session.teamCode ?? '');
    setReady(true);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('pitchcom-session');
    router.push('/login');
  };

  const deleteAccount = () => {
    if (!confirm('계정을 삭제하면 복구할 수 없어요. 정말 삭제할까요?')) return;
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) return;
    const session = JSON.parse(raw);
    const users = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    localStorage.setItem('pitchcom-users', JSON.stringify(users.filter((u: any) => u.id !== session.id)));
    localStorage.removeItem('pitchcom-session');
    router.push('/login');
  };

  const saveCode = () => {
    const code = newCode.trim().toUpperCase();
    if (!code) { setCodeError('팀 코드를 입력해주세요'); return; }
    if (userRole === 'coach') {
      try {
        const users = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
        const managerExists = users.find((u: any) => u.teamCode === code && u.role === 'manager');
        if (!managerExists) { setCodeError('존재하지 않는 팀 코드예요'); return; }
      } catch {}
    }
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) return;
    const session = JSON.parse(raw);
    session.teamCode = code;
    localStorage.setItem('pitchcom-session', JSON.stringify(session));
    const users = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const updated = users.map((u: any) => u.id === session.id ? { ...u, teamCode: code } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    setTeamCode(code);
    setEditingCode(false);
    setNewCode('');
    setCodeError('');
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

          {/* 팀 코드 */}
          <div style={{ marginBottom: 20, padding: '16px 18px', borderRadius: 16, background: '#1e293b', border: '1px solid #334155' }}>
            {editingCode ? (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>팀 코드 변경</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newCode}
                    onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError(''); }}
                    onKeyDown={e => e.key === 'Enter' && saveCode()}
                    placeholder="새 팀 코드"
                    autoFocus
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #3b82f6', background: '#0f172a', color: '#f8fafc', fontSize: 15, fontWeight: 800, letterSpacing: 1, outline: 'none' }}
                  />
                  <button onClick={saveCode} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => { setEditingCode(false); setCodeError(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>취소</button>
                </div>
                {codeError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>⚠️ {codeError}</p>}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{userRole === 'manager' ? '🧢 감독' : userRole === 'coach' ? '📋 코치' : '⚾ 선수'} · 팀 코드</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa', letterSpacing: 1 }}>{teamCode}</div>
                </div>
                <button onClick={() => { setEditingCode(true); setNewCode(teamCode); }} style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  변경
                </button>
              </div>
            )}
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

          {/* 계정 삭제 (감독/코치 전용) */}
          {(userRole === 'manager' || userRole === 'coach') && (
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <button onClick={deleteAccount} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #ef444433', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                계정 삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
