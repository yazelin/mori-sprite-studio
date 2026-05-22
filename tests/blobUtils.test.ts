import { describe, it, expect } from 'vitest'
import { blobToBase64, base64ToBlob, dataUrlToBlob, blobToDataUrl } from '@/lib/blobUtils'

describe('blobUtils', () => {
  it('blobToBase64 + base64ToBlob round-trip preserves bytes', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' })
    const b64 = await blobToBase64(original)
    const restored = base64ToBlob(b64, 'image/png')
    const buf = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5])
    expect(restored.type).toBe('image/png')
  })

  it('blobToDataUrl + dataUrlToBlob round-trip preserves bytes and mime', async () => {
    const original = new Blob([new Uint8Array([10, 20, 30])], { type: 'image/png' })
    const url = await blobToDataUrl(original)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    const restored = await dataUrlToBlob(url)
    const buf = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(buf)).toEqual([10, 20, 30])
    expect(restored.type).toBe('image/png')
  })
})
