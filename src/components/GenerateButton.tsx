import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  onGenerate: () => void
  onEditPrompt: () => void
  disabled?: boolean
  generating?: boolean
  className?: string
}

export function GenerateButton({
  label, onGenerate, onEditPrompt, disabled, generating, className,
}: Props) {
  return (
    <div className={cn('inline-flex gap-1', className)}>
      <Button
        onClick={onGenerate}
        disabled={disabled || generating}
        className="gap-2"
      >
        <span>✦</span>
        <span>{generating ? '生成中…' : label}</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onEditPrompt}
        disabled={generating}
        title="編輯 prompt"
      >
        ⚙️
      </Button>
    </div>
  )
}
