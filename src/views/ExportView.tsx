import { useState } from 'react'
import { CheckCheck, Braces, Download, AlertTriangle, Info, Circle, CircleDot, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { STATE_NAMES, type SheetStatus } from '@/types/project'
import { Section } from '@/components/Section'
import { validateProject } from '@/lib/validation'
import { buildManifest } from '@/lib/manifest'
import { downloadPack } from '@/lib/exportPack'
import { cn } from '@/lib/utils'

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const

const STATUS_ROW: Record<SheetStatus, { Icon: typeof Circle; tone: string; label: string }> = {
  pending:     { Icon: Circle,        tone: 'text-stone-400',   label: '尚未生靜態' },
  placeholder: { Icon: CircleDot,     tone: 'text-amber-500',   label: '靜態 OK,未動畫化' },
  animated:    { Icon: CheckCircle2,  tone: 'text-emerald-600', label: '已動畫化' },
}

export function ExportView() {
  const project = useAppStore((s) => s.project)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = validateProject(project)
  const manifest = buildManifest(project)
  const animatedCount = STATE_NAMES.filter((n) => project.states[n].status === 'animated').length
  const placeholderCount = STATE_NAMES.filter((n) => project.states[n].status === 'placeholder').length
  const customActions = project.customActions ?? []
  const customActionIds = new Set(manifest.custom_actions.map((action) => action.id))

  async function handleExport() {
    setError(null); setDownloading(true)
    try { await downloadPack(project) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setDownloading(false) }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">匯出</h1>
        <p className="text-sm text-muted-foreground">
          匯出符合 character-pack.md 1.x 的 schema 1.1 .moripack.zip。Mori Desktop 可匯入基本狀態；自訂動作則可在 Mori Pet Player 播放。
        </p>
      </header>

      <Section
        title="完成度"
        subtitle={`${animatedCount}/6 個固定 state 已動畫化，${placeholderCount}/6 還是 placeholder；${customActionIds.size}/${customActions.length} 個自訂動作會匯出`}
        icon={<CheckCheck {...ICON_PROPS} />}
      >
        <div className="space-y-1">
          {STATE_NAMES.map((n) => {
            const s = project.states[n]
            const row = STATUS_ROW[s.status]
            const Icon = row.Icon
            return (
              <div
                key={n}
                className="grid grid-cols-1 sm:grid-cols-[28px_120px_140px_1fr] gap-3 items-center py-2 px-2 rounded-md hover:bg-stone-50/80"
              >
                <Icon size={20} strokeWidth={1.75} className={row.tone} />
                <span className="capitalize font-medium text-stone-800">{n}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border w-fit',
                  s.status === 'animated' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                  s.status === 'placeholder' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                  'border-stone-200 bg-stone-50 text-stone-600',
                )}>
                  {s.status}
                </span>
                <span className="text-sm text-muted-foreground">{row.label}</span>
              </div>
            )
          })}
        </div>
      </Section>

      {customActions.length > 0 && (
        <Section title="自訂動作" subtitle="只有完成動畫的動作會寫入 moripack。" icon={<CheckCircle2 {...ICON_PROPS} />}>
          <div className="space-y-1">
            {customActions.map((action) => {
              const included = customActionIds.has(action.id)
              return (
                <div key={action.id} className="flex flex-wrap items-center gap-3 py-2 px-2 rounded-md hover:bg-stone-50/80">
                  <span className="flex-1 min-w-0 font-medium text-stone-800 truncate">{action.name || '未命名動作'}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full border',
                    included ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800',
                  )}>
                    {included ? '會匯出' : action.status === 'pending' ? '尚未生成' : '需重新生成動畫'}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {validation.blocking.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
            <AlertTriangle size={16} strokeWidth={1.75} /> 阻擋匯出
          </h3>
          <ul className="list-disc list-inside text-sm text-red-800 space-y-0.5 pl-1">
            {validation.blocking.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <Info size={16} strokeWidth={1.75} /> 警告(仍可匯出)
          </h3>
          <ul className="list-disc list-inside text-sm text-amber-800 space-y-0.5 pl-1">
            {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <Section title="manifest.json 預覽" subtitle="這個內容會放進 zip 的 root" icon={<Braces {...ICON_PROPS} />}>
        <pre className="text-xs font-mono bg-stone-50 border border-border rounded-lg p-4 overflow-auto max-h-[28rem] text-stone-800 leading-relaxed">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </Section>

      <div className="flex items-center gap-4 pt-2">
        <Button
          size="lg"
          disabled={!validation.canExport || downloading}
          onClick={handleExport}
          className={cn(
            'h-12 px-6 gap-2 text-base font-medium rounded-lg shadow-sm',
            'bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 hover:shadow-md hover:-translate-y-px transition-all',
            'disabled:from-stone-300 disabled:to-stone-400 disabled:translate-y-0 disabled:shadow-none',
          )}
        >
          <Download size={18} strokeWidth={1.75} />
          {downloading ? '打包中…' : `匯出 ${project.metadata.packageName}.moripack.zip`}
        </Button>
        {error && <p className="inline-flex items-center gap-1 text-sm text-red-600"><AlertTriangle size={14} aria-hidden="true" />{error}</p>}
      </div>
    </div>
  )
}
