import { useEffect, useState } from 'react'
import { Eye, Sun, Moon } from 'lucide-react'
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
}

type Theme = 'light' | 'dark'

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
  const [theme, setTheme] = useState<Theme>('light')

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">桌面預覽</h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          模擬 mori-desktop 的 160×160 floating window:角色背板墊在底層,
          sprite sheet 動畫疊上去。6 個 state 並排,可切換 light / dark theme
          看背板自動換的樣子。
        </p>
      </header>

      <Section
        title="6 個 state × theme 切換"
        subtitle="跟 mori-desktop 跑起來時看到的一樣 — backdrop + sprite 兩層疊。"
        icon={<Eye {...ICON_PROPS} />}
        action={<ThemeToggle theme={theme} setTheme={setTheme} />}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {STATE_NAMES.map((name) => (
            <FloatingWidgetMockup key={name} state={name} theme={theme} />
          ))}
        </div>
      </Section>

      <Section
        title="背板組合機制(技術說明)"
        subtitle="mori-desktop PR #107 cross-platform backdrop chain"
        icon={<Eye {...ICON_PROPS} />}
      >
        <div className="text-sm text-muted-foreground space-y-3 max-w-prose">
          <p>
            mori-desktop 用 3 層 fallback 找背板,從具體到 fallback 排序:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <strong>character pack 自帶</strong> — 這個專案的「角色背板」頁上傳的
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded mx-1">backdrop-{'{dark,light}'}.png</code>
              ,跟 sprite sheet 一起打包進 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">.moripack.zip</code>
              。優先級最高,代表角色作者特別為這隻角色設計的背景。
            </li>
            <li>
              <strong>user 全域 fallback</strong> —
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded mx-1">~/.mori/floating/backplate-{'{dark,light}'}.png</code>
              。使用者個人喜好,任何角色 pack 都會繼承。
            </li>
            <li>
              <strong>內建 fallback</strong> — mori-desktop binary 內建的純色 gradient,
              永遠保證有底圖。
            </li>
          </ol>
          <p>
            這頁的預覽只算層 1(本 pack 的背板)+ sprite。如果 user 全域有設,
            mori-desktop 顯示的視覺會用 layer 1(這頁顯示的)。如果沒上傳本 pack
            背板,user 開 mori-desktop 會看到 layer 2 或 3(這頁顯示透明 fallback)。
          </p>
          <p>
            theme 切換對應 mori-desktop 的 <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">prefers-color-scheme</code>
            CSS media query — 系統暗色模式用 dark,亮色用 light。
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

function FloatingWidgetMockup({ state, theme }: { state: StateName; theme: Theme }) {
  const spriteState = useAppStore((s) => s.project.states[state])
  const backdropBlob = useAppStore((s) => theme === 'light' ? s.project.backdropLight : s.project.backdropDark)
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!backdropBlob) { setBackdropUrl(null); return }
    const u = URL.createObjectURL(backdropBlob)
    setBackdropUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [backdropBlob])

  // Simulated floating window environment per theme — mimics what the user's
  // desktop wallpaper might look like in light vs dark mode.
  const envClass = theme === 'light'
    ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
    : 'bg-gradient-to-br from-slate-800 via-slate-900 to-stone-900'
  const labelClass = theme === 'light' ? 'text-stone-800' : 'text-stone-200'
  const subClass = theme === 'light' ? 'text-stone-500' : 'text-stone-400'

  const fallbackBackdrop = theme === 'light'
    // mori-desktop default gradient for light
    ? 'radial-gradient(circle at center, rgba(255,255,255,0.6), rgba(254,243,199,0.3) 60%, transparent 90%)'
    // for dark
    : 'radial-gradient(circle at center, rgba(45,55,72,0.7), rgba(30,41,59,0.4) 60%, transparent 90%)'

  return (
    <div className={`rounded-2xl p-4 ${envClass} flex flex-col items-center gap-2`}>
      <div
        className="relative w-40 h-40 rounded-lg overflow-hidden"
        style={{
          background: backdropUrl ? undefined : fallbackBackdrop,
        }}
      >
        {/* Layer 1: backdrop */}
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={`${theme} backdrop`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Layer 2: sprite animation (canvas) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimationPreview
            sheet={spriteState.sheet}
            durationMs={spriteState.loopDurationMs}
            size={160}
            transform={spriteState.transform}
          />
        </div>
      </div>
      <div className="text-center">
        <div className={`text-sm font-medium capitalize ${labelClass}`}>{STATE_LABEL[state]}</div>
        <div className={`text-[10px] ${subClass}`}>
          {spriteState.status === 'animated' ? '已動畫化' :
           spriteState.status === 'placeholder' ? 'placeholder' :
           '尚未生成'}
          {' · '}
          {backdropUrl ? `${theme} backdrop` : 'fallback gradient'}
        </div>
      </div>
    </div>
  )
}
