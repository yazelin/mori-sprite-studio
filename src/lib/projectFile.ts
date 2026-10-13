import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useAppStore } from '@/store'
import { saveStore } from '@/store/persist'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'
import type { CustomAction, Project, StateName, SpriteState } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

/**
 * Project save/load — packages the FULL current studio state into a
 * single .moriproject.zip file (or restores from one).
 *
 * Includes everything needed to resume work on the same character pack:
 *   - character ref (original upload)
 *   - per-state: sheet, rawSheet, staticBase, rawStaticBase, transform,
 *     poseNote, notes, loopMode, loopDurationMs, status
 *   - backdrop-light, backdrop-dark
 *   - metadata (packageName, displayName, version, author, license, ...)
 *
 * Different from .moripack.zip — which is the CONSUMER format for
 * mori-desktop. .moriproject.zip is the AUTHOR format for resuming work
 * (more files, larger, includes raw AI outputs + author settings).
 *
 * Format:
 *   {
 *     project.json,             ← settings + metadata + structure
 *     character-ref.png,        ← optional
 *     backdrop-light.png,       ← optional
 *     backdrop-dark.png,        ← optional
 *     sprites/{state}/sheet.png,
 *     sprites/{state}/raw-sheet.png,
 *     sprites/{state}/static-base.png,
 *     sprites/{state}/raw-static-base.png,
 *   }
 */

const PROJECT_FILE_VERSION = '1'

interface ProjectJson {
  fileVersion: typeof PROJECT_FILE_VERSION
  savedAt: string
  metadata: Project['metadata']
  states: Record<StateName, Omit<SpriteState, 'sheet' | 'rawSheet' | 'staticBase' | 'rawStaticBase'>>
  customActions?: Array<Omit<CustomAction, 'sheet' | 'rawSheet' | 'staticBase' | 'rawStaticBase'>>
}

export async function buildProjectFile(project: Project): Promise<Blob> {
  const zip = new JSZip()

  const json: ProjectJson = {
    fileVersion: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    metadata: project.metadata,
    states: {} as ProjectJson['states'],
    customActions: [],
  }

  for (const name of STATE_NAMES) {
    const s = project.states[name]
    json.states[name] = {
      transform: s.transform,
      poseNote: s.poseNote,
      notes: s.notes,
      loopMode: s.loopMode,
      loopDurationMs: s.loopDurationMs,
      status: s.status,
    }
    // Sprite blobs — each in sprites/{state}/
    if (s.sheet) zip.file(`sprites/${name}/sheet.png`, await s.sheet.arrayBuffer())
    if (s.rawSheet) zip.file(`sprites/${name}/raw-sheet.png`, await s.rawSheet.arrayBuffer())
    if (s.staticBase) zip.file(`sprites/${name}/static-base.png`, await s.staticBase.arrayBuffer())
    if (s.rawStaticBase) zip.file(`sprites/${name}/raw-static-base.png`, await s.rawStaticBase.arrayBuffer())
  }

  for (const action of project.customActions ?? []) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(action.id)) {
      throw new Error(`Invalid custom action id: ${action.id}`)
    }
    const { sheet, rawSheet, staticBase, rawStaticBase, ...metadata } = action
    json.customActions!.push(metadata)
    if (sheet) zip.file(`sprites/custom-actions/${action.id}/sheet.png`, await sheet.arrayBuffer())
    if (rawSheet) zip.file(`sprites/custom-actions/${action.id}/raw-sheet.png`, await rawSheet.arrayBuffer())
    if (staticBase) zip.file(`sprites/custom-actions/${action.id}/static-base.png`, await staticBase.arrayBuffer())
    if (rawStaticBase) zip.file(`sprites/custom-actions/${action.id}/raw-static-base.png`, await rawStaticBase.arrayBuffer())
  }

  zip.file('project.json', JSON.stringify(json, null, 2))

  if (project.characterRef) zip.file('character-ref.png', await project.characterRef.arrayBuffer())
  if (project.backdropLight) zip.file('backdrop-light.png', await project.backdropLight.arrayBuffer())
  if (project.backdropDark) zip.file('backdrop-dark.png', await project.backdropDark.arrayBuffer())

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadProjectFile(project: Project): Promise<void> {
  const blob = await buildProjectFile(project)
  const filename = `${project.metadata.packageName || 'project'}.moriproject.zip`
  saveAs(blob, filename)
}

export async function loadProjectFile(file: Blob | ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile = zip.file('project.json')
  if (!jsonFile) throw new Error('project.json not found — not a valid .moriproject.zip')
  const json = JSON.parse(await jsonFile.async('string')) as ProjectJson
  if (json.fileVersion !== PROJECT_FILE_VERSION) {
    throw new Error(`unsupported file version: ${json.fileVersion} (expected ${PROJECT_FILE_VERSION})`)
  }

  async function readBlob(path: string, type = 'image/png'): Promise<Blob | null> {
    const f = zip.file(path)
    if (!f) return null
    const ab = await f.async('arraybuffer')
    return new Blob([ab], { type })
  }

  // Read the complete project into temporary values first. Updating Zustand
  // one field at a time lets the autosaver persist partial imports, and the
  // pagehide handler can then overwrite the finished project with that partial
  // snapshot if the user refreshes while a 27 MB demo is still loading.
  const characterRef = await readBlob('character-ref.png')
  const backdropLight = await readBlob('backdrop-light.png')
  const backdropDark = await readBlob('backdrop-dark.png')
  const states = {} as Project['states']

  // Per-state sprite blobs and settings
  for (const name of STATE_NAMES) {
    const stateJson = json.states[name]
    const sheet = await readBlob(`sprites/${name}/sheet.png`)
    const rawSheet = await readBlob(`sprites/${name}/raw-sheet.png`)
    const staticBase = await readBlob(`sprites/${name}/static-base.png`)
    const rawStaticBase = await readBlob(`sprites/${name}/raw-static-base.png`)

    states[name] = {
      sheet,
      rawSheet,
      staticBase,
      rawStaticBase,
      transform: stateJson?.transform ?? { scale: 1, offsetX: 0, offsetY: 0 },
      poseNote: stateJson?.poseNote ?? '',
      notes: Array.isArray(stateJson?.notes) ? stateJson.notes : Array(16).fill(''),
      loopMode: stateJson?.loopMode ?? DEFAULT_LOOP_MODES[name],
      loopDurationMs: stateJson?.loopDurationMs ?? DEFAULT_LOOP_DURATIONS_MS[name],
      status: stateJson?.status ?? (sheet ? 'animated' : 'pending'),
    }
  }

  const customActions: CustomAction[] = []
  for (const action of json.customActions ?? []) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(action.id)) continue
    customActions.push({
      ...action,
      sheet: await readBlob(`sprites/custom-actions/${action.id}/sheet.png`),
      rawSheet: await readBlob(`sprites/custom-actions/${action.id}/raw-sheet.png`),
      staticBase: await readBlob(`sprites/custom-actions/${action.id}/static-base.png`),
      rawStaticBase: await readBlob(`sprites/custom-actions/${action.id}/raw-static-base.png`),
    })
  }

  // Publish the fully decoded project in one state update so both React and
  // the autosaver can only observe either the old project or the complete new
  // project, never a mixture of the two.
  useAppStore.setState((current) => ({
    project: {
      ...current.project,
      metadata: json.metadata,
      characterRef,
      backdropLight,
      backdropDark,
      states,
      customActions,
    },
  }))

  // Don't report success until IndexedDB has committed the complete project.
  const current = useAppStore.getState()
  try {
    await saveStore({
      project: current.project,
      prompts: current.prompts,
      provider: current.provider,
      chroma: current.chroma,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`專案已載入，但寫入瀏覽器儲存空間失敗：${detail}`)
  }
}

/**
 * Load a bundled demo project — typically from public/demo/{name}.moriproject.zip.
 * Used by the "Load Demo Mori" button on the project page to seed a new
 * visitor's IDB with a complete working example.
 */
export async function loadDemoProject(url: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch demo: HTTP ${res.status}`)
  // arrayBuffer 不用 blob:snap Chromium 對 27MB 的 res.blob() 直接 Failed to fetch(10/8 實測),arrayBuffer 正常
  await loadProjectFile(await res.arrayBuffer())
}
