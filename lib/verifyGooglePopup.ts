import { transferGoogle } from './transferGoogle';
export async function verifyGooglePopup(signal?: AbortSignal): Promise<{ token: string; email: string }> {
  const popup = window.open('about:blank', 'pitchcom-google-verification', 'width=520,height=720');
  if (!popup) throw new Error('팝업이 차단됐습니다. 이 사이트의 팝업을 허용해 주세요.');
  try {
    const auth = transferGoogle();
    await auth.auth.signOut({ scope: 'local' });
    if (signal?.aborted) throw new Error('인증이 취소되었습니다.');
    const { data, error } = await auth.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: `${window.location.origin}/account-transfer/google`, queryParams: { prompt: 'select_account' } } });
    if (error || !data.url) throw new Error('구글 인증을 시작하지 못했습니다.');
    popup.location.href = data.url;
    return await new Promise((resolve, reject) => {
      let checking = false; let count = 0;
      const stop = () => { clearInterval(timer); signal?.removeEventListener('abort', abort); popup.close(); };
      const abort = () => { stop(); reject(new Error('인증이 취소되었습니다.')); };
      const timer = setInterval(async () => {
        if (checking) return; checking = true;
        try {
          const { data: current } = await auth.auth.getSession();
          if (current.session) {
            const verified = await auth.auth.getUser();
            if (!verified.error && verified.data.user?.email) { stop(); resolve({ token: current.session.access_token, email: verified.data.user.email }); return; }
          }
          if (++count > 300 || popup.closed) { stop(); reject(new Error('구글 인증을 완료하지 못했습니다. 다시 시도해 주세요.')); }
        } catch { stop(); reject(new Error('구글 인증 상태를 확인하지 못했습니다.')); }
        finally { checking = false; }
      }, 1000);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } catch (failure) { popup.close(); throw failure; }
}
