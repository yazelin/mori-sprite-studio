import { get, set, del } from 'idb-keyval'
import type { AppStore } from './index'
import { STATE_NAMES } from '@/types/project'

// v2: switched from localStorage (data-URL Blob, ~5MB quota) to IndexedDB
// via idb-keyval. IndexedDB stores Blobs natively via structured clone
// (no base64 bloat) and has multi-GB capacity — no QuotaExceededError
// for our 6 1024×1024 PNG sheets + 6 statics + 1 character ref.
const STORAGE_KEY = 'mori-sprite-studio.v2'
const LEGACY_LOCALSTORAGE_KEY = 'mori-sprite-studio.v1'

type PersistedShape = Pick<AppStore, 'project' | 'prompts' | 'provider' | 'chroma'>

export async function saveStore(store: PersistedShape): Promise<void> {
  try {
    await set(STORAGE_KEY, store)
  } catch (e) {
    console.error('persist save failed', e)
  }
}

export async function loadStore(): Promise<Partial<PersistedShape> | null> {
  try {
    // Drop legacy localStorage on first IDB load (reclaim quota)
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_LOCALSTORAGE_KEY)) {
      try { localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY) } catch { /* ignore */ }
    }
    const data = await get<PersistedShape>(STORAGE_KEY)
    if (!data) return null
    return migrate(data)
  } catch (e) {
    console.error('persist load failed', e)
    return null
  }
}

/**
 * Forward-compat migration for projects saved by older versions of the app
 * before new fields existed (e.g. transform, backdropDark, rawSheet).
 * Fills missing fields with defaults so React doesn't crash on undefined
 * access when reading e.g. state.transform.scale.
 */
function migrate(data: Partial<PersistedShape>): Partial<PersistedShape> {
  if (!data.project) return data
  const project = data.project as any
  // Project-level fields
  if (project.backdropDark === undefined) project.backdropDark = null
  if (project.backdropLight === undefined) project.backdropLight = null
  // SpriteState fields
  if (project.states) {
    for (const name of STATE_NAMES) {
      const s = project.states[name] as any
      if (!s) continue
      if (s.transform === undefined) s.transform = { scale: 1, offsetX: 0, offsetY: 0 }
      if (s.rawSheet === undefined) s.rawSheet = null
      if (s.rawStaticBase === undefined) s.rawStaticBase = null
    }
  }
  return data
}

export async function clearStore(): Promise<void> {
  try {
    await del(STORAGE_KEY)
  } catch (e) {
    console.error('persist clear failed', e)
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(store: PersistedShape, delayMs = 300): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveStore(store)
  }, delayMs)
}
