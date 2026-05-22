import type { StateName } from '@/types/project'

export const DEFAULT_LOOP_MODES: Record<StateName, 'loop' | 'one-shot'> = {
  idle:      'loop',
  sleeping:  'loop',
  recording: 'loop',
  thinking:  'loop',
  done:      'one-shot',
  error:     'one-shot',
}

export const DEFAULT_LOOP_DURATIONS_MS: Record<StateName, number> = {
  idle:      3000,
  sleeping:  5000,
  recording: 1500,
  thinking:  2000,
  done:      600,
  error:     800,
}
