import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileArchive, Share2, UsersRound } from 'lucide-react'
import { useAppStore } from '@/store'
import { OPTIONAL_STATE_NAMES, REQUIRED_STATE_NAMES } from '@/types/project'
import { validateProject } from '@/lib/validation'
import { shareProject, type CommunityWork } from '@/lib/community'
import { buildManifest } from '@/lib/manifest'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/Section'

export function CommunityShareView() {
  const project = useAppStore((s) => s.project)
  const setView = useAppStore((s) => s.setView)
  const validation = useMemo(() => validateProject(project), [project])
  const manifest = useMemo(() => buildManifest(project), [project])
  const includedCustomActionIds = useMemo(() => new Set(manifest.custom_actions.map((action) => action.id)), [manifest])
  const customActions = project.customActions ?? []
  const incomplete = REQUIRED_STATE_NAMES.filter((name) => !project.states[name].sheet || project.states[name].status !== 'animated')
  const [agreed, setAgreed] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [sharedWork, setSharedWork] = useState<CommunityWork | null>(null)

  async function handleShare() {
    setSharing(true)
    setError('')
    setSharedWork(null)
    try {
      const work = await shareProject(project)
      setSharedWork(work)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSharing(false)
    }
  }

  const canShare = incomplete.length === 0 && validation.canExport && agreed && !sharing

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-700"><Share2 size={20} strokeWidth={1.75} /><span className="text-sm font-medium">OUTPUT / 社群分享</span></div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">分享角色包</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          把完成的角色包放進公開社群展示。其他人可以瀏覽作品資訊、預覽角色，並下載 .moripack 到 Mori Pet Player 或支援的工具中使用。
        </p>
      </header>

      <Section title="準備分享" subtitle="六個基本狀態必須完成；Walking、Dragging 有圖片就會一起打包，自訂動作則需完成動畫。" icon={<FileArchive size={18} strokeWidth={1.75} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REQUIRED_STATE_NAMES.map((name) => {
            const ready = Boolean(project.states[name].sheet) && project.states[name].status === 'animated'
            return (
              <div key={name} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <span className={ready ? 'text-emerald-600' : 'text-amber-600'}>{ready ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
                <span className="capitalize">{name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{ready ? '動畫已完成' : '尚未完成動畫'}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-medium text-stone-800">選配狀態</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {OPTIONAL_STATE_NAMES.map((name) => {
              const state = project.states[name]
              const included = manifest.optional_states.includes(name)
              return (
                <div key={name} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                  <span className={included ? 'text-emerald-600' : 'text-stone-400'}>{included ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
                  <span className="capitalize">{name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {included ? state.status === 'animated' ? '會打包' : '會打包（尚未動畫化）' : '尚無圖片，不會打包'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-medium text-stone-800">自訂動作</h3>
          {customActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前沒有自訂動作。</p>
          ) : (
            <div className="space-y-2">
              {customActions.map((action) => {
                const included = includedCustomActionIds.has(action.id)
                return (
                  <div key={action.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                    <span className={included ? 'text-emerald-600' : 'text-amber-600'}>{included ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
                    <span className="min-w-0 flex-1 truncate">{action.name.trim() || '未命名動作'}</span>
                    <span className="text-xs text-muted-foreground">{included ? '會打包' : '動畫未完成，不會打包'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {validation.blocking.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {validation.blocking.map((message) => <p key={message}>{message}</p>)}
          </div>
        )}
        {incomplete.length > 0 && <p className="mt-4 text-sm text-amber-800">先完成六個基本狀態的動畫，再回來分享。</p>}
      </Section>

      <Section title="會公開的內容" subtitle="按下分享後，作品會立即出現在社群展示頁。" icon={<UsersRound size={18} strokeWidth={1.75} />}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-stone-700">
          <li>作品名稱、作者、版本、簡介、標籤與授權。</li>
          <li>匯出的角色 sprites、自訂動作、manifest 與可選背板。</li>
          <li>從 Idle 第一格產生的透明 PNG 預覽圖。</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">不會上傳角色參考原圖、編輯用專案檔、prompt、API key 或本機設定。</p>
        <p className="mt-2 text-xs text-muted-foreground">單包上限 40 MB；每個網路每日最多分享 5 件。你可在展示頁下架自己分享的作品。</p>
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950">
        <input type="checkbox" className="mt-1 size-4 accent-emerald-700" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>我確認自己有權分享這些圖片與文字，也確認專案設定中的授權適用於公開下載。其他人可直接下載這個版本的角色包。</span>
      </label>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {sharedWork && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
          <CheckCircle2 className="shrink-0 text-emerald-700" size={20} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-emerald-950">{sharedWork.displayName} 已分享到社群。</p>
            <p className="text-sm text-emerald-800">現在任何人都可以在展示頁找到並下載這個 moripack。</p>
          </div>
          <Button variant="outline" onClick={() => setView({ kind: 'community' })}>查看社群展示</Button>
        </div>
      )}

      <Button size="lg" className="gap-2" disabled={!canShare} onClick={handleShare}>
        <Share2 size={17} />
        {sharing ? '打包並上傳中…' : '分享到公開社群'}
      </Button>
    </div>
  )
}
