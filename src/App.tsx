import { useAppStore } from '@/store'
import { Sidebar } from '@/components/Sidebar'
import { ProjectView } from '@/views/ProjectView'
import { StateView } from '@/views/StateView'
import { ExportView } from '@/views/ExportView'

export default function App() {
  const view = useAppStore((s) => s.ui.view)

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white">
        {view.kind === 'project' && <ProjectView />}
        {view.kind === 'state' && <StateView name={view.name} />}
        {view.kind === 'export' && <ExportView />}
      </main>
    </div>
  )
}
