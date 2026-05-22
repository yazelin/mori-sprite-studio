import { useAppStore } from '@/store'
import { Sidebar } from '@/components/Sidebar'
import { ProjectView } from '@/views/ProjectView'
import { StateView } from '@/views/StateView'
import { BackdropView } from '@/views/BackdropView'
import { ExportView } from '@/views/ExportView'

export default function App() {
  const view = useAppStore((s) => s.ui.view)

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          {view.kind === 'project' && <ProjectView />}
          {view.kind === 'state' && <StateView name={view.name} />}
          {view.kind === 'backdrop' && <BackdropView />}
          {view.kind === 'export' && <ExportView />}
        </div>
      </main>
    </div>
  )
}
