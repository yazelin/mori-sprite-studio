import type { GenerateOpts, ProviderName } from '@/types/provider'

export interface ImageProvider {
  readonly name: ProviderName
  generateImage(opts: GenerateOpts): Promise<Blob>
}

export class ProviderError extends Error {
  constructor(
    public providerName: ProviderName,
    message: string,
    public statusCode?: number,
  ) {
    super(`[${providerName}] ${message}`)
    this.name = 'ProviderError'
  }
}
