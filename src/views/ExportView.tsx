import { useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { STATE_NAMES } from '@/types/project'
import { StatusBadge } from '@/components/StatusBadge'
import { validateProject } from '@/lib/validation'
import { buildManifest } from '@/lib/manifest'
import { downloadPack } from '@/lib/exportPack'

export function ExportView() {
  const project = useAppStore((s) => s.project)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = validateProject(project)
  const manifest = buildManifest(project)

  async function handleExport() {
    setError(null); setDownloading(true)
    try { await downloadPack(project) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setDownloading(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">⤓ 匯出</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-medium border-b border-border pb-1">完成度檢查</h2>
        <div className="space-y-1 font-mono text-sm">
          {STATE_NAMES.map((n) => {
            const s = project.states[n]
            const symbol = s.status === 'animated' ? '✓' : s.status === 'placeholder' ? '⚠' : '✗'
            return (
              <div key={n} className="grid grid-cols-[100px_120px_30px_1fr] gap-2 items-center">
                <span className="capitalize">{n}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.status}
                </span>
                <span>{symbol}</span>
                <span className="text-xs text-slate-500">
                  {s.status === 'pending' && '尚未生靜態'}
                  {s.status === 'placeholder' && '靜態 OK,未動畫化'}
                  {s.status === 'animated' && 'OK'}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {validation.blocking.length > 0 && (
        <section className="space-y-1 bg-red-50 border border-red-200 p-3 rounded-md">
          <h3 className="text-sm font-semibold text-red-900">阻擋匯出:</h3>
          <ul className="list-disc list-inside text-sm text-red-900">
            {validation.blocking.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </section>
      )}

      {validation.warnings.length > 0 && (
        <section className="space-y-1 bg-amber-50 border border-amber-200 p-3 rounded-md">
          <h3 className="text-sm font-semibold text-amber-900">警告:</h3>
          <ul className="list-disc list-inside text-sm text-amber-900">
            {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium border-b border-border pb-1">manifest.json 預覽</h2>
        <pre className="text-xs font-mono bg-slate-50 p-3 rounded-md overflow-auto max-h-96">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </section>

      <div>
        <Button
          size="lg"
          disabled={!validation.canExport || downloading}
          onClick={handleExport}
        >
          ⤓ 匯出 {project.metadata.packageName}.moripack.zip
        </Button>
        {error && <p className="text-sm text-red-600 mt-2">⚠ {error}</p>}
      </div>
    </div>
  )
}
