'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SpeedgunPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [frameHeight, setFrameHeight] = useState(1200);
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === 'pitchcom-speedgun-height' && Number.isFinite(event.data.height)) {
        setFrameHeight(Math.max(300, Math.min(20000, event.data.height)));
      }
    };
    window.addEventListener('message', resize);
    return () => window.removeEventListener('message', resize);
  }, []);
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
    <main style={{ minHeight: '100dvh', background: '#0f172a' }}>
      <header style={{ padding: '18px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: '#f8fafc', background: '#0f172a', fontSize: 13 }}>
        <Link href="/" aria-label="홈으로 돌아가기" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, color: '#64748b', fontSize: 28 }}>←</Link>

      </header>
      <iframe ref={frameRef} src="/speedgun.html" title="투구 영상 구속 측정기" style={{ display: 'block', width: '100%', height: frameHeight, border: 0 }} />
    </main>
  );
}
