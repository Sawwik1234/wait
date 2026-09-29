'use client';

/**
 * LofiRoom — hand-built layered scene (sky → city → window → rain →
 * room → desk → monitor → lamp → cat → foreground → particles).
 * Layers carry data-depth and are driven by <Parallax/> on mouse move.
 * Pure CSS/SVG — no external assets, degrades to a static picture
 * on touch devices and under prefers-reduced-motion.
 */

import { Parallax } from './effects';

const STARS: [number, number, number][] = [
  // left, top, delay(s)
  [12, 14, 0], [22, 8, 0.7], [33, 18, 1.4], [44, 6, 0.3], [55, 15, 1.1],
  [63, 9, 1.8], [71, 20, 0.5], [82, 12, 1.2], [90, 22, 0.9], [48, 26, 2.0],
];

const MOTES: [number, number, number][] = [
  [18, 62, 0], [36, 74, 1.6], [58, 58, 3.1], [74, 70, 0.9], [88, 64, 2.3],
];

export function LofiRoom({ height = 420, style }: { height?: number | string; style?: React.CSSProperties }) {
  return (
    <Parallax className="lofi-room" style={{ height, ...style }}>
      {/* ---- sky ---- */}
      <div className="lofi-layer" data-depth="6" style={{ background: 'linear-gradient(180deg, #0b1226 0%, #0d1020 55%, #10131c 100%)' }}>
        {STARS.map(([l, t, d], i) => (
          <span key={i} className="lofi-star" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />
        ))}
        {/* moon */}
        <div style={{ position: 'absolute', right: '16%', top: '12%', width: 34, height: 34, borderRadius: 99, background: 'radial-gradient(circle at 38% 38%, #e8f2ff, #93a7c9 70%)', boxShadow: '0 0 42px 10px rgba(190, 215, 255, 0.18)' }} />
      </div>

      {/* ---- window: city + rain ---- */}
      <div className="lofi-layer" data-depth="11" style={{ inset: '7% 8% auto auto', width: '54%', height: '60%', bottom: '34%' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(180deg, #0a1122 0%, #0e1526 70%)' }}>
          {/* city skyline */}
          <svg viewBox="0 0 300 120" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '62%' }}>
            <g fill="#0c0f1a">
              <rect x="0" y="52" width="34" height="68" />
              <rect x="30" y="34" width="26" height="86" />
              <rect x="52" y="60" width="38" height="60" />
              <rect x="86" y="24" width="30" height="96" />
              <rect x="112" y="48" width="24" height="72" />
              <rect x="132" y="38" width="34" height="82" />
              <rect x="162" y="58" width="26" height="62" />
              <rect x="184" y="30" width="30" height="90" />
              <rect x="210" y="50" width="36" height="70" />
              <rect x="242" y="36" width="28" height="84" />
              <rect x="266" y="56" width="34" height="64" />
            </g>
            <g fill="#f5c97b" opacity="0.75">
              <rect x="36" y="42" width="4" height="5" /><rect x="44" y="52" width="4" height="5" />
              <rect x="92" y="34" width="4" height="5" /><rect x="100" y="48" width="4" height="5" />
              <rect x="140" y="48" width="4" height="5" /><rect x="150" y="60" width="4" height="5" />
              <rect x="190" y="40" width="4" height="5" /><rect x="198" y="56" width="4" height="5" />
              <rect x="250" y="46" width="4" height="5" /><rect x="258" y="58" width="4" height="5" />
              <rect x="8" y="62" width="4" height="5" /><rect x="120" y="58" width="4" height="5" />
            </g>
          </svg>
          {/* rain */}
          <div className="lofi-rain" />
          {/* glass sheen */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(190,220,255,.06) 0%, transparent 30%)' }} />
        </div>
        {/* window frame */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '3px solid #1c2231' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, background: '#1c2231' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: '#1c2231' }} />
      </div>

      {/* ---- room wall + poster + shelf ---- */}
      <div className="lofi-layer" data-depth="18" style={{ top: '62%', background: 'linear-gradient(180deg, #141824 0%, #0c0e15 100%)' }}>
        {/* poster */}
        <div style={{ position: 'absolute', left: '10%', top: '-46%', width: 54, height: 74, borderRadius: 4, background: 'linear-gradient(160deg, #1b2133, #12151f)', border: '1px solid #232b3d', transform: 'rotate(-3deg)', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          <div style={{ margin: '10px auto 0', width: 34, height: 18, borderRadius: 3, background: '#0b0e14', border: '1px solid #2a3349', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, border: '1.5px solid #22d3ee', display: 'inline-block' }} />
            <span style={{ width: 5, height: 5, borderRadius: 99, border: '1.5px solid #a855f7', display: 'inline-block' }} />
          </div>
          <div style={{ margin: '8px 8px 0', height: 2, background: '#232b3d' }} />
          <div style={{ margin: '5px 8px 0', height: 2, width: '60%', background: '#232b3d' }} />
        </div>
        {/* shelf */}
        <div style={{ position: 'absolute', right: '14%', top: '-18%', width: 110, height: 4, background: '#1d2433', borderRadius: 2 }}>
          <span style={{ position: 'absolute', left: 8, top: -14, width: 10, height: 14, background: '#232b3d', borderRadius: 2 }} />
          <span style={{ position: 'absolute', left: 26, top: -10, width: 8, height: 10, background: '#2a3349', borderRadius: 2 }} />
          <span style={{ position: 'absolute', left: 80, top: -12, width: 14, height: 12, background: '#1f2739', borderRadius: 2 }} />
        </div>
      </div>

      {/* ---- desk + monitor + lamp + cat ---- */}
      <div className="lofi-layer" data-depth="30">
        {/* desk */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '24%', background: 'linear-gradient(180deg, #1a1e2a 0%, #101320 100%)', borderTop: '2px solid #262d40' }} />
        {/* monitor */}
        <div style={{ position: 'absolute', left: '16%', bottom: '21%', width: '34%', maxWidth: 220 }}>
          <div className="lofi-screen-flicker" style={{ borderRadius: 8, border: '2px solid #232b3d', background: '#0a0d14', padding: '7px', boxShadow: '0 0 34px -6px rgba(34,211,238,.35)' }}>
            <div style={{ borderRadius: 5, background: 'linear-gradient(160deg, #0d1424, #0a0d16)', height: 74, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: '#e8ecf4' }}>
                <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
              </div>
              <div className="eq" aria-hidden><i /><i /><i /><i /></div>
            </div>
          </div>
          <div style={{ width: 26, height: 8, background: '#232b3d', margin: '0 auto' }} />
          <div style={{ width: 64, height: 5, background: '#1d2433', margin: '0 auto', borderRadius: 3 }} />
        </div>
        {/* lamp */}
        <div style={{ position: 'absolute', right: '18%', bottom: '24%' }}>
          <div className="lofi-lamp-glow" style={{ position: 'absolute', left: '50%', top: -30, width: 120, height: 120, transform: 'translateX(-50%)', borderRadius: 99, background: 'radial-gradient(circle, rgba(255,196,110,.22), transparent 65%)' }} />
          <div style={{ width: 34, height: 16, borderRadius: '17px 17px 4px 4px', background: 'linear-gradient(180deg, #2a3147, #1a2030)', position: 'relative', transform: 'rotate(-6deg)' }} />
          <div style={{ width: 4, height: 34, background: '#232b3d', margin: '0 auto' }} />
          <div style={{ width: 26, height: 5, background: '#1d2433', margin: '0 auto', borderRadius: 3 }} />
        </div>
        {/* cat */}
        <svg width="74" height="34" viewBox="0 0 74 34" style={{ position: 'absolute', right: '38%', bottom: '22.5%', opacity: 0.9 }}>
          <path d="M6 30 Q4 22 12 20 Q16 12 26 13 Q30 8 36 10 L40 6 L44 10 Q52 9 56 15 Q68 16 68 24 Q68 30 60 30 Z" fill="#0d1017" stroke="#1d2433" strokeWidth="1.5" />
          <circle cx="42" cy="14" r="1.4" fill="#22d3ee" opacity="0.9" />
        </svg>
      </div>

      {/* ---- foreground + particles ---- */}
      <div className="lofi-layer" data-depth="44" style={{ pointerEvents: 'none' }}>
        <svg viewBox="0 0 90 120" style={{ position: 'absolute', left: -12, bottom: -6, width: 110, height: 150, opacity: 0.9 }}>
          <path d="M30 118 Q26 84 12 62 Q30 70 36 92 Q38 66 30 40 Q46 58 44 92 Q52 70 68 60 Q56 84 48 118 Z" fill="#101623" stroke="#1a2233" strokeWidth="1.5" />
        </svg>
        {MOTES.map(([l, t, d], i) => (
          <span key={i} className="lofi-mote" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />
        ))}
        <div className="vignette" style={{ position: 'absolute', inset: 0 }} />
      </div>
    </Parallax>
  );
}
