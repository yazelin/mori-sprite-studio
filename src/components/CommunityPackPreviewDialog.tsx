import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Download, LoaderCircle } from 'lucide-react'
import { AnimationPreview } from '@/components/AnimationPreview'
import { communityPackUrl, type CommunityWork } from '@/lib/community'
import type { ManifestV1 } from '@/types/manifest'
import type { StateName } from '@/types/project'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PreviewClip {
  id: string
  name: string
  kind: 'state' | 'custom'
  spritePath: string
  durationMs: number
  playback: 'loop' | 'one-shot'
}

interface LoadedPack {
  zip: JSZip
  clips: PreviewClip[]
}

interface Props {
  work: CommunityWork | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getStateClips(manifest: ManifestV1, zip: JSZip): PreviewClip[] {
  const names = [...new Set([...manifest.states, ...manifest.optional_states])] as StateName[]
  return names.flatMap((name) => {
    const spritePath = `sprites/${name}.png`
    if (!zip.file(spritePath)) return []
    return [{
      id: `state:${name}`,
      name,
      kind: 'state' as const,
      spritePath,
      durationMs: manifest.loop_durations_ms?.[name] ?? 3000,
      playback: manifest.loop_modes?.[name] ?? 'loop',
    }]
  })
}

function getCustomActionClips(manifest: ManifestV1, zip: JSZip): PreviewClip[] {
  return (manifest.custom_actions ?? []).flatMap((action) => {
    if (!zip.file(action.sprite_path)) return []
    return [{
      id: `custom:${action.id}`,
      name: action.display_name,
      kind: 'custom' as const,
      spritePath: action.sprite_path,
      durationMs: action.duration_ms,
      playback: action.playback,
    }]
  })
}

export function CommunityPackPreviewDialog({ work, open, onOpenChange }: Props) {
  const [loadedPack, setLoadedPack] = useState<LoadedPack | null>(null)
  const [activeClipId, setActiveClipId] = useState('')
  const [sheet, setSheet] = useState<Blob | null>(null)
  const [loadingPack, setLoadingPack] = useState(false)
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !work) return
    let cancelled = false
    setLoadedPack(null)
    setActiveClipId('')
    setSheet(null)
    setError('')
    setLoadingPack(true)

    void (async () => {
      try {
        const response = await fetch(communityPackUrl(work.id))
        if (!response.ok) throw new Error(`無法載入角色包（${response.status}）。`)
        const zip = await JSZip.loadAsync(await response.arrayBuffer())
        const manifestFile = zip.file('manifest.json')
        if (!manifestFile) throw new Error('角色包缺少 manifest.json。')
        const manifest = JSON.parse(await manifestFile.async('string')) as ManifestV1
        const clips = [...getStateClips(manifest, zip), ...getCustomActionClips(manifest, zip)]
        if (!clips.length) throw new Error('角色包中沒有可預覽的狀態或動作。')
        if (cancelled) return
        setLoadedPack({ zip, clips })
        setActiveClipId(clips[0].id)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!cancelled) setLoadingPack(false)
      }
    })()

    return () => { cancelled = true }
  }, [open, work])

  const activeClip = useMemo(
    () => loadedPack?.clips.find((clip) => clip.id === activeClipId) ?? null,
    [activeClipId, loadedPack],
  )

  useEffect(() => {
    if (!open || !loadedPack || !activeClip) return
    let cancelled = false
    setSheet(null)
    setError('')
    setLoadingSheet(true)
    const entry = loadedPack.zip.file(activeClip.spritePath)
    if (!entry) {
      setError('找不到這個狀態或動作的圖片。')
      setLoadingSheet(false)
      return
    }
    void entry.async('blob').then((blob) => {
      if (!cancelled) setSheet(blob)
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : '讀取動作圖片失敗。')
    }).finally(() => {
      if (!cancelled) setLoadingSheet(false)
    })
    return () => { cancelled = true }
  }, [activeClip, loadedPack, open])

  const stateClips = loadedPack?.clips.filter((clip) => clip.kind === 'state') ?? []
  const customClips = loadedPack?.clips.filter((clip) => clip.kind === 'custom') ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>{work ? `${work.displayName}｜完整動作預覽` : '完整動作預覽'}</DialogTitle>
          <DialogDescription>選擇狀態或自訂動作，查看這個 moripack 內實際打包的動畫。</DialogDescription>
        </DialogHeader>

        {loadingPack && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" />載入角色包與動作清單…</div>}
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {loadedPack && (
          <div className="grid gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
            <nav aria-label="角色狀態與自訂動作" className="max-h-64 space-y-4 overflow-y-auto rounded-xl border border-border p-3 md:max-h-[min(62vh,620px)]">
              <div className="space-y-1">
                <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">狀態 · {stateClips.length}</h3>
                {stateClips.map((clip) => (
                  <button key={clip.id} type="button" aria-pressed={activeClipId === clip.id} onClick={() => setActiveClipId(clip.id)} className={`w-full rounded-lg px-2.5 py-2 text-left text-sm capitalize transition ${activeClipId === clip.id ? 'bg-emerald-100 font-medium text-emerald-950' : 'text-stone-700 hover:bg-stone-100'}`}>
                    {clip.name}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">自訂動作 · {customClips.length}</h3>
                {customClips.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">這個角色包沒有自訂動作。</p> : customClips.map((clip) => (
                  <button key={clip.id} type="button" aria-pressed={activeClipId === clip.id} onClick={() => setActiveClipId(clip.id)} className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${activeClipId === clip.id ? 'bg-emerald-100 font-medium text-emerald-950' : 'text-stone-700 hover:bg-stone-100'}`}>
                    {clip.name}
                  </button>
                ))}
              </div>
            </nav>

            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold capitalize text-stone-900">{activeClip?.name ?? '選擇動作'}</h3>
                  {activeClip && <p className="text-xs text-muted-foreground">{activeClip.kind === 'state' ? '內建狀態' : '自訂動作'} · {activeClip.playback === 'loop' ? '循環播放' : '播放一次'} · {activeClip.durationMs} ms</p>}
                </div>
                {loadingSheet && <LoaderCircle size={18} className="animate-spin text-muted-foreground" aria-label="載入動畫" />}
              </div>
              <div className="mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] bg-white p-3">
                {sheet && activeClip ? <AnimationPreview key={activeClip.id} sheet={sheet} durationMs={activeClip.durationMs} playback={activeClip.playback} size={380} /> : !loadingSheet && <div className="text-sm text-muted-foreground">選擇一個狀態或動作</div>}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          {work && <a href={communityPackUrl(work.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800"><Download size={16} />下載 .moripack</a>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
