'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const setMe = useStore((s) => s.setMe);
  const toast = useStore((s) => s.toast);
  const t = DICT[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/auth/login', { email, password });
      const me = await getMe();
      setMe(me);
      toast(`${t.signIn}: ${me.username} ✅`, 'ok');
      router.push('/cases');
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, 'err');
    } finally {
      setBusy(false);
    }
  };

  async function getMe(): Promise<Me> {
    const res = await fetch('/api/users/me', { credentials: 'include' });
    const j = await res.json();
    return j.data;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card rise-in" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>{t.login}</div>

        <label style={lbl}>{t.email}</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@casearena.local" />
        <label style={lbl}>{t.password}</label>
        <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="demo1234" />

        <button className="btn btn-primary" disabled={busy} style={{ width: '100%', padding: '12px 0', marginTop: 18, fontSize: 15 }}>
          {busy ? '…' : t.signIn}
        </button>

        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
          {t.noAccount}{' '}
          <Link href="/register" style={{ color: 'var(--accent)' }}>
            {t.register}
          </Link>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', opacity: 0.7 }}>
          demo@casearena.local / demo1234
        </div>
      </form>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 6px' };
