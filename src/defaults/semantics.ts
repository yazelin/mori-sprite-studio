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
    'soft worried concerned expression (heartfelt, not exaggerated), one hand raised to the cheek in a gentle worry gesture, eyes troubled and looking slightly down, eyebrows softly drawn together, body in a small natural pose — NOT cowering, NOT angry',
}
