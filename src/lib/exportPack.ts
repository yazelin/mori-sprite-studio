import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Project, StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { buildManifest } from './manifest'

export async function buildPackBlob(project: Project): Promise<Blob> {
  const zip = new JSZip()
  const manifest = buildManifest(project)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const sprites = zip.folder('sprites')
  if (!sprites) throw new Error('failed to create sprites/ folder in zip')

  for (const name of STATE_NAMES as readonly StateName[]) {
    const sheet = project.states[name].sheet
    if (!sheet) continue
    const buf = await sheet.arrayBuffer()
    sprites.file(`${name}.png`, buf)
  }

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadPack(project: Project): Promise<void> {
  const blob = await buildPackBlob(project)
  const filename = `${project.metadata.packageName}.moripack.zip`
  saveAs(blob, filename)
}
