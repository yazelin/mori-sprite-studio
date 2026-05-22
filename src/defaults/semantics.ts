import type { StateName } from '@/types/project'

export const DEFAULT_STATE_SEMANTICS: Record<StateName, string> = {
  idle:      'relaxed standing pose, neutral expression, arms slightly relaxed at sides',
  sleeping:  'eyes closed, peaceful expression, can be sitting or gently floating, slight head tilt',
  recording: 'alert and attentive, slight forward lean, ears or head perked up listening',
  thinking:  'one hand near chin or temple, head slightly tilted, contemplative expression',
  done:      'happy and relieved expression, slight upward gesture or open smile',
  error:     'concerned or confused expression, slight cower or hands up in puzzlement',
}
