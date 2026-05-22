import { GoogleGeminiBaseProvider } from './googleGeminiBaseProvider'

export class VertexGeminiProvider extends GoogleGeminiBaseProvider {
  readonly name = 'vertex-gemini' as const

  protected endpointUrl(model: string, apiKey: string): string {
    return `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  }
}
