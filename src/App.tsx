import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useAppStore } from '@/store'
import { Sidebar } from '@/components/Sidebar'
import { ProjectView } from '@/views/ProjectView'
import { StateView } from '@/views/StateView'
import { BackdropView } from '@/views/BackdropView'
import { PreviewView } from '@/views/PreviewView'
import { ExportView } from '@/views/ExportView'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function App() {
  const view = useAppStore((s) => s.ui.view)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="h-full flex bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:hidden pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold leading-tight">Mori Sprite Studio</p>
              <p className="text-xs text-muted-foreground">手機版選單</p>
            </div>
            <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="開啟選單">
                  <Menu size={18} />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] p-0 h-[85vh] overflow-hidden">
                <DialogHeader className="sr-only">
                  <DialogTitle>手機版導覽選單</DialogTitle>
                  <DialogDescription>切換專案、狀態、預覽與匯出頁面</DialogDescription>
                </DialogHeader>
                <Sidebar onNavigate={() => setMobileNavOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          {view.kind === 'project' && <ProjectView />}
          {view.kind === 'state' && <StateView name={view.name} />}
          {view.kind === 'backdrop' && <BackdropView />}
          {view.kind === 'preview' && <PreviewView />}
          {view.kind === 'export' && <ExportView />}
        </div>
      </main>
    </div>
  )
}
