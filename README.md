# Mori Sprite Studio

Web tool to produce `.moripack.zip` character packs for [mori-desktop](https://github.com/yazelin/mori-desktop) — compliant with `character-pack.md` v1.0.

## Workflow

1. Upload 1 character reference image
2. Click "生 6 狀態靜態" — AI generates a 3×2 grid of 6 state poses; tool splits into 6 individual statics
3. Per state: click "生 <state> 動畫" — AI animates the static into a 4×4 sprite sheet
4. Optionally fine-tune individual frames
5. Export `.moripack.zip`

## Setup

```bash
npm install
npm install -g vercel
cp .env.example .env.local  # optional: only if you want the author-fallback path locally
npm run dev                  # uses `vercel dev` so /api/* works
```

Open http://localhost:3000

## AI Providers

| Provider | Where to get key |
|---|---|
| Codex-Image (self-hosted) | yazelin's service |
| Vertex Gemini | console.cloud.google.com/vertex-ai/express |
| Google Gemini Direct | aistudio.google.com |
| Author Fallback | (no user key — uses `AUTHOR_API_KEY` env var server-side) |

A 5th path — **BYOG** (Bring Your Own Generation) — lets you copy the prompt, run any AI tool yourself, and upload the result.

## Spec / Design

See [`docs/superpowers/specs/2026-05-22-mori-sprite-studio-design.md`](docs/superpowers/specs/2026-05-22-mori-sprite-studio-design.md).
