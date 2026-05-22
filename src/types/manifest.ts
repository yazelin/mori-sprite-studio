import type { StateName } from './project'

export interface ManifestV1 {
  schema_version: '1.0'
  package_name: string
  display_name: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
  states: StateName[]
  optional_states: string[]
  loop_modes: Record<StateName, 'loop' | 'one-shot'>
  loop_durations_ms: Record<StateName, number>
  sprite_spec: {
    format: 'PNG-32'
    grid: '4x4'
    total_size: '1024x1024'
    frame_size: '256x256'
    frame_order: 'row-major-left-to-right-top-to-bottom'
    background: 'transparent'
  }
}
