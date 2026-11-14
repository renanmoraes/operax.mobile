export const colors = {
  pageBg: '#f4f7fc',
  cardBg: '#ffffff',
  text: '#0c1222',
  textSoft: '#3d4759',
  textMuted: '#5c677a',
  primary: '#1e4ed8',
  primaryPressed: '#163db0',
  primaryDeep: '#163db0',
  primarySoft: '#e8eefc',
  primaryTint: '#e3ebff',
  primaryWash: '#eaf0ff',
  cyan: '#4fd8ff',
  cyanWash: '#ddf5ff',
  blueWash: '#d9e6ff',
  track: '#dce5f7',
  border: '#e5e9f0',
  borderSoft: '#eef1f5',
  chromeNavy: '#050a14',
  chromeNavySoft: '#1a314f',
  success: '#15803d',
  successSoft: '#e3f6ea',
  warn: '#c2410c',
  warnText: '#9a3412',
  warnSoft: '#fff4ed',
  danger: '#dc2626',
  dangerText: '#b91c1c',
  dangerSoft: '#fdecec',
  bubbleOut: '#1e4ed8',
  bubbleIn: '#ffffff',
  unread: '#1e4ed8',
  overlay: 'rgba(12, 24, 54, 0.28)',
  rowPress: '#f0f4fb',
  glass: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.95)',
} as const;

export const gradients = {
  hero: ['#ffffff', '#eef3ff', '#e2f4ff'] as const,
  heroSide: ['#e3ecff', '#eef4ff', '#dff3ff'] as const,
  brand: ['#4fd8ff', '#1e4ed8'] as const,
  media: ['#8faeff', '#1e4ed8'] as const,
  photo: ['#d3dae6', '#8e9bb2'] as const,
  warm: ['#ffffff', '#fff6ef'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  hero: 32,
  control: 18,
  sheet: 32,
  pill: 999,
} as const;

export const zIndex = {
  drawer: 40,
  sheet: 50,
  toast: 60,
} as const;

export const typography = {
  fontFamily: 'Inter_400Regular',
  fontFamilyMedium: 'Inter_500Medium',
  fontFamilySemiBold: 'Inter_600SemiBold',
  fontFamilyBold: 'Inter_700Bold',
  fontFamilyHeavy: 'Inter_800ExtraBold',
  display: 30,
  title: 22,
  section: 17,
  body: 15,
  caption: 13,
  label: 12,
} as const;

export const shadows = {
  card: {
    shadowColor: '#1e4ed8',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  hero: {
    shadowColor: '#1e4ed8',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 5,
  },
  button: {
    shadowColor: '#1e4ed8',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  nav: {
    shadowColor: '#1e4ed8',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

export const motion = {
  easeOut: [0.23, 1, 0.32, 1] as const,
  pressScale: 0.97,
  pressMs: 160,
  stagger: 50,
} as const;
