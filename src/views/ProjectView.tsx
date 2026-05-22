import { useEffect, useState } from 'react'
import { Image, FileText, Pencil, Wand2, Eraser, Maximize2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { NormalizeConfig } from '@/components/NormalizeConfig'
import { GenerateButton } from '@/components/GenerateButton'
import { Section } from '@/components/Section'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext } from '@/lib/generationFlow'

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const

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

      <DemoLoaderBanner />

      <Section
        title="Character Reference"
        subtitle="上傳一張你的角色圖。後續所有 state 都會以這張為基底生成。"
        icon={<Image {...ICON_PROPS} />}
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
        icon={<FileText {...ICON_PROPS} />}
      >
        <MetadataForm />
      </Section>

      <Section
        title="State Semantics"
        subtitle="每個 state 的英文語意,給 AI 當每格姿勢的 hint。改完即時生效。"
        icon={<Pencil {...ICON_PROPS} />}
      >
        <StateSemanticsTable />
      </Section>

      <Section
        title="AI Provider"
        subtitle="預設 Author Fallback 免設定可直接用。其他 3 個自填 key。"
        icon={<Wand2 {...ICON_PROPS} />}
      >
        <ProviderConfig />
      </Section>

      <Section
        title="Background Removal"
        subtitle="AI 用純色背景生圖,瀏覽器這邊 chroma key 去背。角色含 chroma 同色會被誤刪,擇一避開。"
        icon={<Eraser {...ICON_PROPS} />}
      >
        <ChromaConfig />
      </Section>

      <Section
        title="Normalize 跨 state 尺寸"
        subtitle="每 state 獨立生成,角色大小/位置會微飄。一鍵掃描算出每 state 的 transform,讓 mori-desktop 切 state 時不跳。"
        icon={<Maximize2 {...ICON_PROPS} />}
      >
        <NormalizeConfig />
      </Section>

      <Section
        title="專案存檔"
        subtitle="把當前完整 IDB 狀態(6 sheet + raw + 設定 + character ref + backdrops)包成 .moriproject.zip;之後可載回繼續編輯,或分享給人當基底。"
        icon={<FileText {...ICON_PROPS} />}
      >
        <ProjectFileButtons />
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

function DemoLoaderBanner() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const characterRef = useAppStore((s) => s.project.characterRef)

  // Only show banner if user is on a blank-ish project (no character ref uploaded)
  if (characterRef) return null

  async function loadDemo() {
    setLoading(true); setErr(null)
    try {
      const { loadDemoProject } = await import('@/lib/projectFile')
      await loadDemoProject('/demo/mori.moriproject.zip')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[280px]">
          <h2 className="text-base font-semibold text-emerald-900">第一次用?載 Mori 預設 Demo</h2>
          <p className="text-sm text-emerald-800/80 max-w-prose">
            完整 Mori 角色 pack(6 個 state 動畫 + character ref + 2 個背板),
            一鍵載入立刻看到所有功能。也可當作改造起點 → 改 metadata / pose
            note 重生成你自己的角色。
          </p>
        </div>
        <button
          type="button"
          onClick={loadDemo}
          disabled={loading}
          className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 shrink-0 transition-colors"
        >
          {loading ? '載入中…' : '✦ 載入 Mori Demo'}
        </button>
      </div>
      {err && <p className="text-xs text-red-700 mt-2">⚠ 載入失敗: {err}</p>}
    </div>
  )
}

function ProjectFileButtons() {
  const project = useAppStore((s) => s.project)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const inputId = 'project-file-load'

  async function save() {
    setBusy(true); setReport(null)
    try {
      const { downloadProjectFile } = await import('@/lib/projectFile')
      await downloadProjectFile(project)
      setReport('已下載 .moriproject.zip')
    } catch (e) {
      setReport(`錯誤: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  async function load(file: File) {
    setBusy(true); setReport(null)
    try {
      const { loadProjectFile } = await import('@/lib/projectFile')
      await loadProjectFile(file)
      setReport(`已載入 ${file.name}`)
    } catch (e) {
      setReport(`錯誤: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 max-w-xl">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="h-9 px-4 border border-border bg-card hover:bg-stone-50 text-sm rounded-md disabled:opacity-50"
        >
          ⇩ 下載 .moriproject.zip
        </button>
        <input
          id={inputId}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = '' }}
        />
        <label
          htmlFor={inputId}
          className={`h-9 px-4 inline-flex items-center border border-border bg-card hover:bg-stone-50 text-sm rounded-md cursor-pointer ${busy ? 'opacity-50' : ''}`}
        >
          ⇧ 載入 .moriproject.zip
        </label>
      </div>
      {report && <p className="text-xs text-muted-foreground">{report}</p>}
      <p className="text-xs text-muted-foreground">
        提醒:**載入會完全取代當前所有資料**,先備份你目前的狀態再載新檔。
      </p>
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
