import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, shadow, space, type as typo } from '../theme';

type ToastTone = 'good' | 'neutral';
type ToastCtx = { show: (message: string, tone?: ToastTone) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/** A pill that springs up above the dock, then sinks away on its own. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; key: number } | null>(null);
  const translate = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: ToastTone = 'good') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone, key: Date.now() });
      translate.setValue(24);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 9 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translate, { toValue: 16, duration: 180, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 1800);
    },
    [opacity, translate],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 108 }]}>
          <Animated.View
            style={[
              styles.pill,
              toast.tone === 'good' ? styles.pillGood : styles.pillNeutral,
              { opacity, transform: [{ translateY: translate }] },
            ]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={[typo.small, toast.tone === 'good' ? styles.textGood : styles.textNeutral]}>
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderWidth: 1,
    ...shadow.lift,
  },
  pillGood: { backgroundColor: palette.good, borderColor: palette.good },
  pillNeutral: { backgroundColor: palette.text, borderColor: palette.text },
  textGood: { color: palette.onAccent },
  textNeutral: { color: palette.bg },
});
