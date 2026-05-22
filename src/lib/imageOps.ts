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
