import { useEffect, useState } from 'react'

interface Props {
  sheet: Blob | null
  durationMs: number
  size?: number    // display size in px (square)
  paused?: boolean
}

export function AnimationPreview({ sheet, durationMs, size = 256, paused = false }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sheet) { setUrl(null); return }
    const u = URL.createObjectURL(sheet)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [sheet])

  if (!url) {
    return (
      <div
        className="border border-dashed border-border bg-slate-50 flex items-center justify-center text-xs text-slate-400"
        style={{ width: size, height: size }}
      >
        (no sheet)
      </div>
    )
  }

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${url})`,
    animation: paused
      ? undefined
      : `mori-sprite-x ${durationMs / 4}ms steps(4) infinite, mori-sprite-y ${durationMs}ms steps(4) infinite`,
  }

  return <div className="mori-sprite-frame border border-border" style={style} />
}
