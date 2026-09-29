import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/cases', '/cases/*', '/leaderboard', '/profile/*'],
        disallow: ['/admin', '/api/*', '/settings', '/support'],
      },
    ],
  };
}
