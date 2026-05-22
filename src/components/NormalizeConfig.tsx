import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store'
import { STATE_NAMES } from '@/types/project'
import { normalizeAllStates, measureAllStates } from '@/lib/normalize'

/**
 * One-click normalize across all 6 states + manual target-height override.
 * Per-state fine-tune happens in StateView's transform sliders.
 */
export function NormalizeConfig() {
  const project = useAppStore((s) => s.project)
  const [target, setTarget] = useState<number | null>(null) // null = auto (median)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [measurements, setMeasurements] = useState<Record<string, { h: number } | null> | null>(null)

  async function scan() {
    setBusy(true); setReport(null)
    try {
      const m = await measureAllStates()
      setMeasurements(m as any)
    } finally { setBusy(false) }
  }

  async function runNormalize() {
    setBusy(true); setReport(null)
    try {
      const result = await normalizeAllStates(target ?? undefined)
      setReport(
        `已套用 — target height ${result.target} px。各 state 的 scale: ` +
        STATE_NAMES.map((n) => `${n}=${result.applied[n].scale.toFixed(3)}`).join(', '),
      )
    } catch (e) {
      setReport(`錯誤: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  function resetAll() {
    const store = useAppStore.getState()
    for (const n of STATE_NAMES) {
      store.updateState(n, { transform: { scale: 1, offsetX: 0, offsetY: 0 } })
    }
    setReport('已重設所有 state 的 transform 為 identity (scale=1, offset=0)')
  }

  // Count states with non-identity transforms
  const customCount = STATE_NAMES.filter((n) => {
    const t = project.states[n].transform
    return t && (t.scale !== 1 || t.offsetX !== 0 || t.offsetY !== 0)
  }).length

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs text-muted-foreground">
        每 state 獨立 AI 生成,角色 bbox 大小會微飄(idle 252 px / recording 213 px 等)。
        Normalize 掃描 6 state 的字符 bbox,套一個 per-state 的 scale + offset,
        所有 state 在 mori-desktop 切換時尺寸一致。
        套用後可在每 state 頁面 fine-tune;不滿意 raw sheet 不會被改,可重 normalize。
      </p>

      {measurements && (
        <div className="rounded-lg border border-border bg-card p-3 text-xs font-mono space-y-0.5">
          {STATE_NAMES.map((n) => {
            const m = measurements[n]
            return (
              <div key={n} className="flex justify-between">
                <span className="capitalize">{n}</span>
                <span className="text-muted-foreground">
                  {m ? `height = ${m.h} px` : '(no sheet)'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-stone-700">目標高度</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={50} max={256}
              value={target ?? ''}
              onChange={(e) => setTarget(e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="auto"
              className="w-24 h-9 text-sm"
            />
            <span className="text-xs text-muted-foreground">px (256 cell 內;空白 = 自動取中位數)</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={scan} disabled={busy}>
          掃描現況
        </Button>
        <Button onClick={runNormalize} disabled={busy} className="gap-2">
          <Maximize2 size={14} strokeWidth={1.75} />
          {busy ? '計算中…' : 'Normalize 6 state 尺寸'}
        </Button>
        <Button variant="ghost" size="sm" onClick={resetAll} disabled={busy} className="text-muted-foreground">
          全部 reset
        </Button>
      </div>

      {customCount > 0 && (
        <p className="text-xs text-emerald-700">
          目前有 {customCount} / 6 state 設了非預設 transform。
        </p>
      )}

      {report && (
        <p className="text-xs text-muted-foreground break-all">{report}</p>
      )}
    </div>
  )
}
