import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LOMYAD, MESSANTA_COFFEE } from '../src/core/fixtures';
import { isConfigured, readReceipt, ReceiptReadError } from '../src/data/ocr';
import { useBills } from '../src/data/store';
import { AppButton, Card, SectionLabel } from '../src/ui/components/base';
import { palette, radius, space, type as typo } from '../src/ui/theme';

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

  const handle = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      setPreview(asset.uri);
      setError(null);
      setBusy(true);
      try {
        if (!asset.base64) throw new ReceiptReadError('That image came back empty. Try again.');
        const receipt = await readReceipt(asset.base64, asset.mimeType ?? 'image/jpeg');
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
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) await handle(result.assets[0]);
  }, [handle]);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      mediaTypes: ['images'],
      exif: false,
    });
    if (!result.canceled && result.assets[0]) await handle(result.assets[0]);
  }, [handle]);

  const openSample = (which: 'messanta' | 'lomyad') => {
    const receipt = which === 'messanta' ? MESSANTA_COFFEE : LOMYAD;
    const bill = createBill({ ...receipt, id: `${receipt.id}-${Date.now()}` });
    router.replace(`/bill/${bill.id}/review`);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.frame}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.framePlaceholder}>
            <Text style={{ fontSize: 46 }}>🧾</Text>
            <Text style={[typo.body, { color: palette.textSoft, marginTop: space.sm, textAlign: 'center' }]}>
              Lay the receipt flat and fill the frame.{'\n'}Rotated is fine — it gets read either way.
            </Text>
          </View>
        )}
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

      <View style={{ gap: space.sm }}>
        <AppButton label="Take a photo" icon="📷" onPress={takePhoto} disabled={busy} />
        <AppButton label="Choose from library" variant="secondary" onPress={pickPhoto} disabled={busy} />
      </View>

      {!isConfigured() ? (
        <Card tone="warn">
          <Text style={[typo.heading, { color: palette.warn }]}>Reader not connected</Text>
          <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>
            Deploy the <Text style={typo.mono}>parse-receipt</Text> function and put your Supabase URL and anon key in
            app.json under <Text style={typo.mono}>expo.extra</Text>. Until then, the two sample receipts below work
            end to end.
          </Text>
        </Card>
      ) : null}

      <SectionLabel style={{ marginTop: space.sm }}>Or start from a sample</SectionLabel>
      <View style={{ gap: space.sm }}>
        <AppButton label="Messanta Coffee · 5% service" variant="secondary" onPress={() => openSample('messanta')} />
        <AppButton label="Lomyad · mixed VAT lines" variant="secondary" onPress={() => openSample('lomyad')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  frame: {
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.lineStrong,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  framePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  preview: { width: '100%', height: '100%' },
});
