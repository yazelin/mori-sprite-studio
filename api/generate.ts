import type { VercelRequest, VercelResponse } from '@vercel/node'

// Author Fallback 免費通道已停止提供(2026-09)。
// 留這個 stub 讓還存著舊 localStorage 的舊版前端拿到明確訊息,而非 404。
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(410).json({
    error: 'author_fallback_discontinued',
    detail: 'Author Fallback 免費通道已停止提供。請在 AI Provider 設定切換到 Google Gemini / Vertex Gemini / Codex-Image 並自帶 key。',
  })
}
