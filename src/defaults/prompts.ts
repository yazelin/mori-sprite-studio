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

  C: `Create a single 4-row × 4-column grid sprite sheet (1024×1024 total, each cell exactly 256×256) showing a tiny 16-frame animation loop of state "{{state_name}}" for the same character as the reference.

THIS IS A SPRITE-SHEET ANIMATION, NOT 16 DIFFERENT ILLUSTRATIONS.
Think of it like a flipbook: the character barely moves between adjacent
cells. Most pixels in cell N should be IDENTICAL to cell N+1 — only a
small region (hair drift, eyelid for blink, chest for breath, hand for
gesture) changes by a few pixels at a time.

LAYOUT — cells read in row-major order (left-to-right, top-to-bottom),
each cell is one animation frame:

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
  - "loop": frame 16 must smoothly connect back to frame 1 (no visible jump)
  - "one-shot": frame 16 is the final pose, frames 1-16 progress toward it

CRITICAL POSITIONAL LOCK — every cell must match these:
- Character's HEAD CENTER at the SAME (x,y) position inside each cell
- Character's FEET / SEAT at the SAME (x,y) position inside each cell
- IDENTICAL overall scale (head size, body size, total silhouette area)
- IDENTICAL crop / framing — what's inside frame stays inside frame
- IDENTICAL hair length, identical clothing, identical color palette
- IDENTICAL facing direction (do NOT mirror)

Only these things may change between adjacent frames:
- Eyelids open/closed (blink — usually 1-2 frames closed in the loop)
- Chest position by 2-4 px (breath in/out)
- Hair tip drift by 1-3 px (idle sway)
- Single hand/finger micro-gesture for "{{state_name}}"-specific motion

EVERYTHING ELSE STAYS IDENTICAL. The animation should look subtle — if
you flipped through the cells fast, the character would APPEAR STILL with
only quiet motion (breath / blink). It should NOT look like 16 different
character poses.

FRAME-BY-FRAME HINTS (empty entries = hold steady; AI fills with the
smallest possible interpolation between neighboring frames):
{{cell_notes_block}}

OUTPUT RULES — strictly enforced:
- Final image is ONE seamless 4×4 grid. NO visible borders, gutters, dividers, lines, frames, separators, or numbers between cells. NO frame labels (1..16) drawn on the image. The grid diagram above is for YOU as instructions, NOT to be painted.
- No drop shadows, no ground plane, no scenery, no extra props.
- Character pixel position must vary by less than 8 pixels across all 16 frames (this is an animation hold, not a re-staging).`,

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
