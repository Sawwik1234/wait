'use client';

/**
 * VisualEngine — LO-FI CYBER ARCADE effects system.
 * Parallax · Glow · Grain · Tilt · Magnetic · CursorLight · Reveal.
 * Every effect is desktop-only and respects prefers-reduced-motion;
 * informational pages simply do not mount the heavy ones.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { DICT } from '../lib/i18n';

export const motionOk = () =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

/* ------------------------------------------------------------------ */
/* AmbientBackground — fixed non-interactive layer: grid + glow blobs  */
/* ------------------------------------------------------------------ */
export function AmbientBackground() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(700px 420px at 12% 8%, rgba(34,211,238,.05), transparent 65%),' +
            'radial-gradient(760px 480px at 88% 92%, rgba(168,85,247,.05), transparent 65%)',
        }}
      />
      <div className="vignette" style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NoiseOverlay — animated film grain above everything                 */
/* ------------------------------------------------------------------ */
export function NoiseOverlay() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (motionOk() && finePointer()) setOn(true);
  }, []);
  return on ? <div aria-hidden className="grain" /> : null;
}

/* ------------------------------------------------------------------ */
/* CursorLight — soft radial glow that follows the pointer             */
/* ------------------------------------------------------------------ */
export function CursorLight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!finePointer() || !motionOk()) return;
    const el = ref.current;
    if (!el) return;
    let tx = -9999, ty = -9999, x = tx, y = ty, raf = 0;
    const move = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; };
    const loop = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} aria-hidden className="cursor-light" style={{ top: 0, left: 0 }} />;
}

/* ------------------------------------------------------------------ */
/* Parallax — mouse-parallax container; children carry data-depth      */
/* ------------------------------------------------------------------ */
export function Parallax({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!finePointer() || !motionOk()) return;
    const el = ref.current;
    if (!el) return;
    const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-depth]'));
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const loop = () => {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      for (const l of layers) {
        const d = Number(l.dataset.depth ?? 0);
        l.style.transform = `translate3d(${(-x * d).toFixed(2)}px, ${(-y * d).toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    el.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { el.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tilt — 3D tilt wrapper (cards)                                      */
/* ------------------------------------------------------------------ */
export function Tilt({ children, max = 8, className, style }: { children: ReactNode; max?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer() || !motionOk()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-ny * max).toFixed(2)}deg) rotateY(${(nx * max).toFixed(2)}deg)`;
    };
    const leave = () => { el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)'; };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [max]);
  return (
    <div ref={ref} className={`tilt-inner ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic — element is gently pulled toward the cursor               */
/* ------------------------------------------------------------------ */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer() || !motionOk()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const leave = () => { el.style.transform = 'translate(0,0)'; };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [strength]);
  return (
    <span ref={ref} style={{ display: 'inline-flex', transition: 'transform .18s ease' }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — scroll-driven entrance                                     */
/* ------------------------------------------------------------------ */
export function Reveal({ children, className, style, delay = 0 }: { children: ReactNode; className?: string; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!motionOk()) { setSeen(true); return; }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setSeen(true)),
      { rootMargin: '-40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${seen ? 'reveal-in' : ''} ${className ?? ''}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* useScrollShift — translateY/opacity driven by window scroll         */
/* ------------------------------------------------------------------ */
export function useScrollShift(factor = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!motionOk()) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(0, ${Math.min(window.scrollY * factor, 140).toFixed(1)}px, 0)`;
        el.style.opacity = String(Math.max(1 - window.scrollY / 900, 0.35));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [factor]);
  return ref;
}

/* ------------------------------------------------------------------ */
/* LoFiPlayer — decorative mini radio (bottom-right, desktop only)     */
/* ------------------------------------------------------------------ */
const TRACKS = ['midnight.exe', 'tape deck dreams', 'neon rain', '3AM study loop', 'cassette sunset'];

export function LoFiPlayer() {
  const lang = useStore((s) => s.lang);
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0.34);
  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) => (p > 0.98 ? 0 : p + 0.004));
    }, 900);
    return () => clearInterval(iv);
  }, []);
  const next = () => { setI((v) => (v + 1) % TRACKS.length); setProgress(0); };
  const prev = () => { setI((v) => (v - 1 + TRACKS.length) % TRACKS.length); setProgress(0); };
  return (
    <div className="lofi-player glass" title={DICT[lang].radioVisual}>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-glow" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', color: 'var(--accent)' }}>{DICT[lang].radioLabel}</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, padding: 2 }} aria-label="—">—</button>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {TRACKS[i]}
          </div>
          <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-dim)' }}>
            <button onClick={prev} style={playerBtn} aria-label="prev">◀</button>
            <span className="eq" aria-hidden><i /><i /><i /><i /></span>
            <button onClick={next} style={playerBtn} aria-label="next">▶</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
          <span className="eq" aria-hidden><i /><i /><i /><i /></span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', color: 'var(--accent)' }}>{DICT[lang].radioLabel}</span>
        </button>
      )}
    </div>
  );
}

const playerBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, padding: '2px 6px',
};
