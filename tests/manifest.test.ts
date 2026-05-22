import { describe, it, expect } from 'vitest'
import { buildManifest } from '@/lib/manifest'
import type { Project, ProjectMetadata } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'
import { STATE_NAMES } from '@/types/project'

function makeProject(metadata: Partial<ProjectMetadata> = {}): Project {
  const states = {} as Project['states']
  for (const n of STATE_NAMES) {
    states[n] = {
      staticBase: null, sheet: null, poseNote: '', notes: Array(16).fill(''),
      loopMode: DEFAULT_LOOP_MODES[n],
      loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[n],
      status: 'pending',
    }
  }
  return {
    characterRef: null,
    states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'yazelin', license: 'CC-BY-NC-SA-4.0',
      description: 'desc', tags: ['fantasy'],
      ...metadata,
    },
  }
}

describe('buildManifest', () => {
  it('produces a schema-compliant v1.0 manifest', () => {
    const m = buildManifest(makeProject())
    expect(m.schema_version).toBe('1.0')
    expect(m.package_name).toBe('mori')
    expect(m.display_name).toBe('Mori')
    expect(m.version).toBe('1.0.0')
    expect(m.author).toBe('yazelin')
    expect(m.license).toBe('CC-BY-NC-SA-4.0')
    expect(m.states).toEqual(['idle', 'sleeping', 'recording', 'thinking', 'done', 'error'])
    expect(m.optional_states).toEqual(['walking', 'dragging'])
    expect(m.loop_modes.idle).toBe('loop')
    expect(m.loop_modes.done).toBe('one-shot')
    expect(m.sprite_spec.format).toBe('PNG-32')
    expect(m.sprite_spec.grid).toBe('4x4')
    expect(m.sprite_spec.total_size).toBe('1024x1024')
    expect(m.sprite_spec.background).toBe('transparent')
  })

  it('carries through per-state loop overrides', () => {
    const project = makeProject()
    project.states.idle.loopDurationMs = 4200
    project.states.error.loopMode = 'loop'
    const m = buildManifest(project)
    expect(m.loop_durations_ms.idle).toBe(4200)
    expect(m.loop_modes.error).toBe('loop')
  })
})
