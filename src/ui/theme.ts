import { Platform } from 'react-native';

/**
 * One warm, high-contrast palette. Person colours are picked from a fixed
 * wheel so the same friend keeps the same colour everywhere in the app —
 * that colour is how you read the assign screen at a glance.
 */
export const palette = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EDE5',
  line: '#E7DED2',
  lineStrong: '#D6C9B8',
  text: '#1F1B16',
  textSoft: '#6F655A',
  textFaint: '#9C9084',
  accent: '#C2410C',
  accentSoft: '#FFF1E7',
  good: '#15803D',
  goodSoft: '#E8F6EC',
  warn: '#B45309',
  warnSoft: '#FEF3E2',
  bad: '#B91C1C',
  badSoft: '#FDECEC',
};

export const PERSON_COLORS = [
  '#E4572E',
  '#2E86AB',
  '#7B5EA7',
  '#0F8A6B',
  '#D4A017',
  '#C2185B',
  '#3F6C51',
  '#5B6ABF',
  '#B85C38',
  '#00838F',
];

export function personColor(index: number): string {
  return PERSON_COLORS[((index % PERSON_COLORS.length) + PERSON_COLORS.length) % PERSON_COLORS.length];
}

/** Initials for the avatar chips: "Nathnael Tefera" -> "NT", "Sara" -> "SA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '600' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
};

export const shadow = {
  card: {
    shadowColor: '#3B2A16',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  lift: {
    shadowColor: '#3B2A16',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
};
