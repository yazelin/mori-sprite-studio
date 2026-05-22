import type { StateName } from '@/types/project'

export function StateView({ name }: { name: StateName }) {
  return <div className="p-6"><h1 className="text-xl font-semibold capitalize">◆ {name}</h1></div>
}
