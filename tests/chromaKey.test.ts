import { describe, it, expect } from 'vitest'
import { chromaKeyOut } from '@/lib/chromaKey'

async function makePng(rgba: number[][]): Promise<Blob> {
  const canvas = new OffscreenCanvas(2, 2)
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(2, 2)
  for (let i = 0; i < rgba.length; i++) {
    imgData.data[i * 4]     = rgba[i][0]
    imgData.data[i * 4 + 1] = rgba[i][1]
    imgData.data[i * 4 + 2] = rgba[i][2]
    imgData.data[i * 4 + 3] = rgba[i][3]
  }
  ctx.putImageData(imgData, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}

async function readPixels(blob: Blob): Promise<number[][]> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as any, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
  }
  return pixels
}

describe('chromaKey', () => {
  it('removes pure-green pixels (alpha = 0) and keeps non-green opaque', async () => {
    const src = await makePng([
      [0, 255, 0, 255],
      [255, 0, 0, 255],
      [0, 0, 255, 255],
      [0, 255, 0, 255],
    ])
    const out = await chromaKeyOut(src, [0, 255, 0], 'balanced')
    const px = await readPixels(out)
    expect(px[0][3]).toBe(0)
    expect(px[1][3]).toBe(255)
    expect(px[2][3]).toBe(255)
    expect(px[3][3]).toBe(0)
  })

  it('removes pure-magenta pixels when key is magenta', async () => {
    const src = await makePng([
      [255, 0, 255, 255],
      [0, 255, 0, 255],
      [128, 128, 128, 255],
      [255, 0, 255, 255],
    ])
    const out = await chromaKeyOut(src, [255, 0, 255], 'balanced')
    const px = await readPixels(out)
    expect(px[0][3]).toBe(0)
    expect(px[1][3]).toBe(255)
    expect(px[2][3]).toBe(255)
    expect(px[3][3]).toBe(0)
  })

  it('aggressive tolerance removes near-green pixels that balanced would keep', async () => {
    const slightOff = [40, 250, 40, 255]
    const src = await makePng([slightOff, slightOff, slightOff, slightOff])
    const balanced = await chromaKeyOut(src, [0, 255, 0], 'balanced')
    const aggressive = await chromaKeyOut(src, [0, 255, 0], 'aggressive')
    const balPx = await readPixels(balanced)
    const aggPx = await readPixels(aggressive)
    expect(balPx[0][3]).toBeGreaterThan(0)
    expect(balPx[0][3]).toBeLessThan(255)
    expect(aggPx[0][3]).toBe(0)
  })
})
