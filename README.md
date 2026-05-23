<div align="center">

# Mori Sprite Studio

🌐 **English** · [繁體中文](./README.zh-TW.md)

**Web tool to build 1024×1024 4×4 sprite animation packs from a single character reference image.**

AI-powered. Browser-only. Transparent backgrounds. Multiple export formats.

<img src="docs/assets/mori-idle.png" width="160" alt="Mori idle animation"> &nbsp; <img src="docs/assets/mori-sleeping.png" width="160" alt="Mori sleeping animation">

[**▶ Try the live app**](https://mori-sprite-studio.vercel.app) · [Docs / screenshots](https://yazelin.github.io/mori-sprite-studio/) · [☕ Buy me a coffee](https://buymeacoffee.com/yazelin)

</div>

---

## What it does

You give it **one reference image** of your character. It produces a complete sprite animation pack for [mori-desktop](https://github.com/yazelin/mori-desktop) — **6 required + 2 optional animated states**, each a 1024×1024 4×4 sprite sheet that the floating window plays back.

| Required (6) | Optional (2) |
|---|---|
| idle / sleeping / recording / thinking / done / error | walking / dragging |

It's built for [**Mori**](https://github.com/yazelin/mori-desktop) — yazelin's 森林精靈 (forest spirit) Jarvis-style AI partner who lives on the desktop. _"Iron Man 有 Jarvis,我有 Mori。"_ This studio makes Mori's visible body — her sprite form — that the mori-desktop floating window animates.

The studio also works for **any character you want to give a visible form to**: your own AI partner / personal spirit / streamer overlay companion / character mascot. The Mori demo is one example of what's possible.

You can also export each state as APNG, GIF, WebM, or just the raw sheet PNG — useful for LINE animated stickers, Discord, OBS overlays, video editing, etc.

![Project setup screen](docs/assets/screen-01-project.png)

---

## Workflow

```
[character ref image]
       │
       │ (AI · 1 call → 6-cell grid)
       ▼
[6 static base poses]    ← editable / re-rollable per state
       │
       │ (AI · 6 calls, one per state)
       ▼
[6 sprite sheets, 4×4 each]    ← editable per cell, normalize across states
       │
       │ (optional) walking + dragging
       ▼
[+2 cyclic-locomotion sheets]    ← W / Dr standalone pipeline (no pre-tile)
       │
       │ (manual sort: 反向 + 換位)
       ▼
[hand-tuned gait cycle]
       │
       │ (bake transforms + zip)
       ▼
[mori.moripack.zip]    →    mori-desktop
       │
       │ (per state, optional)
       ▼
[mori-{state}.png / .gif / .webm]    →    LINE / Discord / OBS
```

1. **Upload character ref** — any PNG/JPG of your character (cropped, any background).
2. **Generate 6 statics** — one AI call produces a 3×2 grid the tool splits into 6 state poses (idle / sleeping / recording / thinking / done / error).
3. **Per-state animation (6 required states)** — click `生 <state> 動畫` to produce the 4×4 sprite sheet. Uses pre-tiled placeholder + multi-anchor identity reference to keep the character locked in position with subtle motion (blink, breath, gesture).
4. **Optional: walking + dragging** — separate W / Dr pipeline (NO pre-tile, since cyclic locomotion needs free per-frame design). Generate neutral full-body static → 4×4 gait/swing sheet → manually reorder cells with reverse + swap buttons to get a clean cycle.
5. **Fine-tune** — click any cell to regen just that frame; adjust loop duration / mode; normalize size across states; per-state scale/offset sliders with reference guides; manual upload / download of any sheet for Photoshop round-trip.
6. **Backdrop** (optional) — upload Light + Dark backdrop PNGs that ship inside the pack. Use **桌面預覽** view to preview the 6+2 states layered on backdrop with shape (round/rounded/square) + theme (light/dark) toggles.
7. **Export** `.moripack.zip` — drop into mori-desktop's character folder.

![State editor](docs/assets/screen-02-state.png)

---

## Features

**Generation**
- 4 AI providers: **Author Fallback** (default, free no-setup), **Codex-Image** (your ChatGPT Plus/Pro quota via [yazelin/codex-image-service](https://github.com/yazelin/codex-image-service)), **Vertex Gemini**, **Google Gemini Direct**
- Anti-jitter: pre-tiled placeholder sheet as AI reference locks character position across all 16 frames (idle-family states)
- Anti-character-drift: multi-anchor identity reference (sends all other state staticBases as outfit anchors)
- Anatomy-agnostic prompts: works for humanoid / plant / robot / blob / gem characters — semantics describe motion abstractly
- Two one-shot sub-patterns: BURST-AND-SETTLE (done celebrations) vs SUSTAINED-ENERGY (error / panic)
- BYOG path: copy prompt + reference, run AI yourself, upload result

**Walking + Dragging (optional cyclic-locomotion states)**
- Dedicated **W / Dr standalone pipeline** — no pre-tile (which would lock the character to one pose). AI designs all 16 cells freely from character ref + neutral standing static.
- Embedded explicit gait/swing cycle structure in template (16-frame breakdown: cell 1 = left foot fwd, cell 7 = right foot fwd, etc.)
- Strong identity lock: 'character design / hair / clothes / art style stay locked across all 16 cells, ONLY legs + arms + body tilt change'
- Walking sprite designed facing RIGHT — mori-desktop engine mirrors via `scaleX(-1)` for leftward motion

**Manual cell sorting (post-generation tuning)**
- **↺ 反向順序** — one-click reverse all 16 cells (rescues sheets that play in reverse direction)
- **✥ 換位模式** — toggle on, click cell A → click cell B → contents swap. Stay on for multiple swaps. Hand-tune the gait order until the walk looks right.

**桌面預覽 view (desktop simulation)**
- 6+2 floating-widget mockups laid out simultaneously, exactly matching mori-desktop's render:
  - 200×200 stage with backdrop (`object-cover` cover full window)
  - 130×130 sprite centered (`drop-shadow` matches floating.css)
  - 1px outline (matches XShape clip)
  - Real 3-layer backdrop composition (vignette + PNG + base gradient — copied 1:1 from mori-desktop's computed style)
- Independent toggles: **mori-desktop App theme** (light/dark backdrop) × **OS theme** (light/dark wallpaper) × **shape** (circle/rounded/square) × **backplate mode** (logo/plain)
- Inline technical explainer: why backdrop exists at all (Linux X11 + WebKit2GTK alpha-compositing bug workaround), how the 3-tier backplate fallback chain works

**Editing**
- Per-cell regeneration with `prev frame + next frame + staticBase` references for smooth interpolation
- Editable per-state prompt templates + per-cell notes
- Pose Note per state
- Loop mode (loop / one-shot) + duration slider per state

**Cleanup**
- Configurable chroma key (green or magenta) with conservative/balanced/aggressive tolerance
- Edge erosion (0-10 px) wipes residual chroma halo at character outline
- Re-chroma button replays from raw AI output (non-destructive — bump erosion up/down at will)

**Cross-state alignment**
- One-click `Normalize` scans every state's character bbox and computes per-state transform (scale + offset) so the character lands at the same size + center across all 6 states
- Per-state fine-tune sliders for scale / offsetX / offsetY
- Reference guide overlay on Loop preview for visual alignment

**Export**
- `.moripack.zip` — character pack for mori-desktop (manifest + 6 required sheets + 0/1/2 optional walking/dragging + 2 backdrops)
- Per state: APNG (transparent, LINE/Discord), GIF (universal, 1-bit alpha), WebM (VP9 + alpha, OBS overlay)
- Raw sheet download (1024×1024 PNG) for external editing
- `.moriproject.zip` save/load — full author state (sheets + raw + settings) for resuming work or sharing

**Demo loader**
- One-click `✦ 載入 Mori 預設範本` button on the project page — loads a fully-configured Mori character (27 MB) so you can play around without generating from scratch. Confirmation dialog warns about overwriting current data.

**Per-character backdrop**
- Upload Light + Dark backdrop PNGs, ships inside `.moripack` per [mori-desktop PR #107](https://github.com/yazelin/mori-desktop/pull/107) 3-tier backplate chain

**Quota counter + rate limit (Author Fallback)**
- Sidebar footer shows live countdown `50 → 0` of remaining Author-Fallback calls today (per-IP)
- Persistent via Vercel KV (Upstash Redis) — counter doesn't reset across Vercel function cold starts
- Graceful fallback to in-memory if KV env vars not provisioned
- 1 concurrent request per IP (prevents multi-tab parallel abuse)
- `GET /api/generate` returns current quota without consuming a slot — used by sidebar polling + post-generation refresh

![Backdrop uploader](docs/assets/screen-03-backdrop.png)

---

## Quick start

### Use the live app

1. Open <https://mori-sprite-studio.vercel.app>
2. Click `✦ 載入 Mori Demo` on the project page (one-click loads a fully-configured Mori character pack — 22 MB)
3. Browse around, see how it works
4. To make your own: clear data (or use incognito), upload your character ref, click 生 6 狀態靜態 → per-state 生動畫

Author Fallback uses yazelin's own API key — no setup needed. **I'm fronting the cost out of pocket so strangers can try the tool.** ⚠ Per-IP cap is **50 req/day + 1 concurrent**, **persistent via Vercel KV** so it actually counts (no resetting on cold starts). Quota countdown counter lives in the sidebar footer. **When the budget runs out, it stops** — not a long-term promise, just letting people experience the tool. If you want it to stay available, ☕ [chip in](https://buymeacoffee.com/yazelin).

### Self-host

```bash
git clone https://github.com/yazelin/mori-sprite-studio
cd mori-sprite-studio
npm install
npm run dev              # Vite dev server
# OR
npm run dev:vercel       # vercel dev — needed if testing the /api/generate Author Fallback proxy
```

Set env vars in `.env.local` if using Author Fallback locally:

```env
AUTHOR_FALLBACK_PROVIDER=vertex-gemini
AUTHOR_API_KEY=AIza...
AUTHOR_MODEL=gemini-3-pro-image-preview
AUTHOR_IMAGE_SIZE=1K
```

Deploy to Vercel:

```bash
vercel --prod
```

Set the same env vars in Vercel Dashboard → Settings → Environment Variables for production.

---

## Architecture

| Layer | Tech |
|---|---|
| UI | Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| State | Zustand + IndexedDB (idb-keyval) for Blob-native persistence |
| AI providers | abstract `ImageProvider` interface, 4 impls (Author Fallback / Codex-Image / Vertex Gemini / Google Gemini) |
| Chroma key | 2-pass per-channel dominance + despill + edge erosion (ported from line-sticker-studio) |
| Sprite-sheet anim preview | Canvas + requestAnimationFrame (16-frame row-major) |
| Export encoders | upng-js (APNG), gifenc (GIF), MediaRecorder + VP9 (WebM), JSZip (.moripack / .moriproject) |
| Server-side | Vercel Function (`/api/generate`) — Author Fallback proxy |

Output spec: 1024×1024 PNG-32, 4×4 grid, 256×256 per cell, row-major frame order, transparent background. Conforms to mori-desktop's `character-pack.md` v1.0.

---

## File formats

| Format | What it's for | Contents |
|---|---|---|
| **`.moripack.zip`** | Consumer format — drop into mori-desktop's character folder | manifest.json + sprites/{6 states}.png + backdrop-{light,dark}.png |
| **`.moriproject.zip`** | Author format — resume editing later / share configured starting point | project.json + character-ref.png + sprites/{state}/{sheet,raw-sheet,static-base,raw-static-base}.png + backdrops |
| **APNG (.png)** | Transparent + looping. LINE animated stickers / Discord / Slack / Twitter inline | Standard APNG with acTL/fcTL chunks |
| **GIF (.gif)** | Universal compatibility (Mac Preview, Windows Photos animate it natively). 1-bit alpha so edges are slightly crusty | Standard GIF89a |
| **WebM (.webm)** | VP9 + alpha channel. OBS streaming overlays, QuickTime, browsers. Records 3 loops | VP9 codec via MediaRecorder |
| **Raw sheet (.png)** | The 1024×1024 4×4 sheet itself. For external editing / inspection | PNG-32 RGBA |

![Export view](docs/assets/screen-04-export.png)

---

## Per-state details (out-of-the-box defaults for the Mori character)

| State | Required | Loop mode | Duration | Pose hint |
|---|---|---|---|---|
| idle | ✓ | loop | 3000 ms | Standing front-facing, gentle smile, calm welcoming |
| sleeping | ✓ | loop | 5000 ms | Cross-legged, eyes closed, hands in lap, floating Z |
| recording | ✓ | loop | 1500 ms | Hand cupped to ear (LISTENING to user, not holding a mic), wide alert eyes |
| thinking | ✓ | loop | 2000 ms | Finger to temple, eyes glancing up, thought sparkles |
| done | ✓ | one-shot (sub-pattern A burst-and-settle) | 1800 ms | Both hands raised in victory cheer, joyful ^v^ smile |
| error | ✓ | one-shot (sub-pattern B sustained-energy) | 2000 ms | Hands to head in cute distressed "oh no!" pose, tear-drop / tension lines |
| walking | opt | loop | 2500 ms | Neutral full-body standing reference (facing right). Actual gait cycle rendered in 16 frames via W template. |
| dragging | opt | loop | 1600 ms | Neutral full-body reference (feet planted in static, suspended swing in 16-frame animation via Dr template). |

Required = mori-desktop expects these 6. Optional = if missing, mori-desktop falls back to idle.png + CSS transforms.

State semantics are editable per project — see `src/defaults/semantics.ts` for defaults.

---

## License

The studio code: MIT.

The generated character pack (sprites you make): **your work, your choice of license**. The Mori reference character bundled as demo is CC-BY-NC-SA-4.0 (attribute, non-commercial, share-alike).

---

## Support

Building this is running on love + caffeine. If you find it useful:

<a href="https://buymeacoffee.com/yazelin"><img src="https://img.shields.io/badge/Buy_me_a_coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy me a coffee" height="36"></a>

This is self-funded out of pocket. Coffee = direct support for:
- More API quota in the Author Fallback bucket (so it doesn't run dry for newcomers)
- Vercel / domain costs
- Time + caffeine to keep building

You can also ⭐ this repo + share with anyone building their own AI companion / desktop spirit.

---

## Using with codex-image-service (use your own ChatGPT subscription quota)

You don't have to use Author Fallback (yazelin's bucket). If you have a ChatGPT Plus / Pro subscription, you can pair this studio with **[codex-image-service](https://github.com/yazelin/codex-image-service)** — a FastAPI wrapper that exposes Codex CLI's `$imagegen` as an HTTP endpoint, so your subscription's image-gen quota powers studio's generations.

Three ways to combine them:

| Setup | What you need | When it makes sense |
|---|---|---|
| **A. Out-of-the-box** | Nothing — just open the live studio | New users, exploring, low-volume |
| **B. Studio (hosted) + your own codex-image-service** | Run codex-image-service somewhere reachable + issue yourself a Bearer key | You have ChatGPT Plus + want unlimited use |
| **C. Both self-hosted** | Clone + run both repos locally | Full control, offline, no external dependencies |

### B / C setup

1. Deploy / run codex-image-service ([repo instructions](https://github.com/yazelin/codex-image-service))
2. In its admin UI, generate a Bearer API key (`cimg_…`)
3. In studio's sidebar → **AI Provider** section → select **Codex-Image**
4. Fill in:
   - **Base URL**: your codex-image-service URL (e.g. `https://your-domain.example/codex-image`)
   - **API Key**: the `cimg_…` you just issued
   - **Quality**: `auto` (default) or `low` / `medium` / `high`
5. Generate as normal — calls go through your codex-image-service, consuming your ChatGPT subscription's image quota instead of the Author Fallback bucket

### CORS reminder

If you self-host both, codex-image-service must allow your studio's origin via CORS. yazelin's deployment already does (`Access-Control-Allow-Origin` reflects request origin); for new self-hosts, see codex-image-service repo for CORS middleware setup.

---

## Related projects

- [mori-desktop](https://github.com/yazelin/mori-desktop) — 森林精靈 Mori 的桌面身體. yazelin's Jarvis-style AI partner. Rust + Tauri 2 + Whisper(耳)+ LLM(腦). This studio produces her visible sprite form.
- [world-tree](https://github.com/yazelin/world-tree) — Mori's origin / 世界樹. Where Mori 來自.
- [codex-image-service](https://github.com/yazelin/codex-image-service) — self-host ChatGPT Plus/Pro quota as image-gen API. Pairs naturally with this studio (see section above).
- [line-sticker-studio](https://github.com/yazelin/line-sticker-studio) — sister tool, LINE sticker authoring (some prompt engineering patterns shared)
- [emoji-slot-machine](https://github.com/yazelin/emoji-slot-machine) — sister tool, 3×3 emoji slot machine generator (some sprite-sheet animation patterns shared)

---

<div align="center">

Made with 🌿 by [yazelin](https://github.com/yazelin)

</div>
