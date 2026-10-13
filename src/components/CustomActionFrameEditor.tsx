import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { splitGrid } from '@/lib/imageOps'

interface Props {
  actionId: string
  actionName: string
  sheet: Blob
  disabled: boolean
  busyFrameIndex: number | null
  onReorder: (permutation: readonly number[]) => Promise<void>
  onRegenerate: (frameIndex: number, correction: string) => void
}

export function CustomActionFrameEditor({
  actionId,
  actionName,
  sheet,
  disabled,
  busyFrameIndex,
  onReorder,
  onRegenerate,
}: Props) {
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [correction, setCorrection] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const reorderingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let urls: string[] = []
    setFrameUrls([])
    void splitGrid(sheet, 4, 4).then((frames) => {
      const nextUrls = frames.map((frame) => URL.createObjectURL(frame))
      if (cancelled) {
        nextUrls.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      urls = nextUrls
      setFrameUrls(nextUrls)
    }).catch(() => {
      if (!cancelled) setFrameUrls([])
    })
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [sheet])

  async function moveFrame(from: number, to: number) {
    if (from === to || to < 0 || to > 15 || reorderingRef.current || busyFrameIndex !== null || disabled) return
    const permutation = Array.from({ length: 16 }, (_, index) => index)
    const [moved] = permutation.splice(from, 1)
    permutation.splice(to, 0, moved)
    reorderingRef.current = true
    setReordering(true)
    try {
      await onReorder(permutation)
      setSelectedIndex(permutation.indexOf(selectedIndex))
    } catch {
      // The parent surfaces the generation/editor error in the action card.
    } finally {
      reorderingRef.current = false
      setReordering(false)
      setDraggedIndex(null)
      setDropIndex(null)
    }
  }

  function selectFrame(index: number) {
    setSelectedIndex(index)
    setCorrection('')
  }

  const locked = disabled || reordering || busyFrameIndex !== null

  return (
    <section className="mt-6 space-y-4 border-t border-stone-200 pt-5" aria-label={`${actionName}逐格編輯`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">逐格編輯</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            拖曳影格調整播放順序，或用左右箭頭移動一格。右側預覽會即時播放目前順序。
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <GripVertical size={14} /> 共 16 格
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2" aria-label="動畫影格順序">
        {Array.from({ length: 16 }, (_, index) => (
          <div
            key={index}
            onDragOver={(event) => {
              event.preventDefault()
              if (!locked) setDropIndex(index)
            }}
            onDragLeave={() => setDropIndex((current) => current === index ? null : current)}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedIndex !== null) void moveFrame(draggedIndex, index)
            }}
            className={`min-w-0 rounded-lg border p-1.5 transition-colors ${
              selectedIndex === index ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-stone-200 bg-white'
            } ${dropIndex === index ? 'outline outline-2 outline-emerald-400' : ''} ${draggedIndex === index ? 'opacity-50' : ''}`}
          >
            <button
              type="button"
              draggable={!locked}
              disabled={locked}
              aria-label={`選取第 ${index + 1} 格${selectedIndex === index ? '，目前選取' : ''}`}
              onClick={() => selectFrame(index)}
              onDragStart={(event) => {
                setDraggedIndex(index)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(index))
              }}
              onDragEnd={() => {
                setDraggedIndex(null)
                setDropIndex(null)
              }}
              className="group relative block aspect-square w-full cursor-grab overflow-hidden rounded-md tx-checker active:cursor-grabbing disabled:cursor-wait"
            >
              {frameUrls[index] && <img src={frameUrls[index]} alt={`第 ${index + 1} 格`} className="h-full w-full object-contain" />}
              <span className="absolute left-1 top-1 rounded bg-stone-900/75 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="absolute bottom-1 right-1 rounded bg-stone-900/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <GripVertical size={13} />
              </span>
            </button>
            <div className="mt-1 flex justify-between gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`將第 ${index + 1} 格往前移`}
                title="往前移一格"
                disabled={locked || index === 0}
                onClick={() => void moveFrame(index, index - 1)}
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`將第 ${index + 1} 格往後移`}
                title="往後移一格"
                disabled={locked || index === 15}
                onClick={() => void moveFrame(index, index + 1)}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={`frame-correction-${actionId}`}>第 {selectedIndex + 1} 格修正說明</Label>
          <Textarea
            id={`frame-correction-${actionId}`}
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={locked}
            placeholder="例如：把右手抬高一些，手掌朝向畫面前方；其他服裝和表情保持一致。"
          />
          <p className="text-xs text-muted-foreground">只會重生選取的影格，其餘 15 格會保留。修正說明不會改動整段動作描述。</p>
        </div>
        <Button
          type="button"
          disabled={locked || !correction.trim()}
          onClick={() => onRegenerate(selectedIndex, correction)}
          className="gap-2 sm:mb-0.5"
        >
          <WandSparkles size={16} />
          {busyFrameIndex === selectedIndex ? '重生這一格中…' : `重生第 ${selectedIndex + 1} 格`}
        </Button>
      </div>
    </section>
  )
}
