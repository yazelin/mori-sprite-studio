import { CHROMA_THRESHOLDS, type ChromaTolerance } from '@/types/chroma'

type Rgb = [number, number, number]
type Profile = (typeof CHROMA_THRESHOLDS)[ChromaTolerance]

function channelGroups(keyRgb: Rgb): { key: number[]; other: number[] } {
  const key: number[] = []
  const other: number[] = []
  for (let channel = 0; channel < 3; channel++) {
    (keyRgb[channel] > 128 ? key : other).push(channel)
  }
  return { key, other }
}

function scoreOf(rgb: Rgb, keyChannels: number[], otherChannels: number[]): number {
  const keyValue = Math.min(...keyChannels.map((channel) => rgb[channel]))
  const otherValue = Math.max(...otherChannels.map((channel) => rgb[channel]))
  return (keyValue - otherValue) / 255
}

function isPureKey(
  rgb: Rgb,
  keyChannels: number[],
  otherChannels: number[],
  profile: Profile,
): boolean {
  const keyValue = Math.min(...keyChannels.map((channel) => rgb[channel]))
  const otherValue = Math.max(...otherChannels.map((channel) => rgb[channel]))
  return keyValue >= profile.minKey &&
    otherValue <= profile.maxOther &&
    keyValue >= otherValue * profile.dominance
}

function median(values: number[]): number {
  values.sort((a, b) => a - b)
  const middle = values.length >> 1
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle]
}

/** Estimate the rendered screen color from the four corner patches. */
function samplePlateColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyChannels: number[],
  otherChannels: number[],
  profile: Profile,
  fallback: Rgb,
): { color: Rgb; minScore: number } {
  const patch = Math.max(1, Math.min(8, Math.floor(width / 4), Math.floor(height / 4)))
  const origins: Array<[number, number]> = [
    [0, 0], [width - patch, 0],
    [0, height - patch], [width - patch, height - patch],
  ]
  const samples: Rgb[] = []
  const scores: number[] = []

  for (const [x0, y0] of origins) {
    for (let y = y0; y < y0 + patch; y++) {
      for (let x = x0; x < x0 + patch; x++) {
        const i = (y * width + x) * 4
        const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
        if (!isPureKey(rgb, keyChannels, otherChannels, profile)) continue
        samples.push(rgb)
        scores.push(scoreOf(rgb, keyChannels, otherChannels))
      }
    }
  }

  if (samples.length === 0) {
    return { color: fallback, minScore: scoreOf(fallback, keyChannels, otherChannels) }
  }

  const color: Rgb = [
    median(samples.map((sample) => sample[0])),
    median(samples.map((sample) => sample[1])),
    median(samples.map((sample) => sample[2])),
  ]
  return { color, minScore: Math.min(...scores) }
}

/**
 * Recover the foreground alpha from the selected key color's coverage.
 * This preserves soft edges such as hair instead of cutting them at a fixed
 * hard threshold. Enclosed key-colored holes are handled separately below.
 */
function estimateMatte(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRgb: Rgb,
  tolerance: ChromaTolerance,
): { plateColor: Rgb; scores: Float32Array } {
  const profile = CHROMA_THRESHOLDS[tolerance]
  const { key: keyChannels, other: otherChannels } = channelGroups(keyRgb)
  if (keyChannels.length === 0 || otherChannels.length === 0) {
    throw new Error('去背色需要是高彩度顏色，請避免黑、白、灰。')
  }

  const { color: plateColor, minScore } = samplePlateColor(
    data, width, height, keyChannels, otherChannels, profile, keyRgb,
  )
  const plateScore = Math.max(scoreOf(plateColor, keyChannels, otherChannels), 0.05)
  // Keep the threshold just below the least saturated corner sample so that
  // the plate is fully transparent while lower coverage keeps its matte.
  const hardCut = minScore - profile.keepThin
  const pixels = width * height
  const scores = new Float32Array(pixels)

  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
    const score = scoreOf(rgb, keyChannels, otherChannels)
    scores[p] = score
    const dominant = score > 0
    const coverage = dominant ? Math.max(0, Math.min(1, 1 - score / plateScore)) : 1
    const estimatedAlpha = data[i + 3] * coverage
    const alpha = isPureKey(rgb, keyChannels, otherChannels, profile) && score >= hardCut
      ? 0
      : estimatedAlpha
    data[i + 3] = Math.round(alpha)
  }

  restoreEnclosedDetails(data, scores, width, height, plateScore)
  return { plateColor, scores }
}

/**
 * Small enclosed regions are usually same-color details inside the character.
 * Strong key-colored enclosed regions are background visible through gaps.
 */
function restoreEnclosedDetails(
  data: Uint8ClampedArray,
  scores: Float32Array,
  width: number,
  height: number,
  plateScore: number,
): void {
  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  const smallComponentLimit = Math.max(pixelCount * 0.002, 256)

  for (let seed = 0; seed < pixelCount; seed++) {
    if (visited[seed] || data[seed * 4 + 3] === 255) continue

    const start = 0
    let head = 0
    let tail = 1
    queue[0] = seed
    visited[seed] = 1
    let touchesBorder = false
    let peakScore = -Infinity

    while (head < tail) {
      const p = queue[head++]
      const x = p % width
      const y = Math.floor(p / width)
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true
      if (scores[p] > peakScore) peakScore = scores[p]

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const neighbor = ny * width + nx
          if (visited[neighbor] || data[neighbor * 4 + 3] === 255) continue
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }
    }

    if (touchesBorder) continue
    const isStrongKeyGap = peakScore >= plateScore * 0.5
    if (!isStrongKeyGap && tail < smallComponentLimit) {
      for (let n = start; n < tail; n++) data[queue[n] * 4 + 3] = 255
      continue
    }
    if (isStrongKeyGap) {
      for (let n = start; n < tail; n++) {
        const p = queue[n]
        if (scores[p] >= plateScore * 0.3) data[p * 4 + 3] = 0
      }
    }
  }
}

function buildEdgeBand(alpha: Uint8ClampedArray, width: number, height: number, radius: number): Uint8Array {
  let edge = new Uint8Array(width * height)
  for (let p = 0; p < edge.length; p++) {
    if (alpha[p * 4 + 3] < 255) edge[p] = 1
  }

  for (let step = 0; step < radius; step++) {
    const expanded = edge.slice()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        if (edge[p]) continue
        for (let dy = -1; dy <= 1 && !expanded[p]; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx >= 0 && nx < width && edge[ny * width + nx]) {
              expanded[p] = 1
              break
            }
          }
        }
      }
    }
    edge = expanded
  }
  return edge
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function despillEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRgb: Rgb,
  plateColor: Rgb,
  scores: Float32Array,
): void {
  const { key: keyChannels, other: otherChannels } = channelGroups(keyRgb)
  const edge = buildEdgeBand(data, width, height, 2)

  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const alpha = data[i + 3]
    if (!edge[p] || alpha === 0 || scores[p] <= 0) continue

    if (alpha < 250) {
      // Unmix the sampled screen color from semi-transparent edge pixels.
      // Avoid amplifying noise in barely visible pixels.
      const coverage = Math.max(alpha / 255, 0.08)
      for (let channel = 0; channel < 3; channel++) {
        data[i + channel] = clampByte((data[i + channel] - plateColor[channel] * (1 - coverage)) / coverage)
      }
      continue
    }

    const strongestOther = Math.max(...otherChannels.map((channel) => data[i + channel]))
    if (keyChannels.length === 1) {
      const [channel] = keyChannels
      data[i + channel] = Math.min(data[i + channel], strongestOther)
      continue
    }
    const meanKey = keyChannels.reduce((sum, channel) => sum + data[i + channel], 0) / keyChannels.length
    const spill = Math.max(0, meanKey - strongestOther)
    for (const channel of keyChannels) data[i + channel] = Math.max(0, data[i + channel] - spill)
  }
}

export async function chromaKeyOut(
  src: Blob,
  keyRgb: Rgb,
  tolerance: ChromaTolerance,
): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const width = bitmap.width
  const height = bitmap.height
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)
  const { plateColor, scores } = estimateMatte(imageData.data, width, height, keyRgb, tolerance)
  despillEdges(imageData.data, width, height, keyRgb, plateColor, scores)
  ctx.putImageData(imageData, 0, 0)
  bitmap.close?.()
  return await canvas.convertToBlob({ type: 'image/png' })
}
