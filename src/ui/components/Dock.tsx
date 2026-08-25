import React, { useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hairline, motion, palette, shadow, space } from '../theme';

/** Vertical room screens must reserve so content can scroll clear of the dock. */
export const DOCK_ALLOWANCE = 110;

/**
 * The fixed action bar at the foot of a screen. Slides up on mount; on iOS it
 * rides the keyboard (the dock is absolutely positioned, so KeyboardAvoidingView
 * around the screen would fight the ScrollView instead).
 */
export function Dock({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(32)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const keyboardLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entrance, { toValue: 0, useNativeDriver: true, ...motion.spring }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [entrance, opacity]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return; // Android adjustResize moves the window; web needs nothing
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardLift, {
        toValue: -(e.endCoordinates.height - insets.bottom),
        duration: e.duration ?? 220,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardLift, {
        toValue: 0,
        duration: e.duration ?? 220,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom, keyboardLift]);

  return (
    <Animated.View
      style={[
        styles.dock,
        { paddingBottom: insets.bottom + space.md, opacity },
        { transform: [{ translateY: Animated.add(entrance, keyboardLift) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: palette.bg,
    borderTopWidth: hairline,
    borderTopColor: palette.line,
    ...shadow.lift,
  },
});
