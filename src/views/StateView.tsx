import { useAppStore } from '@/store'
import type { StateName } from '@/types/project'
import { StatusBadge } from '@/components/StatusBadge'
import { GenerateButton } from '@/components/GenerateButton'
import { UploadDropzone } from '@/components/UploadDropzone'
import { SpriteSheetPreview } from '@/components/SpriteSheetPreview'
import { AnimationPreview } from '@/components/AnimationPreview'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function StateView({ name }: { name: StateName }) {
  const state = useAppStore((s) => s.project.states[name])
  const updateState = useAppStore((s) => s.updateState)
  const selectedCell = useAppStore((s) => s.ui.selectedCell)
  const selectCell = useAppStore((s) => s.selectCell)
  const setStateNote = useAppStore((s) => s.setStateNote)

  const [staticUrl, setStaticUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!state.staticBase) { setStaticUrl(null); return }
    const u = URL.createObjectURL(state.staticBase)
    setStaticUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [state.staticBase])

  // Reset cell selection when switching state
  useEffect(() => { selectCell(null) }, [name, selectCell])

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize">◆ {name}</h1>
        <StatusBadge status={state.status} className="text-2xl" />
        <span className="text-sm text-slate-500">{state.status}</span>
      </div>

      <div className="flex gap-2">
        <GenerateButton
          label={`重生此 state 靜態`}
          onGenerate={() => alert('TODO M10: wire B2')}
          onEditPrompt={() => alert('TODO M10: open prompt editor for B2')}
        />
        <GenerateButton
          label={`生 ${name} 動畫`}
          onGenerate={() => alert('TODO M10: wire C')}
          onEditPrompt={() => alert('TODO M10: open prompt editor for C')}
          disabled={!state.staticBase}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-6">
        {/* Left: static base + pose note + loop config */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">靜態 base (256×256)</Label>
            <div className="border border-border" style={{ width: 256, height: 256 }}>
              {staticUrl
                ? <img src={staticUrl} alt="static" className="w-full h-full object-contain" />
                : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-xs text-slate-400">(no static)</div>
              }
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Pose Note</Label>
            <Textarea
              value={state.poseNote}
              onChange={(e) => updateState(name, { poseNote: e.target.value })}
              rows={2}
              placeholder="e.g. 站姿、頭微抬"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Loop mode</Label>
            <Select
              value={state.loopMode}
              onValueChange={(v) => updateState(name, { loopMode: v as 'loop' | 'one-shot' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loop">loop</SelectItem>
                <SelectItem value="one-shot">one-shot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Duration: {state.loopDurationMs} ms</Label>
            <Input
              type="range"
              min={100} max={10000} step={100}
              value={state.loopDurationMs}
              onChange={(e) => updateState(name, { loopDurationMs: parseInt(e.target.value, 10) })}
            />
          </div>
        </div>

        {/* Right: sheet + animation preview */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">4×4 Sheet (1024×1024)</Label>
            <SpriteSheetPreview
              sheet={state.sheet}
              selectedCell={selectedCell}
              onCellClick={selectCell}
              size={384}
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600 block mb-1">Loop preview (256×256)</Label>
            <AnimationPreview sheet={state.sheet} durationMs={state.loopDurationMs} />
          </div>
        </div>
      </div>

      {/* Cell editor */}
      {selectedCell !== null && (
        <div className="border-t border-border pt-4 space-y-2">
          <Label className="text-sm font-semibold">Frame {selectedCell + 1}</Label>
          <Textarea
            value={state.notes[selectedCell]}
            onChange={(e) => setStateNote(name, selectedCell, e.target.value)}
            rows={2}
            placeholder="e.g. 吸氣頂點,胸口最高"
          />
          <div className="flex gap-2">
            <GenerateButton
              label="重生此 frame"
              onGenerate={() => alert('TODO M11: wire D')}
              onEditPrompt={() => alert('TODO M11: open prompt editor for D')}
              disabled={!state.staticBase || !state.sheet}
            />
            <Button variant="ghost" size="sm" onClick={() => selectCell(null)}>取消選取</Button>
          </div>
        </div>
      )}
    </div>
  )
}
