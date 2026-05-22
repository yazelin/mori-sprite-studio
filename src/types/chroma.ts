export type ChromaKeyName = 'green' | 'magenta'
export type ChromaTolerance = 'conservative' | 'balanced' | 'aggressive'

export interface ChromaState {
  key: ChromaKeyName
  tolerance: ChromaTolerance
}

export const CHROMA_COLORS = {
  green:   { hex: '00FF00', rgb: [0, 255, 0] as [number, number, number], label: '綠幕' },
  magenta: { hex: 'FF00FF', rgb: [255, 0, 255] as [number, number, number], label: '洋紅幕' },
} as const

// Per-channel dominance "score" thresholds + isPureKey gate parameters.
// Ported from line-sticker-studio. Score is in [-1, 1] range:
//   green:    score = (g - max(r, b)) / 255
//   magenta:  score = (min(r, b) - g) / 255
// hard:    score > hard           → alpha = 0 (fully removed)
// soft:    score > soft           → linear ramp to alpha (anti-alias edge)
// minKey:  key channel must be ≥ this absolute value (gates near-grey)
// maxOther:non-key channels must be ≤ this (gates light pastels)
// dominance: key channel ≥ other channels × this ratio (gates skin tones)
export const CHROMA_THRESHOLDS = {
  conservative: { hard: 0.32, soft: 0.12, minKey: 60, maxOther: 100, dominance: 1.9 },
  balanced:     { hard: 0.25, soft: 0.05, minKey: 50, maxOther: 110, dominance: 1.7 },
  aggressive:   { hard: 0.20, soft: 0.04, minKey: 40, maxOther: 125, dominance: 1.45 },
} as const
