export const MORI_REFERENCE_IMAGE_URL = '/mori/mori-reference.webp'

export const MORI_SELFIE_PROMPT = [
  'Create an illustrated selfie of Mori, the exact same woman in the attached reference. Treat the reference as the direct source for her identity, character design, and art style, not as loose inspiration. Make an image-to-image variation of Mori; only her pose, expression, and framing may change.',
  'Preserve her original face shape and proportions: a delicate small face, relaxed narrow green eyes, petite nose and mouth, and subtly pointed ears. Keep the same eye size, spacing, and gentle expression as the reference. She looks toward the viewer with a natural, soft smile.',
  'Keep her long, abundant, muted sage-green hair with wispy straight bangs, layered flowing waves, and fine visible strands. Preserve the crown arrangement of many small ivory five-petal blossoms, tiny buds and leaves woven into delicate antique-gold vine filigree.',
  'Keep her original layered forest-green dress with dense gold botanical embroidery, loose translucent ivory bell sleeves with fine gold edging, draped gold chains, and the round botanical pendant. Do not replace it with a simple or fitted outfit.',
  'Frame her from the waist or chest up at arm’s length, facing the viewer; one sleeve or forearm may enter near the edge to suggest a selfie. Keep her signature hair ornaments and enough of the embroidered bodice and sleeves visible. Use warm, low-key woodland light and the reference’s muted moss-green, ivory, and antique-gold palette.',
  'Match the reference’s polished, highly detailed painterly anime illustration: fine controlled linework, softly blended but clearly defined shading, individually rendered hair strands, delicate flower details, translucent fabric, and intricate embroidery. Keep Mori crisp and finely finished; do not make the image photorealistic, rough, flat, blurry, or simplified.',
  'Make one coherent image of Mori only. Do not redesign or omit her defining features and ornaments. Do not add lettering, captions, panels, watermarks, or extra people.',
].join(' ')

export const MORI_SONG_PROMPT = [
  'Create an original forest folk song performed by Mori, with a warm, clear, gentle feminine solo singing voice.',
  'Sing natural Taiwanese Mandarin lyrics written in Traditional Chinese. The lyrics should feel calm, heartfelt, and easy to remember, with a clear verse and a memorable chorus.',
  'Let the song evoke a peaceful forest walk, leaves in the sunlight, quiet rest, and companionship. Use a gentle folk arrangement with plucked acoustic strings, soft piano, and light bell-like accents.',
  'Use the user’s request for optional mood or tempo details while keeping Mori as the singer and preserving the forest-song theme.',
  'Sing throughout; do not add a spoken introduction. Create an original melody and lyrics without imitating an existing song or artist.',
].join(' ')

export function isMoriSelfieRequest(text: string) {
  return /自拍/u.test(text)
}

export function isMoriSingingRequest(text: string) {
  return /(?:你|妳|mori).{0,20}(?:唱|哼歌|歌曲|歌)|(?:唱|哼歌).{0,12}(?:一首|首歌|歌曲|歌)|(?:幫我|請).{0,12}(?:唱|哼).{0,12}歌/iu.test(text)
}

export function detectMoriCreationMode(text: string): 'image' | 'music' | null {
  if (isMoriSelfieRequest(text) && /畫|生成|產生|做|製作|給我|來一張|拍|看/iu.test(text)) return 'image'
  if (isMoriSingingRequest(text)) return 'music'
  return null
}

export function buildMoriSelfiePrompt(userRequest: string) {
  return `${MORI_SELFIE_PROMPT}\n\nUser’s requested pose or setting: ${userRequest}\n\nKeep Mori’s recognizable identity and human appearance from the attached reference while applying the user’s direction.`
}

export function buildMoriSongPrompt(userRequest: string) {
  return `${MORI_SONG_PROMPT}\n\nUser’s requested mood or tempo: ${userRequest}\n\nKeep Mori as the singer, use a feminine solo voice, sing in Taiwanese Mandarin with Traditional Chinese lyrics, and retain the peaceful forest folk-song theme.`
}

let referenceImagePromise: Promise<string> | null = null

export function loadMoriReferenceImage() {
  if (!referenceImagePromise) {
    referenceImagePromise = fetch(MORI_REFERENCE_IMAGE_URL)
      .then((response) => {
        if (!response.ok) throw new Error('無法載入 Mori 的角色參考圖。')
        return response.blob()
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('無法讀取 Mori 的角色參考圖。'))
        reader.onerror = () => reject(new Error('無法讀取 Mori 的角色參考圖。'))
        reader.readAsDataURL(blob)
      }))
      .catch((error) => {
        referenceImagePromise = null
        throw error
      })
  }
  return referenceImagePromise
}
