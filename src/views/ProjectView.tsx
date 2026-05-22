import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { GenerateButton } from '@/components/GenerateButton'

export function ProjectView() {
  const characterRef = useAppStore((s) => s.project.characterRef)
  const setCharacterRef = useAppStore((s) => s.setCharacterRef)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Recompute preview URL whenever characterRef changes
  useEffect(() => {
    if (!characterRef) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(characterRef)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [characterRef])

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">⌂ 專案</h1>

      <Section title="Character Reference">
        <UploadDropzone
          onFile={setCharacterRef}
          preview={previewUrl}
          label="拖放或點擊上傳角色參考圖"
          previewSize={256}
        />
        <div className="pt-3">
          <GenerateButton
            label="生 6 狀態靜態"
            onGenerate={() => alert('TODO M10: wire B1')}
            onEditPrompt={() => alert('TODO M10: open prompt editor for B1')}
            disabled={!characterRef}
          />
        </div>
      </Section>

      <Section title="Metadata">
        <MetadataForm />
      </Section>

      <Section title="State Semantics(讓 AI 知道每個 state 該長啥)">
        <StateSemanticsTable />
      </Section>

      <Section title="AI Provider">
        <ProviderConfig />
      </Section>

      <Section title="Background Removal (Chroma Key)">
        <ChromaConfig />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  )
}
