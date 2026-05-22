import type { VercelRequest, VercelResponse } from '@vercel/node'

type Provider = 'vertex-gemini' | 'google-gemini'

interface RequestBody {
  prompt: string
  references: string[]  // base64
  outputSize: '1024x1024' | '1024x1536' | '1536x1024'
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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

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

  const data = await upstream.json()
  const partsResp: unknown[] = data?.candidates?.[0]?.content?.parts ?? []
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
