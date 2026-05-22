export type ProviderName =
  | 'codex-image' | 'vertex-gemini' | 'google-gemini' | 'author-fallback'

export type OutputSize = '1024x1024' | '1024x1536' | '1536x1024'
export type Quality = 'standard' | 'high'
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
}

export interface ProviderState {
  active: ProviderName
  codexImage: CodexImageConfig
  vertexGemini: GoogleGeminiConfig
  googleGemini: GoogleGeminiConfig
}
