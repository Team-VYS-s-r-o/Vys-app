import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow importing TypeScript modules from the shared/ folder outside the web/ root.
  transpilePackages: [],
  typedRoutes: false,
  images: {
    remotePatterns: [
      // Supabase storage CDN if used for course/camp photos.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async redirects() {
    return [
      // Slugy měst se odvozují z názvu v adminu; tyhle tvary byly v první verzi.
      { source: '/parkour/brandys-nad-labem', destination: '/parkour/brandys', permanent: true },
      { source: '/parkour/praha-vrsovice', destination: '/parkour/vrsovice', permanent: true },
      { source: '/parkour/jesenice-zdimerice', destination: '/parkour/zdimerice', permanent: true },
      {
        source: '/app',
        destination: 'https://app.aplikacevys.cz/sign-in',
        permanent: false,
      },
      {
        source: '/app/sign-in',
        destination: 'https://app.aplikacevys.cz/sign-in',
        permanent: false,
      },
      {
        source: '/app/ucastnik',
        destination: 'https://app.aplikacevys.cz/tricks',
        permanent: false,
      },
      {
        source: '/app/trener',
        destination: 'https://app.aplikacevys.cz/coach',
        permanent: false,
      },
      {
        source: '/app/:path*',
        destination: 'https://app.aplikacevys.cz/sign-in',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
