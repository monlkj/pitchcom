'use client';
import { useEffect, useState } from 'react';
import { transferGoogle } from '../../../lib/transferGoogle';
export default function TransferGoogleCallback() {
  const [message, setMessage] = useState('구글 계정 확인 중…');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await transferGoogle().auth.getUser();
        window.history.replaceState(null, '', '/account-transfer/google');
        if (error || !data.user?.email) throw new Error();
        if (active) setMessage('인증이 완료됐어요. 원래 계정 전환 화면으로 돌아가 주세요.');
        window.close();
      } catch { if (active) setMessage('구글 인증을 완료하지 못했습니다. 원래 화면에서 다시 시도해 주세요.'); }
    })();
    return () => { active = false; };
  }, []);
  return <main style={{ padding: 28, background: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}><h1 style={{ fontSize: 20 }}>계정 전환 인증</h1><p role="status">{message}</p></main>;
}
