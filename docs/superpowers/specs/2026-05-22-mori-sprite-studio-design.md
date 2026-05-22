---
title: Mori Sprite Studio — Design Spec
date: 2026-05-22
status: draft
author: yazelin (designed with Claude)
target_repo: ~/mori-universe/mori-sprite-studio
---

# Mori Sprite Studio — Design Spec

## 1. 概觀(Motivation)

**Mori Sprite Studio** 是 mori-desktop 的第一方 character pack 製作工具,獨立 web app。它讓 user 用 1 張角色參考圖 → 透過 AI(或 BYOG 自己跑)→ 7 次生圖呼叫產出 6 個 sprite state 的完整 4×4 動畫 sheet,符合 mori-desktop 的 `character-pack.md` v1.0 規格,匯出 `.moripack.zip`。

第一個正式 use case:**製作正式版 Mori character pack**,取代目前 mori-desktop bundled 的 nanobanana placeholder。將來也讓其他角色設計師可以做出符合 spec 的自製 pack 給 user import。

跟 mori-desktop 的關係:**完全解耦**。studio 輸出 `.moripack.zip`,mori-desktop 用 import flow 載入(import flow 是 mori-desktop 自己的事)。

## 2. Scope

### MVP 包含

- 純前端 React app(Vite + TS + Tailwind + shadcn/ui)
- 6 個 state 的 sprite sheet 製作:`idle`、`sleeping`、`recording`、`thinking`、`done`、`error`
- 4 個 AI provider:
  - Author Fallback(預設,走 Vercel Function + env var)
  - Codex-Image(yazelin 自架,user 自填 key)
  - Vertex Gemini(user 自填 key,走 Vertex AI Express Mode)
  - Google Gemini Direct(user 自填 key,走 AI Studio API)
- 第 5 條路:**BYOG**(user 複製 prompt → 自己跑 → 上傳結果)
- Inline prompt editor(每個生圖按鈕旁 ⚙️ icon)
- Chroma key 去背(綠/洋紅 chroma + client-side pixel removal)
- 7 次 AI call success path:1 次生 6 狀態 + 6 次動畫化
- 個別 frame 重生(D 模式)+ 16 cell 各自 note
- 預覽:每個 state 用 CSS animation 跑 sheet(沿用 mori-desktop 的 `background-position` + `steps(4)` 邏輯)
- Export:`.moripack.zip` 完全照 `character-pack.md` v1.0
- localStorage 自動 save(refresh 不丟稿)

### MVP 排除(post-MVP)

- ❌ Walking / dragging optional states
- ❌ Canvas 塗鴉編輯(用 Procreate / Photoshop 修)
- ❌ 多角色 library / marketplace UI
- ❌ 後端 / 帳號系統
- ❌ 直接寫入 `~/.mori/characters/`(輸出 `.zip` 走 mori-desktop import flow)
- ❌ Author Fallback rate limit / Turnstile captcha(API 介面預留,未來公開分享 URL 時加)
- ❌ 跨瀏覽器分頁同步(單頁應用,sidebar 切 state)

### 部署

- 本地:`vercel dev` → `localhost:3000`(同時跑 Vite + `api/`)
- 線上:`vercel --prod` → Vercel 永久 URL,作者 API key 設 env var

## 3. Workflow

### 6 個 state 完整流程

```
─────────────────────────────────────────────────
階段 A:啟動(AI 0 次)
─────────────────────────────────────────────────
1. Upload 1 張 character reference 圖

─────────────────────────────────────────────────
階段 B:生靜態(AI 1+N 次,N 為單一 state 重生次數)
─────────────────────────────────────────────────
B1. [生 6 狀態靜態] 按鈕(一次性,全部生)
    → AI 1 次,輸出 1 張 1536×1024 PNG(3×2 grid,每 cell 512×512)
    → 套 chroma key → 切 6 張 256×256 static base
    → 每 state 自動填滿 16 格成 placeholder sheet
    
    ⚠️ 再按一次此鈕 = 整組 6 個 static 重生,所有 state 回 placeholder

B2. [重生此 state 靜態](per-state,只重生單一)
    → AI 1 次,輸出 1 張 1024×1024 PNG
    → 套 chroma key → crop/resize 至 256×256
    → 只覆蓋該 state staticBase + 該 state sheet 回 placeholder

─────────────────────────────────────────────────
階段 C:動畫化(AI 6 次,每 state 各 1,可單獨重跑)
─────────────────────────────────────────────────
C. 對每 state(進入該 state view):
   - (可選)在 16 格上各別寫 note
   - (可選)寫該 state poseNote
   - [生 <state> 動畫] 按鈕
     → AI 1 次,輸出 1 張 1024×1024 4×4 sheet
       (prompt 含:該 state staticBase + 16 cell notes + poseNote)
     → 套 chroma key → 覆蓋當前 sheet
   - 預覽動畫(CSS animation 跑 16 frame)

─────────────────────────────────────────────────
階段 D:精修(可選,N 次 AI)
─────────────────────────────────────────────────
D. 在某 state 預覽區點某 cell(1-16):
   - 編輯該 cell note
   - [重生此 frame] 按鈕
     → AI 1 次,輸出 1 張 1024×1024 PNG
       (prompt 含:static base + cell note + 前/後鄰居 frame)
     → 套 chroma key → crop/resize 至 256×256 → 貼進該 cell

─────────────────────────────────────────────────
階段 E:匯出(AI 0 次)
─────────────────────────────────────────────────
E. 設定 metadata(package_name / display_name / loop_durations_ms / 
   loop_modes / author / license / description / tags)
F. [匯出 .moripack.zip] → 下載
```

### AI call 預算

| 階段 | 次數 | 說明 |
|---|---|---|
| B1 生 6 靜態 | 1 | 一次出 3×2 grid |
| B2 重生單一靜態 | 0-N | 不滿意才跑 |
| C 動畫化 | 6 | 每 state 各 1 |
| D 重生單一 frame | 0-N | 個別精修 |
| **MVP success path** | **7** | 不重試 |

## 4. Architecture

### High-level

```
┌────────────────────────────────────────────────────────┐
│ Browser (Vite + React + TS)                            │
│                                                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Sidebar  │  │  Main View   │  │ Prompt Modal │    │
│  └─────┬────┘  └───────┬──────┘  └───────┬──────┘    │
│        │               │                  │           │
│  ┌─────┴───────────────┴──────────────────┴──────┐   │
│  │            Zustand Store (slices)             │   │
│  │   project / states / prompts / provider /     │   │
│  │   chroma                  (debounced LS save) │   │
│  └─────┬─────────────────────────────────────┬───┘   │
│        │                                     │       │
│  ┌─────┴──────┐         ┌────────────────────┴───┐   │
│  │ providers/ │         │      lib/              │   │
│  │            │         │  chromaKey            │   │
│  │ codexImage │         │  promptRenderer       │   │
│  │ vertexGem  │         │  imageOps             │   │
│  │ googleGem  │         │  exportPack           │   │
│  │ authorFB ──┼─────┐   │  byogPipeline         │   │
│  └────────────┘     │   └────────────────────────┘   │
│                     │                                 │
└─────────────────────┼─────────────────────────────────┘
                      │ POST /api/generate
                      ▼
        ┌──────────────────────────────────┐
        │ Vercel Function (api/generate.ts)│
        │ - reads env: AUTHOR_API_KEY,     │
        │   AUTHOR_FALLBACK_PROVIDER,      │
        │   AUTHOR_MODEL, AUTHOR_IMAGE_SIZE│
        │ - forwards to Vertex or Google   │
        └─────────┬────────────────────────┘
                  ▼
        ┌──────────────────────────────────┐
        │ Vertex AI / Google Gemini Direct │
        └──────────────────────────────────┘
```

### 資料流(生一張圖完整 pipeline)

```
[User 按 ✦ 按鈕]
   ↓
[組 prompt:讀 templates[op] + render vars + auto-append chroma suffix]
   ↓
[Provider.generateImage] ── 4 個 provider 之一
   ├─ Codex-Image:     POST {baseUrl}/v1/images/generate
   ├─ Vertex Gemini:   POST aiplatform.googleapis.com/...
   ├─ Google Direct:   POST generativelanguage.googleapis.com/...
   └─ Author Fallback: POST /api/generate
   ↓
[拿到 PNG blob,含 chroma 純色背景]
   ↓
[chromaKeyOut(blob, chromaColor, tolerance)]
   ↓
[透明 PNG blob]
   ↓
[根據 op 後處理]
   ├─ B1: split 3×2 → 6 × 512×512 → resize to 256×256 → 填 6 個 state
   ├─ B2: crop/resize → 256×256 → 覆蓋該 state staticBase
   ├─ C:  store as-is 1024×1024 sheet → 覆蓋該 state sheet
   └─ D:  crop/resize → 256×256 → paste 進該 state sheet 的目標 cell
   ↓
[更新 Zustand store → trigger UI re-render + localStorage 自動 save]
```

### Provider 抽象

```ts
interface ImageProvider {
  name: 'codex-image' | 'vertex-gemini' | 'google-gemini' | 'author-fallback'
  generateImage(opts: {
    prompt: string
    references: Blob[]              // 0-N 張參考圖
    outputSize: '1024x1024' | '1024x1536' | '1536x1024'
    quality?: 'standard' | 'high'   // codex 用,Google 忽略
  }): Promise<Blob>                  // PNG Blob
}
```

## 5. Data Model

```ts
// src/types/project.ts

type StateName = 'idle' | 'sleeping' | 'recording' | 'thinking' | 'done' | 'error'

interface CellNote {
  note: string                       // user 寫的 frame N hint(可空)
}

interface SpriteState {
  staticBase: Blob | null            // 256×256 PNG,階段 B 後存在
  sheet: Blob | null                 // 1024×1024 PNG,placeholder 或 animated
  poseNote: string                   // state 級 pose hint
  notes: CellNote[]                  // 16 個(對應 frame 1-16)
  loopMode: 'loop' | 'one-shot'
  loopDurationMs: number
  status: 'pending' | 'placeholder' | 'animated'  // UI 徽章用
}

interface ProjectMetadata {
  packageName: string                // ^[a-z][a-z0-9_]*$ regex 限制
  displayName: string                // UI 顯示名(可中文 / emoji)
  version: string                    // semver
  author: string
  license: string
  description: string
  tags: string[]
}

interface Project {
  characterRef: Blob | null
  states: Record<StateName, SpriteState>
  metadata: ProjectMetadata
}

interface PromptsState {
  templates: {
    B1: string   // 生 6 狀態
    B2: string   // 重生單一靜態
    C:  string   // 動畫化
    D:  string   // 重生單一 frame
  }
  stateSemantics: Record<StateName, string>
}

interface ProviderState {
  active: 'codex-image' | 'vertex-gemini' | 'google-gemini' | 'author-fallback'
  codexImage:    { baseUrl: string, apiKey: string, quality: 'standard' | 'high' }
  vertexGemini:  { apiKey: string, model: string, imageSize: '1K' | '2K' | '4K' }
  googleGemini:  { apiKey: string, model: string, imageSize: '1K' | '2K' | '4K' }
  // authorFallback 不需 config(全部走 env var)
}

interface ChromaState {
  key: 'green' | 'magenta'
  tolerance: 'conservative' | 'balanced' | 'aggressive'
}
```

### 持久化

整個 store 透過 Zustand persist middleware 存 localStorage(debounced 300ms):
- `mori-sprite-studio.project`
- `mori-sprite-studio.prompts`
- `mori-sprite-studio.provider`
- `mori-sprite-studio.chroma`

Blob 序列化:轉成 base64 dataURL 存,讀回時 fetch 成 Blob。

## 6. UI Structure

### 主版面:Sidebar + Main editor

```
┌──────────────┬───────────────────────────────────────┐
│ Sidebar 240px│ Main editor                           │
├──────────────┼───────────────────────────────────────┤
│              │                                       │
│ ⌂ 專案        │   (依 sidebar 選擇切換 view)         │
│ ─────────    │                                       │
│ ◆ idle       │                                       │
│ ◆ sleeping   │                                       │
│ ● recording  │                                       │
│ ● thinking   │                                       │
│ ○ done       │                                       │
│ ○ error      │                                       │
│ ─────────    │                                       │
│ ⤓ 匯出        │                                       │
└──────────────┴───────────────────────────────────────┘

狀態徽章:
  ○ pending      (沒生靜態)
  ● placeholder  (有靜態,sheet 是 16 格同圖)
  ◆ animated     (sheet 是真 4×4 動畫)

Sidebar 每個 state 旁顯小縮圖(staticBase or sheet frame 1),
+ 上面 status 徽章
```

### 8 個 view

#### (a) 「⌂ 專案」 view

```
Character Reference
[拖放或點擊上傳]
[256×256 preview]

[✦ 生 6 狀態靜態] [⚙️]

Metadata
  package_name:  [mori____________]
  display_name:  [Mori_____________]
  version:       [1.0.0_]
  author:        [yazelin____]
  license:       [CC-BY-NC-SA-4.0 ▾]
  description:   [____________________]
  tags:          [fantasy] [elf] [+]

State Semantics(讓 AI 知道每個 state 該長啥)
  idle:      [relaxed standing, neutral_____]
  sleeping:  [eyes closed, peaceful_________]
  recording: [alert, attentive, listening__]
  thinking:  [one hand near chin, head tilt_]
  done:      [happy, relieved smile_________]
  error:     [concerned expression__________]
  [全部回預設]

AI Provider(4 選 1,radio)
  ( ● ) Author Fallback   (預設,免設定)
  ( ○ ) Codex-Image       (你的 ChatGPT 訂閱)
  ( ○ ) Vertex Gemini     (Google Cloud)
  ( ○ ) Google Gemini Direct  (AI Studio)
  [展開選中 provider 的 config 欄位]
  [測試連線]

Background Removal
  Chroma key:  ( ● ) 綠幕 #00FF00
               ( ○ ) 洋紅幕 #FF00FF
  Tolerance:   [balanced ▾]
```

#### (b) 「◆ <state>」 view

```
idle  ◆ animated                         [✦ 重生此 state 靜態] [⚙️]
                                         [✦ 生 idle 動畫]      [⚙️]

┌─────────┐  ┌──────────────────────────┐
│ 靜態 base│  │  4×4 Sheet (1024×1024)   │
│ 256×256 │  │  ┌──┬──┬──┬──┐          │
└─────────┘  │  │ 1│ 2│ 3│ 4│ ← cell    │
              │  ├──┼──┼──┼──┤   點選   │
Pose Note    │  │ 5│ 6│ 7│ 8│           │
┌─────────┐  │  ├──┼──┼──┼──┤           │
│「站姿、頭│  │  │ 9│10│11│12│           │
│ 微抬」  │  │  ├──┼──┼──┼──┤           │
└─────────┘  │  │13│14│15│16│           │
              │  └──┴──┴──┴──┘          │
Loop mode    │                            │
[loop ▾]     │  Loop preview              │
             │  [▶ 256×256 跑 16 frame]  │
Duration     │  ms slider: [===●===] 3000│
3000 ms      └──────────────────────────┘

─── Cell 選取後 ───(預設 collapsed)
Frame N (e.g. Frame 8)
Cell note: [____________________]
[✦ 重生此 frame] [⚙️]
```

#### (c) 「⤓ 匯出」 view

```
完成度 check
  idle      ◆ animated  ✓
  sleeping  ◆ animated  ✓
  recording ● placeholder ⚠
  thinking  ◆ animated  ✓
  done      ○ pending    ✗
  error     ◆ animated  ✓

Metadata check
  package_name      ✓ "mori"
  display_name      ✓ "Mori"
  version           ✓ "1.0.0"
  author            ✓ "yazelin"
  license           ✓ "CC-BY-NC-SA-4.0"

manifest.json 預覽
{ ... }

⚠ done state 還沒生靜態,匯出會缺 done.png
  (mori-desktop 載入時會 fallback default)

[⤓ 匯出 mori.moripack.zip]
```

### Prompt Editor Modal(每個 ✦ 按鈕旁 ⚙️ 開啟)

```
┌─ 編輯 Prompt:<op 名稱>(模板 <B1/B2/C/D>)─ ✕ ┐
│                                                  │
│ 可用變數(綠色顯示當前 context 值)               │
│   {{state_name}}      → "idle"                   │
│   {{pose_note}}       → "..."                    │
│   {{state_semantics}} → "..."                    │
│   ...                                            │
│                                                  │
│ Template (editable)                              │
│ ┌──────────────────────────────────────────┐    │
│ │ <multiline textarea>                      │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Auto-appended (chroma key suffix, 不可改)        │
│ ┌──────────────────────────────────────────┐    │
│ │ Background: pure solid green (#00FF00)... │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Rendered preview (實際送 AI 的內容)              │
│ ┌──────────────────────────────────────────┐    │
│ │ <template + suffix 合成>                  │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ [回預設]                                         │
│                          [取消]   [儲存]         │
│                          [儲存並立即生圖 ✦]      │
│ [📋 複製 Prompt + 下載 Ref,自己跑 → 上傳 ⤴]    │
└──────────────────────────────────────────────────┘
```

按 BYOG 按鈕 → modal 轉「收料模式」(見 §7.3)。

## 7. AI Integration

### 7.1 4 個 Provider

| Provider | Endpoint | Auth | 備註 |
|---|---|---|---|
| Codex-Image | `POST {baseUrl}/v1/images/generate` | `Authorization: Bearer cimg_<key>` | yazelin 自架 FastAPI 包 Codex CLI |
| Vertex Gemini | `POST aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent?key=<key>` | URL query `?key=` | Vertex AI Express Mode |
| Google Gemini Direct | `POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=<key>` | URL query `?key=` | AI Studio |
| Author Fallback | `POST /api/generate`(same origin) | n/a(server-side env var) | Vercel Function 內部走 Vertex 或 Google Direct,看 env var |

#### Codex-Image body

```json
{
  "prompt": "...",
  "size": "1024x1024" | "1024x1536" | "1536x1024",
  "quality": "standard" | "high",
  "count": 1,
  "reference_images_base64": ["base64...", ...]
}
```

Response: `{ images: [{ url }] }` → fetch URL 拿 PNG。

#### Vertex / Google Gemini body(共用)

```json
{
  "contents": [{
    "role": "user",
    "parts": [
      { "inlineData": { "mimeType": "image/png", "data": "<base64>" } },
      ...
      { "text": "<prompt>" }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": {
      "aspectRatio": "1:1" | "3:2" | "2:3",
      "imageSize": "1K" | "2K" | "4K"
    }
  }
}
```

Response: `candidates[0].content.parts[*].inlineData` → base64 PNG。

兩個 Google 系 provider 共用 `GoogleGeminiBaseProvider` abstract class,只差 endpoint URL。

#### Author Fallback(Vercel Function)

```ts
// api/generate.ts
export default async function handler(req, res) {
  const provider = process.env.AUTHOR_FALLBACK_PROVIDER ?? 'vertex-gemini'
  const apiKey = process.env.AUTHOR_API_KEY
  const model = process.env.AUTHOR_MODEL ?? 'gemini-3-pro-image-preview'
  const imageSize = process.env.AUTHOR_IMAGE_SIZE ?? '1K'
  
  if (!apiKey) return res.status(503).json({ error: 'Author key not configured' })
  
  // 收 frontend 送來的 { prompt, references: base64[], outputSize }
  // 組 Google Gemini body
  // 走 Vertex 或 Google Direct endpoint
  // 回 { mimeType, data } 給 frontend
}
```

Env vars(`.env.local` 本地 / Vercel Dashboard 雲端):

```
AUTHOR_FALLBACK_PROVIDER=vertex-gemini    # 或 google-gemini
AUTHOR_API_KEY=AIza...
AUTHOR_MODEL=gemini-3-pro-image-preview   # 可選
AUTHOR_IMAGE_SIZE=1K                      # 可選
```

⚠️ **MVP 不加 rate limit / captcha**(API 介面預留,未來公開分享 URL 時加 Upstash Redis 算 quota)。

### 7.2 Size 對應表

| 操作 | outputSize | Codex `size` | Vertex/Google `aspectRatio` | 用途 |
|---|---|---|---|---|
| B1 生 6 狀態 | `1536x1024` | `1536x1024` | `3:2` | 3 col × 2 row of 512×512 cells |
| B2 重生靜態 | `1024x1024` | `1024x1024` | `1:1` | 單一姿勢,後 crop to 256×256 |
| C 動畫化 | `1024x1024` | `1024x1024` | `1:1` | 4×4 sheet 直對 mori-desktop spec |
| D 重生 frame | `1024x1024` | `1024x1024` | `1:1` | 單一 frame,後 crop to 256×256 |

### 7.3 BYOG 模式(第 5 條路)

任何 ✦ 按鈕的 Prompt Editor modal 都能切到 BYOG 模式 → 不走 API,user 自己跑 AI 後上傳結果。

```
[📋 複製 Prompt + 下載 Ref] 按鈕觸發:
  1. prompt rendered 字串 → navigator.clipboard.writeText
  2. references 各自下載成 PNG 檔(<state>-static-base.png 等)
  3. Modal 轉「收料模式」UI
```

收料模式 UI:

```
┌─ BYOG 模式 ──────────────────────────────────┐
│ ✓ Prompt 已複製到剪貼簿                       │
│ ✓ Reference 圖已下載                          │
│                                              │
│ 預期輸出:                                      │
│   • <size>(根據 op 不同)                     │
│   • <layout 說明>(grid / 單圖)              │
│   • 背景純綠 #00FF00 或洋紅 #FF00FF          │
│                                              │
│ ┌── ⬇ 拖檔或點此上傳結果 ⬇ ──┐               │
│ │            [↑]               │              │
│ └──────────────────────────────┘              │
│                                              │
│ ☐ 背景已是透明,跳過 chroma key              │
│                                              │
│ [取消,回 Prompt 編輯]                       │
└─────────────────────────────────────────────┘
```

上傳結果 → 套相同後處理 pipeline(chroma key + split / crop / resize)→ 進 store。

### 7.4 CORS 狀態表

| Provider | Browser CORS | 風險 |
|---|---|---|
| Codex-Image | 需 yazelin 自架 server 設 allow | 中(需手動配 CORS) |
| Vertex Gemini | **未驗證**,可能 OK 也可能擋 | 不確定 |
| Google Gemini Direct | 應該 OK(AI Studio 設計給 client) | 低 |
| Author Fallback | ✅ same-origin,**0 CORS 問題** | 無 |

Author Fallback 是 fallback-of-last-resort:任何 CORS 問題它都可繞。

## 8. Prompt System

### 8.1 4 個 Template

`src/defaults/prompts.ts` 內建預設,user 可改、可回預設,改完即時生效(debounce 300ms 存 localStorage)。

#### Template B1(生 6 狀態 2×3 grid → 3 col × 2 row layout)

```
A 3-column × 2-row grid layout (3 wide, 2 tall, total 1536×1024) showing 6 
poses of the same character on solid green background. Each cell is 
512×512 and contains the full character.

The 6 poses, in row-major order (left-to-right, top-to-bottom):
{{state_descriptions}}

Style: Match the reference character exactly — same hair, same clothes,
same color palette. Only the pose / expression changes.
```

`{{state_descriptions}}` 自動展開為:
```
  Cell 1 (idle):      {{state_semantics.idle}}
  Cell 2 (sleeping):  {{state_semantics.sleeping}}
  Cell 3 (recording): {{state_semantics.recording}}
  Cell 4 (thinking):  {{state_semantics.thinking}}
  Cell 5 (done):      {{state_semantics.done}}
  Cell 6 (error):     {{state_semantics.error}}
```

#### Template B2(重生單一靜態)

```
A single character pose for state "{{state_name}}", on solid green 
background. Character centered in a 1024×1024 area.

State semantics: {{state_semantics}}
Pose hint: {{pose_note}}

Style: Match the reference character exactly.
```

#### Template C(動畫化 4×4 sheet)

```
A 4×4 grid sprite sheet (1024×1024 total, each cell 256×256) showing a 
16-frame animation of state "{{state_name}}" for the reference character.

Frame order: left-to-right, top-to-bottom (row-major).
Pose: {{pose_note}}
Loop mode: {{loop_mode}}
  - If "loop": frame 1 and frame 16 must connect seamlessly
  - If "one-shot": frame 16 is the final pose

Frame-by-frame hints (空白表示 AI 自由發揮中間幀):
{{cell_notes_block}}

Solid green background. Character must NOT contain pure green.
```

`{{cell_notes_block}}` 自動展開為:
```
  Frame 1:  {{notes[0]}}
  Frame 2:  {{notes[1]}}
  ...
  Frame 16: {{notes[15]}}
```

#### Template D(重生單一 frame)

```
A single 256×256 frame, intermediate pose between the previous and next 
frames provided (3 reference images: static base, previous frame, next 
frame).

State: {{state_name}} - {{state_semantics}}
Frame index: {{frame_index}} of 16
Frame note: {{cell_note}}

Must blend visually with neighbors (smooth animation transition).
Solid green background.
```

### 8.2 Chroma Key Auto-suffix

所有 4 個 template 在送 AI 前自動 append(user 不可改):

```
Background: pure solid {{chroma_color}} (#{{chroma_hex}}) covering 100% 
of the canvas edge-to-edge. No shadow, no gradient, no noise, no texture. 
The character must NOT contain this exact color anywhere.
```

`{{chroma_color}}` = `green` 或 `magenta`,`{{chroma_hex}}` = `00FF00` 或 `FF00FF`,根據 user 選擇。

### 8.3 變數插槽

| 變數 | 哪個 template 用 | 來源 |
|---|---|---|
| `{{state_descriptions}}` | B1 | 6 個 state 語意拼成清單 |
| `{{state_name}}` | B2 / C / D | 該 state 名 |
| `{{state_semantics}}` | B2 / D | 該 state 的語意設定 |
| `{{pose_note}}` | B2 / C | 該 state poseNote 欄位 |
| `{{cell_notes_block}}` | C | 16 cell notes 自動拼 |
| `{{cell_note}}` | D | 單一 cell 的 note |
| `{{frame_index}}` | D | 該 cell 編號(1-16) |
| `{{loop_mode}}` | C | 該 state loopMode |
| `{{chroma_color}}` `{{chroma_hex}}` | auto-suffix | chroma 設定 |

未知變數(typo / 不存在)原樣保留送 AI,**不報錯**。

## 9. Chroma Key Background Removal

### 9.1 為什麼

gpt-image-2 沒有 transparent 背景參數(`background` 只接 `auto` / `opaque`)。Gemini 也沒原生支援透明背景。所以 **2 個 provider 都用同樣策略**:

1. Prompt 要求 AI 用純色背景(綠 / 洋紅)
2. Client 端 pixel-level chroma key 去背
3. 輸出透明 PNG

沿用 line-sticker-studio 的最終方案(他們從 `@imgly/background-removal` ML 模型遷到 chroma key)。

### 9.2 演算法

```ts
// src/lib/chromaKey.ts
function chromaKeyOut(
  src: Blob,
  keyRgb: [number, number, number],   // [0, 255, 0] for green
  tolerance: 'conservative' | 'balanced' | 'aggressive'
): Promise<Blob> {
  // 1. Load src into canvas, getImageData
  // 2. For each pixel:
  //    - distance = euclideanDistance([r,g,b], keyRgb)
  //    - if distance < hardThreshold:        alpha = 0   (fully remove)
  //    - elif distance < softThreshold:      alpha = 255 * t  (soft edge)
  //    - else:                               alpha = original (keep)
  // 3. putImageData → toBlob('image/png')
}
```

Threshold 對應(可調):

| tolerance | hardThreshold | softThreshold |
|---|---|---|
| conservative | 30 | 60 |
| balanced | 50 | 100 |
| aggressive | 80 | 160 |

預設 `balanced`。

### 9.3 BYOG 模式 skip chroma key

User 勾「背景已是透明」就跳過 chroma key 處理,直接走 split / crop。

## 10. Export Format

### 10.1 ZIP 結構

```
mori.moripack.zip
├── manifest.json
└── sprites/
    ├── idle.png        ← 1024×1024 4×4 sheet, PNG-32 RGBA, transparent
    ├── sleeping.png
    ├── recording.png
    ├── thinking.png
    ├── done.png
    └── error.png
```

`walking.png` / `dragging.png` 是 optional state,MVP 不產(寫進 manifest 的 `optional_states` 留 spec 相容性)。

### 10.2 manifest.json schema(v1.0)

完全照 `~/mori-universe/mori-desktop/docs/character-pack.md` v1.0。

```json
{
  "schema_version": "1.0",
  "package_name": "mori",
  "display_name": "Mori",
  "version": "1.0.0",
  "author": "yazelin",
  "license": "CC-BY-NC-SA-4.0",
  "description": "森林精靈,Mori-desktop 預設角色",
  "tags": ["fantasy", "elf", "cute", "official"],
  "states": ["idle", "sleeping", "recording", "thinking", "done", "error"],
  "optional_states": ["walking", "dragging"],
  "loop_modes": {
    "idle":      "loop",
    "sleeping":  "loop",
    "recording": "loop",
    "thinking":  "loop",
    "done":      "one-shot",
    "error":     "one-shot"
  },
  "loop_durations_ms": {
    "idle":      3000,
    "sleeping":  5000,
    "recording": 1500,
    "thinking":  2000,
    "done":      600,
    "error":     800
  },
  "sprite_spec": {
    "format":      "PNG-32",
    "grid":        "4x4",
    "total_size":  "1024x1024",
    "frame_size":  "256x256",
    "frame_order": "row-major-left-to-right-top-to-bottom",
    "background":  "transparent"
  }
}
```

### 10.3 驗證規則

| 規則 | 等級 | 行為 |
|---|---|---|
| `package_name` 非空且 `^[a-z][a-z0-9_]*$` | **blocking** | 不能匯出 |
| `display_name` 非空 | **blocking** | 不能匯出 |
| `version` semver 格式 | warning | 仍可匯出 |
| 6 state sheet 至少 1 個 | **blocking** | 全空無意義 |
| 6 state sheet 全 animated | warning | 缺的 fallback default |
| `loop_durations_ms` 100-30000 範圍 | warning | 超出提示 |

### 10.4 placeholder 自動升級(corner case)

若某 state 只有 `staticBase` 沒 `sheet`(中途 reset),export 前自動把 `staticBase` 升 placeholder 4×4 sheet(16 格全填 static base),跟 mori-desktop 的 `character_upgrade_pack_to_4x4` 同邏輯。

## 11. Project Structure / Tech Stack

### 11.1 目錄樹

```
mori-sprite-studio/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── vercel.json                              # SPA rewrites + api/ config
├── .env.example                             # env var 範本
├── .gitignore
├── index.html
├── README.md
├── api/
│   └── generate.ts                          # Vercel Function: author fallback proxy
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx                             # Entry
│   ├── App.tsx                              # Layout shell
│   ├── views/                               # Sidebar 對應的主編輯區
│   │   ├── ProjectView.tsx                  # ⌂ 專案
│   │   ├── StateView.tsx                    # ◆ 6 state 共用
│   │   └── ExportView.tsx                   # ⤓ 匯出
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── UploadDropzone.tsx
│   │   ├── SpriteSheetPreview.tsx
│   │   ├── AnimationPreview.tsx
│   │   ├── PromptEditorModal.tsx
│   │   ├── ByogReceiveModal.tsx             # BYOG 收料模式(modal 內子 view)
│   │   ├── FileUploadDropzone.tsx
│   │   ├── CellEditor.tsx
│   │   ├── ProviderConfig.tsx
│   │   ├── ChromaConfig.tsx
│   │   ├── MetadataForm.tsx
│   │   ├── StateSemanticsTable.tsx
│   │   └── GenerateButton.tsx               # [✦] + [⚙️] 通用
│   ├── store/                               # Zustand slices
│   │   ├── index.ts                         # combined store
│   │   ├── projectSlice.ts
│   │   ├── statesSlice.ts
│   │   ├── promptsSlice.ts
│   │   ├── providerSlice.ts
│   │   ├── chromaSlice.ts
│   │   └── persist.ts                       # localStorage middleware
│   ├── providers/
│   │   ├── ImageProvider.ts                 # interface
│   │   ├── codexImageProvider.ts
│   │   ├── googleGeminiBaseProvider.ts      # abstract base
│   │   ├── vertexGeminiProvider.ts          # extends base
│   │   ├── googleGeminiProvider.ts          # extends base
│   │   ├── authorFallbackProvider.ts        # 走 /api/generate
│   │   └── index.ts                         # factory
│   ├── lib/
│   │   ├── promptRenderer.ts                # render(template, vars) → string
│   │   ├── chromaKey.ts                     # 去背演算法
│   │   ├── imageOps.ts                      # split 3×2 / 4×4, crop, resize
│   │   ├── byogPipeline.ts                  # BYOG 結果套後處理
│   │   ├── downloadRefs.ts                  # 把 ref Blob 包成檔下載
│   │   ├── exportPack.ts                    # buildManifest + JSZip
│   │   ├── validation.ts                    # regex / blocking checks
│   │   └── manifest.ts                      # manifest builder + type
│   ├── defaults/
│   │   ├── prompts.ts                       # 4 template 預設
│   │   ├── semantics.ts                     # 6 state 語意預設
│   │   ├── loopConfig.ts                    # loop_modes / loop_durations_ms 預設
│   │   ├── chromaKey.ts                     # 綠 + balanced 預設
│   │   ├── metadata.ts                      # package_name=mori 等預設
│   │   └── provider.ts                      # provider 預設 config
│   ├── types/
│   │   ├── project.ts
│   │   ├── manifest.ts
│   │   └── provider.ts
│   └── styles/
│       └── sprite-anim.css                  # 跟 mori-desktop floating.css 一致
└── tests/
    ├── chromaKey.test.ts
    ├── promptRenderer.test.ts
    ├── exportPack.test.ts                   # 確保 manifest schema 過 mori-desktop
    ├── manifest.test.ts
    └── imageOps.test.ts
```

### 11.2 Tech stack 鎖定

| 層 | 選擇 | 版本 |
|---|---|---|
| Build | Vite + React + TS | Vite ^5.4, React ^18.3, TS ^5.5 |
| UI | Tailwind + shadcn/ui | Tailwind ^3.4 |
| State | Zustand | ^4.5 |
| 圖像 | 原生 Canvas API | n/a |
| 動畫預覽 | CSS animation | n/a |
| ZIP | jszip + file-saver | ^3.10 / ^2.0 |
| Fetch | 原生 `fetch` | n/a |
| Server | Vercel Function | `@vercel/node` ^3.2 |
| 測試 | Vitest + Testing Library | ^2.0 / ^16.0 |
| Debounce | use-debounce | ^10.0 |

### 11.3 package.json deps

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "jszip": "^3.10.0",
    "file-saver": "^2.0.5",
    "use-debounce": "^10.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/file-saver": "^2.0.7",
    "@vitejs/plugin-react": "^4.3.0",
    "@vercel/node": "^3.2.0",
    "vite": "^5.4.0",
    "vercel": "^37.0.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

shadcn/ui 用 CLI 安裝(`npx shadcn-ui@latest add button` 等),不寫進 deps。

## 12. Deployment

### 12.1 本地開發

```bash
# 第一次安裝
npm install -g vercel
npm install

# .env.local 設 author key(若想試 author fallback)
cp .env.example .env.local
# 編輯 .env.local 填 AUTHOR_API_KEY

# 跑
vercel dev          # localhost:3000(同時跑 Vite + api/)
```

### 12.2 雲端部署

```bash
vercel --prod
```

Env vars 在 Vercel Dashboard → Settings → Environment Variables 設:

```
AUTHOR_FALLBACK_PROVIDER=vertex-gemini
AUTHOR_API_KEY=<sensitive>
AUTHOR_MODEL=gemini-3-pro-image-preview
AUTHOR_IMAGE_SIZE=1K
```

### 12.3 `.env.example`

```
# 預設 Provider:vertex-gemini | google-gemini
AUTHOR_FALLBACK_PROVIDER=vertex-gemini

# 對應 provider 的 API key
# Vertex: 從 console.cloud.google.com/vertex-ai/express 拿
# Google Direct: 從 aistudio.google.com 拿
AUTHOR_API_KEY=

# (可選)指定 model
AUTHOR_MODEL=gemini-3-pro-image-preview

# (可選)Image size
AUTHOR_IMAGE_SIZE=1K
```

## 13. Defaults

### 13.1 Metadata 預設

```ts
{
  packageName: 'mori',
  displayName: 'Mori',
  version: '1.0.0',
  author: 'yazelin',
  license: 'CC-BY-NC-SA-4.0',
  description: '森林精靈,Mori-desktop 預設角色',
  tags: ['fantasy', 'elf', 'cute', 'official'],
}
```

### 13.2 State 預設

```ts
{
  loopModes: {
    idle:      'loop',
    sleeping:  'loop',
    recording: 'loop',
    thinking:  'loop',
    done:      'one-shot',
    error:     'one-shot',
  },
  loopDurationsMs: {
    idle:      3000,
    sleeping:  5000,
    recording: 1500,
    thinking:  2000,
    done:      600,
    error:     800,
  },
}
```

### 13.3 State Semantics 預設(英文,給 AI prompt 用)

```ts
{
  idle:      'relaxed standing pose, neutral expression, arms slightly relaxed at sides',
  sleeping:  'eyes closed, peaceful expression, can be sitting or gently floating, slight head tilt',
  recording: 'alert and attentive, slight forward lean, ears or head perked up listening',
  thinking:  'one hand near chin or temple, head slightly tilted, contemplative expression',
  done:      'happy and relieved expression, slight upward gesture or open smile',
  error:     'concerned or confused expression, slight cower or hands up in puzzlement',
}
```

### 13.4 Chroma 預設

```ts
{
  key: 'green',           // #00FF00
  tolerance: 'balanced',  // hard=50, soft=100
}
```

### 13.5 Provider 預設

```ts
{
  active: 'author-fallback',
  codexImage:    { baseUrl: 'https://ching-tech.ddns.net/codex-image', apiKey: '', quality: 'standard' },
  vertexGemini:  { apiKey: '', model: 'gemini-3-pro-image-preview',    imageSize: '1K' },
  googleGemini:  { apiKey: '', model: 'gemini-2.5-flash-image',         imageSize: '1K' },
}
```

## 14. Known Follow-ups(MVP 排除,值得記)

1. **Walking / dragging optional states** — manifest 已標 optional,後期加 generation flow
2. **Author Fallback rate limit / Turnstile** — 公開分享 URL 時加(Upstash Redis quota / IP-based / UTC reset)
3. **`.moripack.zip` import 衝突處理** — 跟 mori-desktop 內建 default `mori/` 同名時的 conflict resolution(目前由 mori-desktop 那邊負責)
4. **Vertex Gemini browser CORS 驗證** — MVP 先試直連,擋了改 Codex 或 Google Direct 或加 Vercel Function proxy
5. **Frame-level canvas 塗鴉編輯** — 若 BYOG + 重生都不夠,加 Konva.js 塗改層
6. **多角色 library / marketplace** — 將來支援 import 既有 `.moripack.zip` 編輯、共享角色 library
7. **Prompt 版本歷史** — 讓 user 比對「我上次改 prompt 之前生的圖」跟現在差異

## 15. 重要 Anchor / 對齊文件

- **mori-desktop sprite spec**:`~/mori-universe/mori-desktop/docs/floating-sprite-spec.md`
- **mori-desktop character pack 規格**:`~/mori-universe/mori-desktop/docs/character-pack.md`(v1.0,本工具 100% 對齊)
- **參考實作:line-sticker-studio**:`~/line-sticker-studio/`(BYOG 模式 + chroma key 思路源頭)
- **參考實作:ctos-lite**:`~/SDD/ctos-lite/backend/src/ctos_lite/services/mcp_server.py`(codex-image-service / Vertex 整合源頭)
