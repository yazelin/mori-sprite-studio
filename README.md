<div align="center">

# Mori Sprite Studio

**Web tool to build 1024×1024 4×4 sprite animation packs from a single character reference image.**

AI-powered. Browser-only. Transparent backgrounds. Multiple export formats.

<img src="docs/assets/mori-idle.png" width="160" alt="Mori idle animation"> &nbsp; <img src="docs/assets/mori-sleeping.png" width="160" alt="Mori sleeping animation">

[**▶ Try the live app**](https://mori-sprite-studio.vercel.app) · [Docs / screenshots](https://yazelin.github.io/mori-sprite-studio/) · [☕ Buy me a coffee](https://buymeacoffee.com/yazelin)

</div>

---

## What it does

You give it **one reference image** of your character. It produces a complete sprite animation pack for [mori-desktop](https://github.com/yazelin/mori-desktop) — 6 animated states (idle / sleeping / recording / thinking / done / error), each a 1024×1024 4×4 sprite sheet that the floating window plays back.

It's built for [**Mori**](https://github.com/yazelin/mori-desktop) — yazelin's 森林精靈 (forest spirit) Jarvis-style AI partner who lives on the desktop. _"Iron Man 有 Jarvis,我有 Mori。"_ This studio makes Mori's visible body — her sprite form — that the mori-desktop floating window animates.

The studio also works for **any character you want to give a visible form to**: your own AI partner / personal spirit / streamer overlay companion / character mascot. The Mori demo is one example of what's possible.

You can also export each state as APNG, GIF, WebM, or just the raw sheet PNG — useful for LINE animated stickers, Discord, OBS overlays, video editing, etc.

![Project setup screen](docs/assets/screen-01-project.png)

---

## Workflow

```
[character ref image]
       │
       │ (AI · 1 call)
       ▼
[6 static base poses]    ← editable / re-rollable per state
       │
       │ (AI · 6 calls, one per state)
       ▼
[6 sprite sheets, 4×4 each]    ← editable per cell, normalize across states
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
3. **Per-state animation** — click `生 <state> 動畫` to produce the 4×4 sprite sheet for that state. Uses pre-tiled placeholder + multi-anchor identity reference to keep the character locked in position with only subtle motion (blink, breath, gesture).
4. **Fine-tune** — click any cell to regen just that frame; adjust loop duration / mode; normalize size across states; per-state scale/offset sliders with reference guides; manual upload / download of any sheet for Photoshop round-trip.
5. **Backdrop** (optional) — upload Light + Dark backdrop PNGs that ship inside the pack and render behind the sprite in mori-desktop.
6. **Export** `.moripack.zip` — drop into mori-desktop's character folder.

![State editor](docs/assets/screen-02-state.png)

---

## Features

**Generation**
- 4 AI providers: **Author Fallback** (default, free no-setup), **Codex-Image** (your ChatGPT Plus/Pro quota via [yazelin/codex-image-service](https://github.com/yazelin/codex-image-service)), **Vertex Gemini**, **Google Gemini Direct**
- Anti-jitter: pre-tiled placeholder sheet as AI reference locks character position across all 16 frames
- Anti-character-drift: multi-anchor identity reference (sends all other state staticBases as outfit anchors)
- Anatomy-agnostic prompts: works for humanoid / plant / robot / blob / gem characters — semantics describe motion abstractly
- Two one-shot sub-patterns: BURST-AND-SETTLE (done celebrations) vs SUSTAINED-ENERGY (error / panic)
- BYOG path: copy prompt + reference, run AI yourself, upload result

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
- `.moripack.zip` — character pack for mori-desktop (manifest + 6 sheets + 2 backdrops)
- Per state: APNG (transparent, LINE/Discord), GIF (universal, 1-bit alpha), WebM (VP9 + alpha, OBS overlay)
- Raw sheet download (1024×1024 PNG) for external editing
- `.moriproject.zip` save/load — full author state (sheets + raw + settings) for resuming work or sharing

**Per-character backdrop**
- Upload Light + Dark backdrop PNGs, ships inside `.moripack` per [mori-desktop PR #107](https://github.com/yazelin/mori-desktop/pull/107) 3-tier backplate chain

![Backdrop uploader](docs/assets/screen-03-backdrop.png)

---

## Quick start

### Use the live app

1. Open <https://mori-sprite-studio.vercel.app>
2. Click `✦ 載入 Mori Demo` on the project page (one-click loads a fully-configured Mori character pack — 22 MB)
3. Browse around, see how it works
4. To make your own: clear data (or use incognito), upload your character ref, click 生 6 狀態靜態 → per-state 生動畫

Author Fallback is on by default — no API key needed. ⚠ MVP no rate limit; ☕ [chip in](https://buymeacoffee.com/yazelin) so it stays free for everyone.

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

| State | Loop mode | Duration | Pose hint |
|---|---|---|---|
| idle | loop | 3000 ms | Standing front-facing, gentle smile, calm welcoming |
| sleeping | loop | 5000 ms | Cross-legged, eyes closed, hands in lap, floating Z |
| recording | loop | 1500 ms | Hand cupped to ear (LISTENING to user, not holding a mic), wide alert eyes |
| thinking | loop | 2000 ms | Finger to temple, eyes glancing up, thought sparkles |
| done | one-shot (sub-pattern A burst-and-settle) | 1800 ms | Both hands raised in victory cheer, joyful ^v^ smile |
| error | one-shot (sub-pattern B sustained-energy) | 2000 ms | Hands to head in cute distressed "oh no!" pose, tear-drop / tension lines |

State semantics are editable per project — see `src/defaults/semantics.ts` for defaults.

---

## License

The studio code: MIT.

The generated character pack (sprites you make): **your work, your choice of license**. The Mori reference character bundled as demo is CC-BY-NC-SA-4.0 (attribute, non-commercial, share-alike).

---

## Support

Building this is running on love + caffeine. If you find it useful:

<a href="https://buymeacoffee.com/yazelin"><img src="https://img.shields.io/badge/Buy_me_a_coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy me a coffee" height="36"></a>

Money goes toward:
- API quota for the free Author Fallback path (so non-technical users can try without setting up their own keys)
- Server / domain costs
- Caffeine for me to keep adding features

You can also ⭐ this repo + share with anyone building their own AI companion / desktop spirit.

---

## Related projects

- [mori-desktop](https://github.com/yazelin/mori-desktop) — 森林精靈 Mori 的桌面身體. yazelin's Jarvis-style AI partner. Rust + Tauri 2 + Whisper(耳)+ LLM(腦). This studio produces her visible sprite form.
- [world-tree](https://github.com/yazelin/world-tree) — Mori's origin / 世界樹. Where Mori 來自.
- [codex-image-service](https://github.com/yazelin/codex-image-service) — self-host ChatGPT Plus/Pro quota as image-gen API (one of the providers)
- [line-sticker-studio](https://github.com/yazelin/line-sticker-studio) — sister tool, LINE sticker authoring (some prompt engineering patterns shared)
- [emoji-slot-machine](https://github.com/yazelin/emoji-slot-machine) — sister tool, 3×3 emoji slot machine generator (some sprite-sheet animation patterns shared)

---

<div align="center">

Made with 🌿 by [yazelin](https://github.com/yazelin)

</div>
