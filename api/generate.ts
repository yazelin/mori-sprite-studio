import type { VercelRequest, VercelResponse } from '@vercel/node'

type Provider = 'vertex-gemini' | 'google-gemini'

interface RequestBody {
  prompt: string
  references: string[]  // base64
  outputSize: '1024x1024' | '1024x1536' | '1536x1024'
}

// ─── Per-IP rate limiting ────────────────────────────────────────────────
//
// In-memory (per Vercel function instance). Multiple instances → each has
// its own state, so limits are approximately per-IP-per-instance. Good
// enough for MVP. For high-traffic, migrate to Upstash Redis / Vercel KV.
//
// Two limits:
//   1) Concurrency: at most 1 request in-flight per IP. Prevents multi-
//      tab / script parallel abuse without throttling sequential users
//      (API latency ~60s already paces cadence naturally).
//   2) Daily cap: 50 requests per IP per UTC day. Caps total cost from
//      any single IP. One full character pack needs ~25-30 requests
//      (6 statics + 6 animations + 10-15 re-rolls), so 50/day = ~1.5
//      characters per day per IP, plenty for legitimate use.

const RATE_DAILY_CAP = 50
const inFlight = new Set<string>()           // ip
const dailyCount = new Map<string, { date: string; count: number }>()  // ip → today

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function getClientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  if (Array.isArray(fwd)) return fwd[0].split(',')[0].trim()
  return (req.headers['x-real-ip'] as string) || req.socket?.remoteAddress || 'unknown'
}

interface RateCheck {
  ok: boolean
  status?: 429
  retryAfterSec?: number
  reason?: 'concurrent' | 'daily_cap'
  current?: number
}

function rateLimitCheck(ip: string): RateCheck {
  // (1) concurrency
  if (inFlight.has(ip)) {
    return { ok: false, status: 429, retryAfterSec: 60, reason: 'concurrent' }
  }
  // (2) daily cap
  const today = todayUtc()
  const entry = dailyCount.get(ip)
  if (entry && entry.date === today && entry.count >= RATE_DAILY_CAP) {
    // until tomorrow UTC midnight
    const nowMs = Date.now()
    const tomorrowMs = new Date(today + 'T00:00:00Z').getTime() + 86_400_000
    return {
      ok: false, status: 429,
      retryAfterSec: Math.max(1, Math.ceil((tomorrowMs - nowMs) / 1000)),
      reason: 'daily_cap', current: entry.count,
    }
  }
  return { ok: true }
}

function rateLimitAcquire(ip: string): void {
  inFlight.add(ip)
  const today = todayUtc()
  const entry = dailyCount.get(ip)
  if (!entry || entry.date !== today) {
    dailyCount.set(ip, { date: today, count: 1 })
  } else {
    entry.count++
  }
  // Cleanup ancient entries to prevent unbounded memory growth.
  // Only runs occasionally to amortize cost.
  if (Math.random() < 0.01) cleanupOldEntries()
}

function rateLimitRelease(ip: string): void {
  inFlight.delete(ip)
}

function cleanupOldEntries(): void {
  const today = todayUtc()
  for (const [ip, entry] of dailyCount) {
    if (entry.date !== today) dailyCount.delete(ip)
  }
}

const DEFAULT_MODELS: Record<Provider, string> = {
  'vertex-gemini':  'gemini-3-pro-image-preview',
  'google-gemini':  'gemini-2.5-flash-image',
}

function aspectFor(s: RequestBody['outputSize']) {
  if (s === '1536x1024') return '3:2'
  if (s === '1024x1536') return '2:3'
  return '1:1'
}

function endpointFor(provider: Provider, model: string, apiKey: string): string {
  if (provider === 'vertex-gemini') {
    return `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET → return current quota for this IP without consuming one
  if (req.method === 'GET') {
    const ip = getClientIp(req)
    const today = todayUtc()
    const entry = dailyCount.get(ip)
    const used = (entry && entry.date === today) ? entry.count : 0
    res.status(200).json({
      ip: ip.split('.').slice(0, 2).join('.') + '.x.x',  // partial ip for logging only
      usedToday: used,
      dailyCap: RATE_DAILY_CAP,
      inFlight: inFlight.has(ip),
      utcDate: today,
    })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  // Rate limit BEFORE anything else (cheap check, fail fast)
  const ip = getClientIp(req)
  const rate = rateLimitCheck(ip)
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfterSec ?? 60))
    res.status(rate.status!).json({
      error: 'rate_limited',
      reason: rate.reason,
      retryAfterSec: rate.retryAfterSec,
      detail: rate.reason === 'concurrent'
        ? '此 IP 已有一張生成中,請等該張完成再呼叫下一張。'
        : `此 IP 今日已達 ${RATE_DAILY_CAP} 次上限。明日(UTC)重置;若要繼續用,請切換到其他 provider 自帶 key。Author Fallback 是 yazelin 自掏腰包提供的試用通道,quota 有限,額度燒完會關閉。`,
      currentDailyCount: rate.current,
      dailyCap: RATE_DAILY_CAP,
    })
    return
  }
  rateLimitAcquire(ip)
  try {
    await processGeneration(req, res)
  } finally {
    // CRITICAL: always release concurrency lock even if anything threw.
    // (Daily count stays incremented — by design: we DID consume an
    //  attempt even if it errored. Adjust later if 502s shouldn't count.)
    rateLimitRelease(ip)
  }
}

/** Pulled out of handler so the rate-limit try/finally wraps everything. */
async function processGeneration(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rawProvider = process.env.AUTHOR_FALLBACK_PROVIDER ?? 'vertex-gemini'
  if (rawProvider !== 'vertex-gemini' && rawProvider !== 'google-gemini') {
    res.status(503).json({ error: 'invalid_config', detail: `Unknown AUTHOR_FALLBACK_PROVIDER: ${rawProvider}` })
    return
  }
  const provider = rawProvider as Provider
  const apiKey = process.env.AUTHOR_API_KEY
  const model = process.env.AUTHOR_MODEL || DEFAULT_MODELS[provider]
  const imageSize = process.env.AUTHOR_IMAGE_SIZE || '1K'

  if (!apiKey) {
    res.status(503).json({ error: 'not_configured', detail: 'Author API key missing (server env)' })
    return
  }

  const body = req.body as RequestBody
  if (!body || typeof body.prompt !== 'string') {
    res.status(400).json({ error: 'bad_request', detail: 'missing prompt' })
    return
  }

  const parts: unknown[] = []
  for (const b64 of body.references ?? []) {
    parts.push({ inlineData: { mimeType: 'image/png', data: b64 } })
  }
  parts.push({ text: body.prompt })

  const upstreamBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspectFor(body.outputSize),
        imageSize,
      },
    },
  }

  let upstream: Response
  try {
    upstream = await fetch(endpointFor(provider, model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamBody),
    })
  } catch (e) {
    res.status(502).json({ error: 'upstream_network', detail: e instanceof Error ? e.message : String(e) })
    return
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    res.status(502).json({ error: 'upstream_status', status: upstream.status, detail: text.slice(0, 1000) })
    return
  }

  const data = await upstream.json() as Record<string, unknown>
  const partsResp: unknown[] = (data as { candidates?: { content?: { parts?: unknown[] } }[] })?.candidates?.[0]?.content?.parts ?? []
  const imagePart = partsResp.find(
    (p): p is { inlineData: { mimeType?: string; data: string } } =>
      typeof p === 'object' && p !== null && 'inlineData' in p,
  )
  if (!imagePart) {
    const texts = partsResp
      .filter((p): p is { text: string } => typeof p === 'object' && p !== null && 'text' in p)
      .map((p) => p.text)
      .join(' ')
    res.status(502).json({ error: 'no_image', detail: texts.slice(0, 500) || '(model refused)' })
    return
  }

  res.status(200).json({
    mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    data: imagePart.inlineData.data,
  })
}
