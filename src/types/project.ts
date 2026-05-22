export type StateName =
  | 'idle' | 'sleeping' | 'recording' | 'thinking' | 'done' | 'error'

export const STATE_NAMES: readonly StateName[] = [
  'idle', 'sleeping', 'recording', 'thinking', 'done', 'error',
] as const

export type SheetStatus = 'pending' | 'placeholder' | 'animated'

export interface CellTransform {
  /** Uniform scale factor applied to character pixels. 1.0 = unchanged. */
  scale: number
  /** X offset in pixels (positive = right). 0 = no shift. */
  offsetX: number
  /** Y offset in pixels (positive = down). 0 = no shift. */
  offsetY: number
}

export const IDENTITY_TRANSFORM: CellTransform = { scale: 1.0, offsetX: 0, offsetY: 0 }

export interface SpriteState {
  staticBase: Blob | null
  sheet: Blob | null
  /**
   * Raw AI-returned sheet BEFORE chroma key + edge erosion. Stored so
   * "重新去背" can re-process from the original output when the user
   * changes chroma tolerance or edge erosion — erosion is destructive
   * (eaten pixels are gone), so we can't go back without the raw.
   */
  rawSheet: Blob | null
  /** Raw AI-returned static base BEFORE chroma + erosion (same reason). */
  rawStaticBase: Blob | null
  /**
   * Per-state transform to align character size/position across states.
   * Applied at render time (preview + export) on top of the cleaned sheet —
   * the underlying sheet pixels are NOT modified. Defaults to identity
   * (no transform). Set globally via "Normalize 尺寸" or per-state via
   * the sliders in StateView. Required for cross-state visual consistency
   * since AI generates each state independently and bbox size varies.
   */
  transform: CellTransform
  poseNote: string
  notes: string[]
  loopMode: 'loop' | 'one-shot'
  loopDurationMs: number
  status: SheetStatus
}

export interface ProjectMetadata {
  packageName: string
  displayName: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
}

export interface Project {
  characterRef: Blob | null
  states: Record<StateName, SpriteState>
  metadata: ProjectMetadata
  /**
   * Optional per-character backdrop images, packaged at the .moripack
   * zip root as backdrop-{dark,light}.png. mori-desktop's floating widget
   * uses these in 'logo' backplate mode (per mori-desktop PR #107):
   *
   *   3-tier fallback chain:
   *     1. character pack's backdrop-{dark,light}.png (these)
   *     2. user's global ~/.mori/floating/backplate-{dark,light}.png
   *     3. built-in plain gradient
   *
   * Typical size: 160×160 or 200×200 PNG with alpha. Shape can be any —
   * common designs are a soft circular halo / silhouette behind the sprite.
   */
  backdropDark: Blob | null
  backdropLight: Blob | null
}
