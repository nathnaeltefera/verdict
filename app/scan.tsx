import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { isConfigured, readReceipt } from '../src/data/ocr';
import { prepareImage } from '../src/data/prepareImage';
import { useBills } from '../src/data/store';
import { AppButton, Card } from '../src/ui/components/base';
import { Screen } from '../src/ui/components/Screen';
import { Stagger } from '../src/ui/components/Stagger';
import { palette, radius, space, type as typo } from '../src/ui/theme';

const FRAME_HEIGHT = 240;
const TICK = 26;

/** The four viewfinder corner ticks around the capture frame. */
function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = {
    position: 'absolute' as const,
    width: TICK,
    height: TICK,
    borderColor: palette.accent,
  };
  const map = {
    tl: { top: 10, left: 10, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: radius.sm },
    tr: { top: 10, right: 10, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: radius.sm },
    bl: { bottom: 10, left: 10, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: radius.sm },
    br: { bottom: 10, right: 10, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: radius.sm },
  };
  return <View pointerEvents="none" style={[base, map[position]]} />;
}

/** The sweeping line that shows the reader working through the photo. */
function ScanLine() {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [8, FRAME_HEIGHT - 10] });

  return (
    <Animated.View pointerEvents="none" style={[styles.scanLine, { transform: [{ translateY }] }]}>
      <View style={styles.scanLineGlow} />
      <View style={styles.scanLineCore} />
    </Animated.View>
  );
}

/**
 * Photo -> line items. The photo is kept locally so the bill can be checked
 * back against the paper; only the image bytes go to the reader function.
 */
export default function Scan() {
  const router = useRouter();
  const { createBill } = useBills();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Nothing behind the camera until the reader function is deployed, so don't
  // let someone photograph a receipt we already know we cannot read.
  const ready = isConfigured();

  const handle = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      setPreview(asset.uri);
      setError(null);
      setBusy(true);
      try {
        // Shrink first. A full-resolution photo is too many bytes to upload
        // from a phone before something in the chain gives up.
        const prepared = await prepareImage(asset.uri, asset.width, asset.height);
        const receipt = await readReceipt(prepared.base64, prepared.mimeType);
        const bill = createBill(receipt, asset.uri);
        router.replace(`/bill/${bill.id}/review`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong reading that receipt.');
      } finally {
        setBusy(false);
      }
    },
    [createBill, router],
  );

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Verdict needs camera access to read a receipt. You can enable it in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) await handle(result.assets[0]);
  }, [handle]);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsEditing: true,
      mediaTypes: ['images'],
      exif: false,
    });
    if (!result.canceled && result.assets[0]) await handle(result.assets[0]);
  }, [handle]);

  return (
    <Screen>
      <Stagger>
        <View style={styles.frame}>
          {preview ? (
            <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.framePlaceholder}>
              <Text style={[typo.tiny, { color: palette.textFaint }]}>RECEIPT GOES HERE</Text>
              <Text style={[typo.body, { color: palette.textSoft, marginTop: space.sm, textAlign: 'center' }]}>
                {ready
                  ? 'Lay the receipt flat and fill the frame.\nRotated is fine — it gets read either way.'
                  : 'Once the reader is connected, a photo of the receipt lands here.'}
              </Text>
            </View>
          )}
          <Corner position="tl" />
          <Corner position="tr" />
          <Corner position="bl" />
          <Corner position="br" />
          {busy ? <ScanLine /> : null}
        </View>

        {busy ? (
          <Card tone="accent">
            <Text style={[typo.heading, { color: palette.accent }]}>Reading the receipt…</Text>
            <Text style={[typo.small, { color: palette.textSoft, marginTop: 4 }]}>
              Pulling out each line, its price, and whether it was taxed.
            </Text>
          </Card>
        ) : null}

        {error ? (
          <Card tone="bad">
            <Text style={[typo.heading, { color: palette.bad }]}>Couldn’t read that one</Text>
            <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>{error}</Text>
          </Card>
        ) : null}

        {!ready ? (
          <Card tone="warn">
            <Text style={[typo.heading, { color: palette.warn }]}>Reader not connected yet</Text>
            <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>
              Photographing a receipt needs the <Text style={typo.mono}>parse-receipt</Text> function deployed, with your
              Supabase URL and anon key in app.json under <Text style={typo.mono}>expo.extra</Text>. Everything else —
              assigning, splitting, settling — already works on any bill you have.
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: space.sm }}>
          <AppButton
            label={ready ? 'Take a photo' : 'Take a photo — needs the reader'}
            variant={ready ? 'primary' : 'secondary'}
            onPress={takePhoto}
            disabled={busy || !ready}
          />
          <AppButton
            label="Choose from library"
            variant="secondary"
            onPress={pickPhoto}
            disabled={busy || !ready}
          />
        </View>

      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: FRAME_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  framePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  preview: { width: '100%', height: '100%' },
  scanLine: { position: 'absolute', left: 12, right: 12, top: 0, alignItems: 'stretch' },
  scanLineGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -7,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.accent,
    opacity: 0.16,
  },
  scanLineCore: { height: 2, borderRadius: 1, backgroundColor: palette.accent },
});
