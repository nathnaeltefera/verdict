import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme';

/**
 * Staggered entrance for a column of cards: each child fades in and slides up
 * in turn. The delay is capped so a 30-line receipt doesn't take seconds to
 * settle — everything past `motion.stagger.max` arrives together.
 */
function StaggerItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(motion.stagger.dy)).current;

  useEffect(() => {
    const delay = Math.min(index, motion.stagger.max) * motion.stagger.interval;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, delay, useNativeDriver: true }),
      Animated.spring(dy, { toValue: 0, delay, useNativeDriver: true, ...motion.spring }),
    ]).start();
  }, [dy, index, opacity]);

  return <Animated.View style={{ opacity, transform: [{ translateY: dy }] }}>{children}</Animated.View>;
}

export function Stagger({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, index) => (
        <StaggerItem key={(React.isValidElement(child) && child.key != null ? child.key : index) as React.Key} index={index}>
          {child}
        </StaggerItem>
      ))}
    </>
  );
}
