import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import JSZip from 'jszip'
import { LoaderCircle, MessageCircle, Mic, MicOff, Send } from 'lucide-react'
import { AnimationPreview } from '@/components/AnimationPreview'
import { useAppStore } from '@/store'
import { STATE_NAMES, type CellTransform, type StateName } from '@/types/project'

type ChatMessage = { role: 'user' | 'model'; text: string }
type Activity = 'idle' | 'recording' | 'thinking' | 'done' | 'error'
type Sprite = { sheet: Blob | null; durationMs: number; transform: CellTransform }
type SpritePack = { displayName: string; states: Record<StateName, Sprite> }

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
const WELCOME: ChatMessage = {
  role: 'model',
  text: '嗨，我是 Mori。想聊聊、看看最近的新聞，或問我今天的天氣？',
}
let bundledDemoPromise: Promise<SpritePack> | null = null

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
  const [position, setPosition] = useState({ x: 63, y: 66 })
  const [voiceSupported] = useState(supportsSpeechRecognition)
  const [voiceError, setVoiceError] = useState('')

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
        x: 15 + Math.random() * 70,
        y: 24 + Math.random() * 52,
      }
      setFacesLeft(next.x < current.x)
      positionRef.current = next
      setIsWalking(true)
      setPosition(next)
      timer = window.setTimeout(() => {
        setIsWalking(false)
        timer = window.setTimeout(walk, 1700 + Math.random() * 2500)
      }, 2500)
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

    try {
      const response = await fetch('/api/live-demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const result = await response.json() as { text?: string; error?: string }
      if (!response.ok) throw new Error(result.error || 'Mori 暫時沒有回應，請稍後再試。')
      if (!result.text?.trim()) throw new Error('Mori 這次沒有回覆內容，請再試一次。')
      setMessages((current) => [...current, { role: 'model', text: result.text!.trim() }])
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
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Live Demo</h1>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">{pack?.displayName ?? 'Mori'}</span>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          跟 Mori 聊天、查新聞或問天氣。她會在場景裡散步，也會回應你的語音輸入。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section
          ref={stageRef}
          aria-label="Mori 動畫預覽場景"
          className="relative min-h-[480px] overflow-hidden rounded-3xl border border-emerald-900/10 bg-[radial-gradient(ellipse_at_20%_8%,rgba(255,255,255,0.9),transparent_45%),linear-gradient(155deg,#edf5e9_0%,#c6ddc1_54%,#a9c9ac_100%)] shadow-sm sm:min-h-[600px]"
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(83,130,87,0)_0%,rgba(83,130,87,0.15)_100%)]" />
          <div className="pointer-events-none absolute left-[8%] top-[13%] h-20 w-20 rounded-full bg-white/35 blur-2xl" />
          <div className="pointer-events-none absolute right-[12%] top-[23%] h-28 w-28 rounded-full bg-emerald-100/40 blur-2xl" />
          <div className="absolute left-5 top-5 z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-900/55">A little forest corner</p>
            <p className="mt-1 text-sm font-medium text-emerald-950/75">{statusLabel}</p>
          </div>
          <div className="absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-1.5 text-[10px] text-emerald-950/65 backdrop-blur">
            <span className={`h-1.5 w-1.5 rounded-full ${activity === 'thinking' ? 'animate-pulse bg-amber-500' : 'bg-emerald-600'}`} />
            {currentProjectHasIdle ? '預覽目前專案角色' : '預覽 Mori 範例角色'}
          </div>

          {sprite?.sheet ? (
            <div
              ref={playerRef}
              className={`absolute z-20 touch-none select-none ${isDragging ? 'cursor-grabbing transition-none' : isWalking ? 'cursor-grab transition-[left,top] ease-in-out' : 'cursor-grab transition-[left,top] ease-out'}`}
              style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)', transitionDuration: isWalking ? '2500ms' : '700ms' }}
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

        <section className="flex min-h-[600px] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <MessageCircle size={19} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-stone-900">和 Mori 聊聊</h2>
              <p className="text-[11px] text-stone-500">聊天 · 新聞 · 天氣</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-500">Gemini-Web</span>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 px-4 py-5" aria-live="polite" aria-label="對話內容">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-emerald-700 text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-800 shadow-sm'}`}>
                  {message.text}
                </div>
              </div>
            ))}
            {activity === 'thinking' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-500 shadow-sm">
                  <LoaderCircle size={14} className="animate-spin" /> Mori 正在想…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="border-t border-stone-100 p-3" onSubmit={(event) => void sendMessage(event)}>
            <div className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
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
                className="max-h-32 min-h-12 flex-1 resize-y border-0 bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:ring-0"
              />
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={!voiceSupported || activity === 'thinking'}
                title={activity === 'recording' ? '停止語音輸入' : '語音輸入'}
                aria-label={activity === 'recording' ? '停止語音輸入' : '語音輸入'}
                className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activity === 'recording' ? 'animate-pulse bg-rose-100 text-rose-700' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}
              >
                {activity === 'recording' ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || activity === 'thinking'}
                aria-label="送出訊息"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
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
