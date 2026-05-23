import type { ProviderState } from '@/types/provider'

export const DEFAULT_PROVIDER_STATE: ProviderState = {
  active: 'author-fallback',
  codexImage: {
    baseUrl: 'https://ching-tech.ddns.net/codex-image',
    apiKey: '',
    quality: 'auto',
  },
  vertexGemini: {
    apiKey: '',
    model: 'gemini-3-pro-image-preview',
    imageSize: '1K',
  },
  googleGemini: {
    apiKey: '',
    model: 'gemini-2.5-flash-image',
    imageSize: '1K',
  },
}
