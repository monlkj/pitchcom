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
    <main style={{ minHeight: '100dvh', paddingTop: 64, background: '#0f172a' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, background: '#0f172a' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" aria-label="홈으로 돌아가기" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 40, color: '#64748b', fontSize: 22 }}>←</Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>⚾ 구속 측정</h1>
        </div>
      </header>
      <iframe ref={frameRef} src="/speedgun.html" title="투구 영상 구속 측정기" style={{ display: 'block', width: '100%', height: frameHeight, border: 0 }} />
    </main>
  );
}
