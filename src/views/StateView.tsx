import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import type { StateName } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import { StatusBadge } from '@/components/StatusBadge'
import { GenerateButton } from '@/components/GenerateButton'
import { SpriteSheetPreview } from '@/components/SpriteSheetPreview'
import { AnimationPreview } from '@/components/AnimationPreview'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext } from '@/lib/generationFlow'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function StateView({ name }: { name: StateName }) {
  const state = useAppStore((s) => s.project.states[name])
  const updateState = useAppStore((s) => s.updateState)
  const selectedCell = useAppStore((s) => s.ui.selectedCell)
  const selectCell = useAppStore((s) => s.selectCell)
  const setStateNote = useAppStore((s) => s.setStateNote)

  const [staticUrl, setStaticUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalContext, setModalContext] = useState<PromptEditorContext | null>(null)
  const [pendingKey, setPendingKey] = useState<TemplateKey | null>(null)

  useEffect(() => {
    if (!state.staticBase) { setStaticUrl(null); return }
    const u = URL.createObjectURL(state.staticBase)
    setStaticUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [state.staticBase])

  useEffect(() => { selectCell(null) }, [name, selectCell])

  async function runOp(key: TemplateKey, cellIdx?: number) {
    setError(null); setGenerating(true)
    try { await runGeneration(key, name, cellIdx) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  function openModal(key: TemplateKey, cellIdx?: number) {
    const { vars, opLabel } = buildPromptContext(key, name, cellIdx)
    setModalContext({ templateKey: key, vars, opLabel })
    setPendingKey(key)
    setModalOpen(true)
  }

  async function runWithCustomPrompt(prompt: string) {
    if (!pendingKey) return
    setError(null); setGenerating(true)
    try { await runGenerationWithPrompt(pendingKey, prompt, name, selectedCell ?? undefined) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize">◆ {name}</h1>
        <StatusBadge status={state.status} className="text-2xl" />
        <span className="text-sm text-slate-500">{state.status}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <GenerateButton
          label="重生此 state 靜態"
          onGenerate={() => runOp('B2')}
          onEditPrompt={() => openModal('B2')}
          generating={generating}
        />
        <GenerateButton
          label={`生 ${name} 動畫`}
          onGenerate={() => runOp('C')}
          onEditPrompt={() => openModal('C')}
          disabled={!state.staticBase}
          generating={generating}
        />
      </div>

      {error && <p className="text-sm text-red-600 max-w-prose">⚠ {error}</p>}

      <div className="grid grid-cols-[auto_1fr] gap-6">
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
              type="range" min={100} max={10000} step={100}
              value={state.loopDurationMs}
              onChange={(e) => updateState(name, { loopDurationMs: parseInt(e.target.value, 10) })}
            />
          </div>
        </div>

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

      {selectedCell !== null && (
        <div className="border-t border-border pt-4 space-y-2">
          <Label className="text-sm font-semibold">Frame {selectedCell + 1}</Label>
          <Textarea
            value={state.notes[selectedCell]}
            onChange={(e) => setStateNote(name, selectedCell, e.target.value)}
            rows={2}
            placeholder="e.g. 吸氣頂點"
          />
          <div className="flex gap-2">
            <GenerateButton
              label="重生此 frame"
              onGenerate={() => runOp('D', selectedCell)}
              onEditPrompt={() => openModal('D', selectedCell)}
              disabled={!state.staticBase || !state.sheet}
              generating={generating}
            />
            <Button variant="ghost" size="sm" onClick={() => selectCell(null)}>取消選取</Button>
          </div>
        </div>
      )}

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runWithCustomPrompt}
        onByogStart={() => alert('TODO M12: BYOG path')}
      />
    </div>
  )
}
