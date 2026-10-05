import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://teamvys.cz';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/krouzky`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/tabory`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/workshopy`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/o-nas`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/kontakty`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/aplikace`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
