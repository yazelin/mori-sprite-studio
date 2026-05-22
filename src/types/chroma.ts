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

export const CHROMA_THRESHOLDS = {
  conservative: { hard: 30, soft: 60 },
  balanced:     { hard: 50, soft: 100 },
  aggressive:   { hard: 80, soft: 160 },
} as const
