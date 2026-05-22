import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  sheet: Blob | null
  selectedCell: number | null    // 0-15 or null
  onCellClick: (cell: number) => void
  size?: number                  // display side length in px
}

export function SpriteSheetPreview({ sheet, selectedCell, onCellClick, size = 384 }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sheet) { setUrl(null); return }
    const u = URL.createObjectURL(sheet)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [sheet])

  const cellSize = size / 4

  return (
    <div className="relative inline-block border border-border" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="sheet" className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          (no sheet)
        </div>
      )}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
        {Array.from({ length: 16 }, (_, i) => i).map((i) => (
          <button
            key={i}
            onClick={() => onCellClick(i)}
            className={cn(
              'border border-slate-300/50 hover:bg-slate-900/10 transition-colors text-[10px] text-slate-600 flex items-start justify-start p-0.5',
              selectedCell === i && 'border-2 border-blue-500 bg-blue-500/10',
            )}
            style={{ width: cellSize, height: cellSize }}
            aria-label={`Frame ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
