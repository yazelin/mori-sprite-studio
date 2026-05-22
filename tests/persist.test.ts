import { describe, it, expect, beforeEach } from 'vitest'
import { saveStore, loadStore } from '@/store/persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a store containing a Blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const dummy = {
      project: {
        characterRef: blob,
        states: {} as any,
        metadata: {
          packageName: 'mori', displayName: 'Mori', version: '1.0.0',
          author: 'yazelin', license: 'MIT', description: '', tags: [],
        },
      },
      prompts: { templates: {} as any, stateSemantics: {} as any },
      provider: {} as any,
      chroma: { key: 'green' as const, tolerance: 'balanced' as const },
    }
    await saveStore(dummy as any)
    const restored = await loadStore()
    expect(restored).not.toBeNull()
    const restoredBlob = restored!.project!.characterRef as Blob
    expect(restoredBlob).toBeInstanceOf(Blob)
    const buf = new Uint8Array(await restoredBlob.arrayBuffer())
    expect(Array.from(buf)).toEqual([1, 2, 3])
    expect(restoredBlob.type).toBe('image/png')
  })

  it('returns null when nothing stored', async () => {
    expect(await loadStore()).toBeNull()
  })
})
