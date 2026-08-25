import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BillsProvider } from '../src/data/store';
import { palette, type as typo } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BillsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.bg },
            headerShadowVisible: false,
            headerTintColor: palette.accent,
            headerTitleStyle: { ...typo.heading, color: palette.text },
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Verdict' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan a receipt', presentation: 'modal' }} />
          <Stack.Screen name="bill/[id]/review" options={{ title: 'Check the receipt' }} />
          <Stack.Screen name="bill/[id]/people" options={{ title: "Who's here?" }} />
          <Stack.Screen name="bill/[id]/assign" options={{ title: 'Who had what' }} />
          <Stack.Screen name="bill/[id]/summary" options={{ title: 'Settle up' }} />
        </Stack>
      </BillsProvider>
    </SafeAreaProvider>
  );
}
