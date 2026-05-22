import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useAppStore } from '@/store'
import type { Project, StateName, SpriteState } from '@/types/project'
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
}

export async function buildProjectFile(project: Project): Promise<Blob> {
  const zip = new JSZip()

  const json: ProjectJson = {
    fileVersion: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    metadata: project.metadata,
    states: {} as ProjectJson['states'],
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

export async function loadProjectFile(file: Blob): Promise<void> {
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

  const store = useAppStore.getState()

  // 1. Metadata
  store.updateMetadata(json.metadata)

  // 2. Character ref + backdrops
  store.setCharacterRef(await readBlob('character-ref.png'))
  store.setBackdrop('light', await readBlob('backdrop-light.png'))
  store.setBackdrop('dark', await readBlob('backdrop-dark.png'))

  // 3. Per-state
  for (const name of STATE_NAMES) {
    const stateJson = json.states[name]
    if (!stateJson) continue
    const sheet = await readBlob(`sprites/${name}/sheet.png`)
    const rawSheet = await readBlob(`sprites/${name}/raw-sheet.png`)
    const staticBase = await readBlob(`sprites/${name}/static-base.png`)
    const rawStaticBase = await readBlob(`sprites/${name}/raw-static-base.png`)
    store.updateState(name, {
      sheet,
      rawSheet,
      staticBase,
      rawStaticBase,
      transform: stateJson.transform,
      poseNote: stateJson.poseNote,
      notes: stateJson.notes,
      loopMode: stateJson.loopMode,
      loopDurationMs: stateJson.loopDurationMs,
      status: stateJson.status,
    })
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
  const blob = await res.blob()
  await loadProjectFile(blob)
}
