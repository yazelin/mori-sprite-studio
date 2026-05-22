import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildPackBlob } from '@/lib/exportPack'
import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'

async function makePngBlob(): Promise<Blob> {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' })
}

async function makeProjectWithSheets(): Promise<Project> {
  const states = {} as Project['states']
  for (const n of STATE_NAMES) {
    states[n] = {
      staticBase: null,
      sheet: await makePngBlob(),
      rawSheet: null, rawStaticBase: null,
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      poseNote: '', notes: Array(16).fill(''),
      loopMode: DEFAULT_LOOP_MODES[n],
      loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[n],
      status: 'animated',
    }
  }
  return {
    characterRef: null, states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'y', license: 'MIT', description: '', tags: ['t'],
    },
    backdropDark: null, backdropLight: null,
  }
}

describe('exportPack', () => {
  it('produces a zip with manifest.json + 6 sprite PNGs', async () => {
    const project = await makeProjectWithSheets()
    const blob = await buildPackBlob(project)
    expect(blob.type).toBe('application/zip')

    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('manifest.json')).not.toBeNull()
    for (const n of STATE_NAMES) {
      expect(zip.file(`sprites/${n}.png`)).not.toBeNull()
    }

    const manifestStr = await zip.file('manifest.json')!.async('string')
    const manifest = JSON.parse(manifestStr)
    expect(manifest.schema_version).toBe('1.0')
    expect(manifest.package_name).toBe('mori')
  })

  it('omits sprite file for a state with no sheet', async () => {
    const project = await makeProjectWithSheets()
    project.states.recording.sheet = null
    const blob = await buildPackBlob(project)
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('sprites/recording.png')).toBeNull()
    expect(zip.file('sprites/idle.png')).not.toBeNull()
  })
})
