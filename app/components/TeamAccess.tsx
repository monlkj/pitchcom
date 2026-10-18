'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  useEffect(() => {
    setAllowedPath('');
    if (path === '/login') { setAllowedPath(path); return; }
    try {
      const session = JSON.parse(localStorage.getItem('pitchcom-session') || 'null');
      if (!session) { router.replace('/login'); return; }
      migrateTeamCache();
      if (path !== '/' && (!session.teamCode || (session.role !== 'manager' && session.joinApproved !== true))) {
        router.replace('/'); return;
      }
      setAllowedPath(path);
    } catch { router.replace('/login'); }
  }, [path, router]);
  return allowedPath === path ? children : null;
}
