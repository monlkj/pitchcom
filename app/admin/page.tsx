'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccountDeletionForm from './components/AccountDeletionForm';
import { markAccountsDeleted, withoutDeletedAccounts } from '../../lib/accountDeletion';
import { normalizedEmail, uniqueMembers } from '../../lib/memberIdentity';
import { COACH_TYPES, coachLabel, getCoachTypes } from '../../lib/coachTypes';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  coachType?: string;
  coachTypes?: string[];
  teamCode: string;
  joinApproved?: boolean;
  joinRequestId?: string;
}

interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  coachType?: string;
  coachTypes?: string[];
  teamCode: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  manager: '🧢 감독',
  coach: '📋 코치',
  player: '⚾ 선수',
};

export default function AdminPage() {
  const router = useRouter();
  const [kickingId, setKickingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [myId, setMyId] = useState('');
  const [myEmail, setMyEmail] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [editingCoach, setEditingCoach] = useState('');
  const [coachSelection, setCoachSelection] = useState<string[]>([]);
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [ready, setReady] = useState(false);

  const loadMembers = async (code: string) => {
    const local: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const cloud: Member[] = (await syncRead('__global__', 'users')) ?? [];
    const merged: Member[] = [...cloud];
    for (const user of local) {
      if (!merged.find(u => u.id === user.id || (normalizedEmail(user.email) && normalizedEmail(u.email) === normalizedEmail(user.email)))) merged.push(user);
    }
    localStorage.setItem('pitchcom-users', JSON.stringify(merged));
    const session = JSON.parse(localStorage.getItem('pitchcom-session') || '{}');
    setMembers(uniqueMembers(withoutDeletedAccounts(merged).filter(u => u.teamCode === code && u.joinApproved !== false), session.id));
    const reqs: JoinRequest[] = (await syncRead(code, 'join-requests')) ?? [];
    setJoinRequests(reqs.filter(r => r.status === 'pending' && merged.some(u => u.id === r.userId && u.teamCode === code && u.joinApproved === false && u.joinRequestId === r.id)));
  };

  const approveRequest = async (req: JoinRequest) => {
    const users: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const cloudUsers: Member[] = (await syncRead('__global__', 'users')) ?? [];
    const allUsers = [...cloudUsers];
    for (const u of users) { if (!allUsers.find(cu => cu.email === u.email)) allUsers.push(u); }
    const requester = allUsers.find(u => u.id === req.userId);
    const freshRequests: JoinRequest[] = (await syncRead(teamCode, 'join-requests')) ?? [];
    if (!requester || requester.teamCode !== teamCode || requester.joinRequestId !== req.id || !freshRequests.some(r => r.id === req.id && r.status === 'pending')) {
      await loadMembers(teamCode); return;
    }
    const updated = allUsers.map(u => u.id === req.userId ? { ...u, joinApproved: true } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    await syncWrite('__global__', 'users', updated);
    const reqs: JoinRequest[] = (await syncRead(teamCode, 'join-requests')) ?? [];
    const updatedReqs = reqs.map(r => r.id === req.id ? { ...r, status: 'approved' as const } : r);
    await syncWrite(teamCode, 'join-requests', updatedReqs);
    loadMembers(teamCode);
  };

  const rejectRequest = async (req: JoinRequest) => {
    const users: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const cloudUsers: Member[] = (await syncRead('__global__', 'users')) ?? [];
    const allUsers = [...cloudUsers];
    for (const u of users) { if (!allUsers.find(cu => cu.email === u.email)) allUsers.push(u); }
    const requester = allUsers.find(u => u.id === req.userId);
    const freshRequests: JoinRequest[] = (await syncRead(teamCode, 'join-requests')) ?? [];
    if (!requester || requester.teamCode !== teamCode || requester.joinRequestId !== req.id || !freshRequests.some(r => r.id === req.id && r.status === 'pending')) {
      await loadMembers(teamCode); return;
    }
    const updated = allUsers.map(u => u.id === req.userId ? { ...u, teamCode: '', joinApproved: undefined } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    await syncWrite('__global__', 'users', updated);
    const reqs: JoinRequest[] = (await syncRead(teamCode, 'join-requests')) ?? [];
    const updatedReqs = reqs.map(r => r.id === req.id ? { ...r, status: 'rejected' as const } : r);
    await syncWrite(teamCode, 'join-requests', updatedReqs);
    loadMembers(teamCode);
  };

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (session.role !== 'manager') { router.push('/'); return; }
    setMyId(session.id);
    setMyEmail(normalizedEmail(session.email));
    setTeamCode(session.teamCode ?? '');
    loadMembers(session.teamCode ?? '');
    setReady(true);
  }, [router]);

  const saveCoachTypes = async () => {
    if (coachSaving || coachSelection.length === 0) return;
    setCoachSaving(true); setCoachError('');
    try {
      const users: Member[] = (await syncRead('__global__', 'users', true)) ?? [];
      const target = users.find(u => u.id === editingCoach && u.role === 'coach' && u.teamCode === teamCode);
      if (!target || !users.some(u => (u.id === myId || (myEmail && normalizedEmail(u.email) === myEmail)) && u.role === 'manager' && u.teamCode === teamCode)) throw new Error('member changed');
      const updated = users.map(u => u.id === editingCoach ? { ...u, coachTypes: coachSelection, coachType: coachSelection.join(' · ') } : u);
      await syncWrite('__global__', 'users', updated, true);
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      setEditingCoach(''); await loadMembers(teamCode);
    } catch { setCoachError('저장하지 못했습니다. 연결 상태와 팀원 정보를 확인하세요.'); }
    finally { setCoachSaving(false); }
  };

  const kickMember = async (member: Member) => {
    if (kickingId || member.id === myId || (myEmail && normalizedEmail(member.email) === myEmail)) return;
    if (!confirm(`${member.name}님을 팀에서 내보낼까요?\n계정은 유지되며, 내보내기 알림이 전달됩니다.`)) return;
    setKickingId(member.id); setDeleteError('');
    try {
      const users: Member[] = (await syncRead('__global__', 'users', true)) ?? [];
      if (!users.some(u => (u.id === myId || (myEmail && normalizedEmail(u.email) === myEmail)) && u.role === 'manager' && u.teamCode === teamCode)) throw new Error('권한 변경');
      if (!users.some(u => u.id === member.id && u.teamCode === teamCode)) throw new Error('팀원 변경');
      const removalNotice = { id: crypto.randomUUID(), teamCode, createdAt: new Date().toISOString() };
      const updated = users.map(u => (u.id === member.id || (normalizedEmail(member.email) && normalizedEmail(u.email) === normalizedEmail(member.email))) && u.teamCode === teamCode
        ? { ...u, teamCode: '', joinApproved: false, joinRequestId: undefined, removalNotice } : u);
      await syncWrite('__global__', 'users', updated, true);
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      await loadMembers(teamCode);
    } catch { setDeleteError('내보내기를 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.'); }
    finally { setKickingId(''); }
  };

  const deleteAccount = async (member: Member) => {
    if (deletingId || member.id === myId || (myEmail && normalizedEmail(member.email) === myEmail)) return;
    if (!confirm(`${member.name}님의 계정을 삭제할까요?\n로그인할 수 없게 되며 기존 로그인도 해제됩니다. 되돌릴 수 없습니다.`)) return;
    setDeletingId(member.id); setDeleteError('');
    try {
      const users: Member[] = (await syncRead('__global__', 'users', true)) ?? [];
      const actor = users.find(u => (u.id === myId || (myEmail && normalizedEmail(u.email) === myEmail)) && u.role === 'manager' && u.teamCode === teamCode);
      const target = users.find(u => u.id === member.id && u.teamCode === teamCode);
      if (!actor || !target) throw new Error('계정 상태 변경');
      const cached: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
      const ids = [...new Set([...users, ...cached].filter(u => u.id === member.id || (normalizedEmail(member.email) && normalizedEmail(u.email) === normalizedEmail(member.email))).map(u => u.id))];
      await markAccountsDeleted(ids);
      const updated = users.filter(u => !ids.includes(u.id));
      await syncWrite('__global__', 'users', updated, true);
      localStorage.setItem('pitchcom-users', JSON.stringify(updated));
      const requests: JoinRequest[] = (await syncRead(teamCode, 'join-requests')) ?? [];
      await syncWrite(teamCode, 'join-requests', requests.filter(r => !ids.includes(r.userId)), true);
      await loadMembers(teamCode);
    } catch { setDeleteError('삭제 처리를 완료하지 못했습니다. 일부 처리되었을 수 있으니 새로고침 후 상태를 확인하세요.'); await loadMembers(teamCode); }
    finally { setDeletingId(''); }
  };

  if (!ready) return null;

  const isMe = (member: Member) => member.id === myId || Boolean(myEmail && normalizedEmail(member.email) === myEmail);
  const me = members.find(m => m.id === myId) ?? members.find(isMe);
  const others = members.filter(m => !isMe(m));

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>🛡️ 감독 관리</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>팀 코드: {teamCode}</p>
        </div>
      </div>

      {/* 가입 요청 */}
      {joinRequests.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>⚡ 가입 요청 ({joinRequests.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {joinRequests.map(req => (
              <div key={req.id} style={{ padding: '14px 18px', borderRadius: 14, background: '#1e293b', border: '1.5px solid #f59e0b33', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f59e0b22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {req.userRole === 'coach' ? '📋' : '⚾'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{req.userName}</div>
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>{req.userRole === 'coach' ? coachLabel(req) : '선수'} · 가입 요청</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => approveRequest(req)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>수락</button>
                  <button onClick={() => rejectRequest(req)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #ef444433', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 팀원 수 */}
      <div style={{ padding: '16px 20px', borderRadius: 16, background: '#1e293b', border: '1px solid #334155', marginBottom: 20, display: 'flex', gap: 20 }}>
        {[
          ['전체', members.length, '#60a5fa'],
          ['감독', members.filter(m => m.role === 'manager').length, '#f59e0b'],
          ['코치', members.filter(m => m.role === 'coach').length, '#10b981'],
          ['선수', members.filter(m => m.role === 'player').length, '#a78bfa'],
        ].map(([label, count, color]) => (
          <div key={label as string} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: color as string }}>{count as number}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{label as string}</div>
          </div>
        ))}
      </div>

      {/* 내 계정 */}
      {me && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', fontWeight: 700 }}>내 계정</p>
          <div style={{ padding: '14px 18px', borderRadius: 14, background: '#1e3a5f', border: '1px solid #1e40af', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧢</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{me.name}</div>
              <div style={{ fontSize: 12, color: '#60a5fa' }}>{me.email}</div>
            </div>
            <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>감독</span>
          </div>
        </div>
      )}

      {deleteError && <p role="alert" style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{deleteError}</p>}
      {/* 팀원 목록 */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', fontWeight: 700 }}>팀원 ({others.length}명)</p>
        {others.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <p style={{ margin: 0, fontSize: 14 }}>아직 팀원이 없어요<br/>팀 코드를 공유해서 초대하세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {others.map(m => (
              <div key={m.id} style={{ padding: '14px 18px', borderRadius: 14, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {m.role === 'manager' ? '🧢' : m.role === 'coach' ? '📋' : '⚾'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.6 }}>{m.email}</div>
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: 160, overflowWrap: 'anywhere' }}>{m.role === 'coach' ? `📋 ${coachLabel(m)}` : (ROLE_LABEL[m.role] ?? m.role)}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {m.role === 'coach' && <button onClick={() => { setEditingCoach(m.id); setCoachSelection(getCoachTypes(m)); setCoachError(''); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #3b82f655', background: 'transparent', color: '#60a5fa', fontSize: 11, cursor: 'pointer' }}>코치 유형</button>}
                  <button disabled={Boolean(kickingId || deletingId)} onClick={() => kickMember(m)} style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #f59e0b33',
                    background: 'transparent', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>내보내기</button>
                  <button disabled={Boolean(deletingId || kickingId)} onClick={() => deleteAccount(m)} style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #ef444433',
                    background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AccountDeletionForm onDeleted={() => loadMembers(teamCode)} />

      {editingCoach && <section style={{ padding: 18, marginTop: 16, borderRadius: 14, background: '#1e293b', border: '1px solid #3b82f6' }}>
        <h2 style={{ fontSize: 15, color: '#f8fafc', marginBottom: 12 }}>{members.find(m => m.id === editingCoach)?.name} · 코치 유형 변경</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>기존 선택을 유지하며 여러 분야를 함께 선택할 수 있습니다.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{[...new Set([...COACH_TYPES, ...coachSelection])].map(type => <button key={type} disabled={coachSaving} aria-pressed={coachSelection.includes(type)} onClick={() => setCoachSelection(types => types.includes(type) ? types.filter(t => t !== type) : [...types, type])} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #3b82f6', background: coachSelection.includes(type) ? '#2563eb' : '#0f172a', color: '#f8fafc', cursor: 'pointer' }}>{type}</button>)}</div>
        {coachError && <p role="alert" style={{ color: '#f87171', fontSize: 12, marginTop: 12 }}>{coachError}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button disabled={coachSaving || coachSelection.length === 0} onClick={saveCoachTypes} style={{ padding: '10px 18px', border: 0, borderRadius: 8, background: '#2563eb', color: '#fff' }}>{coachSaving ? '저장 중…' : '저장'}</button>
          <button disabled={coachSaving} onClick={() => setEditingCoach('')} style={{ padding: '10px 18px', border: '1px solid #475569', borderRadius: 8, background: 'transparent', color: '#cbd5e1' }}>취소</button>
        </div>
      </section>}

      <div style={{ marginTop: 32, padding: '14px 18px', borderRadius: 14, background: '#1e293b', border: '1px solid #334155' }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', fontWeight: 700 }}>팀 초대 방법</p>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          팀원에게 팀 코드 <span style={{ fontWeight: 900, color: '#60a5fa', letterSpacing: 1 }}>{teamCode}</span> 를 공유하세요.<br/>
          팀원이 회원가입 후 이 코드를 입력하면 합류돼요.
        </p>
      </div>
    </div>
  );
}
