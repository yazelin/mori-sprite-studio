import type { Project } from '@/types/project'
import { REQUIRED_STATE_NAMES } from '@/types/project'
import { bakeTransformIntoSheet } from './imageOps'
import { buildPackBlob } from './exportPack'

// The API is hosted in a dedicated Worker with a private R2 bucket.
// Override this public URL for local/preview environments when needed.
const COMMUNITY_API_BASE = import.meta.env.VITE_COMMUNITY_API_BASE || 'https://mori-sprite-community-api.yazelinj303.workers.dev'
const OWNER_TOKENS_KEY = 'mori-sprite-community-owner-tokens-v1'

export interface CommunityWork {
  id: string
  packageName: string
  displayName: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
  createdAt: string
  packSize: number
}

interface WorkListResponse {
  works: CommunityWork[]
  nextCursor: string | null
}

function apiUrl(path: string): string {
  return `${COMMUNITY_API_BASE.replace(/\/+$/, '')}${path}`
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : `社群服務暫時無法使用（${response.status}）。`
}

function saveOwnerToken(id: string, token: string): void {
  try {
    const raw = localStorage.getItem(OWNER_TOKENS_KEY)
    const tokens = raw ? JSON.parse(raw) as Record<string, string> : {}
    localStorage.setItem(OWNER_TOKENS_KEY, JSON.stringify({ ...tokens, [id]: token }))
  } catch {
    // Upload remains successful; deletion can be offered again if the owner shares a new copy.
  }
}

export function getOwnerToken(id: string): string | null {
  try {
    const raw = localStorage.getItem(OWNER_TOKENS_KEY)
    if (!raw) return null
    const tokens = JSON.parse(raw) as Record<string, unknown>
    return typeof tokens[id] === 'string' ? tokens[id] as string : null
  } catch {
    return null
  }
}

function removeOwnerToken(id: string): void {
  try {
    const raw = localStorage.getItem(OWNER_TOKENS_KEY)
    if (!raw) return
    const tokens = JSON.parse(raw) as Record<string, string>
    delete tokens[id]
    localStorage.setItem(OWNER_TOKENS_KEY, JSON.stringify(tokens))
  } catch {
    // A stale local token is harmless; the service no longer recognizes it after deletion.
  }
}

export function communityCoverUrl(id: string): string {
  return apiUrl(`/v1/works/${encodeURIComponent(id)}/cover`)
}

export function communityPackUrl(id: string): string {
  return apiUrl(`/v1/works/${encodeURIComponent(id)}/pack`)
}

export async function listCommunityWorks(cursor?: string | null): Promise<WorkListResponse> {
  const url = new URL(apiUrl('/v1/works'))
  url.searchParams.set('limit', '24')
  if (cursor) url.searchParams.set('cursor', cursor)
  const response = await fetch(url)
  if (!response.ok) throw new Error(await readError(response))
  return await response.json() as WorkListResponse
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法建立作品預覽圖。')), 'image/png')
  })
}

async function makeCover(project: Project): Promise<Blob> {
  const idle = project.states.idle
  if (!idle.sheet) throw new Error('請先完成 Idle 影格。')
  const baked = await bakeTransformIntoSheet(idle.sheet, idle.transform)
  const bitmap = await createImageBitmap(baked, 0, 0, 256, 256)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('瀏覽器無法建立作品預覽圖。')
  context.clearRect(0, 0, 256, 256)
  context.drawImage(bitmap, 0, 0, 256, 256)
  bitmap.close()
  return canvasBlob(canvas)
}

export async function shareProject(project: Project): Promise<CommunityWork> {
  const incomplete = REQUIRED_STATE_NAMES.filter((name) => !project.states[name].sheet || project.states[name].status !== 'animated')
  if (incomplete.length) throw new Error(`請先完成這些狀態的動畫再分享：${incomplete.join('、')}`)
  if (!project.metadata.author.trim()) throw new Error('請先在「專案設定」填入作者名稱。')
  if (!project.metadata.license.trim()) throw new Error('請先在「專案設定」選擇作品授權。')

  const [packBlob, coverBlob] = await Promise.all([buildPackBlob(project), makeCover(project)])
  if (packBlob.size > 40 * 1024 * 1024) throw new Error('moripack 超過 40 MB，請減少自訂動作或圖片大小後再分享。')

  const form = new FormData()
  form.set('metadata', JSON.stringify({
    packageName: project.metadata.packageName,
    displayName: project.metadata.displayName,
    version: project.metadata.version,
    author: project.metadata.author,
    license: project.metadata.license,
    description: project.metadata.description,
    tags: project.metadata.tags,
  }))
  form.set('pack', new File([packBlob], `${project.metadata.packageName}.moripack.zip`, { type: 'application/zip' }))
  form.set('cover', new File([coverBlob], 'cover.png', { type: 'image/png' }))

  const response = await fetch(apiUrl('/v1/works'), { method: 'POST', body: form })
  if (!response.ok) throw new Error(await readError(response))
  const result = await response.json() as { work: CommunityWork; removeToken: string }
  saveOwnerToken(result.work.id, result.removeToken)
  return result.work
}

export async function removeCommunityWork(id: string): Promise<void> {
  const removeToken = getOwnerToken(id)
  if (!removeToken) throw new Error('找不到這件作品的本機下架權杖。')
  const response = await fetch(communityPackUrl(id).replace(/\/pack$/, ''), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeToken }),
  })
  if (!response.ok) throw new Error(await readError(response))
  removeOwnerToken(id)
}

export function formatPackSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
