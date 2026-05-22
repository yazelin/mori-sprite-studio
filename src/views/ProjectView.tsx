import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { GenerateButton } from '@/components/GenerateButton'
import { Section } from '@/components/Section'
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
    <div className="space-y-8">
      <PageHeader
        title="專案設定"
        subtitle="一張角色 ref 圖 → 一次 AI 生成 6 個 state 靜態 → 各自動畫化 → 匯出 .moripack.zip。"
      />

      <Section
        title="Character Reference"
        subtitle="上傳一張你的角色圖。後續所有 state 都會以這張為基底生成。"
        icon="🎴"
        action={
          <GenerateButton
            label="生 6 狀態靜態"
            onGenerate={runB1}
            onEditPrompt={openB1PromptEditor}
            disabled={!characterRef}
            generating={generating}
          />
        }
      >
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <UploadDropzone
            onFile={setCharacterRef}
            preview={previewUrl}
            label="拖放或點擊上傳"
            hint="PNG / JPG · 透明背景或白底皆可"
            previewSize={240}
          />
          <div className="flex-1 min-w-0 text-sm text-stone-600 leading-relaxed">
            <p className="font-medium text-stone-800 mb-2">下一步</p>
            <ol className="list-decimal list-inside space-y-1 text-stone-600">
              <li>確認角色 ref + 下方 Provider 跟 Chroma 設定</li>
              <li>按 <span className="font-medium text-emerald-700">✦ 生 6 狀態靜態</span></li>
              <li>等 30-180 秒,6 個 state 自動填滿 placeholder sheet</li>
              <li>進每個 state 再按 <span className="font-medium text-emerald-700">生 &lt;state&gt; 動畫</span> 把靜態轉成 4×4 動畫</li>
            </ol>
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="font-medium">⚠ 生成失敗:</span> {error}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Metadata"
        subtitle="character-pack.md v1.0 必要欄位。匯出時會寫進 manifest.json。"
        icon="📋"
      >
        <MetadataForm />
      </Section>

      <Section
        title="State Semantics"
        subtitle="每個 state 的英文語意,給 AI 當每格姿勢的 hint。改完即時生效。"
        icon="✎"
      >
        <StateSemanticsTable />
      </Section>

      <Section
        title="AI Provider"
        subtitle="預設 Author Fallback 免設定可直接用。其他 3 個自填 key。"
        icon="✧"
      >
        <ProviderConfig />
      </Section>

      <Section
        title="Background Removal"
        subtitle="AI 用純色背景生圖,瀏覽器這邊 chroma key 去背。角色含 chroma 同色會被誤刪,擇一避開。"
        icon="🟢"
      >
        <ChromaConfig />
      </Section>

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runB1WithCustomPrompt}
      />
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-prose">{subtitle}</p>
    </header>
  )
}
