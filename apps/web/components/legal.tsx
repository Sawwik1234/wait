'use client';

/**
 * Legal layout (spec §23): calm pages, big typography, sticky section
 * nav on the left, document body on the right. No heavy motion.
 */

import { useStore } from '../lib/store';
import { DICT } from '../lib/i18n';

export function LegalPage({ title, sections }: { title: string; sections: { h: string; ps: string[] }[] }) {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ padding: '10px 0 18px' }}>
        <div className="eyebrow">{t.legal}</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(30px, 5vw, 46px)', margin: '6px 0 0' }}>{title}</h1>
      </header>

      <div className="legal-grid">
        <nav className="legal-nav">
          {sections.map((s, i) => (
            <a key={i} href={`#s${i}`}>{s.h}</a>
          ))}
        </nav>
        <article className="legal-body">
          {sections.map((s, i) => (
            <section key={i} id={`s${i}`}>
              <h2>
                {String(i + 1).padStart(2, '0')} · {s.h}
              </h2>
              {s.ps.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </section>
          ))}
          <p style={{ marginTop: 26, opacity: 0.6 }}>CaseArena · 2026</p>
        </article>
      </div>
    </div>
  );
}
