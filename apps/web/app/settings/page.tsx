'use client';

/**
 * Settings (spec §17): calm information page, minimal motion.
 * ACCOUNT / APPEARANCE / SECURITY. Appearance switches are real:
 * theme + motion + ambient + grain are applied to <html> data-attributes
 * and persisted in localStorage.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch, post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';

type Theme = 'night' | 'midnight' | 'lofi';

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
  const [theme, setTheme] = useState<Theme>('night');
  const [motion, setMotion] = useState<'full' | 'reduced'>('full');
  const [ambient, setAmbient] = useState(true);
  const [grain, setGrain] = useState(true);

  // load persisted appearance
  useEffect(() => {
    try {
      const th = localStorage.getItem('ca-theme') as Theme | null;
      const mo = localStorage.getItem('ca-motion') as 'full' | 'reduced' | null;
      const am = localStorage.getItem('ca-ambient');
      const gr = localStorage.getItem('ca-grain');
      if (th) setTheme(th);
      if (mo) setMotion(mo);
      if (am) setAmbient(am === 'on');
      if (gr) setGrain(gr === 'on');
    } catch {}
  }, []);

  // apply appearance to <html>
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.theme = theme;
    h.dataset.motion = motion;
    h.dataset.ambient = ambient ? 'on' : 'off';
    h.dataset.grain = grain ? 'on' : 'off';
    try {
      localStorage.setItem('ca-theme', theme);
      localStorage.setItem('ca-motion', motion);
      localStorage.setItem('ca-ambient', ambient ? 'on' : 'off');
      localStorage.setItem('ca-grain', grain ? 'on' : 'off');
    } catch {}
  }, [theme, motion, ambient, grain]);

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

  const Opt = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick} style={{ minWidth: 92 }}>
      {active ? '● ' : '○ '}{label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560 }}>
      <header>
        <div className="eyebrow">APPLICATION</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', margin: '4px 0 0' }}>⚙ {t.settings}</h1>
      </header>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.account} · {t.changeNick}</div>
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
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.appearance}</div>

        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6 }}>{t.theme}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Opt active={theme === 'night'} label={t.night} onClick={() => setTheme('night')} />
          <Opt active={theme === 'midnight'} label={t.midnight} onClick={() => setTheme('midnight')} />
          <Opt active={theme === 'lofi'} label={t.lofiTheme} onClick={() => setTheme('lofi')} />
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.14em', margin: '14px 0 6px' }}>{t.motion}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Opt active={motion === 'full'} label={t.full} onClick={() => setMotion('full')} />
          <Opt active={motion === 'reduced'} label={t.reduced} onClick={() => setMotion('reduced')} />
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.14em', margin: '14px 0 6px' }}>
          {t.ambient} / {t.grain}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Opt active={ambient} label={`${t.ambient}: ${ambient ? t.onLabel : t.offLabel}`} onClick={() => setAmbient(!ambient)} />
          <Opt active={grain} label={`${t.grain}: ${grain ? t.onLabel : t.offLabel}`} onClick={() => setGrain(!grain)} />
        </div>
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
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t.security} · {t.logout}</div>
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
