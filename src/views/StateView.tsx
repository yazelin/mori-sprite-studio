import { useEffect, useState } from 'react'
import { Image as ImageIcon, Grid3x3, Square, Download } from 'lucide-react'
import { useAppStore } from '@/store'
import type { StateName, SheetStatus } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import { GenerateButton } from '@/components/GenerateButton'
import { Section } from '@/components/Section'
import { SpriteSheetPreview } from '@/components/SpriteSheetPreview'
import { AnimationPreview } from '@/components/AnimationPreview'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext, reapplyChromaToState } from '@/lib/generationFlow'
import { buildAPNG, downloadBlob } from '@/lib/apngExport'
import { Eraser } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const

const STATUS_PILL: Record<SheetStatus, { label: string; cls: string }> = {
  pending:     { label: '尚未生成', cls: 'bg-stone-100 text-stone-600 border-stone-200' },
  placeholder: { label: 'Placeholder',   cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  animated:    { label: '已動畫化',    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

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
  const [encodingApng, setEncodingApng] = useState(false)

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
    setModalContext({
      templateKey: key, vars, opLabel,
      stateName: name,
      cellIndex: cellIdx,
    })
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

  async function downloadApng() {
    if (!state.sheet) return
    setError(null); setEncodingApng(true)
    try {
      const blob = await buildAPNG(state.sheet, state.loopDurationMs, state.loopMode)
      downloadBlob(blob, `mori-${name}.png`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEncodingApng(false)
    }
  }

  function downloadRawSheet() {
    if (!state.sheet) return
    downloadBlob(state.sheet, `${name}-raw-4x4-sheet.png`)
  }

  async function rechroma() {
    setError(null); setGenerating(true)
    try { await reapplyChromaToState(name) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  const pill = STATUS_PILL[state.status]

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight capitalize text-stone-900">{name}</h1>
            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full border', pill.cls)}>
              {pill.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-prose">
            這個 state 的 256×256 static base + 1024×1024 4×4 sprite sheet。先 [生靜態],再 [生動畫]。
          </p>
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
          <Button
            type="button"
            variant="outline"
            onClick={rechroma}
            disabled={!state.sheet || generating}
            className="h-10 gap-2"
            title="用當前 Chroma 設定(顏色 + tolerance)重新對 sheet / static base 去背"
          >
            <Eraser size={16} strokeWidth={1.75} />
            重新去背
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={downloadApng}
            disabled={!state.sheet || encodingApng}
            className="h-10 gap-2"
            title={state.status !== 'animated' ? '生動畫後才能下載真實 loop' : '下載成 APNG(透明 / 循環)'}
          >
            <Download size={16} strokeWidth={1.75} />
            {encodingApng ? '打包中…' : '下載 APNG'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">⚠ 生成失敗:</span> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left column: static + config */}
        <Section title="Static Base" subtitle="256×256 · AI 生成的代表姿勢" icon={<ImageIcon {...ICON_PROPS} />} className="lg:sticky lg:top-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-border tx-checker overflow-hidden aspect-square w-full max-w-[212px]">
              {staticUrl
                ? <img src={staticUrl} alt="static" className="w-full h-full object-contain p-2" />
                : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">(no static)</div>
              }
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-700">Pose Note</Label>
              <Textarea
                value={state.poseNote}
                onChange={(e) => updateState(name, { poseNote: e.target.value })}
                rows={2}
                placeholder="e.g. 站姿、頭微抬"
                className="resize-none text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-700">Loop mode</Label>
                <Select
                  value={state.loopMode}
                  onValueChange={(v) => updateState(name, { loopMode: v as 'loop' | 'one-shot' })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loop">loop</SelectItem>
                    <SelectItem value="one-shot">one-shot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-700">Duration</Label>
                <div className="text-sm text-stone-900 font-mono tabular-nums h-9 flex items-center px-1">
                  {state.loopDurationMs} <span className="text-muted-foreground ml-1">ms</span>
                </div>
              </div>
            </div>
            <Input
              type="range" min={100} max={10000} step={100}
              value={state.loopDurationMs}
              onChange={(e) => updateState(name, { loopDurationMs: parseInt(e.target.value, 10) })}
              className="accent-emerald-600"
            />
          </div>
        </Section>

        {/* Right column: sheet + animation */}
        <Section
          title="Sprite Sheet"
          subtitle="點任一格選取,可寫 frame note 或重生"
          icon={<Grid3x3 {...ICON_PROPS} />}
          action={state.sheet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadRawSheet}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="下載原始 1024×1024 4×4 sheet 來檢查 AI 真實輸出"
            >
              <Download size={14} strokeWidth={1.75} />
              raw sheet
            </Button>
          )}
        >
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            <SpriteSheetPreview
              sheet={state.sheet}
              selectedCell={selectedCell}
              onCellClick={selectCell}
              size={384}
            />
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-stone-700 block mb-1.5">Loop preview</Label>
                <div className="rounded-xl border border-border tx-checker p-2">
                  <AnimationPreview sheet={state.sheet} durationMs={state.loopDurationMs} size={224} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-[224px]">
                {state.status === 'animated'
                  ? '播放真實 4×4 動畫'
                  : state.status === 'placeholder'
                    ? '16 格 = 同張靜態,看不出動。按上方「生動畫」轉成真動畫。'
                    : '尚未生成,先回專案頁按「生 6 狀態靜態」。'}
              </p>
            </div>
          </div>
        </Section>
      </div>

      {/* Cell editor */}
      {selectedCell !== null && (
        <Section
          title={`Frame ${selectedCell + 1}`}
          subtitle="這格的 note 會餵進動畫化 prompt;也可單獨重生這格"
          icon={<Square {...ICON_PROPS} />}
          action={
            <Button variant="ghost" size="sm" onClick={() => selectCell(null)} className="text-muted-foreground">
              取消選取
            </Button>
          }
        >
          <div className="space-y-3 max-w-2xl">
            <Textarea
              value={state.notes[selectedCell]}
              onChange={(e) => setStateNote(name, selectedCell, e.target.value)}
              rows={3}
              placeholder="e.g. 吸氣頂點、胸口最高"
              className="resize-none text-sm"
            />
            <GenerateButton
              label="重生此 frame"
              onGenerate={() => runOp('D', selectedCell)}
              onEditPrompt={() => openModal('D', selectedCell)}
              disabled={!state.staticBase || !state.sheet}
              generating={generating}
            />
          </div>
        </Section>
      )}

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runWithCustomPrompt}
      />
    </div>
  )
}
