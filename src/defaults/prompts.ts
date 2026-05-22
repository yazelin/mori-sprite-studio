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

MENTAL MODEL — THIS IS ONE CONTINUOUS ANIMATION, NOT 4 ROWS OF SCENES.

Imagine a single camera locked on a tripod, looking at the character.
The camera takes 16 photos in 3 seconds. The character barely moves —
they breathe, they blink, their hair drifts. NOTHING ELSE CHANGES.

The 4×4 layout is purely a STORAGE format (16 photos laid out in a
grid so we can fit them in one PNG). It is NOT 4 different scenes
stacked vertically. It is NOT 4 panels of a comic. There are no
"chapters", no row breaks, no narrative pauses. All 16 cells are the
SAME camera angle on the SAME stage capturing the SAME tiny loop.

LAYOUT — cells read in row-major order (left-to-right, top-to-bottom):

\`\`\`
+----+----+----+----+
|  1 |  2 |  3 |  4 |   ← row 1 = first quarter of the loop
+----+----+----+----+
|  5 |  6 |  7 |  8 |   ← row 2 = second quarter
+----+----+----+----+
|  9 | 10 | 11 | 12 |   ← row 3 = third quarter
+----+----+----+----+
| 13 | 14 | 15 | 16 |   ← row 4 = fourth quarter (connects back to 1)
+----+----+----+----+
\`\`\`

Row 4 must visually pick up where row 1 left off — there is no
"final scene" at the bottom and no "intro scene" at the top.

State pose: {{pose_note}}
Loop mode: {{loop_mode}}
  - "loop": frame 16 → frame 1 must be seamless (no visible jump)
  - "one-shot": frame 16 is the final pose, frames 1-16 progress toward it

═══════════════════════════════════════════════════════════════════
CRITICAL FRAMING LOCK — copy the reference photo's framing exactly:
═══════════════════════════════════════════════════════════════════

The single reference image you receive is the FRAMING TEMPLATE.
Whatever you can see of the character in that reference — that
EXACT same amount must be visible in every one of the 16 cells.

Reference shows head + shoulders only? Every cell shows head +
shoulders only. Reference shows head-to-waist? Every cell shows
head-to-waist. Do NOT zoom in. Do NOT zoom out. Do NOT pull the
camera back to reveal more of the body in some cells. Do NOT crop
closer in other cells.

PIXEL-LEVEL ANCHORS (compare your cell to the reference):
- HEAD SIZE: the head should occupy the SAME percentage of cell
  height as in the reference (e.g. if head takes 45% of reference
  height, head takes 45% of every cell's height — exact)
- EYE SIZE: eyes are the same size as in the reference. NOT smaller,
  NOT bigger. If eyes shrink, you zoomed out — STOP and re-frame.
- FACE WIDTH: face fills the same horizontal width as the reference
- BODY VISIBILITY: show the SAME body parts as the reference — no
  more, no less. If the reference shows waist-up, every cell shows
  waist-up. Don't suddenly include legs/feet in some cells.
- VERTICAL POSITION: character's eyes at the same Y, chin at same Y,
  shoulders at same Y as the reference

COMMON FAILURE TO AVOID:
The AI tends to "vary the camera distance" between cells to make the
animation feel more dynamic — drawing row 1 zoomed-in (eyes big,
head fills cell) then row 2 zoomed-out (smaller head, longer body
visible, eyes look smaller). THIS IS WRONG. The camera is LOCKED on
a tripod. Same focal length. Same distance. EVERY CELL.

If the character's eyes look smaller in some cell, you zoomed out —
redo that cell with the reference's exact head-fills-cell ratio.

If the body looks longer in some cell, you're showing more of the
body than the reference shows — crop tighter to match the reference.

Identical hair length, identical clothing, identical palette,
identical facing direction (DO NOT mirror).

Only these things may change between cells:
- Eyelids open/closed (blink — usually 1-2 cells closed in loop)
- Chest expansion by 2-4 px (breath in/out)
- Hair tip drift by 1-3 px (gentle sway)
- One small accent like a finger twitch or single-eye glance for "{{state_name}}"

FRAME-BY-FRAME HINTS (empty entries = hold steady from previous frame):
{{cell_notes_block}}

OUTPUT RULES:
- ONE seamless 4×4 grid. NO visible borders, gutters, dividers, lines,
  frames, separators, or numbers between cells. NO frame labels (1..16)
  painted on the output. The diagram above is for YOU, not for paint.
- No drop shadows, no ground plane, no scenery, no extra props.
- Character height variance across all 16 cells: less than 8 pixels.
- If unsure between "draw two slightly different cells" vs "draw two
  identical cells" — pick IDENTICAL. Less motion is better than jitter.`,

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
