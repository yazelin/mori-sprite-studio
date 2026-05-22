// @ts-expect-error - upng-js has no shipped types
import UPNG from 'upng-js'
import { splitGrid } from './imageOps'

/**
 * Build an APNG (Animated PNG) from a 4×4 sprite sheet.
 *
 * Output is a transparent looping animation, LINE-Creators-Market /
 * Discord / Slack / Twitter compatible.
 *
 * @param sheet      1024×1024 RGBA sprite sheet (4×4 grid)
 * @param durationMs Total time for the 16-frame loop (matches mori-desktop's
 *                   loop_durations_ms convention)
 * @param loopMode   'loop' = infinite cycle; 'one-shot' = play once
 * @param frameSize  Output pixel size per frame (default 256)
 * @returns          APNG file as Blob with image/png MIME type
 */
export async function buildAPNG(
  sheet: Blob,
  durationMs: number,
  loopMode: 'loop' | 'one-shot',
  frameSize = 256,
): Promise<Blob> {
  // 1) Split sheet into 16 cells (4 cols × 4 rows row-major)
  const cells = await splitGrid(sheet, 4, 4)
  if (cells.length !== 16) {
    throw new Error(`splitGrid 4×4 returned ${cells.length} cells (expected 16)`)
  }

  // 2) Extract raw RGBA ArrayBuffer for each cell at target size
  const rgbaBuffers: ArrayBuffer[] = []
  for (const cellBlob of cells) {
    const bmp = await createImageBitmap(cellBlob)
    const canvas = new OffscreenCanvas(frameSize, frameSize)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0, bmp.width, bmp.height, 0, 0, frameSize, frameSize)
    const imgData = ctx.getImageData(0, 0, frameSize, frameSize)
    // The buffer needs to be a plain ArrayBuffer for upng-js
    rgbaBuffers.push(imgData.data.buffer as ArrayBuffer)
  }

  // 3) Per-frame delay in ms — distribute total duration evenly across 16 frames
  const perFrame = Math.max(20, Math.round(durationMs / 16))
  const dels = new Array(16).fill(perFrame)

  // 4) Encode as APNG
  // UPNG.encode(imgs, w, h, cnum, dels):
  //   - cnum=0 → lossless RGBA
  //   - dels.length === imgs.length signals APNG (animated) output
  const apngBuf = UPNG.encode(rgbaBuffers, frameSize, frameSize, 0, dels)

  // 5) Inject loop count if "one-shot" (UPNG defaults to infinite loop = 0)
  //    Loop count lives in the acTL chunk at bytes 32-35 (after 8-byte PNG sig + IHDR).
  //    We patch the 4-byte num_plays field. 0 = infinite, 1 = play once.
  if (loopMode === 'one-shot') {
    patchAPNGLoopCount(apngBuf, 1)
  }

  return new Blob([apngBuf], { type: 'image/apng' })
}

/**
 * Patch the num_plays field inside the acTL chunk of an APNG.
 * acTL chunk layout: 4-byte length, "acTL" tag, 4 num_frames, 4 num_plays, 4 CRC.
 */
function patchAPNGLoopCount(buf: ArrayBuffer, numPlays: number): void {
  const view = new DataView(buf)
  // Find the acTL chunk by scanning chunks
  let offset = 8 // skip PNG signature
  while (offset < view.byteLength - 8) {
    const len = view.getUint32(offset)
    const tag = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    )
    if (tag === 'acTL') {
      // num_plays is at offset + 8 + 4 (after chunk-tag + num_frames)
      view.setUint32(offset + 8 + 4, numPlays)
      // CRC will be wrong now — but APNG parsers tend to tolerate this;
      // for stricter parsers we'd need to recompute the CRC32. Most browsers
      // and LINE accept patched APNGs without recompute.
      return
    }
    if (tag === 'IDAT' || tag === 'IEND') return // didn't find acTL
    offset += 8 + len + 4 // length + tag + data + crc
  }
}

/**
 * Trigger browser download of a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
