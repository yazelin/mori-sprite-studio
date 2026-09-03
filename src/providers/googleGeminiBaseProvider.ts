import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { GenerateOpts, GoogleGeminiConfig, ProviderName } from '@/types/provider'
import { blobToBase64, base64ToBlob } from '@/lib/blobUtils'

function aspectFor(outputSize: GenerateOpts['outputSize']): '1:1' | '3:2' | '2:3' {
  if (outputSize === '1536x1024') return '3:2'
  if (outputSize === '1024x1536') return '2:3'
  return '1:1'
}

export abstract class GoogleGeminiBaseProvider implements ImageProvider {
  abstract readonly name: ProviderName
  protected abstract endpointUrl(model: string): string

  constructor(protected config: GoogleGeminiConfig) {}

  async generateImage({ prompt, references, outputSize }: GenerateOpts): Promise<Blob> {
    if (!this.config.apiKey) throw new ProviderError(this.name, 'API key not configured')
    if (!this.config.model) throw new ProviderError(this.name, 'Model not configured')

    const parts: unknown[] = []
    for (const ref of references) {
      const b64 = await blobToBase64(ref)
      parts.push({
        inlineData: { mimeType: ref.type || 'image/png', data: b64 },
      })
    }
    parts.push({ text: prompt })

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectFor(outputSize),
          imageSize: this.config.imageSize,
        },
      },
    }

    const url = this.endpointUrl(this.config.model)

    let resp: Response
    try {
      // key 走 header 不走 ?key=,避免明文進伺服器 access log
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${text.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
    const partsResp: unknown[] = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = partsResp.find(
      (p): p is { inlineData: { mimeType?: string; data: string } } =>
        typeof p === 'object' && p !== null && 'inlineData' in p,
    )
    if (!imagePart) {
      const texts = partsResp
        .filter((p): p is { text: string } => typeof p === 'object' && p !== null && 'text' in p)
        .map((p) => p.text)
        .join(' ')
      throw new ProviderError(this.name, `no image (refusal?): ${texts.slice(0, 300) || '(no detail)'}`)
    }

    return base64ToBlob(imagePart.inlineData.data, imagePart.inlineData.mimeType ?? 'image/png')
  }
}
