import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Sun, Moon, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { Section } from '@/components/Section'

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const

/**
 * 角色背板 — uploads two PNGs (light + dark) that mori-desktop's floating
 * widget uses behind the sprite (per PR yazelin/mori-desktop#107). These get
 * packaged at .moripack zip root as backdrop-{dark,light}.png. Optional —
 * if missing, mori-desktop falls back to the user's global backplate
 * (~/.mori/floating/backplate-{dark,light}.png) or its built-in default.
 */
export function BackdropView() {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">角色背板</h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          兩張選配 PNG,在 mori-desktop floating widget 顯示在角色後面當「光暈底圖」。沒上傳會 fallback 到 user 全域設定或 mori-desktop 內建漸層。
          典型尺寸 160×160 或 200×200,設計成柔和圓形光暈 / 角色剪影。
        </p>
      </header>

      <Section
        title="兩張背板 (Light + Dark)"
        subtitle="mori-desktop 跟系統 theme 切換時自動換對應的背板。"
        icon={<ImagePlus {...ICON_PROPS} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BackdropSlot which="light" />
          <BackdropSlot which="dark" />
        </div>
      </Section>

      <Section
        title="說明"
        subtitle="這兩張怎麼被 mori-desktop 用"
        icon={<ImagePlus {...ICON_PROPS} />}
      >
        <div className="text-sm text-muted-foreground space-y-2 max-w-prose">
          <p>mori-desktop floating widget 用 3 層 fallback:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>character pack 自帶的 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">backdrop-{'{dark,light}'}.png</code>(這頁上傳的)</li>
            <li>user 全域 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">~/.mori/floating/backplate-{'{dark,light}'}.png</code></li>
            <li>內建漸層</li>
          </ol>
          <p>所以這頁不上傳也沒關係 — 角色 pack 還是會正常運作,只是用內建背板。</p>
        </div>
      </Section>
    </div>
  )
}

function BackdropSlot({ which }: { which: 'light' | 'dark' }) {
  const blob = useAppStore((s) => which === 'light' ? s.project.backdropLight : s.project.backdropDark)
  const setBackdrop = useAppStore((s) => s.setBackdrop)
  const [url, setUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const Icon = which === 'light' ? Sun : Moon
  const label = which === 'light' ? 'Light backdrop' : 'Dark backdrop'
  const filename = `backdrop-${which}.png`
  const bgClass = which === 'light'
    ? 'bg-gradient-to-br from-stone-50 to-stone-100'
    : 'bg-gradient-to-br from-stone-700 to-stone-900'

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) setBackdrop(which, f)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
        <Icon size={16} strokeWidth={1.75} className={which === 'light' ? 'text-amber-600' : 'text-indigo-600'} />
        {label}
        <span className="ml-auto text-xs font-mono text-muted-foreground">{filename}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setBackdrop(which, f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`block w-full aspect-square rounded-xl border-2 border-dashed cursor-pointer overflow-hidden relative
          ${url ? 'border-border' : 'border-stone-300 hover:border-emerald-400'} ${bgClass}`}
      >
        {url ? (
          <>
            <img src={url} alt={label} className="w-full h-full object-contain pointer-events-none" />
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setBackdrop(which, null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBackdrop(which, null) } }}
              className="absolute top-2 right-2 h-7 w-7 rounded-md shadow-sm bg-white/95 hover:bg-white border border-border/60 flex items-center justify-center cursor-pointer"
              title="移除"
            >
              <X size={13} strokeWidth={1.75} />
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground pointer-events-none">
            <ImagePlus size={28} strokeWidth={1.5} />
            <span>點此上傳 {which === 'light' ? '淺色' : '深色'} 背板</span>
            <span className="text-[10px]">(也可拖檔進來)</span>
          </div>
        )}
      </button>
    </div>
  )
}
