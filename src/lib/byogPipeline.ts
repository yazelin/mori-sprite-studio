import type { TemplateKey } from '@/types/prompts'
import type { StateName } from '@/types/project'
import { applyChroma, applyResult } from './generationFlow'

/**
 * Take a user-uploaded image (BYOG path), apply chroma (unless skipped),
 * then run through the same post-processing as the API path.
 */
export async function processByogUpload(
  uploaded: Blob,
  templateKey: TemplateKey,
  skipChromaKey: boolean,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const cleaned = await applyChroma(uploaded, skipChromaKey)
  await applyResult(templateKey, cleaned, stateName, cellIndex)
}
