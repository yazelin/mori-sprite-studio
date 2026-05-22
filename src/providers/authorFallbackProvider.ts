import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { GenerateOpts } from '@/types/provider'
import { blobToBase64, base64ToBlob } from '@/lib/blobUtils'

export class AuthorFallbackProvider implements ImageProvider {
  readonly name = 'author-fallback' as const

  async generateImage({ prompt, references, outputSize }: GenerateOpts): Promise<Blob> {
    const refsB64 = await Promise.all(references.map((r) => blobToBase64(r)))

    let resp: Response
    try {
      resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, references: refsB64, outputSize }),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      let detail = ''
      try {
        const err = await resp.json()
        detail = err.detail ?? err.error ?? ''
      } catch {
        detail = await resp.text().catch(() => '')
      }
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${detail.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
    if (!data.data) throw new ProviderError(this.name, 'response missing image data')
    return base64ToBlob(data.data, data.mimeType ?? 'image/png')
  }
}
