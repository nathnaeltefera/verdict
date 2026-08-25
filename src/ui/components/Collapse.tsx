import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * Measured accordion. LayoutAnimation is deliberately not used: it is flaky on
 * Fabric and a no-op on react-native-web, and web is a first-class target.
 * Height runs on the JS driver (per-card, cheap); the content fade rides the
 * native driver in parallel.
 */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [measured, setMeasured] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (measured === 0) return;
    const target = open ? measured : 0;
    if (first.current) {
      first.current = false;
      height.setValue(target);
      opacity.setValue(open ? 1 : 0);
      return;
    }
    Animated.parallel([
      Animated.timing(height, {
        toValue: target,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(opacity, { toValue: open ? 1 : 0, duration: open ? 220 : 140, useNativeDriver: true }),
    ]).start();
  }, [open, measured, height, opacity]);

  return (
    <Animated.View style={{ height: measured === 0 ? (open ? undefined : 0) : height, overflow: 'hidden' }}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={(e) => {
          const h = Math.ceil(e.nativeEvent.layout.height);
          if (h !== measured) setMeasured(h);
        }}
      >
        <Animated.View style={{ opacity }}>{children}</Animated.View>
      </View>
    </Animated.View>
  );
}
