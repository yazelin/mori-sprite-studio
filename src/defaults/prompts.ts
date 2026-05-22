import type { TemplateKey } from '@/types/prompts'

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  B1: `Create a single 3-column × 2-row grid image: 6 equal-size square cells (each 512×512) of the same character from the reference image, total canvas 1536×1024.

LAYOUT — each cell shows EXACTLY the pose mapped to its letter; do not swap, merge, or skip cells:

\`\`\`
+------+------+------+
|  A   |  B   |  C   |
+------+------+------+
|  D   |  E   |  F   |
+------+------+------+
\`\`\`

{{state_descriptions}}

CHARACTER IDENTITY (persists across all 6 cells):
The character must be recognizably the same person/creature across all 6 cells — same hair colour & shape, same clothing colour, same face features, same proportions. Only the pose / expression / hand position changes between cells.

CELL FRAMING (every cell):
- Subject is the upper body or full body, fully inside the cell with comfortable margin around it.
- Character CENTERED horizontally and vertically within its 512×512 cell.
- Same overall scale across all 6 cells — do NOT zoom in on the face for some cells and out for others.

OUTPUT RULES — strictly enforced:
- Final image is ONE seamless 3×2 grid. NO visible borders, gutters, dividers, lines, frames, separators, or any colored stripes between cells. NO letter labels (A..F) drawn on the image. The grid diagram above is for YOU as instructions, NOT to be painted into the output.
- No drop shadows, no soft shadows under feet, no ground plane, no platform, no scenery.
- Two cells MUST NOT share the exact same pose — every cell visibly differs in expression, hand position, body language.
- The character must be obviously the same person/creature from the reference in all 6 cells.`,

  B2: `A single character pose for state "{{state_name}}", from the reference image. Character CENTERED in a 1024×1024 canvas with comfortable margin.

State semantics: {{state_semantics}}
Pose hint: {{pose_note}}

OUTPUT RULES:
- ONE full character image. No grid, no panels, no borders.
- Character must be recognizably the same as the reference (same hair, clothes, face features, proportions).
- No drop shadows, no ground plane, no scenery.`,

  C: `Create a single 4-row × 4-column grid sprite sheet (1024×1024 total, each cell 256×256) showing a 16-frame animation of state "{{state_name}}" for the same character as the reference.

LAYOUT — each cell is one animation frame; cells are read in row-major order (left-to-right, top-to-bottom):

\`\`\`
+----+----+----+----+
|  1 |  2 |  3 |  4 |
+----+----+----+----+
|  5 |  6 |  7 |  8 |
+----+----+----+----+
|  9 | 10 | 11 | 12 |
+----+----+----+----+
| 13 | 14 | 15 | 16 |
+----+----+----+----+
\`\`\`

State pose: {{pose_note}}
Loop mode: {{loop_mode}}
  - If "loop": frame 1 and frame 16 must connect seamlessly (subtle position so the loop is invisible)
  - If "one-shot": frame 16 is the final stopping pose

FRAME-BY-FRAME HINTS (empty entries = AI fills with smooth in-between interpolation):
{{cell_notes_block}}

CHARACTER IDENTITY (persists across all 16 frames):
Same character as the reference — identical hair, clothes, proportions, color palette. Only subtle pose / breath / blink / gesture changes between frames.

OUTPUT RULES — strictly enforced:
- Final image is ONE seamless 4×4 grid. NO visible borders, gutters, dividers, lines, frames, separators, or numbers between cells. NO frame labels (1..16) drawn on the image. The grid diagram above is for YOU as instructions, NOT to be painted.
- Each cell is the SAME framing (don't zoom in/out across frames). Character centered, identical scale.
- Frame-to-frame changes are SMALL (this is an animation loop, not 16 different poses).
- No drop shadows, no ground plane, no scenery, no extra props that change between frames.`,

  D: `A single 256×256 frame showing the reference character in state "{{state_name}}", positioned as an intermediate pose between the previous and next frames provided.

State semantics: {{state_semantics}}
Frame index: {{frame_index}} of 16
Frame note: {{cell_note}}

You receive 3 reference images: [1] static base pose, [2] previous frame, [3] next frame. Output ONE frame that blends visually with the neighbors so the animation looks smooth.

OUTPUT RULES:
- ONE full character image, no grid, no borders, no frames.
- Same framing / scale / character identity as the references.
- No drop shadows, no ground plane, no scenery.`,
}

export const CHROMA_SUFFIX_TEMPLATE = `Background: pure solid {{chroma_color}} (#{{chroma_hex}}) covering 100% of the canvas edge-to-edge. No shadow, no gradient, no noise, no texture, no other colors. The character must NOT contain this exact color anywhere — not on clothes, hair, eyes, accessories, highlights, reflected light, or shadows. If the reference uses any color too close to #{{chroma_hex}}, substitute with a clearly different color. Pixels matching #{{chroma_hex}} will be programmatically removed by chroma-key, so any accidental matches in the character become holes.`
