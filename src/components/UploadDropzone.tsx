import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onFile: (blob: Blob) => void
  accept?: string
  label?: string
  hint?: string
  preview?: string | null
  className?: string
  previewSize?: number
  variant?: 'square' | 'wide'
}

export function UploadDropzone({
  onFile,
  accept = 'image/*',
  label = '拖放或點擊上傳圖片',
  hint,
  preview,
  className,
  previewSize = 256,
  variant = 'square',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!f.type.startsWith('image/')) return
    onFile(f)
  }

  const wide = variant === 'wide'

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); pickFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'relative group rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden',
        'flex items-center justify-center bg-stone-50/60',
        preview
          ? 'border-border bg-card hover:border-emerald-300'
          : 'border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/40',
        hover && 'border-emerald-500 bg-emerald-50',
        className,
      )}
      style={
        wide
          ? { minHeight: previewSize }
          : { minHeight: previewSize, width: previewSize }
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pickFiles(e.target.files)}
      />
      {preview ? (
        <>
          <img src={preview} alt="preview" className="max-w-full max-h-full object-contain p-3" />
          <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-white/95 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[11px] text-stone-700 text-center">點此更換圖片</p>
          </div>
        </>
      ) : (
        <div className="px-6 py-8 flex flex-col items-center justify-center gap-3 text-center">
          <UploadIcon />
          <div>
            <p className="text-sm font-medium text-stone-700">{label}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </div>
  )
}
