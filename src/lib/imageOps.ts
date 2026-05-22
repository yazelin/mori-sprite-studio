export async function blobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  return { width: bitmap.width, height: bitmap.height }
}

export async function splitGrid(src: Blob, cols: number, rows: number): Promise<Blob[]> {
  const bitmap = await createImageBitmap(src)
  const cellW = Math.floor(bitmap.width / cols)
  const cellH = Math.floor(bitmap.height / rows)
  const out: Blob[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = new OffscreenCanvas(cellW, cellH)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap as any, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH)
      out.push(await canvas.convertToBlob({ type: 'image/png' }))
    }
  }
  return out
}

export async function cropToSize(src: Blob, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap as any, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
  return await canvas.convertToBlob({ type: 'image/png' })
}

export async function buildPlaceholderSheet(staticBase: Blob): Promise<Blob> {
  const cell = await createImageBitmap(staticBase)
  const canvas = new OffscreenCanvas(1024, 1024)
  const ctx = canvas.getContext('2d')!
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.drawImage(cell as any, 0, 0, cell.width, cell.height, c * 256, r * 256, 256, 256)
    }
  }
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Like buildPlaceholderSheet but pre-fills the canvas with a solid chroma
 * color (matching the user's chroma key choice) BEFORE tiling the character
 * cells on top. Use this when sending the sheet as an AI reference, so the
 * AI sees the same magenta/green background it's expected to output —
 * removes the "transparent vs filled" ambiguity that creates pink halos.
 */
export async function buildPlaceholderSheetWithChromaBg(
  staticBase: Blob,
  chromaHex: string,
): Promise<Blob> {
  const cell = await createImageBitmap(staticBase)
  const canvas = new OffscreenCanvas(1024, 1024)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `#${chromaHex}`
  ctx.fillRect(0, 0, 1024, 1024)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.drawImage(cell as any, 0, 0, cell.width, cell.height, c * 256, r * 256, 256, 256)
    }
  }
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Erode the outer N pixels of every cell in a 4×4 sprite sheet to fully
 * transparent. Use after chroma key to wipe any residual edge spill that
 * the chroma threshold couldn't catch (e.g. a 1-2 px halo of dim magenta
 * around the character outline that's too dark to score above threshold
 * but still visible against a light background).
 *
 * Applies cell-by-cell — each of the 16 cells gets its own 2 px border
 * erased independently, so character pixels in the centre stay intact.
 */
export async function erodeCellEdges(
  sheet: Blob,
  erosionPx = 2,
  cellsPerSide = 4,
): Promise<Blob> {
  const bmp = await createImageBitmap(sheet)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0)
  const cellW = Math.floor(bmp.width / cellsPerSide)
  const cellH = Math.floor(bmp.height / cellsPerSide)
  for (let r = 0; r < cellsPerSide; r++) {
    for (let c = 0; c < cellsPerSide; c++) {
      eraseOuterBorder(ctx, c * cellW, r * cellH, cellW, cellH, erosionPx)
    }
  }
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Erode the outer N pixels of a single cell (e.g. 256×256) to transparent.
 * Used after D regenerates a single cell, before pasting it into the sheet.
 */
export async function erodeSingleCellEdges(cell: Blob, erosionPx = 2): Promise<Blob> {
  const bmp = await createImageBitmap(cell)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0)
  eraseOuterBorder(ctx, 0, 0, bmp.width, bmp.height, erosionPx)
  return await canvas.convertToBlob({ type: 'image/png' })
}

function eraseOuterBorder(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  borderPx: number,
): void {
  if (borderPx <= 0) return
  const img = ctx.getImageData(x, y, w, h)
  for (let py = 0; py < h; py++) {
    const inBorderY = py < borderPx || py >= h - borderPx
    for (let px = 0; px < w; px++) {
      const inBorderX = px < borderPx || px >= w - borderPx
      if (inBorderX || inBorderY) {
        img.data[(py * w + px) * 4 + 3] = 0
      }
    }
  }
  ctx.putImageData(img, x, y)
}

/**
 * Bake a per-cell transform (scale + offset) into a sheet — produces a
 * new 1024×1024 sheet where each cell has been scaled around its centre
 * and offset by the requested amounts. Used at export time so APNG /
 * GIF / WebM / raw-sheet download / .moripack all carry the alignment
 * the user sees in Loop Preview.
 */
export async function bakeTransformIntoSheet(
  sheet: Blob,
  transform: { scale: number; offsetX: number; offsetY: number },
  cellsPerSide = 4,
): Promise<Blob> {
  if (transform.scale === 1 && transform.offsetX === 0 && transform.offsetY === 0) {
    return sheet
  }
  const bmp = await createImageBitmap(sheet)
  const cellW = Math.floor(bmp.width / cellsPerSide)
  const cellH = Math.floor(bmp.height / cellsPerSide)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (let r = 0; r < cellsPerSide; r++) {
    for (let c = 0; c < cellsPerSide; c++) {
      const dx = c * cellW, dy = r * cellH
      ctx.save()
      ctx.translate(dx + cellW / 2 + transform.offsetX, dy + cellH / 2 + transform.offsetY)
      ctx.scale(transform.scale, transform.scale)
      ctx.drawImage(bmp as unknown as CanvasImageSource, c * cellW, r * cellH, cellW, cellH, -cellW / 2, -cellH / 2, cellW, cellH)
      ctx.restore()
    }
  }
  return await canvas.convertToBlob({ type: 'image/png' })
}

/** Same as bakeTransformIntoSheet but for a single cell (e.g. 256×256 staticBase). */
export async function bakeTransformIntoCell(
  cell: Blob,
  transform: { scale: number; offsetX: number; offsetY: number },
): Promise<Blob> {
  if (transform.scale === 1 && transform.offsetX === 0 && transform.offsetY === 0) {
    return cell
  }
  const bmp = await createImageBitmap(cell)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(bmp.width / 2 + transform.offsetX, bmp.height / 2 + transform.offsetY)
  ctx.scale(transform.scale, transform.scale)
  ctx.drawImage(bmp as unknown as CanvasImageSource, -bmp.width / 2, -bmp.height / 2)
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Take a transparent-bg cell and re-stamp it on a solid chroma background.
 * Same purpose as buildPlaceholderSheetWithChromaBg but for single cells
 * (used by D's reference building so each reference cell carries an
 * unambiguous chroma background).
 */
export async function fillBgWithChroma(
  cellBlob: Blob,
  chromaHex: string,
): Promise<Blob> {
  const bmp = await createImageBitmap(cellBlob)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `#${chromaHex}`
  ctx.fillRect(0, 0, bmp.width, bmp.height)
  ctx.drawImage(bmp as any, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}

export async function pasteIntoSheet(sheet: Blob, cell: Blob, cellIndex: number): Promise<Blob> {
  if (cellIndex < 0 || cellIndex > 15) throw new Error(`cellIndex out of range: ${cellIndex}`)
  const sheetBitmap = await createImageBitmap(sheet)
  const cellBitmap = await createImageBitmap(cell)
  const canvas = new OffscreenCanvas(1024, 1024)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(sheetBitmap as any, 0, 0)
  const row = Math.floor(cellIndex / 4)
  const col = cellIndex % 4
  ctx.clearRect(col * 256, row * 256, 256, 256)
  ctx.drawImage(cellBitmap as any, 0, 0, cellBitmap.width, cellBitmap.height, col * 256, row * 256, 256, 256)
  return await canvas.convertToBlob({ type: 'image/png' })
}

export async function cropCell(sheet: Blob, cellIndex: number): Promise<Blob> {
  if (cellIndex < 0 || cellIndex > 15) throw new Error(`cellIndex out of range: ${cellIndex}`)
  const bitmap = await createImageBitmap(sheet)
  const row = Math.floor(cellIndex / 4)
  const col = cellIndex % 4
  const canvas = new OffscreenCanvas(256, 256)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as any, col * 256, row * 256, 256, 256, 0, 0, 256, 256)
  return await canvas.convertToBlob({ type: 'image/png' })
}
