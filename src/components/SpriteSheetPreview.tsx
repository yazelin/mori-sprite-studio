import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  sheet: Blob | null
  selectedCell: number | null
  onCellClick: (cell: number) => void
  size?: number
}

export function SpriteSheetPreview({ sheet, selectedCell, onCellClick, size = 384 }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sheet) { setUrl(null); return }
    const u = URL.createObjectURL(sheet)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [sheet])

  return (
    <div
      className="relative inline-block w-full max-w-full rounded-xl border border-border overflow-hidden tx-checker aspect-square"
      style={{ width: `min(100%, ${size}px)` }}
    >
      {url ? (
        <img src={url} alt="sheet" className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          no sheet
        </div>
      )}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
        {Array.from({ length: 16 }, (_, i) => i).map((i) => (
          <button
            key={i}
            onClick={() => onCellClick(i)}
            className={cn(
              'relative group border border-stone-300/30 transition-all text-[10px] flex items-start justify-start p-1',
              selectedCell === i
                ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-500/10 z-10'
                : 'hover:bg-emerald-500/5 hover:border-emerald-400/40',
            )}
            aria-label={`Frame ${i + 1}`}
            aria-pressed={selectedCell === i}
          >
            <span className={cn(
              'px-1 rounded text-[10px] leading-none font-mono tabular-nums backdrop-blur-sm transition-colors',
              selectedCell === i
                ? 'bg-emerald-600 text-white'
                : 'bg-white/60 text-stone-600 group-hover:bg-white/80',
            )}>
              {i + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
