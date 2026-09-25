// Brand tokens used by the web app.

export const Brand = {
  purple: '#9B2CFF',
  purpleDeep: '#6A1ABF',
  pink: '#EF3B9A',
  pinkDeep: '#C12878',
  orange: '#FFB21A',
  orangeDeep: '#E8920A',
  lime: '#C8FF2E',
  limeDeep: '#9DD420',
  cyan: '#2EE7D6',
  cyanDeep: '#15B5A6',
  ink: '#1A1326',
  inkSoft: '#2A1F44',
  inkDeep: '#0B0612',
  paper: '#F6F2E9',
  paperWarm: '#F0EAD8',
  cream: '#E8DDC8',
  white: '#FFFFFF',
} as const;

export const BrandGradient = {
  primary: ['#8A00FF', '#E235A8', '#FFB21A'] as const,
  primarySoft: ['rgba(138,0,255,0.16)', 'rgba(226,53,168,0.10)', 'rgba(255,178,26,0.14)'] as const,
  inkBg: ['#1A1326', '#241733', '#1A1326'] as const,
  game: ['#2EE7D6', '#9B2CFF', '#EF3B9A'] as const,
  warm: ['#FFB21A', '#EF3B9A'] as const,
  cool: ['#2EE7D6', '#9B2CFF'] as const,
  sunrise: ['#FFEDC4', '#FFD2E1', '#E2D7FF'] as const,
  meadow: ['#E5FFF7', '#F0FFD0', '#FFF6CC'] as const,
  spotlight: ['rgba(155,44,255,0.20)', 'rgba(155,44,255,0)'] as const,
} as const;

export type BrandColor = keyof typeof Brand;
export type BrandGradientName = keyof typeof BrandGradient;
