import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, space, type as typo } from '../theme';

/**
 * A row of preset pills (tip rates, service-charge rates, split modes) with a
 * single active choice. The active pill pops with a small scale spring.
 */
function PresetPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 44, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.pill, active && styles.pillActive, { transform: [{ scale }] }]}>
        <Text style={[typo.small, active ? styles.textActive : styles.text]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function PresetRow<K extends string | number>({
  options,
  activeKey,
  onSelect,
  trailing,
}: {
  options: { key: K; label: string }[];
  activeKey: K | undefined;
  onSelect: (key: K) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <PresetPill
          key={String(option.key)}
          label={option.label}
          active={option.key === activeKey}
          onPress={() => onSelect(option.key)}
        />
      ))}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  text: { color: palette.textSoft },
  textActive: { color: palette.onAccent },
});
