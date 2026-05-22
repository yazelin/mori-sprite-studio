import type { ImageProvider } from './ImageProvider'
import type { ProviderState } from '@/types/provider'
import { CodexImageProvider } from './codexImageProvider'
import { VertexGeminiProvider } from './vertexGeminiProvider'
import { GoogleGeminiProvider } from './googleGeminiProvider'
import { AuthorFallbackProvider } from './authorFallbackProvider'

export { ProviderError } from './ImageProvider'
export type { ImageProvider } from './ImageProvider'

export function buildProvider(state: ProviderState): ImageProvider {
  switch (state.active) {
    case 'codex-image':     return new CodexImageProvider(state.codexImage)
    case 'vertex-gemini':   return new VertexGeminiProvider(state.vertexGemini)
    case 'google-gemini':   return new GoogleGeminiProvider(state.googleGemini)
    case 'author-fallback': return new AuthorFallbackProvider()
  }
}
