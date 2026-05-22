import { CHROMA_THRESHOLDS, type ChromaTolerance } from '@/types/chroma'

export async function chromaKeyOut(
  src: Blob,
  keyRgb: [number, number, number],
  tolerance: ChromaTolerance,
): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as any, 0, 0)
  const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const data = imgData.data
  const { hard, soft } = CHROMA_THRESHOLDS[tolerance]
  const [kr, kg, kb] = keyRgb

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - kr
    const dg = data[i + 1] - kg
    const db = data[i + 2] - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist <= hard) {
      data[i + 3] = 0
    } else if (dist < soft) {
      const t = (dist - hard) / (soft - hard)
      data[i + 3] = Math.round(data[i + 3] * t)
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}
