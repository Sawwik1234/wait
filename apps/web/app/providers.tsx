'use client';

import { useEffect } from 'react';
import { get } from '../lib/api';
import { useStore, type Me } from '../lib/store';
import { ToastHost } from '../components/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const setMe = useStore((s) => s.setMe);
  const setAuthReady = useStore((s) => s.setAuthReady);
  const setLang = useStore((s) => s.setLang);

  useEffect(() => {
    // restore language
    const m = typeof document !== 'undefined' ? document.cookie.match(/ca_lang=(ru|en)/) : null;
    if (m?.[1] === 'en') setLang('en');

    get<Me>('/users/me')
      .then((me) => setMe(me))
      .catch(() => setMe(null))
      .finally(() => setAuthReady());
  }, [setMe, setAuthReady, setLang]);

  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}
