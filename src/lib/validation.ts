import { MAX_CUSTOM_ACTIONS, type Project } from '@/types/project'
import { STATE_NAMES, REQUIRED_STATE_NAMES, isOptionalState } from '@/types/project'

export interface ValidationResult {
  canExport: boolean
  blocking: string[]
  warnings: string[]
}

const PACKAGE_NAME_RE = /^[a-z][a-z0-9_]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/

export function validateProject(p: Project): ValidationResult {
  const blocking: string[] = []
  const warnings: string[] = []

  if (!p.metadata.packageName.trim()) {
    blocking.push('package_name 不能為空')
  } else if (!PACKAGE_NAME_RE.test(p.metadata.packageName)) {
    blocking.push(`package_name 必須符合 ^[a-z][a-z0-9_]*$(目前: "${p.metadata.packageName}")`)
  }

  if (!p.metadata.displayName.trim()) {
    blocking.push('display_name 不能為空')
  }

  const requiredSheetCount = REQUIRED_STATE_NAMES.filter((n) => p.states[n].sheet !== null).length
  if (requiredSheetCount === 0) {
    blocking.push('至少要有 1 個必要 state 有 sheet')
  }

  if (!SEMVER_RE.test(p.metadata.version)) {
    warnings.push(`version "${p.metadata.version}" 不符 semver 格式`)
  }

  for (const n of STATE_NAMES) {
    const isOpt = isOptionalState(n)
    if (!p.states[n].sheet) {
      // Missing optional state is INFORMATIONAL — pack still ships fine without it,
      // mori-desktop falls back to idle.png + CSS scale. Only warn for required.
      if (!isOpt) {
        warnings.push(`${n} 沒有 sheet,匯出時會缺檔(mori-desktop 會 fallback default)`)
      }
    } else if (p.states[n].status === 'placeholder') {
      warnings.push(`${n} 仍為 placeholder,未動畫化`)
    }
    const dur = p.states[n].loopDurationMs
    if (dur < 100 || dur > 30000) {
      warnings.push(`${n} loopDurationMs ${dur} 超出 100-30000 範圍`)
    }
  }

  const customActions = p.customActions ?? []
  if (customActions.length > MAX_CUSTOM_ACTIONS) {
    blocking.push(`自訂動作最多 ${MAX_CUSTOM_ACTIONS} 個`)
  }
  const actionIds = new Set<string>()
  for (const action of customActions) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(action.id)) {
      blocking.push(`自訂動作「${action.name || action.id}」的識別碼格式不正確`)
    }
    if (actionIds.has(action.id)) blocking.push(`自訂動作識別碼重複：${action.id}`)
    actionIds.add(action.id)
    if (action.sheet && action.status === 'animated' && !action.name.trim()) {
      blocking.push(`已完成的自訂動作 ${action.id} 需要名稱`)
    } else if (action.name.trim() && (!action.sheet || action.status !== 'animated')) {
      warnings.push(`自訂動作「${action.name}」尚未完成動畫，不會匯出到 moripack`)
    }
    if (action.loopDurationMs < 250 || action.loopDurationMs > 60000) {
      blocking.push(`自訂動作「${action.name || action.id}」播放時間須在 250-60000 毫秒之間`)
    }
  }

  return {
    canExport: blocking.length === 0,
    blocking,
    warnings,
  }
}
