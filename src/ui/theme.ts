import { Platform } from 'react-native';

/**
 * "Thermal receipt, editorial cut" — one warm paper-and-ink palette.
 * Person colours are picked from a fixed wheel so the same friend keeps the
 * same colour everywhere in the app — that colour is how you read the assign
 * screen at a glance.
 */
export const palette = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EDE5',
  line: '#E7DED2',
  lineStrong: '#D6C9B8',
  text: '#181410',
  textSoft: '#655B4F',
  textFaint: '#9C9084',
  accent: '#C2410C',
  accentSoft: '#FFF1E7',
  accentLine: '#F6D3BC',
  onAccent: '#FFFFFF',
  good: '#15803D',
  goodSoft: '#E8F6EC',
  goodLine: '#BFE3C9',
  warn: '#B45309',
  warnSoft: '#FEF3E2',
  warnLine: '#F0D7A8',
  bad: '#B91C1C',
  badSoft: '#FDECEC',
  badLine: '#F1C4C4',
};

export type Tone = 'plain' | 'neutral' | 'good' | 'warn' | 'bad' | 'accent';

/** Single source of truth for tinted surfaces (cards, pills, banners). */
export const tones: Record<Tone, { bg: string; fg: string; line: string }> = {
  plain: { bg: palette.surface, fg: palette.text, line: palette.line },
  neutral: { bg: palette.surfaceAlt, fg: palette.textSoft, line: palette.line },
  good: { bg: palette.goodSoft, fg: palette.good, line: palette.goodLine },
  warn: { bg: palette.warnSoft, fg: palette.warn, line: palette.warnLine },
  bad: { bg: palette.badSoft, fg: palette.bad, line: palette.badLine },
  accent: { bg: palette.accentSoft, fg: palette.accent, line: palette.accentLine },
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

/**
 * Font families loaded in app/_layout.tsx. If loading fails we render anyway:
 * React Native falls back to the system family, and every `type` style below
 * keeps its fontWeight so the fallback still reads correctly.
 */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBlack: 'Fraunces_700Bold',
  body: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemi: 'PublicSans_600SemiBold',
  bodyBold: 'PublicSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_600SemiBold',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  display: {
    fontFamily: fonts.displayBlack,
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  heading: { fontFamily: fonts.bodySemi, fontSize: 17, fontWeight: '600' as const },
  body: { fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '500' as const },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, fontWeight: '600' as const },
  tiny: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
  },
  mono: {
    fontFamily: fonts.mono,
    // Fallback if the Google fonts fail to load:
    // Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })
  },
  monoBold: {
    fontFamily: fonts.monoBold,
    fontWeight: '600' as const,
  },
};

/** Shared motion tokens — core Animated only, no native deps. */
export const motion = {
  spring: { speed: 30, bounciness: 7 },
  stagger: { interval: 55, dy: 14, max: 8 },
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

/** Hairline that stays crisp on native and visible on web. */
export const hairline = Platform.OS === 'web' ? 1 : 0.75;
