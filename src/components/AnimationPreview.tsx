import { useEffect, useRef, useState } from 'react'

interface Props {
  sheet: Blob | null
  durationMs: number
  size?: number
  paused?: boolean
}

/**
 * Canvas-based 4×4 sprite animation player.
 *
 * Previously used dual CSS keyframes animating background-position-x /
 * background-position-y as longhands. Modern Chrome's animation
 * compositor occasionally lets one animation override the other,
 * pinning the visible frame to (0%, 0%). Driving via requestAnimationFrame
 * + canvas.drawImage avoids the longhand conflict and gives us exact
 * frame control + smooth pause/resume.
 *
 * Frame timing matches mori-desktop's loop_durations_ms convention:
 * durationMs = total time for full 16-frame loop.
 */
export function AnimationPreview({ sheet, durationMs, size = 256, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hasSheet, setHasSheet] = useState(false)

  useEffect(() => {
    setHasSheet(!!sheet)
    if (!sheet) return
    let cancelled = false
    let bitmap: ImageBitmap | null = null
    let rafId: number | null = null

    createImageBitmap(sheet).then((bmp) => {
      if (cancelled) { bmp.close?.(); return }
      bitmap = bmp
    })

    const start = performance.now()
    const frameDuration = Math.max(1, durationMs / 16)

    function tick(now: number) {
      if (cancelled) return
      const canvas = canvasRef.current
      if (canvas && bitmap) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const elapsed = paused ? 0 : (now - start) % durationMs
          const frameIdx = Math.floor(elapsed / frameDuration) % 16
          const col = frameIdx % 4
          const row = Math.floor(frameIdx / 4)
          const cellW = bitmap.width / 4
          const cellH = bitmap.height / 4
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(
            bitmap,
            col * cellW, row * cellH, cellW, cellH,
            0, 0, canvas.width, canvas.height,
          )
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      bitmap?.close?.()
    }
  }, [sheet, durationMs, paused])

  if (!hasSheet) {
    return (
      <div
        className="rounded-lg border border-dashed border-stone-300 bg-stone-50/60 flex items-center justify-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        no sheet
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg"
      style={{ width: size, height: size, imageRendering: 'auto' }}
    />
  )
}
