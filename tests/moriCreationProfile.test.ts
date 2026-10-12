import { describe, expect, it } from 'vitest'
import {
  MORI_SELFIE_PROMPT,
  MORI_SONG_PROMPT,
  buildMoriSelfiePrompt,
  buildMoriSongPrompt,
  detectMoriCreationMode,
  isMoriSelfieRequest,
  isMoriSingingRequest,
} from '@/lib/moriCreationProfile'

describe('Mori creation profile', () => {
  it('recognizes selfie requests and locks Mori’s reference identity and style', () => {
    expect(isMoriSelfieRequest('畫你的自拍照')).toBe(true)
    expect(detectMoriCreationMode('畫你的自拍照')).toBe('image')
    expect(MORI_SELFIE_PROMPT).toContain('the exact same woman in the attached reference')
    expect(MORI_SELFIE_PROMPT).toContain('direct source for her identity, character design, and art style')
    expect(MORI_SELFIE_PROMPT).toContain('Keep Mori crisp and finely finished')
    expect(buildMoriSelfiePrompt('在森林裡微笑')).toContain('在森林裡微笑')
  })

  it('recognizes Mori song requests and keeps the female forest-song direction', () => {
    expect(isMoriSingingRequest('你唱一首歌')).toBe(true)
    expect(detectMoriCreationMode('你唱一首歌')).toBe('music')
    expect(MORI_SONG_PROMPT).toContain('feminine solo singing voice')
    expect(MORI_SONG_PROMPT).toContain('Traditional Chinese')
    expect(buildMoriSongPrompt('唱一首森林之歌')).toContain('forest folk-song theme')
  })

  it('leaves ordinary chat requests in chat mode', () => {
    expect(detectMoriCreationMode('台北今天天氣如何？')).toBeNull()
  })
})
