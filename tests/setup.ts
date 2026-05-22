import '@testing-library/jest-dom'

// Polyfill IndexedDB for jsdom (needed by idb-keyval-backed persistence)
import 'fake-indexeddb/auto'

// Polyfill OffscreenCanvas + createImageBitmap for jsdom using node-canvas.
// node-canvas provides a full Canvas 2D API in Node, backed by Cairo.
// We return the underlying node-canvas Image from createImageBitmap so that
// drawImage() accepts it (node-canvas's drawImage accepts canvas Image objects).

import { createCanvas, Image } from 'canvas'
import type { Canvas as NodeCanvas } from 'canvas'

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  // @ts-expect-error - polyfill for test env
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    private _canvas: NodeCanvas
    public width: number
    public height: number

    constructor(width: number, height: number) {
      this.width = width
      this.height = height
      this._canvas = createCanvas(width, height)
    }

    getContext(contextId: '2d') {
      if (contextId !== '2d') return null
      return this._canvas.getContext('2d')
    }

    async convertToBlob(options?: { type?: string }): Promise<Blob> {
      const mimeType = options?.type ?? 'image/png'
      // node-canvas only supports image/png and image/jpeg for toBuffer
      const format = mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
      const buffer = this._canvas.toBuffer(format as 'image/png' | 'image/jpeg')
      return new Blob([buffer], { type: mimeType })
    }
  }
}

if (typeof globalThis.createImageBitmap === 'undefined') {
  // @ts-expect-error - polyfill for test env
  globalThis.createImageBitmap = async (source: Blob): Promise<{ width: number; height: number }> => {
    const arrayBuffer = await source.arrayBuffer()
    const img = new Image()
    // node-canvas Image.src accepts a Buffer synchronously for PNG/JPEG
    img.src = Buffer.from(arrayBuffer)
    // Return the Image itself — node-canvas's drawImage() accepts Image objects,
    // and the Image has .width and .height set after src assignment.
    return img
  }
}
