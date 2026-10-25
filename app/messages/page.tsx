'use client';

import { featureSession } from '../../lib/teamFeatures';
import { readChat, sendChat, hideChat, deleteChatForEveryone, type ChatMsg } from '../../lib/chatMessages';
import TeamCalendar from '../calendar/TeamCalendar';
import { teamStorage } from '../../lib/teamStorage';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

interface Notice {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  pinned?: boolean;
}

interface PollOption { id: string; label: string; }
interface Poll {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  question: string;
  options: PollOption[];
  votes: Record<string, string>;
  createdAt: string;
  closed?: boolean;
}

export default function MessagesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'chat' | 'notice' | 'poll' | 'calendar'>('chat');
  const [role, setRole] = useState('');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatLoadError, setChatLoadError] = useState('');
  const [chatStatus, setChatStatus] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ChatMsg | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chatOperation = useRef(false);
  const chatVersion = useRef(0);
  const visibleMessages = messages.filter(message => !hiddenIds.includes(message.id));
  const [notices, setNotices] = useState<Notice[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [addingNotice, setAddingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  const [addingPoll, setAddingPoll] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canEdit = role === 'manager' || role === 'coach';

  useEffect(() => {
    const initialTab = window.location.hash.slice(1);
    if (['chat', 'notice', 'poll', 'calendar'].includes(initialTab)) setTab(initialTab as 'chat' | 'notice' | 'poll' | 'calendar');
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const s = JSON.parse(raw);
    setRole(s.role ?? '');
    setMyId(String(s.id ?? ''));
    setHiddenIds(JSON.parse(teamStorage.getItem(`pitchcom-message-hidden:${s.id}`) || '[]'));
    setMyName(s.name ?? '');
    setTeamCode(s.teamCode ?? '');

    setMessages(JSON.parse(teamStorage.getItem('pitchcom-messages') || '[]'));
    setNotices(JSON.parse(teamStorage.getItem('pitchcom-notices') || '[]'));
    setPolls(JSON.parse(teamStorage.getItem('pitchcom-polls') || '[]'));

    if (s.teamCode) {
      setSyncing(true);
      Promise.all([
        syncRead(s.teamCode, 'notices'),
        syncRead(s.teamCode, 'polls'),
      ]).then(([rn, rp]) => {
        setSyncing(false);
        if (Array.isArray(rn)) { setNotices(rn); teamStorage.setItem('pitchcom-notices', JSON.stringify(rn)); }
        if (Array.isArray(rp)) { setPolls(rp); teamStorage.setItem('pitchcom-polls', JSON.stringify(rp)); }
      });
    }
  }, [router]);

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  const applyChat = (data: Awaited<ReturnType<typeof readChat>>, id: string) => {
    setMessages(previous => JSON.stringify(previous) === JSON.stringify(data.messages) ? previous : data.messages);
    setHiddenIds(previous => JSON.stringify(previous) === JSON.stringify(data.hidden) ? previous : data.hidden);
    teamStorage.setItem('pitchcom-messages', JSON.stringify(data.messages));
    teamStorage.setItem(`pitchcom-message-hidden:${id}`, JSON.stringify(data.hidden));
  };
  useEffect(() => {
    if (!teamCode || !myId || tab !== 'chat') return;
    let active = true; let reading = false;
    const refresh = async () => {
      if (reading || chatOperation.current) return;
      reading = true; const version = chatVersion.current;
      try {
        const session = featureSession();
        if (session.id !== myId || session.teamCode !== teamCode) return;
        const data = await readChat(session);
        if (active && version === chatVersion.current) { applyChat(data, myId); setChatReady(true); setChatLoadError(''); }
      } catch { if (active && version === chatVersion.current) setChatLoadError('채팅을 새로 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
      finally { reading = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [teamCode, myId, tab]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedMessage && !dialog.open) dialog.showModal();
    else if (!selectedMessage && dialog.open) dialog.close();
  }, [selectedMessage]);

  const saveNotices = async (next: Notice[]) => {
    setNotices(next);
    teamStorage.setItem('pitchcom-notices', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'notices', next);
  };

  const savePolls = async (next: Poll[]) => {
    setPolls(next);
    teamStorage.setItem('pitchcom-polls', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'polls', next);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !chatReady || chatOperation.current) return;
    chatOperation.current = true; chatVersion.current++; setChatBusy(true); setChatError(''); setChatStatus('');
    try { const data = await sendChat(text); applyChat(data, myId); setInputText(''); }
    catch { setChatError('메시지를 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { chatOperation.current = false; setChatBusy(false); }
  };
  const deleteMessage = async (scope: 'me' | 'everyone') => {
    if (!selectedMessage || !chatReady || chatOperation.current) return;
    chatOperation.current = true; chatVersion.current++; setChatBusy(true); setChatError(''); setChatStatus('');
    try {
      const data = scope === 'me' ? await hideChat(selectedMessage.id) : await deleteChatForEveryone(selectedMessage.id);
      applyChat(data, myId); setSelectedMessage(null);
      setChatStatus(scope === 'me' ? '나에게서만 메시지를 삭제했어요.' : '모두에게서 메시지를 삭제했어요.');
    } catch { setChatError('삭제를 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { chatOperation.current = false; setChatBusy(false); }
  };

  const addNotice = async () => {
    if (!noticeText.trim()) return;
    const n: Notice = { id: Date.now().toString(), authorId: myId, authorName: myName, authorRole: role, content: noticeText.trim(), createdAt: new Date().toISOString() };
    await saveNotices([n, ...notices]);
    setNoticeText('');
    setAddingNotice(false);
  };

  const deleteNotice = async (id: string) => {
    if (!confirm('공지를 삭제할까요?')) return;
    await saveNotices(notices.filter(n => n.id !== id));
  };

  const togglePin = async (id: string) => {
    await saveNotices(notices.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const addPoll = async () => {
    const opts = pollOpts.map(o => o.trim()).filter(Boolean);
    if (!pollQ.trim() || opts.length < 2) return;
    const p: Poll = { id: Date.now().toString(), authorId: myId, authorName: myName, authorRole: role, question: pollQ.trim(), options: opts.map((o, i) => ({ id: String(i), label: o })), votes: {}, createdAt: new Date().toISOString() };
    await savePolls([p, ...polls]);
    setPollQ('');
    setPollOpts(['', '']);
    setAddingPoll(false);
  };

  const vote = async (pollId: string, optId: string) => {
    const p = polls.find(p => p.id === pollId);
    if (!p || p.closed) return;
    await savePolls(polls.map(p => p.id === pollId ? { ...p, votes: { ...p.votes, [myId]: optId } } : p));
  };

  const closePoll = async (pollId: string) => {
    await savePolls(polls.map(p => p.id === pollId ? { ...p, closed: true } : p));
  };

  const deletePoll = async (id: string) => {
    if (!confirm('투표를 삭제할까요?')) return;
    await savePolls(polls.filter(p => p.id !== id));
  };

  const roleEmoji = (r: string) => r === 'manager' ? '🧢' : r === 'coach' ? '📋' : '⚾';
  const roleColor = (r: string) => r === 'manager' ? '#f59e0b' : r === 'coach' ? '#10b981' : '#3b82f6';

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const sortedNotices = [...notices].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  const TABS = [
    { key: 'chat', label: '💬 채팅' },
    { key: 'notice', label: '📢 공지' },
    { key: 'poll', label: '🗳️ 투표' },
    { key: 'calendar', label: '📅 팀 달력' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', maxWidth: 560, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.push('/home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>💬 팀 메시지</h1>
          {syncing && <span style={{ fontSize: 11, color: '#3b82f6' }}>동기화 중...</span>}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', background: '#1e293b', borderRadius: 12, padding: 4, gap: 3, marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); window.history.replaceState(null, '', `#${t.key}`); }} style={{
              flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none',
              background: tab === t.key ? (t.key === 'chat' ? '#3b82f6' : t.key === 'notice' ? '#f59e0b' : t.key === 'calendar' ? '#10b981' : '#8b5cf6') : 'transparent',
              color: tab === t.key ? '#fff' : '#64748b',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'chat' && (chatError || chatLoadError) && <p role="alert" style={{ color: '#fca5a5', fontSize: 13, padding: '0 16px' }}>{chatError || chatLoadError}</p>}
      {tab === 'chat' && chatStatus && <p role="status" style={{ color: '#86efac', fontSize: 13, padding: '0 16px' }}>{chatStatus}</p>}
      {tab === 'calendar' && <section aria-label="팀 달력" style={{ padding: '0 16px' }}><TeamCalendar embedded /></section>}

      {/* ── 채팅 ── */}
      {tab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
            {chatReady && visibleMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                <p style={{ margin: 0 }}>첫 메시지를 보내보세요</p>
              </div>
            )}
            {!chatReady && <p style={{ color: '#94a3b8', fontSize: 13 }}>채팅 불러오는 중…</p>}
            {chatReady && visibleMessages.map((msg, i) => {
              const isMe = String(msg.authorId) === myId;
              const showHeader = i === 0 || visibleMessages[i - 1].authorId !== msg.authorId;
              return (
                <div key={msg.id} data-message-id={msg.id} data-owner={isMe ? 'me' : 'other'} style={{ display: 'flex', width: '100%', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginTop: showHeader && i > 0 ? 8 : 0 }}>
                  {/* 아바타 (상대방, 첫 메시지) */}
                  {!isMe && (
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: roleColor(msg.authorRole) + '33', border: `1.5px solid ${roleColor(msg.authorRole)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, visibility: showHeader ? 'visible' : 'hidden' }}>
                      {roleEmoji(msg.authorRole)}
                    </div>
                  )}
                  <div style={{ maxWidth: '82%', minWidth: 0 }}>
                    {!isMe && showHeader && (
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, paddingLeft: 2, fontWeight: 600 }}>{msg.authorName}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <button type="button" aria-label={`메시지 메뉴: ${msg.text}`} disabled={!chatReady || chatBusy} onClick={() => { setSelectedMessage(msg); setChatError(''); }} style={{ border: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0, maxWidth: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                        padding: '9px 13px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe ? '#3b82f6' : '#1e293b',
                        color: isMe ? '#fff' : '#e2e8f0',
                        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>{msg.text}</button>
                      <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{fmtTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', flexShrink: 0, display: 'flex', gap: 8 }}>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), sendMessage())}
              placeholder="메시지 입력..." maxLength={2000} disabled={chatBusy}
              style={{ flex: 1, minWidth: 0, padding: '11px 16px', borderRadius: 24, border: '1.5px solid #334155', background: '#1e293b', color: '#f8fafc', fontSize: 14, outline: 'none' }}
            />
            <button aria-label="메시지 보내기" onClick={sendMessage} disabled={!inputText.trim() || chatBusy || !chatReady} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: inputText.trim() ? '#3b82f6' : '#1e293b', color: inputText.trim() ? '#fff' : '#334155', fontSize: 18, cursor: inputText.trim() ? 'pointer' : 'default', flexShrink: 0 }}>↑</button>
          </div>
        </>
      )}

      <dialog ref={dialogRef} aria-labelledby="message-delete-title" onCancel={event => { if (chatBusy) event.preventDefault(); else setSelectedMessage(null); }} style={{ width: 'calc(100% - 40px)', maxWidth: 360, boxSizing: 'border-box', padding: 22, borderRadius: 20, border: '1px solid #475569', background: '#1e293b', color: '#f8fafc' }}>
        <h2 id="message-delete-title" style={{ margin: '0 0 12px', fontSize: 18 }}>메시지 삭제</h2>
        {selectedMessage && <>
          <p style={{ color: '#94a3b8', fontSize: 13, overflowWrap: 'anywhere', maxHeight: 90, overflowY: 'auto' }}>{selectedMessage.text}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <button autoFocus disabled={chatBusy} onClick={() => deleteMessage('me')} style={{ padding: 13, borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', cursor: 'pointer' }}>나에게서만 삭제</button>
            {String(selectedMessage.authorId) === myId && <button disabled={chatBusy} onClick={() => deleteMessage('everyone')} style={{ padding: 13, borderRadius: 10, border: 0, background: '#b91c1c', color: '#fff', cursor: 'pointer' }}>모두에게서 삭제</button>}
            {chatError && <p role="alert" style={{ color: '#fca5a5', fontSize: 13 }}>{chatError}</p>}
            <button disabled={chatBusy} onClick={() => setSelectedMessage(null)} style={{ padding: 10, border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>취소</button>
          </div>
        </>}
      </dialog>

      {/* ── 공지 ── */}
      {tab === 'notice' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {canEdit && (
            <div style={{ marginBottom: 16 }}>
              {addingNotice ? (
                <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="공지 내용을 입력하세요" rows={4}
                    style={{ ...inp, resize: 'none', lineHeight: 1.6 }} autoFocus />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addNotice} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>공지하기</button>
                    <button onClick={() => { setAddingNotice(false); setNoticeText(''); }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingNotice(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed #f59e0b44', background: 'transparent', color: '#f59e0b', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ 공지 작성</button>
              )}
            </div>
          )}
          {sortedNotices.length === 0 && !addingNotice ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📢</div>
              <p style={{ margin: 0 }}>아직 공지가 없어요</p>
            </div>
          ) : sortedNotices.map(n => (
            <div key={n.id} style={{ background: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 10, border: n.pinned ? '1.5px solid #f59e0b55' : '1.5px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: roleColor(n.authorRole) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{roleEmoji(n.authorRole)}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{n.authorName}</span>
                  {n.pinned && <span style={{ fontSize: 11, background: '#f59e0b22', color: '#f59e0b', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>📌 고정</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#475569' }}>{timeAgo(n.createdAt)}</span>
                  {canEdit && (
                    <>
                      <button onClick={() => togglePin(n.id)} style={{ background: 'none', border: 'none', color: n.pinned ? '#f59e0b' : '#475569', fontSize: 14, cursor: 'pointer', padding: 2 }}>📌</button>
                      <button onClick={() => deleteNotice(n.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 14, cursor: 'pointer', padding: 2 }}>🗑️</button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 투표 ── */}
      {tab === 'poll' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {canEdit && (
            <div style={{ marginBottom: 16 }}>
              {addingPoll ? (
                <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="투표 질문" style={inp} autoFocus />
                  {pollOpts.map((o, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <input value={o} onChange={e => setPollOpts(opts => opts.map((v, j) => j === i ? e.target.value : v))} placeholder={`선택지 ${i + 1}`} style={{ ...inp, flex: 1 }} />
                      {pollOpts.length > 2 && <button onClick={() => setPollOpts(opts => opts.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  {pollOpts.length < 5 && (
                    <button onClick={() => setPollOpts(opts => [...opts, ''])} style={{ padding: '8px', borderRadius: 9, border: '1.5px dashed #334155', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>+ 선택지 추가</button>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addPoll} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>투표 생성</button>
                    <button onClick={() => { setAddingPoll(false); setPollQ(''); setPollOpts(['', '']); }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingPoll(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed #8b5cf644', background: 'transparent', color: '#8b5cf6', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ 투표 만들기</button>
              )}
            </div>
          )}
          {polls.length === 0 && !addingPoll ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🗳️</div>
              <p style={{ margin: 0 }}>아직 투표가 없어요</p>
            </div>
          ) : polls.map(p => {
            const myVote = p.votes[myId];
            const hasVoted = !!myVote;
            const totalVotes = Object.keys(p.votes).length;
            const showResults = hasVoted || p.closed || canEdit;
            return (
              <div key={p.id} style={{ background: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{roleEmoji(p.authorRole ?? role)}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{p.authorName} · {timeAgo(p.createdAt)}</span>
                      {p.closed && <span style={{ fontSize: 11, background: '#47556944', color: '#64748b', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>마감</span>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{p.question}</div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!p.closed && <button onClick={() => closePoll(p.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>마감</button>}
                      <button onClick={() => deletePoll(p.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 14, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.options.map(opt => {
                    const count = Object.values(p.votes).filter(v => v === opt.id).length;
                    const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
                    const isMyVote = myVote === opt.id;
                    return (
                      <div key={opt.id} onClick={() => !p.closed && vote(p.id, opt.id)} style={{ borderRadius: 10, border: `1.5px solid ${isMyVote ? '#8b5cf6' : '#334155'}`, overflow: 'hidden', cursor: p.closed ? 'default' : 'pointer', position: 'relative' }}>
                        {showResults && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${isMyVote ? '#8b5cf633' : '#33415533'} ${pct}%, transparent ${pct}%)`, borderRadius: 9 }} />}
                        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                          <span style={{ fontSize: 14, fontWeight: isMyVote ? 700 : 400, color: isMyVote ? '#c4b5fd' : '#94a3b8' }}>{isMyVote && '✓ '}{opt.label}</span>
                          {showResults && <span style={{ fontSize: 13, fontWeight: 700, color: isMyVote ? '#c4b5fd' : '#64748b' }}>{pct}% ({count})</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>총 {totalVotes}명 참여{!hasVoted && !p.closed && !canEdit ? ' · 투표 후 결과 공개' : ''}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
