export type StateName =
  | 'idle' | 'sleeping' | 'recording' | 'thinking' | 'done' | 'error'

export const STATE_NAMES: readonly StateName[] = [
  'idle', 'sleeping', 'recording', 'thinking', 'done', 'error',
] as const

export type SheetStatus = 'pending' | 'placeholder' | 'animated'

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
}
