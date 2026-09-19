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
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const session = JSON.parse(raw);
    if (!session.teamCode) { router.push('/teamcode'); return; }
    setMyName(session.name ?? '');
    setMyRole(session.role ?? '');
    setTeamCode(session.teamCode ?? '');

    const saved = localStorage.getItem(`pitchcom-msgs-${session.teamCode}`);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch {}
    }

    const ch = supabase
      .channel(`pitchcom-chat-${session.teamCode}`)
      .on('broadcast', { event: 'message' }, ({ payload }: { payload: any }) => {
        setMessages(prev => {
          const next = [...prev, payload as Message].slice(-200);
          localStorage.setItem(`pitchcom-msgs-${session.teamCode}`, JSON.stringify(next));
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
    if (!text || !channelRef.current) return;
    const msg: Message = {
      id: Date.now().toString(),
      sender: myName,
      role: myRole,
      text,
      time: Date.now(),
    };
    channelRef.current.send({ type: 'broadcast', event: 'message', payload: msg });
    setInput('');
  };

  const timeStr = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1e293b', background: '#0f172a', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>💬 팀 메시지</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>팀 코드: {teamCode}</p>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 20,
          background: connected ? '#064e3b' : '#1e293b',
          color: connected ? '#22c55e' : '#64748b',
          fontSize: 11, fontWeight: 700,
          border: `1px solid ${connected ? '#22c55e33' : '#33415544'}`,
        }}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ margin: 0, fontSize: 14 }}>아직 메시지가 없어요<br/>첫 메시지를 보내보세요!</p>
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.sender === myName;
          const showSender = i === 0 || messages[i - 1].sender !== m.sender;
          return (
            <div key={m.id} style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {showSender && (
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 3, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                  {ROLE_EMOJI[m.role] ?? ''} {m.sender}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{
                  maxWidth: '72%', padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
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
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', background: '#0f172a', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="메시지 입력..."
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 24,
            border: '1.5px solid #334155', background: '#1e293b',
            color: '#f8fafc', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || !connected} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: input.trim() && connected ? '#3b82f6' : '#1e293b',
          color: '#fff', fontSize: 18, cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>↑</button>
      </div>
    </div>
  );
}
