import type { StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import type { OutputSize } from '@/types/provider'
import { useAppStore } from '@/store'
import { buildProvider } from '@/providers'
import { chromaKeyOut } from './chromaKey'
import { CHROMA_COLORS } from '@/types/chroma'
import {
  splitGrid,
  cropToSize,
  buildPlaceholderSheet,
  buildPlaceholderSheetWithChromaBg,
  fillBgWithChroma,
  pasteIntoSheet,
  cropCell,
  erodeCellEdges,
  erodeSingleCellEdges,
} from './imageOps'
import { render, renderCellNotesBlock, renderStateDescriptions } from './promptRenderer'
import { appendChromaSuffix } from './promptBuilder'

const OUTPUT_SIZE: Record<TemplateKey, OutputSize> = {
  B1: '1536x1024',
  B2: '1024x1024',
  C:  '1024x1024',
  D:  '1024x1024',
}

/** Build the render context for a given operation. */
export function buildPromptContext(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): { vars: Record<string, string>; opLabel: string } {
  const store = useAppStore.getState()
  const { project, prompts } = store
  const vars: Record<string, string> = {}

  if (templateKey === 'B1') {
    vars.state_descriptions = renderStateDescriptions(prompts.stateSemantics)
    return { vars, opLabel: '生 6 狀態靜態' }
  }

  if (!stateName) throw new Error(`stateName required for ${templateKey}`)
  const state = project.states[stateName]
  vars.state_name = stateName
  vars.state_semantics = prompts.stateSemantics[stateName]
  vars.pose_note = state.poseNote

  if (templateKey === 'B2') {
    return { vars, opLabel: `重生 ${stateName} 靜態` }
  }
  if (templateKey === 'C') {
    vars.cell_notes_block = renderCellNotesBlock(state.notes)
    vars.loop_mode = state.loopMode
    return { vars, opLabel: `生 ${stateName} 動畫` }
  }
  if (templateKey === 'D') {
    if (cellIndex === undefined) throw new Error('cellIndex required for D')
    vars.cell_note = state.notes[cellIndex]
    vars.frame_index = String(cellIndex + 1)
    return { vars, opLabel: `重生 ${stateName} frame ${cellIndex + 1}` }
  }
  throw new Error(`unknown templateKey: ${templateKey}`)
}

/** Build the reference Blobs that go into the AI request for a given op. */
export async function buildReferences(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): Promise<Blob[]> {
  const store = useAppStore.getState()
  const { project } = store

  if (templateKey === 'B1' || templateKey === 'B2') {
    if (!project.characterRef) throw new Error('character ref required')
    return [project.characterRef]
  }
  if (templateKey === 'C') {
    if (!stateName) throw new Error('stateName required for C')
    const sb = project.states[stateName].staticBase
    if (!sb) throw new Error(`${stateName} has no staticBase`)
    // ANTI-JITTER + ANTI-CHROMA-LEAK: pre-build a 1024×1024 4×4 grid with
    // 16 identical copies of the staticBase, AND pre-fill the canvas with
    // the user's chroma color underneath. This gives the AI two anchors:
    //   1) layout / position lock — character is already positioned, the
    //      AI only paints micro-variations on top
    //   2) background lock — AI sees the magenta/green it should preserve,
    //      no ambiguity between "transparent" and "filled". This kills the
    //      pink-halo issue we got when feeding a transparent reference.
    const chromaHex = CHROMA_COLORS[store.chroma.key].hex
    const placeholderSheet = await buildPlaceholderSheetWithChromaBg(sb, chromaHex)
    return [placeholderSheet]
  }
  if (templateKey === 'D') {
    if (!stateName || cellIndex === undefined) throw new Error('stateName + cellIndex required for D')
    const state = project.states[stateName]
    if (!state.staticBase || !state.sheet) throw new Error(`${stateName} missing base or sheet`)
    // Same anti-chroma-leak treatment as C: pre-fill chroma BG behind every
    // reference cell before sending. AI sees solid magenta/green where the
    // BG is supposed to be, no ambiguity about transparent vs filled.
    const chromaHex = CHROMA_COLORS[store.chroma.key].hex
    const refs: Blob[] = [await fillBgWithChroma(state.staticBase, chromaHex)]
    if (cellIndex > 0) {
      const prevCell = await cropCell(state.sheet, cellIndex - 1)
      refs.push(await fillBgWithChroma(prevCell, chromaHex))
    }
    if (cellIndex < 15) {
      const nextCell = await cropCell(state.sheet, cellIndex + 1)
      refs.push(await fillBgWithChroma(nextCell, chromaHex))
    }
    return refs
  }
  throw new Error(`unknown templateKey: ${templateKey}`)
}

/** Apply chroma key to a generated Blob (or skip if user opted out via BYOG flag). */
export async function applyChroma(blob: Blob, skip = false): Promise<Blob> {
  if (skip) return blob
  const store = useAppStore.getState()
  const { chroma } = store
  return chromaKeyOut(blob, CHROMA_COLORS[chroma.key].rgb, chroma.tolerance)
}

/** After receiving a clean (transparent) Blob, apply per-op post-processing and update store. */
export async function applyResult(
  templateKey: TemplateKey,
  cleanedBlob: Blob,
  stateName?: StateName,
  cellIndex?: number,
  rawBlob?: Blob,  // optional: AI output BEFORE chroma+erode, stored for re-process
): Promise<void> {
  const store = useAppStore.getState()
  const erodePx = store.chroma.edgeErosionPx

  if (templateKey === 'B1') {
    // Split BOTH the cleaned 1536×1024 (for current static) AND the raw
    // 1536×1024 (for storage so re-chroma can re-process). 6 cells each.
    const cleanedCells = await splitGrid(cleanedBlob, 3, 2)
    const rawCells = rawBlob ? await splitGrid(rawBlob, 3, 2) : null
    for (let i = 0; i < STATE_NAMES.length; i++) {
      const name = STATE_NAMES[i]
      const rawStaticBase = rawCells ? await cropToSize(rawCells[i], 256, 256) : null
      const staticBaseNoErode = await cropToSize(cleanedCells[i], 256, 256)
      const staticBase = erodePx > 0 ? await erodeSingleCellEdges(staticBaseNoErode, erodePx) : staticBaseNoErode
      const placeholderSheet = await buildPlaceholderSheet(staticBase)
      store.updateState(name, {
        staticBase,
        rawStaticBase,
        sheet: placeholderSheet,
        rawSheet: null,  // B1 only made statics; sheets here are placeholder copies, not real animation rawSheet
        status: 'placeholder',
      })
    }
    return
  }

  if (!stateName) throw new Error(`stateName required for ${templateKey}`)

  if (templateKey === 'B2') {
    const rawStaticBase = rawBlob ? await cropToSize(rawBlob, 256, 256) : null
    const staticBaseNoErode = await cropToSize(cleanedBlob, 256, 256)
    const staticBase = erodePx > 0 ? await erodeSingleCellEdges(staticBaseNoErode, erodePx) : staticBaseNoErode
    const placeholderSheet = await buildPlaceholderSheet(staticBase)
    store.updateState(stateName, {
      staticBase,
      rawStaticBase,
      sheet: placeholderSheet,
      rawSheet: null,
      status: 'placeholder',
    })
    return
  }

  if (templateKey === 'C') {
    // Store raw 1024×1024 + processed 1024×1024 separately
    const eroded = erodePx > 0 ? await erodeCellEdges(cleanedBlob, erodePx) : cleanedBlob
    store.updateState(stateName, {
      sheet: eroded,
      ...(rawBlob ? { rawSheet: rawBlob } : {}),
      status: 'animated',
    })
    return
  }

  if (templateKey === 'D') {
    if (cellIndex === undefined) throw new Error('cellIndex required')
    const currentSheet = store.project.states[stateName].sheet
    const currentRawSheet = store.project.states[stateName].rawSheet
    if (!currentSheet) throw new Error(`${stateName} has no sheet`)
    const rawCellNoErode = await cropToSize(cleanedBlob, 256, 256)
    const newCell = erodePx > 0 ? await erodeSingleCellEdges(rawCellNoErode, erodePx) : rawCellNoErode
    const newSheet = await pasteIntoSheet(currentSheet, newCell, cellIndex)
    // Also paste the RAW cell into rawSheet so re-chroma can replay
    let newRawSheet = currentRawSheet
    if (currentRawSheet && rawBlob) {
      const rawNewCell = await cropToSize(rawBlob, 256, 256)
      newRawSheet = await pasteIntoSheet(currentRawSheet, rawNewCell, cellIndex)
    }
    store.updateState(stateName, {
      sheet: newSheet,
      ...(newRawSheet !== currentRawSheet ? { rawSheet: newRawSheet } : {}),
    })
    return
  }

  throw new Error(`unknown templateKey: ${templateKey}`)
}

/**
 * Re-apply chroma key + edge erosion to an existing state (no AI involved).
 *
 * Prefers the RAW AI output (state.rawSheet / state.rawStaticBase) as
 * source so the result is fully reversible — user can switch tolerance
 * or erosion px back and forth without losing data. Erosion is destructive
 * (eaten pixels are gone), so working from raw is the only way to bump
 * erosion DOWN after going UP.
 *
 * Falls back to current sheet/static (legacy / pre-raw-storage data) if
 * raw isn't available — in that case the operation IS destructive.
 */
export async function reapplyChromaToState(stateName: StateName): Promise<void> {
  const store = useAppStore.getState()
  const state = store.project.states[stateName]
  if (!state.sheet && !state.staticBase && !state.rawSheet && !state.rawStaticBase) {
    throw new Error(`${stateName} has no sheet or static base`)
  }
  const erodePx = store.chroma.edgeErosionPx

  // Source = raw (preferred) or current (legacy fallback)
  const sheetSource = state.rawSheet ?? state.sheet
  const staticSource = state.rawStaticBase ?? state.staticBase

  let cleanedSheet = sheetSource ? await applyChroma(sheetSource) : null
  let cleanedStatic = staticSource ? await applyChroma(staticSource) : null
  if (erodePx > 0) {
    if (cleanedSheet) cleanedSheet = await erodeCellEdges(cleanedSheet, erodePx)
    if (cleanedStatic) cleanedStatic = await erodeSingleCellEdges(cleanedStatic, erodePx)
  }
  store.updateState(stateName, {
    ...(cleanedSheet ? { sheet: cleanedSheet } : {}),
    ...(cleanedStatic ? { staticBase: cleanedStatic } : {}),
  })
}

/** Full end-to-end: render → provider → chroma → post-process → store. */
export async function runGeneration(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const store = useAppStore.getState()
  const template = store.prompts.templates[templateKey]
  const { vars } = buildPromptContext(templateKey, stateName, cellIndex)
  const rendered = appendChromaSuffix(render(template, vars), store.chroma.key)

  return runGenerationWithPrompt(templateKey, rendered, stateName, cellIndex)
}

/** Same as runGeneration but with an already-rendered prompt (used when user edits via modal). */
export async function runGenerationWithPrompt(
  templateKey: TemplateKey,
  finalPrompt: string,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const store = useAppStore.getState()
  const provider = buildProvider(store.provider)
  const references = await buildReferences(templateKey, stateName, cellIndex)
  const raw = await provider.generateImage({
    prompt: finalPrompt,
    references,
    outputSize: OUTPUT_SIZE[templateKey],
  })
  const cleaned = await applyChroma(raw)
  await applyResult(templateKey, cleaned, stateName, cellIndex, raw)
}

export { OUTPUT_SIZE }
