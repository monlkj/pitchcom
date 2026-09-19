'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LocalUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'coach';
  teamCode: string;
}

function getUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem('pitchcom-users') || '[]'); } catch { return []; }
}
function saveUsers(users: LocalUser[]) {
  localStorage.setItem('pitchcom-users', JSON.stringify(users));
}
function setSession(user: LocalUser) {
  localStorage.setItem('pitchcom-session', JSON.stringify({ id: user.id, name: user.name, role: user.role, teamCode: user.teamCode, email: user.email }));
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'info' | 'role' | 'teamcode'>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'manager' | 'coach' | ''>('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetSignup = () => { setStep('info'); setRole(''); setTeamCode(''); setError(''); };

  const handleLogin = () => {
    setError('');
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요'); return; }
    setLoading(true);
    setTimeout(() => {
      const users = getUsers();
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) { setError('이메일 또는 비밀번호가 틀렸어요'); setLoading(false); return; }
      setSession(user);
      router.push('/');
    }, 300);
  };

  const handleSignupInfo = () => {
    setError('');
    if (!name.trim()) { setError('이름을 입력해주세요'); return; }
    if (!email.trim()) { setError('이메일을 입력해주세요'); return; }
    if (password.length < 4) { setError('비밀번호는 4자 이상이에요'); return; }
    const users = getUsers();
    if (users.find(u => u.email === email)) { setError('이미 사용 중인 이메일이에요'); return; }
    setStep('role');
  };

  const handleRoleSelect = (r: 'manager' | 'coach') => {
    setRole(r);
    setStep('teamcode');
  };

  const handleTeamCode = () => {
    setError('');
    if (!teamCode.trim()) { setError('팀 코드를 입력해주세요'); return; }
    const users = getUsers();
    if (role === 'coach') {
      const managerExists = users.find(u => u.teamCode === teamCode.toUpperCase() && u.role === 'manager');
      if (!managerExists) { setError('존재하지 않는 팀 코드예요'); return; }
    }
    if (role === 'manager') {
      const codeExists = users.find(u => u.teamCode === teamCode.toUpperCase() && u.role === 'manager');
      if (codeExists) { setError('이미 사용 중인 팀 코드예요'); return; }
    }
    setLoading(true);
    setTimeout(() => {
      const newUser: LocalUser = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim(),
        password,
        role: role as 'manager' | 'coach',
        teamCode: teamCode.toUpperCase(),
      };
      saveUsers([...users, newUser]);
      setSession(newUser);
      router.push('/');
    }, 300);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1.5px solid #1e3a5f', background: '#0f172a',
    color: '#f8fafc', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  };
  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '15px', borderRadius: 13, border: 'none',
    background: loading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff', fontSize: 16, fontWeight: 900,
    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
  };

  return (
    <>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)rotate(-10deg)}50%{transform:translateY(-18px)rotate(10deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        input:focus { border-color: #3b82f6 !important; }
        .role-btn:hover { transform: translateY(-2px); }
      `}</style>
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#020617 0%,#0f172a 40%,#0c1a3a 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:'8%', left:'6%', fontSize:80, opacity:0.06, animation:'float 6s ease-in-out infinite' }}>⚾</div>
          <div style={{ position:'absolute', bottom:'8%', right:'10%', fontSize:72, opacity:0.05, animation:'float 8s ease-in-out infinite' }}>⚾</div>
        </div>

        <div style={{ width:'100%', maxWidth:400, animation:'fadeIn 0.5s ease-out', position:'relative', zIndex:1 }}>
          {/* 로고 */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 14px', boxShadow:'0 12px 40px rgba(59,130,246,0.35)' }}>⚾</div>
            <h1 style={{ margin:0, fontSize:32, fontWeight:900, color:'#f8fafc', letterSpacing:-1 }}>PitchCom</h1>
            <p style={{ margin:'6px 0 0', color:'#64748b', fontSize:14 }}>야구 실시간 투구 신호 시스템</p>
          </div>

          <div style={{ background:'rgba(30,41,59,0.85)', backdropFilter:'blur(20px)', borderRadius:24, border:'1px solid rgba(255,255,255,0.07)', padding:'28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>

            {/* 탭 (로그인/회원가입) */}
            {(tab === 'login' || step === 'info') && (
              <div style={{ display:'flex', background:'#0f172a', borderRadius:12, padding:4, marginBottom:22 }}>
                {(['login','signup'] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); resetSignup(); setError(''); }} style={{
                    flex:1, padding:'10px', borderRadius:9, border:'none',
                    background: tab===t ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'transparent',
                    color: tab===t ? '#fff' : '#64748b', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.25s',
                  }}>
                    {t==='login' ? '🔑 로그인' : '✨ 회원가입'}
                  </button>
                ))}
              </div>
            )}

            {/* 로그인 */}
            {tab === 'login' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" style={inputStyle} />
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="비밀번호" style={inputStyle} />
                {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>⚠️ {error}</div>}
                <button onClick={handleLogin} disabled={loading} style={btnPrimary}>{loading ? '로그인 중...' : '로그인 →'}</button>
              </div>
            )}

            {/* 회원가입 - step: info */}
            {tab === 'signup' && step === 'info' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="이름" style={inputStyle} autoFocus />
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" style={inputStyle} />
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSignupInfo()} placeholder="비밀번호 (4자 이상)" style={inputStyle} />
                {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>⚠️ {error}</div>}
                <button onClick={handleSignupInfo} style={btnPrimary}>다음 →</button>
              </div>
            )}

            {/* 회원가입 - step: role */}
            {tab === 'signup' && step === 'role' && (
              <div>
                <p style={{ margin:'0 0 18px', color:'#94a3b8', fontSize:15, fontWeight:700, textAlign:'center' }}>역할을 선택하세요</p>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { r:'manager' as const, emoji:'🧢', label:'감독', desc:'팀 코드를 생성하고 팀을 관리해요' },
                    { r:'coach' as const, emoji:'📋', label:'코치', desc:'팀 코드를 입력해서 팀에 합류해요' },
                  ].map(({ r, emoji, label, desc }) => (
                    <button key={r} className="role-btn" onClick={() => handleRoleSelect(r)} style={{
                      padding:'18px 20px', borderRadius:16, border:'1.5px solid #1e3a5f',
                      background:'#0f172a', color:'#f8fafc', cursor:'pointer', textAlign:'left',
                      display:'flex', alignItems:'center', gap:14, transition:'all 0.2s',
                    }}>
                      <span style={{ fontSize:28 }}>{emoji}</span>
                      <div>
                        <div style={{ fontSize:16, fontWeight:800 }}>{label}</div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={resetSignup} style={{ marginTop:14, width:'100%', padding:'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
              </div>
            )}

            {/* 회원가입 - step: teamcode */}
            {tab === 'signup' && step === 'teamcode' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ textAlign:'center', marginBottom:4 }}>
                  <span style={{ fontSize:32 }}>{role==='manager' ? '🧢' : '📋'}</span>
                  <p style={{ margin:'8px 0 0', color:'#94a3b8', fontSize:14, fontWeight:700 }}>
                    {role==='manager' ? '팀 코드를 만드세요' : '팀 코드를 입력하세요'}
                  </p>
                  <p style={{ margin:'4px 0 0', color:'#475569', fontSize:12 }}>
                    {role==='manager' ? '감독님이 직접 설정하는 팀 고유 코드예요' : '감독님에게 팀 코드를 받아서 입력하세요'}
                  </p>
                </div>
                <input
                  type="text"
                  value={teamCode}
                  onChange={e=>setTeamCode(e.target.value.toUpperCase())}
                  onKeyDown={e=>e.key==='Enter'&&handleTeamCode()}
                  placeholder="예: LIONS2026"
                  style={{ ...inputStyle, textAlign:'center', fontSize:18, fontWeight:800, letterSpacing:2 }}
                  autoFocus
                />
                {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>⚠️ {error}</div>}
                <button onClick={handleTeamCode} disabled={loading} style={btnPrimary}>{loading ? '처리 중...' : role==='manager' ? '팀 만들기 →' : '팀 합류하기 →'}</button>
                <button onClick={() => { setStep('role'); setError(''); }} style={{ padding:'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
              </div>
            )}
          </div>

          <p style={{ textAlign:'center', marginTop:18, fontSize:12, color:'#334155' }}>⚾ KBO 디지털 피치컴 시스템</p>
        </div>
      </div>
    </>
  );
}
