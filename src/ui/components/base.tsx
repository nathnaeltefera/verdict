import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { fonts, hairline, palette, radius, shadow, space, tones, type as typo, type Tone } from '../theme';
import { ReceiptEdge } from './ReceiptEdge';

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
}) {
  const t = tones[tone];
  return (
    <View style={[styles.card, { backgroundColor: t.bg, borderColor: t.line }, style]}>{children}</View>
  );
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
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const variants: Record<string, { box: ViewStyle; text: TextStyle }> = {
    primary: { box: { backgroundColor: palette.accent }, text: { color: palette.onAccent } },
    secondary: {
      box: { backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.lineStrong },
      text: { color: palette.text },
    },
    ghost: { box: { backgroundColor: 'transparent' }, text: { color: palette.accent } },
    danger: { box: { backgroundColor: palette.badSoft }, text: { color: palette.bad } },
  };
  const v = variants[variant];

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 44, bounciness: 4 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={inactive}
        style={[styles.button, v.box, inactive ? styles.buttonDisabled : null]}
      >
        {loading ? (
          <ActivityIndicator color={v.text.color as string} />
        ) : (
          <View style={styles.buttonInner}>
            {icon}
            <Text style={[styles.buttonText, v.text]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
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
        <Text
          style={[
            typo.body,
            { color: emphasis ? palette.text : palette.textSoft },
            emphasis && { fontFamily: fonts.bodySemi, fontWeight: '700' },
          ]}
        >
          {label}
        </Text>
        {hint ? <Text style={[typo.small, { color: palette.textFaint, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      <Text
        style={[
          { fontSize: 15 },
          emphasis ? typo.monoBold : typo.mono,
          { color: color ?? palette.text },
          emphasis && { fontSize: 17 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Dotted till-tape rule between the lines of a receipt breakdown. */
export function DottedRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.dottedRule, style]} />;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const done = pct >= 1;
  const [trackWidth, setTrackWidth] = useState(0);
  const fraction = useRef(new Animated.Value(pct)).current;
  const doneFade = useRef(new Animated.Value(done ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(fraction, { toValue: pct, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
    Animated.timing(doneFade, { toValue: done ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [done, doneFade, fraction, pct]);

  const translateX = fraction.interpolate({
    inputRange: [0, 1],
    outputRange: [-(trackWidth || 1), 0],
  });

  return (
    <View>
      <View style={styles.progressTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.progressFill, { backgroundColor: palette.accent, transform: [{ translateX }] }]}
        />
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: palette.good, opacity: doneFade, transform: [{ translateX }] },
          ]}
        />
      </View>
      {label ? (
        <Text style={[typo.small, { color: done ? palette.good : palette.textSoft, marginTop: 6 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

/** A little scrap of receipt paper, the visual anchor of every empty state. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.scrap}>
        <View style={styles.scrapBody}>
          <View style={styles.scrapLineWide} />
          <View style={styles.scrapLine} />
          <View style={styles.scrapLineShort} />
        </View>
        <ReceiptEdge color={palette.surface} size={6} />
      </View>
      <Text style={[typo.title, { color: palette.text, marginTop: space.lg, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typo.body, { color: palette.textSoft, marginTop: space.sm, textAlign: 'center', lineHeight: 22 }]}>
        {body}
      </Text>
    </View>
  );
}

/** Shared text input with an animated focus ring. `mono` for money fields. */
export function Input({ mono, style, ...props }: { mono?: boolean } & TextInputProps) {
  const focus = useRef(new Animated.Value(0)).current;
  const borderColor = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.line, palette.accent],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <TextInput
        placeholderTextColor={palette.textFaint}
        {...props}
        onFocus={(e) => {
          Animated.timing(focus, { toValue: 1, duration: 140, useNativeDriver: false }).start();
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          Animated.timing(focus, { toValue: 0, duration: 140, useNativeDriver: false }).start();
          props.onBlur?.(e);
        }}
        style={[styles.input, mono ? typo.mono : { fontFamily: fonts.bodyMedium }, style]}
      />
    </Animated.View>
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
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 16, fontWeight: '700' },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: space.md,
  },
  rowLabel: { flex: 1 },
  dottedRule: {
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: palette.lineStrong,
    marginVertical: space.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
  scrap: { width: 84, transform: [{ rotate: '-4deg' }], ...shadow.card },
  scrapBody: {
    backgroundColor: palette.surface,
    borderWidth: hairline,
    borderColor: palette.line,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 7,
  },
  scrapLineWide: { height: 3, borderRadius: 2, backgroundColor: palette.lineStrong, width: '90%' },
  scrapLine: { height: 3, borderRadius: 2, backgroundColor: palette.line, width: '70%' },
  scrapLineShort: { height: 3, borderRadius: 2, backgroundColor: palette.accentLine, width: '45%' },
  inputWrap: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    color: palette.text,
  },
});
