import { useEffect, useState } from 'react'
import { Home, Download, Leaf, ImagePlus, Eye } from 'lucide-react'
import { useAppStore } from '@/store'
import {
  REQUIRED_STATE_NAMES, OPTIONAL_STATE_NAMES,
  type StateName, type SheetStatus,
} from '@/types/project'
import { cn } from '@/lib/utils'

const STATE_LABEL: Record<StateName, string> = {
  idle:      'Idle',
  sleeping:  'Sleeping',
  recording: 'Recording',
  thinking:  'Thinking',
  done:      'Done',
  error:     'Error',
  walking:   'Walking',
  dragging:  'Dragging',
}

const STATUS_DOT_COLOR: Record<SheetStatus, string> = {
  pending:     'bg-stone-300',
  placeholder: 'bg-amber-400',
  animated:    'bg-emerald-500',
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const view = useAppStore((s) => s.ui.view)
  const setView = useAppStore((s) => s.setView)
  const states = useAppStore((s) => s.project.states)
  const characterRef = useAppStore((s) => s.project.characterRef)
  const [refUrl, setRefUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!characterRef) { setRefUrl(null); return }
    const u = URL.createObjectURL(characterRef)
    setRefUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [characterRef])

  return (
    <nav className="w-full md:w-72 shrink-0 border-r border-border bg-card/60 backdrop-blur-sm flex flex-col h-full min-h-0 overflow-hidden">
      <div className="px-5 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          {refUrl ? (
            <img src={refUrl} alt="character" className="w-10 h-10 rounded-xl object-cover border border-border shadow-sm bg-stone-100" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Leaf size={18} strokeWidth={1.75} />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-stone-900">Mori Sprite Studio</span>
            <span className="text-[11px] text-muted-foreground">character pack maker</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        <Item active={view.kind === 'project'} onClick={() => { setView({ kind: 'project' }); onNavigate?.() }} icon={<Home size={16} strokeWidth={1.75} />} label="專案設定" />
        <SectionLabel>States(必要 6 個)</SectionLabel>
        {REQUIRED_STATE_NAMES.map((name) => {
          const state = states[name]
          return (
            <StateItem
              key={name}
              active={view.kind === 'state' && view.name === name}
              onClick={() => { setView({ kind: 'state', name }); onNavigate?.() }}
              label={STATE_LABEL[name]}
              status={state.status}
              thumbBlob={state.staticBase ?? state.sheet}
            />
          )
        })}
        <SectionLabel>Optional states(可選 2 個)</SectionLabel>
        {OPTIONAL_STATE_NAMES.map((name) => {
          const state = states[name]
          return (
            <StateItem
              key={name}
              active={view.kind === 'state' && view.name === name}
              onClick={() => { setView({ kind: 'state', name }); onNavigate?.() }}
              label={STATE_LABEL[name]}
              status={state.status}
              thumbBlob={state.staticBase ?? state.sheet}
            />
          )
        })}
        <SectionLabel>Extras</SectionLabel>
        <Item active={view.kind === 'backdrop'} onClick={() => { setView({ kind: 'backdrop' }); onNavigate?.() }} icon={<ImagePlus size={16} strokeWidth={1.75} />} label="角色背板" />
        <Item active={view.kind === 'preview'} onClick={() => { setView({ kind: 'preview' }); onNavigate?.() }} icon={<Eye size={16} strokeWidth={1.75} />} label="桌面預覽" />
        <SectionLabel>Output</SectionLabel>
        <Item active={view.kind === 'export'} onClick={() => { setView({ kind: 'export' }); onNavigate?.() }} icon={<Download size={16} strokeWidth={1.75} />} label="匯出 .moripack" />
      </div>

      <div className="mt-auto px-3 py-3 border-t border-border space-y-2 text-xs">
        <a href="https://buymeacoffee.com/yazelin" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 transition-colors" title="支持作者繼續開發">
          <span className="text-base leading-none">☕</span>
          <span className="font-medium">Buy me a coffee</span>
        </a>
        <a href="https://github.com/yazelin/mori-sprite-studio" target="_blank" rel="noreferrer" className="block px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">⭐ GitHub repo</a>
      </div>
    </nav>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{children}</div>
}

function Item({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-stone-700 hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      <span className={cn('shrink-0 w-5 flex items-center justify-center', active ? 'opacity-100' : 'opacity-70')}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

function StateItem({ active, onClick, label, status, thumbBlob }: { active: boolean; onClick: () => void; label: string; status: SheetStatus; thumbBlob: Blob | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!thumbBlob) { setUrl(null); return }
    const u = URL.createObjectURL(thumbBlob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [thumbBlob])

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-stone-700 hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      <div className={cn('shrink-0 w-9 h-9 rounded-md border overflow-hidden flex items-center justify-center', active ? 'border-primary-foreground/30 bg-primary-foreground/10' : 'border-border bg-stone-100')}>
        {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <span className="text-base opacity-50">·</span>}
      </div>
      <span className="flex-1 truncate font-medium">{label}</span>
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT_COLOR[status])} aria-label={status} title={status} />
    </button>
  )
}
