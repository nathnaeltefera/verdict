import React, { useState } from 'react';
import { View } from 'react-native';
import { palette } from '../theme';

/**
 * The torn perforated edge of a till receipt, drawn with plain Views so it
 * renders identically on iOS, Android and web (no SVG dependency): a clipped
 * strip of 45deg-rotated squares in the paper colour, overhanging the edge.
 */
export function ReceiptEdge({
  color = palette.surface,
  size = 8,
  edge = 'bottom',
}: {
  color?: string;
  size?: number;
  edge?: 'top' | 'bottom';
}) {
  const [width, setWidth] = useState(0);
  const d = size * 1.5; // square side; its half-diagonal ~= size, the tooth height
  const pitch = size * 2; // horizontal distance between tooth tips
  const count = width > 0 ? Math.ceil(width / pitch) + 1 : 0;
  const centerY = edge === 'bottom' ? 0 : size; // diamond centres sit on the card-side edge

  return (
    <View
      style={{ height: size, overflow: 'hidden' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: i * pitch - d / 2,
            top: centerY - d / 2,
            width: d,
            height: d,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}
