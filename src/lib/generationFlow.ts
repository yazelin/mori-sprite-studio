import type { StateName } from '@/types/project'
import { STATE_NAMES, REQUIRED_STATE_NAMES } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import type { OutputSize } from '@/types/provider'
import { useAppStore } from '@/store'
import { buildProvider } from '@/providers'
import { chromaKeyOut } from './chromaKey'
import { chromaInfo } from './colorUtils'
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
  reorderCells,
} from './imageOps'
import { render, renderCellNotesBlock, renderStateDescriptions } from './promptRenderer'
import { appendChromaSuffix } from './promptBuilder'

const OUTPUT_SIZE: Record<TemplateKey, OutputSize> = {
  B1: '1536x1024',
  B2: '1024x1024',
  C:  '1024x1024',
  D:  '1024x1024',
  W:  '1024x1024',
  Dr: '1024x1024',
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
  if (templateKey === 'W' || templateKey === 'Dr') {
    // Walking / Dragging share the C-style context but no cell_notes /
    // loop_mode (the templates have hardcoded cycle structures).
    return { vars, opLabel: `生 ${stateName} 動畫(獨立 pipeline)` }
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

  if (templateKey === 'B1') {
    if (!project.characterRef) throw new Error('character ref required')
    return [project.characterRef]
  }
  if (templateKey === 'B2') {
    if (!project.characterRef) throw new Error('character ref required')
    if (!stateName) throw new Error('stateName required for B2')
    // Identity anchor: original characterRef (the source of truth for
    // hair / clothes / face / proportions). PLUS every OTHER state's
    // current staticBase so the AI sees the same character rendered in
    // multiple poses — this constrains it from re-imagining the outfit
    // when re-rolling a single state's static.
    const chromaHex = chromaInfo(store.chroma).hex
    const refs: Blob[] = [project.characterRef]
    for (const name of STATE_NAMES) {
      if (name === stateName) continue
      const sb = project.states[name]?.staticBase
      if (sb) refs.push(await fillBgWithChroma(sb, chromaHex))
    }
    return refs
  }
  if (templateKey === 'W' || templateKey === 'Dr') {
    // Walking / Dragging:  STANDALONE pipeline (no pre-tiling).
    //
    // References (mirrors how C template anchors identity — that's why
    // sleeping / done / etc preserve Mori's outfit while W/Dr drift):
    //   1. character ref (canonical identity portrait)
    //   2. W/Dr OWN static base (neutral full-body standing per the
    //      updated walking/dragging semantics — gives feet + proportions
    //      anchor without locking gait pose)
    //   3. Other 6 states' static bases (idle/sleeping/recording/etc) —
    //      strong identity anchors. AI sees "this character in 6 other
    //      poses, all with same outfit / hair / accessories", making
    //      identity drift much harder than with just 2 refs.
    //
    // This brings W/Dr ref count up to ~8, matching what C template uses
    // for the other 6 states. We tried minimal (just character ref) and
    // identity drifted; adding back the multi-state anchor should match
    // the identity preservation that other states get from C template.
    if (!project.characterRef) throw new Error('character ref required')
    if (!stateName) throw new Error('stateName required')
    const chromaHex = chromaInfo(store.chroma).hex
    const refs: Blob[] = [project.characterRef]
    const ownSb = project.states[stateName].staticBase
    if (ownSb) refs.push(await fillBgWithChroma(ownSb, chromaHex))
    // Identity anchors: every OTHER state's static base (chroma-filled),
    // skipping the W/Dr own (already added above)
    for (const name of STATE_NAMES) {
      if (name === stateName) continue
      const sb = project.states[name]?.staticBase
      if (sb) refs.push(await fillBgWithChroma(sb, chromaHex))
    }
    return refs
  }
  if (templateKey === 'C') {
    if (!stateName) throw new Error('stateName required for C')
    const sb = project.states[stateName].staticBase
    if (!sb) throw new Error(`${stateName} has no staticBase`)
    // Three anchors for C:
    //   1) Pre-tiled 4×4 placeholder sheet (this state's staticBase × 16,
    //      pre-filled with chroma BG). Locks layout + position + background.
    //   2) Other states' staticBases (chroma-filled). Identity anchor — AI
    //      sees the same character rendered in multiple poses so it can't
    //      drift the outfit / hair / proportions when interpreting dramatic
    //      state semantics.
    //   3) Original characterRef. Final identity ground-truth.
    const chromaHex = chromaInfo(store.chroma).hex
    const placeholderSheet = await buildPlaceholderSheetWithChromaBg(sb, chromaHex)
    const refs: Blob[] = [placeholderSheet]
    for (const name of STATE_NAMES) {
      if (name === stateName) continue
      const otherSb = project.states[name]?.staticBase
      if (otherSb) refs.push(await fillBgWithChroma(otherSb, chromaHex))
    }
    if (project.characterRef) refs.push(project.characterRef)
    return refs
  }
  if (templateKey === 'D') {
    if (!stateName || cellIndex === undefined) throw new Error('stateName + cellIndex required for D')
    const state = project.states[stateName]
    if (!state.staticBase || !state.sheet) throw new Error(`${stateName} missing base or sheet`)
    // Same anti-chroma-leak treatment as C: pre-fill chroma BG behind every
    // reference cell before sending. AI sees the selected solid key color where the
    // BG is supposed to be, no ambiguity about transparent vs filled.
    const chromaHex = chromaInfo(store.chroma).hex
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
  return chromaKeyOut(blob, chromaInfo(chroma).rgb, chroma.tolerance)
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
    // B1 grid is 3×2 = the 6 required states only; walking/dragging get statics via B2.
    for (let i = 0; i < REQUIRED_STATE_NAMES.length; i++) {
      const name = REQUIRED_STATE_NAMES[i]
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

  if (templateKey === 'C' || templateKey === 'W' || templateKey === 'Dr') {
    // Same post-processing for all 'animation sheet' outputs.
    // W (walking) and Dr (dragging) produce the same 1024×1024 4×4 sheet
    // format as C, just via a different prompt/pipeline upstream.
    // codex-image returns 1254×1254 for a 1024 request; pasteIntoSheet / exports assume 1024.
    const sized = await cropToSize(cleanedBlob, 1024, 1024)
    const eroded = erodePx > 0 ? await erodeCellEdges(sized, erodePx) : sized
    store.updateState(stateName, {
      sheet: eroded,
      ...(rawBlob ? { rawSheet: await cropToSize(rawBlob, 1024, 1024) } : {}),
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
  const rendered = appendChromaSuffix(render(template, vars), store.chroma)

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
  // Notify any quota indicators / UI that a generation just finished
  // so they can refresh their counters without waiting for poll interval.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('generation-finished'))
  }
}

/** Generate a neutral base pose for a user-authored action. */
export async function runCustomActionBase(actionId: string): Promise<void> {
  const store = useAppStore.getState()
  const project = store.project
  const action = (project.customActions ?? []).find((item) => item.id === actionId)
  if (!action) throw new Error('找不到這個自訂動作')
  if (!project.characterRef) throw new Error('請先在專案設定上傳角色參考圖')
  if (!action.name.trim() || !action.description.trim()) throw new Error('請先填寫動作名稱和描述')

  const vars = {
    state_name: action.name.trim() || 'custom action',
    state_semantics: action.description.trim() || 'A clear neutral pose that can transition into the requested action.',
    pose_note: action.poseNote.trim() || 'Show the full character centered, with a clear silhouette.',
  }
  const prompt = appendChromaSuffix(render(store.prompts.templates.B2, vars), store.chroma)
  const chromaHex = chromaInfo(store.chroma).hex
  const references: Blob[] = [project.characterRef]
  for (const name of STATE_NAMES) {
    const staticBase = project.states[name]?.staticBase
    if (staticBase) references.push(await fillBgWithChroma(staticBase, chromaHex))
  }

  const provider = buildProvider(store.provider)
  const raw = await provider.generateImage({ prompt, references, outputSize: '1024x1024' })
  const cleaned = await applyChroma(raw)
  const rawStaticBase = await cropToSize(raw, 256, 256)
  const staticNoErode = await cropToSize(cleaned, 256, 256)
  const erodePx = store.chroma.edgeErosionPx
  const staticBase = erodePx > 0 ? await erodeSingleCellEdges(staticNoErode, erodePx) : staticNoErode
  const sheet = await buildPlaceholderSheet(staticBase)

  useAppStore.getState().updateCustomAction(actionId, {
    staticBase,
    rawStaticBase,
    sheet,
    rawSheet: null,
    status: 'placeholder',
  })
  announceGenerationFinished()
}

/** Animate a custom action from its generated base with action-specific motion rules. */
export async function runCustomActionAnimation(actionId: string): Promise<void> {
  const store = useAppStore.getState()
  const project = store.project
  const action = (project.customActions ?? []).find((item) => item.id === actionId)
  if (!action) throw new Error('找不到這個自訂動作')
  if (!action.staticBase) throw new Error('請先生成這個動作的 base')
  if (!project.characterRef) throw new Error('請先在專案設定上傳角色參考圖')
  if (!action.name.trim() || !action.description.trim()) throw new Error('請先填寫動作名稱和描述')

  const chromaHex = chromaInfo(store.chroma).hex
  const referenceSheet = await buildPlaceholderSheetWithChromaBg(action.staticBase, chromaHex)
  const references: Blob[] = [referenceSheet]
  for (const name of STATE_NAMES) {
    const staticBase = project.states[name]?.staticBase
    if (staticBase) references.push(await fillBgWithChroma(staticBase, chromaHex))
  }
  references.push(project.characterRef)

  const animationTemplate = `Create a 1024×1024 sprite sheet containing a 4×4 grid of sixteen 256×256 frames, in row-major order.

Animate the custom action "{{action_name}}" from the supplied base-pose grid.
Action description: {{action_description}}
Starting-pose guidance: {{pose_note}}
Playback mode: {{playback_mode}}
{{playback_instructions}}

The first reference is a grid of sixteen identical copies of the same base pose. Treat it as the exact starting pose and preserve its framing. Other references show the canonical character identity.

Across the sixteen frames, make the described action clearly readable. Use visible, smooth progression in the body, arms, hands, legs, head, and expression when appropriate; do not reduce the action to tiny breathing changes or sixteen nearly identical poses. Keep the character centered at a consistent scale, fully inside each cell with comfortable margins.

Preserve the exact same character in every frame: face, hair, clothing, colors, proportions, accessories, and art style. Do not add or remove props, clothing, or accessories. Do not change camera angle or crop the character. Do not draw cell borders, gutters, labels, or frame numbers.

Fill the background with the selected solid chroma-key color. No scenery, ground plane, or shadows.`
  const playbackInstructions = action.loopMode === 'loop'
    ? 'Create a continuous repeating gesture. Frame 1 begins at the supplied base pose; frame 16 must connect smoothly back to frame 1. Show the action throughout the loop, with natural pauses only when they fit the described action.'
    : 'Create a one-shot motion arc. Frame 1 begins at the supplied base pose, the middle frames perform the described action, and frame 16 shows its natural ending pose. The Player returns to the normal pet state after the sheet plays once.'
  const rendered = render(animationTemplate, {
    action_name: action.name.trim(),
    action_description: action.description.trim(),
    pose_note: action.poseNote.trim() || 'Use the supplied base pose as the starting pose.',
    playback_mode: action.loopMode,
    playback_instructions: playbackInstructions,
  })
  const prompt = appendChromaSuffix(rendered, store.chroma)
  const provider = buildProvider(store.provider)
  const raw = await provider.generateImage({ prompt, references, outputSize: '1024x1024' })
  const cleaned = await applyChroma(raw)
  const sized = await cropToSize(cleaned, 1024, 1024)
  const erodePx = store.chroma.edgeErosionPx
  const sheet = erodePx > 0 ? await erodeCellEdges(sized, erodePx) : sized
  const rawSheet = await cropToSize(raw, 1024, 1024)

  useAppStore.getState().updateCustomAction(actionId, {
    sheet,
    rawSheet,
    status: 'animated',
  })
  announceGenerationFinished()
}

/** Move one generated custom-action frame to a different playback position. */
export async function reorderCustomActionFrames(
  actionId: string,
  permutation: readonly number[],
): Promise<void> {
  const store = useAppStore.getState()
  const action = (store.project.customActions ?? []).find((item) => item.id === actionId)
  if (!action?.sheet) throw new Error('找不到已生成的自訂動作影格')

  const sheet = await reorderCells(action.sheet, permutation)
  const patch: Partial<typeof action> = { sheet }
  if (action.rawSheet) patch.rawSheet = await reorderCells(action.rawSheet, permutation)
  useAppStore.getState().updateCustomAction(actionId, patch)
}

/** Regenerate one frame with a correction while preserving the other 15 frames. */
export async function regenerateCustomActionFrame(
  actionId: string,
  frameIndex: number,
  correction: string,
): Promise<void> {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex > 15) {
    throw new Error('影格位置必須介於 1 到 16')
  }
  if (!correction.trim()) throw new Error('請先填寫這一格的修正說明')

  const store = useAppStore.getState()
  const project = store.project
  const action = (project.customActions ?? []).find((item) => item.id === actionId)
  if (!action?.sheet || !action.staticBase) throw new Error('請先完成自訂動作動畫')
  if (!project.characterRef) throw new Error('請先在專案設定上傳角色參考圖')

  const chromaHex = chromaInfo(store.chroma).hex
  const references: Blob[] = [await fillBgWithChroma(action.staticBase, chromaHex)]
  const referenceLabels = ['Reference image 1 is the generated neutral base pose.']
  let referenceNumber = 2
  const previousIndex = frameIndex > 0 ? frameIndex - 1 : action.loopMode === 'loop' ? 15 : -1
  const nextIndex = frameIndex < 15 ? frameIndex + 1 : action.loopMode === 'loop' ? 0 : -1
  if (previousIndex >= 0) {
    references.push(await fillBgWithChroma(await cropCell(action.sheet, previousIndex), chromaHex))
    referenceLabels.push(`Reference image ${referenceNumber} is the previous animation frame.`)
    referenceNumber += 1
  }
  if (nextIndex >= 0) {
    references.push(await fillBgWithChroma(await cropCell(action.sheet, nextIndex), chromaHex))
    referenceLabels.push(`Reference image ${referenceNumber} is the next animation frame.`)
    referenceNumber += 1
  }
  references.push(project.characterRef)
  referenceLabels.push(`Reference image ${referenceNumber} is the canonical character identity reference.`)
  const neighborGuidance = referenceLabels.join('\n')
  const prompt = appendChromaSuffix(`Create one square sprite frame for a 4×4 character animation sheet. Do not create a grid or multiple frames.

Action: {{action_name}}
Overall action: {{action_description}}
Starting-pose guidance: {{pose_note}}
This is frame {{frame_number}} of 16, in playback order.
{{neighbor_guidance}}

Correction for this frame (follow this first while preserving the action):
{{correction}}

Use the supplied base pose and neighboring frames to make this frame fit the motion naturally. Preserve the exact character identity, face, hair, clothing, colors, proportions, accessories, and art style. Keep the complete character centered at the same scale with comfortable margins. Show only this one pose. No scenery, ground plane, shadows, labels, frame numbers, borders, or gutters. Fill the entire background with the selected solid chroma color.`, store.chroma)
  const rendered = render(prompt, {
    action_name: action.name.trim(),
    action_description: action.description.trim(),
    pose_note: action.poseNote.trim() || 'Use the generated base pose as the action starting point.',
    frame_number: String(frameIndex + 1),
    neighbor_guidance: neighborGuidance,
    correction: correction.trim(),
  })
  const provider = buildProvider(store.provider)
  const raw = await provider.generateImage({ prompt: rendered, references, outputSize: '1024x1024' })
  const cleaned = await applyChroma(raw)
  const cleanedCell = await cropToSize(cleaned, 256, 256)
  const erodePx = store.chroma.edgeErosionPx
  const frame = erodePx > 0 ? await erodeSingleCellEdges(cleanedCell, erodePx) : cleanedCell
  const sheet = await pasteIntoSheet(action.sheet, frame, frameIndex)

  const patch: Partial<typeof action> = { sheet }
  if (action.rawSheet) {
    patch.rawSheet = await pasteIntoSheet(action.rawSheet, await cropToSize(raw, 256, 256), frameIndex)
  }
  useAppStore.getState().updateCustomAction(actionId, patch)
  announceGenerationFinished()
}

function announceGenerationFinished() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('generation-finished'))
  }
}

export { OUTPUT_SIZE }
