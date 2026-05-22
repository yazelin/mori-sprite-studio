import { get, set, del } from 'idb-keyval'
import type { AppStore } from './index'

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
    return data ?? null
  } catch (e) {
    console.error('persist load failed', e)
    return null
  }
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
