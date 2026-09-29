'use client';

import { LegalPage } from '../../components/legal';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

export default function TermsPage() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  return (
    <LegalPage
      title={lang === 'ru' ? 'УСЛОВИЯ СЕРВИСА' : 'TERMS OF SERVICE'}
      sections={t.legalTerms}
    />
  );
}
