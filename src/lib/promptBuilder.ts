import { CHROMA_SUFFIX_TEMPLATE } from '@/defaults/prompts'
import { CHROMA_COLORS, type ChromaKeyName } from '@/types/chroma'
import { render } from './promptRenderer'

export function buildChromaSuffix(key: ChromaKeyName): string {
  const c = CHROMA_COLORS[key]
  return render(CHROMA_SUFFIX_TEMPLATE, {
    chroma_color: key,
    chroma_hex: c.hex,
  })
}

export function appendChromaSuffix(template: string, key: ChromaKeyName): string {
  return `${template}\n\n${buildChromaSuffix(key)}`
}
