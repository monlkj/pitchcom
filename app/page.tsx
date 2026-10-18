'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../lib/teamSync';
import { withoutDeletedAccounts } from '../lib/accountDeletion';
import { coachLabel } from '../lib/coachTypes';
import { migrateTeamCache } from '../lib/teamStorage';

const MENUS = [
  { href: '/speedgun', emoji: '⚾', label: '구속 측정', desc: '투구 영상으로 평균 구속 측정', color: '#22c55e' },
  { href: '/signal', emoji: '⚡', label: '신호 전송', desc: '구종 선택 → 이어폰으로 전달', color: '#3b82f6' },
  { href: '/team', emoji: '👥', label: '팀/선수 관리', desc: '팀과 선수 등록·기록 관리', color: '#f59e0b' },
  { href: '/stats', emoji: '📊', label: '투구 통계', desc: '타자·투수 기록 조회 및 분석', color: '#ef4444' },
  { href: '/calendar', emoji: '📅', label: '팀 달력', desc: '경기·훈련 일정 및 참석 관리', color: '#10b981' },
  { href: '/messages', emoji: '💬', label: '팀 메시지', desc: '채팅·공지·투표', color: '#8b5cf6' },
];

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [coachType, setCoachType] = useState('');
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [joinApproved, setJoinApproved] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const checkApprovalStatus = async (sessionId: string, code: string) => {
    const cloudUsers: any[] = (await syncRead('__global__', 'users')) ?? [];
    const me = cloudUsers.find((u: any) => u.id === sessionId);
    if (!me) return;
    const live = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
    if (live.id !== sessionId || live.teamCode !== code || (me.teamCode !== code && me.teamCode !== '') || me.joinRequestId !== live.joinRequestId) return;
    if (me.joinApproved === true) {
      const raw = localStorage.getItem('pitchcom-session')!;
      const session = JSON.parse(raw);
      session.joinApproved = true;
      localStorage.setItem('pitchcom-session', JSON.stringify(session));
      const localUsers: any[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
      const updated = localUsers.map((u: any) => u.id === sessionId ? { ...u, joinApproved: true } : u);
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      setJoinApproved(true);
    } else if (me.teamCode === '' && code) {
      // 거절됨 (teamCode 초기화)
      const raw = localStorage.getItem('pitchcom-session')!;
      const session = JSON.parse(raw);
      session.teamCode = ''; session.joinApproved = undefined;
      localStorage.setItem('pitchcom-session', JSON.stringify(session));
      setTeamCode(''); setJoinApproved(null);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    migrateTeamCache();
    setPendingCount(0);
    setUserName(session.name ?? '');
    setUserRole(session.role ?? '');
    setCoachType(coachLabel(session));
    setTeamCode(session.teamCode ?? '');
    setJoinApproved(session.joinApproved ?? null);
    setReady(true);
    // 감독: 가입 요청 수 확인
    if (session.role === 'manager' && session.teamCode) {
      syncRead(session.teamCode, 'join-requests').then((reqs: any) => {
        if (Array.isArray(reqs)) setPendingCount(reqs.filter((r: any) => r.status === 'pending').length);
      });
    }
    // 코치/선수가 대기 중이면 승인 여부 확인
    if ((session.role === 'coach' || session.role === 'player') && session.teamCode && session.joinApproved !== true) {
      checkApprovalStatus(session.id, session.teamCode);
    }
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

  const saveCode = async () => {
    const code = newCode.trim().toUpperCase();
    if (!code) { setCodeError('팀 코드를 입력해주세요'); return; }
    if (savingCode) return;
    setSavingCode(true);
    try {
      const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
      if (!session.id) return;
      if (session.teamCode === code) { setEditingCode(false); return; }
      const localUsers: any[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
      const cloud = await syncRead('__global__', 'users', true);
      const users: any[] = Array.isArray(cloud) ? [...cloud] : [...localUsers];
      for (const user of withoutDeletedAccounts(localUsers)) if (!users.some(u => u.id === user.id)) users.push(user);
      const me = users.find(u => u.id === session.id) ?? session;
      const isManager = session.role === 'manager';
      const managed = Array.from(new Set([...(me.managedTeamCodes ?? []), ...(isManager && session.teamCode ? [session.teamCode] : [])]));
      const owner = users.find(u => u.role === 'manager' && u.id !== session.id && (u.teamCode === code || u.managedTeamCodes?.includes(code)));
      if (!isManager && !users.some(u => u.role === 'manager' && (u.teamCode === code || u.managedTeamCodes?.includes(code)))) {
        setCodeError('존재하지 않는 팀 코드예요'); return;
      }
      if (isManager && owner) { setCodeError('다른 감독이 사용 중인 팀 코드예요'); return; }
      migrateTeamCache();
      const requestId = isManager ? undefined : crypto.randomUUID();
      const next = { ...me, ...session, teamCode: code, joinApproved: isManager, joinRequestId: requestId,
        ...(isManager ? { managedTeamCodes: Array.from(new Set([...managed, code])) } : {}) };
      const updated = users.filter(u => u.id !== session.id).concat(next);
      if (!isManager) {
        const requests: any[] = (await syncRead(code, 'join-requests')) ?? [];
        const request = { id: requestId, userId: session.id, userName: session.name, userRole: session.role, coachType: session.coachType, coachTypes: session.coachTypes, teamCode: code, status: 'pending', createdAt: new Date().toISOString() };
        await syncWrite(code, 'join-requests', requests.filter(r => r.userId !== session.id).concat(request), true);
      }
      await syncWrite('__global__', 'users', updated, true);
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      localStorage.setItem('pitchcom-session', JSON.stringify(next));
      // Remount pages so old team state and pending async callbacks cannot be reused.
      window.location.assign('/');
    } catch { setCodeError('팀 변경을 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.'); } finally { setSavingCode(false); }
  };

  if (!ready) return null;

  const roleLabel = userRole === 'manager' ? '🧢 감독' : userRole === 'coach' ? `📋 ${coachType || '코치'}` : '⚾ 선수';
  // 코치/선수이고 팀코드 없으면 팀코드 입력만 표시
  const needTeamCode = !teamCode && (userRole === 'coach' || userRole === 'player');
  // 대기 중 화면
  const isPending = (userRole === 'coach' || userRole === 'player') && teamCode && joinApproved !== true;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .menu-card:hover { transform: translateY(-4px); }
        .menu-card { transition: transform 0.2s; }
        input:focus { border-color: #3b82f6 !important; outline: none; }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #0c1a3a 100%)', padding: '0 0 40px' }}>

        {/* 헤더 */}
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

        {/* ── 가입 승인 대기 화면 ── */}
        {isPending ? (
          <div style={{ padding: '60px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⏳</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: '#f8fafc' }}>승인 대기 중</h2>
            <p style={{ margin: '0 0 6px', color: '#94a3b8', fontSize: 14 }}>감독님이 가입 요청을 검토하고 있어요</p>
            <p style={{ margin: '0 0 32px', color: '#475569', fontSize: 13 }}>팀 코드: <span style={{ color: '#60a5fa', fontWeight: 900 }}>{teamCode}</span></p>
            <button onClick={async () => {
              const raw = localStorage.getItem('pitchcom-session');
              if (raw) { const s = JSON.parse(raw); await checkApprovalStatus(s.id, s.teamCode); }
            }} style={{ padding: '13px 32px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', marginBottom: 14 }}>
              새로고침
            </button>
            <div>
              <button onClick={async () => {
                const raw = localStorage.getItem('pitchcom-session');
                if (!raw) return;
                const s = JSON.parse(raw);
                const users: any[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
                const updated = users.map((u: any) => u.id === s.id ? { ...u, teamCode: '', joinApproved: undefined } : u);
                localStorage.setItem('pitchcom-users', JSON.stringify(updated));
                s.teamCode = ''; s.joinApproved = undefined;
                localStorage.setItem('pitchcom-session', JSON.stringify(s));
                await syncWrite('__global__', 'users', updated);
                setTeamCode(''); setJoinApproved(null);
              }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer' }}>요청 취소하기</button>
            </div>
          </div>

        ) : /* ── 코치/선수 & 팀코드 없음: 홈 레이아웃 안에 팀코드 입력 카드만 ── */
        needTeamCode ? (
          <div style={{ padding: '36px 24px', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#f8fafc' }}>팀 코드 입력</h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>감독님께 받은 팀 코드를 입력하면 바로 시작할 수 있어요</p>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 20, padding: '24px 20px', border: '1px solid #334155' }}>
              <input
                value={newCode}
                onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveCode()}
                placeholder="팀 코드 입력"
                autoFocus
                style={{
                  width: '100%', padding: '16px', borderRadius: 12, boxSizing: 'border-box',
                  border: '1.5px solid #334155', background: '#0f172a',
                  color: '#f8fafc', fontSize: 20, fontWeight: 900, letterSpacing: 2,
                  textAlign: 'center', marginBottom: 12, transition: 'border-color 0.2s',
                }}
              />
              {codeError && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f87171', textAlign: 'center' }}>⚠️ {codeError}</p>}
              <button disabled={savingCode} onClick={saveCode} style={{
                width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
              }}>합류하기 →</button>
            </div>
          </div>
        ) : (
          /* ── 일반 홈 화면 ── */
          <div style={{ padding: '36px 24px', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#f8fafc' }}>무엇을 할까요?</h1>
            </div>

            {/* 감독 팀코드 설정 카드 */}
            {!teamCode && userRole === 'manager' && (
              <div style={{ marginBottom: 24, padding: '20px', borderRadius: 18, background: '#1e293b', border: '1.5px solid #3b82f644' }}>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>🧢 팀 코드를 만드세요</p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569' }}>팀원들이 이 코드로 합류해요</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newCode}
                    onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError(''); }}
                    onKeyDown={e => e.key === 'Enter' && saveCode()}
                    placeholder="예: LIONS2026"
                    autoFocus
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: 12,
                      border: '1.5px solid #334155', background: '#0f172a',
                      color: '#f8fafc', fontSize: 16, fontWeight: 800, letterSpacing: 1,
                      transition: 'border-color 0.2s',
                    }}
                  />
                  <button disabled={savingCode} onClick={saveCode} style={{
                    padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                  }}>만들기</button>
                </div>
                {codeError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>⚠️ {codeError}</p>}
              </div>
            )}

            {/* 팀코드 표시/변경 */}
            {teamCode && (
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
                      <button disabled={savingCode} onClick={saveCode} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>저장</button>
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

            {/* 메뉴 */}
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
                  border: pendingCount > 0 ? '1.5px solid #f59e0b44' : '1.5px solid #ef444422',
                  background: pendingCount > 0 ? 'linear-gradient(135deg, #f59e0b11, #f59e0b06)' : 'linear-gradient(135deg, #ef444411, #ef444406)',
                  color: '#f8fafc', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 18, width: '100%',
                  boxShadow: pendingCount > 0 ? '0 4px 24px #f59e0b22' : '0 4px 24px #ef444411',
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: pendingCount > 0 ? '#f59e0b22' : '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, position: 'relative' }}>
                  🛡️
                  {pendingCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>감독 관리</div>
                  <div style={{ fontSize: 13, color: pendingCount > 0 ? '#f59e0b' : '#64748b' }}>{pendingCount > 0 ? `가입 요청 ${pendingCount}건 대기 중` : '멤버 확인 및 계정 관리'}</div>
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
        )}
      </div>
    </>
  );
}
