import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

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

  const sheetCount = STATE_NAMES.filter((n) => p.states[n].sheet !== null).length
  if (sheetCount === 0) {
    blocking.push('至少要有 1 個 state 有 sheet')
  }

  if (!SEMVER_RE.test(p.metadata.version)) {
    warnings.push(`version "${p.metadata.version}" 不符 semver 格式`)
  }

  for (const n of STATE_NAMES) {
    if (!p.states[n].sheet) {
      warnings.push(`${n} 沒有 sheet,匯出時會缺檔(mori-desktop 會 fallback default)`)
    } else if (p.states[n].status === 'placeholder') {
      warnings.push(`${n} 仍為 placeholder,未動畫化`)
    }
    const dur = p.states[n].loopDurationMs
    if (dur < 100 || dur > 30000) {
      warnings.push(`${n} loopDurationMs ${dur} 超出 100-30000 範圍`)
    }
  }

  return {
    canExport: blocking.length === 0,
    blocking,
    warnings,
  }
}
