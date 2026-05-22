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
  // Treat the uploaded blob as the "raw" so re-chroma can replay from it.
  // If user opted to skip chroma, the upload is already transparent —
  // store as raw too; re-chroma will be a no-op on transparent pixels.
  await applyResult(templateKey, cleaned, stateName, cellIndex, uploaded)
}
