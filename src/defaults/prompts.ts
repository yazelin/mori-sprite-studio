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

⚠ EXCEPTION — cyclic locomotion states (walking, dragging):
The "DO NOT change body pose" rule above is RELAXED for these states.

🔒 BUT THE FOLLOWING RULES STILL APPLY STRICTLY (no exception):
- Character design stays EXACTLY THE SAME in every cell:
    same hair color, same hair style/length, same face features
    same clothes (every garment, every color, every fold)
    same skin tone, same ear shape, same eye color
    same accessories (hairpiece, jewelry, items)
    same art style — if reference is anime/chibi, output stays anime/chibi
    (do NOT switch to pixel art, do NOT switch to a different art style,
     do NOT redesign the character)
- It is the SAME PERSON walking across 16 frames, just with their legs
  in different positions. Imagine taking 16 photographs of one person
  taking 2 steps — the person doesn't change, only their pose does.
- The pre-tiled grid you receive IS the canonical character — match it
  exactly for hair, clothes, face. Only redraw LIMBS that need to move.

✅ WHAT THE EXCEPTION ACTUALLY RELAXES (these may change per-cell):
For walking specifically:
- You MUST redraw LEG positions across cells — that is the entire point
  of a gait cycle. If you keep legs identical in all 16 cells, you have
  FAILED the task.
- Cells 1-8 show one full step (e.g. left leg forward → middle → right
  leg forward), cells 9-16 mirror that as the second step.
- Arms swing in counter-phase (when left leg is forward, right arm is
  forward, and vice versa).
- Body bobs UP 2-4 px during leg swing-through (between steps), DOWN at
  the step plant.
- Head + torso CENTER stays at roughly the same canvas position in each
  cell (don't translate the whole character) — only the legs, arms, and
  body tilt change.
- Camera angle / character facing direction stays CONSISTENT across all
  16 cells (don't mix front-view and side-view in the same sheet — pick
  ONE view that fits the walking semantic and hold it for all 16 cells).

For dragging: you MAY swing the body left/right 5-8 px across cells
(suspended swing), and the limbs MAY hang/swing freely — only the
"feet on ground" constraint is broken (feet should be visibly off any
surface in every cell). Character identity + design rules still apply.

State pose hint: {{pose_note}}
Loop mode: {{loop_mode}}
  - "loop" mode: frame 16 must connect seamlessly back to frame 1
  - "one-shot" mode: frame 1 is start, frame 16 is final resting pose (no loop back)

═══════════════════════════════════════════════════════════════════
DEFAULT PATTERN — choose based on loop_mode:
═══════════════════════════════════════════════════════════════════

▼ OVERRIDE (cyclic locomotion states like "walking", "dragging"):
  If the State semantics above explicitly describes WALKING / GAIT CYCLE /
  STEP CADENCE / SWING / WOBBLE / SUSPENDED MOTION across multiple frames,
  IGNORE the default loop pattern below — that pattern is for "alive but
  holding still" breathing, which produces 16 nearly-identical frames and
  is WRONG for locomotion.

  Instead, follow the State semantics' frame-by-frame motion description
  EXACTLY. For walking, this means:
    • Frames 1-8:  one complete step (e.g. left leg forward at frame 1,
                   passing-through middle at frame 4, right leg forward
                   at frame 8). Arms counter-swing across these frames.
    • Frames 9-16: a second complete step in mirror (right leg forward
                   at frame 9, passing-through at frame 12, left leg
                   forward at frame 16). Frame 16 must connect back to
                   frame 1 seamlessly (full gait cycle = 2 steps).
    • Body bobs up/down 2-4 px per step (down at step plant, up at swing).
    • LEGS MUST visibly move between every pair of adjacent frames. No
      "16 nearly-identical poses" — adjacent frames differ noticeably.

  For dragging (suspended swing): apply a similar cyclic principle —
  body oscillates left/right ~5-8 px across the 16 frames (e.g. left at
  frame 1, center at frame 4, right at frame 8, center at frame 12, left
  at frame 16 = complete sway cycle). Hair / clothes / accessories trail
  the motion.

  Adjacent frames in cyclic locomotion MUST differ visibly — not by 1-2 px
  micro-drift, but by clear pose progression (e.g. limb position, body
  tilt, hair sweep).

▼ IF loop_mode == "loop" (anatomy-agnostic idle pattern):
  • Frames 1-3:   character at resting baseline (all secondary features at rest)
  • Frame 4:      primary silhouette begins a subtle 1-2 px expansion (character's equivalent of "breath in" — for humanoid this is chest rise; for a plant it's leaves lifting; for a gem it's a faint glow; for a slime it's the body stretching upward)
  • Frame 5:      expansion approaches peak; one prominent feature begins its closing/dimming moment if applicable (for a character with eyes this is the lid starting to drop; for a glowing character this is brightness peaking before fading)
  • Frame 6:      peak expansion + peak closure/dim moment (mid-"blink" equivalent — eyes fully closed if eyes exist, otherwise hold the peak silhouette)
  • Frame 7:      hold peak briefly (no new motion introduced)
  • Frame 8:      reverse begins (silhouette starts shrinking back; closure starts opening)
  • Frames 9-10:  silhouette returns to baseline; closure fully reopens if applicable
  • Frames 11-16: resting baseline; only allow 1-2 px drift of free-flowing features. NO head turning, NO gestures, NO accent moments, NO new motions introduced.

  CRITICAL — loop mode has exactly ONE active beat (frames 4-8). The rest is "alive but holding still". No head turns, no new expressions, no body shifts after frame 10.

▼ IF loop_mode == "one-shot" (motion arc, not a hold):
  The character PROGRESSES through a brief motion. Frames are NOT mostly identical — they tell a short visual story. Adjacent frames should differ by clear small amounts (not by tiny invisible amounts like loop mode), so that at typical playback speed (1.5-2.5 seconds for 16 frames = ~100-150 ms per frame), each frame is visible and motion reads smoothly without flicker.

  TWO sub-patterns — pick based on the state's energy semantic:

  ─── Sub-pattern A: BURST-AND-SETTLE (use when state energy releases, e.g. done celebration, "yay!" → calm pride) ───
  • Frame 1:     starting pose (lower energy version of the {{state_name}} pose)
  • Frames 2-4:  energy builds — character begins the gesture
  • Frames 5-7:  approach peak (gesture nearly complete, energy at max)
  • Frame 8:     PEAK MOMENT (most expressive instant — biggest smile, highest arms, brightest sparkles)
  • Frames 9-11: peak held + small accent variation (bounce, sparkle pulse)
  • Frames 12-14:settle begins — energy easing down
  • Frames 15-16:final resting pose (calmer version of the gesture, what's visible after animation completes)

  ─── Sub-pattern B: SUSTAINED-ENERGY (use when state energy should HOLD throughout, e.g. error distress, panic, ongoing worry — settling would break the dramatic intent) ───
  • Frame 1:     full intensity of the {{state_name}} pose (no "starting low" — drop in already at full energy)
  • Frames 2-4:  small accent variations (slight head shake / tilt / sweat-drop appearing / sparkle pulse)
  • Frames 5-7:  continue at full intensity — small wobble or shake variation
  • Frame 8:     PEAK MOMENT — slight intensification of the same gesture (e.g. mouth slightly wider, sweat-drop drips one notch)
  • Frames 9-11: peak held with small accent variation continuing
  • Frames 12-14:STILL at full intensity — do NOT settle / sigh / release tension. Small wobble or accent only.
  • Frames 15-16:still at full intensity (this is what's visible after animation completes — character is held in the dramatic pose, not relaxed out of it)

  Choose Sub-pattern A or B based on the state's emotional intent. As a rule: if the state's purpose is "release something" (done, yay, hooray) → Sub-pattern A. If the state's purpose is "express sustained concern / worry / panic / surprise" (error, alarmed) → Sub-pattern B.

  CRITICAL for one-shot: do NOT change FACIAL EXPRESSION dramatically between adjacent frames. Eyes stay open OR closed for runs of 3-4 frames, then transition smoothly. Same with mouth open/closed. Rapid expression flicker looks like jitter, not animation. Within each frame group (1-7, 8-11, 12-16), keep facial features identical.

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

export const CHROMA_SUFFIX_TEMPLATE = `Background: pure solid {{chroma_color}} (#{{chroma_hex}}) covering 100% of the canvas edge-to-edge.

CRITICAL — EXACT COLOR REQUIREMENT:
- The background MUST be EXACTLY #{{chroma_hex}} (RGB values exactly as specified).
- DO NOT use a near-match, pastel variant, lighter shade, or "looks similar" color.
- For magenta (#FF00FF) this means R=255, G=0, B=255 — NOT pink (#FFC0CB), NOT light pink (#FFB6C1), NOT hot pink (#FF69B4), NOT any pinkish variant. It must be the FULL-SATURATION digital magenta — vivid, electric, almost neon, the kind of color a green-screen studio would use.
- For green (#00FF00) this means R=0, G=255, B=0 — NOT olive, NOT lime, NOT pastel green. Full-saturation electric green.

WHY THIS MATTERS — pixels matching #{{chroma_hex}} will be programmatically removed by a strict chroma-key filter on the client. If your background is the WRONG shade (pink instead of magenta, lime instead of green), the chroma key will FAIL to remove it and the user will see colored bands around the character.

CONTENT RULES:
- No shadow, no gradient, no noise, no texture, no other colors in the background.
- The character must NOT contain this exact color anywhere — not on clothes, hair, eyes, accessories, highlights, reflected light, or shadows. If the reference uses any color too close to #{{chroma_hex}}, substitute with a clearly different color.
- Pixels matching #{{chroma_hex}} on the character become holes after chroma-key removal.`
