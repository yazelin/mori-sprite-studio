import { useAppStore } from '@/store'
import { STATE_NAMES } from '@/types/project'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const view = useAppStore((s) => s.ui.view)
  const setView = useAppStore((s) => s.setView)
  const states = useAppStore((s) => s.project.states)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-slate-50 p-3 flex flex-col gap-1">
      <Item
        active={view.kind === 'project'}
        onClick={() => setView({ kind: 'project' })}
      >
        <span className="text-base">⌂</span>
        <span>專案</span>
      </Item>

      <div className="border-t border-border my-2" />

      {STATE_NAMES.map((name) => (
        <Item
          key={name}
          active={view.kind === 'state' && view.name === name}
          onClick={() => setView({ kind: 'state', name })}
        >
          <StatusBadge status={states[name].status} />
          <span className="capitalize">{name}</span>
        </Item>
      ))}

      <div className="border-t border-border my-2" />

      <Item
        active={view.kind === 'export'}
        onClick={() => setView({ kind: 'export' })}
      >
        <span className="text-base">⤓</span>
        <span>匯出</span>
      </Item>
    </nav>
  )
}

function Item({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
        active ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-700',
      )}
    >
      {children}
    </button>
  )
}
