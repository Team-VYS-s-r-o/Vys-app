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
