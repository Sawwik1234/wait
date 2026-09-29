'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch, post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';

export default function SettingsPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setMe = useStore((s) => s.setMe);
  const toast = useStore((s) => s.toast);

  const [nick, setNick] = useState(me?.username ?? '');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');

  if (!me) {
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
        {t.authNeeded}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>{t.login}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>⚙ {t.settings}</h1>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.changeNick}</div>
        <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} />
        <button
          className="btn btn-primary"
          style={{ marginTop: 12, padding: '10px 22px' }}
          onClick={async () => {
            try {
              const updated = await patch<Me>('/users/me', { username: nick });
              setMe({ ...me, ...updated });
              toast(t.saved, 'ok');
            } catch (e) {
              toast(e instanceof Error ? e.message : t.error, 'err');
            }
          }}
        >
          {t.save}
        </button>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.changePass}</div>
        <input className="input" type="password" placeholder={t.currentPass} value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="input" type="password" placeholder={t.newPass} value={next} onChange={(e) => setNext(e.target.value)} style={{ marginTop: 10 }} />
        <button
          className="btn btn-primary"
          style={{ marginTop: 12, padding: '10px 22px' }}
          onClick={async () => {
            try {
              await patch('/users/me', { password: { current: cur, next } });
              setCur('');
              setNext('');
              toast(t.saved, 'ok');
            } catch (e) {
              toast(e instanceof Error ? e.message : t.error, 'err');
            }
          }}
        >
          {t.save}
        </button>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.logout}</div>
        <button
          className="btn btn-danger"
          style={{ padding: '10px 22px' }}
          onClick={async () => {
            await post('/auth/logout').catch(() => {});
            setMe(null);
            router.push('/');
          }}
        >
          {t.logout}
        </button>
      </section>
    </div>
  );
}
