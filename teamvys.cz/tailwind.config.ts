import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#8B1DFF',
          'purple-deep': '#5410B7',
          'purple-light': '#EFE4FF',
          pink: '#F12BB3',
          'pink-deep': '#B71482',
          orange: '#FFB21A',
          'orange-deep': '#E16B12',
          lime: '#FFE3A3',
          cyan: '#7C2DDB',
          mint: '#E879F9',
          ink: '#171220',
          'ink-soft': '#5D536F',
          'ink-deep': '#0C0714',
          paper: '#FFF9F0',
          surface: '#FFFFFF',
          'surface-alt': '#FFF1E0',
          night: '#1B1230',
          'night-deep': '#120B22',
          'night-soft': '#271A45',
          ember: '#8B1DFF',
          'ember-deep': '#5410B7',
          'ember-soft': '#F4EBFF',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8B1DFF 0%, #B23BFF 48%, #F12BB3 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, rgba(139,29,255,0.12) 0%, rgba(178,59,255,0.10) 48%, rgba(241,43,179,0.16) 100%)',
        'gradient-warm': 'linear-gradient(135deg, #F12BB3 0%, #8B1DFF 100%)',
        'gradient-cool': 'linear-gradient(135deg, #8B1DFF 0%, #F12BB3 100%)',
        'gradient-ember': 'linear-gradient(135deg, #8B1DFF 0%, #B23BFF 55%, #F12BB3 100%)',
        'gradient-night': 'linear-gradient(180deg, #1B1230 0%, #120B22 100%)',
      },
      boxShadow: {
        brand: '0 18px 40px -12px rgba(139,29,255,0.45)',
        'brand-soft': '0 10px 30px -12px rgba(139,29,255,0.25)',
        'brand-float': '0 28px 60px -20px rgba(139,29,255,0.55)',
        card: '0 12px 32px -16px rgba(23,18,32,0.18)',
        soft: '0 8px 24px -12px rgba(23,18,32,0.12)',
        float: '0 24px 48px -20px rgba(23,18,32,0.25)',
        'glow-pink': '0 0 40px rgba(241,43,179,0.45)',
        'glow-purple': '0 0 40px rgba(139,29,255,0.45)',
      },
      borderRadius: {
        brand: '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
