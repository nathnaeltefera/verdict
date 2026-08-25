import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, shadow, space, type as typo } from '../theme';
import { AppButton } from './base';

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}

/**
 * Cross-platform confirm dialog (native Alert.alert silently no-ops on web).
 * Backdrop fades, the card slides up with a spring.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    if (!state) return;
    backdrop.setValue(0);
    slide.setValue(48);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  }, [backdrop, slide, state]);

  const close = useCallback(
    (result: boolean) => {
      if (!state) return;
      const { resolve } = state;
      Animated.timing(backdrop, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setState(null);
        resolve(result);
      });
    },
    [backdrop, state],
  );

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={!!state} transparent animationType="none" onRequestClose={() => close(false)}>
        {state ? (
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Dismiss" />
            <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
              <Text style={[typo.title, styles.title]}>{state.title}</Text>
              {state.message ? <Text style={[typo.body, styles.message]}>{state.message}</Text> : null}
              <View style={styles.actions}>
                <AppButton
                  label={state.cancelLabel ?? 'Cancel'}
                  variant="secondary"
                  onPress={() => close(false)}
                  style={styles.action}
                />
                <AppButton
                  label={state.confirmLabel}
                  variant={state.destructive ? 'danger' : 'primary'}
                  onPress={() => close(true)}
                  style={styles.action}
                />
              </View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 20, 16, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.xl,
    ...shadow.lift,
  },
  title: { color: palette.text },
  message: { color: palette.textSoft, marginTop: space.sm, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  action: { flex: 1 },
});
