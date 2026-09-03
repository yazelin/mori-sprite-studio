import { GoogleGeminiBaseProvider } from './googleGeminiBaseProvider'

export class GoogleGeminiProvider extends GoogleGeminiBaseProvider {
  readonly name = 'google-gemini' as const

  protected endpointUrl(model: string): string {
    const base = (this.config.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    return `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`
  }
}
