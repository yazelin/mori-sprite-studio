import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import JSZip from 'jszip'
import { Eye, EyeOff, LoaderCircle, MessageCircle, Mic, MicOff, Send } from 'lucide-react'
import { AnimationPreview } from '@/components/AnimationPreview'
import { useAppStore } from '@/store'
import { STATE_NAMES, type CellTransform, type StateName } from '@/types/project'

type ChatMessage = { role: 'user' | 'model'; text: string }
type Activity = 'idle' | 'recording' | 'thinking' | 'done' | 'error'
type Sprite = { sheet: Blob | null; durationMs: number; transform: CellTransform }
type SpritePack = { displayName: string; states: Record<StateName, Sprite> }
type ConnectionSettings = { baseUrl: string; apiKey: string }

type ProjectFile = {
  metadata?: { displayName?: string }
  states?: Partial<Record<StateName, { loopDurationMs?: number; transform?: CellTransform }>>
}

type SpeechResult = { transcript: string }
type SpeechResultSet = ArrayLike<SpeechResult> & { isFinal: boolean }
type SpeechResultEvent = Event & { resultIndex: number; results: ArrayLike<SpeechResultSet> }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

const EMPTY_TRANSFORM: CellTransform = { scale: 1, offsetX: 0, offsetY: 0 }
const DEFAULT_GEMINI_WEB_URL = 'https://ching-tech.ddns.net/gemini-web/'
const CONNECTION_SETTINGS_STORAGE_KEY = 'mori-live-demo-gemini-web'
const DEFAULT_CONNECTION_SETTINGS: ConnectionSettings = {
  baseUrl: DEFAULT_GEMINI_WEB_URL,
  apiKey: '',
}
const WELCOME: ChatMessage = {
  role: 'model',
  text: '嗨，我是 Mori。想聊聊、看看最近的新聞，或問我今天的天氣？',
}
let bundledDemoPromise: Promise<SpritePack> | null = null

function loadConnectionSettings(): ConnectionSettings {
  if (typeof window === 'undefined') return DEFAULT_CONNECTION_SETTINGS
  try {
    const saved = window.localStorage.getItem(CONNECTION_SETTINGS_STORAGE_KEY)
    if (!saved) return DEFAULT_CONNECTION_SETTINGS
    const parsed = JSON.parse(saved) as Partial<ConnectionSettings>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_GEMINI_WEB_URL,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    }
  } catch {
    return DEFAULT_CONNECTION_SETTINGS
  }
}

async function loadBundledDemo(): Promise<SpritePack> {
  if (!bundledDemoPromise) {
    bundledDemoPromise = (async () => {
      const response = await fetch('/demo/mori.moriproject.zip')
      if (!response.ok) throw new Error('無法載入 Mori 範例動畫。')
      const zip = await JSZip.loadAsync(await response.arrayBuffer())
      const projectFile = zip.file('project.json')
      if (!projectFile) throw new Error('Mori 範例缺少 project.json。')
      const project = JSON.parse(await projectFile.async('string')) as ProjectFile
      const states = {} as Record<StateName, Sprite>

      await Promise.all(STATE_NAMES.map(async (name) => {
        const file = zip.file(`sprites/${name}/sheet.png`)
        const state = project.states?.[name]
        states[name] = {
          sheet: file ? new Blob([await file.async('arraybuffer')], { type: 'image/png' }) : null,
          durationMs: state?.loopDurationMs ?? 3000,
          transform: state?.transform ?? EMPTY_TRANSFORM,
        }
      }))

      return { displayName: project.metadata?.displayName ?? 'Mori', states }
    })().catch((error) => {
      bundledDemoPromise = null
      throw error
    })
  }
  return bundledDemoPromise
}

function supportsSpeechRecognition() {
  const speech = window as SpeechWindow
  return Boolean(speech.SpeechRecognition ?? speech.webkitSpeechRecognition)
}

function formatAssistantReply(text: string) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
  const contentLines = lines.filter(Boolean)

  // Search-backed weather cards often arrive as dozens of short lines with
  // blank rows between every value. Keep them readable without oversized gaps.
  if (contentLines.length >= 12) return contentLines.join('\n')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function LiveDemoView() {
  const projectName = useAppStore((s) => s.project.metadata.displayName)
  const projectStates = useAppStore((s) => s.project.states)
  const currentProjectHasIdle = Boolean(projectStates.idle.sheet)
  const [demoPack, setDemoPack] = useState<SpritePack | null>(null)
  const [demoError, setDemoError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [activity, setActivity] = useState<Activity>('idle')
  const [isWalking, setIsWalking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [facesLeft, setFacesLeft] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 66 })
  const [walkDurationMs, setWalkDurationMs] = useState(3500)
  const [voiceSupported] = useState(supportsSpeechRecognition)
  const [voiceError, setVoiceError] = useState('')
  const [connection, setConnection] = useState<ConnectionSettings>(loadConnectionSettings)
  const [connectionSettingsOpen, setConnectionSettingsOpen] = useState(() => !connection.apiKey.trim())
  const [showApiKey, setShowApiKey] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(position)
  const dragRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const ignoreRecognitionEndRef = useRef(false)
  const activityTimerRef = useRef<number | undefined>(undefined)

  positionRef.current = position

  useEffect(() => {
    if (currentProjectHasIdle) return
    let cancelled = false
    void loadBundledDemo()
      .then((pack) => { if (!cancelled) setDemoPack(pack) })
      .catch((error) => { if (!cancelled) setDemoError(String(error)) })
    return () => { cancelled = true }
  }, [currentProjectHasIdle])

  const pack = useMemo<SpritePack | null>(() => {
    if (currentProjectHasIdle) {
      const states = {} as Record<StateName, Sprite>
      for (const name of STATE_NAMES) {
        const state = projectStates[name]
        states[name] = {
          sheet: state.sheet,
          durationMs: state.loopDurationMs,
          transform: state.transform,
        }
      }
      return { displayName: projectName || '目前專案角色', states }
    }
    return demoPack
  }, [currentProjectHasIdle, demoPack, projectName, projectStates])

  useEffect(() => {
    let timer = 0
    let cancelled = false

    const walk = () => {
      if (cancelled) return
      if (activity !== 'idle' || dragRef.current) {
        timer = window.setTimeout(walk, 500)
        return
      }
      const current = positionRef.current
      const next = {
        x: 10 + Math.random() * 80,
        y: 16 + Math.random() * 68,
      }
      const bounds = stageRef.current?.getBoundingClientRect()
      const distanceX = ((next.x - current.x) / 100) * (bounds?.width ?? 900)
      const distanceY = ((next.y - current.y) / 100) * (bounds?.height ?? 700)
      const duration = Math.max(3000, Math.min(9000, Math.round(Math.hypot(distanceX, distanceY) / 90 * 1000)))
      setFacesLeft(next.x < current.x)
      setWalkDurationMs(duration)
      positionRef.current = next
      setIsWalking(true)
      setPosition(next)
      timer = window.setTimeout(() => {
        setIsWalking(false)
        timer = window.setTimeout(walk, 1700 + Math.random() * 2500)
      }, duration)
    }

    timer = window.setTimeout(walk, 1800)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      setIsWalking(false)
    }
  }, [activity])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, activity])

  useEffect(() => {
    try {
      window.localStorage.setItem(CONNECTION_SETTINGS_STORAGE_KEY, JSON.stringify(connection))
    } catch {
      // Keep the form usable when browser storage is unavailable.
    }
  }, [connection])

  useEffect(() => () => {
    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    recognitionRef.current?.stop()
  }, [])

  const activeState: StateName = isDragging
    ? 'dragging'
    : activity !== 'idle'
      ? activity
      : isWalking
        ? 'walking'
        : 'idle'
  const requestedSprite = pack?.states[activeState]
  const sprite = requestedSprite?.sheet ? requestedSprite : pack?.states.idle
  const hasWalking = Boolean(pack?.states.walking.sheet)
  const hasDragging = Boolean(pack?.states.dragging.sheet)

  const setTransientActivity = (next: Activity, delayMs: number) => {
    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    setActivity(next)
    activityTimerRef.current = window.setTimeout(() => {
      setActivity((current) => current === next ? 'idle' : current)
    }, delayMs)
  }

  const stopVoiceInput = (suppressIdle = false) => {
    if (!recognitionRef.current) return
    ignoreRecognitionEndRef.current = suppressIdle
    recognitionRef.current.stop()
    recognitionRef.current = null
  }

  const startVoiceInput = () => {
    setVoiceError('')
    if (!voiceSupported) {
      setVoiceError('請使用支援語音輸入的 Chrome 或 Edge。')
      return
    }
    if (recognitionRef.current) {
      stopVoiceInput()
      return
    }

    const speech = window as SpeechWindow
    const Recognition = speech.SpeechRecognition ?? speech.webkitSpeechRecognition
    if (!Recognition) return
    const recognition = new Recognition()
    const startingText = draft.trim()
    recognition.lang = 'zh-TW'
    recognition.interimResults = true
    ignoreRecognitionEndRef.current = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('')
      setDraft([startingText, transcript].filter(Boolean).join(' '))
    }
    recognition.onerror = () => {
      recognitionRef.current = null
      setVoiceError('語音輸入沒有成功，請再試一次。')
      setTransientActivity('error', 1800)
    }
    recognition.onend = () => {
      recognitionRef.current = null
      if (ignoreRecognitionEndRef.current) {
        ignoreRecognitionEndRef.current = false
        return
      }
      setActivity((current) => current === 'recording' ? 'idle' : current)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setActivity('recording')
    } catch {
      recognitionRef.current = null
      setVoiceError('無法啟動語音輸入，請確認瀏覽器的麥克風權限。')
      setTransientActivity('error', 1800)
    }
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || activity === 'thinking') return
    stopVoiceInput(true)
    setVoiceError('')
    const nextMessages = [...messages, { role: 'user' as const, text }]
    setMessages(nextMessages)
    setDraft('')
    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    setActivity('thinking')

    if (!connection.apiKey.trim()) {
      setMessages((current) => [...current, { role: 'model', text: '先在上方連線設定填入 Gemini-Web API Key，再送出訊息。' }])
      setTransientActivity('error', 2200)
      return
    }

    try {
      const response = await fetch('/api/live-demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
        }),
      })
      const result = await response.json() as { text?: string; error?: string }
      if (!response.ok) throw new Error(result.error || 'Mori 暫時沒有回應，請稍後再試。')
      if (!result.text?.trim()) throw new Error('Mori 這次沒有回覆內容，請再試一次。')
      setMessages((current) => [...current, { role: 'model', text: formatAssistantReply(result.text!) }])
      setTransientActivity('done', 1800)
    } catch (error) {
      const message = error instanceof Error ? error.message : '連線發生問題，請稍後再試。'
      setMessages((current) => [...current, { role: 'model', text: message }])
      setTransientActivity('error', 2200)
    }
  }

  const onPlayerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !stageRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = true
    setIsWalking(false)
    setIsDragging(true)
  }

  const onPlayerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const next = {
      x: Math.max(12, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(20, Math.min(82, ((event.clientY - rect.top) / rect.height) * 100)),
    }
    positionRef.current = next
    setPosition(next)
  }

  const finishPlayerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = false
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const statusLabel = isDragging
    ? hasDragging ? '抓起中' : 'Mori'
    : activity === 'recording' ? '正在聽'
      : activity === 'thinking' ? '思考中'
        : activity === 'done' ? '回答完成'
          : activity === 'error' ? '遇到問題'
            : isWalking ? hasWalking ? '散步中' : 'Mori'
              : '休息中'

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(ellipse_at_20%_8%,rgba(255,255,255,0.92),transparent_42%),linear-gradient(155deg,#edf5e9_0%,#c6ddc1_54%,#a9c9ac_100%)]">
      <header className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] sm:left-6 sm:top-6 md:max-w-[30%]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-emerald-950 sm:text-2xl">Live Demo</h1>
          <span className="rounded-full border border-white/75 bg-white/55 px-2.5 py-1 text-[11px] font-medium text-emerald-900 backdrop-blur">{pack?.displayName ?? 'Mori'}</span>
        </div>
        <p className="mt-1.5 hidden max-w-prose text-sm text-emerald-950/70 sm:block">
          跟 Mori 聊天、查新聞或問天氣。她會在場景裡散步，也會回應你的語音輸入。
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-950/75">{statusLabel}</p>
      </header>

      <div className="absolute inset-0">
        <section
          ref={stageRef}
          aria-label="Mori 動畫預覽場景"
          className="absolute inset-0 overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,rgba(83,130,87,0)_0%,rgba(83,130,87,0.17)_100%)]" />
          <div className="pointer-events-none absolute left-[8%] top-[13%] h-28 w-28 rounded-full bg-white/40 blur-3xl" />
          <div className="pointer-events-none absolute right-[12%] top-[23%] h-40 w-40 rounded-full bg-emerald-100/45 blur-3xl" />
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-1.5 text-[10px] text-emerald-950/65 backdrop-blur">
            <span className={`h-1.5 w-1.5 rounded-full ${activity === 'thinking' ? 'animate-pulse bg-amber-500' : 'bg-emerald-600'}`} />
            {currentProjectHasIdle ? '預覽目前專案角色' : '預覽 Mori 範例角色'}
          </div>

          {sprite?.sheet ? (
            <div
              ref={playerRef}
              className={`absolute z-20 touch-none select-none ${isDragging ? 'cursor-grabbing transition-none' : isWalking ? 'cursor-grab transition-[left,top] ease-in-out' : 'cursor-grab transition-[left,top] ease-out'}`}
              style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)', transitionDuration: isWalking ? `${walkDurationMs}ms` : '700ms' }}
              onPointerDown={onPlayerPointerDown}
              onPointerMove={onPlayerPointerMove}
              onPointerUp={finishPlayerDrag}
              onPointerCancel={finishPlayerDrag}
              aria-label="按住並拖曳 Mori"
            >
              <div
                className="pointer-events-none drop-shadow-[0_14px_12px_rgba(39,72,43,0.2)]"
                style={{ transform: facesLeft ? 'scaleX(-1)' : undefined }}
              >
                <AnimationPreview
                  sheet={sprite.sheet}
                  durationMs={sprite.durationMs}
                  size={200}
                  transform={sprite.transform}
                />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
              <div className="max-w-xs rounded-2xl border border-white/70 bg-white/55 px-5 py-4 text-sm text-emerald-950/70 shadow-sm backdrop-blur">
                {demoError || 'Mori 的範例動畫載入中…'}
              </div>
            </div>
          )}
        </section>

        <section className="pointer-events-none absolute inset-x-3 bottom-3 top-24 z-30 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/75 bg-white/80 shadow-2xl shadow-emerald-950/15 backdrop-blur-lg sm:inset-x-5 sm:bottom-5 sm:top-28 md:inset-x-5 md:bottom-5 md:top-24">
          <header className="pointer-events-none flex shrink-0 items-center gap-3 border-b border-stone-100/90 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <MessageCircle size={19} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-stone-900">和 Mori 聊聊</h2>
              <p className="text-[11px] text-stone-500">聊天 · 新聞 · 天氣</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-500">Gemini-Web</span>
          </header>

          <section className="pointer-events-none shrink-0 border-b border-stone-100 bg-emerald-50/85">
            <div className="pointer-events-none flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold text-stone-800">Gemini-Web 連線設定</h3>
                <p className={`mt-0.5 text-[11px] ${connection.apiKey.trim() ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {connection.apiKey.trim() ? 'API Key 已儲存在這個瀏覽器' : '填入測試用 API Key 後即可聊天'}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={connectionSettingsOpen}
                onClick={() => setConnectionSettingsOpen((open) => !open)}
                className="pointer-events-auto shrink-0 rounded-lg border border-emerald-900/10 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-50"
              >
                {connectionSettingsOpen ? '收起' : '編輯設定'}
              </button>
            </div>

            {connectionSettingsOpen && (
              <div className="pointer-events-none max-h-[38vh] space-y-3 overflow-y-auto px-4 pb-4">
                <label className="pointer-events-auto block space-y-1.5">
                  <span className="text-[11px] font-medium text-stone-700">Gemini-Web Base URL</span>
                  <input
                    type="url"
                    value={connection.baseUrl}
                    onChange={(event) => {
                      const baseUrl = event.currentTarget.value
                      setConnection((current) => ({ ...current, baseUrl }))
                    }}
                    placeholder={DEFAULT_GEMINI_WEB_URL}
                    autoComplete="url"
                    spellCheck={false}
                    className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="pointer-events-auto block space-y-1.5">
                  <span className="text-[11px] font-medium text-stone-700">API Key</span>
                  <span className="flex h-9 overflow-hidden rounded-lg border border-stone-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={connection.apiKey}
                      onChange={(event) => {
                        const apiKey = event.currentTarget.value
                        setConnection((current) => ({ ...current, apiKey }))
                      }}
                      placeholder="貼上 gemini-web 管理頁建立的測試 key"
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 bg-transparent px-3 text-xs text-stone-800 outline-none placeholder:text-stone-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((visible) => !visible)}
                      aria-label={showApiKey ? '隱藏 API Key' : '顯示 API Key'}
                      className="pointer-events-auto flex w-10 shrink-0 items-center justify-center text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                    >
                      {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </span>
                </label>

                <div className="flex items-start justify-between gap-3">
                  <p className="max-w-sm text-[10px] leading-relaxed text-stone-500">
                    設定只存在這個瀏覽器。送出訊息時，連線網址和 API Key 會傳給 Live Demo 後端，再由後端呼叫 Gemini-Web。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConnection(DEFAULT_CONNECTION_SETTINGS)
                      setShowApiKey(false)
                    }}
                    className="pointer-events-auto shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-stone-500 transition-colors hover:bg-white hover:text-stone-800"
                  >
                    清除設定
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="pointer-events-none min-h-0 flex-1 space-y-4 overflow-y-auto bg-stone-50/55 px-4 py-4 sm:px-6 sm:py-6" aria-live="polite" aria-label="對話內容">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex min-w-0 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`pointer-events-auto min-w-0 w-fit max-w-[96%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-emerald-700 text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-800 shadow-sm'}`}>
                  {message.text}
                </div>
              </div>
            ))}
            {activity === 'thinking' && (
              <div className="flex justify-start">
                <div className="pointer-events-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-500 shadow-sm">
                  <LoaderCircle size={14} className="animate-spin" /> Mori 正在想…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="pointer-events-none shrink-0 border-t border-stone-100 bg-white/90 p-3 sm:p-4" onSubmit={(event) => void sendMessage(event)}>
            <div className="pointer-events-none flex items-end gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value.slice(0, 1500))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                rows={2}
                maxLength={1500}
                aria-label="輸入訊息"
                placeholder="跟 Mori 說說話…"
                className="pointer-events-auto max-h-32 min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:ring-0"
              />
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={!voiceSupported || activity === 'thinking'}
                title={activity === 'recording' ? '停止語音輸入' : '語音輸入'}
                aria-label={activity === 'recording' ? '停止語音輸入' : '語音輸入'}
                className={`pointer-events-auto mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activity === 'recording' ? 'animate-pulse bg-rose-100 text-rose-700' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}
              >
                {activity === 'recording' ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || activity === 'thinking'}
                aria-label="送出訊息"
                className="pointer-events-auto mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-stone-400">
              <span>{voiceError || (!voiceSupported ? '此瀏覽器不支援語音輸入，請使用 Chrome 或 Edge。' : '展示版不讀取私人記憶；對話會送往 Gemini-Web。')}</span>
              <span className="shrink-0">{draft.length}/1500</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
