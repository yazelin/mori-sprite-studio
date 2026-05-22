import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { GenerateButton } from '@/components/GenerateButton'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext } from '@/lib/generationFlow'

export function ProjectView() {
  const characterRef = useAppStore((s) => s.project.characterRef)
  const setCharacterRef = useAppStore((s) => s.setCharacterRef)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalContext, setModalContext] = useState<PromptEditorContext | null>(null)

  useEffect(() => {
    if (!characterRef) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(characterRef)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [characterRef])

  async function runB1() {
    setError(null); setGenerating(true)
    try { await runGeneration('B1') }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  function openB1PromptEditor() {
    const { vars, opLabel } = buildPromptContext('B1')
    setModalContext({ templateKey: 'B1', vars, opLabel })
    setModalOpen(true)
  }

  async function runB1WithCustomPrompt(prompt: string) {
    setError(null); setGenerating(true)
    try { await runGenerationWithPrompt('B1', prompt) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

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
        <div className="pt-3 space-y-2">
          <GenerateButton
            label="生 6 狀態靜態"
            onGenerate={runB1}
            onEditPrompt={openB1PromptEditor}
            disabled={!characterRef}
            generating={generating}
          />
          {error && (
            <p className="text-sm text-red-600 max-w-prose">⚠ {error}</p>
          )}
        </div>
      </Section>

      <Section title="Metadata"><MetadataForm /></Section>
      <Section title="State Semantics"><StateSemanticsTable /></Section>
      <Section title="AI Provider"><ProviderConfig /></Section>
      <Section title="Background Removal (Chroma Key)"><ChromaConfig /></Section>

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runB1WithCustomPrompt}
      />
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
