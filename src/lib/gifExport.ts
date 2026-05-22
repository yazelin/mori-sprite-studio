import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { splitGrid } from './imageOps'

/**
 * Build a GIF from a 4×4 sprite sheet.
 *
 * GIF is the most universal animated format — it plays in macOS Preview,
 * Windows Photos, file-explorer thumbnails (modern OSes), Discord, etc.
 * The tradeoff: only 1-bit transparency (each pixel is either fully
 * transparent or fully opaque — no anti-alias on the alpha channel, so
 * edges look slightly crusty against any background). For higher-quality
 * transparency use APNG instead.
 *
 * @param sheet      1024×1024 RGBA sprite sheet (4×4 grid)
 * @param durationMs Total loop duration in ms (matches mori-desktop convention)
 * @param loopMode   'loop' = infinite cycle; 'one-shot' = play once
 * @param frameSize  Output pixel size per frame (default 256)
 */
export async function buildGIF(
  sheet: Blob,
  durationMs: number,
  loopMode: 'loop' | 'one-shot',
  frameSize = 256,
): Promise<Blob> {
  const cells = await splitGrid(sheet, 4, 4)
  if (cells.length !== 16) {
    throw new Error(`splitGrid 4×4 returned ${cells.length} cells (expected 16)`)
  }

  // Extract RGBA per frame at target size
  const frames: Uint8Array[] = []
  for (const cellBlob of cells) {
    const bmp = await createImageBitmap(cellBlob)
    const canvas = new OffscreenCanvas(frameSize, frameSize)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0, bmp.width, bmp.height, 0, 0, frameSize, frameSize)
    const imgData = ctx.getImageData(0, 0, frameSize, frameSize)
    const rgba = new Uint8Array(imgData.data.length)
    rgba.set(imgData.data)
    frames.push(rgba)
  }

  // Quantize a single global palette from frame 1's RGBA. All 16 frames share
  // the same character so palette derived from one frame is sufficient.
  // Reserve slot 0 for transparency.
  const palette = quantize(frames[0], 255, { format: 'rgb444' })

  const gif = GIFEncoder()
  const perFrameDelay = Math.max(20, Math.round(durationMs / 16))
  const repeat = loopMode === 'loop' ? 0 : -1 // gifenc: 0 = infinite, -1 = no repeat

  // Encode each frame
  for (let f = 0; f < frames.length; f++) {
    const rgba = frames[f]
    // applyPalette maps RGBA → palette indices. We need to mark fully-transparent
    // pixels with a special index (0) and the palette is built only from opaque.
    // gifenc's applyPalette takes RGBA but ignores alpha. We need a transparent-aware path.
    // Strategy: pre-process — set transparent pixels to a known sentinel color
    // (we'll use palette index 0 as the transparent slot).
    const idx = applyPalette(rgba, palette, 'rgb444')
    // Override transparent pixels with palette index 0
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      if (rgba[i + 3] < 128) idx[p] = 0
    }
    gif.writeFrame(idx, frameSize, frameSize, {
      palette,
      delay: perFrameDelay,
      transparent: true,
      transparentIndex: 0,
      dispose: 2, // restore to background = clears transparent areas between frames
      repeat: f === 0 ? repeat : undefined,
    })
  }

  gif.finish()
  // Copy into a fresh Uint8Array<ArrayBuffer> — gifenc returns
  // Uint8Array<ArrayBufferLike> which TypeScript can't narrow to a BlobPart.
  const bytes = gif.bytes()
  const buf = new Uint8Array(bytes.length)
  buf.set(bytes)
  return new Blob([buf], { type: 'image/gif' })
}

/**
 * Build a WebM video (VP9 with alpha) from a 4×4 sprite sheet.
 *
 * Uses MediaRecorder + canvas.captureStream() to record. Plays as a video
 * in macOS QuickTime, OBS Studio, browsers, etc. Preserves full RGBA alpha
 * channel in Chrome/Firefox (Safari has limited VP9 alpha support).
 *
 * @param sheet      1024×1024 RGBA sprite sheet (4×4 grid)
 * @param durationMs Total loop duration in ms
 * @param frameSize  Output pixel size per frame (default 256)
 * @param loops      How many loops to record into the file (default 3 — gives
 *                   smooth playback experience in viewers that don't repeat
 *                   short videos automatically)
 */
export async function buildWebM(
  sheet: Blob,
  durationMs: number,
  frameSize = 256,
  loops = 3,
): Promise<Blob> {
  const bmp = await createImageBitmap(sheet)
  const cellW = bmp.width / 4
  const cellH = bmp.height / 4

  const canvas = document.createElement('canvas')
  canvas.width = frameSize
  canvas.height = frameSize
  const ctx = canvas.getContext('2d', { alpha: true })!

  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack

  // Try VP9 with alpha; fall back to VP8/WebM if not supported
  const mimeCandidates = [
    'video/webm; codecs="vp9"',
    'video/webm; codecs=vp9',
    'video/webm; codecs="vp8"',
    'video/webm',
  ]
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))
  if (!mimeType) throw new Error('No supported WebM codec found')

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })

  recorder.start()

  const frameInterval = Math.max(20, durationMs / 16)
  for (let cycle = 0; cycle < loops; cycle++) {
    for (let i = 0; i < 16; i++) {
      const col = i % 4, row = Math.floor(i / 4)
      ctx.clearRect(0, 0, frameSize, frameSize)
      ctx.drawImage(bmp, col * cellW, row * cellH, cellW, cellH, 0, 0, frameSize, frameSize)
      track.requestFrame()
      await new Promise((r) => setTimeout(r, frameInterval))
    }
  }

  // Let recorder flush the last frame
  await new Promise((r) => setTimeout(r, frameInterval))
  recorder.stop()
  await stopped

  return new Blob(chunks, { type: mimeType.split(';')[0] })
}
