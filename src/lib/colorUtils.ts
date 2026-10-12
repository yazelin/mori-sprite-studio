import { CHROMA_COLORS, type ChromaKeyName, type ChromaState } from '@/types/chroma'

export interface ChromaInfo {
  key: ChromaKeyName
  hex: string
  rgb: [number, number, number]
  label: string
  promptName: string
}

const PROMPT_COLOR_NAMES: Record<Exclude<ChromaKeyName, 'custom'>, string> = {
  green: 'green',
  magenta: 'magenta',
  blue: 'blue',
  cyan: 'cyan',
  yellow: 'yellow',
}

export function parseChromaHex(hex: string): [number, number, number] | null {
  const normalized = hex.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

/** A useful chroma key needs one or two strong channels and a clear gap. */
export function isValidChromaRgb(rgb: [number, number, number]): boolean {
  const keyChannels = rgb.filter((channel) => channel > 128)
  const otherChannels = rgb.filter((channel) => channel <= 128)
  if (keyChannels.length < 1 || keyChannels.length > 2 || otherChannels.length < 1) return false
  const score = (Math.min(...keyChannels) - Math.max(...otherChannels)) / 255
  return score >= 0.25
}

export function chromaInfo(chroma: Pick<ChromaState, 'key' | 'customHex'>): ChromaInfo {
  if (chroma.key !== 'custom') {
    return { key: chroma.key, ...CHROMA_COLORS[chroma.key], promptName: PROMPT_COLOR_NAMES[chroma.key] }
  }

  const hex = chroma.customHex.replace(/^#/, '').toUpperCase()
  const rgb = parseChromaHex(hex)
  if (!rgb || !isValidChromaRgb(rgb)) {
    // Older or manually edited persisted projects may contain an invalid HEX.
    return { key: 'custom', hex: '00A8FF', rgb: [0, 168, 255], label: '自訂色幕', promptName: 'custom color' }
  }
  return { key: 'custom', hex, rgb, label: '自訂色幕', promptName: 'custom color' }
}

export function rgbDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
