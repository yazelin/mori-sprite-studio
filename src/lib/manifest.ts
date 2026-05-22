import type { ManifestV1 } from '@/types/manifest'
import type { Project, StateName } from '@/types/project'
import { REQUIRED_STATE_NAMES, OPTIONAL_STATE_NAMES } from '@/types/project'

export function buildManifest(project: Project): ManifestV1 {
  // Required 6 states are always in the manifest (even if no sheet uploaded
  // — mori-desktop will fall back to placeholder cell). Optional 2 are
  // listed in optional_states[] only when the author actually shipped a
  // sheet for them, matching character-pack.md spec.
  const shippedOptional = OPTIONAL_STATE_NAMES.filter((n) => project.states[n].sheet !== null)
  const allShipped: StateName[] = [...REQUIRED_STATE_NAMES, ...shippedOptional]

  const loopModes = {} as Record<StateName, 'loop' | 'one-shot'>
  const loopDurations = {} as Record<StateName, number>
  for (const n of allShipped) {
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
    states: [...REQUIRED_STATE_NAMES],
    optional_states: [...shippedOptional],
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
