import type { TemplateKey } from '@/types/prompts'

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  B1: `A 3-column × 2-row grid layout (3 wide, 2 tall, total 1536×1024) showing 6 poses of the same character on solid green background. Each cell is 512×512 and contains the full character.

The 6 poses, in row-major order (left-to-right, top-to-bottom):
{{state_descriptions}}

Style: Match the reference character exactly — same hair, same clothes, same color palette. Only the pose / expression changes.`,

  B2: `A single character pose for state "{{state_name}}", on solid green background. Character centered in a 1024×1024 area.

State semantics: {{state_semantics}}
Pose hint: {{pose_note}}

Style: Match the reference character exactly.`,

  C: `A 4×4 grid sprite sheet (1024×1024 total, each cell 256×256) showing a 16-frame animation of state "{{state_name}}" for the reference character.

Frame order: left-to-right, top-to-bottom (row-major).
Pose: {{pose_note}}
Loop mode: {{loop_mode}}
  - If "loop": frame 1 and frame 16 must connect seamlessly
  - If "one-shot": frame 16 is the final pose

Frame-by-frame hints (空白表示 AI 自由發揮中間幀):
{{cell_notes_block}}

Solid green background.`,

  D: `A single 256×256 frame, intermediate pose between the previous and next frames provided (3 reference images: static base, previous frame, next frame).

State: {{state_name}} - {{state_semantics}}
Frame index: {{frame_index}} of 16
Frame note: {{cell_note}}

Must blend visually with neighbors (smooth animation transition).
Solid green background.`,
}

export const CHROMA_SUFFIX_TEMPLATE = `Background: pure solid {{chroma_color}} (#{{chroma_hex}}) covering 100% of the canvas edge-to-edge. No shadow, no gradient, no noise, no texture. The character must NOT contain this exact color anywhere.`
