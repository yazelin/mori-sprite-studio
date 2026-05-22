import { Settings, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  onGenerate: () => void
  onEditPrompt: () => void
  disabled?: boolean
  generating?: boolean
  className?: string
  size?: 'default' | 'sm' | 'lg'
}

export function GenerateButton({
  label, onGenerate, onEditPrompt, disabled, generating, className, size = 'default',
}: Props) {
  const heightClass = size === 'sm' ? 'h-9 text-sm px-3' : size === 'lg' ? 'h-12 text-base px-6' : 'h-10 text-sm px-4'

  return (
    <div className={cn('inline-flex gap-2 items-center', className)}>
      <button
        onClick={onGenerate}
        disabled={disabled || generating}
        className={cn(
          heightClass,
          'relative inline-flex items-center gap-2 rounded-lg font-medium transition-all',
          'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm',
          'hover:from-emerald-500 hover:to-emerald-700 hover:shadow-md hover:-translate-y-px',
          'disabled:from-stone-300 disabled:to-stone-400 disabled:text-stone-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500',
        )}
      >
        {generating ? (
          <Spinner />
        ) : (
          <Sparkles size={16} strokeWidth={1.75} className="text-amber-200" aria-hidden />
        )}
        <span>{generating ? '生成中…' : label}</span>
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onEditPrompt}
        disabled={generating}
        title="編輯 prompt"
        aria-label="編輯 prompt"
        className={cn(
          'shrink-0',
          size === 'sm' && 'h-9 w-9',
          size === 'lg' && 'h-12 w-12',
          size === 'default' && 'h-10 w-10',
        )}
      >
        <Settings size={size === 'lg' ? 18 : 16} strokeWidth={1.75} />
      </Button>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      aria-hidden
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
