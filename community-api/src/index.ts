interface Env {
  COMMUNITY_PACKS: R2Bucket
  COMMUNITY_INDEX: KVNamespace
}

interface WorkMetadata {
  packageName: string
  displayName: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
}

interface StoredWork extends WorkMetadata {
  id: string
  createdAt: string
  packKey: string
  coverKey: string
  packSize: number
  deleteTokenHash: string
  catalogKey: string
}

interface PublicWork extends WorkMetadata {
  id: string
  createdAt: string
  packSize: number
}

const ALLOWED_ORIGINS = new Set([
  'https://mori-sprite-studio.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
])
const PREVIEW_ORIGIN = /^https:\/\/mori-sprite-studio-[a-z0-9-]+-yazelins-projects\.vercel\.app$/i
const REQUIRED_STATES = ['idle', 'sleeping', 'recording', 'thinking', 'done', 'error']
const MAX_PACK_BYTES = 40 * 1024 * 1024
const MAX_COVER_BYTES = 1024 * 1024
const MAX_UPLOADS_PER_DAY = 5
const MAX_ZIP_ENTRIES = 128

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin)
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  if (!origin || !isAllowedOrigin(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(corsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value))
  return new Response(JSON.stringify(body), { status, headers })
}

function error(request: Request, message: string, status: number): Response {
  return json(request, { error: message }, status)
}

function publicWork(work: StoredWork): PublicWork {
  const { deleteTokenHash: _deleteTokenHash, packKey: _packKey, coverKey: _coverKey, catalogKey: _catalogKey, ...value } = work
  return value
}

function validMetadata(value: unknown): WorkMetadata | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const packageName = typeof source.packageName === 'string' ? source.packageName.trim() : ''
  const displayName = typeof source.displayName === 'string' ? source.displayName.trim() : ''
  const version = typeof source.version === 'string' ? source.version.trim() : ''
  const author = typeof source.author === 'string' ? source.author.trim() : ''
  const license = typeof source.license === 'string' ? source.license.trim() : ''
  const description = typeof source.description === 'string' ? source.description.trim() : ''
  const tags = Array.isArray(source.tags)
    ? source.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 12)
    : []

  if (!/^[a-z][a-z0-9_]{0,63}$/.test(packageName)) return null
  if (!displayName || displayName.length > 80 || !/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/.test(version)) return null
  if (!author || author.length > 80 || !license || license.length > 100) return null
  if (description.length > 1000 || tags.some((tag) => tag.length > 30)) return null
  return { packageName, displayName, version, author, license, description, tags }
}

interface ZipEntry {
  name: string
  compression: number
  compressedSize: number
  size: number
  localOffset: number
}

function findZipEntries(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minOffset = Math.max(0, bytes.length - 65_557)
  let endOffset = -1
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset
      break
    }
  }
  if (endOffset < 0) return null

  const disk = view.getUint16(endOffset + 4, true)
  const centralDisk = view.getUint16(endOffset + 6, true)
  const entriesOnDisk = view.getUint16(endOffset + 8, true)
  const entryCount = view.getUint16(endOffset + 10, true)
  const centralSize = view.getUint32(endOffset + 12, true)
  const centralOffset = view.getUint32(endOffset + 16, true)
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount || entryCount < 1 || entryCount > MAX_ZIP_ENTRIES) return null
  if (centralOffset + centralSize > endOffset) return null

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries: ZipEntry[] = []
  let offset = centralOffset
  let totalSize = 0
  try {
    for (let i = 0; i < entryCount; i += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return null
      const flags = view.getUint16(offset + 8, true)
      const compression = view.getUint16(offset + 10, true)
      const compressedSize = view.getUint32(offset + 20, true)
      const size = view.getUint32(offset + 24, true)
      const nameLength = view.getUint16(offset + 28, true)
      const extraLength = view.getUint16(offset + 30, true)
      const commentLength = view.getUint16(offset + 32, true)
      const externalAttributes = view.getUint32(offset + 38, true)
      const localOffset = view.getUint32(offset + 42, true)
      if ((flags & 1) !== 0 || (compression !== 0 && compression !== 8)) return null
      if (size > 16 * 1024 * 1024) return null
      totalSize += size
      if (totalSize > 128 * 1024 * 1024) return null
      const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
      if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some((part) => part === '..')) return null
      const unixMode = externalAttributes >>> 16
      if ((unixMode & 0o170000) === 0o120000) return null
      entries.push({ name, compression, compressedSize, size, localOffset })
      offset += 46 + nameLength + extraLength + commentLength
    }
  } catch {
    return null
  }
  return entries
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = entry.localOffset
  if (offset + 30 > bytes.length || view.getUint32(offset, true) !== 0x04034b50) return null
  const nameLength = view.getUint16(offset + 26, true)
  const extraLength = view.getUint16(offset + 28, true)
  const start = offset + 30 + nameLength + extraLength
  const end = start + entry.compressedSize
  if (end > bytes.length) return null
  const compressed = bytes.subarray(start, end)
  try {
    if (entry.compression === 0) return compressed.slice()
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const result = new Uint8Array(await new Response(stream).arrayBuffer())
    return result.length === entry.size ? result : null
  } catch {
    return null
  }
}

async function validatePack(bytes: Uint8Array, expectedPackageName: string): Promise<string | null> {
  const entries = findZipEntries(bytes)
  if (!entries) return 'moripack 壓縮檔格式無法辨識。'
  const names = new Set(entries.map((entry) => entry.name))
  const allowedPath = /^(?:manifest\.json|sprites\/[a-z][a-z0-9_-]*\.png|sprites\/actions\/[a-z0-9][a-z0-9_-]{0,47}\.png|backdrop-(?:light|dark)\.png|sprites\/|sprites\/actions\/)$/
  if (entries.some((entry) => !allowedPath.test(entry.name))) return 'moripack 含有不支援的檔案路徑。'
  if (!REQUIRED_STATES.every((name) => names.has(`sprites/${name}.png`))) return 'moripack 缺少必要的六個角色狀態圖片。'
  const manifestEntry = entries.find((entry) => entry.name === 'manifest.json')
  if (!manifestEntry || manifestEntry.size > 128 * 1024) return 'moripack 缺少有效的 manifest.json。'
  const manifestBytes = await readZipEntry(bytes, manifestEntry)
  if (!manifestBytes) return 'moripack 的 manifest.json 無法讀取。'
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)) as Record<string, unknown>
  } catch {
    return 'moripack 的 manifest.json 格式不正確。'
  }
  if (manifest.schema_version !== '1.1' || manifest.package_name !== expectedPackageName) return 'moripack 的 manifest 與分享資料不一致。'
  const customActions = Array.isArray(manifest.custom_actions) ? manifest.custom_actions : []
  for (const action of customActions) {
    if (!action || typeof action !== 'object') return 'moripack 的自訂動作資料格式不正確。'
    const spritePath = (action as Record<string, unknown>).sprite_path
    if (typeof spritePath !== 'string' || !names.has(spritePath)) return 'moripack 缺少自訂動作圖片。'
  }
  return null
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function reverseTimestamp(timestamp: number): string {
  return String(9_999_999_999_999 - timestamp).padStart(13, '0')
}

async function listWorks(request: Request, url: URL, env: Env): Promise<Response> {
  const limit = Math.min(36, Math.max(1, Number(url.searchParams.get('limit')) || 24))
  const cursor = url.searchParams.get('cursor') || undefined
  try {
    const listing = await env.COMMUNITY_PACKS.list({ prefix: 'catalog/posted/', limit, cursor })
    const records = await Promise.all(listing.objects.map(async ({ key }) => {
      const object = await env.COMMUNITY_PACKS.get(key)
      const raw = object ? await object.text() : null
      if (!raw) return null
      try { return publicWork(JSON.parse(raw) as StoredWork) } catch { return null }
    }))
    return json(request, {
      works: records.filter((record): record is PublicWork => record !== null),
      nextCursor: listing.truncated ? listing.cursor : null,
    })
  } catch {
    return error(request, '目前無法載入社群作品，請稍後再試。', 503)
  }
}

async function uploadWork(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? ''
  if (origin && !isAllowedOrigin(origin)) return error(request, '這個來源目前不能上傳社群作品。', 403)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const rateKey = `rate:${await hash(ip)}`
  const existingCount = Number(await env.COMMUNITY_INDEX.get(rateKey) || '0')
  if (existingCount >= MAX_UPLOADS_PER_DAY) return error(request, '這個網路今天已分享多件作品，明天再試。', 429)

  let form: FormData
  try { form = await request.formData() } catch { return error(request, '上傳資料格式不正確。', 400) }
  const rawMetadata = form.get('metadata')
  if (typeof rawMetadata !== 'string' || rawMetadata.length > 12_000) return error(request, '作品資訊格式不正確。', 400)
  let metadata: WorkMetadata | null = null
  try { metadata = validMetadata(JSON.parse(rawMetadata)) } catch { /* invalid JSON */ }
  if (!metadata) return error(request, '請確認作品名稱、版本、作者與授權資訊。', 400)
  const pack = form.get('pack')
  const cover = form.get('cover')
  if (!(pack instanceof File) || pack.size < 100 || pack.size > MAX_PACK_BYTES) {
    return error(request, 'moripack 大小需在 100 bytes 到 40 MB 之間。', 413)
  }
  if (!(cover instanceof File) || cover.size < 24 || cover.size > MAX_COVER_BYTES) {
    return error(request, '預覽圖片格式或大小不正確。', 400)
  }
  const packBytes = new Uint8Array(await pack.arrayBuffer())
  const packProblem = await validatePack(packBytes, metadata.packageName)
  if (packProblem) return error(request, packProblem, 400)
  const coverBytes = new Uint8Array(await cover.arrayBuffer())
  if (coverBytes[0] !== 0x89 || coverBytes[1] !== 0x50 || coverBytes[2] !== 0x4e || coverBytes[3] !== 0x47) {
    return error(request, '預覽圖片必須是 PNG。', 400)
  }

  const now = Date.now()
  const id = crypto.randomUUID().replaceAll('-', '')
  const removeToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`
  const packKey = `packs/${id}.moripack.zip`
  const coverKey = `covers/${id}.png`
  const catalogKey = `catalog/posted/${reverseTimestamp(now)}-${id}.json`
  const byIdKey = `catalog/by-id/${id}.json`
  const record: StoredWork = {
    ...metadata,
    id,
    createdAt: new Date(now).toISOString(),
    packKey,
    coverKey,
    packSize: pack.size,
    deleteTokenHash: await hash(removeToken),
    catalogKey,
  }
  try {
    await env.COMMUNITY_PACKS.put(packKey, packBytes, {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: { packageName: metadata.packageName, displayName: metadata.displayName },
    })
    await env.COMMUNITY_PACKS.put(coverKey, coverBytes, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: { workId: id },
    })
    const catalogJson = JSON.stringify(record)
    await env.COMMUNITY_PACKS.put(catalogKey, catalogJson, { httpMetadata: { contentType: 'application/json; charset=utf-8' } })
    await env.COMMUNITY_PACKS.put(byIdKey, catalogJson, { httpMetadata: { contentType: 'application/json; charset=utf-8' } })
    await env.COMMUNITY_INDEX.put(rateKey, String(existingCount + 1), { expirationTtl: 86_400 })
  } catch {
    await Promise.allSettled([
      env.COMMUNITY_PACKS.delete(packKey),
      env.COMMUNITY_PACKS.delete(coverKey),
      env.COMMUNITY_PACKS.delete(catalogKey),
      env.COMMUNITY_PACKS.delete(byIdKey),
    ])
    return error(request, '作品儲存失敗，請稍後再試。', 503)
  }
  return json(request, { work: publicWork(record), removeToken }, 201)
}

async function findWorkById(id: string, env: Env): Promise<{ record: StoredWork; key: string } | null> {
  const key = `catalog/by-id/${id}.json`
  const object = await env.COMMUNITY_PACKS.get(key)
  if (!object) return null
  try {
    const record = JSON.parse(await object.text()) as StoredWork
    return record.id === id ? { record, key } : null
  } catch {
    return null
  }
}

async function removeWork(request: Request, id: string, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? ''
  if (origin && !isAllowedOrigin(origin)) return error(request, '這個來源目前不能管理社群作品。', 403)
  let body: { removeToken?: unknown }
  try { body = await request.json() as { removeToken?: unknown } } catch { return error(request, '下架驗證資料不正確。', 400) }
  if (typeof body.removeToken !== 'string' || body.removeToken.length < 32 || body.removeToken.length > 128) {
    return error(request, '缺少作品下架驗證碼。', 403)
  }
  const found = await findWorkById(id, env)
  if (!found) return error(request, '找不到這件社群作品。', 404)
  if (await hash(body.removeToken) !== found.record.deleteTokenHash) return error(request, '下架驗證碼不正確。', 403)
  await Promise.all([
    env.COMMUNITY_PACKS.delete(found.record.packKey),
    env.COMMUNITY_PACKS.delete(found.record.coverKey),
    env.COMMUNITY_PACKS.delete(found.record.catalogKey),
    env.COMMUNITY_PACKS.delete(found.key),
  ])
  return json(request, { ok: true })
}

async function getAsset(request: Request, id: string, kind: 'cover' | 'pack', env: Env): Promise<Response> {
  const found = await findWorkById(id, env)
  if (!found) return error(request, '找不到這件社群作品。', 404)
  const { record } = found
  const object = await env.COMMUNITY_PACKS.get(kind === 'cover' ? record.coverKey : record.packKey)
  if (!object) return error(request, '作品檔案目前無法讀取。', 404)
  const headers = new Headers(corsHeaders(request))
  headers.set('Content-Type', kind === 'cover' ? 'image/png' : 'application/zip')
  headers.set('Cache-Control', 'public, max-age=3600')
  headers.set('ETag', object.httpEtag)
  headers.set('Content-Length', String(object.size))
  if (kind === 'pack') headers.set('Content-Disposition', `attachment; filename="${record.packageName}.moripack.zip"`)
  return new Response(object.body, { headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') ?? ''
      if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403, headers: corsHeaders(request) })
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (url.pathname === '/health' && request.method === 'GET') return json(request, { ok: true })
    if (url.pathname === '/v1/works' && request.method === 'GET') return listWorks(request, url, env)
    if (url.pathname === '/v1/works' && request.method === 'POST') return uploadWork(request, env)
    const match = url.pathname.match(/^\/v1\/works\/([a-f0-9]{32})(?:\/(cover|pack))?$/)
    if (match && request.method === 'GET' && match[2]) return getAsset(request, match[1], match[2] as 'cover' | 'pack', env)
    if (match && request.method === 'DELETE' && !match[2]) return removeWork(request, match[1], env)
    return error(request, '找不到這個社群 API 路徑。', 404)
  },
}
