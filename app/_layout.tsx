import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BillsProvider } from '../src/data/store';
import { ConfirmProvider } from '../src/ui/components/Confirm';
import { ToastProvider } from '../src/ui/components/Toast';
import { fonts, palette } from '../src/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // If loading fails we render anyway: every text style keeps its fontWeight,
  // so the system-font fallback still reads correctly.
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <BillsProvider>
        <ToastProvider>
          <ConfirmProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.bg },
                headerShadowVisible: false,
                headerTintColor: palette.accent,
                headerBackButtonDisplayMode: 'minimal',
                headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: palette.text },
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
          </ConfirmProvider>
        </ToastProvider>
      </BillsProvider>
    </SafeAreaProvider>
  );
}
