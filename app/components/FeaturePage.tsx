'use client';
import Link from 'next/link';
export const featureStyles = {
  card: { padding: 18, borderRadius: 18, background: '#1e293b', border: '1px solid #334155', marginBottom: 16 } as React.CSSProperties,
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: 15 } as React.CSSProperties,
  button: { padding: '11px 15px', borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontSize: 14, fontWeight: 700 } as React.CSSProperties,
  primary: { padding: '12px 18px', borderRadius: 12, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 800 } as React.CSSProperties,
};
export default function FeaturePage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main style={{ minHeight: '100vh', maxWidth: 560, margin: '0 auto', padding: '0 16px 32px', boxSizing: 'border-box', background: '#0f172a', color: '#f8fafc' }}>
    <header style={{ position: 'sticky', top: 0, zIndex: 10, padding: '20px 0 16px', background: '#0f172a', display: 'flex', alignItems: 'center', gap: 16 }}>
      <Link href="/home" aria-label="홈으로 돌아가기" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 26 }}>←</Link>
      <div><h1 style={{ fontSize: 21, margin: 0, fontWeight: 900 }}>{title}</h1><p style={{ fontSize: 12, color: '#94a3b8', margin: '5px 0 0' }}>{subtitle}</p></div>
    </header>
    {children}
  </main>;
}
