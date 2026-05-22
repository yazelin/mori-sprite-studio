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
    'IMPORTANT CONTEXT: this state is "Mori listening to the USER talk to her" (the user speaks INTO the computer; Mori the desktop pet hears it). It is NOT Mori performing / singing / speaking into a mic. NO microphone, NO megaphone, NO recording device, NO prop in hand. Pose: wide open alert eyes (round and bright), open attentive listening smile, one empty hand raised up beside the ear in an "I am listening, please continue" cupped-hand gesture (hand cups the ear like someone trying to hear better), light motion lines or small sparkles around the figure to suggest attentive energy, animated and engaged. Both hands stay empty — character holds nothing.',

  thinking:
    'one finger raised lightly to temple or forehead in a pondering gesture, eyes glancing up and to one side contemplatively, slight closed-mouth thoughtful expression, a few small sparkles or thought-marks floating around the head to suggest active thought',

  done:
    'eyes closed in a joyful curve (^v^ closed-eye smile), wide open joyful smile, both hands clasped together in front of chest in a prayer-like or grateful gesture, relieved and content body language, slight forward tilt',

  error:
    'soft worried concerned expression (heartfelt, not exaggerated), one hand raised to the cheek in a gentle worry gesture, eyes troubled and looking slightly down, eyebrows softly drawn together, body in a small natural pose — NOT cowering, NOT angry',
}
