import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CaseArena',
    short_name: 'CaseArena',
    description: 'Коллекционная игровая платформа: кейсы, апгрейды, контракты. Без реальных денег.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0e14',
    theme_color: '#0b0e14',
  };
}
