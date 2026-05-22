import { cn } from '@/lib/utils'
import type { SheetStatus } from '@/types/project'

const SYMBOL: Record<SheetStatus, string> = {
  pending:     '○',
  placeholder: '●',
  animated:    '◆',
}

const COLOR: Record<SheetStatus, string> = {
  pending:     'text-slate-400',
  placeholder: 'text-amber-500',
  animated:    'text-emerald-500',
}

export function StatusBadge({ status, className }: { status: SheetStatus; className?: string }) {
  return (
    <span className={cn('font-mono text-base', COLOR[status], className)} aria-label={status}>
      {SYMBOL[status]}
    </span>
  )
}
