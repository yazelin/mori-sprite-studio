import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_STATE_SEMANTICS } from '@/defaults'

export function StateSemanticsTable() {
  const semantics = useAppStore((s) => s.prompts.stateSemantics)
  const update = useAppStore((s) => s.setStateSemantics)

  function resetAll() {
    for (const name of STATE_NAMES) update(name, DEFAULT_STATE_SEMANTICS[name])
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {STATE_NAMES.map((name) => (
        <div key={name} className="grid grid-cols-[100px_1fr] items-center gap-3">
          <span className="text-sm font-mono capitalize">{name}</span>
          <Input
            value={semantics[name]}
            onChange={(e) => update(name, e.target.value)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={resetAll}>全部回預設</Button>
    </div>
  )
}
