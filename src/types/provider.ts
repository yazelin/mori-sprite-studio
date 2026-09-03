export type ProviderName =
  | 'codex-image' | 'vertex-gemini' | 'google-gemini'

export type OutputSize = '1024x1024' | '1024x1536' | '1536x1024'
// Codex-Image-Service expects one of low/medium/high/auto per its FastAPI
// schema. 'standard' was a legacy value that 422's against the current
// service. 'auto' is the recommended default — lets the service pick.
export type Quality = 'low' | 'medium' | 'high' | 'auto'
export type ImageSize = '1K' | '2K' | '4K'

export interface GenerateOpts {
  prompt: string
  references: Blob[]
  outputSize: OutputSize
  quality?: Quality
}

export interface CodexImageConfig {
  baseUrl: string
  apiKey: string
  quality: Quality
}

export interface GoogleGeminiConfig {
  apiKey: string
  model: string
  imageSize: ImageSize
  /** google-gemini only: GenAI 相容 gateway 的 base URL(空 = 官方)*/
  baseUrl?: string
}

export interface ProviderState {
  active: ProviderName
  codexImage: CodexImageConfig
  vertexGemini: GoogleGeminiConfig
  googleGemini: GoogleGeminiConfig
}
