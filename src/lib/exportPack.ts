import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Project, StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { buildManifest } from './manifest'
import { bakeTransformIntoSheet } from './imageOps'

export async function buildPackBlob(project: Project): Promise<Blob> {
  const zip = new JSZip()
  const manifest = buildManifest(project)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const sprites = zip.folder('sprites')
  if (!sprites) throw new Error('failed to create sprites/ folder in zip')

  for (const name of STATE_NAMES as readonly StateName[]) {
    const state = project.states[name]
    if (!state.sheet) continue
    // Bake the per-state transform (scale + offset) into the exported sheet
    // so .moripack consumers (mori-desktop) get the cross-state-aligned
    // version the user sees in Loop Preview.
    const baked = await bakeTransformIntoSheet(state.sheet, state.transform)
    const buf = await baked.arrayBuffer()
    sprites.file(`${name}.png`, buf)
  }

  // Optional backdrops at zip root (per mori-desktop PR #107):
  // mori-desktop's floating widget reads backdrop-{dark,light}.png from
  // the character pack root if present, falling back to user global or
  // built-in default. Manifest schema unchanged — just drop the files.
  if (project.backdropLight) {
    zip.file('backdrop-light.png', await project.backdropLight.arrayBuffer())
  }
  if (project.backdropDark) {
    zip.file('backdrop-dark.png', await project.backdropDark.arrayBuffer())
  }

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadPack(project: Project): Promise<void> {
  const blob = await buildPackBlob(project)
  const filename = `${project.metadata.packageName}.moripack.zip`
  saveAs(blob, filename)
}
