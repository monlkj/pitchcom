'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const MENUS = [
  { href: '/signal', emoji: '⚡', label: '신호 전송', desc: '구종 선택 → 이어폰으로 전달', color: '#3b82f6' },
  { href: '/stats', emoji: '📊', label: '투구 통계', desc: '구종별 기록 및 분석', color: '#10b981' },
  { href: '/team', emoji: '👥', label: '팀/선수 관리', desc: '팀과 선수 등록 관리', color: '#f59e0b' },
  { href: '/messages', emoji: '💬', label: '팀 메시지', desc: '팀원끼리 실시간 대화', color: '#8b5cf6' },
];

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState('');
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
    setSessionId(session.id ?? '');
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
    const users = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    if (userRole === 'coach' || userRole === 'player') {
      const managerExists = users.find((u: any) => u.teamCode === code && u.role === 'manager');
      if (!managerExists) { setCodeError('존재하지 않는 팀 코드예요'); return; }
    }
    if (userRole === 'manager' && !teamCode) {
      const codeExists = users.find((u: any) => u.teamCode === code && u.role === 'manager');
      if (codeExists) { setCodeError('이미 사용 중인 팀 코드예요'); return; }
    }
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) return;
    const session = JSON.parse(raw);
    session.teamCode = code;
    localStorage.setItem('pitchcom-session', JSON.stringify(session));
    const updated = users.map((u: any) => u.id === session.id ? { ...u, teamCode: code } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    setTeamCode(code);
    setEditingCode(false);
    setNewCode('');
    setCodeError('');
  };

  if (!ready) return null;

  const roleLabel = userRole === 'manager' ? '🧢 감독' : userRole === 'coach' ? '📋 코치' : '⚾ 선수';

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .menu-card:hover { transform: translateY(-4px); }
        .menu-card { transition: transform 0.2s; }
        input:focus { border-color: #3b82f6 !important; outline: none; }
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
                {roleLabel}{teamCode ? ` · ${teamCode}` : ''}
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

          {/* ── 팀 코드 없을 때: 설정 카드 ── */}
          {!teamCode ? (
            <div style={{ marginBottom: 24, padding: '20px 20px', borderRadius: 18, background: '#1e293b', border: '1.5px solid #3b82f644' }}>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>
                {userRole === 'manager' ? '🧢 팀 코드를 만드세요' : '📨 팀 코드를 입력하세요'}
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569' }}>
                {userRole === 'manager'
                  ? '팀원들이 이 코드로 합류해요'
                  : '감독님에게 팀 코드를 받아서 입력하세요'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={newCode}
                  onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError(''); }}
                  onKeyDown={e => e.key === 'Enter' && saveCode()}
                  placeholder={userRole === 'manager' ? '예: LIONS2026' : '팀 코드 입력'}
                  autoFocus
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 12,
                    border: '1.5px solid #334155', background: '#0f172a',
                    color: '#f8fafc', fontSize: 16, fontWeight: 800, letterSpacing: 1,
                    transition: 'border-color 0.2s',
                  }}
                />
                <button onClick={saveCode} style={{
                  padding: '12px 20px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                }}>
                  {userRole === 'manager' ? '만들기' : '합류'}
                </button>
              </div>
              {codeError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>⚠️ {codeError}</p>}
            </div>
          ) : (
            /* ── 팀 코드 있을 때: 표시/변경 ── */
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
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{roleLabel} · 팀 코드</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa', letterSpacing: 1 }}>{teamCode}</div>
                  </div>
                  <button onClick={() => { setEditingCode(true); setNewCode(teamCode); }} style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    변경
                  </button>
                </div>
              )}
            </div>
          )}

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

          {/* 감독 전용 관리 버튼 */}
          {userRole === 'manager' && (
            <button
              className="menu-card"
              onClick={() => router.push('/admin')}
              style={{
                marginTop: 8, padding: '18px 22px', borderRadius: 20,
                border: '1.5px solid #ef444422',
                background: 'linear-gradient(135deg, #ef444411, #ef444406)',
                color: '#f8fafc', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 18, width: '100%',
                boxShadow: '0 4px 24px #ef444411',
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🛡️</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>감독 관리</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>멤버 확인 및 계정 관리</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 18 }}>›</span>
            </button>
          )}

          {/* 계정 삭제 (감독/코치 전용) */}
          {(userRole === 'manager' || userRole === 'coach') && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
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
