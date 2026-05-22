import { describe, it, expect } from 'vitest'
import { render, renderCellNotesBlock, renderStateDescriptions } from '@/lib/promptRenderer'

describe('promptRenderer', () => {
  it('substitutes {{var}} with provided value', () => {
    expect(render('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('leaves unknown {{var}} unchanged (no error)', () => {
    expect(render('a {{missing}} b', {})).toBe('a {{missing}} b')
  })

  it('handles multiple substitutions including same var twice', () => {
    expect(render('{{x}} and {{x}} and {{y}}', { x: 'A', y: 'B' })).toBe('A and A and B')
  })

  it('renderCellNotesBlock formats 16 frame notes (empty notes get placeholder)', () => {
    const notes = Array(16).fill('').map((_, i) => i === 0 ? 'start' : i === 15 ? 'end' : '')
    const out = renderCellNotesBlock(notes)
    expect(out).toContain('Frame 1: start')
    expect(out).toContain('Frame 16: end')
    // Empty notes get a "hold steady" placeholder so AI doesn't re-stage
    expect(out).toContain('Frame 2: (hold the same position')
  })

  it('renderStateDescriptions uses letter-coded cells with position names', () => {
    const semantics = {
      idle: 'relaxed', sleeping: 'asleep', recording: 'alert',
      thinking: 'pensive', done: 'happy', error: 'confused',
    }
    const out = renderStateDescriptions(semantics)
    expect(out).toContain('[A] top-left cell — state "idle":')
    expect(out).toContain('POSE: relaxed')
    expect(out).toContain('[F] bottom-right cell — state "error":')
    expect(out).toContain('POSE: confused')
    // Middle row check
    expect(out).toContain('[D] bottom-left cell — state "thinking":')
  })
})
