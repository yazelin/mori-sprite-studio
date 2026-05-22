import { CHROMA_THRESHOLDS, type ChromaTolerance } from '@/types/chroma'

// Chroma-key background removal — ported from line-sticker-studio's
// `chromaKeyColorOut`. Two-pass per-channel dominance algorithm with
// despill (subtracts key color contribution from semi-transparent edge
// pixels) and a second-pass edge cleanup that fixes lingering chroma
// halos on opaque pixels adjacent to transparent ones.

type Profile = (typeof CHROMA_THRESHOLDS)[ChromaTolerance]

function keyScore(r: number, g: number, b: number, isGreen: boolean): number {
  return isGreen
    ? (g - Math.max(r, b)) / 255
    : (Math.min(r, b) - g) / 255
}

function isPureKey(
  r: number, g: number, b: number,
  isGreen: boolean,
  p: Profile,
): boolean {
  if (isGreen) {
    return (
      g >= p.minKey &&
      r <= p.maxOther &&
      b <= p.maxOther &&
      g >= r * p.dominance &&
      g >= b * p.dominance
    )
  }
  const magenta = Math.min(r, b)
  return (
    magenta >= p.minKey &&
    g <= p.maxOther &&
    r >= g * p.dominance &&
    b >= g * p.dominance
  )
}

function despill(
  data: Uint8ClampedArray,
  i: number,
  isGreen: boolean,
): void {
  if (isGreen) {
    // Replace green with average of red+blue
    data[i + 1] = (data[i] + data[i + 2]) >> 1
  } else {
    // Magenta: pull red+blue toward green
    const g = data[i + 1]
    data[i] = g
    data[i + 2] = g
  }
}

export async function chromaKeyOut(
  src: Blob,
  keyRgb: [number, number, number],
  tolerance: ChromaTolerance,
): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const w = bitmap.width
  const h = bitmap.height
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0)
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  const profile = CHROMA_THRESHOLDS[tolerance]
  const isGreen = keyRgb[1] === 255 && keyRgb[0] === 0 && keyRgb[2] === 0

  // Pass 1: chroma-key + despill
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const score = keyScore(r, g, b, isGreen)
    const pure = isPureKey(r, g, b, isGreen, profile)
    let alpha = data[i + 3]
    if (pure && score > profile.hard) {
      alpha = 0
    } else if (pure && score > profile.soft) {
      // Linear ramp: score=hard → alpha=0; score=soft → alpha=255 (approximately)
      const denom = Math.max(0.01, profile.hard - profile.soft)
      alpha = Math.round(255 * (profile.hard - score) / denom)
      if (alpha < 0) alpha = 0
      if (alpha > 255) alpha = 255
    }
    data[i + 3] = alpha
    // Despill pixels confidently associated with the key color
    if (alpha > 0 && pure) despill(data, i, isGreen)
  }

  // Pass 2: edge cleanup — find opaque pixels that touch transparent
  // neighbors and look "lightly spilled" by the key color; despill them.
  const baseAlpha = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) baseAlpha[p] = data[i + 3]

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (baseAlpha[p] === 0) continue

      // Touch test: any of 8 neighbors transparent?
      let touchesEmpty = false
      for (let dy = -1; dy <= 1 && !touchesEmpty; dy++) {
        for (let dx = -1; dx <= 1 && !touchesEmpty; dx++) {
          if (dx === 0 && dy === 0) continue
          if (baseAlpha[(y + dy) * w + (x + dx)] === 0) touchesEmpty = true
        }
      }
      if (!touchesEmpty) continue

      const i = p * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const score = keyScore(r, g, b, isGreen)
      const softThreshold = Math.max(profile.soft, 0.08)
      const lightSpill = isGreen
        ? (
            score > softThreshold &&
            r >= 90 && b >= 70 &&
            g > r * 1.05 && g > b * 1.05
          )
        : (
            score > softThreshold &&
            r >= 90 && b >= 90 && g >= 50 &&
            r > g * 1.05 && b > g * 1.05
          )
      if (!lightSpill) continue
      despill(data, i, isGreen)
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}
