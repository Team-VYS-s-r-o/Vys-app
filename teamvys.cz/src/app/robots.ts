import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://teamvys.cz';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/rodic', '/api/', '/checkout', '/app/', '/sign-in', '/nastaveni-hesla'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
