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
SILHOUETTE LOCK — character-anatomy-agnostic positional constraints:
═══════════════════════════════════════════════════════════════════

The character may be ANY shape — humanoid, animal, plant, robot,
blob, abstract creature, slime, gem, etc. Whatever the REFERENCE
image shows is the source of truth. Do NOT add anatomy that isn't
in the reference (no inventing a face on a faceless blob, no adding
arms to a plant, etc.). Match the reference's design exactly.

Per-cell positional rules (apply regardless of what the character is):

  • The character's silhouette outline OCCUPIES THE SAME REGION of
    the 256×256 cell in every one of the 16 cells. Imagine tracing
    the silhouette of cell 1 on tracing paper — that trace should
    overlap the silhouette of every other cell within a few pixels.

  • The character's BOUNDING BOX (smallest rect enclosing all opaque
    pixels) has the SAME size and the SAME position across all 16
    cells. Width within ±3 px, height within ±3 px, centroid within
    ±3 px.

  • The character's SCALE matches the reference. If the reference
    is rendered at 60% cell coverage, every cell uses 60% coverage.
    No "zoom in" cells. No "zoom out" cells.

  • The character's FACING is the same direction in every cell.
    Do NOT mirror left-to-right.

What MAY change between cells (only subtle motion appropriate to the
character's form — if the character has no eyes, skip the blink; if
it has no limbs, skip the gesture):

  • Blink (only if the character has eyes — 1-2 cells closed)
  • Breath / pulse / glow (a 1-3 px wobble of the silhouette, OR
    a small color/glow intensity shift if the character is e.g.
    a magic orb or glowing gem)
  • Hair / leaves / antenna / cape / tail / aura drift by 1-3 px
  • One small accent appropriate to "{{state_name}}" — e.g. a
    tail wag, a leaf rustle, a finger twitch, a slight tilt

Identical design, identical color palette, identical decorations.
The animation is just the character "alive but staying in place".

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
