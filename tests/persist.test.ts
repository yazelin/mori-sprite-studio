import { describe, it, expect, beforeEach } from 'vitest'
import { saveStore, loadStore, clearStore } from '@/store/persist'

// NOTE: Blob round-trip via fake-indexeddb is incomplete (structured clone
// drops Blob to {}). Real browser IDB handles Blob natively via structured
// clone — verified manually in production. These tests cover the API
// contract (save / load / clear / null) only; Blob fidelity is tested in
// browser via dev server.

describe('persist (IndexedDB-backed)', () => {
  beforeEach(async () => {
    await clearStore()
  })

  it('returns null when nothing stored', async () => {
    expect(await loadStore()).toBeNull()
  })

  it('round-trips a plain (no-Blob) store payload', async () => {
    const dummy = {
      project: {
        characterRef: null,
        states: {} as any,
        metadata: {
          packageName: 'mori', displayName: 'Mori', version: '1.0.0',
          author: 'yazelin', license: 'MIT', description: 'desc', tags: ['a', 'b'],
        },
      },
      prompts: { templates: { B1: 'b1', B2: 'b2', C: 'c', D: 'd' } as any, stateSemantics: {} as any },
      provider: { active: 'author-fallback' } as any,
      chroma: { key: 'green' as const, tolerance: 'balanced' as const },
    }
    await saveStore(dummy as any)
    const restored = await loadStore()
    expect(restored).not.toBeNull()
    expect(restored!.project!.metadata.packageName).toBe('mori')
    expect(restored!.prompts!.templates!.B1).toBe('b1')
    expect(restored!.chroma!.key).toBe('green')
    // 舊存檔的 author-fallback(已停止提供)要遷到 google-gemini
    expect((restored!.provider as any).active).toBe('google-gemini')
  })

  it('clearStore removes saved data', async () => {
    await saveStore({
      project: { characterRef: null, states: {} as any, metadata: { packageName: 'x', displayName: 'X', version: '0.0.0', author: '', license: '', description: '', tags: [] } },
      prompts: { templates: {} as any, stateSemantics: {} as any },
      provider: {} as any,
      chroma: { key: 'green' as const, tolerance: 'balanced' as const },
    } as any)
    await clearStore()
    expect(await loadStore()).toBeNull()
  })
})
