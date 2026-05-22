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

  C: `This is a classic 2D game SPRITE ANIMATION SHEET for a desktop mascot / desktop pet character (think: Live2D rest animation, Stardew Valley NPC idle, Animal Crossing villager idle, Tamagotchi screen pet). Same convention as any retro game sprite sheet.

OUTPUT: ONE 1024×1024 image arranged as a 4×4 grid of 256×256 cells. Each cell is one animation frame. 16 frames total, played in row-major order (left to right, top to bottom) to form a tiny idle-loop animation of state "{{state_name}}" for the reference character.

KEY CONCEPT — sprite animation properties:
- The character is FIXED IN POSITION in the cell. Like a Tamagotchi pet on a screen, they do not move around, they do not zoom in/out, they do not change camera angle. Only their tiny gestures animate.
- Every cell shows the character at the IDENTICAL pose / position / size / framing as every other cell — they only differ by small animation details (blink, breath, hair drift).
- This is NOT a comic strip. NOT a storyboard. NOT 16 different scenes. It is the same single drawing repeated 16 times with tiny per-frame variations.

LAYOUT (cells read in row-major order, but the rows have NO narrative meaning — they're just storage):

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
  - "loop": frame 16 → frame 1 must be seamless
  - "one-shot": frame 16 is the final pose

═══════════════════════════════════════════════════════════════════
ABSOLUTE PIXEL ANCHORS — every one of the 16 cells must match these:
═══════════════════════════════════════════════════════════════════

Each cell is 256×256 pixels. Inside every cell, the character must be
drawn so these pixel anchors are IDENTICAL in all 16 cells:

  • Character's HEAD top edge at pixel y ≈ 30
  • Character's EYE LINE at pixel y ≈ 100
  • Character's CHIN at pixel y ≈ 160
  • Character's SHOULDER LINE at pixel y ≈ 175
  • Character's BOTTOM edge of drawing at pixel y ≈ 250
  • Character's HORIZONTAL CENTER at pixel x ≈ 128
  • Character's FACE WIDTH ≈ 100 pixels (eye-corner to eye-corner ≈ 70 px)
  • Character's TOTAL silhouette HEIGHT ≈ 220 pixels

These are the SAME anchors as the reference image. The reference IS
the framing template — match its proportions exactly in every cell.

If your cell drawing makes the head look smaller than the reference,
the silhouette will violate the "head at y≈30 + chin at y≈160" anchor —
that's WRONG. Re-do the cell so the head occupies the same vertical
range as the reference image.

If your cell drawing makes the body extend below y≈250, you have
drawn MORE of the body than the reference shows — that's WRONG.
Limit the drawing to what the reference shows.

There is NO scenario where row 4 cells differ from row 1 cells in
character size or character position. The reference photo's pose is
copied 16 times with only these tiny variations:

  • Eyelids open/closed (blink — 1-2 cells of the loop have eyes shut)
  • Chest line shifts up by 1-3 px (breath in/out cycle)
  • Hair tips drift by 1-2 px
  • One subtle gesture for "{{state_name}}"

Identical hair length, identical clothing, identical color palette,
identical facing direction (DO NOT mirror left-to-right).

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
