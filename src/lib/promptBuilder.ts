import { CHROMA_SUFFIX_TEMPLATE } from '@/defaults/prompts'
import type { ChromaState } from '@/types/chroma'
import { chromaInfo } from './colorUtils'
import { render } from './promptRenderer'

export function buildChromaSuffix(chroma: Pick<ChromaState, 'key' | 'customHex'>): string {
  const c = chromaInfo(chroma)
  return render(CHROMA_SUFFIX_TEMPLATE, {
    chroma_color: c.promptName,
    chroma_hex: c.hex,
  })
}

export function appendChromaSuffix(template: string, chroma: Pick<ChromaState, 'key' | 'customHex'>): string {
  return `${template}\n\n${buildChromaSuffix(chroma)}`
}
