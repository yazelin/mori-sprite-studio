import { useState, useMemo } from 'react'
import { useAppStore } from '@/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { TemplateKey } from '@/types/prompts'
import { render } from '@/lib/promptRenderer'
import { appendChromaSuffix, buildChromaSuffix } from '@/lib/promptBuilder'
import { DEFAULT_TEMPLATES } from '@/defaults'

export interface PromptEditorContext {
  templateKey: TemplateKey
  vars: Record<string, string>     // pre-resolved values for {{var}} substitution
  opLabel: string                  // e.g. "生 idle 動畫"
}

interface Props {
  open: boolean
  onClose: () => void
  context: PromptEditorContext | null
  onGenerate: (renderedPrompt: string) => void   // for API path
  onByogStart: (renderedPrompt: string) => void  // for BYOG path
}

export function PromptEditorModal({ open, onClose, context, onGenerate, onByogStart }: Props) {
  const templates = useAppStore((s) => s.prompts.templates)
  const setTemplate = useAppStore((s) => s.setTemplate)
  const resetTemplate = useAppStore((s) => s.resetTemplate)
  const chroma = useAppStore((s) => s.chroma)
  const [draft, setDraft] = useState<string | null>(null)

  // Reset draft when context changes
  useMemo(() => {
    if (context) setDraft(templates[context.templateKey])
  }, [context, templates])

  if (!context) return null

  const currentTemplate = draft ?? templates[context.templateKey]
  const renderedBody = render(currentTemplate, context.vars)
  const fullRendered = `${renderedBody}\n\n${buildChromaSuffix(chroma.key)}`

  function save() {
    if (context && draft !== null) setTemplate(context.templateKey, draft)
  }

  function saveAndGenerate() {
    save()
    onGenerate(fullRendered)
    onClose()
  }

  function byogPath() {
    save()
    onByogStart(fullRendered)
  }

  function doReset() {
    setDraft(DEFAULT_TEMPLATES[context!.templateKey])
    resetTemplate(context!.templateKey)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            編輯 Prompt:{context.opLabel}(模板 {context.templateKey})
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">可用變數(當前 context 值)</Label>
          <div className="text-xs font-mono bg-slate-50 p-2 rounded-md space-y-1">
            {Object.entries(context.vars).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[200px_1fr] gap-2">
                <span className="text-slate-600">{`{{${k}}}`}</span>
                <span className="text-slate-900 break-words">{v.length > 200 ? v.slice(0, 200) + '…' : v}</span>
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
          <Label className="text-sm font-semibold">Rendered preview (實際送 AI 的內容)</Label>
          <pre className="text-xs font-mono bg-slate-50 p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-auto">
            {fullRendered}
          </pre>
        </section>

        <div className="flex justify-between items-end pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={doReset}>回預設</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button variant="outline" onClick={() => { save(); onClose() }}>儲存</Button>
            <Button onClick={saveAndGenerate}>儲存並立即生圖 ✦</Button>
          </div>
        </div>
        <div className="pt-2">
          <Button variant="secondary" className="w-full" onClick={byogPath}>
            📋 複製 Prompt + 下載 Ref,自己跑 → 回來上傳 ⤴
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
