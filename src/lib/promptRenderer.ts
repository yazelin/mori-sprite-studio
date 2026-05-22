import type { StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match
  })
}

export function renderCellNotesBlock(notes: string[]): string {
  return notes.map((n, i) => `  Frame ${i + 1}: ${n}`).join('\n')
}

export function renderStateDescriptions(semantics: Record<StateName, string>): string {
  return STATE_NAMES.map((s, i) => `  Cell ${i + 1} (${s}): ${semantics[s]}`).join('\n')
}
