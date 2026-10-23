'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { verifyTemporaryPassword, type TemporaryCredential } from '../../lib/temporaryAccounts';
import { normalizedEmail } from '../../lib/memberIdentity';
import { useRouter } from 'next/navigation';
import { refreshDeletedAccounts } from '../../lib/accountDeletion';
import { syncRead, syncWrite } from '../../lib/teamSync';
import { COACH_TYPES } from '../../lib/coachTypes';
import { migrateTeamCache } from '../../lib/teamStorage';

const GLOBAL = '__global__';

type Role = 'manager' | 'coach' | 'player';

interface LocalUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  authUserId?: string;
  temporaryCredential?: TemporaryCredential;
  role: Role;
  coachType?: string;
  coachTypes?: string[];
  teamCode: string;
  joinApproved?: boolean;
  joinRequestId?: string;
  managedTeamCodes?: string[];
  removalNotice?: { id: string; teamCode: string; createdAt: string };
}


function saveUsers(users: LocalUser[]) {
  localStorage.setItem('pitchcom-users', JSON.stringify(users));
}
function setSession(user: LocalUser, authUserId?: string) {
  migrateTeamCache();
  localStorage.setItem('pitchcom-session', JSON.stringify({ authUserId, id: user.id, name: user.name, role: user.role, coachType: user.coachType, coachTypes: user.coachTypes, teamCode: user.teamCode, email: user.email, joinApproved: user.joinApproved, joinRequestId: user.joinRequestId, managedTeamCodes: user.managedTeamCodes, removalNotice: user.removalNotice }));
}

const ROLES = [
  { r: 'manager' as Role, emoji: '🧢', label: '감독', desc: '팀을 만들고 관리해요' },
  { r: 'coach' as Role, emoji: '📋', label: '코치', desc: '코칭 스태프로 팀에 합류해요' },
  { r: 'player' as Role, emoji: '⚾', label: '선수', desc: '선수로 팀에 합류해요' },
];

export default function LoginPage() {
  const router = useRouter();
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'info' | 'role' | 'coachType'>('info');
  const [selectedCoachTypes, setSelectedCoachTypes] = useState<string[]>([]);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [linkNeeded, setLinkNeeded] = useState(false);
  const oauthStarted = useRef(false);

  // Only resume after an explicit OAuth redirect, never on an ordinary login visit.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('oauth') !== 'google' || oauthStarted.current) return;
    oauthStarted.current = true;
    setLoading(true);
    void (async () => {
      try {
        if (!supabase) throw new Error('서버 연결 설정을 확인해 주세요.');
        const { data, error: authError } = await supabase.auth.getUser();
        window.history.replaceState(null, '', '/login');
        if (authError || !data.user?.email || !data.user.identities?.some((identity: { provider: string }) => identity.provider === 'google')) {
          throw new Error('구글 로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
        }
        const user = data.user as User;
        await refreshDeletedAccounts();
        const users = await syncRead(GLOBAL, 'users', true);
        if (!Array.isArray(users)) throw new Error('기존 계정 정보를 확인할 수 없습니다.');
        const matches = (users as LocalUser[]).filter(u => normalizedEmail(u.email) === normalizedEmail(user.email));
        if (matches.length > 1) throw new Error('같은 이메일의 기존 계정이 여러 개입니다. 계정 정리 후 연결해 주세요.');
        const existing = matches[0];
        if (existing?.authUserId && existing.authUserId !== user.id) throw new Error('이미 다른 구글 계정에 연결되어 있습니다.');
        if (existing?.authUserId === user.id) {
          setSession(existing, user.id);
          router.replace('/home');
          return;
        }
        localStorage.removeItem('pitchcom-session');
        setGoogleUser(user); setEmail(user.email!); setPassword('');
        if (existing) { setLinkNeeded(true); setTab('login'); }
        else { setName(user.user_metadata.full_name || user.user_metadata.name || ''); setTab('signup'); setStep('info'); }
      } catch (failure) {
        window.history.replaceState(null, '', '/login');
        setError(failure instanceof Error ? failure.message : '구글 로그인 연결에 실패했습니다. 다시 시도해 주세요.');
      } finally { setLoading(false); }
    })();
  }, [router]);

  const startGoogle = async () => {
    setError(''); setLoading(true);
    try {
      if (!supabase) throw new Error('서버 연결 설정을 확인해 주세요.');
      localStorage.removeItem('pitchcom-session');
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login?oauth=google`, queryParams: { prompt: 'select_account' } },
      });
      if (authError) throw new Error('구글 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '구글 로그인 연결 실패'); setLoading(false); }
  };

  const linkGoogle = async () => {
    setError(''); setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !googleUser || data.user?.id !== googleUser.id) throw new Error('구글 로그인을 다시 진행해 주세요.');
      const users: LocalUser[] = await syncRead(GLOBAL, 'users', true);
      const matches = users.filter(u => normalizedEmail(u.email) === normalizedEmail(data.user.email));
      if (matches.length !== 1) throw new Error('기존 계정 정보를 확인할 수 없습니다.');
      const existing = matches[0];
      if (existing.authUserId && existing.authUserId !== googleUser.id) throw new Error('이미 다른 구글 계정에 연결되어 있습니다.');
      const valid = existing.temporaryCredential ? await verifyTemporaryPassword(password, existing.temporaryCredential) : Boolean(existing.password && existing.password === password);
      if (!valid) throw new Error('기존 PitchCom 비밀번호가 맞지 않습니다.');
      const { password: _legacyPassword, temporaryCredential: _temporaryCredential, ...profile } = existing;
      const linked = { ...profile, authUserId: googleUser.id };
      const updated = users.map(u => u.id === existing.id ? linked : u);
      await syncWrite(GLOBAL, 'users', updated, true);
      saveUsers(updated);
      setPassword(''); setSession(linked, googleUser.id); router.replace('/home');
    } catch (failure) { setPassword(''); setError(failure instanceof Error ? failure.message : '계정 연결 실패'); }
    finally { setLoading(false); }
  };

  const resetSignup = () => { setStep('info'); setError(''); setPendingRole(null); };

  const handleLogin = async () => {
    if (linkNeeded) { await linkGoogle(); return; }
    setError('');
    if (!email || !password) { setError('아이디와 비밀번호를 입력해주세요'); return; }
    setLoading(true);
    try { await refreshDeletedAccounts(); } catch { setError('서버에서 계정 상태를 확인할 수 없습니다. 연결 후 다시 시도하세요.'); setLoading(false); return; }
    try {
      const users: LocalUser[] = await syncRead(GLOBAL, 'users', true);
      if (!Array.isArray(users)) throw new Error('계정 목록을 확인할 수 없습니다.');
      const user = users.find(u => normalizedEmail(u.email) === normalizedEmail(email));
      if (!user) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
      if (user.authUserId) throw new Error('이 계정은 Google로 로그인해 주세요.');
      const valid = user.temporaryCredential
        ? await verifyTemporaryPassword(password, user.temporaryCredential)
        : Boolean(user.password && user.password === password);
      if (!valid) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
      saveUsers(users); setPassword(''); setSession(user); router.push('/home');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '로그인하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setLoading(false); }
  };

  const handleSignupInfo = async () => {
    setError('');
    if (!name.trim()) { setError('이름을 입력해주세요'); return; }
    if (!email.trim()) { setError('이메일을 입력해주세요'); return; }
    if (!googleUser) { setError('Google 로그인 또는 감독이 발급한 임시 계정을 사용해 주세요.'); return; }
    setStep('role');
  };

  const handleRoleSelect = (r: Role) => {
    if (r === 'coach') { setPendingRole(r); setStep('coachType'); return; }
    void createAccount(r);
  };
  const createAccount = async (r: Role, coachTypes: string[] = []) => {
    if (!googleUser) { setError('Google 로그인을 먼저 진행해 주세요.'); return; }
    await createGoogleAccount(r, coachTypes);
  };

  const createGoogleAccount = async (r: Role, coachTypes: string[]) => {
    setLoading(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || data.user?.id !== googleUser?.id || !data.user?.email) throw new Error('구글 로그인을 다시 진행해 주세요.');
      const users: LocalUser[] = await syncRead(GLOBAL, 'users', true);
      if (users.some(u => normalizedEmail(u.email) === normalizedEmail(data.user.email))) throw new Error('기존 계정이 있습니다. 구글 로그인을 다시 눌러 연결해 주세요.');
      const user: LocalUser = { id: data.user.id, authUserId: data.user.id, name: name.trim(), email: data.user.email,
        role: r, teamCode: '', joinApproved: r === 'manager' ? true : undefined,
        ...(r === 'coach' ? { coachTypes, coachType: coachTypes.join(' · ') } : {}) };
      await syncWrite(GLOBAL, 'users', [...users, user], true);
      setSession(user, data.user.id); router.replace('/home');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '가입 정보를 저장하지 못했습니다.'); }
    finally { setLoading(false); }
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
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 14px', boxShadow:'0 12px 40px rgba(59,130,246,0.35)' }}>⚾</div>
            <h1 style={{ margin:0, fontSize:32, fontWeight:900, color:'#f8fafc', letterSpacing:-1 }}>PitchCom</h1>
            <p style={{ margin:'6px 0 0', color:'#64748b', fontSize:14 }}>야구 실시간 투구 신호 시스템</p>
          </div>

          <div style={{ background:'rgba(30,41,59,0.85)', backdropFilter:'blur(20px)', borderRadius:24, border:'1px solid rgba(255,255,255,0.07)', padding:'28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>

            {!googleUser && <button onClick={startGoogle} disabled={loading} style={{ ...btnPrimary, background: '#fff', color: '#1e293b', marginBottom: 18 }}>Google로 로그인</button>}
            {!googleUser && <button type="button" aria-expanded={temporaryOpen} onClick={() => { setTemporaryOpen(!temporaryOpen); setError(''); }} disabled={loading} style={{ width: '100%', padding: 12, marginBottom: 12, border: '1px solid #475569', borderRadius: 12, background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>임시 계정으로 로그인 {temporaryOpen ? '▴' : '▾'}</button>}
            {!googleUser && !temporaryOpen && error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
            {!googleUser && temporaryOpen && <p style={{ color: '#94a3b8', fontSize: 13 }}>감독이 발급한 아이디와 비밀번호를 입력해 주세요. 기존 PitchCom 계정도 사용할 수 있어요.</p>}
            {googleUser && <p style={{ color: '#93c5fd', fontSize: 14 }}>{linkNeeded ? '기존 팀과 기록을 연결하려면 PitchCom 비밀번호를 한 번 입력해 주세요.' : '구글 인증 완료! 이름과 역할을 선택해 주세요.'}</p>}
            {googleUser && tab === 'signup' && step !== 'info' && error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
            {googleUser && <button disabled={loading} onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); window.location.assign('/login'); }} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', marginBottom: 12 }}>다른 계정으로 로그인</button>}
            {/* 로그인 */}
            {tab === 'login' && (googleUser || temporaryOpen) && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="text" autoComplete="username" readOnly={!!googleUser} value={email} onChange={e=>setEmail(e.target.value)} placeholder={googleUser ? "이메일" : "아이디 또는 이메일"} style={inputStyle} />
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="비밀번호" style={inputStyle} />
                {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>⚠️ {error}</div>}
                <button onClick={handleLogin} disabled={loading} style={btnPrimary}>{loading ? '로그인 중...' : linkNeeded ? '기존 계정 연결하기' : '로그인 →'}</button>
              </div>
            )}

            {/* 회원가입 - info */}
            {tab === 'signup' && step === 'info' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="이름" style={inputStyle} autoFocus />
                <input type="email" readOnly={!!googleUser} value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" style={inputStyle} />
                {!googleUser && <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSignupInfo()} placeholder="비밀번호 (4자 이상)" style={inputStyle} />}
                {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, fontWeight:600 }}>⚠️ {error}</div>}
                <button onClick={handleSignupInfo} disabled={loading} style={btnPrimary}>다음 →</button>
              </div>
            )}

            {/* 회원가입 - 역할 선택 */}
            {tab === 'signup' && step === 'role' && (
              <div>
                <p style={{ margin:'0 0 16px', color:'#94a3b8', fontSize:15, fontWeight:700, textAlign:'center' }}>역할을 선택하세요</p>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {ROLES.map(({ r, emoji, label, desc }) => (
                    <button key={r} className="role-btn" onClick={() => handleRoleSelect(r)} disabled={loading} style={{
                      padding:'16px 20px', borderRadius:16, border:'1.5px solid #1e3a5f',
                      background:'#0f172a', color:'#f8fafc', cursor:'pointer', textAlign:'left',
                      display:'flex', alignItems:'center', gap:14, transition:'all 0.2s',
                    }}>
                      <span style={{ fontSize:26 }}>{emoji}</span>
                      <div>
                        <div style={{ fontSize:15, fontWeight:800 }}>{label}</div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={resetSignup} style={{ marginTop:12, width:'100%', padding:'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
              </div>
            )}

            {/* 회원가입 - 코치 유형 선택 */}
            {tab === 'signup' && step === 'coachType' && (
              <div>
                <p style={{ margin:'0 0 16px', color:'#94a3b8', fontSize:15, fontWeight:700, textAlign:'center' }}>코치 유형을 선택하세요 (여러 개 선택 가능)</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {COACH_TYPES.map(ct => (
                    <button key={ct} className="role-btn" aria-label={ct} aria-pressed={selectedCoachTypes.includes(ct)} onClick={() => setSelectedCoachTypes(types => types.includes(ct) ? types.filter(type => type !== ct) : [...types, ct])} disabled={loading} style={{
                      padding:'14px 20px', borderRadius:14, border: selectedCoachTypes.includes(ct) ? '1.5px solid #3b82f6' : '1.5px solid #1e3a5f',
                      background: selectedCoachTypes.includes(ct) ? '#1e3a5f' : '#0f172a', color:'#f8fafc', cursor:'pointer', textAlign:'left',
                      display:'flex', alignItems:'center', gap:14, transition:'all 0.2s',
                    }}>
                      <span style={{ fontSize:22 }}>📋</span>
                      <div style={{ fontSize:15, fontWeight:800 }}>{ct}</div>
                    </button>
                  ))}
                </div>
                <button disabled={loading || selectedCoachTypes.length === 0} onClick={() => createAccount('coach', selectedCoachTypes)} style={{ ...btnPrimary, marginTop: 16, opacity: selectedCoachTypes.length === 0 ? .5 : 1 }}>선택 완료 · 가입하기</button>
                <button onClick={() => { setStep('role'); setPendingRole(null); }} style={{ marginTop:12, width:'100%', padding:'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
              </div>
            )}
          </div>

          <p style={{ textAlign:'center', marginTop:18, fontSize:12, color:'#334155' }}>⚾ KBO 디지털 피치컴 시스템</p>
        </div>
      </div>
    </>
  );
}
