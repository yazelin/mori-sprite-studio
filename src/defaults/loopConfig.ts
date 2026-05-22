import type { StateName } from '@/types/project'

export const DEFAULT_LOOP_MODES: Record<StateName, 'loop' | 'one-shot'> = {
  idle:      'loop',
  sleeping:  'loop',
  recording: 'loop',
  thinking:  'loop',
  done:      'one-shot',
  error:     'one-shot',
  // Optional states: both loop continuously while engine is in that state
  walking:   'loop',
  dragging:  'loop',
}

export const DEFAULT_LOOP_DURATIONS_MS: Record<StateName, number> = {
  idle:      3000,
  sleeping:  5000,
  recording: 1500,
  thinking:  2000,
  // One-shot durations: must be long enough that per-frame time (duration/16)
  // is above the perception threshold (~80ms / 12fps), otherwise adjacent
  // frames with subtle expression changes flicker and look jittery instead
  // of animated. 600ms → 37ms/frame = perceptual blur. 1800ms → 112ms/frame
  // = readable. 2000ms → 125ms/frame = comfortable.
  done:      1800,
  error:     2000,
  // Walking: fast cycle (legs in motion). 1200 ms / 16 frames = 75 ms/frame
  //   ~ 13 fps — natural walking step cadence.
  walking:   1200,
  // Dragging: medium oscillation (lifted, slight wobble). 1600 ms / 16 frames
  //   = 100 ms/frame — smooth suspended sway.
  dragging:  1600,
}
