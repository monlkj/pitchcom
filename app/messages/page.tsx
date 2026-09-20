'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  sender: string;
  role: string;
  text: string;
  time: number;
}

const ROLE_EMOJI: Record<string, string> = {
  manager: '🧢',
  coach: '📋',
  player: '⚾',
};

export default function MessagesPage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [myRole, setMyRole] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [noSupabase, setNoSupabase] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (!session.teamCode) { router.push('/'); return; }

    const name = session.name ?? '';
    const role = session.role ?? '';
    const code = session.teamCode ?? '';
    setMyName(name);
    setMyRole(role);
    setTeamCode(code);

    // 저장된 메시지 복원
    try {
      const saved = localStorage.getItem(`pitchcom-msgs-${code}`);
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);
        parsed.forEach(m => seenIds.current.add(m.id));
        setMessages(parsed);
      }
    } catch {}

    // supabase 없으면 오프라인 모드
    if (!supabase) { setNoSupabase(true); return; }

    const ch = supabase
      .channel(`pitchcom-chat-${code}`)
      .on('broadcast', { event: 'msg' }, ({ payload }: { payload: any }) => {
        const msg = payload as Message;
        if (seenIds.current.has(msg.id)) return; // 중복 무시
        seenIds.current.add(msg.id);
        setMessages(prev => {
          const next = [...prev, msg].slice(-200);
          try { localStorage.setItem(`pitchcom-msgs-${code}`, JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: myName,
      role: myRole,
      text,
      time: Date.now(),
    };

    // 즉시 표시 (낙관적 업데이트)
    seenIds.current.add(msg.id);
    setMessages(prev => {
      const next = [...prev, msg].slice(-200);
      try { localStorage.setItem(`pitchcom-msgs-${teamCode}`, JSON.stringify(next)); } catch {}
      return next;
    });

    // 브로드캐스트 (연결됐을 때만)
    if (channelRef.current && connected) {
      channelRef.current.send({ type: 'broadcast', event: 'msg', payload: msg });
    }
  };

  const clearMessages = () => {
    if (!confirm('대화 내역을 모두 지울까요? (이 기기에서만 삭제돼요)')) return;
    setMessages([]);
    seenIds.current.clear();
    try { localStorage.removeItem(`pitchcom-msgs-${teamCode}`); } catch {}
  };

  const timeStr = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ height: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column', maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1e293b', background: '#0f172a', flexShrink: 0 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>💬 팀 메시지</h1>
          {teamCode && <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>팀 코드: {teamCode}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {messages.length > 0 && (
            <button onClick={clearMessages} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer' }}>지우기</button>
          )}
          <div style={{
            padding: '4px 10px', borderRadius: 20,
            background: noSupabase ? '#1e293b' : connected ? '#064e3b' : '#1e293b',
            color: noSupabase ? '#475569' : connected ? '#22c55e' : '#64748b',
            fontSize: 11, fontWeight: 700,
            border: `1px solid ${noSupabase ? '#33415544' : connected ? '#22c55e33' : '#33415544'}`,
          }}>
            {noSupabase ? '오프라인' : connected ? '● 연결됨' : '○ 연결 중...'}
          </div>
        </div>
      </div>

      {/* 오프라인 안내 */}
      {noSupabase && (
        <div style={{ padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          오프라인 모드 — 메시지가 이 기기에만 저장돼요
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ margin: 0, fontSize: 14 }}>아직 메시지가 없어요<br/>첫 메시지를 보내보세요!</p>
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.sender === myName;
          const prevSender = i > 0 ? messages[i - 1].sender : null;
          const showSender = prevSender !== m.sender;
          return (
            <div key={m.id} style={{ marginBottom: showSender && i > 0 ? 12 : 4, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {showSender && (
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                  {ROLE_EMOJI[m.role] ?? ''} {m.sender}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{
                  maxWidth: '72%', padding: '10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#3b82f6' : '#1e293b',
                  color: '#f8fafc', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{timeStr(m.time)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', background: '#0f172a', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="메시지 입력..."
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 24,
            border: '1.5px solid #334155', background: '#1e293b',
            color: '#f8fafc', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim()} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: input.trim() ? '#3b82f6' : '#1e293b',
          color: '#fff', fontSize: 20, cursor: input.trim() ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background 0.15s',
        }}>↑</button>
      </div>
    </div>
  );
}
