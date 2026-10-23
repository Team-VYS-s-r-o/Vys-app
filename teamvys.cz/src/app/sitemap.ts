import type { MetadataRoute } from 'next';

import { loadCities } from '@/lib/cities';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://teamvys.cz';

/** Obnovovat spolu s městskými stránkami, ať se nové město objeví i v sitemapě. */
export const revalidate = 1800;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const cities = await loadCities();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/krouzky`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/tabory`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/workshopy`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/o-nas`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/kontakty`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/aplikace`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/ochrana-osobnich-udaju`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    // Lokální stránky pro „parkour kroužek <město>“ — hlavní vstup z vyhledávání.
    ...cities.map((city) => ({
      url: `${SITE_URL}/parkour/${city.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ];
}
