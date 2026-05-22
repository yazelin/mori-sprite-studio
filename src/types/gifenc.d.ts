declare module 'gifenc' {
  /** Minimal types for gifenc — we only use these three exports. */
  export function GIFEncoder(): {
    writeFrame(
      indices: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        repeat?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
  }

  export function quantize(
    pixels: Uint8Array | number[] | number[][],
    maxColors: number,
    opts?: { format?: 'rgb444' | 'rgb565' | 'rgba4444' },
  ): number[][]

  export function applyPalette(
    pixels: Uint8Array | number[],
    palette: number[][],
    format?: 'rgb444' | 'rgb565' | 'rgba4444',
  ): Uint8Array
}
