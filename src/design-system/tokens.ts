/**
 * Tokens Operax — redesenho usabilidade (field CRM)
 */
export const colors = {
  pageBg: '#f0f2f5',
  cardBg: '#ffffff',
  text: '#0c1222',
  textMuted: '#5c677a',
  primary: '#1e4ed8',
  primaryPressed: '#163db0',
  primarySoft: '#e8eefc',
  border: '#e5e9f0',
  chromeNavy: '#050a14',
  chromeNavySoft: '#1a314f',
  success: '#15803d',
  warn: '#c2410c',
  danger: '#dc2626',
  bubbleOut: '#1e4ed8',
  bubbleIn: '#ffffff',
  unread: '#1e4ed8',
  overlay: 'rgba(5, 10, 20, 0.45)',
  rowPress: '#e8ecf2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  control: 10,
  sheet: 16,
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
  title: 22,
  section: 17,
  body: 15,
  caption: 13,
  label: 11,
} as const;
