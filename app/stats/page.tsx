'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRead, syncWrite } from '../../lib/teamSync';

const PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f43f5e'];
const getColor = (i: number) => PALETTE[i % PALETTE.length];

interface PitchRecord { pitch: string; pitcher: string; result?: 'strike' | 'ball' | 'foul'; date: string; time: number; }

function calcStats(recs: PitchRecord[]) {
  const total = recs.length;
  const withResult = recs.filter(r => r.result);
  // 파울은 스트라이크로 합산
  const strikes = withResult.filter(r => r.result === 'strike' || r.result === 'foul').length;
  const fouls = withResult.filter(r => r.result === 'foul').length;
  const balls = withResult.filter(r => r.result === 'ball').length;
  const strikePct = withResult.length ? Math.round((strikes / withResult.length) * 100) : null;

  const pitchMap: Record<string, { total: number; strikes: number; balls: number; fouls: number }> = {};
  recs.forEach(r => {
    if (!pitchMap[r.pitch]) pitchMap[r.pitch] = { total: 0, strikes: 0, balls: 0, fouls: 0 };
    pitchMap[r.pitch].total++;
    if (r.result === 'strike' || r.result === 'foul') pitchMap[r.pitch].strikes++;
    if (r.result === 'foul') pitchMap[r.pitch].fouls++;
    if (r.result === 'ball') pitchMap[r.pitch].balls++;
  });

  const pitches = Object.entries(pitchMap)
    .map(([label, v]) => ({
      label,
      count: v.total,
      pct: total ? Math.round((v.total / total) * 100) : 0,
      strikes: v.strikes,
      fouls: v.fouls,
      balls: v.balls,
      strikePct: (v.strikes + v.balls) ? Math.round((v.strikes / (v.strikes + v.balls)) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count);

  return { total, strikes, fouls, balls, strikePct, withResult: withResult.length, pitches };
}

export default function StatsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PitchRecord[]>([]);
  const [expandedPitcher, setExpandedPitcher] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-session');
    const session = raw ? JSON.parse(raw) : {};
    const code = session.teamCode ?? '';
    setTeamCode(code);
    setIsManager(session.role === 'manager');

    // localStorage 캐시 우선 표시
    try {
      const local = localStorage.getItem('pitchcom-stats');
      if (local) setRecords(JSON.parse(local) as PitchRecord[]);
    } catch {}

    // Supabase 동기화
    if (code) {
      setSyncing(true);
      syncRead(code, 'pitch-stats').then(remote => {
        setSyncing(false);
        if (remote && Array.isArray(remote) && remote.length > 0) {
          setRecords(remote);
          localStorage.setItem('pitchcom-stats', JSON.stringify(remote));
        }
      });
    }
  }, []);

  const clearStats = () => {
    if (!confirm('통계를 모두 초기화할까요?')) return;
    localStorage.removeItem('pitchcom-stats');
    setRecords([]);
    syncWrite(teamCode, 'pitch-stats', []);
  };

  const pitcherNames = Array.from(new Set(records.map(r => r.pitcher || '(이름 없음')));
  const overall = calcStats(records);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>📊 투구 통계</h1>
        {syncing && <span style={{ fontSize: 11, color: '#3b82f6' }}>동기화 중...</span>}
        {isManager && records.length > 0 && (
          <button onClick={clearStats} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid #dc2626', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>초기화</button>
        )}
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ margin: 0, fontSize: 15 }}>아직 기록된 투구가 없어요</p>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>신호 전송 화면에서 구종을 선택해보세요</p>
        </div>
      ) : (
        <>
          {/* ── 전체 요약 ── */}
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569', fontWeight: 700 }}>전체 요약</p>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                ['총 투구', overall.total, '#f8fafc'],
                ['투수', pitcherNames.length, '#60a5fa'],
                ['구종', overall.pitches.length, '#a78bfa'],
              ].map(([label, val, color], i, arr) => (
                <div key={label as string} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #334155' : 'none' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: color as string }}>{val as number}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label as string}</div>
                </div>
              ))}
            </div>
            {overall.withResult > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>🔥 스트라이크 {overall.strikes} ({overall.strikePct}%){overall.fouls > 0 ? ` (파울 ${overall.fouls})` : ''}</span>
                  <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>💧 볼 {overall.balls}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#0f172a', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${overall.strikePct}%`, background: '#ef4444', transition: 'width 0.6s' }} />
                  <div style={{ flex: 1, background: '#3b82f6' }} />
                </div>
              </div>
            )}
          </div>

          {/* ── 선수별 카드 ── */}
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#475569', fontWeight: 700 }}>선수별 통계</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pitcherNames.map(name => {
              const recs = records.filter(r => (r.pitcher || '(이름 없음)') === name);
              const s = calcStats(recs);
              const isOpen = expandedPitcher === name;
              return (
                <div key={name} style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: isOpen ? '1.5px solid #3b82f644' : '1.5px solid transparent' }}>
                  {/* 카드 헤더 */}
                  <button onClick={() => setExpandedPitcher(isOpen ? null : name)} style={{
                    width: '100%', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚾</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        총 {s.total}구 · {s.pitches.length}구종
                        {s.strikePct !== null ? ` · S% ${s.strikePct}%` : ''}
                      </div>
                    </div>
                    {/* 미니 구종 도트 */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 80, justifyContent: 'flex-end' }}>
                      {s.pitches.slice(0, 4).map((p, i) => (
                        <div key={p.label} style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(i) }} title={p.label} />
                      ))}
                      {s.pitches.length > 4 && <div style={{ fontSize: 10, color: '#475569' }}>+{s.pitches.length - 4}</div>}
                    </div>
                    <span style={{ color: '#334155', fontSize: 16, flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
                  </button>

                  {/* 펼쳐진 상세 */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #0f172a', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* 스트라이크/볼 */}
                      {s.withResult > 0 && (
                        <div>
                          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <div style={{ flex: 1, background: '#0f172a', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{s.strikes}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>🔥 S {s.strikePct}%{s.fouls > 0 ? ` (파울 ${s.fouls})` : ''}</div>
                            </div>
                            <div style={{ flex: 1, background: '#0f172a', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6' }}>{s.balls}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>💧 볼 {100 - (s.strikePct ?? 0)}%</div>
                            </div>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: '#0f172a', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${s.strikePct}%`, background: '#ef4444', transition: 'width 0.6s' }} />
                            <div style={{ flex: 1, background: '#3b82f6' }} />
                          </div>
                        </div>
                      )}

                      {/* 구종별 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {s.pitches.map((p, i) => (
                          <div key={p.label}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getColor(i), flexShrink: 0 }} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.label}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                {p.strikePct !== null && (
                                  <span style={{ fontSize: 11, color: '#64748b' }}>S {p.strikePct}%</span>
                                )}
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.pct}%</span>
                                <span style={{ fontSize: 15, fontWeight: 900, color: getColor(i) }}>{p.count}구</span>
                              </div>
                            </div>
                            <div style={{ height: 5, borderRadius: 3, background: '#0f172a', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.pct}%`, background: getColor(i), borderRadius: 3, transition: 'width 0.6s' }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 최근 5구 */}
                      {(() => {
                        const recent = [...recs].sort((a, b) => b.time - a.time).slice(0, 5);
                        return (
                          <div>
                            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#475569', fontWeight: 700 }}>최근 투구</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {recent.map((r, i) => {
                                const pitchIdx = s.pitches.findIndex(p => p.label === r.pitch);
                                return (
                                  <div key={r.time + i} style={{
                                    padding: '5px 10px', borderRadius: 20,
                                    background: '#0f172a',
                                    border: `1px solid ${r.result === 'strike' ? '#ef444444' : r.result === 'foul' ? '#f59e0b44' : r.result === 'ball' ? '#3b82f644' : '#334155'}`,
                                    fontSize: 12, fontWeight: 700,
                                    color: r.result === 'strike' ? '#ef4444' : r.result === 'foul' ? '#f59e0b' : r.result === 'ball' ? '#60a5fa' : '#64748b',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                  }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: getColor(pitchIdx >= 0 ? pitchIdx : 0), flexShrink: 0 }} />
                                    {r.pitch}
                                    {r.result && <span style={{ opacity: 0.6 }}>{r.result === 'strike' ? ' S' : r.result === 'foul' ? ' F' : ' B'}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
