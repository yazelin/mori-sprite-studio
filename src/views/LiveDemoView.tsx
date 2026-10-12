import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
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

function formatWeatherCard(lines: string[], userMessage: string, firstHourLine: number) {
  const overview = firstHourLine >= 0 ? lines.slice(0, firstHourLine) : lines
  const hasTemperature = overview.some((line, index) => /°\s*C/i.test(line) || (/^\d+(?:\.\d+)?$/.test(line) && /^°\s*C$/i.test(overview[index + 1] ?? '')))
  const highLowLine = overview.find((line) => /(?:高點|高点|最高)/.test(line) && /(?:低點|低点|最低)/.test(line)) // speak-tw-ok: 辨識原始天氣資料欄位。
  if (!hasTemperature && !highLowLine) return null

  const temperatureIndex = overview.findIndex((line, index) => /^\d+(?:\.\d+)?$/.test(line) && /^°\s*C$/i.test(overview[index + 1] ?? ''))
  const inlineTemperature = overview.find((line) => /\d+(?:\.\d+)?\s*°\s*C/i.test(line))
  const currentTemperature = temperatureIndex >= 0
    ? `${overview[temperatureIndex]}°C`
    : inlineTemperature?.match(/\d+(?:\.\d+)?\s*°\s*C/i)?.[0].replace(/\s+/g, '')
  const summary = highLowLine?.match(/(?:高點|高点|最高)\s*[:：]?\s*(\d+(?:\.\d+)?).*?(?:低點|低点|最低)\s*[:：]?\s*(\d+(?:\.\d+)?).*?(?:降水|降雨)\s*[:：]?\s*(\d+(?:\.\d+)?\s*%?)/) // speak-tw-ok: 辨識原始天氣資料欄位。
  const conditions: Record<string, string> = {
    晴: '晴', 晴天: '晴', 晴朗: '晴朗', 多雲: '多雲', 多云: '多雲', 局部多雲: '局部多雲', 局部多云: '局部多雲', // speak-tw-ok: 將天氣卡片簡體天氣詞對應成繁體。
    陰: '陰', 阴: '陰', 陰天: '陰天', 阴天: '陰天', 陣雨: '陣雨', 阵雨: '陣雨', 雷陣雨: '雷陣雨', 雷阵雨: '雷陣雨', // speak-tw-ok: 將天氣卡片簡體天氣詞對應成繁體。
    小雨: '小雨', 中雨: '中雨', 大雨: '大雨', 暴雨: '暴雨', 小雪: '小雪', 中雪: '中雪', 大雪: '大雪',
    晴轉多雲: '晴轉多雲', 晴转多云: '晴轉多雲', 晴時多雲: '晴時多雲', 晴间多云: '晴時多雲', // speak-tw-ok: 將天氣卡片簡體天氣詞對應成繁體。
  } // speak-tw-ok: 刻意辨識 Gemini-Web 天氣卡片可能回傳的簡體欄位與天氣詞。
  const condition = overview.map((line) => line.trim()).find((line) => conditions[line])
  const weekday = overview.join(' ').match(/星期\s*([一二三四五六日天])/)
  const place = /台北|臺北|taipei/i.test(userMessage) ? '台北' : ''
  const period = /明天|明日/.test(userMessage) ? '明天' : /今天|今日/.test(userMessage) ? '今天' : weekday ? `星期${weekday[1]}` : ''
  const parts = [
    `${place ? `${place}天氣` : '天氣'}${period ? `（${period}）` : ''}`,
    currentTemperature ? `目前 ${currentTemperature}` : '',
    condition ? conditions[condition] : '',
    summary ? `高溫 ${summary[1]}°C、低溫 ${summary[2]}°C、降雨機率 ${summary[3].replace(/\s/g, '')}` : '',
  ].filter(Boolean)
  return parts.length > 1 ? `${parts[0]}：${parts.slice(1).join('，')}。` : null
}

function formatAssistantReply(text: string, userMessage: string) {
  let normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/(?:div|p|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
  let lines = normalized.split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim())

  const isWeatherQuestion = /天氣|氣象|溫度|降雨|降水|預報|weather|forecast/i.test(userMessage)
  const asksForHourlyForecast = /逐時|每小時|小時預報|hourly/i.test(userMessage)
  const firstHourLine = lines.findIndex((line) => /^\s*(?:[1-9]|1[0-2])\s*(?:上午|下午|AM|PM)(?:\s|$)/i.test(line))

  if (isWeatherQuestion && !asksForHourlyForecast && firstHourLine >= 0) {
    const weatherSummary = formatWeatherCard(lines, userMessage, firstHourLine)
    if (weatherSummary) return weatherSummary
    // Search-backed weather cards can contain a full day of raw hourly rows.
    // Keep the overview and omit those rows unless the user asked for them.
    lines = lines.slice(0, firstHourLine)
    lines = lines.filter((line) => !/^(?:溫度|降水機率|降雨機率|風速|\||°?F)$/i.test(line))
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (/^\d+(?:\.\d+)?$/.test(lines[index]) && /^°\s*[CF]$/i.test(lines[index + 1])) {
        lines[index] = `${lines[index]}${lines[index + 1].replace(/\s/g, '')}`
        lines.splice(index + 1, 1)
      }
    }
    normalized = lines.filter(Boolean).join(' · ')
  } else {
    normalized = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  return normalized.trim()
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
  return tokens.filter(Boolean).map((token, index) => {
    const key = `${keyPrefix}-${index}`
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) {
      return <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2">{link[1]}</a>
    }
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      return <strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={key} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>
    }
    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      return <em key={key}>{token.slice(1, -1)}</em>
    }
    return token
  })
}

function renderAssistantMarkdown(text: string) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  let code: string[] | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(<p key={`p-${blocks.length}`} className="my-1.5 first:mt-0 last:mb-0">{renderInlineMarkdown(paragraph.join(' '), `p-${blocks.length}`)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const List = list.kind === 'ul' ? 'ul' : 'ol'
    blocks.push(
      <List key={`list-${blocks.length}`} className={`my-2 space-y-1.5 pl-5 ${list.kind === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {list.items.map((item, index) => <li key={index} className="pl-0.5">{renderInlineMarkdown(item, `list-${blocks.length}-${index}`)}</li>)}
      </List>,
    )
    list = null
  }
  const flushCode = () => {
    if (!code) return
    blocks.push(<pre key={`code-${blocks.length}`} className="my-2 overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs"><code>{code.join('\n')}</code></pre>)
    code = null
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (code) {
      if (/^```/.test(trimmed)) flushCode()
      else code.push(line)
      return
    }
    if (/^```/.test(trimmed)) {
      flushParagraph()
      flushList()
      code = []
      return
    }
    if (!trimmed) {
      flushParagraph()
      flushList()
      return
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const sizeClass = heading[1].length === 1 ? 'text-base' : 'text-sm'
      blocks.push(<h3 key={`h-${blocks.length}`} className={`my-2 font-semibold ${sizeClass}`}>{renderInlineMarkdown(heading[2], `h-${blocks.length}`)}</h3>)
      return
    }

    const unordered = trimmed.match(/^(?:[-*+]\s+|•\s+)(.+)$/)
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const kind = ordered ? 'ol' : 'ul'
      if (list && list.kind !== kind) flushList()
      if (!list) list = { kind, items: [] }
      list.items.push((unordered ?? ordered)![1])
      return
    }

    const quote = trimmed.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      flushList()
      blocks.push(<blockquote key={`quote-${blocks.length}`} className="my-2 border-l-2 border-emerald-300 pl-3 text-stone-600">{renderInlineMarkdown(quote[1], `quote-${blocks.length}`)}</blockquote>)
      return
    }

    flushList()
    paragraph.push(trimmed)
  })

  flushParagraph()
  flushList()
  flushCode()
  return blocks
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
        x: Math.random() * 100,
        y: Math.random() * 100,
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
      setMessages((current) => [...current, { role: 'model', text: formatAssistantReply(result.text!, text) }])
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
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
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

          {sprite?.sheet ? (
            <div
              ref={playerRef}
              className={`absolute z-40 touch-none select-none ${isDragging ? 'cursor-grabbing transition-none' : isWalking ? 'cursor-grab transition-[left,top] ease-in-out' : 'cursor-grab transition-[left,top] ease-out'}`}
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

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-3 top-24 z-10 rounded-3xl border border-white/75 bg-white/65 shadow-2xl shadow-emerald-950/15 backdrop-blur-lg sm:inset-x-5 sm:bottom-5 sm:top-28 md:inset-x-5 md:bottom-5 md:top-24"
        />
        <section className="pointer-events-none absolute inset-x-3 bottom-3 top-24 z-30 flex min-h-0 flex-col overflow-hidden rounded-3xl sm:inset-x-5 sm:bottom-5 sm:top-28 md:inset-x-5 md:bottom-5 md:top-24">
          <header className="pointer-events-none flex shrink-0 items-center gap-3 border-b border-stone-100/90 bg-white/85 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <MessageCircle size={19} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-stone-900">和 Mori 聊聊</h2>
              <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <span>聊天 · 新聞 · 天氣</span>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${activity === 'thinking' ? 'animate-pulse bg-amber-500' : activity === 'error' ? 'bg-rose-500' : 'bg-emerald-600'}`} />
                <span aria-live="polite" className={`font-medium ${activity === 'thinking' ? 'text-amber-700' : activity === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{statusLabel}</span>
              </p>
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

          <div className="pointer-events-none min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent px-4 py-4 sm:px-6 sm:py-6" aria-live="polite" aria-label="對話內容">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex min-w-0 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`pointer-events-auto min-w-0 w-fit max-w-[96%] ${message.role === 'user' ? 'whitespace-pre-wrap rounded-br-md bg-emerald-700 text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-800 shadow-sm'} break-words [overflow-wrap:anywhere] px-4 py-3 text-sm leading-6`}>
                  {message.role === 'model' ? renderAssistantMarkdown(message.text) : message.text}
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
                className="pointer-events-auto max-h-32 min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:ring-0 focus-visible:!outline-none"
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
