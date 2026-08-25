import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LOMYAD, MESSANTA_COFFEE } from '../src/core/fixtures';
import { isConfigured, readReceipt } from '../src/data/ocr';
import { prepareImage } from '../src/data/prepareImage';
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
              {ready
                ? 'Lay the receipt flat and fill the frame.\nRotated is fine — it gets read either way.'
                : 'Once the reader is connected, a photo of the receipt lands here.'}
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

      {!ready ? (
        <Card tone="warn">
          <Text style={[typo.heading, { color: palette.warn }]}>Reader not connected yet</Text>
          <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>
            Photographing a receipt needs the <Text style={typo.mono}>parse-receipt</Text> function deployed, with your
            Supabase URL and anon key in app.json under <Text style={typo.mono}>expo.extra</Text>. Everything else —
            assigning, splitting, settling — works right now on the sample receipts below.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <AppButton
          label={ready ? 'Take a photo' : 'Take a photo — needs the reader'}
          icon={ready ? '📷' : undefined}
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

      <SectionLabel style={{ marginTop: space.sm }}>
        {ready ? 'Or start from a sample' : 'Try it on a sample receipt'}
      </SectionLabel>
      <View style={{ gap: space.sm }}>
        <AppButton
          label="Messanta Coffee · 5% service"
          variant={ready ? 'secondary' : 'primary'}
          onPress={() => openSample('messanta')}
        />
        <AppButton
          label="Lomyad · mixed VAT lines"
          variant={ready ? 'secondary' : 'primary'}
          onPress={() => openSample('lomyad')}
        />
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
