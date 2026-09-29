'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, postIdem } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { ItemCard, Spinner } from '../../components/game';
import { Magnetic } from '../../components/effects';
import { RARITY_COLOR, useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface InvItem {
  id: string;
  isFavorite: boolean;
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
}
interface Target {
  id: string;
  slug: string;
  name: string;
  image: string;
  rarity: string;
  value: number;
  chanceBp: number;
}
interface RunRes {
  success: boolean;
  chanceShown: number;
  inputCost: number;
  target: Target;
  outputInventoryId: string | null;
}

export default function UpgradePage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const { data } = usePoll<{ items: InvItem[] }>('/inventory', 0);
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'done'>('idle');
  const [outcome, setOutcome] = useState<RunRes | null>(null);
  const [pointerDeg, setPointerDeg] = useState(0);

  const items = data?.items ?? [];
  const selItems = items.filter((x) => selected.includes(x.id));
  const sum = selItems.reduce((a, x) => a + x.item.value, 0);

  useEffect(() => {
    if (sum <= 0) {
      setTargets([]);
      return;
    }
    let stop = false;
    get<{ items: Target[] }>(`/upgrade/targets?sum=${sum}`)
      .then((r) => {
        if (!stop) setTargets(r.items);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [sum]);

  const target = useMemo(() => targets.find((x) => x.id === targetId) ?? null, [targets, targetId]);
  const chancePct = target ? (target.chanceBp / 100).toFixed(2) : null;

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]));
    setPhase('idle');
  };

  const run = async () => {
    if (!me) {
      toast(t.authNeeded, 'err');
      router.push('/login');
      return;
    }
    if (!target || selected.length === 0) return;
    setPhase('spin');
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const res = await postIdem<RunRes>('/upgrade/run', { inventoryIds: selected, targetItemId: target.id });
      setOutcome(res);
      // pointer lands in the green sector on success, red otherwise
      const winSector = (res.chanceShown / 100) * 360;
      const land = res.success ? Math.random() * winSector : winSector + Math.random() * (360 - winSector);
      const deg = 360 * (reduce ? 0 : 4) + (360 - land); // sweep then settle
      setPointerDeg((d) => d + deg);
      setTimeout(async () => {
        setPhase('done');
        const meRes = await get<{ balance: { amount: number } | null }>('/users/me').catch(() => null);
        if (meRes?.balance) setBalance(meRes.balance.amount);
        if (res.success) toast(`${t.upgradeWin}: ${res.target.name} 🎉`, 'ok');
        else toast(t.upgradeFail, 'err');
        setSelected([]);
      }, reduce ? 300 : 4900);
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
      setPhase('idle');
    }
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' }} />
      <header style={{ position: 'relative' }}>
        <div className="eyebrow">UPGRADE CORE</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 6px' }}>⚡ {t.upgrade}</h1>
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          {lang === 'ru'
            ? 'Честный шанс = (сумма предметов ÷ цена цели) × 0.95. Комиссия площадки — 5%.'
            : 'Fair chance = (item sum ÷ target price) × 0.95. House fee is 5%.'}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="upgrade-grid">
        {/* inventory picker */}
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            {t.inventory} · {selected.length}/5 · {t.sum}: <span style={{ color: 'var(--accent)' }}>{sum} AP</span>
          </div>
          {items.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>{t.emptyInventory}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {items.map((x) => {
                const sel = selected.includes(x.id);
                const c = RARITY_COLOR[x.item.rarity];
                return (
                  <div
                    key={x.id}
                    onClick={() => toggle(x.id)}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: 6,
                      borderRadius: 10,
                      border: `1px solid ${sel ? c : 'var(--border)'}`,
                      background: sel ? 'rgba(34,211,238,.08)' : 'transparent',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.item.image} alt="" style={{ width: 60, height: 44, objectFit: 'contain' }} />
                    <div style={{ fontSize: 9.5, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.item.name}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{x.item.value}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* core — sci-fi circular interface */}
        <section className="up-stage" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 210, height: 210 }}>
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: -18, borderRadius: '50%',
                border: '1px dashed rgba(255,255,255,.13)',
                animation: phase === 'spin' ? 'spin-slow 1.2s linear infinite' : 'spin-slow 30s linear infinite',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: -34, borderRadius: '50%',
                background: `radial-gradient(circle, ${(target && RARITY_COLOR[target.rarity]) || 'var(--accent)'}14, transparent 65%)`,
                filter: 'blur(6px)',
              }}
            />
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `conic-gradient(var(--success) 0 ${chancePct ? Number(chancePct) * 3.6 : 0}deg, var(--danger) ${chancePct ? Number(chancePct) * 3.6 : 0}deg 360deg)`,
                opacity: phase === 'spin' ? 1 : 0.85,
              }}
            />
            <div
              className={phase === 'spin' ? 'wheel-pointer' : ''}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `rotate(${pointerDeg}deg)`,
                transitionDuration: phase === 'spin' ? '4.6s' : '0s',
              }}
            >
              <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '16px solid #fff', filter: 'drop-shadow(0 0 6px rgba(255,255,255,.6))' }} />
            </div>
            <div style={{ position: 'absolute', inset: 26, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
              {target ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={target.image} alt="" style={{ width: 62, height: 46, objectFit: 'contain' }} />
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{chancePct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{target.name}</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>{t.selectItems} 1–5</div>
              )}
            </div>
          </div>

          <Magnetic>
            <button className="btn btn-primary" style={{ padding: '13px 38px', fontSize: 15 }} disabled={!target || phase === 'spin' || selected.length === 0} onClick={run}>
              {phase === 'spin' ? '…' : `▸ ${t.startUpgrade}`}
            </button>
          </Magnetic>

          {phase === 'done' && outcome && (
            <div className={`card round-reveal ${outcome.success ? 'glow-uncommon' : ''}`} style={{ padding: 14, textAlign: 'center', borderColor: outcome.success ? 'var(--success)' : 'var(--danger)' }}>
              <div style={{ fontWeight: 800, color: outcome.success ? 'var(--success)' : 'var(--danger)' }}>
                {outcome.success ? t.upgradeWin : t.upgradeFail}
              </div>
              {outcome.success && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {outcome.target.name} · {outcome.target.value} AP
                </div>
              )}
            </div>
          )}
        </section>

        {/* targets */}
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{t.targetItem}</div>
          {targets.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>{t.selectItems}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {targets.map((x) => {
                const sel = targetId === x.id;
                const c = RARITY_COLOR[x.rarity];
                return (
                  <div
                    key={x.id}
                    onClick={() => {
                      setTargetId(x.id);
                      setPhase('idle');
                    }}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: 6,
                      borderRadius: 10,
                      border: `1px solid ${sel ? c : 'var(--border)'}`,
                      background: sel ? 'rgba(168,85,247,.08)' : 'transparent',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.image} alt="" style={{ width: 60, height: 44, objectFit: 'contain' }} />
                    <div style={{ fontSize: 9.5, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{(x.chanceBp / 100).toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @media (max-width: 980px) {
          .upgrade-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
