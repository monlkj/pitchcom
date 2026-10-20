'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { syncRead } from '../../lib/teamSync';
import { refreshDeletedAccounts } from '../../lib/accountDeletion';
import { migrateTeamCache } from '../../lib/teamStorage';

export default function TeamAccess({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [allowedPath, setAllowedPath] = useState('');
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === 'pitchcom-session') window.location.reload();
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  const [connectionError, setConnectionError] = useState(false);
  useEffect(() => {
    let active = true;
    let checking = false;
    setAllowedPath(''); setConnectionError(false);
    if (path === '/') { router.replace('/login'); return; }
    if (path === '/login') { setAllowedPath(path); return; }
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const rawSession = localStorage.getItem('pitchcom-session');
        let session;
        try { session = JSON.parse(rawSession || 'null'); } catch { session = null; }
        if (!session || typeof session.id !== 'string' || !session.id.trim() || !['manager', 'coach', 'player'].includes(session.role)) {
          if (active) {
            localStorage.removeItem('pitchcom-session');
            setAllowedPath(''); router.replace('/login');
          }
          return;
        }
        const deleted = await refreshDeletedAccounts();
        if (!active) return;
        if (deleted.has(session.id)) {
          localStorage.removeItem('pitchcom-session');
          setAllowedPath(''); router.replace('/login'); return;
        }
        const users = await syncRead('__global__', 'users', true);
        if (!active || localStorage.getItem('pitchcom-session') !== rawSession) return;
        const remote = Array.isArray(users) ? users.find((user: { id: string }) => user.id === session.id) : null;
        if (remote && (session.teamCode !== remote.teamCode || session.joinApproved !== remote.joinApproved || session.joinRequestId !== remote.joinRequestId || session.removalNotice?.id !== remote.removalNotice?.id)) {
          migrateTeamCache();
          localStorage.setItem('pitchcom-session', JSON.stringify({ ...session, teamCode: remote.teamCode, joinApproved: remote.joinApproved, joinRequestId: remote.joinRequestId, removalNotice: remote.removalNotice }));
          window.location.assign('/home'); return;
        }
        migrateTeamCache();
        if (path !== '/home' && (!session.teamCode || (session.role !== 'manager' && session.joinApproved !== true))) {
          router.replace('/home'); return;
        }
        setConnectionError(false); setAllowedPath(path);
      } catch { if (active) { setAllowedPath(''); setConnectionError(true); } }
      finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(check, 15000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('online', check); };
  }, [path, router]);
  if (connectionError) return <p role="alert" style={{ padding: 24, color: '#cbd5e1' }}>계정 상태를 확인할 수 없습니다. 인터넷 연결을 확인해 주세요. 연결되면 다시 확인합니다.</p>;

  return allowedPath === path ? children : null;
}
