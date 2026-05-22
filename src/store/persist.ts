import type { AppStore } from './index'
import { blobToDataUrl, dataUrlToBlob } from '@/lib/blobUtils'

const STORAGE_KEY = 'mori-sprite-studio.v1'

type SerializableValue = unknown

async function serialize(value: SerializableValue): Promise<SerializableValue> {
  if (value instanceof Blob) {
    return { __blob: await blobToDataUrl(value) }
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => serialize(v)))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await serialize(v)
    }
    return out
  }
  return value
}

async function deserialize(value: SerializableValue): Promise<SerializableValue> {
  if (value && typeof value === 'object' && '__blob' in (value as Record<string, unknown>)) {
    const url = (value as Record<string, string>).__blob
    return await dataUrlToBlob(url)
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => deserialize(v)))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await deserialize(v)
    }
    return out
  }
  return value
}

type PersistedShape = Pick<AppStore, 'project' | 'prompts' | 'provider' | 'chroma'>

export async function saveStore(store: PersistedShape): Promise<void> {
  const payload = await serialize(store)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.error('persist save failed', e)
  }
}

export async function loadStore(): Promise<Partial<PersistedShape> | null> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return (await deserialize(parsed)) as Partial<PersistedShape>
  } catch (e) {
    console.error('persist load failed', e)
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(store: PersistedShape, delayMs = 300): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveStore(store)
  }, delayMs)
}
