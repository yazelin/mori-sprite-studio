import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onFile: (blob: Blob) => void
  accept?: string                    // e.g. "image/png,image/jpeg"
  label?: string                     // hint text
  preview?: string | null            // dataURL or objectURL for current upload
  className?: string
  previewSize?: number               // px square preview
}

export function UploadDropzone({
  onFile, accept = 'image/*', label = '拖放或點擊上傳圖片',
  preview, className, previewSize = 256,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!f.type.startsWith('image/')) return
    onFile(f)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); pickFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors',
        hover && 'bg-slate-100 border-slate-400',
        className,
      )}
      style={{ minHeight: previewSize, width: previewSize }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pickFiles(e.target.files)}
      />
      {preview ? (
        <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
      ) : (
        <span className="text-sm text-slate-500 px-2 text-center">{label}</span>
      )}
    </div>
  )
}
