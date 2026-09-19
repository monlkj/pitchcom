'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f43f5e'];
const getColor = (i: number) => PALETTE[i % PALETTE.length];

interface Record { pitch: string; pitcher: string; result?: 'strike' | 'ball'; date: string; time: number; }

export default function StatsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<Record[]>([]);
  const [filterPitcher, setFilterPitcher] = useState('전체');
  const [pitchers, setPitchers] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('pitchcom-stats');
    if (raw) {
      const data = JSON.parse(raw) as Record[];
      setRecords(data);
      const names = Array.from(new Set(data.map(r => r.pitcher).filter(Boolean)));
      setPitchers(names);
    }
  }, []);

  const filtered = filterPitcher === '전체' ? records : records.filter(r => r.pitcher === filterPitcher);
  const total = filtered.length;

  const uniquePitches = Array.from(new Set(filtered.map(r => r.pitch)));
  const counts = uniquePitches.map(p => ({
    label: p,
    count: filtered.filter(r => r.pitch === p).length,
    pct: total ? Math.round((filtered.filter(r => r.pitch === p).length / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  const clearStats = () => {
    if (!confirm('통계를 초기화할까요?')) return;
    localStorage.removeItem('pitchcom-stats');
    setRecords([]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>📊 투구 통계</h1>
        {records.length > 0 && (
          <button onClick={clearStats} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid #dc2626', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            초기화
          </button>
        )}
      </div>

      {/* 투수 필터 */}
      {pitchers.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['전체', ...pitchers].map(name => (
            <button key={name} onClick={() => setFilterPitcher(name)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none',
              background: filterPitcher === name ? '#3b82f6' : '#1e293b',
              color: filterPitcher === name ? '#fff' : '#94a3b8',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{name}</button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ margin: 0, fontSize: 15 }}>아직 기록된 투구가 없어요</p>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>신호 전송 화면에서 구종을 선택해보세요</p>
        </div>
      ) : (
        <>
          {/* 총계 */}
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '18px 20px', marginBottom: 16, display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{total}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>총 투구</div>
            </div>
            <div style={{ width: 1, background: '#334155' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{counts[0]?.count ?? 0}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>최다 {counts[0]?.label}</div>
            </div>
            <div style={{ width: 1, background: '#334155' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{counts.length}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>구종 수</div>
            </div>
          </div>

          {/* 스트라이크 / 볼 비율 */}
          {(() => {
            const withResult = filtered.filter(r => r.result);
            const strikes = withResult.filter(r => r.result === 'strike').length;
            const balls = withResult.filter(r => r.result === 'ball').length;
            const resultTotal = withResult.length;
            if (resultTotal === 0) return null;
            const strikePct = Math.round((strikes / resultTotal) * 100);
            const ballPct = 100 - strikePct;
            return (
              <div style={{ background: '#1e293b', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>스트라이크 / 볼 비율</p>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center', background: '#0f172a', borderRadius: 12, padding: '12px 0' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>{strikes}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>🔥 스트라이크 {strikePct}%</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: '#0f172a', borderRadius: 12, padding: '12px 0' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#3b82f6' }}>{balls}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>💧 볼 {ballPct}%</div>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: '#0f172a', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${strikePct}%`, background: '#ef4444', transition: 'width 0.6s ease' }} />
                  <div style={{ width: `${ballPct}%`, background: '#3b82f6', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            );
          })()}

          {/* 구종별 바 차트 */}
          <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
            {counts.map((c, i) => (
              <div key={c.label} style={{ padding: '14px 18px', borderBottom: i < counts.length - 1 ? '1px solid #0f172a' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(i), flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{c.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{c.pct}%</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: getColor(i) }}>{c.count}구</span>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#0f172a', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${c.pct}%`, background: getColor(i), transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
