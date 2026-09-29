import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Shell } from '../components/shell';

export const metadata: Metadata = {
  title: {
    default: 'CaseArena — коллекционная игровая платформа',
    template: '%s · CaseArena',
  },
  description:
    'Открывай виртуальные кейсы, апгрейди предметы и собирай коллекцию. Бесплатный игровой симулятор: Arena Points не имеют денежной стоимости.',
  openGraph: {
    title: 'CaseArena',
    description: 'Кейсы, апгрейды и контракты — честный игровой симулятор без реальных денег.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b0e14',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
