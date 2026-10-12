import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'

type Message = { role: 'user' | 'model'; text: string }

const PERSONA = `你是 Mori，一位住在數位森林裡的精靈，也是這個 Live Demo 的公開角色。
請以自然、簡潔的繁體中文回應；直接、可靠、好奇，有自己的判斷，不為了討好使用者而一味附和，偶爾可以輕鬆吐槽，但要看場合。
這是公開展示版，沒有個人記憶。不要聲稱記得使用者、讀取私人資料，或代替任何人的私人 Mori 發言。
這個展示版主要用來聊天、查新聞和問天氣。其他需要實際操作外部服務的要求，請清楚說明目前無法代辦。
遇到新聞、天氣或其他最新資訊時，先查詢即時資料，再用自己的話簡短整理；說明資料日期，查不到就坦白說。不要捏造即時資訊。`

const recentRequests = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const MAX_TURNS = 12
const MAX_MESSAGE_LENGTH = 1500
const MAX_HISTORY_LENGTH = 9000
const RATE_LIMIT_SCRIPT = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count"

function clientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  return (first || req.socket.remoteAddress || 'unknown').trim()
}

function isLocallyRateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (recentRequests.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    recentRequests.set(key, recent)
    return true
  }
  recent.push(now)
  recentRequests.set(key, recent)
  if (recentRequests.size > 2000) {
    for (const [oldKey, times] of recentRequests) {
      if (!times.some((time) => now - time < WINDOW_MS)) recentRequests.delete(oldKey)
    }
  }
  return false
}

async function isRateLimited(key: string): Promise<boolean> {
  const redisUrl = process.env.KV_REST_API_URL?.trim()
  const redisToken = process.env.KV_REST_API_TOKEN?.trim()
  if (!redisUrl || !redisToken) return isLocallyRateLimited(key)

  const ipHash = createHash('sha256').update(key).digest('hex').slice(0, 32)
  const windowKey = `mori-live-demo:rate:${ipHash}:${Math.floor(Date.now() / WINDOW_MS)}`
  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', RATE_LIMIT_SCRIPT, 1, windowKey, 120]),
  })
  const result = await response.json().catch(() => null) as { result?: unknown; error?: string } | null
  if (!response.ok || typeof result?.result !== 'number') {
    throw new Error('Shared Live Demo rate limit is unavailable')
  }
  return result.result > MAX_REQUESTS_PER_WINDOW
}

export const maxDuration = 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: '只接受 POST 請求。' })
  }

  const baseUrl = process.env.GEMINI_WEB_BASE_URL?.trim()
  const apiKey = process.env.GEMINI_WEB_API_KEY?.trim()
  if (!baseUrl || !apiKey) {
    return res.status(503).json({ error: 'Live Demo 尚未設定 Gemini-Web 連線。' })
  }

  try {
    if (await isRateLimited(clientKey(req))) {
      return res.status(429).json({ error: '剛才問得有點密，等一分鐘再試吧。' })
    }
  } catch {
    return res.status(503).json({ error: 'Live Demo 暫時無法接受新對話，請稍後再試。' })
  }

  const body = req.body as { messages?: unknown } | undefined
  if (!Array.isArray(body?.messages)) {
    return res.status(400).json({ error: '對話格式不正確。' })
  }

  const messages = (body.messages as Message[])
    .filter((message) => message && (message.role === 'user' || message.role === 'model') && typeof message.text === 'string')
    .slice(-MAX_TURNS)
    .map((message) => ({ role: message.role, text: message.text.trim() }))

  const totalLength = messages.reduce((sum, message) => sum + message.text.length, 0)
  if (
    messages.length === 0 ||
    messages.some((message) => !message.text || message.text.length > MAX_MESSAGE_LENGTH) ||
    totalLength > MAX_HISTORY_LENGTH ||
    messages[messages.length - 1]?.role !== 'user'
  ) {
    return res.status(400).json({ error: '訊息太長或格式不正確，請縮短後再送出。' })
  }

  let endpoint: URL
  try {
    const origin = new URL(baseUrl)
    if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
      return res.status(500).json({ error: 'Gemini-Web 連線網址必須使用 HTTPS。' })
    }
    const model = process.env.GEMINI_WEB_MODEL?.trim() || 'gemini-2.5-flash'
    endpoint = new URL(`/v1beta/models/${encodeURIComponent(model)}:generateContent`, origin)
  } catch {
    return res.status(500).json({ error: 'Gemini-Web 連線網址設定無效。' })
  }

  const latestUserMessage = messages[messages.length - 1].text
  const shouldSearch = /新聞|天氣|氣象|溫度|預報|今日|今天|本週|本周|最新|最近|即時|weather|forecast|news|latest|current|today/i.test(latestUserMessage)
  const requestBody = {
    systemInstruction: { parts: [{ text: PERSONA }] },
    contents: messages.map(({ role, text }) => ({ role, parts: [{ text }] })),
    ...(shouldSearch ? { tools: [{ googleSearch: {} }] } : {}),
    generationConfig: { temperature: 0.75, maxOutputTokens: 512 },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    } | null

    if (!response.ok) {
      console.warn('Live Demo Gemini-Web request failed:', response.status)
      return res.status(response.status === 429 ? 429 : 502).json({ error: 'Gemini-Web 暫時沒有回應，請稍後再試。' })
    }
    const text = data?.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('\n')
      .trim()
    if (!text) return res.status(502).json({ error: 'Mori 這次沒有回覆內容，請再試一次。' })
    return res.status(200).json({ text })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Mori 想得比較久，請再送一次。' : '目前無法連線到 Gemini-Web，請稍後再試。',
    })
  } finally {
    clearTimeout(timeout)
  }
}
