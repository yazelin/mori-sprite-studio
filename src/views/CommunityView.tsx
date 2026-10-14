import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, LoaderCircle, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { communityCoverUrl, communityPackUrl, formatPackSize, getOwnerToken, listCommunityWorks, removeCommunityWork, type CommunityWork } from '@/lib/community'

export function CommunityView() {
  const [works, setWorks] = useState<CommunityWork[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadFirstPage() {
    setLoading(true)
    setError('')
    try {
      const result = await listCommunityWorks()
      setWorks(result.works)
      setNextCursor(result.nextCursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadFirstPage() }, [])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const result = await listCommunityWorks(nextCursor)
      setWorks((current) => [...current, ...result.works])
      setNextCursor(result.nextCursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingMore(false)
    }
  }

  async function deleteWork(work: CommunityWork) {
    if (!getOwnerToken(work.id) || !window.confirm(`確定要從社群展示下架「${work.displayName}」嗎？`)) return
    setDeleting(work.id)
    setError('')
    try {
      await removeCommunityWork(work.id)
      setWorks((current) => current.filter((item) => item.id !== work.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDeleting(null)
    }
  }

  const visibleWorks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return works
    return works.filter((work) => [work.displayName, work.packageName, work.author, work.description, ...work.tags]
      .join(' ').toLocaleLowerCase().includes(normalized))
  }, [query, works])

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-700"><UsersRound size={20} strokeWidth={1.75} /><span className="text-sm font-medium">COMMUNITY</span></div>
          <Button variant="outline" size="sm" className="gap-2" disabled={loading} onClick={() => void loadFirstPage()}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />重新整理
          </Button>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">社群作品展示</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">看看大家做的角色與動作，直接下載 .moripack，在 Mori Pet Player 裡玩。</p>
      </header>

      <div className="relative max-w-xl">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          aria-label="搜尋社群作品"
          placeholder="搜尋角色、作者或標籤…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
        />
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" />載入社群作品…</div>
      ) : visibleWorks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-16 text-center">
          <UsersRound size={28} className="mx-auto text-stone-400" />
          <h2 className="mt-3 font-medium text-stone-800">{works.length ? '沒有符合的作品' : '社群還沒有作品'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{works.length ? '試試其他關鍵字。' : '完成角色後，到「分享至社群」公開你的第一個 moripack。'}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleWorks.map((work) => (
              <article key={work.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] bg-white">
                  <img src={communityCoverUrl(work.id)} alt={`${work.displayName} 的角色預覽`} loading="lazy" className="h-full w-full object-contain p-4" />
                  {getOwnerToken(work.id) && (
                    <button type="button" aria-label={`下架 ${work.displayName}`} title="下架我的作品" disabled={deleting === work.id} onClick={() => void deleteWork(work)} className="absolute right-3 top-3 rounded-full border border-white/70 bg-white/90 p-2 text-stone-600 shadow-sm hover:text-red-700 disabled:opacity-50">
                      {deleting === work.id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-stone-900" title={work.displayName}>{work.displayName}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{work.packageName} · v{work.version} · {work.author}</p>
                  </div>
                  {work.description && <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-stone-600">{work.description}</p>}
                  <div className="flex min-h-6 flex-wrap gap-1.5">
                    {work.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">{tag}</span>)}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span className="truncate" title={work.license}>{work.license}</span>
                    <span className="shrink-0">{formatPackSize(work.packSize)}</span>
                  </div>
                  <a href={communityPackUrl(work.id)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                    <Download size={16} />下載 .moripack
                  </a>
                </div>
              </article>
            ))}
          </div>
          {nextCursor && !query.trim() && <div className="flex justify-center pt-2"><Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()} className="gap-2">{loadingMore && <LoaderCircle size={16} className="animate-spin" />}載入更多作品</Button></div>}
        </>
      )}
    </div>
  )
}
