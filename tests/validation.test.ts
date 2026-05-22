import { describe, it, expect } from 'vitest'
import { validateProject } from '@/lib/validation'
import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'

function emptyProject(): Project {
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
    characterRef: null, states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'yazelin', license: 'MIT', description: '', tags: [],
    },
  }
}

describe('validateProject', () => {
  it('blocks when packageName is empty', () => {
    const p = emptyProject()
    p.metadata.packageName = ''
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
    expect(r.blocking.some((b) => b.includes('package_name'))).toBe(true)
  })

  it('blocks when packageName has uppercase', () => {
    const p = emptyProject()
    p.metadata.packageName = 'Mori'
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
  })

  it('blocks when displayName is empty', () => {
    const p = emptyProject()
    p.metadata.displayName = ''
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
  })

  it('blocks when all states have no sheet', () => {
    const p = emptyProject()
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
    expect(r.blocking.some((b) => b.includes('sheet'))).toBe(true)
  })

  it('warns about partial completion but does not block', async () => {
    const p = emptyProject()
    p.states.idle.sheet = new Blob([new Uint8Array([1])], { type: 'image/png' })
    p.states.idle.status = 'animated'
    const r = validateProject(p)
    expect(r.canExport).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('warns about non-semver version', () => {
    const p = emptyProject()
    p.states.idle.sheet = new Blob([new Uint8Array([1])], { type: 'image/png' })
    p.metadata.version = 'one'
    const r = validateProject(p)
    expect(r.warnings.some((w) => w.includes('version'))).toBe(true)
  })
})
