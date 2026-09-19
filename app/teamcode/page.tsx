'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamCodePage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (session.teamCode) { router.push('/'); return; }
    setRole(session.role);
    setName(session.name);
    setSessionId(session.id);
  }, [router]);

  const handleSubmit = () => {
    setError('');
    const code = teamCode.trim().toUpperCase();
    if (!code) { setError('팀 코드를 입력해주세요'); return; }
    const users = JSON.parse(localStorage.getItem('pitchcom-users') || '[]');
    if (role === 'coach' || role === 'player') {
      const managerExists = users.find((u: any) => u.teamCode === code && u.role === 'manager');
      if (!managerExists) { setError('존재하지 않는 팀 코드예요'); return; }
    }
    if (role === 'manager') {
      const codeExists = users.find((u: any) => u.teamCode === code && u.role === 'manager');
      if (codeExists) { setError('이미 사용 중인 팀 코드예요'); return; }
    }
    setLoading(true);
    const updated = users.map((u: any) => u.id === sessionId ? { ...u, teamCode: code } : u);
    localStorage.setItem('pitchcom-users', JSON.stringify(updated));
    const raw = localStorage.getItem('pitchcom-session')!;
    const session = JSON.parse(raw);
    session.teamCode = code;
    localStorage.setItem('pitchcom-session', JSON.stringify(session));
    router.push('/');
  };

  const roleLabel = role === 'manager' ? '🧢 감독' : role === 'coach' ? '📋 코치' : '⚾ 선수';

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        input:focus { border-color: #3b82f6 !important; outline: none; }
      `}</style>
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#020617 0%,#0f172a 40%,#0c1a3a 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ width:'100%', maxWidth:400, animation:'fadeIn 0.4s ease-out' }}>

          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 14px', boxShadow:'0 12px 40px rgba(59,130,246,0.35)' }}>⚾</div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'#f8fafc' }}>팀 코드 설정</h1>
            <p style={{ margin:'8px 0 0', color:'#64748b', fontSize:14 }}>{name} · {roleLabel}</p>
          </div>

          <div style={{ background:'rgba(30,41,59,0.85)', backdropFilter:'blur(20px)', borderRadius:24, border:'1px solid rgba(255,255,255,0.07)', padding:'28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <p style={{ margin:0, color:'#94a3b8', fontSize:14, fontWeight:700 }}>
                {role === 'manager' ? '팀 코드를 만드세요' : '감독님에게 받은 팀 코드를 입력하세요'}
              </p>
              {role === 'manager' && (
                <p style={{ margin:'6px 0 0', color:'#475569', fontSize:12 }}>팀원들이 이 코드로 합류해요</p>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input
                type="text"
                value={teamCode}
                onChange={e => { setTeamCode(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="예: LIONS2026"
                autoFocus
                style={{
                  width:'100%', padding:'16px', borderRadius:12,
                  border:'1.5px solid #1e3a5f', background:'#0f172a',
                  color:'#f8fafc', fontSize:20, fontWeight:900, letterSpacing:2,
                  textAlign:'center', boxSizing:'border-box', transition:'border-color 0.2s',
                }}
              />
              {error && (
                <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>
                  ⚠️ {error}
                </div>
              )}
              <button onClick={handleSubmit} disabled={loading} style={{
                padding:'15px', borderRadius:13, border:'none',
                background: loading ? '#334155' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color:'#fff', fontSize:16, fontWeight:900, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? '처리 중...' : role === 'manager' ? '팀 만들기 →' : '팀 합류하기 →'}
              </button>
            </div>
          </div>

          <div style={{ textAlign:'center', marginTop:16 }}>
            <button onClick={() => { localStorage.removeItem('pitchcom-session'); router.push('/login'); }} style={{ background:'none', border:'none', color:'#475569', fontSize:12, cursor:'pointer' }}>
              ← 로그인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
