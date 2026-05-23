import { useEffect, useState } from 'react'
import { Eye, Sun, Moon, Circle, Square, Squircle } from 'lucide-react'
import { useAppStore } from '@/store'
import { STATE_NAMES, type StateName } from '@/types/project'
import { Section } from '@/components/Section'
import { AnimationPreview } from '@/components/AnimationPreview'

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const

const STATE_LABEL: Record<StateName, string> = {
  idle:      'Idle',
  sleeping:  'Sleeping',
  recording: 'Recording',
  thinking:  'Thinking',
  done:      'Done',
  error:     'Error',
  walking:   'Walking',
  dragging:  'Dragging',
}

type Theme = 'light' | 'dark'
type Shape = 'circle' | 'rounded' | 'square'
type Backplate = 'logo' | 'plain'    // logo=show backdrop, plain=hide backdrop

const SHAPE_RADIUS: Record<Shape, string> = {
  circle:  '50%',
  rounded: '16px',  // default x11_shape_radius
  square:  '0',
}

// Real mori-desktop backdrop composition (copied from computed style at
// runtime). Three CSS background layers stacked top → bottom:
//   1) vignette (radial gradient, dark spot at bottom-right)
//   2) backdrop PNG (the actual character backplate image)
//   3) base gradient (linear, warm white / forest green)
// Pre-CSS color tokens from the actual mori-desktop --c-page-bg / --c-surface-bg
const VIGNETTE_LIGHT = 'radial-gradient(circle at 75% 80%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0) 70%)'
const VIGNETTE_DARK  = 'radial-gradient(circle at 75% 80%, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.06) 40%, rgba(0,0,0,0) 70%)'
const BASE_LIGHT     = 'linear-gradient(135deg, rgb(243,240,230) 0%, rgb(255,255,255) 100%)'
const BASE_DARK      = 'linear-gradient(135deg, rgb(31,51,41) 0%, rgb(36,58,49) 100%)'

/**
 * 桌面預覽 — what mori-desktop floating widget actually shows.
 *
 * mori-desktop layers a 160×160 floating window like this (per PR #107):
 *
 *   ┌─ .mori-stage (160×160, transparent window) ─┐
 *   │  ┌─ .mori-backdrop (z=0) ──┐                │
 *   │  │ background: backdrop PNG │ ← from this   │
 *   │  └──────────────────────────┘   character   │
 *   │  ┌─ .mori-sprite-frame (z=1) ┐   pack       │
 *   │  │ animated sprite sheet      │              │
 *   │  └────────────────────────────┘              │
 *   └──────────────────────────────────────────────┘
 *
 * This view stacks the same layers in 6 thumbnails so you can see
 * how each state actually looks when the user runs mori-desktop.
 */
export function PreviewView() {
  const [appTheme, setAppTheme] = useState<Theme>('light')
  const [osTheme, setOsTheme] = useState<Theme>('light')
  const [shape, setShape] = useState<Shape>('circle')
  const [backplate, setBackplate] = useState<Backplate>('logo')

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">桌面預覽</h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          模擬 mori-desktop 的 160×160 floating window。**有兩個獨立的 theme**:
          mori-desktop App 的主題(在 mori-desktop Config 設,決定用 light 還是 dark 背板)、
          作業系統的 theme(決定桌布視覺)。實際 user 可以在 Config 把 App 設成
          跟系統不同的 theme(例如 dark 系統下用 light App),所以這頁拆開讓你
          看各種組合下角色會長什麼樣。
        </p>
      </header>

      <Section
        title="6 個 state × 全部設定組合"
        subtitle="跟 mori-desktop 跑起來時看到的一樣。"
        icon={<Eye {...ICON_PROPS} />}
      >
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                mori-desktop App 主題
                <span className="ml-1 text-stone-400">(決定用哪張背板)</span>
              </div>
              <ThemeToggle theme={appTheme} setTheme={setAppTheme} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                作業系統 OS 主題
                <span className="ml-1 text-stone-400">(模擬桌布)</span>
              </div>
              <ThemeToggle theme={osTheme} setTheme={setOsTheme} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Window shape</div>
              <ShapeToggle shape={shape} setShape={setShape} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Backplate mode</div>
              <BackplateToggle backplate={backplate} setBackplate={setBackplate} />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            在 mori-desktop 裡,App 主題可在 Config tab 手動指定(不會自動跟系統同步),
            所以 4 種組合都可能在 user 端發生 — Light App / Light OS、
            Light App / Dark OS、Dark App / Light OS、Dark App / Dark OS。
            每種組合都要看一下,確認 backdrop 設計在所有場景都不至於消失或太突兀。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {STATE_NAMES.map((name) => (
              <FloatingWidgetMockup
                key={name} state={name}
                appTheme={appTheme} osTheme={osTheme}
                shape={shape} backplate={backplate}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="為什麼有「角色背板」這個功能?(技術背景)"
        subtitle="Linux X11 的半透明渲染問題 + 跨平台 backdrop chain"
        icon={<Eye {...ICON_PROPS} />}
      >
        <div className="text-sm text-muted-foreground space-y-3 max-w-prose">
          <h3 className="text-stone-900 font-semibold text-base">背板的原因:Linux X11 半透明 bug</h3>
          <p>
            mori-desktop 是 Tauri 2 + WebKit2GTK。**在 Linux X11 桌面環境下,WebKit2GTK
            渲染半透明 / 漸層會有 alpha compositing bug** — 桌面看到的不是設計的視覺,
            而是被 black background bleed 出怪色;對 floating window 這種小視窗,
            sprite 周圍會出現一圈 50% 黑霧。
          </p>
          <p>
            **角色背板就是這個問題的 workaround**:整個 floating window 範圍鋪一張
            **完全不透明 (opaque)** 的圖,然後**用 XShape extension 做 sharp pixel clip
            切出想要的形狀(圓 / 圓角 / 方)**。整個 region 都是 opaque pixel,WebKit
            無從 bleed;同時 X server 的 XShape clip 是 binary mask(0/1),不靠 alpha
            blending,所以邊緣銳利乾淨。
          </p>
          <p>
            **Wayland 跟 Windows 本身原生支援整視窗 alpha channel**,所以 sprite 不墊
            背板也能正常顯示透明(只是視覺上少了那圈光暈設計)。Wayland / Windows 上把
            backplate 設成「關閉」,sprite 就會直接浮在桌面上。
          </p>

          <h3 className="text-stone-900 font-semibold text-base pt-2">3 層 backdrop fallback chain</h3>
          <p>mori-desktop 找背板的優先順序(高 → 低):</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <strong>character pack 自帶</strong> — 這個 studio 「角色背板」頁上傳的
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded mx-1">backdrop-{'{dark,light}'}.png</code>
              ,打包進 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">.moripack.zip</code>
              。每隻角色作者可設計自己的光暈 / 剪影。
            </li>
            <li>
              <strong>user 全域 fallback</strong> —
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded mx-1">~/.mori/floating/backplate-{'{dark,light}'}.png</code>
              。使用者個人喜好,任何角色 pack 都會繼承。
            </li>
            <li>
              <strong>內建 fallback</strong> — mori-desktop binary 內建純色 gradient,
              保證 X11 環境永遠有 opaque pixel 墊著。
            </li>
          </ol>

          <h3 className="text-stone-900 font-semibold text-base pt-2">三個設定怎麼互動</h3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Window shape</strong>:控制 floating window 外形(border-radius + XShape clip)。圓 = 半徑 50%、圓角 = 16 px、方 = 0。</li>
            <li><strong>Backplate mode</strong>:logo = 顯示背板圖(Linux X11 需要、其他平台美觀);plain = 不放圖(Wayland / Windows 可,X11 會 fallback 到內建 gradient 避免渲染 bug)。</li>
            <li><strong>Theme</strong>:對應系統 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">prefers-color-scheme</code>,自動換 dark / light 背板。</li>
          </ul>

          <p className="text-xs italic">
            這頁預覽只展示 layer 1(本 pack 的背板)。若沒上傳本 pack 背板,user 開
            mori-desktop 會看到 layer 2 或 3 — 視覺會有差;設計時建議至少 light + dark
            各上傳一張,確保所有 user 看到的是你設計的版本。
          </p>
        </div>
      </Section>
    </div>
  )
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`h-8 px-3 text-xs flex items-center gap-1.5 transition-colors ${theme === 'light' ? 'bg-amber-100 text-amber-900' : 'text-muted-foreground hover:bg-stone-50'}`}
      >
        <Sun size={13} strokeWidth={1.75} />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`h-8 px-3 text-xs flex items-center gap-1.5 border-l border-border transition-colors ${theme === 'dark' ? 'bg-indigo-100 text-indigo-900' : 'text-muted-foreground hover:bg-stone-50'}`}
      >
        <Moon size={13} strokeWidth={1.75} />
        Dark
      </button>
    </div>
  )
}

function ShapeToggle({ shape, setShape }: { shape: Shape; setShape: (s: Shape) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
      {(['circle', 'rounded', 'square'] as const).map((s, i) => {
        const Icon = s === 'circle' ? Circle : s === 'rounded' ? Squircle : Square
        const label = s === 'circle' ? '圓' : s === 'rounded' ? '圓角' : '方'
        return (
          <button
            key={s}
            type="button"
            onClick={() => setShape(s)}
            className={`h-8 px-3 text-xs flex items-center gap-1.5 transition-colors ${i > 0 ? 'border-l border-border' : ''} ${shape === s ? 'bg-emerald-100 text-emerald-900' : 'text-muted-foreground hover:bg-stone-50'}`}
          >
            <Icon size={13} strokeWidth={1.75} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function BackplateToggle({ backplate, setBackplate }: { backplate: Backplate; setBackplate: (b: Backplate) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setBackplate('logo')}
        className={`h-8 px-3 text-xs transition-colors ${backplate === 'logo' ? 'bg-emerald-100 text-emerald-900' : 'text-muted-foreground hover:bg-stone-50'}`}
      >
        顯示
      </button>
      <button
        type="button"
        onClick={() => setBackplate('plain')}
        className={`h-8 px-3 text-xs border-l border-border transition-colors ${backplate === 'plain' ? 'bg-emerald-100 text-emerald-900' : 'text-muted-foreground hover:bg-stone-50'}`}
      >
        關閉
      </button>
    </div>
  )
}

function FloatingWidgetMockup({
  state, appTheme, osTheme, shape, backplate,
}: {
  state: StateName;
  appTheme: Theme;       // mori-desktop's own theme (set in its Config tab) — picks backdrop
  osTheme: Theme;        // user's operating system theme — picks wallpaper bg
  shape: Shape;
  backplate: Backplate;
}) {
  const spriteState = useAppStore((s) => s.project.states[state])
  // App theme decides which backdrop image (matches mori-desktop's
  // html[data-theme-base="light"] .mori-backdrop CSS binding)
  const backdropBlob = useAppStore((s) => appTheme === 'light' ? s.project.backdropLight : s.project.backdropDark)
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!backdropBlob) { setBackdropUrl(null); return }
    const u = URL.createObjectURL(backdropBlob)
    setBackdropUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [backdropBlob])

  // OS theme decides the simulated desktop wallpaper behind the floating window
  const envClass = osTheme === 'light'
    ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
    : 'bg-gradient-to-br from-slate-800 via-slate-900 to-stone-900'
  const labelClass = osTheme === 'light' ? 'text-stone-800' : 'text-stone-200'
  const subClass = osTheme === 'light' ? 'text-stone-500' : 'text-stone-400'

  // Match mori-desktop's actual rendered sizing (visually measured by user).
  // tauri.conf.json + floating.css say 160×160 / 124×124, but real DPI-
  // scaled render is closer to 200×200 stage / 130×130 sprite.
  //   stage           ≈ 200×200 (the floating window)
  //   .mori-backdrop  = inset 0 → fills full stage with cover
  //   .mori-sprite    = 130×130 CENTERED → ~35 px backdrop margin shows
  // Sprite occupies 65% of backdrop.
  const STAGE_PX = 200
  const SPRITE_PX = 130
  const showBackdrop = backplate === 'logo'

  // Status text
  const statusText =
    spriteState.status === 'animated' ? '已動畫化' :
    spriteState.status === 'placeholder' ? 'placeholder' :
    '尚未生成'
  const backdropText = !showBackdrop ? 'backplate 關閉' :
                       backdropUrl ? `${appTheme} backdrop` :
                       '無背板上傳 · fallback'

  // Build the 3-layer background that real mori-desktop renders
  // (vignette + backdrop PNG + base gradient), stacked top → bottom.
  // Each layer has its own size so the PNG covers but gradients stay flexible.
  const vignette = appTheme === 'light' ? VIGNETTE_LIGHT : VIGNETTE_DARK
  const baseGradient = appTheme === 'light' ? BASE_LIGHT : BASE_DARK
  const backdropLayers: string[] = []
  const backdropSizes: string[] = []
  const backdropPositions: string[] = []
  const backdropRepeats: string[] = []
  if (showBackdrop) {
    // top → bottom order matches CSS background-image (first = topmost)
    backdropLayers.push(vignette);              backdropSizes.push('100% 100%'); backdropPositions.push('center'); backdropRepeats.push('no-repeat')
    if (backdropUrl) {
      backdropLayers.push(`url("${backdropUrl}")`); backdropSizes.push('cover'); backdropPositions.push('center'); backdropRepeats.push('no-repeat')
    }
    backdropLayers.push(baseGradient);          backdropSizes.push('100% 100%'); backdropPositions.push('center'); backdropRepeats.push('no-repeat')
  }

  return (
    <div className={`rounded-2xl p-4 ${envClass} flex flex-col items-center gap-2`}>
      <div
        className="relative overflow-hidden"
        style={{
          width: STAGE_PX, height: STAGE_PX,
          borderRadius: SHAPE_RADIUS[shape],
          // Real mori-desktop's 3-layer backdrop composition (when backplate=logo):
          //   vignette → backdrop PNG → base gradient (top → bottom)
          backgroundImage:    backdropLayers.join(', ') || undefined,
          backgroundSize:     backdropSizes.join(', ') || undefined,
          backgroundPosition: backdropPositions.join(', ') || undefined,
          backgroundRepeat:   backdropRepeats.join(', ') || undefined,
          // 1 px outline that mori-desktop's XShape clip leaves visible at
          // the window edge. Tone flips with OS theme so it shows on both
          // light and dark simulated wallpapers.
          boxShadow: osTheme === 'light'
            ? 'inset 0 0 0 1px rgba(0,0,0,0.18)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.22)',
        }}
      >
        {/* Sprite — 130×130 centered + drop shadow */}
        <div
          className="absolute"
          style={{
            top: (STAGE_PX - SPRITE_PX) / 2,
            left: (STAGE_PX - SPRITE_PX) / 2,
            width: SPRITE_PX, height: SPRITE_PX,
            filter: 'drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4))',
          }}
        >
          <AnimationPreview
            sheet={spriteState.sheet}
            durationMs={spriteState.loopDurationMs}
            size={SPRITE_PX}
            transform={spriteState.transform}
          />
        </div>
      </div>
      <div className="text-center">
        <div className={`text-sm font-medium capitalize ${labelClass}`}>{STATE_LABEL[state]}</div>
        <div className={`text-[10px] ${subClass}`}>
          {statusText} · {backdropText}
        </div>
      </div>
    </div>
  )
}
