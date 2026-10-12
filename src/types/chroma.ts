export type ChromaKeyName = 'green' | 'magenta' | 'blue' | 'cyan' | 'yellow' | 'custom'
export type ChromaTolerance = 'conservative' | 'balanced' | 'aggressive'

export interface ChromaState {
  key: ChromaKeyName
  /** HEX without #; used only when key === 'custom'. */
  customHex: string
  tolerance: ChromaTolerance
  /**
   * Post-chroma edge erosion in pixels. After chroma key removes the
   * background, each of the 16 cells has its outer N-pixel border zeroed
   * to fully transparent. Kills lingering chroma spill at edges that
   * the chroma threshold couldn't catch. Range 0-10 px. Character body
   * is centered so erosion 1-3 px is safe; bump higher if leak persists.
   */
  edgeErosionPx: number
}

export const CHROMA_COLORS: Record<Exclude<ChromaKeyName, 'custom'>, {
  hex: string
  rgb: [number, number, number]
  label: string
}> = {
  green:   { hex: '00FF00', rgb: [0, 255, 0], label: '綠幕' },
  magenta: { hex: 'FF00FF', rgb: [255, 0, 255], label: '洋紅幕' },
  blue:    { hex: '0000FF', rgb: [0, 0, 255], label: '藍幕' },
  cyan:    { hex: '00FFFF', rgb: [0, 255, 255], label: '青幕' },
  yellow:  { hex: 'FFFF00', rgb: [255, 255, 0], label: '黃幕' },
}

// Per-channel dominance thresholds. The alpha matte is estimated from color
// coverage; these values gate only the confident background cleanup pass.
export const CHROMA_THRESHOLDS = {
  conservative: { minKey: 60, maxOther: 100, dominance: 1.9, keepThin: 0.04 },
  balanced:     { minKey: 50, maxOther: 110, dominance: 1.7, keepThin: 0.08 },
  aggressive:   { minKey: 40, maxOther: 125, dominance: 1.45, keepThin: 0.12 },
} as const
