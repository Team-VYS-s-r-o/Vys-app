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
        destination: 'https://vys-expo-web-export.vercel.app/sign-in',
        permanent: false,
      },
      {
        source: '/app/sign-in',
        destination: 'https://vys-expo-web-export.vercel.app/sign-in',
        permanent: false,
      },
      {
        source: '/app/ucastnik',
        destination: 'https://vys-expo-web-export.vercel.app/tricks',
        permanent: false,
      },
      {
        source: '/app/trener',
        destination: 'https://vys-expo-web-export.vercel.app/coach',
        permanent: false,
      },
      {
        source: '/app/:path*',
        destination: 'https://vys-expo-web-export.vercel.app/sign-in',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
