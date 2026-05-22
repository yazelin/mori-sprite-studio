# Mori Sprite Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based first-party tool that lets a user produce mori-desktop-compliant `.moripack.zip` character packs from a single character reference image, using 7 AI calls (1 for 6-state grid + 6 for animations) and optional per-frame regeneration.

**Architecture:** Vite + React + TypeScript SPA with a single Vercel Function (`api/generate.ts`) for the author-fallback proxy. Zustand for state, localStorage for persistence. 4 swappable image providers (Codex-Image, Vertex Gemini, Google Gemini Direct, Author Fallback) plus a BYOG (Bring Your Own Generation) path. Chroma-key client-side background removal because neither gpt-image-2 nor Gemini supports native transparent output.

**Tech Stack:** Vite ^5.4, React ^18.3, TypeScript ^5.5, Tailwind ^3.4, shadcn/ui, Zustand ^4.5, jszip ^3.10, file-saver, use-debounce, Vitest, @vercel/node.

**Spec reference:** `docs/superpowers/specs/2026-05-22-mori-sprite-studio-design.md`

---

## File Structure

Files this plan will create. One responsibility per file.

### Root config
- `package.json` — deps + npm scripts
- `tsconfig.json` — strict TS, path alias `@/*` → `src/*`
- `tsconfig.node.json` — for `vite.config.ts`
- `vite.config.ts` — Vite + React plugin + path alias
- `tailwind.config.ts` — Tailwind content paths
- `postcss.config.js` — PostCSS plugins
- `vercel.json` — SPA rewrites + `api/` config
- `.env.example` — author-fallback env vars template
- `.gitignore` — already exists, may need additions
- `index.html` — Vite entry
- `components.json` — shadcn/ui config
- `README.md` — project doc

### Vercel Function
- `api/generate.ts` — author-fallback proxy (forwards to Vertex or Google Direct)

### Types
- `src/types/project.ts` — `StateName`, `SpriteState`, `Project`, `ProjectMetadata`
- `src/types/provider.ts` — `ProviderName`, `ProviderState`, `GenerateOpts`
- `src/types/manifest.ts` — `ManifestV1`
- `src/types/prompts.ts` — `PromptsState`, `TemplateKey`
- `src/types/chroma.ts` — `ChromaState`

### Defaults
- `src/defaults/metadata.ts` — packageName="mori", etc.
- `src/defaults/loopConfig.ts` — loop_modes / loop_durations_ms
- `src/defaults/semantics.ts` — 6 state English semantic descriptions
- `src/defaults/prompts.ts` — 4 template strings (B1/B2/C/D)
- `src/defaults/chromaKey.ts` — `{ key: 'green', tolerance: 'balanced' }`
- `src/defaults/provider.ts` — per-provider default config
- `src/defaults/index.ts` — re-exports

### Store (Zustand slices)
- `src/store/projectSlice.ts` — character ref, metadata, states
- `src/store/statesSlice.ts` — per-state staticBase/sheet/notes/poseNote (inside Project slice — see Task 8)
- `src/store/promptsSlice.ts` — templates + stateSemantics
- `src/store/providerSlice.ts` — active provider + per-provider config
- `src/store/chromaSlice.ts` — chroma key + tolerance
- `src/store/persist.ts` — localStorage middleware + Blob (de)serialization
- `src/store/index.ts` — combined store + selectors

### Libraries (pure functions)
- `src/lib/chromaKey.ts` — pixel-level chroma key removal
- `src/lib/imageOps.ts` — splitGrid, cropToSize, resizeBlob, pasteIntoSheet
- `src/lib/promptRenderer.ts` — `render(template, vars) → string`
- `src/lib/manifest.ts` — `buildManifest(project) → ManifestV1`
- `src/lib/validation.ts` — packageName regex + blocking/warning rules
- `src/lib/exportPack.ts` — JSZip pack + download trigger
- `src/lib/downloadRefs.ts` — package reference Blobs as separate downloads
- `src/lib/byogPipeline.ts` — apply chroma + split/crop to BYOG upload
- `src/lib/blobUtils.ts` — blobToBase64 / base64ToBlob / dataUrlToBlob
- `src/lib/colorUtils.ts` — chroma color → hex/rgb lookup

### Providers
- `src/providers/ImageProvider.ts` — interface + shared types
- `src/providers/codexImageProvider.ts` — POST /v1/images/generate
- `src/providers/googleGeminiBaseProvider.ts` — abstract base (Vertex + Google Direct share body)
- `src/providers/vertexGeminiProvider.ts` — Vertex endpoint
- `src/providers/googleGeminiProvider.ts` — Google AI Studio endpoint
- `src/providers/authorFallbackProvider.ts` — POST /api/generate
- `src/providers/index.ts` — factory + active resolver

### Views
- `src/views/ProjectView.tsx` — ⌂ upload + metadata + semantics + provider + chroma + B1 button
- `src/views/StateView.tsx` — ◆ per-state editor (params from store)
- `src/views/ExportView.tsx` — ⤓ completeness check + manifest preview + download

### Components
- `src/components/Sidebar.tsx` — 8-item nav with state badges
- `src/components/UploadDropzone.tsx` — drag/click upload (reused by character ref AND BYOG receive)
- `src/components/SpriteSheetPreview.tsx` — 4×4 grid view with cell click
- `src/components/AnimationPreview.tsx` — CSS animation runner
- `src/components/PromptEditorModal.tsx` — ⚙️ inline editor + BYOG mode switch
- `src/components/ByogReceiveView.tsx` — collapsible sub-view inside modal
- `src/components/CellEditor.tsx` — cell note + [✦ 重生此 frame] button
- `src/components/ProviderConfig.tsx` — radio + per-provider field panels
- `src/components/ChromaConfig.tsx` — green/magenta + tolerance
- `src/components/MetadataForm.tsx` — package_name/display_name/etc fields
- `src/components/StateSemanticsTable.tsx` — 6 editable rows
- `src/components/GenerateButton.tsx` — `[✦ <label>] [⚙️]` pair
- `src/components/StatusBadge.tsx` — ○/●/◆
- `src/components/ui/*` — shadcn primitives (button, input, label, dialog, dropdown, etc.) added via CLI

### App shell
- `src/main.tsx` — ReactDOM.render
- `src/App.tsx` — top-level shell, view router
- `src/index.css` — Tailwind directives + global styles
- `src/styles/sprite-anim.css` — matches mori-desktop floating.css

### Tests
- `tests/chromaKey.test.ts`
- `tests/imageOps.test.ts`
- `tests/promptRenderer.test.ts`
- `tests/manifest.test.ts`
- `tests/validation.test.ts`
- `tests/exportPack.test.ts`
- `tests/blobUtils.test.ts`
- `tests/persist.test.ts`

---

## Conventions

- **Imports**: use `@/*` path alias for everything under `src/`
- **TDD**: pure utility libs (`src/lib/*`, types) use full red-green-refactor; UI components use "implement → manually verify in browser → commit"
- **Commits**: one per task minimum; squash optional later
- **Test framework**: Vitest (`npm test` runs once, `npm test -- --watch` for watch)
- **Run dev**: `vercel dev` (NOT `vite dev`) so `api/` is available
- **Browser test target**: localhost:3000 (Vercel's default port)

---

## Milestone 1 — Scaffold (Tasks 1-5)

### Task 1: Create Vite + React + TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Init Vite project (non-interactive)**

Run from `/home/ct/mori-universe/mori-sprite-studio/`:

```bash
npm create vite@latest . -- --template react-ts
```

If npm asks about non-empty directory, accept ("Ignore files and continue").

Expected: creates `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `public/`, `index.html`.

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, `package-lock.json` created.

- [ ] **Step 3: Replace src/App.tsx with stub**

Write `src/App.tsx`:

```tsx
export default function App() {
  return <div className="p-4">Mori Sprite Studio</div>
}
```

- [ ] **Step 4: Verify dev server boots**

```bash
npm run dev
```

Expected: prints `Local: http://localhost:5173/` and serves the stub. Open in browser to confirm "Mori Sprite Studio" appears. Then `Ctrl-C` to stop.

- [ ] **Step 5: Add path alias `@/*` to tsconfig.json and vite.config.ts**

Edit `tsconfig.json` — add to `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

Edit `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 3000 },
})
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS project"
```

---

### Task 2: Tailwind + shadcn/ui setup

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/lib/utils.ts`
- Modify: `src/index.css`, `tsconfig.json`

- [ ] **Step 1: Install Tailwind + peer deps**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Expected: creates `tailwind.config.js` + `postcss.config.js`.

- [ ] **Step 2: Rename tailwind.config.js → .ts and configure**

Delete `tailwind.config.js`, create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 3: Replace src/index.css with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

html, body, #root { height: 100%; }
body { margin: 0; }
```

- [ ] **Step 4: Verify Tailwind classes work**

Update `src/App.tsx`:

```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <h1 className="text-2xl font-bold text-slate-900">Mori Sprite Studio</h1>
    </div>
  )
}
```

Run `npm run dev` → confirm centered heading + slate background. `Ctrl-C`.

- [ ] **Step 5: Add CSS variable theming for shadcn**

Append to `src/index.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: 0.5rem;
  }
}
```

Then extend `tailwind.config.ts` `theme.extend`:

```ts
theme: {
  extend: {
    colors: {
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      muted: {
        DEFAULT: 'hsl(var(--muted))',
        foreground: 'hsl(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'hsl(var(--accent))',
        foreground: 'hsl(var(--accent-foreground))',
      },
      destructive: {
        DEFAULT: 'hsl(var(--destructive))',
        foreground: 'hsl(var(--destructive-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
  },
},
```

- [ ] **Step 6: Install shadcn deps + create utils.ts**

```bash
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate lucide-react
npm install -D @types/node
```

Add `tailwindcss-animate` to plugins in `tailwind.config.ts`:

```ts
import animate from 'tailwindcss-animate'
// ...
plugins: [animate],
```

Create `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: Create components.json (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 8: Add base shadcn components**

```bash
npx shadcn@latest add button input label dialog dropdown-menu select textarea radio-group checkbox tabs
```

Accept defaults. Creates `src/components/ui/*.tsx`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Tailwind + shadcn/ui setup"
```

---

### Task 3: Vercel config + scripts

**Files:**
- Create: `vercel.json`, `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "rewrites": [
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}
```

This routes everything except `/api/*` to the SPA index.

- [ ] **Step 2: Create .env.example**

```
# Author Fallback Provider config (server-side only, NOT exposed to browser)
# Set in .env.local for local dev, in Vercel Dashboard for cloud.

# Backend choice: "vertex-gemini" or "google-gemini"
AUTHOR_FALLBACK_PROVIDER=vertex-gemini

# API key for the chosen backend:
#   vertex-gemini: console.cloud.google.com/vertex-ai/express
#   google-gemini: aistudio.google.com
AUTHOR_API_KEY=

# (Optional) Model name; must match the chosen provider:
#   vertex-gemini:  gemini-3-pro-image-preview  (default)
#   google-gemini:  gemini-2.5-flash-image      (default)
AUTHOR_MODEL=

# (Optional) Image size: 1K / 2K / 4K
AUTHOR_IMAGE_SIZE=1K
```

- [ ] **Step 3: Install @vercel/node + vercel CLI**

```bash
npm install -D @vercel/node vercel
```

- [ ] **Step 4: Add npm scripts**

Edit `package.json` `scripts` block:

```json
"scripts": {
  "dev": "vercel dev --listen 3000",
  "dev:vite": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "tsc --noEmit"
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Vercel config + dev scripts"
```

---

### Task 4: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest + Testing Library**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
```

- [ ] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Create tests/setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Smoke test that vitest works**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`

Expected: `1 passed`.

- [ ] **Step 5: Delete smoke test + commit setup**

```bash
rm tests/smoke.test.ts
git add -A
git commit -m "feat: Vitest setup"
```

---

### Task 5: README + initial commit

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

---

## Milestone 2 — Types + Defaults (Tasks 6-9)

### Task 6: Type definitions

**Files:**
- Create: `src/types/project.ts`, `src/types/provider.ts`, `src/types/manifest.ts`, `src/types/prompts.ts`, `src/types/chroma.ts`

- [ ] **Step 1: Create src/types/project.ts**

```ts
export type StateName =
  | 'idle' | 'sleeping' | 'recording' | 'thinking' | 'done' | 'error'

export const STATE_NAMES: readonly StateName[] = [
  'idle', 'sleeping', 'recording', 'thinking', 'done', 'error',
] as const

export type SheetStatus = 'pending' | 'placeholder' | 'animated'

export interface SpriteState {
  staticBase: Blob | null      // 256×256 PNG, transparent
  sheet: Blob | null           // 1024×1024 PNG, transparent
  poseNote: string
  notes: string[]              // length 16
  loopMode: 'loop' | 'one-shot'
  loopDurationMs: number
  status: SheetStatus
}

export interface ProjectMetadata {
  packageName: string          // ^[a-z][a-z0-9_]*$
  displayName: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
}

export interface Project {
  characterRef: Blob | null
  states: Record<StateName, SpriteState>
  metadata: ProjectMetadata
}
```

- [ ] **Step 2: Create src/types/provider.ts**

```ts
export type ProviderName =
  | 'codex-image' | 'vertex-gemini' | 'google-gemini' | 'author-fallback'

export type OutputSize = '1024x1024' | '1024x1536' | '1536x1024'
export type Quality = 'standard' | 'high'
export type ImageSize = '1K' | '2K' | '4K'

export interface GenerateOpts {
  prompt: string
  references: Blob[]
  outputSize: OutputSize
  quality?: Quality
}

export interface CodexImageConfig {
  baseUrl: string
  apiKey: string
  quality: Quality
}

export interface GoogleGeminiConfig {
  apiKey: string
  model: string
  imageSize: ImageSize
}

export interface ProviderState {
  active: ProviderName
  codexImage: CodexImageConfig
  vertexGemini: GoogleGeminiConfig
  googleGemini: GoogleGeminiConfig
}
```

- [ ] **Step 3: Create src/types/manifest.ts**

```ts
import type { StateName } from './project'

export interface ManifestV1 {
  schema_version: '1.0'
  package_name: string
  display_name: string
  version: string
  author: string
  license: string
  description: string
  tags: string[]
  states: StateName[]
  optional_states: string[]
  loop_modes: Record<StateName, 'loop' | 'one-shot'>
  loop_durations_ms: Record<StateName, number>
  sprite_spec: {
    format: 'PNG-32'
    grid: '4x4'
    total_size: '1024x1024'
    frame_size: '256x256'
    frame_order: 'row-major-left-to-right-top-to-bottom'
    background: 'transparent'
  }
}
```

- [ ] **Step 4: Create src/types/prompts.ts**

```ts
import type { StateName } from './project'

export type TemplateKey = 'B1' | 'B2' | 'C' | 'D'

export interface PromptsState {
  templates: Record<TemplateKey, string>
  stateSemantics: Record<StateName, string>
}
```

- [ ] **Step 5: Create src/types/chroma.ts**

```ts
export type ChromaKeyName = 'green' | 'magenta'
export type ChromaTolerance = 'conservative' | 'balanced' | 'aggressive'

export interface ChromaState {
  key: ChromaKeyName
  tolerance: ChromaTolerance
}

export const CHROMA_COLORS = {
  green:   { hex: '00FF00', rgb: [0, 255, 0] as [number, number, number], label: '綠幕' },
  magenta: { hex: 'FF00FF', rgb: [255, 0, 255] as [number, number, number], label: '洋紅幕' },
} as const

export const CHROMA_THRESHOLDS = {
  conservative: { hard: 30, soft: 60 },
  balanced:     { hard: 50, soft: 100 },
  aggressive:   { hard: 80, soft: 160 },
} as const
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/
git commit -m "feat: type definitions"
```

---

### Task 7: Default values

**Files:**
- Create: `src/defaults/metadata.ts`, `src/defaults/loopConfig.ts`, `src/defaults/semantics.ts`, `src/defaults/prompts.ts`, `src/defaults/chromaKey.ts`, `src/defaults/provider.ts`, `src/defaults/index.ts`

- [ ] **Step 1: Create src/defaults/metadata.ts**

```ts
import type { ProjectMetadata } from '@/types/project'

export const DEFAULT_METADATA: ProjectMetadata = {
  packageName: 'mori',
  displayName: 'Mori',
  version: '1.0.0',
  author: 'yazelin',
  license: 'CC-BY-NC-SA-4.0',
  description: '森林精靈,Mori-desktop 預設角色',
  tags: ['fantasy', 'elf', 'cute', 'official'],
}
```

- [ ] **Step 2: Create src/defaults/loopConfig.ts**

```ts
import type { StateName } from '@/types/project'

export const DEFAULT_LOOP_MODES: Record<StateName, 'loop' | 'one-shot'> = {
  idle:      'loop',
  sleeping:  'loop',
  recording: 'loop',
  thinking:  'loop',
  done:      'one-shot',
  error:     'one-shot',
}

export const DEFAULT_LOOP_DURATIONS_MS: Record<StateName, number> = {
  idle:      3000,
  sleeping:  5000,
  recording: 1500,
  thinking:  2000,
  done:      600,
  error:     800,
}
```

- [ ] **Step 3: Create src/defaults/semantics.ts**

```ts
import type { StateName } from '@/types/project'

export const DEFAULT_STATE_SEMANTICS: Record<StateName, string> = {
  idle:      'relaxed standing pose, neutral expression, arms slightly relaxed at sides',
  sleeping:  'eyes closed, peaceful expression, can be sitting or gently floating, slight head tilt',
  recording: 'alert and attentive, slight forward lean, ears or head perked up listening',
  thinking:  'one hand near chin or temple, head slightly tilted, contemplative expression',
  done:      'happy and relieved expression, slight upward gesture or open smile',
  error:     'concerned or confused expression, slight cower or hands up in puzzlement',
}
```

- [ ] **Step 4: Create src/defaults/prompts.ts**

```ts
import type { TemplateKey } from '@/types/prompts'

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  B1: `A 3-column × 2-row grid layout (3 wide, 2 tall, total 1536×1024) showing 6 poses of the same character on solid green background. Each cell is 512×512 and contains the full character.

The 6 poses, in row-major order (left-to-right, top-to-bottom):
{{state_descriptions}}

Style: Match the reference character exactly — same hair, same clothes, same color palette. Only the pose / expression changes.`,

  B2: `A single character pose for state "{{state_name}}", on solid green background. Character centered in a 1024×1024 area.

State semantics: {{state_semantics}}
Pose hint: {{pose_note}}

Style: Match the reference character exactly.`,

  C: `A 4×4 grid sprite sheet (1024×1024 total, each cell 256×256) showing a 16-frame animation of state "{{state_name}}" for the reference character.

Frame order: left-to-right, top-to-bottom (row-major).
Pose: {{pose_note}}
Loop mode: {{loop_mode}}
  - If "loop": frame 1 and frame 16 must connect seamlessly
  - If "one-shot": frame 16 is the final pose

Frame-by-frame hints (空白表示 AI 自由發揮中間幀):
{{cell_notes_block}}

Solid green background.`,

  D: `A single 256×256 frame, intermediate pose between the previous and next frames provided (3 reference images: static base, previous frame, next frame).

State: {{state_name}} - {{state_semantics}}
Frame index: {{frame_index}} of 16
Frame note: {{cell_note}}

Must blend visually with neighbors (smooth animation transition).
Solid green background.`,
}

export const CHROMA_SUFFIX_TEMPLATE = `Background: pure solid {{chroma_color}} (#{{chroma_hex}}) covering 100% of the canvas edge-to-edge. No shadow, no gradient, no noise, no texture. The character must NOT contain this exact color anywhere.`
```

- [ ] **Step 5: Create src/defaults/chromaKey.ts**

```ts
import type { ChromaState } from '@/types/chroma'

export const DEFAULT_CHROMA: ChromaState = {
  key: 'green',
  tolerance: 'balanced',
}
```

- [ ] **Step 6: Create src/defaults/provider.ts**

```ts
import type { ProviderState } from '@/types/provider'

export const DEFAULT_PROVIDER_STATE: ProviderState = {
  active: 'author-fallback',
  codexImage: {
    baseUrl: 'https://ching-tech.ddns.net/codex-image',
    apiKey: '',
    quality: 'standard',
  },
  vertexGemini: {
    apiKey: '',
    model: 'gemini-3-pro-image-preview',
    imageSize: '1K',
  },
  googleGemini: {
    apiKey: '',
    model: 'gemini-2.5-flash-image',
    imageSize: '1K',
  },
}
```

- [ ] **Step 7: Create src/defaults/index.ts**

```ts
export * from './metadata'
export * from './loopConfig'
export * from './semantics'
export * from './prompts'
export * from './chromaKey'
export * from './provider'
```

- [ ] **Step 8: Verify lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/defaults/
git commit -m "feat: default values for metadata, loop config, semantics, prompts, chroma, provider"
```

---

### Task 8: Blob utilities + tests (TDD)

**Files:**
- Create: `src/lib/blobUtils.ts`, `tests/blobUtils.test.ts`

- [ ] **Step 1: Write failing tests `tests/blobUtils.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { blobToBase64, base64ToBlob, dataUrlToBlob, blobToDataUrl } from '@/lib/blobUtils'

describe('blobUtils', () => {
  it('blobToBase64 + base64ToBlob round-trip preserves bytes', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' })
    const b64 = await blobToBase64(original)
    const restored = base64ToBlob(b64, 'image/png')
    const buf = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5])
    expect(restored.type).toBe('image/png')
  })

  it('blobToDataUrl + dataUrlToBlob round-trip preserves bytes and mime', async () => {
    const original = new Blob([new Uint8Array([10, 20, 30])], { type: 'image/png' })
    const url = await blobToDataUrl(original)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    const restored = await dataUrlToBlob(url)
    const buf = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(buf)).toEqual([10, 20, 30])
    expect(restored.type).toBe('image/png')
  })
})
```

- [ ] **Step 2: Run tests — confirm fail**

```bash
npm test -- tests/blobUtils.test.ts
```

Expected: fails with "Cannot find module '@/lib/blobUtils'".

- [ ] **Step 3: Implement src/lib/blobUtils.ts**

```ts
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(b64: string, mimeType = 'image/png'): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  const resp = await fetch(url)
  return await resp.blob()
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- tests/blobUtils.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blobUtils.ts tests/blobUtils.test.ts
git commit -m "feat: blobUtils + tests"
```

---

### Task 9: Color utilities

**Files:**
- Create: `src/lib/colorUtils.ts`

- [ ] **Step 1: Implement src/lib/colorUtils.ts**

```ts
import { CHROMA_COLORS, type ChromaKeyName } from '@/types/chroma'

export function chromaInfo(key: ChromaKeyName) {
  return CHROMA_COLORS[key]
}

export function rgbDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/colorUtils.ts
git commit -m "feat: color utilities"
```

---

## Milestone 3 — Store + Persistence (Tasks 10-12)

### Task 10: Install Zustand + create root store with initial state

**Files:**
- Create: `src/store/index.ts`

- [ ] **Step 1: Install Zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Create initial empty SpriteState helper**

This will live inside `src/store/index.ts`. The store seeds 6 states with empty data.

- [ ] **Step 3: Implement src/store/index.ts**

```ts
import { create } from 'zustand'
import type { Project, SpriteState, StateName } from '@/types/project'
import type { ProviderState } from '@/types/provider'
import type { PromptsState } from '@/types/prompts'
import type { ChromaState } from '@/types/chroma'
import {
  DEFAULT_METADATA,
  DEFAULT_LOOP_MODES,
  DEFAULT_LOOP_DURATIONS_MS,
  DEFAULT_STATE_SEMANTICS,
  DEFAULT_TEMPLATES,
  DEFAULT_CHROMA,
  DEFAULT_PROVIDER_STATE,
} from '@/defaults'
import { STATE_NAMES } from '@/types/project'

function emptyState(name: StateName): SpriteState {
  return {
    staticBase: null,
    sheet: null,
    poseNote: '',
    notes: Array(16).fill(''),
    loopMode: DEFAULT_LOOP_MODES[name],
    loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[name],
    status: 'pending',
  }
}

function initialProject(): Project {
  const states = {} as Record<StateName, SpriteState>
  for (const n of STATE_NAMES) states[n] = emptyState(n)
  return {
    characterRef: null,
    states,
    metadata: { ...DEFAULT_METADATA, tags: [...DEFAULT_METADATA.tags] },
  }
}

function initialPrompts(): PromptsState {
  return {
    templates: { ...DEFAULT_TEMPLATES },
    stateSemantics: { ...DEFAULT_STATE_SEMANTICS },
  }
}

export type View = { kind: 'project' } | { kind: 'state'; name: StateName } | { kind: 'export' }

interface UIState {
  view: View
  selectedCell: number | null   // 0-15 when a cell in StateView is clicked
}

export interface AppStore {
  project: Project
  prompts: PromptsState
  provider: ProviderState
  chroma: ChromaState
  ui: UIState

  // actions (defined in subsequent tasks; here we declare names so types compile)
  setView: (view: View) => void
  selectCell: (cell: number | null) => void
  setCharacterRef: (blob: Blob | null) => void
  updateMetadata: (patch: Partial<Project['metadata']>) => void
  updateState: (name: StateName, patch: Partial<SpriteState>) => void
  setStateNote: (name: StateName, index: number, note: string) => void
  setStateSemantics: (name: StateName, value: string) => void
  setTemplate: (key: keyof PromptsState['templates'], value: string) => void
  resetTemplate: (key: keyof PromptsState['templates']) => void
  setProviderActive: (name: ProviderState['active']) => void
  updateProviderConfig: <K extends Exclude<keyof ProviderState, 'active'>>(
    name: K,
    patch: Partial<ProviderState[K]>,
  ) => void
  setChroma: (patch: Partial<ChromaState>) => void
}

export const useAppStore = create<AppStore>((set) => ({
  project: initialProject(),
  prompts: initialPrompts(),
  provider: { ...DEFAULT_PROVIDER_STATE },
  chroma: { ...DEFAULT_CHROMA },
  ui: { view: { kind: 'project' }, selectedCell: null },

  setView: (view) => set((s) => ({ ui: { ...s.ui, view, selectedCell: null } })),
  selectCell: (cell) => set((s) => ({ ui: { ...s.ui, selectedCell: cell } })),

  setCharacterRef: (blob) =>
    set((s) => ({ project: { ...s.project, characterRef: blob } })),

  updateMetadata: (patch) =>
    set((s) => ({ project: { ...s.project, metadata: { ...s.project.metadata, ...patch } } })),

  updateState: (name, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        states: { ...s.project.states, [name]: { ...s.project.states[name], ...patch } },
      },
    })),

  setStateNote: (name, index, note) =>
    set((s) => {
      const notes = [...s.project.states[name].notes]
      notes[index] = note
      return {
        project: {
          ...s.project,
          states: { ...s.project.states, [name]: { ...s.project.states[name], notes } },
        },
      }
    }),

  setStateSemantics: (name, value) =>
    set((s) => ({
      prompts: {
        ...s.prompts,
        stateSemantics: { ...s.prompts.stateSemantics, [name]: value },
      },
    })),

  setTemplate: (key, value) =>
    set((s) => ({
      prompts: { ...s.prompts, templates: { ...s.prompts.templates, [key]: value } },
    })),

  resetTemplate: (key) =>
    set((s) => ({
      prompts: { ...s.prompts, templates: { ...s.prompts.templates, [key]: DEFAULT_TEMPLATES[key] } },
    })),

  setProviderActive: (name) =>
    set((s) => ({ provider: { ...s.provider, active: name } })),

  updateProviderConfig: (name, patch) =>
    set((s) => ({
      provider: { ...s.provider, [name]: { ...s.provider[name], ...patch } },
    })) as never,

  setChroma: (patch) => set((s) => ({ chroma: { ...s.chroma, ...patch } })),
}))
```

- [ ] **Step 4: Verify lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: Zustand root store + actions"
```

---

### Task 11: localStorage persistence with Blob serialization

**Files:**
- Create: `src/store/persist.ts`
- Modify: `src/store/index.ts`, `src/main.tsx`

- [ ] **Step 1: Implement src/store/persist.ts**

```ts
import type { AppStore } from './index'
import { blobToDataUrl, dataUrlToBlob } from '@/lib/blobUtils'

const STORAGE_KEY = 'mori-sprite-studio.v1'

type SerializableValue = unknown

// Walk a plain object/array tree, replace Blob with { __blob: dataUrl }
async function serialize(value: SerializableValue): Promise<SerializableValue> {
  if (value instanceof Blob) {
    return { __blob: await blobToDataUrl(value) }
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => serialize(v)))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await serialize(v)
    }
    return out
  }
  return value
}

async function deserialize(value: SerializableValue): Promise<SerializableValue> {
  if (value && typeof value === 'object' && '__blob' in (value as Record<string, unknown>)) {
    const url = (value as Record<string, string>).__blob
    return await dataUrlToBlob(url)
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => deserialize(v)))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await deserialize(v)
    }
    return out
  }
  return value
}

type PersistedShape = Pick<AppStore, 'project' | 'prompts' | 'provider' | 'chroma'>

export async function saveStore(store: PersistedShape): Promise<void> {
  const payload = await serialize(store)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.error('persist save failed', e)
  }
}

export async function loadStore(): Promise<Partial<PersistedShape> | null> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return (await deserialize(parsed)) as Partial<PersistedShape>
  } catch (e) {
    console.error('persist load failed', e)
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(store: PersistedShape, delayMs = 300): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveStore(store)
  }, delayMs)
}
```

- [ ] **Step 2: Subscribe to store changes in main.tsx**

Replace `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAppStore } from '@/store'
import { loadStore, debouncedSave } from '@/store/persist'

async function bootstrap() {
  const persisted = await loadStore()
  if (persisted) {
    useAppStore.setState((s) => ({
      project: persisted.project ?? s.project,
      prompts: persisted.prompts ?? s.prompts,
      provider: persisted.provider ?? s.provider,
      chroma: persisted.chroma ?? s.chroma,
    }))
  }

  useAppStore.subscribe((s) => {
    debouncedSave({
      project: s.project,
      prompts: s.prompts,
      provider: s.provider,
      chroma: s.chroma,
    })
  })

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
```

- [ ] **Step 3: Verify dev server still boots**

```bash
npm run dev:vite
```

Open http://localhost:5173, confirm app still renders. Open DevTools → Application → Local Storage → confirm `mori-sprite-studio.v1` key appears after any state change (or stays empty until a change). `Ctrl-C`.

- [ ] **Step 4: Commit**

```bash
git add src/store/persist.ts src/main.tsx
git commit -m "feat: localStorage persistence with Blob (de)serialization"
```

---

### Task 12: Persistence round-trip test

**Files:**
- Create: `tests/persist.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveStore, loadStore } from '@/store/persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a store containing a Blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const dummy = {
      project: {
        characterRef: blob,
        states: {} as any,
        metadata: {
          packageName: 'mori', displayName: 'Mori', version: '1.0.0',
          author: 'yazelin', license: 'MIT', description: '', tags: [],
        },
      },
      prompts: { templates: {} as any, stateSemantics: {} as any },
      provider: {} as any,
      chroma: { key: 'green' as const, tolerance: 'balanced' as const },
    }
    await saveStore(dummy as any)
    const restored = await loadStore()
    expect(restored).not.toBeNull()
    const restoredBlob = restored!.project!.characterRef as Blob
    expect(restoredBlob).toBeInstanceOf(Blob)
    const buf = new Uint8Array(await restoredBlob.arrayBuffer())
    expect(Array.from(buf)).toEqual([1, 2, 3])
    expect(restoredBlob.type).toBe('image/png')
  })

  it('returns null when nothing stored', async () => {
    expect(await loadStore()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test**

```bash
npm test -- tests/persist.test.ts
```

Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/persist.test.ts
git commit -m "test: persist round-trip"
```

---

## Milestone 4 — UI Shell + Sidebar (Tasks 13-15)

### Task 13: StatusBadge component

**Files:**
- Create: `src/components/StatusBadge.tsx`

- [ ] **Step 1: Implement**

```tsx
import { cn } from '@/lib/utils'
import type { SheetStatus } from '@/types/project'

const SYMBOL: Record<SheetStatus, string> = {
  pending:     '○',
  placeholder: '●',
  animated:    '◆',
}

const COLOR: Record<SheetStatus, string> = {
  pending:     'text-slate-400',
  placeholder: 'text-amber-500',
  animated:    'text-emerald-500',
}

export function StatusBadge({ status, className }: { status: SheetStatus; className?: string }) {
  return (
    <span className={cn('font-mono text-base', COLOR[status], className)} aria-label={status}>
      {SYMBOL[status]}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatusBadge.tsx
git commit -m "feat: StatusBadge component"
```

---

### Task 14: Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import { STATE_NAMES, type StateName } from '@/types/project'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const view = useAppStore((s) => s.ui.view)
  const setView = useAppStore((s) => s.setView)
  const states = useAppStore((s) => s.project.states)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-slate-50 p-3 flex flex-col gap-1">
      <Item
        active={view.kind === 'project'}
        onClick={() => setView({ kind: 'project' })}
      >
        <span className="text-base">⌂</span>
        <span>專案</span>
      </Item>

      <div className="border-t border-border my-2" />

      {STATE_NAMES.map((name) => (
        <Item
          key={name}
          active={view.kind === 'state' && view.name === name}
          onClick={() => setView({ kind: 'state', name })}
        >
          <StatusBadge status={states[name].status} />
          <span className="capitalize">{name}</span>
        </Item>
      ))}

      <div className="border-t border-border my-2" />

      <Item
        active={view.kind === 'export'}
        onClick={() => setView({ kind: 'export' })}
      >
        <span className="text-base">⤓</span>
        <span>匯出</span>
      </Item>
    </nav>
  )
}

function Item({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
        active ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-700',
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Sidebar with state badges"
```

---

### Task 15: App shell + view router

**Files:**
- Create: `src/views/ProjectView.tsx`, `src/views/StateView.tsx`, `src/views/ExportView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create view stubs**

`src/views/ProjectView.tsx`:

```tsx
export function ProjectView() {
  return <div className="p-6"><h1 className="text-xl font-semibold">⌂ 專案</h1></div>
}
```

`src/views/StateView.tsx`:

```tsx
import type { StateName } from '@/types/project'

export function StateView({ name }: { name: StateName }) {
  return <div className="p-6"><h1 className="text-xl font-semibold capitalize">◆ {name}</h1></div>
}
```

`src/views/ExportView.tsx`:

```tsx
export function ExportView() {
  return <div className="p-6"><h1 className="text-xl font-semibold">⤓ 匯出</h1></div>
}
```

- [ ] **Step 2: Implement App.tsx**

```tsx
import { useAppStore } from '@/store'
import { Sidebar } from '@/components/Sidebar'
import { ProjectView } from '@/views/ProjectView'
import { StateView } from '@/views/StateView'
import { ExportView } from '@/views/ExportView'

export default function App() {
  const view = useAppStore((s) => s.ui.view)

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white">
        {view.kind === 'project' && <ProjectView />}
        {view.kind === 'state' && <StateView name={view.name} />}
        {view.kind === 'export' && <ExportView />}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev:vite
```

Open http://localhost:5173. Confirm:
- Sidebar with ⌂ 專案, 6 state items (with ○ pending badges), ⤓ 匯出
- Clicking each switches the main view title
- Active item is highlighted

`Ctrl-C`.

- [ ] **Step 4: Commit**

```bash
git add src/views/ src/App.tsx
git commit -m "feat: App shell with view routing"
```

---

## Milestone 5 — Image Utility Libraries (Tasks 16-19)

### Task 16: chromaKey.ts + tests (TDD)

**Files:**
- Create: `src/lib/chromaKey.ts`, `tests/chromaKey.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { chromaKeyOut } from '@/lib/chromaKey'

// Helper: make a 2×2 PNG Blob with a known pixel pattern.
async function makePng(rgba: number[][]): Promise<Blob> {
  // rgba is [4]-length per pixel, length must be width*height*4
  const canvas = new OffscreenCanvas(2, 2)
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(2, 2)
  for (let i = 0; i < rgba.length; i++) {
    imgData.data[i * 4]     = rgba[i][0]
    imgData.data[i * 4 + 1] = rgba[i][1]
    imgData.data[i * 4 + 2] = rgba[i][2]
    imgData.data[i * 4 + 3] = rgba[i][3]
  }
  ctx.putImageData(imgData, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}

async function readPixels(blob: Blob): Promise<number[][]> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
  }
  return pixels
}

describe('chromaKey', () => {
  it('removes pure-green pixels (alpha = 0) and keeps non-green opaque', async () => {
    const src = await makePng([
      [0, 255, 0, 255],     // pure green → should be removed
      [255, 0, 0, 255],     // red → keep
      [0, 0, 255, 255],     // blue → keep
      [0, 255, 0, 255],     // green → remove
    ])
    const out = await chromaKeyOut(src, [0, 255, 0], 'balanced')
    const px = await readPixels(out)
    expect(px[0][3]).toBe(0)
    expect(px[1][3]).toBe(255)
    expect(px[2][3]).toBe(255)
    expect(px[3][3]).toBe(0)
  })

  it('removes pure-magenta pixels when key is magenta', async () => {
    const src = await makePng([
      [255, 0, 255, 255],   // pure magenta → remove
      [0, 255, 0, 255],     // green → keep
      [128, 128, 128, 255], // grey → keep
      [255, 0, 255, 255],   // magenta → remove
    ])
    const out = await chromaKeyOut(src, [255, 0, 255], 'balanced')
    const px = await readPixels(out)
    expect(px[0][3]).toBe(0)
    expect(px[1][3]).toBe(255)
    expect(px[2][3]).toBe(255)
    expect(px[3][3]).toBe(0)
  })

  it('aggressive tolerance removes near-green pixels that balanced would keep', async () => {
    const slightOff = [40, 250, 40, 255]   // distance to [0,255,0] = sqrt(1600+25+1600) ≈ 56
    const src = await makePng([slightOff, slightOff, slightOff, slightOff])
    const balanced = await chromaKeyOut(src, [0, 255, 0], 'balanced')   // hard=50
    const aggressive = await chromaKeyOut(src, [0, 255, 0], 'aggressive') // hard=80
    const balPx = await readPixels(balanced)
    const aggPx = await readPixels(aggressive)
    // balanced: distance 56 > hard 50 but < soft 100 → soft edge (partial alpha)
    expect(balPx[0][3]).toBeGreaterThan(0)
    expect(balPx[0][3]).toBeLessThan(255)
    // aggressive: distance 56 < hard 80 → fully removed
    expect(aggPx[0][3]).toBe(0)
  })
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/chromaKey.test.ts
```

Expected: fail with "Cannot find module".

- [ ] **Step 3: Implement src/lib/chromaKey.ts**

```ts
import { CHROMA_THRESHOLDS, type ChromaTolerance } from '@/types/chroma'

export async function chromaKeyOut(
  src: Blob,
  keyRgb: [number, number, number],
  tolerance: ChromaTolerance,
): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const data = imgData.data
  const { hard, soft } = CHROMA_THRESHOLDS[tolerance]
  const [kr, kg, kb] = keyRgb

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - kr
    const dg = data[i + 1] - kg
    const db = data[i + 2] - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist <= hard) {
      data[i + 3] = 0
    } else if (dist < soft) {
      const t = (dist - hard) / (soft - hard)
      data[i + 3] = Math.round(data[i + 3] * t)
    }
    // else: keep original alpha
  }

  ctx.putImageData(imgData, 0, 0)
  return await canvas.convertToBlob({ type: 'image/png' })
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/chromaKey.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chromaKey.ts tests/chromaKey.test.ts
git commit -m "feat: chromaKey background removal + tests"
```

---

### Task 17: imageOps.ts + tests (TDD)

**Files:**
- Create: `src/lib/imageOps.ts`, `tests/imageOps.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { splitGrid, cropToSize, pasteIntoSheet, blobDimensions } from '@/lib/imageOps'

async function makeBlob(width: number, height: number, fillRgba: [number, number, number, number]): Promise<Blob> {
  const c = new OffscreenCanvas(width, height)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = `rgba(${fillRgba[0]},${fillRgba[1]},${fillRgba[2]},${fillRgba[3] / 255})`
  ctx.fillRect(0, 0, width, height)
  return await c.convertToBlob({ type: 'image/png' })
}

describe('imageOps', () => {
  it('splitGrid 3×2 produces 6 sub-blobs of expected size', async () => {
    const src = await makeBlob(1536, 1024, [255, 0, 0, 255])
    const parts = await splitGrid(src, 3, 2)
    expect(parts).toHaveLength(6)
    for (const p of parts) {
      const dim = await blobDimensions(p)
      expect(dim).toEqual({ width: 512, height: 512 })
    }
  })

  it('splitGrid 4×4 produces 16 sub-blobs of expected size', async () => {
    const src = await makeBlob(1024, 1024, [0, 255, 0, 255])
    const parts = await splitGrid(src, 4, 4)
    expect(parts).toHaveLength(16)
    for (const p of parts) {
      const dim = await blobDimensions(p)
      expect(dim).toEqual({ width: 256, height: 256 })
    }
  })

  it('cropToSize resizes a 1024×1024 to 256×256', async () => {
    const src = await makeBlob(1024, 1024, [0, 0, 255, 255])
    const out = await cropToSize(src, 256, 256)
    expect(await blobDimensions(out)).toEqual({ width: 256, height: 256 })
  })

  it('pasteIntoSheet overwrites the target 256×256 cell on a 4×4 sheet', async () => {
    const sheet = await makeBlob(1024, 1024, [255, 255, 255, 255])
    const cell = await makeBlob(256, 256, [0, 0, 0, 255])
    const out = await pasteIntoSheet(sheet, cell, 5)   // cell index 5 = row 1, col 1 (0-indexed)
    expect(await blobDimensions(out)).toEqual({ width: 1024, height: 1024 })
    // confirm cell (5) is now black
    const bitmap = await createImageBitmap(out)
    const c = new OffscreenCanvas(1024, 1024)
    const ctx = c.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const px = ctx.getImageData(256 + 128, 256 + 128, 1, 1).data  // center of cell 5
    expect([px[0], px[1], px[2]]).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/imageOps.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement src/lib/imageOps.ts**

```ts
export async function blobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  return { width: bitmap.width, height: bitmap.height }
}

/**
 * Split src into rows × cols equal-sized cells, row-major order.
 * Returns an array of Blob length = rows * cols.
 */
export async function splitGrid(src: Blob, cols: number, rows: number): Promise<Blob[]> {
  const bitmap = await createImageBitmap(src)
  const cellW = Math.floor(bitmap.width / cols)
  const cellH = Math.floor(bitmap.height / rows)
  const out: Blob[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = new OffscreenCanvas(cellW, cellH)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH)
      out.push(await canvas.convertToBlob({ type: 'image/png' }))
    }
  }
  return out
}

/**
 * Resize src to exactly target dimensions (high-quality smooth scaling).
 */
export async function cropToSize(src: Blob, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(src)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Build a 1024×1024 sheet from a single 256×256 static base, replicated 16 times
 * (used for placeholder sheets after generating a static base).
 */
export async function buildPlaceholderSheet(staticBase: Blob): Promise<Blob> {
  const cell = await createImageBitmap(staticBase)
  const canvas = new OffscreenCanvas(1024, 1024)
  const ctx = canvas.getContext('2d')!
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.drawImage(cell, 0, 0, cell.width, cell.height, c * 256, r * 256, 256, 256)
    }
  }
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Paste a 256×256 cell into a 1024×1024 sheet at cellIndex (0-15, row-major).
 */
export async function pasteIntoSheet(sheet: Blob, cell: Blob, cellIndex: number): Promise<Blob> {
  if (cellIndex < 0 || cellIndex > 15) throw new Error(`cellIndex out of range: ${cellIndex}`)
  const sheetBitmap = await createImageBitmap(sheet)
  const cellBitmap = await createImageBitmap(cell)
  const canvas = new OffscreenCanvas(1024, 1024)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(sheetBitmap, 0, 0)
  const row = Math.floor(cellIndex / 4)
  const col = cellIndex % 4
  // clear the target cell first (so transparent pixels in `cell` actually become transparent)
  ctx.clearRect(col * 256, row * 256, 256, 256)
  ctx.drawImage(cellBitmap, 0, 0, cellBitmap.width, cellBitmap.height, col * 256, row * 256, 256, 256)
  return await canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Crop one 256×256 cell out of a 4×4 sheet (for D mode's "previous/next frame" refs).
 */
export async function cropCell(sheet: Blob, cellIndex: number): Promise<Blob> {
  if (cellIndex < 0 || cellIndex > 15) throw new Error(`cellIndex out of range: ${cellIndex}`)
  const bitmap = await createImageBitmap(sheet)
  const row = Math.floor(cellIndex / 4)
  const col = cellIndex % 4
  const canvas = new OffscreenCanvas(256, 256)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, col * 256, row * 256, 256, 256, 0, 0, 256, 256)
  return await canvas.convertToBlob({ type: 'image/png' })
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/imageOps.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageOps.ts tests/imageOps.test.ts
git commit -m "feat: imageOps (splitGrid, cropToSize, pasteIntoSheet, etc.) + tests"
```

---

### Task 18: promptRenderer.ts + tests (TDD)

**Files:**
- Create: `src/lib/promptRenderer.ts`, `tests/promptRenderer.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { render, renderCellNotesBlock, renderStateDescriptions } from '@/lib/promptRenderer'

describe('promptRenderer', () => {
  it('substitutes {{var}} with provided value', () => {
    expect(render('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('leaves unknown {{var}} unchanged (no error)', () => {
    expect(render('a {{missing}} b', {})).toBe('a {{missing}} b')
  })

  it('handles multiple substitutions including same var twice', () => {
    expect(render('{{x}} and {{x}} and {{y}}', { x: 'A', y: 'B' })).toBe('A and A and B')
  })

  it('renderCellNotesBlock formats 16 frame notes', () => {
    const notes = Array(16).fill('').map((_, i) => i === 0 ? 'start' : i === 15 ? 'end' : '')
    const out = renderCellNotesBlock(notes)
    expect(out).toContain('Frame 1: start')
    expect(out).toContain('Frame 16: end')
    expect(out).toContain('Frame 2: ')
  })

  it('renderStateDescriptions formats 6 states from semantics map', () => {
    const semantics = {
      idle: 'relaxed', sleeping: 'asleep', recording: 'alert',
      thinking: 'pensive', done: 'happy', error: 'confused',
    }
    const out = renderStateDescriptions(semantics)
    expect(out).toContain('Cell 1 (idle): relaxed')
    expect(out).toContain('Cell 6 (error): confused')
  })
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/promptRenderer.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement src/lib/promptRenderer.ts**

```ts
import type { StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match
  })
}

export function renderCellNotesBlock(notes: string[]): string {
  return notes.map((n, i) => `  Frame ${i + 1}: ${n}`).join('\n')
}

export function renderStateDescriptions(semantics: Record<StateName, string>): string {
  return STATE_NAMES.map((s, i) => `  Cell ${i + 1} (${s}): ${semantics[s]}`).join('\n')
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/promptRenderer.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptRenderer.ts tests/promptRenderer.test.ts
git commit -m "feat: promptRenderer with {{var}} substitution + helpers"
```

---

### Task 19: Chroma suffix builder

**Files:**
- Create: `src/lib/promptBuilder.ts`

- [ ] **Step 1: Implement**

```ts
import { CHROMA_SUFFIX_TEMPLATE } from '@/defaults/prompts'
import { CHROMA_COLORS, type ChromaKeyName } from '@/types/chroma'
import { render } from './promptRenderer'

export function buildChromaSuffix(key: ChromaKeyName): string {
  const c = CHROMA_COLORS[key]
  return render(CHROMA_SUFFIX_TEMPLATE, {
    chroma_color: key,
    chroma_hex: c.hex,
  })
}

export function appendChromaSuffix(template: string, key: ChromaKeyName): string {
  return `${template}\n\n${buildChromaSuffix(key)}`
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/promptBuilder.ts
git commit -m "feat: chroma suffix builder"
```

---

## Milestone 6 — AI Providers (Tasks 20-24)

### Task 20: ImageProvider interface

**Files:**
- Create: `src/providers/ImageProvider.ts`

- [ ] **Step 1: Implement**

```ts
import type { GenerateOpts, ProviderName } from '@/types/provider'

export interface ImageProvider {
  readonly name: ProviderName
  generateImage(opts: GenerateOpts): Promise<Blob>
}

export class ProviderError extends Error {
  constructor(
    public providerName: ProviderName,
    message: string,
    public statusCode?: number,
  ) {
    super(`[${providerName}] ${message}`)
    this.name = 'ProviderError'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/ImageProvider.ts
git commit -m "feat: ImageProvider interface + ProviderError"
```

---

### Task 21: codexImageProvider

**Files:**
- Create: `src/providers/codexImageProvider.ts`

- [ ] **Step 1: Implement**

```ts
import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { CodexImageConfig, GenerateOpts } from '@/types/provider'
import { blobToBase64 } from '@/lib/blobUtils'

export class CodexImageProvider implements ImageProvider {
  readonly name = 'codex-image' as const

  constructor(private config: CodexImageConfig) {}

  async generateImage({ prompt, references, outputSize, quality }: GenerateOpts): Promise<Blob> {
    if (!this.config.apiKey) throw new ProviderError(this.name, 'API key not configured')
    if (!this.config.baseUrl) throw new ProviderError(this.name, 'Base URL not configured')

    const referenceImagesBase64 = await Promise.all(references.map((r) => blobToBase64(r)))

    const body = {
      prompt,
      size: outputSize,
      quality: quality ?? this.config.quality,
      count: 1,
      ...(referenceImagesBase64.length > 0 ? { reference_images_base64: referenceImagesBase64 } : {}),
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    let resp: Response
    try {
      resp = await fetch(`${baseUrl}/v1/images/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 401) throw new ProviderError(this.name, 'API key invalid (401)', 401)
      if (resp.status === 403) throw new ProviderError(this.name, 'API key disabled (403)', 403)
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${text.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
    const imageUrl: string | undefined = data?.images?.[0]?.url
    if (!imageUrl) throw new ProviderError(this.name, `no image URL: ${JSON.stringify(data).slice(0, 300)}`)

    const pngResp = await fetch(imageUrl)
    if (!pngResp.ok) throw new ProviderError(this.name, `image fetch HTTP ${pngResp.status}`)
    return await pngResp.blob()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/codexImageProvider.ts
git commit -m "feat: codexImageProvider"
```

---

### Task 22: googleGeminiBaseProvider + Vertex + Direct

**Files:**
- Create: `src/providers/googleGeminiBaseProvider.ts`, `src/providers/vertexGeminiProvider.ts`, `src/providers/googleGeminiProvider.ts`

- [ ] **Step 1: Implement googleGeminiBaseProvider.ts**

```ts
import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { GenerateOpts, GoogleGeminiConfig, ProviderName } from '@/types/provider'
import { blobToBase64, base64ToBlob } from '@/lib/blobUtils'

function aspectFor(outputSize: GenerateOpts['outputSize']): '1:1' | '3:2' | '2:3' {
  if (outputSize === '1536x1024') return '3:2'
  if (outputSize === '1024x1536') return '2:3'
  return '1:1'
}

export abstract class GoogleGeminiBaseProvider implements ImageProvider {
  abstract readonly name: ProviderName
  protected abstract endpointUrl(model: string, apiKey: string): string

  constructor(protected config: GoogleGeminiConfig) {}

  async generateImage({ prompt, references, outputSize }: GenerateOpts): Promise<Blob> {
    if (!this.config.apiKey) throw new ProviderError(this.name, 'API key not configured')
    if (!this.config.model) throw new ProviderError(this.name, 'Model not configured')

    const parts: unknown[] = []
    for (const ref of references) {
      const b64 = await blobToBase64(ref)
      parts.push({
        inlineData: { mimeType: ref.type || 'image/png', data: b64 },
      })
    }
    parts.push({ text: prompt })

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectFor(outputSize),
          imageSize: this.config.imageSize,
        },
      },
    }

    const url = this.endpointUrl(this.config.model, this.config.apiKey)

    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${text.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
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
      throw new ProviderError(this.name, `no image (refusal?): ${texts.slice(0, 300) || '(no detail)'}`)
    }

    return base64ToBlob(imagePart.inlineData.data, imagePart.inlineData.mimeType ?? 'image/png')
  }
}
```

- [ ] **Step 2: Implement vertexGeminiProvider.ts**

```ts
import { GoogleGeminiBaseProvider } from './googleGeminiBaseProvider'

export class VertexGeminiProvider extends GoogleGeminiBaseProvider {
  readonly name = 'vertex-gemini' as const

  protected endpointUrl(model: string, apiKey: string): string {
    return `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  }
}
```

- [ ] **Step 3: Implement googleGeminiProvider.ts**

```ts
import { GoogleGeminiBaseProvider } from './googleGeminiBaseProvider'

export class GoogleGeminiProvider extends GoogleGeminiBaseProvider {
  readonly name = 'google-gemini' as const

  protected endpointUrl(model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  }
}
```

- [ ] **Step 4: Verify lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/providers/googleGeminiBaseProvider.ts src/providers/vertexGeminiProvider.ts src/providers/googleGeminiProvider.ts
git commit -m "feat: Google Gemini base + Vertex + Direct providers"
```

---

### Task 23: authorFallbackProvider

**Files:**
- Create: `src/providers/authorFallbackProvider.ts`

- [ ] **Step 1: Implement**

```ts
import type { ImageProvider } from './ImageProvider'
import { ProviderError } from './ImageProvider'
import type { GenerateOpts } from '@/types/provider'
import { blobToBase64, base64ToBlob } from '@/lib/blobUtils'

export class AuthorFallbackProvider implements ImageProvider {
  readonly name = 'author-fallback' as const

  async generateImage({ prompt, references, outputSize }: GenerateOpts): Promise<Blob> {
    const refsB64 = await Promise.all(references.map((r) => blobToBase64(r)))

    let resp: Response
    try {
      resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, references: refsB64, outputSize }),
      })
    } catch (e) {
      throw new ProviderError(this.name, `network: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!resp.ok) {
      let detail = ''
      try {
        const err = await resp.json()
        detail = err.detail ?? err.error ?? ''
      } catch {
        detail = await resp.text().catch(() => '')
      }
      throw new ProviderError(this.name, `HTTP ${resp.status}: ${detail.slice(0, 300)}`, resp.status)
    }

    const data = await resp.json()
    if (!data.data) throw new ProviderError(this.name, 'response missing image data')
    return base64ToBlob(data.data, data.mimeType ?? 'image/png')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/authorFallbackProvider.ts
git commit -m "feat: authorFallbackProvider (POSTs to /api/generate)"
```

---

### Task 24: Provider factory

**Files:**
- Create: `src/providers/index.ts`

- [ ] **Step 1: Implement**

```ts
import type { ImageProvider } from './ImageProvider'
import type { ProviderState } from '@/types/provider'
import { CodexImageProvider } from './codexImageProvider'
import { VertexGeminiProvider } from './vertexGeminiProvider'
import { GoogleGeminiProvider } from './googleGeminiProvider'
import { AuthorFallbackProvider } from './authorFallbackProvider'

export { ProviderError } from './ImageProvider'
export type { ImageProvider } from './ImageProvider'

export function buildProvider(state: ProviderState): ImageProvider {
  switch (state.active) {
    case 'codex-image':     return new CodexImageProvider(state.codexImage)
    case 'vertex-gemini':   return new VertexGeminiProvider(state.vertexGemini)
    case 'google-gemini':   return new GoogleGeminiProvider(state.googleGemini)
    case 'author-fallback': return new AuthorFallbackProvider()
  }
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/index.ts
git commit -m "feat: provider factory"
```

---

## Milestone 7 — Vercel Function (Tasks 25-26)

### Task 25: api/generate.ts

**Files:**
- Create: `api/generate.ts`

- [ ] **Step 1: Implement**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add api/generate.ts
git commit -m "feat: Vercel Function /api/generate (author fallback proxy)"
```

---

### Task 26: Smoke-test api/generate via vercel dev (manual)

- [ ] **Step 1: Install vercel CLI globally (one-time)**

```bash
npm install -g vercel
```

- [ ] **Step 2: Link project to Vercel scope (interactive)**

```bash
vercel link
```

Accept defaults. Creates `.vercel/` dir.

- [ ] **Step 3: Set up .env.local (optional, only if testing locally)**

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
AUTHOR_FALLBACK_PROVIDER=vertex-gemini
AUTHOR_API_KEY=<your-vertex-express-key-here>
```

- [ ] **Step 4: Test endpoint returns 503 when no key**

Temporarily blank the key:
```bash
sed -i 's/^AUTHOR_API_KEY=.*/AUTHOR_API_KEY=/' .env.local
```

Run `vercel dev` in another terminal, then:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test","references":[],"outputSize":"1024x1024"}'
```

Expected: `{"error":"not_configured","detail":"..."}` with 503.

`Ctrl-C` the `vercel dev`.

- [ ] **Step 5: (Optional) Test with real key returns a base64 image**

Restore your real key in `.env.local`, run `vercel dev`, then:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a simple red circle on white background","references":[],"outputSize":"1024x1024"}' \
  | head -c 200
```

Expected: `{"mimeType":"image/png","data":"iVBORw0KG..."}` (long base64).

If 4xx/5xx, debug per error detail. `Ctrl-C` `vercel dev` when done.

- [ ] **Step 6: Commit env.local exclusion confirmation (if missing)**

`.gitignore` already excludes `.env.local`. Verify with:

```bash
git status
```

Expected: `.env.local` NOT in untracked. If it appears, add `.env.local` to `.gitignore` and commit.

---

## Milestone 8 — Project View Components (Tasks 27-32)

### Task 27: UploadDropzone component

**Files:**
- Create: `src/components/UploadDropzone.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onFile: (blob: Blob) => void
  accept?: string                    // e.g. "image/png,image/jpeg"
  label?: string                     // hint text
  preview?: string | null            // dataURL or objectURL for current upload
  className?: string
  previewSize?: number               // px square preview
}

export function UploadDropzone({
  onFile, accept = 'image/*', label = '拖放或點擊上傳圖片',
  preview, className, previewSize = 256,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!f.type.startsWith('image/')) return
    onFile(f)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); pickFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors',
        hover && 'bg-slate-100 border-slate-400',
        className,
      )}
      style={{ minHeight: previewSize, width: previewSize }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pickFiles(e.target.files)}
      />
      {preview ? (
        <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
      ) : (
        <span className="text-sm text-slate-500 px-2 text-center">{label}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/UploadDropzone.tsx
git commit -m "feat: UploadDropzone component"
```

---

### Task 28: MetadataForm

**Files:**
- Create: `src/components/MetadataForm.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function MetadataForm() {
  const metadata = useAppStore((s) => s.project.metadata)
  const update = useAppStore((s) => s.updateMetadata)

  return (
    <div className="space-y-3 max-w-md">
      <Row label="package_name">
        <Input
          value={metadata.packageName}
          onChange={(e) => update({ packageName: e.target.value })}
          placeholder="mori"
        />
      </Row>
      <Row label="display_name">
        <Input
          value={metadata.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          placeholder="Mori"
        />
      </Row>
      <Row label="version">
        <Input
          value={metadata.version}
          onChange={(e) => update({ version: e.target.value })}
          placeholder="1.0.0"
        />
      </Row>
      <Row label="author">
        <Input
          value={metadata.author}
          onChange={(e) => update({ author: e.target.value })}
        />
      </Row>
      <Row label="license">
        <Input
          value={metadata.license}
          onChange={(e) => update({ license: e.target.value })}
        />
      </Row>
      <Row label="description">
        <Textarea
          value={metadata.description}
          onChange={(e) => update({ description: e.target.value })}
          rows={2}
        />
      </Row>
      <Row label="tags (comma-separated)">
        <Input
          value={metadata.tags.join(', ')}
          onChange={(e) => update({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
        />
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <Label className="text-sm text-slate-600">{label}</Label>
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MetadataForm.tsx
git commit -m "feat: MetadataForm component"
```

---

### Task 29: StateSemanticsTable

**Files:**
- Create: `src/components/StateSemanticsTable.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_STATE_SEMANTICS } from '@/defaults'

export function StateSemanticsTable() {
  const semantics = useAppStore((s) => s.prompts.stateSemantics)
  const update = useAppStore((s) => s.setStateSemantics)

  function resetAll() {
    for (const name of STATE_NAMES) update(name, DEFAULT_STATE_SEMANTICS[name])
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {STATE_NAMES.map((name) => (
        <div key={name} className="grid grid-cols-[100px_1fr] items-center gap-3">
          <span className="text-sm font-mono capitalize">{name}</span>
          <Input
            value={semantics[name]}
            onChange={(e) => update(name, e.target.value)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={resetAll}>全部回預設</Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StateSemanticsTable.tsx
git commit -m "feat: StateSemanticsTable component"
```

---

### Task 30: ProviderConfig

**Files:**
- Create: `src/components/ProviderConfig.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProviderName } from '@/types/provider'

const PROVIDER_LABELS: Record<ProviderName, string> = {
  'author-fallback': 'Author Fallback (預設,免設定)',
  'codex-image':     'Codex-Image (ChatGPT 訂閱)',
  'vertex-gemini':   'Vertex Gemini (Google Cloud)',
  'google-gemini':   'Google Gemini Direct (AI Studio)',
}

const ORDER: ProviderName[] = ['author-fallback', 'codex-image', 'vertex-gemini', 'google-gemini']

export function ProviderConfig() {
  const provider = useAppStore((s) => s.provider)
  const setActive = useAppStore((s) => s.setProviderActive)
  const update = useAppStore((s) => s.updateProviderConfig)

  return (
    <div className="space-y-4 max-w-xl">
      <RadioGroup
        value={provider.active}
        onValueChange={(v) => setActive(v as ProviderName)}
        className="space-y-2"
      >
        {ORDER.map((name) => (
          <div key={name} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value={name} id={`provider-${name}`} />
              <Label htmlFor={`provider-${name}`} className="font-medium">{PROVIDER_LABELS[name]}</Label>
            </div>
            {provider.active === name && (
              <div className="ml-6 space-y-2 p-3 bg-slate-50 rounded-md">
                {name === 'author-fallback' && (
                  <p className="text-xs text-slate-600">
                    使用作者的 API key(server-side env var)。免設定。MVP 無 rate limit。
                  </p>
                )}
                {name === 'codex-image' && (
                  <>
                    <Field label="Base URL">
                      <Input
                        value={provider.codexImage.baseUrl}
                        onChange={(e) => update('codexImage', { baseUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="API Key">
                      <Input
                        type="password"
                        value={provider.codexImage.apiKey}
                        onChange={(e) => update('codexImage', { apiKey: e.target.value })}
                        placeholder="cimg_..."
                      />
                    </Field>
                    <Field label="Quality">
                      <Select
                        value={provider.codexImage.quality}
                        onValueChange={(v) => update('codexImage', { quality: v as 'standard' | 'high' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">standard</SelectItem>
                          <SelectItem value="high">high</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
                {(name === 'vertex-gemini' || name === 'google-gemini') && (
                  <>
                    <Field label="API Key">
                      <Input
                        type="password"
                        value={provider[name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini'].apiKey}
                        onChange={(e) => update(
                          name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini',
                          { apiKey: e.target.value },
                        )}
                        placeholder="AIza..."
                      />
                    </Field>
                    <Field label="Model">
                      <Input
                        value={provider[name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini'].model}
                        onChange={(e) => update(
                          name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini',
                          { model: e.target.value },
                        )}
                      />
                    </Field>
                    <Field label="Image Size">
                      <Select
                        value={provider[name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini'].imageSize}
                        onValueChange={(v) => update(
                          name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini',
                          { imageSize: v as '1K' | '2K' | '4K' },
                        )}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1K">1K</SelectItem>
                          <SelectItem value="2K">2K</SelectItem>
                          <SelectItem value="4K">4K</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <Label className="text-xs text-slate-600">{label}</Label>
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProviderConfig.tsx
git commit -m "feat: ProviderConfig with 4-way radio + per-provider fields"
```

---

### Task 31: ChromaConfig

**Files:**
- Create: `src/components/ChromaConfig.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ChromaKeyName, ChromaTolerance } from '@/types/chroma'

export function ChromaConfig() {
  const chroma = useAppStore((s) => s.chroma)
  const set = useAppStore((s) => s.setChroma)

  return (
    <div className="space-y-3 max-w-md">
      <div className="space-y-2">
        <Label className="text-sm">Chroma key 顏色</Label>
        <RadioGroup
          value={chroma.key}
          onValueChange={(v) => set({ key: v as ChromaKeyName })}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="green" id="chroma-green" />
            <Label htmlFor="chroma-green">
              <span className="inline-block w-4 h-4 bg-[#00FF00] mr-1 border border-border align-middle" />
              綠 #00FF00
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="magenta" id="chroma-magenta" />
            <Label htmlFor="chroma-magenta">
              <span className="inline-block w-4 h-4 bg-[#FF00FF] mr-1 border border-border align-middle" />
              洋紅 #FF00FF
            </Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-slate-500">角色顏色含此色會被誤刪,擇一避開。</p>
      </div>

      <div className="grid grid-cols-[100px_1fr] items-center gap-3">
        <Label className="text-sm">Tolerance</Label>
        <Select
          value={chroma.tolerance}
          onValueChange={(v) => set({ tolerance: v as ChromaTolerance })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">conservative (hard=30, soft=60)</SelectItem>
            <SelectItem value="balanced">balanced (hard=50, soft=100)</SelectItem>
            <SelectItem value="aggressive">aggressive (hard=80, soft=160)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChromaConfig.tsx
git commit -m "feat: ChromaConfig component"
```

---

### Task 32: ProjectView assembly + B1 generate button stub

**Files:**
- Create: `src/components/GenerateButton.tsx`
- Modify: `src/views/ProjectView.tsx`

- [ ] **Step 1: Implement GenerateButton (stub for now — wire actions in M10)**

```tsx
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  onGenerate: () => void
  onEditPrompt: () => void
  disabled?: boolean
  generating?: boolean
  className?: string
}

export function GenerateButton({
  label, onGenerate, onEditPrompt, disabled, generating, className,
}: Props) {
  return (
    <div className={cn('inline-flex gap-1', className)}>
      <Button
        onClick={onGenerate}
        disabled={disabled || generating}
        className="gap-2"
      >
        <span>✦</span>
        <span>{generating ? '生成中…' : label}</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onEditPrompt}
        disabled={generating}
        title="編輯 prompt"
      >
        ⚙️
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Implement ProjectView assembly**

```tsx
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { GenerateButton } from '@/components/GenerateButton'

export function ProjectView() {
  const characterRef = useAppStore((s) => s.project.characterRef)
  const setCharacterRef = useAppStore((s) => s.setCharacterRef)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Recompute preview URL whenever characterRef changes
  useEffect(() => {
    if (!characterRef) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(characterRef)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [characterRef])

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">⌂ 專案</h1>

      <Section title="Character Reference">
        <UploadDropzone
          onFile={setCharacterRef}
          preview={previewUrl}
          label="拖放或點擊上傳角色參考圖"
          previewSize={256}
        />
        <div className="pt-3">
          <GenerateButton
            label="生 6 狀態靜態"
            onGenerate={() => alert('TODO M10: wire B1')}
            onEditPrompt={() => alert('TODO M10: open prompt editor for B1')}
            disabled={!characterRef}
          />
        </div>
      </Section>

      <Section title="Metadata">
        <MetadataForm />
      </Section>

      <Section title="State Semantics(讓 AI 知道每個 state 該長啥)">
        <StateSemanticsTable />
      </Section>

      <Section title="AI Provider">
        <ProviderConfig />
      </Section>

      <Section title="Background Removal (Chroma Key)">
        <ChromaConfig />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev:vite
```

Open localhost:5173. On `⌂ 專案`:
- Upload an image, confirm preview appears, refresh page → still there (persistence)
- Try filling metadata, provider key, chroma → all should persist
- Click `[✦ 生 6 狀態靜態]` → alert appears (stub OK)

`Ctrl-C`.

- [ ] **Step 4: Commit**

```bash
git add src/components/GenerateButton.tsx src/views/ProjectView.tsx
git commit -m "feat: assemble ProjectView (upload + metadata + semantics + provider + chroma + B1 stub)"
```

---

## Milestone 9 — State View + Preview (Tasks 33-36)

### Task 33: sprite-anim.css

**Files:**
- Create: `src/styles/sprite-anim.css`
- Modify: `src/index.css`

- [ ] **Step 1: Implement sprite-anim.css**

This matches mori-desktop's `floating.css` exactly so the preview behaves identically to the production renderer.

```css
/* Sprite sheet animation: 4×4 grid, row-major, two-axis independent steps.
   Matches mori-desktop floating.css. Apply with inline style:
     background-image: url(<sheet>)
     animation: mori-sprite-x <duration/4>ms steps(4) infinite,
                mori-sprite-y <duration>ms   steps(4) infinite
*/
.mori-sprite-frame {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-size: 400% 400%;
}

@keyframes mori-sprite-x { to { background-position-x: -400%; } }
@keyframes mori-sprite-y { to { background-position-y: -400%; } }

/* Static (animation OFF) — show only frame 1 */
.mori-sprite-static {
  background-position: 0 0;
  background-size: 400% 400%;
}
```

- [ ] **Step 2: Import in index.css**

Add to top of `src/index.css`:

```css
@import './styles/sprite-anim.css';
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/sprite-anim.css src/index.css
git commit -m "feat: sprite-anim.css matching mori-desktop"
```

---

### Task 34: AnimationPreview component

**Files:**
- Create: `src/components/AnimationPreview.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'

interface Props {
  sheet: Blob | null
  durationMs: number
  size?: number    // display size in px (square)
  paused?: boolean
}

export function AnimationPreview({ sheet, durationMs, size = 256, paused = false }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sheet) { setUrl(null); return }
    const u = URL.createObjectURL(sheet)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [sheet])

  if (!url) {
    return (
      <div
        className="border border-dashed border-border bg-slate-50 flex items-center justify-center text-xs text-slate-400"
        style={{ width: size, height: size }}
      >
        (no sheet)
      </div>
    )
  }

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${url})`,
    animation: paused
      ? undefined
      : `mori-sprite-x ${durationMs / 4}ms steps(4) infinite, mori-sprite-y ${durationMs}ms steps(4) infinite`,
  }

  return <div className="mori-sprite-frame border border-border" style={style} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AnimationPreview.tsx
git commit -m "feat: AnimationPreview (CSS sprite animation)"
```

---

### Task 35: SpriteSheetPreview component (4×4 grid with cell click)

**Files:**
- Create: `src/components/SpriteSheetPreview.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  sheet: Blob | null
  selectedCell: number | null    // 0-15 or null
  onCellClick: (cell: number) => void
  size?: number                  // display side length in px
}

export function SpriteSheetPreview({ sheet, selectedCell, onCellClick, size = 384 }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sheet) { setUrl(null); return }
    const u = URL.createObjectURL(sheet)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [sheet])

  const cellSize = size / 4

  return (
    <div className="relative inline-block border border-border" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="sheet" className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          (no sheet)
        </div>
      )}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
        {Array.from({ length: 16 }, (_, i) => i).map((i) => (
          <button
            key={i}
            onClick={() => onCellClick(i)}
            className={cn(
              'border border-slate-300/50 hover:bg-slate-900/10 transition-colors text-[10px] text-slate-600 flex items-start justify-start p-0.5',
              selectedCell === i && 'border-2 border-blue-500 bg-blue-500/10',
            )}
            style={{ width: cellSize, height: cellSize }}
            aria-label={`Frame ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SpriteSheetPreview.tsx
git commit -m "feat: SpriteSheetPreview (4×4 click grid)"
```

---

### Task 36: StateView assembly

**Files:**
- Modify: `src/views/StateView.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useAppStore } from '@/store'
import type { StateName } from '@/types/project'
import { StatusBadge } from '@/components/StatusBadge'
import { GenerateButton } from '@/components/GenerateButton'
import { UploadDropzone } from '@/components/UploadDropzone'
import { SpriteSheetPreview } from '@/components/SpriteSheetPreview'
import { AnimationPreview } from '@/components/AnimationPreview'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function StateView({ name }: { name: StateName }) {
  const state = useAppStore((s) => s.project.states[name])
  const updateState = useAppStore((s) => s.updateState)
  const selectedCell = useAppStore((s) => s.ui.selectedCell)
  const selectCell = useAppStore((s) => s.selectCell)
  const setStateNote = useAppStore((s) => s.setStateNote)

  const [staticUrl, setStaticUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!state.staticBase) { setStaticUrl(null); return }
    const u = URL.createObjectURL(state.staticBase)
    setStaticUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [state.staticBase])

  // Reset cell selection when switching state
  useEffect(() => { selectCell(null) }, [name, selectCell])

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize">◆ {name}</h1>
        <StatusBadge status={state.status} className="text-2xl" />
        <span className="text-sm text-slate-500">{state.status}</span>
      </div>

      <div className="flex gap-2">
        <GenerateButton
          label={`重生此 state 靜態`}
          onGenerate={() => alert('TODO M10: wire B2')}
          onEditPrompt={() => alert('TODO M10: open prompt editor for B2')}
        />
        <GenerateButton
          label={`生 ${name} 動畫`}
          onGenerate={() => alert('TODO M10: wire C')}
          onEditPrompt={() => alert('TODO M10: open prompt editor for C')}
          disabled={!state.staticBase}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-6">
        {/* Left: static base + pose note + loop config */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">靜態 base (256×256)</Label>
            <div className="border border-border" style={{ width: 256, height: 256 }}>
              {staticUrl
                ? <img src={staticUrl} alt="static" className="w-full h-full object-contain" />
                : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-xs text-slate-400">(no static)</div>
              }
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Pose Note</Label>
            <Textarea
              value={state.poseNote}
              onChange={(e) => updateState(name, { poseNote: e.target.value })}
              rows={2}
              placeholder="e.g. 站姿、頭微抬"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Loop mode</Label>
            <Select
              value={state.loopMode}
              onValueChange={(v) => updateState(name, { loopMode: v as 'loop' | 'one-shot' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loop">loop</SelectItem>
                <SelectItem value="one-shot">one-shot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Duration: {state.loopDurationMs} ms</Label>
            <Input
              type="range"
              min={100} max={10000} step={100}
              value={state.loopDurationMs}
              onChange={(e) => updateState(name, { loopDurationMs: parseInt(e.target.value, 10) })}
            />
          </div>
        </div>

        {/* Right: sheet + animation preview */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">4×4 Sheet (1024×1024)</Label>
            <SpriteSheetPreview
              sheet={state.sheet}
              selectedCell={selectedCell}
              onCellClick={selectCell}
              size={384}
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600 block mb-1">Loop preview (256×256)</Label>
            <AnimationPreview sheet={state.sheet} durationMs={state.loopDurationMs} />
          </div>
        </div>
      </div>

      {/* Cell editor */}
      {selectedCell !== null && (
        <div className="border-t border-border pt-4 space-y-2">
          <Label className="text-sm font-semibold">Frame {selectedCell + 1}</Label>
          <Textarea
            value={state.notes[selectedCell]}
            onChange={(e) => setStateNote(name, selectedCell, e.target.value)}
            rows={2}
            placeholder="e.g. 吸氣頂點,胸口最高"
          />
          <div className="flex gap-2">
            <GenerateButton
              label="重生此 frame"
              onGenerate={() => alert('TODO M11: wire D')}
              onEditPrompt={() => alert('TODO M11: open prompt editor for D')}
              disabled={!state.staticBase || !state.sheet}
            />
            <Button variant="ghost" size="sm" onClick={() => selectCell(null)}>取消選取</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev:vite
```

Click any state in sidebar → see layout. Click cell → highlighted blue, cell editor appears below. `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/views/StateView.tsx
git commit -m "feat: assemble StateView (static + sheet + anim preview + cell editor)"
```

---

## Milestone 10 — Prompt Editor + B1/B2/C Generation Flow (Tasks 37-42)

### Task 37: PromptEditorModal shell + variable display + rendered preview

**Files:**
- Create: `src/components/PromptEditorModal.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState, useMemo } from 'react'
import { useAppStore } from '@/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { TemplateKey } from '@/types/prompts'
import { render } from '@/lib/promptRenderer'
import { appendChromaSuffix, buildChromaSuffix } from '@/lib/promptBuilder'
import { DEFAULT_TEMPLATES } from '@/defaults'

export interface PromptEditorContext {
  templateKey: TemplateKey
  vars: Record<string, string>     // pre-resolved values for {{var}} substitution
  opLabel: string                  // e.g. "生 idle 動畫"
}

interface Props {
  open: boolean
  onClose: () => void
  context: PromptEditorContext | null
  onGenerate: (renderedPrompt: string) => void   // for API path
  onByogStart: (renderedPrompt: string) => void  // for BYOG path
}

export function PromptEditorModal({ open, onClose, context, onGenerate, onByogStart }: Props) {
  const templates = useAppStore((s) => s.prompts.templates)
  const setTemplate = useAppStore((s) => s.setTemplate)
  const resetTemplate = useAppStore((s) => s.resetTemplate)
  const chroma = useAppStore((s) => s.chroma)
  const [draft, setDraft] = useState<string | null>(null)

  // Reset draft when context changes
  useMemo(() => {
    if (context) setDraft(templates[context.templateKey])
  }, [context, templates])

  if (!context) return null

  const currentTemplate = draft ?? templates[context.templateKey]
  const renderedBody = render(currentTemplate, context.vars)
  const fullRendered = `${renderedBody}\n\n${buildChromaSuffix(chroma.key)}`

  function save() {
    if (context && draft !== null) setTemplate(context.templateKey, draft)
  }

  function saveAndGenerate() {
    save()
    onGenerate(fullRendered)
    onClose()
  }

  function byogPath() {
    save()
    onByogStart(fullRendered)
  }

  function doReset() {
    setDraft(DEFAULT_TEMPLATES[context!.templateKey])
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            編輯 Prompt:{context.opLabel}(模板 {context.templateKey})
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">可用變數(當前 context 值)</Label>
          <div className="text-xs font-mono bg-slate-50 p-2 rounded-md space-y-1">
            {Object.entries(context.vars).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[200px_1fr] gap-2">
                <span className="text-slate-600">{`{{${k}}}`}</span>
                <span className="text-slate-900 break-words">{v.length > 200 ? v.slice(0, 200) + '…' : v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">Template (editable)</Label>
          <Textarea
            value={currentTemplate}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
        </section>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">Auto-appended (chroma suffix, 不可改)</Label>
          <pre className="text-xs font-mono bg-slate-100 p-2 rounded-md whitespace-pre-wrap text-slate-700">
            {buildChromaSuffix(chroma.key)}
          </pre>
        </section>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">Rendered preview (實際送 AI 的內容)</Label>
          <pre className="text-xs font-mono bg-slate-50 p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-auto">
            {fullRendered}
          </pre>
        </section>

        <div className="flex justify-between items-end pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={doReset}>回預設</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button variant="outline" onClick={() => { save(); onClose() }}>儲存</Button>
            <Button onClick={saveAndGenerate}>儲存並立即生圖 ✦</Button>
          </div>
        </div>
        <div className="pt-2">
          <Button variant="secondary" className="w-full" onClick={byogPath}>
            📋 複製 Prompt + 下載 Ref,自己跑 → 回來上傳 ⤴
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PromptEditorModal.tsx
git commit -m "feat: PromptEditorModal shell with variable display + rendered preview"
```

---

### Task 38: Generation orchestrator (B1 / B2 / C / D)

**Files:**
- Create: `src/lib/generationFlow.ts`

This is the central module that ties prompt rendering → provider call → chroma key → image ops → store update for each operation.

- [ ] **Step 1: Implement**

```ts
import type { StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import type { OutputSize } from '@/types/provider'
import { useAppStore } from '@/store'
import { buildProvider } from '@/providers'
import { chromaKeyOut } from './chromaKey'
import { CHROMA_COLORS } from '@/types/chroma'
import {
  splitGrid,
  cropToSize,
  buildPlaceholderSheet,
  pasteIntoSheet,
  cropCell,
} from './imageOps'
import { render, renderCellNotesBlock, renderStateDescriptions } from './promptRenderer'
import { appendChromaSuffix } from './promptBuilder'

const OUTPUT_SIZE: Record<TemplateKey, OutputSize> = {
  B1: '1536x1024',
  B2: '1024x1024',
  C:  '1024x1024',
  D:  '1024x1024',
}

/** Build the render context for a given operation. */
export function buildPromptContext(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): { vars: Record<string, string>; opLabel: string } {
  const store = useAppStore.getState()
  const { project, prompts } = store
  const vars: Record<string, string> = {}

  if (templateKey === 'B1') {
    vars.state_descriptions = renderStateDescriptions(prompts.stateSemantics)
    return { vars, opLabel: '生 6 狀態靜態' }
  }

  if (!stateName) throw new Error(`stateName required for ${templateKey}`)
  const state = project.states[stateName]
  vars.state_name = stateName
  vars.state_semantics = prompts.stateSemantics[stateName]
  vars.pose_note = state.poseNote

  if (templateKey === 'B2') {
    return { vars, opLabel: `重生 ${stateName} 靜態` }
  }
  if (templateKey === 'C') {
    vars.cell_notes_block = renderCellNotesBlock(state.notes)
    vars.loop_mode = state.loopMode
    return { vars, opLabel: `生 ${stateName} 動畫` }
  }
  if (templateKey === 'D') {
    if (cellIndex === undefined) throw new Error('cellIndex required for D')
    vars.cell_note = state.notes[cellIndex]
    vars.frame_index = String(cellIndex + 1)
    return { vars, opLabel: `重生 ${stateName} frame ${cellIndex + 1}` }
  }
  throw new Error(`unknown templateKey: ${templateKey}`)
}

/** Build the reference Blobs that go into the AI request for a given op. */
export async function buildReferences(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): Promise<Blob[]> {
  const store = useAppStore.getState()
  const { project } = store

  if (templateKey === 'B1' || templateKey === 'B2') {
    if (!project.characterRef) throw new Error('character ref required')
    return [project.characterRef]
  }
  if (templateKey === 'C') {
    if (!stateName) throw new Error('stateName required for C')
    const sb = project.states[stateName].staticBase
    if (!sb) throw new Error(`${stateName} has no staticBase`)
    return [sb]
  }
  if (templateKey === 'D') {
    if (!stateName || cellIndex === undefined) throw new Error('stateName + cellIndex required for D')
    const state = project.states[stateName]
    if (!state.staticBase || !state.sheet) throw new Error(`${stateName} missing base or sheet`)
    const refs: Blob[] = [state.staticBase]
    if (cellIndex > 0) refs.push(await cropCell(state.sheet, cellIndex - 1))
    if (cellIndex < 15) refs.push(await cropCell(state.sheet, cellIndex + 1))
    return refs
  }
  throw new Error(`unknown templateKey: ${templateKey}`)
}

/** Apply chroma key to a generated Blob (or skip if user opted out via BYOG flag). */
export async function applyChroma(blob: Blob, skip = false): Promise<Blob> {
  if (skip) return blob
  const store = useAppStore.getState()
  const { chroma } = store
  return chromaKeyOut(blob, CHROMA_COLORS[chroma.key].rgb, chroma.tolerance)
}

/** After receiving a clean (transparent) Blob, apply per-op post-processing and update store. */
export async function applyResult(
  templateKey: TemplateKey,
  cleanedBlob: Blob,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const store = useAppStore.getState()

  if (templateKey === 'B1') {
    const cells = await splitGrid(cleanedBlob, 3, 2)   // 6 cells, 512×512 each
    for (let i = 0; i < STATE_NAMES.length; i++) {
      const name = STATE_NAMES[i]
      const staticBase = await cropToSize(cells[i], 256, 256)
      const placeholderSheet = await buildPlaceholderSheet(staticBase)
      store.updateState(name, {
        staticBase,
        sheet: placeholderSheet,
        status: 'placeholder',
      })
    }
    return
  }

  if (!stateName) throw new Error(`stateName required for ${templateKey}`)

  if (templateKey === 'B2') {
    const staticBase = await cropToSize(cleanedBlob, 256, 256)
    const placeholderSheet = await buildPlaceholderSheet(staticBase)
    store.updateState(stateName, {
      staticBase,
      sheet: placeholderSheet,
      status: 'placeholder',
    })
    return
  }

  if (templateKey === 'C') {
    // 1024×1024 sheet, use as-is
    store.updateState(stateName, { sheet: cleanedBlob, status: 'animated' })
    return
  }

  if (templateKey === 'D') {
    if (cellIndex === undefined) throw new Error('cellIndex required')
    const currentSheet = store.project.states[stateName].sheet
    if (!currentSheet) throw new Error(`${stateName} has no sheet`)
    const newCell = await cropToSize(cleanedBlob, 256, 256)
    const newSheet = await pasteIntoSheet(currentSheet, newCell, cellIndex)
    store.updateState(stateName, { sheet: newSheet })
    return
  }

  throw new Error(`unknown templateKey: ${templateKey}`)
}

/** Full end-to-end: render → provider → chroma → post-process → store. */
export async function runGeneration(
  templateKey: TemplateKey,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const store = useAppStore.getState()
  const template = store.prompts.templates[templateKey]
  const { vars } = buildPromptContext(templateKey, stateName, cellIndex)
  const rendered = appendChromaSuffix(render(template, vars), store.chroma.key)

  return runGenerationWithPrompt(templateKey, rendered, stateName, cellIndex)
}

/** Same as runGeneration but with an already-rendered prompt (used when user edits via modal). */
export async function runGenerationWithPrompt(
  templateKey: TemplateKey,
  finalPrompt: string,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const store = useAppStore.getState()
  const provider = buildProvider(store.provider)
  const references = await buildReferences(templateKey, stateName, cellIndex)
  const raw = await provider.generateImage({
    prompt: finalPrompt,
    references,
    outputSize: OUTPUT_SIZE[templateKey],
  })
  const cleaned = await applyChroma(raw)
  await applyResult(templateKey, cleaned, stateName, cellIndex)
}

export { OUTPUT_SIZE }
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generationFlow.ts
git commit -m "feat: generation orchestration (B1/B2/C/D pipelines)"
```

---

### Task 39: Wire B1 button + prompt editor in ProjectView

**Files:**
- Modify: `src/views/ProjectView.tsx`

- [ ] **Step 1: Update ProjectView**

Replace the relevant section:

```tsx
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { UploadDropzone } from '@/components/UploadDropzone'
import { MetadataForm } from '@/components/MetadataForm'
import { StateSemanticsTable } from '@/components/StateSemanticsTable'
import { ProviderConfig } from '@/components/ProviderConfig'
import { ChromaConfig } from '@/components/ChromaConfig'
import { GenerateButton } from '@/components/GenerateButton'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext } from '@/lib/generationFlow'

export function ProjectView() {
  const characterRef = useAppStore((s) => s.project.characterRef)
  const setCharacterRef = useAppStore((s) => s.setCharacterRef)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalContext, setModalContext] = useState<PromptEditorContext | null>(null)

  useEffect(() => {
    if (!characterRef) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(characterRef)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [characterRef])

  async function runB1() {
    setError(null); setGenerating(true)
    try { await runGeneration('B1') }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  function openB1PromptEditor() {
    const { vars, opLabel } = buildPromptContext('B1')
    setModalContext({ templateKey: 'B1', vars, opLabel })
    setModalOpen(true)
  }

  async function runB1WithCustomPrompt(prompt: string) {
    setError(null); setGenerating(true)
    try { await runGenerationWithPrompt('B1', prompt) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">⌂ 專案</h1>

      <Section title="Character Reference">
        <UploadDropzone
          onFile={setCharacterRef}
          preview={previewUrl}
          label="拖放或點擊上傳角色參考圖"
          previewSize={256}
        />
        <div className="pt-3 space-y-2">
          <GenerateButton
            label="生 6 狀態靜態"
            onGenerate={runB1}
            onEditPrompt={openB1PromptEditor}
            disabled={!characterRef}
            generating={generating}
          />
          {error && (
            <p className="text-sm text-red-600 max-w-prose">⚠ {error}</p>
          )}
        </div>
      </Section>

      <Section title="Metadata"><MetadataForm /></Section>
      <Section title="State Semantics"><StateSemanticsTable /></Section>
      <Section title="AI Provider"><ProviderConfig /></Section>
      <Section title="Background Removal (Chroma Key)"><ChromaConfig /></Section>

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runB1WithCustomPrompt}
        onByogStart={() => alert('TODO M12: BYOG path')}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 2: End-to-end test in browser**

Configure Author Fallback with a real `.env.local` key. Run `npm run dev` (vercel dev).

Open localhost:3000, upload a character ref, click `[✦ 生 6 狀態靜態]`.

Expected:
- Spinner / "生成中…" while waiting (~30-180s for gpt-image-2)
- On success: navigate to any state in sidebar → sidebar status badge turns ● (placeholder), static base shows, 4×4 sheet shows (16 cells all = same static)
- On failure: error message shown below button

`Ctrl-C` `vercel dev`.

- [ ] **Step 3: Commit**

```bash
git add src/views/ProjectView.tsx
git commit -m "feat: wire B1 button + prompt editor + error handling"
```

---

### Task 40: Wire B2 button in StateView

**Files:**
- Modify: `src/views/StateView.tsx`

- [ ] **Step 1: Add generation/modal state + B2 handler**

Replace the relevant section of `StateView.tsx` — full file:

```tsx
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import type { StateName } from '@/types/project'
import type { TemplateKey } from '@/types/prompts'
import { StatusBadge } from '@/components/StatusBadge'
import { GenerateButton } from '@/components/GenerateButton'
import { SpriteSheetPreview } from '@/components/SpriteSheetPreview'
import { AnimationPreview } from '@/components/AnimationPreview'
import { PromptEditorModal, type PromptEditorContext } from '@/components/PromptEditorModal'
import { runGeneration, runGenerationWithPrompt, buildPromptContext } from '@/lib/generationFlow'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function StateView({ name }: { name: StateName }) {
  const state = useAppStore((s) => s.project.states[name])
  const updateState = useAppStore((s) => s.updateState)
  const selectedCell = useAppStore((s) => s.ui.selectedCell)
  const selectCell = useAppStore((s) => s.selectCell)
  const setStateNote = useAppStore((s) => s.setStateNote)

  const [staticUrl, setStaticUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalContext, setModalContext] = useState<PromptEditorContext | null>(null)
  const [pendingKey, setPendingKey] = useState<TemplateKey | null>(null)

  useEffect(() => {
    if (!state.staticBase) { setStaticUrl(null); return }
    const u = URL.createObjectURL(state.staticBase)
    setStaticUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [state.staticBase])

  useEffect(() => { selectCell(null) }, [name, selectCell])

  async function runOp(key: TemplateKey, cellIdx?: number) {
    setError(null); setGenerating(true)
    try { await runGeneration(key, name, cellIdx) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  function openModal(key: TemplateKey, cellIdx?: number) {
    const { vars, opLabel } = buildPromptContext(key, name, cellIdx)
    setModalContext({ templateKey: key, vars, opLabel })
    setPendingKey(key)
    setModalOpen(true)
  }

  async function runWithCustomPrompt(prompt: string) {
    if (!pendingKey) return
    setError(null); setGenerating(true)
    try { await runGenerationWithPrompt(pendingKey, prompt, name, selectedCell ?? undefined) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize">◆ {name}</h1>
        <StatusBadge status={state.status} className="text-2xl" />
        <span className="text-sm text-slate-500">{state.status}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <GenerateButton
          label="重生此 state 靜態"
          onGenerate={() => runOp('B2')}
          onEditPrompt={() => openModal('B2')}
          generating={generating}
        />
        <GenerateButton
          label={`生 ${name} 動畫`}
          onGenerate={() => runOp('C')}
          onEditPrompt={() => openModal('C')}
          disabled={!state.staticBase}
          generating={generating}
        />
      </div>

      {error && <p className="text-sm text-red-600 max-w-prose">⚠ {error}</p>}

      <div className="grid grid-cols-[auto_1fr] gap-6">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">靜態 base (256×256)</Label>
            <div className="border border-border" style={{ width: 256, height: 256 }}>
              {staticUrl
                ? <img src={staticUrl} alt="static" className="w-full h-full object-contain" />
                : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-xs text-slate-400">(no static)</div>
              }
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Pose Note</Label>
            <Textarea
              value={state.poseNote}
              onChange={(e) => updateState(name, { poseNote: e.target.value })}
              rows={2}
              placeholder="e.g. 站姿、頭微抬"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Loop mode</Label>
            <Select
              value={state.loopMode}
              onValueChange={(v) => updateState(name, { loopMode: v as 'loop' | 'one-shot' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loop">loop</SelectItem>
                <SelectItem value="one-shot">one-shot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Duration: {state.loopDurationMs} ms</Label>
            <Input
              type="range" min={100} max={10000} step={100}
              value={state.loopDurationMs}
              onChange={(e) => updateState(name, { loopDurationMs: parseInt(e.target.value, 10) })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600 block mb-1">4×4 Sheet (1024×1024)</Label>
            <SpriteSheetPreview
              sheet={state.sheet}
              selectedCell={selectedCell}
              onCellClick={selectCell}
              size={384}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600 block mb-1">Loop preview (256×256)</Label>
            <AnimationPreview sheet={state.sheet} durationMs={state.loopDurationMs} />
          </div>
        </div>
      </div>

      {selectedCell !== null && (
        <div className="border-t border-border pt-4 space-y-2">
          <Label className="text-sm font-semibold">Frame {selectedCell + 1}</Label>
          <Textarea
            value={state.notes[selectedCell]}
            onChange={(e) => setStateNote(name, selectedCell, e.target.value)}
            rows={2}
            placeholder="e.g. 吸氣頂點"
          />
          <div className="flex gap-2">
            <GenerateButton
              label="重生此 frame"
              onGenerate={() => runOp('D', selectedCell)}
              onEditPrompt={() => openModal('D', selectedCell)}
              disabled={!state.staticBase || !state.sheet}
              generating={generating}
            />
            <Button variant="ghost" size="sm" onClick={() => selectCell(null)}>取消選取</Button>
          </div>
        </div>
      )}

      <PromptEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context={modalContext}
        onGenerate={runWithCustomPrompt}
        onByogStart={() => alert('TODO M12: BYOG path')}
      />
    </div>
  )
}
```

- [ ] **Step 2: End-to-end test**

Start `npm run dev`. With existing static (after B1 in Task 39):
- Click any state → click `[✦ 重生此 state 靜態]` → wait → confirm staticBase updated, sheet back to placeholder
- Click `[✦ 生 idle 動畫]` → wait → confirm sheet becomes real 4×4 animation, preview loops
- Click cell 5 → cell editor appears → click `[✦ 重生此 frame]` → wait → confirm cell 5 of sheet updated

`Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/views/StateView.tsx
git commit -m "feat: wire B2 / C / D buttons + prompt editor"
```

---

## Milestone 11 — BYOG (Bring Your Own Generation) (Tasks 41-44)

### Task 41: downloadRefs.ts — package references as separate downloads

**Files:**
- Create: `src/lib/downloadRefs.ts`

- [ ] **Step 1: Implement**

```ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadReferences(
  refs: { name: string; blob: Blob }[],
): void {
  for (const { name, blob } of refs) {
    downloadBlob(blob, name)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/downloadRefs.ts
git commit -m "feat: downloadRefs helper"
```

---

### Task 42: byogPipeline.ts — process uploaded BYOG result

**Files:**
- Create: `src/lib/byogPipeline.ts`

- [ ] **Step 1: Implement**

```ts
import type { TemplateKey } from '@/types/prompts'
import type { StateName } from '@/types/project'
import { applyChroma, applyResult } from './generationFlow'

/**
 * Take a user-uploaded image (BYOG path), apply chroma (unless skipped),
 * then run through the same post-processing as the API path.
 */
export async function processByogUpload(
  uploaded: Blob,
  templateKey: TemplateKey,
  skipChromaKey: boolean,
  stateName?: StateName,
  cellIndex?: number,
): Promise<void> {
  const cleaned = await applyChroma(uploaded, skipChromaKey)
  await applyResult(templateKey, cleaned, stateName, cellIndex)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/byogPipeline.ts
git commit -m "feat: byogPipeline (process uploaded result)"
```

---

### Task 43: ByogReceiveView — collapsible BYOG mode inside modal

**Files:**
- Create: `src/components/ByogReceiveView.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react'
import { UploadDropzone } from './UploadDropzone'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  promptCopied: boolean
  expectedSizeLabel: string
  expectedLayoutLabel: string
  onCancel: () => void
  onUpload: (blob: Blob, skipChroma: boolean) => Promise<void>
}

export function ByogReceiveView({
  promptCopied, expectedSizeLabel, expectedLayoutLabel, onCancel, onUpload,
}: Props) {
  const [skipChroma, setSkipChroma] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(blob: Blob) {
    setError(null); setUploading(true)
    try { await onUpload(blob, skipChroma) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm space-y-1">
        <div>{promptCopied ? '✓' : '…'} Prompt 已複製到剪貼簿</div>
        <div>✓ Reference 圖已下載</div>
      </div>

      <div className="text-sm space-y-1 bg-slate-50 p-3 rounded-md">
        <div className="font-medium">📋 步驟提示</div>
        <ol className="list-decimal list-inside text-xs text-slate-600 space-y-0.5">
          <li>到任何 image gen 工具(ChatGPT / Gemini / Midjourney 等)</li>
          <li>上傳 reference 圖、貼 prompt</li>
          <li>生圖、下載 PNG</li>
          <li>拖回下方上傳</li>
        </ol>
      </div>

      <div className="text-sm space-y-1 bg-amber-50 border border-amber-200 p-3 rounded-md">
        <div className="font-medium">預期輸出</div>
        <div className="text-xs text-amber-900">{expectedSizeLabel}</div>
        <div className="text-xs text-amber-900">{expectedLayoutLabel}</div>
        <div className="text-xs text-amber-900">背景:純綠 #00FF00 或洋紅 #FF00FF(對應你的 chroma 設定)</div>
      </div>

      <UploadDropzone
        onFile={handleUpload}
        label={uploading ? '處理中…' : '⬇ 拖檔或點此上傳結果 ⬇'}
        previewSize={300}
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="skip-chroma"
          checked={skipChroma}
          onCheckedChange={(v) => setSkipChroma(Boolean(v))}
        />
        <Label htmlFor="skip-chroma" className="text-sm">背景已是透明,跳過 chroma key</Label>
      </div>

      {error && <p className="text-sm text-red-600">⚠ {error}</p>}

      <Button variant="ghost" onClick={onCancel}>取消,回 Prompt 編輯</Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ByogReceiveView.tsx
git commit -m "feat: ByogReceiveView component"
```

---

### Task 44: Wire BYOG path into PromptEditorModal

**Files:**
- Modify: `src/components/PromptEditorModal.tsx`

- [ ] **Step 1: Add BYOG state + handlers**

Replace the modal component to include BYOG receive mode:

```tsx
import { useState, useMemo } from 'react'
import { useAppStore } from '@/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { TemplateKey } from '@/types/prompts'
import type { StateName } from '@/types/project'
import { render } from '@/lib/promptRenderer'
import { appendChromaSuffix, buildChromaSuffix } from '@/lib/promptBuilder'
import { DEFAULT_TEMPLATES } from '@/defaults'
import { OUTPUT_SIZE, buildReferences } from '@/lib/generationFlow'
import { downloadReferences } from '@/lib/downloadRefs'
import { processByogUpload } from '@/lib/byogPipeline'
import { ByogReceiveView } from './ByogReceiveView'

export interface PromptEditorContext {
  templateKey: TemplateKey
  vars: Record<string, string>
  opLabel: string
  stateName?: StateName
  cellIndex?: number
}

interface Props {
  open: boolean
  onClose: () => void
  context: PromptEditorContext | null
  onGenerate: (renderedPrompt: string) => void
}

const LAYOUT_LABEL: Record<TemplateKey, string> = {
  B1: '3 columns × 2 rows of 6 character poses (idle / sleeping / recording / thinking / done / error)',
  B2: '單一角色靜態姿勢',
  C:  '4×4 grid sprite sheet, 16-frame row-major animation',
  D:  '單一 frame(銜接前後)',
}

export function PromptEditorModal({ open, onClose, context, onGenerate }: Props) {
  const templates = useAppStore((s) => s.prompts.templates)
  const setTemplate = useAppStore((s) => s.setTemplate)
  const chroma = useAppStore((s) => s.chroma)
  const [draft, setDraft] = useState<string | null>(null)
  const [byogMode, setByogMode] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  useMemo(() => {
    if (context) { setDraft(templates[context.templateKey]); setByogMode(false); setPromptCopied(false) }
  }, [context, templates])

  if (!context) return null

  const currentTemplate = draft ?? templates[context.templateKey]
  const renderedBody = render(currentTemplate, context.vars)
  const fullRendered = appendChromaSuffix(renderedBody, chroma.key)

  function save() {
    if (context && draft !== null) setTemplate(context.templateKey, draft)
  }

  function saveAndGenerate() {
    save()
    onGenerate(fullRendered)
    onClose()
  }

  async function startByog() {
    save()
    // Copy prompt
    try { await navigator.clipboard.writeText(fullRendered); setPromptCopied(true) }
    catch { setPromptCopied(false) }
    // Download refs
    const refs = await buildReferences(context!.templateKey, context!.stateName, context!.cellIndex)
    downloadReferences(
      refs.map((blob, i) => ({ name: `byog-ref-${context!.templateKey}-${i}.png`, blob })),
    )
    setByogMode(true)
  }

  async function onByogUpload(blob: Blob, skipChroma: boolean) {
    await processByogUpload(blob, context!.templateKey, skipChroma, context!.stateName, context!.cellIndex)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {byogMode ? `BYOG 模式:${context.opLabel}` : `編輯 Prompt:${context.opLabel}(模板 ${context.templateKey})`}
          </DialogTitle>
        </DialogHeader>

        {byogMode ? (
          <ByogReceiveView
            promptCopied={promptCopied}
            expectedSizeLabel={`Size: ${OUTPUT_SIZE[context.templateKey]}`}
            expectedLayoutLabel={`Layout: ${LAYOUT_LABEL[context.templateKey]}`}
            onCancel={() => setByogMode(false)}
            onUpload={onByogUpload}
          />
        ) : (
          <>
            <section className="space-y-2">
              <Label className="text-sm font-semibold">可用變數(當前 context 值)</Label>
              <div className="text-xs font-mono bg-slate-50 p-2 rounded-md space-y-1">
                {Object.entries(context.vars).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[200px_1fr] gap-2">
                    <span className="text-slate-600">{`{{${k}}}`}</span>
                    <span className="text-slate-900 break-words whitespace-pre-wrap">
                      {v.length > 200 ? v.slice(0, 200) + '…' : v}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Template (editable)</Label>
              <Textarea
                value={currentTemplate}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Auto-appended (chroma suffix, 不可改)</Label>
              <pre className="text-xs font-mono bg-slate-100 p-2 rounded-md whitespace-pre-wrap text-slate-700">
                {buildChromaSuffix(chroma.key)}
              </pre>
            </section>

            <section className="space-y-2">
              <Label className="text-sm font-semibold">Rendered preview</Label>
              <pre className="text-xs font-mono bg-slate-50 p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-auto">
                {fullRendered}
              </pre>
            </section>

            <div className="flex justify-between items-end pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_TEMPLATES[context!.templateKey])}>
                回預設
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button variant="outline" onClick={() => { save(); onClose() }}>儲存</Button>
                <Button onClick={saveAndGenerate}>儲存並立即生圖 ✦</Button>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="secondary" className="w-full" onClick={startByog}>
                📋 複製 Prompt + 下載 Ref,自己跑 → 回來上傳 ⤴
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update modal callers to pass stateName + cellIndex in context**

Update `src/views/ProjectView.tsx` — the `openB1PromptEditor` function:

```tsx
function openB1PromptEditor() {
  const { vars, opLabel } = buildPromptContext('B1')
  setModalContext({ templateKey: 'B1', vars, opLabel })
  setModalOpen(true)
}
```

(no change needed for B1 since it has no state/cell)

Update `src/views/StateView.tsx` — replace `openModal`:

```tsx
function openModal(key: TemplateKey, cellIdx?: number) {
  const { vars, opLabel } = buildPromptContext(key, name, cellIdx)
  setModalContext({
    templateKey: key, vars, opLabel,
    stateName: name,
    cellIndex: cellIdx,
  })
  setPendingKey(key)
  setModalOpen(true)
}
```

Also remove the `onByogStart` prop from both view's `<PromptEditorModal>` usages — the new modal handles BYOG internally.

In `ProjectView.tsx`:

```tsx
<PromptEditorModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  context={modalContext}
  onGenerate={runB1WithCustomPrompt}
/>
```

In `StateView.tsx`:

```tsx
<PromptEditorModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  context={modalContext}
  onGenerate={runWithCustomPrompt}
/>
```

- [ ] **Step 3: End-to-end test BYOG**

Run `npm run dev`. On Project view:
1. Upload char ref
2. Click ⚙️ next to `[✦ 生 6 狀態靜態]`
3. Click `[📋 複製 Prompt + 下載 Ref...]`
4. Confirm clipboard has prompt (paste somewhere to verify), 1 PNG file downloaded
5. Modal switches to BYOG receive view
6. Upload some image file → confirm chroma key applied + split into 6 states (sidebar badges turn ●)

`Ctrl-C`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PromptEditorModal.tsx src/views/ProjectView.tsx src/views/StateView.tsx
git commit -m "feat: BYOG mode integrated into PromptEditorModal"
```

---

## Milestone 12 — Export (Tasks 45-49)

### Task 45: manifest.ts builder + tests (TDD)

**Files:**
- Create: `src/lib/manifest.ts`, `tests/manifest.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { buildManifest } from '@/lib/manifest'
import type { Project, ProjectMetadata } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'
import { STATE_NAMES } from '@/types/project'

function makeProject(metadata: Partial<ProjectMetadata> = {}): Project {
  const states = {} as Project['states']
  for (const n of STATE_NAMES) {
    states[n] = {
      staticBase: null, sheet: null, poseNote: '', notes: Array(16).fill(''),
      loopMode: DEFAULT_LOOP_MODES[n],
      loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[n],
      status: 'pending',
    }
  }
  return {
    characterRef: null,
    states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'yazelin', license: 'CC-BY-NC-SA-4.0',
      description: 'desc', tags: ['fantasy'],
      ...metadata,
    },
  }
}

describe('buildManifest', () => {
  it('produces a schema-compliant v1.0 manifest', () => {
    const m = buildManifest(makeProject())
    expect(m.schema_version).toBe('1.0')
    expect(m.package_name).toBe('mori')
    expect(m.display_name).toBe('Mori')
    expect(m.version).toBe('1.0.0')
    expect(m.author).toBe('yazelin')
    expect(m.license).toBe('CC-BY-NC-SA-4.0')
    expect(m.states).toEqual(['idle', 'sleeping', 'recording', 'thinking', 'done', 'error'])
    expect(m.optional_states).toEqual(['walking', 'dragging'])
    expect(m.loop_modes.idle).toBe('loop')
    expect(m.loop_modes.done).toBe('one-shot')
    expect(m.sprite_spec.format).toBe('PNG-32')
    expect(m.sprite_spec.grid).toBe('4x4')
    expect(m.sprite_spec.total_size).toBe('1024x1024')
    expect(m.sprite_spec.background).toBe('transparent')
  })

  it('carries through per-state loop overrides', () => {
    const project = makeProject()
    project.states.idle.loopDurationMs = 4200
    project.states.error.loopMode = 'loop'
    const m = buildManifest(project)
    expect(m.loop_durations_ms.idle).toBe(4200)
    expect(m.loop_modes.error).toBe('loop')
  })
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/manifest.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement src/lib/manifest.ts**

```ts
import type { ManifestV1 } from '@/types/manifest'
import type { Project, StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export function buildManifest(project: Project): ManifestV1 {
  const loopModes = {} as Record<StateName, 'loop' | 'one-shot'>
  const loopDurations = {} as Record<StateName, number>
  for (const n of STATE_NAMES) {
    loopModes[n] = project.states[n].loopMode
    loopDurations[n] = project.states[n].loopDurationMs
  }
  return {
    schema_version: '1.0',
    package_name: project.metadata.packageName,
    display_name: project.metadata.displayName,
    version: project.metadata.version,
    author: project.metadata.author,
    license: project.metadata.license,
    description: project.metadata.description,
    tags: [...project.metadata.tags],
    states: [...STATE_NAMES],
    optional_states: ['walking', 'dragging'],
    loop_modes: loopModes,
    loop_durations_ms: loopDurations,
    sprite_spec: {
      format: 'PNG-32',
      grid: '4x4',
      total_size: '1024x1024',
      frame_size: '256x256',
      frame_order: 'row-major-left-to-right-top-to-bottom',
      background: 'transparent',
    },
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/manifest.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifest.ts tests/manifest.test.ts
git commit -m "feat: buildManifest + tests"
```

---

### Task 46: validation.ts + tests (TDD)

**Files:**
- Create: `src/lib/validation.ts`, `tests/validation.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { validateProject } from '@/lib/validation'
import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'

function emptyProject(): Project {
  const states = {} as Project['states']
  for (const n of STATE_NAMES) {
    states[n] = {
      staticBase: null, sheet: null, poseNote: '', notes: Array(16).fill(''),
      loopMode: DEFAULT_LOOP_MODES[n],
      loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[n],
      status: 'pending',
    }
  }
  return {
    characterRef: null, states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'yazelin', license: 'MIT', description: '', tags: [],
    },
  }
}

describe('validateProject', () => {
  it('blocks when packageName is empty', () => {
    const p = emptyProject()
    p.metadata.packageName = ''
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
    expect(r.blocking.some((b) => b.includes('package_name'))).toBe(true)
  })

  it('blocks when packageName has uppercase', () => {
    const p = emptyProject()
    p.metadata.packageName = 'Mori'
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
  })

  it('blocks when displayName is empty', () => {
    const p = emptyProject()
    p.metadata.displayName = ''
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
  })

  it('blocks when all states have no sheet', () => {
    const p = emptyProject()
    const r = validateProject(p)
    expect(r.canExport).toBe(false)
    expect(r.blocking.some((b) => b.includes('sheet'))).toBe(true)
  })

  it('warns about partial completion but does not block', async () => {
    const p = emptyProject()
    p.states.idle.sheet = new Blob([new Uint8Array([1])], { type: 'image/png' })
    p.states.idle.status = 'animated'
    const r = validateProject(p)
    expect(r.canExport).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('warns about non-semver version', () => {
    const p = emptyProject()
    p.states.idle.sheet = new Blob([new Uint8Array([1])], { type: 'image/png' })
    p.metadata.version = 'one'
    const r = validateProject(p)
    expect(r.warnings.some((w) => w.includes('version'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/validation.test.ts
```

- [ ] **Step 3: Implement src/lib/validation.ts**

```ts
import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'

export interface ValidationResult {
  canExport: boolean
  blocking: string[]
  warnings: string[]
}

const PACKAGE_NAME_RE = /^[a-z][a-z0-9_]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/

export function validateProject(p: Project): ValidationResult {
  const blocking: string[] = []
  const warnings: string[] = []

  if (!p.metadata.packageName.trim()) {
    blocking.push('package_name 不能為空')
  } else if (!PACKAGE_NAME_RE.test(p.metadata.packageName)) {
    blocking.push(`package_name 必須符合 ^[a-z][a-z0-9_]*$(目前: "${p.metadata.packageName}")`)
  }

  if (!p.metadata.displayName.trim()) {
    blocking.push('display_name 不能為空')
  }

  const sheetCount = STATE_NAMES.filter((n) => p.states[n].sheet !== null).length
  if (sheetCount === 0) {
    blocking.push('至少要有 1 個 state 有 sheet')
  }

  if (!SEMVER_RE.test(p.metadata.version)) {
    warnings.push(`version "${p.metadata.version}" 不符 semver 格式`)
  }

  for (const n of STATE_NAMES) {
    if (!p.states[n].sheet) {
      warnings.push(`${n} 沒有 sheet,匯出時會缺檔(mori-desktop 會 fallback default)`)
    } else if (p.states[n].status === 'placeholder') {
      warnings.push(`${n} 仍為 placeholder,未動畫化`)
    }
    const dur = p.states[n].loopDurationMs
    if (dur < 100 || dur > 30000) {
      warnings.push(`${n} loopDurationMs ${dur} 超出 100-30000 範圍`)
    }
  }

  return {
    canExport: blocking.length === 0,
    blocking,
    warnings,
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/validation.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/validation.test.ts
git commit -m "feat: validation rules (blocking + warnings) + tests"
```

---

### Task 47: exportPack.ts (JSZip) + tests

**Files:**
- Create: `src/lib/exportPack.ts`, `tests/exportPack.test.ts`

- [ ] **Step 1: Install JSZip + file-saver**

```bash
npm install jszip file-saver
npm install -D @types/file-saver
```

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildPackBlob } from '@/lib/exportPack'
import type { Project } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { DEFAULT_LOOP_MODES, DEFAULT_LOOP_DURATIONS_MS } from '@/defaults'

async function makePngBlob(): Promise<Blob> {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' })
}

async function makeProjectWithSheets(): Promise<Project> {
  const states = {} as Project['states']
  for (const n of STATE_NAMES) {
    states[n] = {
      staticBase: null,
      sheet: await makePngBlob(),
      poseNote: '', notes: Array(16).fill(''),
      loopMode: DEFAULT_LOOP_MODES[n],
      loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[n],
      status: 'animated',
    }
  }
  return {
    characterRef: null, states,
    metadata: {
      packageName: 'mori', displayName: 'Mori', version: '1.0.0',
      author: 'y', license: 'MIT', description: '', tags: ['t'],
    },
  }
}

describe('exportPack', () => {
  it('produces a zip with manifest.json + 6 sprite PNGs', async () => {
    const project = await makeProjectWithSheets()
    const blob = await buildPackBlob(project)
    expect(blob.type).toBe('application/zip')

    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('manifest.json')).not.toBeNull()
    for (const n of STATE_NAMES) {
      expect(zip.file(`sprites/${n}.png`)).not.toBeNull()
    }

    const manifestStr = await zip.file('manifest.json')!.async('string')
    const manifest = JSON.parse(manifestStr)
    expect(manifest.schema_version).toBe('1.0')
    expect(manifest.package_name).toBe('mori')
  })

  it('omits sprite file for a state with no sheet', async () => {
    const project = await makeProjectWithSheets()
    project.states.recording.sheet = null
    const blob = await buildPackBlob(project)
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('sprites/recording.png')).toBeNull()
    expect(zip.file('sprites/idle.png')).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run — confirm fail**

```bash
npm test -- tests/exportPack.test.ts
```

- [ ] **Step 4: Implement src/lib/exportPack.ts**

```ts
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Project, StateName } from '@/types/project'
import { STATE_NAMES } from '@/types/project'
import { buildManifest } from './manifest'

export async function buildPackBlob(project: Project): Promise<Blob> {
  const zip = new JSZip()
  const manifest = buildManifest(project)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const sprites = zip.folder('sprites')
  if (!sprites) throw new Error('failed to create sprites/ folder in zip')

  for (const name of STATE_NAMES as readonly StateName[]) {
    const sheet = project.states[name].sheet
    if (!sheet) continue
    const buf = await sheet.arrayBuffer()
    sprites.file(`${name}.png`, buf)
  }

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadPack(project: Project): Promise<void> {
  const blob = await buildPackBlob(project)
  const filename = `${project.metadata.packageName}.moripack.zip`
  saveAs(blob, filename)
}
```

- [ ] **Step 5: Run — confirm pass**

```bash
npm test -- tests/exportPack.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exportPack.ts tests/exportPack.test.ts package.json package-lock.json
git commit -m "feat: exportPack (JSZip) + tests + jszip/file-saver deps"
```

---

### Task 48: ExportView assembly

**Files:**
- Modify: `src/views/ExportView.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { STATE_NAMES } from '@/types/project'
import { StatusBadge } from '@/components/StatusBadge'
import { validateProject } from '@/lib/validation'
import { buildManifest } from '@/lib/manifest'
import { downloadPack } from '@/lib/exportPack'

export function ExportView() {
  const project = useAppStore((s) => s.project)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = validateProject(project)
  const manifest = buildManifest(project)

  async function handleExport() {
    setError(null); setDownloading(true)
    try { await downloadPack(project) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setDownloading(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">⤓ 匯出</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-medium border-b border-border pb-1">完成度檢查</h2>
        <div className="space-y-1 font-mono text-sm">
          {STATE_NAMES.map((n) => {
            const s = project.states[n]
            const symbol = s.status === 'animated' ? '✓' : s.status === 'placeholder' ? '⚠' : '✗'
            return (
              <div key={n} className="grid grid-cols-[100px_120px_30px_1fr] gap-2 items-center">
                <span className="capitalize">{n}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.status}
                </span>
                <span>{symbol}</span>
                <span className="text-xs text-slate-500">
                  {s.status === 'pending' && '尚未生靜態'}
                  {s.status === 'placeholder' && '靜態 OK,未動畫化'}
                  {s.status === 'animated' && 'OK'}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {validation.blocking.length > 0 && (
        <section className="space-y-1 bg-red-50 border border-red-200 p-3 rounded-md">
          <h3 className="text-sm font-semibold text-red-900">阻擋匯出:</h3>
          <ul className="list-disc list-inside text-sm text-red-900">
            {validation.blocking.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </section>
      )}

      {validation.warnings.length > 0 && (
        <section className="space-y-1 bg-amber-50 border border-amber-200 p-3 rounded-md">
          <h3 className="text-sm font-semibold text-amber-900">警告:</h3>
          <ul className="list-disc list-inside text-sm text-amber-900">
            {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium border-b border-border pb-1">manifest.json 預覽</h2>
        <pre className="text-xs font-mono bg-slate-50 p-3 rounded-md overflow-auto max-h-96">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </section>

      <div>
        <Button
          size="lg"
          disabled={!validation.canExport || downloading}
          onClick={handleExport}
        >
          ⤓ 匯出 {project.metadata.packageName}.moripack.zip
        </Button>
        {error && <p className="text-sm text-red-600 mt-2">⚠ {error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev:vite`. Click `⤓ 匯出`:
- See completeness rows for 6 states
- See warning if not all animated
- See blocking error if package_name invalid (try clearing it on Project view, come back)
- Click `[⤓ 匯出 …]` → downloads `mori.moripack.zip`. Open the zip — confirm `manifest.json` + 6 `sprites/*.png`.

`Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/views/ExportView.tsx
git commit -m "feat: assemble ExportView (completeness + manifest preview + download)"
```

---

### Task 49: Smoke-test exported zip against mori-desktop format

**Files:** none (verification only)

- [ ] **Step 1: Manually unzip and inspect**

After producing `mori.moripack.zip` via Task 48:

```bash
mkdir /tmp/mori-pack-check && cd /tmp/mori-pack-check
unzip ~/Downloads/mori.moripack.zip   # or wherever it landed
ls
cat manifest.json | head -30
file sprites/*.png    # confirm all PNG-32, transparent
```

Expected:
- `manifest.json` matches spec schema exactly
- `sprites/idle.png` etc. are 1024×1024 PNG with transparent BG

- [ ] **Step 2: (Optional) Diff against mori-desktop's bundled mori pack**

```bash
diff -q /tmp/mori-pack-check/manifest.json /home/ct/mori-universe/mori-desktop/crates/mori-tauri/bundled-character/mori/manifest.json
```

Differences should only be in version/description/tags fields (not in schema or structure).

- [ ] **Step 3: Cleanup**

```bash
rm -rf /tmp/mori-pack-check
```

No commit (verification only).

---

## Milestone 13 — Final Verification + Deploy (Tasks 50-52)

### Task 50: Full end-to-end workflow test

**Files:** none (manual verification)

- [ ] **Step 1: Clear localStorage and start fresh**

In browser DevTools console:
```js
localStorage.clear()
location.reload()
```

- [ ] **Step 2: Configure Author Fallback or a real provider**

If using `.env.local` with `AUTHOR_API_KEY` set, leave provider as Author Fallback (default).
Otherwise, switch to one of Codex/Vertex/Google and paste your key.

- [ ] **Step 3: Run the happy path**

1. Upload a character ref image (any character drawing works)
2. Project view → `[✦ 生 6 狀態靜態]` → wait → expect 6 sidebar badges turn ●
3. For each state in sidebar:
   - Click state
   - Click `[✦ 生 <state> 動畫]` → wait → expect badge turns ◆, animation preview loops
4. Pick any state → click a cell → write a note → click `[✦ 重生此 frame]` → wait → expect cell updated
5. `⤓ 匯出` → check completeness row all ✓ → click `[⤓ 匯出 mori.moripack.zip]`
6. Unzip the result and confirm structure

- [ ] **Step 4: Verify localStorage persistence**

Refresh page → expect all state preserved (character ref, all sheets, notes, metadata, provider config).

- [ ] **Step 5: Test BYOG path**

On any state, click ⚙️ → `[📋 複製 Prompt + 下載 Ref...]` → upload any image as result → confirm processing completes.

- [ ] **Step 6: Note any bugs found**

If issues found, fix them via additional commits before proceeding. No commit needed for the test itself.

---

### Task 51: README polish + deployment instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Expand README with deployment section**

Add to the bottom of `README.md`:

```markdown
## Deployment to Vercel

```bash
vercel link    # one-time, links to your Vercel scope
vercel --prod  # deploy to production
```

Set these env vars in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Example |
|---|---|---|
| `AUTHOR_FALLBACK_PROVIDER` | yes | `vertex-gemini` or `google-gemini` |
| `AUTHOR_API_KEY` | yes | (the API key for the chosen provider) |
| `AUTHOR_MODEL` | no | `gemini-3-pro-image-preview` (default for vertex) |
| `AUTHOR_IMAGE_SIZE` | no | `1K` (default) |

**Important:** `AUTHOR_MODEL` must match `AUTHOR_FALLBACK_PROVIDER` — Vertex-only models like `gemini-3-pro-image-preview` will 502 if used with `google-gemini` provider, and vice versa.

## Architecture summary

- **Pure frontend** (Vite + React) + 1 Vercel Function (`api/generate.ts`) for the Author Fallback proxy
- **Per-state animation preview** uses CSS animation matching mori-desktop's `floating.css` exactly
- **Background removal** uses chroma-key (AI generates with green/magenta solid bg → client-side pixel removal) since gpt-image-2 and Gemini both lack native transparent output
- **5 image paths**: Codex-Image / Vertex Gemini / Google Gemini Direct / Author Fallback / BYOG (Bring Your Own Generation: copy prompt, run elsewhere, upload result)

See `docs/superpowers/specs/2026-05-22-mori-sprite-studio-design.md` for the full design rationale.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: expand README with deployment + architecture"
```

---

### Task 52: Build verification + deploy

**Files:** none

- [ ] **Step 1: Verify build succeeds**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors, no Vite build errors.

If errors appear, fix and re-commit. Don't skip — broken build means broken deploy.

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Deploy to Vercel (preview first)**

```bash
vercel
```

This deploys to a preview URL (not production). Open the URL, verify:
- Page loads
- localStorage persistence works
- Can configure provider + chroma
- Can attempt B1 generation (will need env var configured in Vercel dashboard first — see Task 51)

- [ ] **Step 4: Deploy to production**

```bash
vercel --prod
```

Open the production URL. Final smoke test.

- [ ] **Step 5: Note the production URL in commit**

```bash
git commit --allow-empty -m "chore: deploy to Vercel production at <URL>"
```

(Replace `<URL>` with actual URL.)

---

## Self-Review (writing-plans skill, performed after writing the plan)

### Spec coverage

Walking through `2026-05-22-mori-sprite-studio-design.md` section by section:

- **§1 Motivation / §2 Scope** — captured in plan goal/architecture + Task 5 README + Task 51 polish
- **§3 Workflow (B1/B2/C/D/E)** — Task 38 generation orchestrator covers all 4 ops; Tasks 39 (B1 wiring), 40 (B2/C/D wiring) complete the flow
- **§4 Architecture** — provider abstraction (Task 20), 4 providers (Tasks 21-23), factory (Task 24), generation flow (Task 38)
- **§5 Data Model** — Task 6 types + Task 7 defaults + Task 10 store
- **§6 UI Structure** — Sidebar (Task 14), 3 view types (Tasks 32, 36, 40, 48), prompt editor modal (Tasks 37, 44)
- **§7 AI Integration** — 4 provider impls + Vercel function (Task 25) + BYOG (Tasks 41-44)
- **§7.2 Size mapping** — encoded in `OUTPUT_SIZE` map in Task 38
- **§7.3 BYOG** — Tasks 41-44
- **§7.4 CORS** — flagged in spec as known follow-up; no special task needed (Author Fallback bypasses)
- **§8 Prompt System** — defaults (Task 7), renderer + chroma suffix (Tasks 18-19), editor (Tasks 37, 44)
- **§9 Chroma Key** — Task 16 + types in Task 6
- **§10 Export Format** — Tasks 45-48
- **§11 Project Structure / Tech Stack** — File Structure section at top + Tasks 1-4 scaffold
- **§12 Deployment** — Task 52
- **§13 Defaults** — Task 7
- **§14 Known Follow-ups** — out of scope (MVP excludes by design)

No gaps identified.

### Placeholder scan

- "TODO M10 / M11 / M12" appear in alert() stubs (Tasks 32, 36). These are intentional placeholders REPLACED by Tasks 39 / 40 / 44 — clearly marked.
- No abstract "add error handling" or "implement appropriate validation" — all validation is concrete in `validation.ts` (Task 46) with specific blocking/warning rules.
- All file paths absolute or rooted at repo.
- All code examples complete (no `// ...` omissions).

### Type consistency

- `ProviderName` defined once (Task 6) and used identically in all 4 provider implementations (Tasks 21-24), factory (Task 24), and store (Task 10).
- `OutputSize` matches across `GenerateOpts` (Task 6), provider impls (Tasks 21-22), `generationFlow.OUTPUT_SIZE` (Task 38), Vercel function (Task 25).
- `TemplateKey = 'B1' | 'B2' | 'C' | 'D'` used consistently in `DEFAULT_TEMPLATES`, `setTemplate` store action, `PromptEditorContext`, `buildPromptContext`.
- Action names match: `setView`, `selectCell`, `setCharacterRef`, `updateMetadata`, `updateState`, `setStateNote`, `setStateSemantics`, `setTemplate`, `resetTemplate`, `setProviderActive`, `updateProviderConfig`, `setChroma` — all declared in Task 10 and used as defined throughout.
- `chromaKeyOut(blob, rgb, tolerance)` signature consistent between Task 16 impl and Task 38 caller.
- `buildPlaceholderSheet(staticBase)` from Task 17 imageOps, used in Task 38.

No inconsistencies found.

### Scope check

Plan is 52 tasks across 13 milestones. Estimated 7-10 days of focused work for a skilled engineer not familiar with the codebase (which is fresh anyway). The decomposition is fine for a single plan — each milestone produces an observable increment (M1 boot screen, M3 store working, M4 nav working, M8 project form, M9 state view stub, M10 first AI call working, M11 fine-tuning, M12 export, M13 deployed).

No need to split into sub-plans.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-22-mori-sprite-studio.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for catching mistakes early in a long plan like this.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Better if you want to watch the work happen.

**Which approach?**
