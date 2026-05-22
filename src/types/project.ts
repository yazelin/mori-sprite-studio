export type StateName =
  | 'idle' | 'sleeping' | 'recording' | 'thinking' | 'done' | 'error'

export const STATE_NAMES: readonly StateName[] = [
  'idle', 'sleeping', 'recording', 'thinking', 'done', 'error',
] as const

export type SheetStatus = 'pending' | 'placeholder' | 'animated'

export interface SpriteState {
  staticBase: Blob | null
  sheet: Blob | null
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
