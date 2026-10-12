import type { VercelRequest, VercelResponse } from '@vercel/node'

const LARCH_TTS_HOST = 'ching-tech.ddns.net'
const LARCH_TTS_PATH = '/larch-tts'
const MAX_TEXT_LENGTH = 500

export const maxDuration = 60

function getTtsEndpoint(baseUrl: string): URL | null {
  try {
    const base = new URL(baseUrl)
    if (
      base.protocol !== 'https:' ||
      base.hostname.toLowerCase() !== LARCH_TTS_HOST ||
      (base.port && base.port !== '443') ||
      base.username || base.password || base.search || base.hash ||
      base.pathname.replace(/\/+$/, '') !== LARCH_TTS_PATH
    ) return null
    return new URL(`${LARCH_TTS_PATH}/tts`, `https://${LARCH_TTS_HOST}`)
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: '只接受 POST 請求。' })
  }

  const body = req.body as { baseUrl?: unknown; apiKey?: unknown; voice?: unknown; text?: unknown } | undefined
  const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : ''
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  const voice = typeof body?.voice === 'string' ? body.voice.trim() : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!baseUrl || !apiKey) {
    return res.status(400).json({ error: '請先在編輯設定填入 Larch-TTS Base URL 和 API Key。' })
  }
  if (apiKey.length > 512 || /[\r\n]/.test(apiKey) || voice.length > 200 || /[\r\n]/.test(voice)) {
    return res.status(400).json({ error: 'Larch-TTS 連線設定格式不正確。' })
  }
  if (!text || Array.from(text).length > MAX_TEXT_LENGTH || !voice) {
    return res.status(400).json({ error: `配音文字需為 1 到 ${MAX_TEXT_LENGTH} 字，並選擇女聲。` })
  }

  const endpoint = getTtsEndpoint(baseUrl)
  if (!endpoint) {
    return res.status(400).json({ error: `Larch-TTS Base URL 請使用 https://${LARCH_TTS_HOST}${LARCH_TTS_PATH}/。` })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ text, voice, format: 'mp3' }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const status = response.status >= 400 && response.status < 600 ? response.status : 502
      const error = status === 403
        ? 'Larch-TTS API Key 無效，請檢查編輯設定。'
        : status === 429
          ? 'Larch-TTS 目前忙碌，請稍後再試。'
          : `Larch-TTS 配音失敗（${status}）。`
      return res.status(status).json({ error })
    }

    const audio = Buffer.from(await response.arrayBuffer())
    if (audio.length === 0) return res.status(502).json({ error: 'Larch-TTS 沒有回傳音訊。' })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    const cacheStatus = response.headers.get('X-Bridge-Cache')
    if (cacheStatus) res.setHeader('X-Bridge-Cache', cacheStatus)
    return res.status(200).send(audio)
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Larch-TTS 配音時間較久，請再試一次。' : '目前無法連線到 Larch-TTS，請確認服務網址。',
    })
  } finally {
    clearTimeout(timeout)
  }
}
