import { get, set, del } from 'idb-keyval'
import type { AppStore } from './index'
import { STATE_NAMES, type SpriteState, type StateName } from '@/types/project'
import {
  DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS,
  DEFAULT_STATE_SEMANTICS, DEFAULT_TEMPLATES,
} from '@/defaults'
import type { TemplateKey } from '@/types/prompts'

const ALL_TEMPLATE_KEYS: readonly TemplateKey[] = ['B1', 'B2', 'C', 'D', 'W', 'Dr'] as const

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
function defaultSpriteState(name: StateName): SpriteState {
  return {
    staticBase: null,
    sheet: null,
    rawSheet: null,
    rawStaticBase: null,
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    poseNote: '',
    notes: Array(16).fill(''),
    loopMode: DEFAULT_LOOP_MODES[name],
    loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[name],
    status: 'pending',
  }
}

function migrate(data: Partial<PersistedShape>): Partial<PersistedShape> {
  // Codex-Image provider: 'standard' quality was a legacy value that 422s
  // against codex-image-service's current FastAPI schema (which requires
  // low/medium/high/auto). Migrate to 'auto' on first load.
  if (data.provider) {
    const provider = data.provider as any
    if (provider.codexImage && (provider.codexImage.quality === 'standard' || !provider.codexImage.quality)) {
      provider.codexImage.quality = 'auto'
    }
  }

  // Prompts: backfill stateSemantics + templates for keys missing from
  // persisted prompts (e.g. walking/dragging semantics + W/Dr templates
  // added after the user saved).
  if (data.prompts) {
    const prompts = data.prompts as any
    if (!prompts.stateSemantics) prompts.stateSemantics = {}
    for (const name of STATE_NAMES) {
      if (!prompts.stateSemantics[name] || typeof prompts.stateSemantics[name] !== 'string') {
        prompts.stateSemantics[name] = DEFAULT_STATE_SEMANTICS[name]
      }
    }
    if (!prompts.templates) prompts.templates = {}
    for (const key of ALL_TEMPLATE_KEYS) {
      if (!prompts.templates[key] || typeof prompts.templates[key] !== 'string') {
        prompts.templates[key] = DEFAULT_TEMPLATES[key]
      }
    }
  }

  if (!data.project) return data
  const project = data.project as any
  // Project-level fields
  if (project.backdropDark === undefined) project.backdropDark = null
  if (project.backdropLight === undefined) project.backdropLight = null
  if (!project.states) project.states = {}
  // SpriteState fields
  for (const name of STATE_NAMES) {
    let s = project.states[name] as any
    if (!s) {
      // Missing entire state entry (e.g. walking/dragging added after this
      // project was saved). Inject default so components don't crash when
      // they iterate STATE_NAMES + read .sheet / .status / .transform.
      project.states[name] = defaultSpriteState(name)
      continue
    }
    if (s.transform === undefined) s.transform = { scale: 1, offsetX: 0, offsetY: 0 }
    if (s.rawSheet === undefined) s.rawSheet = null
    if (s.rawStaticBase === undefined) s.rawStaticBase = null
    if (s.loopMode === undefined) s.loopMode = DEFAULT_LOOP_MODES[name]
    if (s.loopDurationMs === undefined) s.loopDurationMs = DEFAULT_LOOP_DURATIONS_MS[name]
    if (s.poseNote === undefined) s.poseNote = ''
    if (s.notes === undefined) s.notes = Array(16).fill('')
    if (s.status === undefined) s.status = s.sheet ? 'animated' : 'pending'
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
