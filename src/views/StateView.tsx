import { useEffect, useRef, useState } from 'react'
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
import { buildGIF, buildWebM } from '@/lib/gifExport'
import { Eraser, ChevronDown, Upload } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
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
  const sheetUploadRef = useRef<HTMLInputElement | null>(null)
  const staticUploadRef = useRef<HTMLInputElement | null>(null)

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

  async function downloadGif() {
    if (!state.sheet) return
    setError(null); setEncodingApng(true)
    try {
      const blob = await buildGIF(state.sheet, state.loopDurationMs, state.loopMode)
      downloadBlob(blob, `mori-${name}.gif`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEncodingApng(false)
    }
  }

  async function downloadWebm() {
    if (!state.sheet) return
    setError(null); setEncodingApng(true)
    try {
      const blob = await buildWebM(state.sheet, state.loopDurationMs)
      downloadBlob(blob, `mori-${name}.webm`)
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

  async function uploadSheetFile(file: File) {
    setError(null); setGenerating(true)
    try {
      const { processByogUpload } = await import('@/lib/byogPipeline')
      await processByogUpload(file, 'C', false, name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }

  async function uploadStaticBaseFile(file: File) {
    setError(null); setGenerating(true)
    try {
      const { processByogUpload } = await import('@/lib/byogPipeline')
      await processByogUpload(file, 'B2', false, name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }

  const pill = STATUS_PILL[state.status]

  return (
    <div className="space-y-8">
      {/* Page header — identity only. Actions live INSIDE the section they
          operate on, so spatial association matches: 重生 base in Static
          Base column (left), 生動畫 / 重新去背 / 下載 in Sprite Sheet
          column (right). */}
      <header className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight capitalize text-stone-900">{name}</h1>
          <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full border', pill.cls)}>
            {pill.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-prose">
          這個 state 的 256×256 static base + 1024×1024 4×4 sprite sheet。
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">⚠ 生成失敗:</span> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left column: static + config */}
        <Section
          title="Static Base"
          subtitle="256×256 · AI 生成的代表姿勢"
          icon={<ImageIcon {...ICON_PROPS} />}
          className="lg:sticky lg:top-6"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border tx-checker overflow-hidden aspect-square w-full max-w-[212px] relative group">
              {staticUrl
                ? <img src={staticUrl} alt="static" className="w-full h-full object-contain p-2" />
                : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">(no static)</div>
              }
              {/* Hover-revealed icon-only upload/download in bottom-right corner */}
              <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  ref={staticUploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadStaticBaseFile(f)
                    if (staticUploadRef.current) staticUploadRef.current.value = ''
                  }}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => staticUploadRef.current?.click()}
                  disabled={generating}
                  className="h-7 w-7 shadow-sm bg-white/95 hover:bg-white border border-border/60"
                  title="上傳一張 256×256 圖當這個 state 的 static base"
                >
                  <Upload size={13} strokeWidth={1.75} />
                </Button>
                {state.staticBase && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => state.staticBase && downloadBlob(state.staticBase, `${name}-static-base.png`)}
                    className="h-7 w-7 shadow-sm bg-white/95 hover:bg-white border border-border/60"
                    title="下載當前 256×256 static base"
                  >
                    <Download size={13} strokeWidth={1.75} />
                  </Button>
                )}
              </div>
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

            {/* Primary action for this column — re-roll the static base.
                Sits directly under the thing it modifies. */}
            <GenerateButton
              label="重生 base"
              onGenerate={() => runOp('B2')}
              onEditPrompt={() => openModal('B2')}
              generating={generating}
            />
          </div>
        </Section>

        {/* Right column: sheet + animation */}
        <Section
          title="Sprite Sheet"
          subtitle="點任一格選取,可寫 frame note 或重生"
          icon={<Grid3x3 {...ICON_PROPS} />}
          action={(
            <div className="flex items-center gap-1">
              <input
                ref={sheetUploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadSheetFile(f)
                  if (sheetUploadRef.current) sheetUploadRef.current.value = ''
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sheetUploadRef.current?.click()}
                disabled={generating}
                className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="上傳一張 1024×1024 4×4 sheet 來覆蓋當前 sheet(會跑 chroma key + edge erosion)"
              >
                <Upload size={12} strokeWidth={1.75} />
                上傳
              </Button>
              {state.sheet && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadRawSheet}
                  className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  title="下載當前 1024×1024 4×4 sheet 來檢查 AI 真實輸出"
                >
                  <Download size={12} strokeWidth={1.75} />
                  raw
                </Button>
              )}
            </div>
          )}
        >
          <div className="space-y-5">
            {/* Primary actions for this column — generate animation + cleanup + download.
                Sits directly under the thing it produces. */}
            <div className="flex items-center gap-2 flex-wrap">
              <GenerateButton
                label={`生 ${name} 動畫`}
                onGenerate={() => runOp('C')}
                onEditPrompt={() => openModal('C')}
                disabled={!state.staticBase}
                generating={generating}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={rechroma}
                disabled={!state.sheet || generating}
                className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                title="用當前 Chroma 設定(顏色 + tolerance + edge erosion)從原始 AI 輸出重跑去背"
              >
                <Eraser size={14} strokeWidth={1.75} />
                重新去背
              </Button>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!state.sheet || encodingApng}
                      className="h-9 gap-2"
                      title={state.status !== 'animated' ? '生動畫後才能下載真實 loop' : '下載動畫(多種格式)'}
                    >
                      <Download size={14} strokeWidth={1.75} />
                      {encodingApng ? '打包中…' : '下載動畫'}
                      <ChevronDown size={12} strokeWidth={1.75} className="opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem onClick={downloadApng} className="flex-col items-start gap-0.5 py-2.5">
                      <div className="font-medium text-sm">APNG（.png）</div>
                      <div className="text-[11px] text-muted-foreground">透明 + 循環。瀏覽器 / LINE / Discord 會動;本機 viewer 多半只第 1 格</div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadGif} className="flex-col items-start gap-0.5 py-2.5">
                      <div className="font-medium text-sm">GIF（.gif）</div>
                      <div className="text-[11px] text-muted-foreground">1-bit 透明(邊緣稍粗)+ 循環。Mac Preview / Windows Photos 都會動,最廣相容</div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadWebm} className="flex-col items-start gap-0.5 py-2.5">
                      <div className="font-medium text-sm">WebM 影片（.webm）</div>
                      <div className="text-[11px] text-muted-foreground">VP9 + alpha。錄製 3 個 loop。QuickTime / 瀏覽器會動,OBS 直接拿來用</div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-start">
              <SpriteSheetPreview
                sheet={state.sheet}
                selectedCell={selectedCell}
                onCellClick={selectCell}
                size={384}
              />
              <div className="space-y-4 min-w-[224px]">
                <div>
                  <Label className="text-xs font-medium text-stone-700 block mb-1.5">Loop preview</Label>
                  <div className="rounded-xl border border-border tx-checker p-2">
                    <AnimationPreview sheet={state.sheet} durationMs={state.loopDurationMs} size={224} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-[224px]">
                    {state.status === 'animated'
                      ? '播放真實 4×4 動畫'
                      : state.status === 'placeholder'
                        ? '16 格 = 同張靜態,看不出動'
                        : '尚未生成'}
                  </p>
                </div>

                {/* Loop config — animation-only properties, so they live next to the
                    animation preview (not in Static Base column). */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label className="text-xs font-medium text-stone-700">動畫參數</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-normal text-muted-foreground">Loop mode</Label>
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
                    <div className="space-y-1">
                      <Label className="text-[11px] font-normal text-muted-foreground">Duration</Label>
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
              </div>
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
