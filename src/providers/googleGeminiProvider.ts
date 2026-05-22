import { GoogleGeminiBaseProvider } from './googleGeminiBaseProvider'

export class GoogleGeminiProvider extends GoogleGeminiBaseProvider {
  readonly name = 'google-gemini' as const

  protected endpointUrl(model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  }
}
