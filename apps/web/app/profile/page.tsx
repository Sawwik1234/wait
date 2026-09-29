'use client';

/** /profile → own public profile page (spec §12). */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../lib/store';

export default function ProfileRedirect() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const authReady = useStore((s) => s.authReady);

  useEffect(() => {
    if (me) router.replace(`/profile/${me.username}`);
    else if (authReady) router.replace('/login');
  }, [me, authReady, router]);

  return null;
}
