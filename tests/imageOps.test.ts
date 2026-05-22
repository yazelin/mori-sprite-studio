import { describe, it, expect } from 'vitest'
import { splitGrid, cropToSize, pasteIntoSheet, blobDimensions, buildPlaceholderSheet, cropCell } from '@/lib/imageOps'

async function makeBlob(width: number, height: number, fillRgba: [number, number, number, number]): Promise<Blob> {
  const c = new OffscreenCanvas(width, height)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = `rgba(${fillRgba[0]},${fillRgba[1]},${fillRgba[2]},${fillRgba[3] / 255})`
  ctx.fillRect(0, 0, width, height)
  return await c.convertToBlob({ type: 'image/png' })
}

describe('imageOps', () => {
  it('splitGrid 3×2 produces 6 sub-blobs of expected size', async () => {
    const src = await makeBlob(1536, 1024, [255, 0, 0, 255])
    const parts = await splitGrid(src, 3, 2)
    expect(parts).toHaveLength(6)
    for (const p of parts) {
      const dim = await blobDimensions(p)
      expect(dim).toEqual({ width: 512, height: 512 })
    }
  })

  it('splitGrid 4×4 produces 16 sub-blobs of expected size', async () => {
    const src = await makeBlob(1024, 1024, [0, 255, 0, 255])
    const parts = await splitGrid(src, 4, 4)
    expect(parts).toHaveLength(16)
    for (const p of parts) {
      const dim = await blobDimensions(p)
      expect(dim).toEqual({ width: 256, height: 256 })
    }
  })

  it('cropToSize resizes a 1024×1024 to 256×256', async () => {
    const src = await makeBlob(1024, 1024, [0, 0, 255, 255])
    const out = await cropToSize(src, 256, 256)
    expect(await blobDimensions(out)).toEqual({ width: 256, height: 256 })
  })

  it('pasteIntoSheet places cell into target 256×256 region', async () => {
    const sheet = await makeBlob(1024, 1024, [255, 255, 255, 255])
    const cell = await makeBlob(256, 256, [0, 0, 0, 255])
    const out = await pasteIntoSheet(sheet, cell, 5)
    expect(await blobDimensions(out)).toEqual({ width: 1024, height: 1024 })
  })
})
