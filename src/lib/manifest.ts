import type { ManifestV1 } from '@/types/manifest'
import type { Project, StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export function buildManifest(project: Project): ManifestV1 {
  const loopModes = {} as Record<StateName, 'loop' | 'one-shot'>
  const loopDurations = {} as Record<StateName, number>
  for (const n of STATE_NAMES) {
    loopModes[n] = project.states[n].loopMode
    loopDurations[n] = project.states[n].loopDurationMs
  }
  return {
    schema_version: '1.0',
    package_name: project.metadata.packageName,
    display_name: project.metadata.displayName,
    version: project.metadata.version,
    author: project.metadata.author,
    license: project.metadata.license,
    description: project.metadata.description,
    tags: [...project.metadata.tags],
    states: [...STATE_NAMES],
    optional_states: ['walking', 'dragging'],
    loop_modes: loopModes,
    loop_durations_ms: loopDurations,
    sprite_spec: {
      format: 'PNG-32',
      grid: '4x4',
      total_size: '1024x1024',
      frame_size: '256x256',
      frame_order: 'row-major-left-to-right-top-to-bottom',
      background: 'transparent',
    },
  }
}
