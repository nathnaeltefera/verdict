import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { initials, palette, personColor, radius, space, type as typo } from '../theme';
import type { Person } from '../../core/types';

export function Avatar({
  person,
  size = 44,
  dimmed,
  style,
}: {
  person: Person;
  size?: number;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = personColor(person.colorIndex);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dimmed ? palette.surfaceAlt : color,
          borderWidth: dimmed ? 2 : 0,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: dimmed ? color : '#FFFFFF',
          fontSize: size * 0.36,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        {initials(person.name)}
      </Text>
    </View>
  );
}

/**
 * The tap target that puts a friend on a dish.
 *
 * Filled + ticked means "they're having this". Tapping a second person on the
 * same dish is all it takes to share it — there is no separate "split" mode to
 * find, because sharing is just more than one person being tapped.
 */
export function ClaimChip({
  person,
  claimed,
  amount,
  onPress,
  onLongPress,
  size = 52,
}: {
  person: Person;
  claimed: boolean;
  amount?: string;
  onPress: () => void;
  onLongPress?: () => void;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = personColor(person.colorIndex);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(claimed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.16, useNativeDriver: true, speed: 44, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onPress();
  }, [claimed, onPress, scale]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="switch"
      accessibilityState={{ checked: claimed }}
      accessibilityLabel={`${person.name}${claimed ? ', having this' : ', not having this'}`}
      style={styles.chip}
      hitSlop={4}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Avatar person={person} size={size} dimmed={!claimed} />
        {claimed ? (
          <View style={[styles.tick, { borderColor: palette.bg }]}>
            <Text style={styles.tickMark}>✓</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[typo.small, { color: claimed ? palette.text : palette.textFaint, marginTop: 6, maxWidth: size + 22 }]}
      >
        {person.name.split(/\s+/)[0]}
      </Text>
      {claimed && amount ? (
        <Text numberOfLines={1} style={[typo.small, typo.mono, { color, fontSize: 11, marginTop: 1 }]}>
          {amount}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Compact overlapping avatars, for showing at a glance who is on a line. */
export function AvatarStack({ people, size = 26, max = 5 }: { people: Person[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          person={person}
          size={size}
          style={{
            marginLeft: index === 0 ? 0 : -size * 0.3,
            borderWidth: 2,
            borderColor: palette.surface,
          }}
        />
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.overflow,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3 },
          ]}
        >
          <Text style={{ fontSize: size * 0.34, fontWeight: '800', color: palette.textSoft }}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', width: 74, paddingVertical: space.xs },
  tick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: palette.good,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 13 },
  overflow: {
    backgroundColor: palette.surfaceAlt,
    borderWidth: 2,
    borderColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
