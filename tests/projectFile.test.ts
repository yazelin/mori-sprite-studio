import { beforeEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { loadProjectFile } from '@/lib/projectFile'
import { useAppStore } from '@/store'
import { clearStore, loadStore } from '@/store/persist'
import { STATE_NAMES } from '@/types/project'

describe('project file import persistence', () => {
  beforeEach(async () => {
    await clearStore()
  })

  it('publishes and persists the fully loaded project in one update', async () => {
    const zip = new JSZip()
    const states = Object.fromEntries(STATE_NAMES.map((name) => [name, {
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      poseNote: '',
      notes: Array(16).fill(''),
      loopMode: 'loop',
      loopDurationMs: 1400,
      status: 'animated',
    }]))
    zip.file('project.json', JSON.stringify({
      fileVersion: '1',
      savedAt: new Date(0).toISOString(),
      metadata: {
        packageName: 'mori', displayName: 'Mori', version: '1.0.0',
        author: 'test', license: 'MIT', description: '', tags: [],
      },
      states,
    }))
    zip.file('character-ref.png', new Uint8Array([1, 2, 3]))
    zip.file('sprites/idle/sheet.png', new Uint8Array([4, 5, 6]))
    const file = await zip.generateAsync({ type: 'blob' })

    const observedProjects: string[] = []
    const unsubscribe = useAppStore.subscribe((state) => {
      observedProjects.push(state.project.metadata.packageName)
    })
    await loadProjectFile(file)
    unsubscribe()

    expect(observedProjects).toEqual(['mori'])
    expect(useAppStore.getState().project.characterRef).toBeInstanceOf(Blob)
    expect(useAppStore.getState().project.states.idle.sheet).toBeInstanceOf(Blob)

    const restored = await loadStore()
    expect(restored?.project?.metadata.packageName).toBe('mori')
    expect(restored?.project?.states.idle.loopDurationMs).toBe(1400)
  })
})
