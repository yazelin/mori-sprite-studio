import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Card-shaped section block used across views. Soft shadow + warm border,
 * generous padding, optional inline action in the header.
 */
export function Section({ title, subtitle, icon, action, children, className }: Props) {
  return (
    <section
      className={cn(
        'rounded-2xl bg-card border border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_2px_8px_rgba(120,113,108,0.04)]',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {icon && (
            <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-base text-emerald-700">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-stone-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="px-6 pb-6">{children}</div>
    </section>
  )
}

/**
 * Inline helper text below a section title, when subtitle isn't enough.
 */
export function SectionNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-xs text-muted-foreground', className)}>{children}</p>
}
