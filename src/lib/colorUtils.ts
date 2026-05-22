import { CHROMA_COLORS, type ChromaKeyName } from '@/types/chroma'

export function chromaInfo(key: ChromaKeyName) {
  return CHROMA_COLORS[key]
}

export function rgbDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
