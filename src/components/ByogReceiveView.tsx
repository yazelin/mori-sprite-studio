import { useState } from 'react'
import { UploadDropzone } from './UploadDropzone'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  promptCopied: boolean
  expectedSizeLabel: string
  expectedLayoutLabel: string
  onCancel: () => void
  onUpload: (blob: Blob, skipChroma: boolean) => Promise<void>
}

export function ByogReceiveView({
  promptCopied, expectedSizeLabel, expectedLayoutLabel, onCancel, onUpload,
}: Props) {
  const [skipChroma, setSkipChroma] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(blob: Blob) {
    setError(null); setUploading(true)
    try { await onUpload(blob, skipChroma) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-4 pb-1">
      <div className="text-sm space-y-1">
        <div>{promptCopied ? '✓' : '…'} Prompt 已複製到剪貼簿</div>
        <div>✓ Reference 圖已下載</div>
      </div>

      <div className="text-sm space-y-1 bg-slate-50 p-3 rounded-md">
        <div className="font-medium">📋 步驟提示</div>
        <ol className="list-decimal list-inside text-xs text-slate-600 space-y-0.5">
          <li>到任何 image gen 工具(ChatGPT / Gemini / Midjourney 等)</li>
          <li>上傳 reference 圖、貼 prompt</li>
          <li>生圖、下載 PNG</li>
          <li>拖回下方上傳</li>
        </ol>
      </div>

      <div className="text-sm space-y-1 bg-amber-50 border border-amber-200 p-3 rounded-md">
        <div className="font-medium">預期輸出</div>
        <div className="text-xs text-amber-900">{expectedSizeLabel}</div>
        <div className="text-xs text-amber-900">{expectedLayoutLabel}</div>
        <div className="text-xs text-amber-900">背景:純綠 #00FF00 或洋紅 #FF00FF(對應你的 chroma 設定)</div>
      </div>

      <UploadDropzone
        onFile={handleUpload}
        label={uploading ? '處理中…' : '⬇ 拖檔或點此上傳結果 ⬇'}
        previewSize={220}
      />

      <div className="flex items-start sm:items-center gap-2">
        <Checkbox
          id="skip-chroma"
          checked={skipChroma}
          onCheckedChange={(v) => setSkipChroma(Boolean(v))}
        />
        <Label htmlFor="skip-chroma" className="text-sm leading-relaxed">背景已是透明,跳過 chroma key</Label>
      </div>

      {error && <p className="text-sm text-red-600">⚠ {error}</p>}

      <Button variant="ghost" onClick={onCancel}>取消,回 Prompt 編輯</Button>
    </div>
  )
}
