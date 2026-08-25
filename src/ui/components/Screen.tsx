import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, space } from '../theme';
import { Dock, DOCK_ALLOWANCE } from './Dock';

/**
 * Standard screen scaffold: paper background, scrolling content column, and an
 * optional fixed Dock the content automatically scrolls clear of.
 */
export function Screen({
  children,
  dock,
  scroll = true,
  padded = true,
  keyboardAware = false,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  dock?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboardAware?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + (dock ? DOCK_ALLOWANCE : space.xl);
  const content = [
    padded && styles.content,
    { paddingBottom: bottomPad },
    contentContainerStyle,
  ];

  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps={keyboardAware ? 'handled' : 'never'}
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, ...content]}>{children}</View>
      )}
      {dock ? <Dock>{dock}</Dock> : null}
    </View>
  );
}

/** Centered fallback body ("This bill is no longer on this phone"). */
export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
});
