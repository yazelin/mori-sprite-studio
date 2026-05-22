import { useEffect, useRef, useState } from 'react'
import type { CellTransform } from '@/types/project'
import { IDENTITY_TRANSFORM } from '@/types/project'

interface Props {
  sheet: Blob | null
  durationMs: number
  size?: number
  paused?: boolean
  /** Per-state transform (scale + offset) baked into render. Defaults to identity. */
  transform?: CellTransform
  /** Show horizontal/vertical reference guides for alignment tuning. */
  showGuides?: boolean
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
export function AnimationPreview({
  sheet, durationMs, size = 256, paused = false,
  transform = IDENTITY_TRANSFORM,
  showGuides = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hasSheet, setHasSheet] = useState(false)
  const transformRef = useRef(transform)
  transformRef.current = transform
  const showGuidesRef = useRef(showGuides)
  showGuidesRef.current = showGuides

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
          const t = transformRef.current
          const elapsed = paused ? 0 : (now - start) % durationMs
          const frameIdx = Math.floor(elapsed / frameDuration) % 16
          const col = frameIdx % 4
          const row = Math.floor(frameIdx / 4)
          const cellW = bitmap.width / 4
          const cellH = bitmap.height / 4
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          // Apply transform: scale around canvas centre + offset
          // offsetX/Y are in source-pixel units (cellW=256), scale to canvas dest
          const offsetScaleFactor = canvas.width / cellW
          ctx.save()
          ctx.translate(
            canvas.width / 2 + t.offsetX * offsetScaleFactor,
            canvas.height / 2 + t.offsetY * offsetScaleFactor,
          )
          ctx.scale(t.scale, t.scale)
          ctx.drawImage(
            bitmap,
            col * cellW, row * cellH, cellW, cellH,
            -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height,
          )
          ctx.restore()

          // Reference guides overlay
          if (showGuidesRef.current) {
            ctx.save()
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)' // emerald
            ctx.setLineDash([4, 3])
            ctx.lineWidth = 1
            const w = canvas.width, h = canvas.height
            // Vertical center
            ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke()
            // Horizontal center
            ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
            // Upper third (~ "eye line" target)
            ctx.beginPath(); ctx.moveTo(0, h / 3); ctx.lineTo(w, h / 3); ctx.stroke()
            // Lower third (~ "chin / body bottom" target)
            ctx.beginPath(); ctx.moveTo(0, h * 2 / 3); ctx.lineTo(w, h * 2 / 3); ctx.stroke()
            ctx.restore()
          }
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
