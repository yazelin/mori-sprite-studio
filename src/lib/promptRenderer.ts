import type { StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match
  })
}

export function renderCellNotesBlock(notes: string[]): string {
  return notes.map((n, i) => `  Frame ${i + 1}: ${n || '(AI fills in)'}`).join('\n')
}

// 3×2 grid cell labels (ported from line-sticker-studio convention).
// Cell letter + position name keeps the AI from drifting / swapping cells.
const CELL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const CELL_POSITIONS = [
  'top-left',  'top-centre',  'top-right',
  'bottom-left','bottom-centre','bottom-right',
] as const

/**
 * Build the per-cell pose assignment block for the B1 6-state grid prompt.
 * Uses letter coding + position name + explicit state semantic so the model
 * has no excuse to merge / swap / shrink cells.
 */
export function renderStateDescriptions(semantics: Record<StateName, string>): string {
  return STATE_NAMES.map((s, i) => {
    const letter = CELL_LETTERS[i]
    const pos = CELL_POSITIONS[i]
    return `  [${letter}] ${pos} cell — state "${s}":\n      POSE: ${semantics[s]}`
  }).join('\n')
}
