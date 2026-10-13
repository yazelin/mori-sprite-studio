import { useState } from 'react'
import { Activity, Plus, Sparkles, Trash2 } from 'lucide-react'
import { AnimationPreview } from '@/components/AnimationPreview'
import { Section } from '@/components/Section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CustomActionFrameEditor } from '@/components/CustomActionFrameEditor'
import {
  regenerateCustomActionFrame,
  reorderCustomActionFrames,
  runCustomActionAnimation,
  runCustomActionBase,
} from '@/lib/generationFlow'
import { useAppStore } from '@/store'
import { MAX_CUSTOM_ACTIONS, type CustomAction } from '@/types/project'

function createActionId() {
  const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `action_${random.slice(0, 24)}`
}

function newAction(index: number): CustomAction {
  return {
    id: createActionId(),
    name: `自訂動作 ${index}`,
    description: '',
    poseNote: '',
    staticBase: null,
    rawStaticBase: null,
    sheet: null,
    rawSheet: null,
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    loopMode: 'one-shot',
    loopDurationMs: 1800,
    status: 'pending',
  }
}

const STATUS: Record<CustomAction['status'], { label: string; className: string }> = {
  pending: { label: '尚未生成 base', className: 'border-stone-200 bg-stone-50 text-stone-600' },
  placeholder: { label: 'base 已完成，動畫待生成', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  animated: { label: '動畫已完成，可匯出', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
}

export function CustomActionsView() {
  const project = useAppStore((s) => s.project)
  const addAction = useAppStore((s) => s.addCustomAction)
  const updateAction = useAppStore((s) => s.updateCustomAction)
  const removeAction = useAppStore((s) => s.removeCustomAction)
  const actions = project.customActions ?? []
  const [busy, setBusy] = useState<{ id: string; phase: 'base' | 'animation' | 'frame'; frameIndex?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addNewAction() {
    addAction(newAction(actions.length + 1))
    setError(null)
  }

  function editAction(action: CustomAction, patch: Partial<CustomAction>, invalidatesImages = false) {
    updateAction(action.id, {
      ...patch,
      ...(invalidatesImages ? {
        staticBase: null,
        rawStaticBase: null,
        sheet: null,
        rawSheet: null,
        status: 'pending',
      } : {}),
    })
  }

  async function generateBase(action: CustomAction) {
    setBusy({ id: action.id, phase: 'base' })
    setError(null)
    try { await runCustomActionBase(action.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(null) }
  }

  async function generateAnimation(action: CustomAction) {
    setBusy({ id: action.id, phase: 'animation' })
    setError(null)
    try { await runCustomActionAnimation(action.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(null) }
  }

  async function regenerateFrame(action: CustomAction, frameIndex: number, correction: string) {
    setBusy({ id: action.id, phase: 'frame', frameIndex })
    setError(null)
    try { await regenerateCustomActionFrame(action.id, frameIndex, correction) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(null) }
  }

  async function reorderFrames(action: CustomAction, permutation: readonly number[]) {
    setError(null)
    try { await reorderCustomActionFrames(action.id, permutation) }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`影格順序調整失敗：${message}`)
      throw cause
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">自訂動作</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            為角色建立額外動作：先生成 base 姿勢，再把它動畫化。完成的動作會放進 .moripack，供支援自訂動作的 Player 播放。
          </p>
        </div>
        <Button onClick={addNewAction} disabled={actions.length >= MAX_CUSTOM_ACTIONS} className="gap-2">
          <Plus size={16} /> 新增動作
        </Button>
      </header>

      {!project.characterRef && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          請先在「專案設定」上傳角色參考圖，才能生成自訂動作。
        </div>
      )}
      {actions.length >= MAX_CUSTOM_ACTIONS && (
        <p className="text-xs text-muted-foreground">每個專案最多建立 {MAX_CUSTOM_ACTIONS} 個自訂動作。</p>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          生成失敗：{error}
        </div>
      )}

      {actions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-8 text-center">
          <Sparkles className="mx-auto mb-3 text-emerald-700" size={24} />
          <h2 className="text-base font-semibold text-stone-800">還沒有自訂動作</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            可以新增揮手、跳舞、打哈欠等動作，再由 Player 設定手動或自動觸發。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {actions.map((action) => {
            const status = STATUS[action.status]
            const isBusy = busy?.id === action.id
            return (
              <Section
                key={action.id}
                title={action.name.trim() || '未命名動作'}
                subtitle="動作定義、base 姿勢與 4×4 動畫"
                icon={<Activity size={18} strokeWidth={1.75} />}
                action={(
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (window.confirm(`刪除「${action.name || '未命名動作'}」？`)) removeAction(action.id)
                    }}
                    className="gap-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    <Trash2 size={14} /> 刪除
                  </Button>
                )}
              >
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-6">
                  <div className="space-y-4 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>動作名稱</Label>
                        <Input
                          value={action.name}
                          maxLength={64}
                          disabled={Boolean(busy)}
                          onChange={(event) => editAction(action, { name: event.target.value })}
                          placeholder="例如：揮手打招呼"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>播放方式</Label>
                        <select
                          value={action.loopMode}
                          disabled={Boolean(busy)}
                          onChange={(event) => editAction(action, { loopMode: event.target.value as CustomAction['loopMode'] })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="one-shot">播放一次後回到原狀態</option>
                          <option value="loop">持續循環，直到被其他狀態取代</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>動作描述</Label>
                      <Textarea
                        value={action.description}
                        maxLength={500}
                        disabled={Boolean(busy)}
                        onChange={(event) => editAction(action, { description: event.target.value }, true)}
                        rows={3}
                        placeholder="用中文描述動作和表情，例如：雙手在胸前左右揮動，笑著向使用者打招呼。"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Base 姿勢補充（選填）</Label>
                      <Textarea
                        value={action.poseNote}
                        maxLength={500}
                        disabled={Boolean(busy)}
                        onChange={(event) => editAction(action, { poseNote: event.target.value }, true)}
                        rows={2}
                        placeholder="例如：身體正面朝向使用者，雙手自然垂下作為動作起點。"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>單次動畫時間</Label>
                        <span className="font-mono text-xs text-muted-foreground">{action.loopDurationMs} ms</span>
                      </div>
                      <input
                        type="range"
                        min={500}
                        max={10000}
                        step={100}
                        value={action.loopDurationMs}
                        disabled={Boolean(busy)}
                        onChange={(event) => editAction(action, { loopDurationMs: Number(event.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        disabled={!project.characterRef || Boolean(busy) || !action.name.trim() || !action.description.trim()}
                        onClick={() => void generateBase(action)}
                      >
                        {isBusy && busy?.phase === 'base' ? '生成 base 中…' : action.staticBase ? '重新生成 base' : '生成 base'}
                      </Button>
                      <Button
                        disabled={!action.staticBase || Boolean(busy) || !action.name.trim() || !action.description.trim()}
                        onClick={() => void generateAnimation(action)}
                      >
                        {isBusy && busy?.phase === 'animation' ? '生成動畫中…' : action.status === 'animated' ? '重新生成動畫' : '生成動畫'}
                      </Button>
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    {action.status === 'placeholder' && action.sheet && (
                      <p className="text-xs text-amber-800">Base 已生成。請按「生成動畫」產生 4×4 動作格；調整播放方式或時間不必重生圖片。</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">動畫預覽</Label>
                    <div className="aspect-square w-full rounded-xl border border-border tx-checker p-2">
                      <AnimationPreview
                        sheet={action.sheet}
                        durationMs={action.loopDurationMs}
                        paused={action.status !== 'animated'}
                        size={224}
                        transform={action.transform}
                        fitParent
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {action.status === 'animated' ? '完成後可匯出並在 Player 中設定觸發條件。' : 'base 預覽會停在第一格；生成動畫後可播放完整動作。'}
                    </p>
                  </div>
                </div>
                {action.status === 'animated' && action.sheet && (
                  <CustomActionFrameEditor
                    actionId={action.id}
                    actionName={action.name.trim() || action.id}
                    sheet={action.sheet}
                    disabled={Boolean(busy)}
                    busyFrameIndex={busy?.id === action.id && busy.phase === 'frame' ? busy.frameIndex ?? null : null}
                    onReorder={(permutation) => reorderFrames(action, permutation)}
                    onRegenerate={(frameIndex, correction) => void regenerateFrame(action, frameIndex, correction)}
                  />
                )}
              </Section>
            )
          })}
        </div>
      )}
    </div>
  )
}
