'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SpeedgunPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Follow PitchCom's existing client session convention.
    try {
      const raw = localStorage.getItem('pitchcom-session');
      if (!raw || !JSON.parse(raw)) { router.replace('/login'); return; }
      setReady(true);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  if (!ready) return <p style={{ padding: 24 }}>로그인 상태 확인 중…</p>;
  return (
    <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#071d16' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #2a5140', display: 'flex', justifyContent: 'space-between', gap: 16, color: '#edf5ef' }}>
        <Link href="/" style={{ fontWeight: 700 }}>← PitchCom 홈</Link>
        <span>⚾ 구속 측정</span>
      </header>
      <iframe src="/speedgun.html" title="투구 영상 구속 측정기" style={{ flex: 1, width: '100%', minHeight: 0, border: 0 }} />
    </main>
  );
}
