import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'

interface QuotaInfo {
  usedToday: number
  dailyCap: number
  inFlight: boolean
  utcDate: string
}

/**
 * Author Fallback quota counter — fixed in sidebar footer.
 * Only renders when the user has Author Fallback selected (since
 * other providers use their own keys, no shared quota to display).
 *
 * Polls /api/generate (GET) on mount + every 30 s while the tab is
 * focused. Also re-polls after each generation completes via the
 * 'generation-finished' window event dispatched from generationFlow.
 */
export function QuotaIndicator() {
  const activeProvider = useAppStore((s) => s.provider.active)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate', { method: 'GET' })
      if (res.ok) setQuota(await res.json())
    } catch {
      // ignore network errors — keep last known value
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeProvider !== 'author-fallback') return
    void refresh()
    const onGen = () => void refresh()
    window.addEventListener('generation-finished', onGen)
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      window.removeEventListener('generation-finished', onGen)
      window.clearInterval(interval)
    }
  }, [activeProvider])

  if (activeProvider !== 'author-fallback') return null
  if (!quota) {
    return (
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
        {loading ? '查 quota 中…' : 'quota 未知'}
      </div>
    )
  }

  // Countdown framing: remaining = bigger number = main display.
  // Progress bar shows how much is LEFT (full bar = lots left, empty = none).
  const remaining = Math.max(0, quota.dailyCap - quota.usedToday)
  const remainPct = (remaining / quota.dailyCap) * 100
  const tone =
    remainPct <= 10 ? 'bg-red-50 border-red-200 text-red-900' :
    remainPct <= 40 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                      'bg-emerald-50 border-emerald-200 text-emerald-900'

  return (
    <div className={`px-2 py-2 rounded-lg border text-[11px] space-y-1 ${tone}`} title={`UTC date: ${quota.utcDate} · 已用 ${quota.usedToday}`}>
      <div className="flex justify-between items-center">
        <span className="font-medium">Author quota 今日剩</span>
        <span className="font-mono tabular-nums font-semibold">
          {remaining} / {quota.dailyCap}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/50 overflow-hidden">
        <div
          className={`h-full transition-all ${remainPct <= 10 ? 'bg-red-500' : remainPct <= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${remainPct}%` }}
        />
      </div>
      <div className="text-[10px] opacity-80">
        {quota.inFlight ? '🟢 1 張生成中' : '可呼叫下一張'}
      </div>
    </div>
  )
}
