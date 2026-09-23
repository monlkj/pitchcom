'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  teamCode: string;
}

const ROLE_LABEL: Record<string, string> = {
  manager: '🧢 감독',
  coach: '📋 코치',
  player: '⚾ 선수',
};

export default function AdminPage() {
  const router = useRouter();
  const [myId, setMyId] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [ready, setReady] = useState(false);

  const loadMembers = async (code: string) => {
    // 로컬 + 클라우드 병합 후 해당 팀 코드 필터
    const local: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const cloud: Member[] = (await syncRead('__global__', 'users')) ?? [];
    const merged: Member[] = [...local];
    for (const cu of cloud) {
      if (!merged.find(u => u.email === cu.email)) merged.push(cu);
    }
    localStorage.setItem('pitchcom-users', JSON.stringify(merged));
    setMembers(merged.filter(u => u.teamCode === code));
  };

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (session.role !== 'manager') { router.push('/'); return; }
    setMyId(session.id);
    setTeamCode(session.teamCode ?? '');
    loadMembers(session.teamCode ?? '');
    setReady(true);
  }, [router]);

  const kickMember = (member: Member) => {
    if (member.id === myId) return;
    if (!confirm(`${member.name}님을 팀에서 내보낼까요?\n(계정은 유지되지만 팀 코드가 초기화돼요)`)) return;
    const users: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const updated = users.map(u => u.id === member.id ? { ...u, teamCode: '' } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    syncWrite('__global__', 'users', updated);
    loadMembers(teamCode);
  };

  const deleteAccount = (member: Member) => {
    if (member.id === myId) return;
    if (!confirm(`${member.name}님의 계정을 삭제할까요?\n이 작업은 되돌릴 수 없어요.`)) return;
    const users: Member[] = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    const updated = users.filter(u => u.id !== member.id);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    syncWrite('__global__', 'users', updated);
    loadMembers(teamCode);
  };

  if (!ready) return null;

  const me = members.find(m => m.id === myId);
  const others = members.filter(m => m.id !== myId);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>🛡️ 감독 관리</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>팀 코드: {teamCode}</p>
        </div>
      </div>

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
              <div key={m.id} style={{ padding: '14px 18px', borderRadius: 14, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {m.role === 'manager' ? '🧢' : m.role === 'coach' ? '📋' : '⚾'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => kickMember(m)} style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #f59e0b33',
                    background: 'transparent', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>내보내기</button>
                  <button onClick={() => deleteAccount(m)} style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #ef444433',
                    background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
