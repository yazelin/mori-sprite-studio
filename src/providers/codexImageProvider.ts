import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { CodexImageConfig, GenerateOpts } from '@/types/provider'
import { blobToBase64 } from '@/lib/blobUtils'

export class CodexImageProvider implements ImageProvider {
  readonly name = 'codex-image' as const

  constructor(private config: CodexImageConfig) {}

  async generateImage({ prompt, references, outputSize, quality }: GenerateOpts): Promise<Blob> {
    if (!this.config.apiKey) throw new ProviderError(this.name, 'API key not configured')
    if (!this.config.baseUrl) throw new ProviderError(this.name, 'Base URL not configured')

    const referenceImagesBase64 = await Promise.all(references.map((r) => blobToBase64(r)))

    const body = {
      prompt,
      size: outputSize,
      quality: quality ?? this.config.quality,
      count: 1,
      ...(referenceImagesBase64.length > 0 ? { reference_images_base64: referenceImagesBase64 } : {}),
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    let resp: Response
    try {
      resp = await fetch(`${baseUrl}/v1/images/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 401) throw new ProviderError(this.name, 'API key invalid (401)', 401)
      if (resp.status === 403) throw new ProviderError(this.name, 'API key disabled (403)', 403)
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${text.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
    const imageUrl: string | undefined = data?.images?.[0]?.url
    if (!imageUrl) throw new ProviderError(this.name, `no image URL: ${JSON.stringify(data).slice(0, 300)}`)

    const pngResp = await fetch(imageUrl)
    if (!pngResp.ok) throw new ProviderError(this.name, `image fetch HTTP ${pngResp.status}`)
    return await pngResp.blob()
  }
}
