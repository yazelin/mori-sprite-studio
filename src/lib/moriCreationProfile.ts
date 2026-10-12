export const MORI_REFERENCE_IMAGE_URL = '/mori/mori-reference.webp'

export const MORI_SELFIE_PROMPT = [
  'Create a new selfie-style portrait of Mori, a young adult human woman.',
  'Use the attached image as the identity and character-design reference. Keep her unmistakably human, with natural human facial features and human proportions.',
  'Preserve her long, softly wavy sage-green hair, gentle green eyes, small white blossom and leaf hair ornaments, cream and forest-green dress with subtle gold botanical details, and botanical pendant.',
  'Show Mori looking into a camera held at arm’s length, with a relaxed, warm smile and a natural slight selfie angle. Use a close or medium portrait framing and soft woodland light.',
  'Create a fresh composition in a polished 2D anime illustration style that matches the reference. Keep Mori’s identity and outfit recognizable while following the user’s requested pose or setting.',
  'Make one coherent image of Mori only. Do not add lettering, captions, panels, watermarks, or extra people.',
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
