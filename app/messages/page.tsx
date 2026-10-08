'use client';

import { useState, useEffect } from 'react';
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
  question: string;
  options: PollOption[];
  votes: Record<string, string>;
  createdAt: string;
  closed?: boolean;
}

export default function MessagesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'notice' | 'poll'>('notice');
  const [role, setRole] = useState('');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [addingNotice, setAddingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  const [addingPoll, setAddingPoll] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);

  const canEdit = role === 'manager' || role === 'coach';

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    if (!raw) { router.push('/login'); return; }
    const s = JSON.parse(raw);
    setRole(s.role ?? '');
    setMyId(s.id ?? '');
    setMyName(s.name ?? '');
    setTeamCode(s.teamCode ?? '');

    const cachedN = JSON.parse(localStorage.getItem('pitchcom-notices') || '[]');
    const cachedP = JSON.parse(localStorage.getItem('pitchcom-polls') || '[]');
    setNotices(cachedN);
    setPolls(cachedP);

    if (s.teamCode) {
      setSyncing(true);
      Promise.all([syncRead(s.teamCode, 'notices'), syncRead(s.teamCode, 'polls')]).then(([rn, rp]) => {
        setSyncing(false);
        if (Array.isArray(rn)) { setNotices(rn); localStorage.setItem('pitchcom-notices', JSON.stringify(rn)); }
        if (Array.isArray(rp)) { setPolls(rp); localStorage.setItem('pitchcom-polls', JSON.stringify(rp)); }
      });
    }
  }, [router]);

  const saveNotices = async (next: Notice[]) => {
    setNotices(next);
    localStorage.setItem('pitchcom-notices', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'notices', next);
  };

  const savePolls = async (next: Poll[]) => {
    setPolls(next);
    localStorage.setItem('pitchcom-polls', JSON.stringify(next));
    if (teamCode) await syncWrite(teamCode, 'polls', next);
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
    const p: Poll = { id: Date.now().toString(), authorId: myId, authorName: myName, question: pollQ.trim(), options: opts.map((o, i) => ({ id: String(i), label: o })), votes: {}, createdAt: new Date().toISOString() };
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

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  const sortedNotices = [...notices].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>💬 팀 메시지</h1>
        {syncing && <span style={{ fontSize: 11, color: '#3b82f6' }}>동기화 중...</span>}
      </div>

      <div style={{ display: 'flex', background: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 }}>
        {(['notice', 'poll'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: tab === t ? '#3b82f6' : 'transparent', color: tab === t ? '#fff' : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {t === 'notice' ? '📢 공지' : '🗳️ 투표'}
          </button>
        ))}
      </div>

      {/* ── 공지 ── */}
      {tab === 'notice' && (
        <>
          {canEdit && (
            <div style={{ marginBottom: 16 }}>
              {addingNotice ? (
                <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="공지 내용을 입력하세요" rows={4}
                    style={{ ...inp, resize: 'none', lineHeight: 1.6 }} autoFocus />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addNotice} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>공지하기</button>
                    <button onClick={() => { setAddingNotice(false); setNoticeText(''); }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingNotice(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed #334155', background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ 공지 작성</button>
              )}
            </div>
          )}

          {sortedNotices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📢</div>
              <p style={{ margin: 0 }}>아직 공지가 없어요</p>
            </div>
          ) : sortedNotices.map(n => (
            <div key={n.id} style={{ background: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 10, border: n.pinned ? '1.5px solid #f59e0b44' : '1.5px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{roleEmoji(n.authorRole)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{n.authorName}</span>
                  {n.pinned && <span style={{ fontSize: 11, background: '#f59e0b33', color: '#f59e0b', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>📌 고정</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#475569' }}>{timeAgo(n.createdAt)}</span>
                  {canEdit && (
                    <>
                      <button onClick={() => togglePin(n.id)} style={{ background: 'none', border: 'none', color: n.pinned ? '#f59e0b' : '#475569', fontSize: 14, cursor: 'pointer' }}>📌</button>
                      <button onClick={() => deleteNotice(n.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 14, cursor: 'pointer' }}>🗑️</button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.content}</p>
            </div>
          ))}
        </>
      )}

      {/* ── 투표 ── */}
      {tab === 'poll' && (
        <>
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
                <button onClick={() => setAddingPoll(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed #334155', background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ 투표 만들기</button>
              )}
            </div>
          )}

          {polls.length === 0 ? (
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
                      <span style={{ fontSize: 14 }}>{roleEmoji(p.authorRole ?? role)}</span>
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
                        {showResults && (
                          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${isMyVote ? '#8b5cf633' : '#33415533'} ${pct}%, transparent ${pct}%)`, borderRadius: 9 }} />
                        )}
                        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                          <span style={{ fontSize: 14, fontWeight: isMyVote ? 700 : 400, color: isMyVote ? '#c4b5fd' : '#94a3b8' }}>
                            {isMyVote && '✓ '}{opt.label}
                          </span>
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
        </>
      )}
    </div>
  );
}
