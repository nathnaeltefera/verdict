import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { palette, radius, shadow, space, type as typo } from '../theme';

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'plain' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const tones: Record<string, ViewStyle> = {
    plain: { backgroundColor: palette.surface, borderColor: palette.line },
    good: { backgroundColor: palette.goodSoft, borderColor: '#BFE3C9' },
    warn: { backgroundColor: palette.warnSoft, borderColor: '#F0D7A8' },
    bad: { backgroundColor: palette.badSoft, borderColor: '#F1C4C4' },
    accent: { backgroundColor: palette.accentSoft, borderColor: '#F6D3BC' },
  };
  return <View style={[styles.card, tones[tone], style]}>{children}</View>;
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{String(children).toUpperCase()}</Text>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const variants: Record<string, { box: ViewStyle; text: TextStyle }> = {
    primary: { box: { backgroundColor: palette.accent }, text: { color: '#FFFFFF' } },
    secondary: {
      box: { backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.lineStrong },
      text: { color: palette.text },
    },
    ghost: { box: { backgroundColor: 'transparent' }, text: { color: palette.accent } },
    danger: { box: { backgroundColor: palette.badSoft }, text: { color: palette.bad } },
  };
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        v.box,
        pressed && !inactive ? styles.buttonPressed : null,
        inactive ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color as string} />
      ) : (
        <Text style={[styles.buttonText, v.text]} numberOfLines={1}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: palette.surfaceAlt, fg: palette.textSoft },
    good: { bg: palette.goodSoft, fg: palette.good },
    warn: { bg: palette.warnSoft, fg: palette.warn },
    bad: { bg: palette.badSoft, fg: palette.bad },
    accent: { bg: palette.accentSoft, fg: palette.accent },
  };
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Row({
  label,
  value,
  hint,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const color = tone === 'good' ? palette.good : tone === 'warn' ? palette.warn : tone === 'bad' ? palette.bad : undefined;
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={[typo.body, { color: emphasis ? palette.text : palette.textSoft }, emphasis && { fontWeight: '700' }]}>
          {label}
        </Text>
        {hint ? <Text style={[typo.small, { color: palette.textFaint, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      <Text
        style={[
          typo.body,
          typo.mono,
          { color: color ?? palette.text, fontWeight: emphasis ? '800' : '600' },
          emphasis && { fontSize: 17 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const done = pct >= 1;
  return (
    <View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct * 100}%`, backgroundColor: done ? palette.good : palette.accent },
          ]}
        />
      </View>
      {label ? (
        <Text style={[typo.small, { color: done ? palette.good : palette.textSoft, marginTop: 6 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={[typo.title, { color: palette.text, marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typo.body, { color: palette.textSoft, marginTop: space.sm, textAlign: 'center', lineHeight: 22 }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    ...shadow.card,
  },
  sectionLabel: {
    ...typo.tiny,
    color: palette.textFaint,
    marginBottom: space.sm,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: space.md,
  },
  rowLabel: { flex: 1 },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
});
