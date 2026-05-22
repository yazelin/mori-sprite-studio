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

  C: `You are given a 1024×1024 PNG that is ALREADY a 4×4 grid of 16 identical 256×256 cells. All 16 cells contain the EXACT same character at the EXACT same position, size, and pose.

Your task: take this pre-built grid and ADD tiny per-cell animation variations so it becomes a working sprite animation sheet for state "{{state_name}}". Output is the SAME 4×4 grid layout, character at the SAME position and size in every cell — only small per-cell details differ.

STATE CONTEXT — what state "{{state_name}}" means for this character:
{{state_semantics}}

Use this context to understand the INTENT of the animation, but do NOT add new props, accessories, or anatomy that aren't already in the reference grid you received. The reference IS the truth — only animate what's already there.

DO NOT change:
- Character position, size, scale, or framing in any cell
- The overall 4×4 grid layout
- Character design (hair, clothes, palette, facing)
- The size of any cell or the grid's dimensions
- Props or items the character is holding (do NOT add or remove items)

DO change (subtle, idle animation only):
- Eyelid open vs closed (1-2 cells closed = blink) if the character has eyes
- Tiny chest / silhouette wobble of 1-3 px (breath, pulse, gentle sway)
- Hair / leaves / antenna / tail / aura drift by 1-3 px
- One small gesture appropriate to state "{{state_name}}" — within the existing character design, not new props

State pose hint: {{pose_note}}
Loop mode: {{loop_mode}} (for "loop": frame 16 → frame 1 must be seamless)

DEFAULT 16-FRAME IDLE PATTERN (anatomy-agnostic — interpret each beat appropriately for the character's actual form, whether humanoid, plant, slime, gem, robot, etc.):
  • Frames 1-3:   character at resting baseline (all secondary features at rest)
  • Frame 4:      primary silhouette begins a subtle 1-2 px expansion (the character's equivalent of "breath in" — for humanoid this is chest rise; for a plant it's leaves lifting; for a gem it's a faint glow; for a slime it's the body stretching upward)
  • Frame 5:      expansion approaches peak; one prominent feature begins its closing/dimming moment if applicable (for a character with eyes this is the lid starting to drop; for a glowing character this is brightness peaking before fading; for a character with no closable feature, simply continue the silhouette expansion)
  • Frame 6:      peak expansion + peak closure/dim moment (mid-"blink" equivalent — eyes fully closed if eyes exist, otherwise hold the peak silhouette)
  • Frame 7:      hold peak briefly (no new motion introduced)
  • Frame 8:      reverse begins (silhouette starts shrinking back; closure starts opening / dim returns to bright)
  • Frames 9-10:  silhouette returns to baseline; closure fully reopens if applicable
  • Frames 11-16: resting baseline; only allow 1-2 px drift of free-flowing features (hair tips, leaves, tail end, aura wisps — whatever the character has). NO head turning, NO gestures, NO accent moments, NO new motions introduced. These frames bridge the loop back to frame 1 with the smallest possible change.

CRITICAL — frames 11-16 are PURE HOLD with only ambient drift on already-flowing features. Do NOT introduce:
- Head turns, head tilts, head movements of any kind
- New gestures, hand movements, finger waves
- New facial expressions
- Body shifts or postural changes
- Anything that looks like a "second beat" in the animation

The idle loop has exactly ONE active beat (the breath/blink in frames 4-8). The rest of the loop is "alive but holding still".

This pattern uses ABSTRACT motion descriptors. If the character has no eyes, skip the closure/blink beats — just continue the silhouette expansion. If the character has no flowing features, skip the drift entirely. Adapt every beat to the character's actual design (the pre-tiled grid you received shows you exactly what the character is — work within that).

This is a default — use per-cell hints below if any are filled in:

{{cell_notes_block}}

Output rules:
- Output the SAME 1024×1024 4×4 grid with the same cell positions — just paint the per-cell variations on top.
- No visible borders or grid lines between cells. No frame numbers painted on the output.
- No shadows, no scenery, no extra props.
- Solid magenta or green chroma background (per the auto-appended directive below) — clean fill, no patterns.`,

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
