import { useState, useMemo } from 'react'
import { useAppStore } from '@/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { TemplateKey } from '@/types/prompts'
import type { StateName } from '@/types/project'
import { render } from '@/lib/promptRenderer'
import { appendChromaSuffix, buildChromaSuffix } from '@/lib/promptBuilder'
import { DEFAULT_TEMPLATES } from '@/defaults'
import { OUTPUT_SIZE, buildReferences } from '@/lib/generationFlow'
import { downloadReferences } from '@/lib/downloadRefs'
import { processByogUpload } from '@/lib/byogPipeline'
import { ByogReceiveView } from './ByogReceiveView'

export interface PromptEditorContext {
  templateKey: TemplateKey
  vars: Record<string, string>
  opLabel: string
  stateName?: StateName
  cellIndex?: number
}

interface Props {
  open: boolean
  onClose: () => void
  context: PromptEditorContext | null
  onGenerate: (renderedPrompt: string) => void
}

const LAYOUT_LABEL: Record<TemplateKey, string> = {
  B1: '3 columns × 2 rows of 6 character poses (idle / sleeping / recording / thinking / done / error)',
  B2: '單一角色靜態姿勢',
  C:  '4×4 grid sprite sheet, 16-frame row-major animation',
  D:  '單一 frame(銜接前後)',
}

export function PromptEditorModal({ open, onClose, context, onGenerate }: Props) {
  const templates = useAppStore((s) => s.prompts.templates)
  const setTemplate = useAppStore((s) => s.setTemplate)
  const chroma = useAppStore((s) => s.chroma)
  const [draft, setDraft] = useState<string | null>(null)
  const [byogMode, setByogMode] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  useMemo(() => {
    if (context) { setDraft(templates[context.templateKey]); setByogMode(false); setPromptCopied(false) }
  }, [context, templates])

  if (!context) return null

  const currentTemplate = draft ?? templates[context.templateKey]
  const renderedBody = render(currentTemplate, context.vars)
  const fullRendered = appendChromaSuffix(renderedBody, chroma.key)

  function save() {
    if (context && draft !== null) setTemplate(context.templateKey, draft)
  }

  function saveAndGenerate() {
    save()
    onGenerate(fullRendered)
    onClose()
  }

  async function startByog() {
    save()
    // Copy prompt
    try { await navigator.clipboard.writeText(fullRendered); setPromptCopied(true) }
    catch { setPromptCopied(false) }
    // Download refs
    const refs = await buildReferences(context!.templateKey, context!.stateName, context!.cellIndex)
    downloadReferences(
      refs.map((blob, i) => ({ name: `byog-ref-${context!.templateKey}-${i}.png`, blob })),
    )
    setByogMode(true)
  }

  async function onByogUpload(blob: Blob, skipChroma: boolean) {
    await processByogUpload(blob, context!.templateKey, skipChroma, context!.stateName, context!.cellIndex)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {byogMode ? `BYOG 模式:${context.opLabel}` : `編輯 Prompt:${context.opLabel}(模板 ${context.templateKey})`}
          </DialogTitle>
        </DialogHeader>

        {byogMode ? (
          <ByogReceiveView
            promptCopied={promptCopied}
            expectedSizeLabel={`Size: ${OUTPUT_SIZE[context.templateKey]}`}
            expectedLayoutLabel={`Layout: ${LAYOUT_LABEL[context.templateKey]}`}
            onCancel={() => setByogMode(false)}
            onUpload={onByogUpload}
          />
        ) : (
          <>
            <section className="space-y-2">
              <Label className="text-sm font-semibold">可用變數(當前 context 值)</Label>
              <div className="text-xs font-mono bg-slate-50 p-2 rounded-md space-y-1">
                {Object.entries(context.vars).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[200px_1fr] gap-2">
                    <span className="text-slate-600">{`{{${k}}}`}</span>
                    <span className="text-slate-900 break-words whitespace-pre-wrap">
                      {v.length > 200 ? v.slice(0, 200) + '…' : v}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Template (editable)</Label>
              <Textarea
                value={currentTemplate}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Auto-appended (chroma suffix, 不可改)</Label>
              <pre className="text-xs font-mono bg-slate-100 p-2 rounded-md whitespace-pre-wrap text-slate-700">
                {buildChromaSuffix(chroma.key)}
              </pre>
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Rendered preview</Label>
              <pre className="text-xs font-mono bg-slate-50 p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-auto">
                {fullRendered}
              </pre>
            </section>

            <div className="flex justify-between items-end pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_TEMPLATES[context!.templateKey])}>
                回預設
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button variant="outline" onClick={() => { save(); onClose() }}>儲存</Button>
                <Button onClick={saveAndGenerate}>儲存並立即生圖 ✦</Button>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="secondary" className="w-full" onClick={startByog}>
                📋 複製 Prompt + 下載 Ref,自己跑 → 回來上傳 ⤴
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
