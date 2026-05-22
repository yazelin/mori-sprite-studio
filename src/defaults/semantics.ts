import type { StateName } from '@/types/project'

// Pose-focused semantic descriptions for each state. These feed into AI
// prompts as {{state_semantics}}. Visual character traits (hair color,
// outfit, ears, proportions) come from the user's reference image — these
// strings focus only on POSE, GESTURE, EXPRESSION so the AI knows what
// the character is DOING in each state.
//
// Calibrated against mori-desktop's canonical placeholder set
// (~/mori-universe/mori-desktop/docs/sprites/mori-*.png).
export const DEFAULT_STATE_SEMANTICS: Record<StateName, string> = {
  idle:
    'standing front-facing, gentle inviting closed-mouth smile, eyes open and looking softly forward, arms relaxed at the sides (hands hidden inside long sleeves is fine), calm serene welcoming presence',

  sleeping:
    'sitting cross-legged with knees folded close to body, eyes closed in a peaceful closed-eye smile, hands resting gently in lap, body curled small and cozy, a tiny stylized "Z" or "Zz" floating near the head to indicate sleep',

  recording:
    'IMPORTANT CONTEXT: this state is "the character LISTENING to the user talk" (the user speaks INTO the computer; the desktop pet hears it). The character is the LISTENER, not the speaker. NOT performing / singing / speaking into a mic. NO microphone, NO megaphone, NO recording device, NO prop in hand. Pose: wide open alert eyes (round and bright), open attentive listening smile, ONE empty hand raised up beside the ear in an "I am listening, please continue" cupped-hand gesture (hand cups the ear like trying to hear better). Other hand stays at side or hidden. Light motion lines or small sparkles around the figure to suggest attentive energy. Both hands stay empty — character holds nothing.',

  thinking:
    'one finger raised lightly to temple or forehead in a pondering gesture, eyes glancing up and to one side contemplatively, slight closed-mouth thoughtful expression, a few small sparkles or thought-marks floating around the head to suggest active thought',

  done:
    'CELEBRATION BURST — the user just finished a task and the character is genuinely thrilled for them. This is a ONE-SHOT animation: brief, intense, energetic, like "YAY you did it!!". Eyes closed in a wide joyful ^v^ curve, mouth wide open in a delighted shouting-with-joy smile, BOTH hands raised UP high in a victory / cheering / celebratory gesture (think kids cheering, arms up like fireworks bursting). Full-body joyful energy — small forward bounce, slight head tilt back in delight, optional small sparkles or confetti bursting around. This is NOT a calm prayer / NOT a quiet thank-you — it is enthusiastic celebration energy.',

  error:
    'PANIC / DISTRESS BURST — the user triggered an error and the character is dramatically overwhelmed about it. This is a ONE-SHOT animation: brief, exaggerated, "oh no the sky is falling!" energy. Pose: BOTH hands clutched to the sides of the head in a "head in hands / oh no!" gesture (palms cradling temples, fingers spread). Eyes either squeezed shut in worry OR wide and teary. Mouth small open in distressed "ah!" expression. Body slightly hunched / leaning forward in distress. Optional accents: small tear at corner of eye, distress sweat-drop, "//" tension lines near head, motion lines suggesting panic. NOT cowering in fear, NOT angry, NOT sobbing tragically — this is CUTE OVERWHELMED WORRY like "I tried but it broke, sorry sorry!".',

  walking:
    'WALKING CYCLE — the character is walking across the screen from left to right (engine mirrors via CSS scaleX(-1) for leftward motion, so always design facing RIGHT). Locomotion pose: side-profile or three-quarter view facing right, one leg forward + one leg back (alternating across the 16-frame loop to suggest steps), arms in counter-swing (right arm forward when left leg forward, etc.), eyes open looking forward with cheerful determined expression, body slightly bouncing up and down with each step. NO walking stick / NO held items. The 16-frame loop should form a complete 2-step gait cycle (8 frames per step = 2 full steps), looping smoothly so frame 16 → frame 1 has no visible jump.',

  dragging:
    'BEING LIFTED & SUSPENDED — the user is holding the character with the mouse, lifted off the ground and dangling in mid-air. Pose: feet completely off the ground (no contact with anything), body slightly stretched downward by gravity, arms either hanging loose at the sides OR slightly outstretched for balance, eyes wide and round in pleasant surprise (not fearful — more like "oh! ride!"), open small smile or open "ah!" expression. Slight gentle sway / wobble across the 16 frames as if swinging from an invisible string above. Optional: small motion lines or tiny sparkles around the body suggesting suspended floating energy. NOT screaming, NOT angry — character finds being lifted FUN like being picked up by a friend.',
}
