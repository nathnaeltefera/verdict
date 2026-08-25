import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Shrink a camera photo before it goes anywhere near the network.
 *
 * A 12-megapixel iPhone photo is 2–4 MB of JPEG, which is 3–5 MB once base64
 * encodes it, and uploading that over a phone connection can take minutes. The
 * Edge Function then sits waiting on a body that never fully arrives and gets
 * killed on wall-clock time — which the app could only report as "could not
 * reach the receipt reader".
 *
 * A receipt is high-contrast black text on white paper. 1600px on the long edge
 * is plenty to read it, and lands around 200–300 KB — roughly a tenth of the
 * bytes, and comfortably inside every timeout in the chain.
 */

/** Long edge, in pixels, of the image actually sent for reading. */
export const MAX_EDGE = 1600;

/** JPEG quality. 0.7 keeps the digits crisp; below ~0.5 thin receipt type mushes. */
export const COMPRESSION = 0.7;

export type PreparedImage = {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  /** Length of the base64 payload, for the size guard and for logging. */
  byteLength: number;
};

/**
 * Which dimension to pin so the *long* edge lands on MAX_EDGE. Passing the
 * wrong one turns a portrait receipt into a 1600×2133 image — smaller than the
 * original, but a third more pixels than intended.
 */
function resizeTarget(width?: number, height?: number): { width?: number; height?: number } {
  if (!width || !height) return { width: MAX_EDGE };
  if (Math.max(width, height) <= MAX_EDGE) return {}; // already small — only ever scale down
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}

export async function prepareImage(
  uri: string,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri);

  const target = resizeTarget(sourceWidth, sourceHeight);
  if (target.width || target.height) context.resize(target);

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    base64: true,
    compress: COMPRESSION,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('Could not read that photo. Try taking it again.');
  }

  return {
    base64: result.base64,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
    byteLength: result.base64.length,
  };
}
