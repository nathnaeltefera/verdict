import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, type as typo } from '../theme';

/**
 * A rubber stamp thumped diagonally across a settled bill. Mounts with an
 * overshoot scale so it lands like ink hitting paper.
 */
export function SettledStamp({
  label = 'SETTLED',
  small,
  style,
  silent,
}: {
  label?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  silent?: boolean;
}) {
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    if (!silent && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [opacity, scale, silent]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stamp,
        small && styles.stampSmall,
        { opacity, transform: [{ rotate: '-12deg' }, { scale }] },
        style,
      ]}
    >
      <Text style={[typo.tiny, small ? styles.textSmall : styles.text]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 2,
    borderColor: palette.good,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(232, 246, 236, 0.85)',
  },
  stampSmall: { borderWidth: 1.5, paddingHorizontal: 7, paddingVertical: 2 },
  text: { color: palette.good, fontSize: 13, letterSpacing: 2 },
  textSmall: { color: palette.good, fontSize: 10, letterSpacing: 1.4 },
});
