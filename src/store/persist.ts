import { get, set, del } from 'idb-keyval'
import type { AppStore } from './index'
import { STATE_NAMES, type SpriteState, type StateName } from '@/types/project'
import {
  DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS,
  DEFAULT_STATE_SEMANTICS, DEFAULT_TEMPLATES, DEFAULT_CHROMA,
  DEFAULT_PROVIDER_STATE,
} from '@/defaults'
import type { ProviderState } from '@/types/provider'
import type { TemplateKey } from '@/types/prompts'

const ALL_TEMPLATE_KEYS: readonly TemplateKey[] = ['B1', 'B2', 'C', 'D', 'W', 'Dr'] as const

// v2: switched from localStorage (data-URL Blob, ~5MB quota) to IndexedDB
// via idb-keyval. IndexedDB stores Blobs natively via structured clone
// (no base64 bloat) and has multi-GB capacity — no QuotaExceededError
// for our 6 1024×1024 PNG sheets + 6 statics + 1 character ref.
const STORAGE_KEY = 'mori-sprite-studio.v2'
const LEGACY_LOCALSTORAGE_KEY = 'mori-sprite-studio.v1'
const PROVIDER_LOCALSTORAGE_KEY = 'mori-sprite-studio.provider.v1'

type PersistedShape = Pick<AppStore, 'project' | 'prompts' | 'provider' | 'chroma'>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

/** Read the small provider settings synchronously as a fallback to IDB. */
export function loadProviderSettings(): ProviderState | null {
  try {
    const raw = window.localStorage.getItem(PROVIDER_LOCALSTORAGE_KEY)
    if (!raw) return null
    const parsed = asRecord(JSON.parse(raw))
    const codexImage = asRecord(parsed.codexImage)
    const vertexGemini = asRecord(parsed.vertexGemini)
    const googleGemini = asRecord(parsed.googleGemini)
    const validQuality = (value: unknown): value is ProviderState['codexImage']['quality'] =>
      value === 'low' || value === 'medium' || value === 'high' || value === 'auto'
    const validImageSize = (value: unknown): value is ProviderState['googleGemini']['imageSize'] =>
      value === '1K' || value === '2K' || value === '4K'

    return {
      active: parsed.active === 'codex-image' || parsed.active === 'vertex-gemini' || parsed.active === 'google-gemini'
        ? parsed.active
        : DEFAULT_PROVIDER_STATE.active,
      codexImage: {
        baseUrl: typeof codexImage.baseUrl === 'string' ? codexImage.baseUrl : DEFAULT_PROVIDER_STATE.codexImage.baseUrl,
        apiKey: typeof codexImage.apiKey === 'string' ? codexImage.apiKey : '',
        quality: validQuality(codexImage.quality) ? codexImage.quality : DEFAULT_PROVIDER_STATE.codexImage.quality,
      },
      vertexGemini: {
        apiKey: typeof vertexGemini.apiKey === 'string' ? vertexGemini.apiKey : '',
        model: typeof vertexGemini.model === 'string' ? vertexGemini.model : DEFAULT_PROVIDER_STATE.vertexGemini.model,
        imageSize: validImageSize(vertexGemini.imageSize) ? vertexGemini.imageSize : DEFAULT_PROVIDER_STATE.vertexGemini.imageSize,
      },
      googleGemini: {
        apiKey: typeof googleGemini.apiKey === 'string' ? googleGemini.apiKey : '',
        model: typeof googleGemini.model === 'string' ? googleGemini.model : DEFAULT_PROVIDER_STATE.googleGemini.model,
        imageSize: validImageSize(googleGemini.imageSize) ? googleGemini.imageSize : DEFAULT_PROVIDER_STATE.googleGemini.imageSize,
        baseUrl: typeof googleGemini.baseUrl === 'string' ? googleGemini.baseUrl : DEFAULT_PROVIDER_STATE.googleGemini.baseUrl,
      },
    }
  } catch (e) {
    console.error('provider settings load failed', e)
    return null
  }
}

/** Save provider settings synchronously so a quick refresh cannot beat IDB debounce. */
export function saveProviderSettings(provider: ProviderState): void {
  window.localStorage.setItem(PROVIDER_LOCALSTORAGE_KEY, JSON.stringify(provider))
}

export function isLocalStorageAvailable(): boolean {
  try {
    const key = `mori-sprite-studio-probe-${Date.now()}-${Math.random()}`
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function saveLocalSettings(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('local settings save failed', e)
    return false
  }
}

export async function saveStore(store: PersistedShape): Promise<void> {
  await set(STORAGE_KEY, store)
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
  if (data.chroma) {
    const chroma = data.chroma as any
    const validKeys = ['green', 'magenta', 'blue', 'cyan', 'yellow', 'custom']
    data.chroma = {
      ...DEFAULT_CHROMA,
      ...chroma,
      key: validKeys.includes(chroma.key) ? chroma.key : DEFAULT_CHROMA.key,
      customHex: typeof chroma.customHex === 'string' && /^[0-9a-fA-F]{6}$/.test(chroma.customHex.replace(/^#/, ''))
        ? chroma.customHex.replace(/^#/, '').toUpperCase()
        : DEFAULT_CHROMA.customHex,
    }
  }

  // Codex-Image provider: 'standard' quality was a legacy value that 422s
  // against codex-image-service's current FastAPI schema (which requires
  // low/medium/high/auto). Migrate to 'auto' on first load.
  if (data.provider) {
    const provider = data.provider as any
    if (provider.codexImage && (provider.codexImage.quality === 'standard' || !provider.codexImage.quality)) {
      provider.codexImage.quality = 'auto'
    }
    // Author Fallback 已停止提供(2026-09):舊存檔遷到 BYOK 預設
    if (provider.active === 'author-fallback') {
      provider.active = 'google-gemini'
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
  if (!Array.isArray(project.customActions)) project.customActions = []
  project.customActions = project.customActions
    .filter((action: any) => action && typeof action.id === 'string')
    .map((action: any) => ({
      id: action.id,
      name: typeof action.name === 'string' ? action.name : '自訂動作',
      description: typeof action.description === 'string' ? action.description : '',
      poseNote: typeof action.poseNote === 'string' ? action.poseNote : '',
      staticBase: action.staticBase ?? null,
      rawStaticBase: action.rawStaticBase ?? null,
      sheet: action.sheet ?? null,
      rawSheet: action.rawSheet ?? null,
      transform: action.transform ?? { scale: 1, offsetX: 0, offsetY: 0 },
      loopMode: action.loopMode === 'loop' ? 'loop' : 'one-shot',
      loopDurationMs: Number.isFinite(action.loopDurationMs) ? action.loopDurationMs : 1800,
      status: ['pending', 'placeholder', 'animated'].includes(action.status)
        ? action.status
        : action.sheet ? 'animated' : 'pending',
    }))
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
let pendingStore: PersistedShape | null = null

export function debouncedSave(store: PersistedShape, delayMs = 300): void {
  pendingStore = store
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushPendingSave, delayMs)
}

/** Persist the latest state immediately when the page is hidden or closed. */
export function flushPendingSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const store = pendingStore
  pendingStore = null
  if (store) {
    void saveStore(store).catch((e) => console.error('persist save failed', e))
  }
}
