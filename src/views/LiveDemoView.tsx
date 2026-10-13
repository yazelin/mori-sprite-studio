import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import JSZip from 'jszip'
import { get, set } from 'idb-keyval'
import { Eye, EyeOff, ImagePlus, LoaderCircle, MessageCircle, Mic, MicOff, Music2, Send, Square, Volume2 } from 'lucide-react'
import { AnimationPreview } from '@/components/AnimationPreview'
import {
  buildMoriSelfiePrompt,
  buildMoriSongPrompt,
  detectMoriCreationMode,
  isMoriSelfieRequest,
  isMoriSingingRequest,
  loadMoriReferenceImage,
} from '@/lib/moriCreationProfile'
import { useAppStore } from '@/store'
import { STATE_NAMES, type CellTransform, type StateName } from '@/types/project'

type GeneratedMedia = { type: 'image' | 'audio'; src: string; filename: string }
type ChatMessage = { role: 'user' | 'model'; text: string; media?: GeneratedMedia[] }
type ComposerMode = 'chat' | 'image' | 'music'
type Activity = 'idle' | 'recording' | 'thinking' | 'done' | 'error'
type Sprite = { sheet: Blob | null; durationMs: number; transform: CellTransform }
type SpritePack = { displayName: string; states: Record<StateName, Sprite> }
type ConnectionSettings = { baseUrl: string; apiKey: string }
type TtsSettings = { baseUrl: string; apiKey: string; voice: string }

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
const CHAT_HISTORY_STORAGE_KEY = 'mori-live-demo-chat-history-v1'
const LARCH_TTS_DEFAULT_BASE_URL = 'https://ching-tech.ddns.net/larch-tts/'
const TTS_SETTINGS_STORAGE_KEY = 'mori-live-demo-larch-tts'
const DEFAULT_CONNECTION_SETTINGS: ConnectionSettings = {
  baseUrl: DEFAULT_GEMINI_WEB_URL,
  apiKey: '',
}
const TTS_VOICE_OPTIONS = [
  { id: 'Chinese (Mandarin)_Warm_Girl', label: '溫暖女孩', hint: '親切柔和・日常對話' },
  { id: 'Chinese (Mandarin)_Soft_Girl', label: '輕柔女孩', hint: '輕柔細膩・安靜溫柔' },
  { id: 'Chinese (Mandarin)_Warm_Bestie', label: '暖心閨蜜', hint: '貼心自然・好友聊天' },
  { id: 'Chinese (Mandarin)_Sweet_Lady', label: '甜美女聲', hint: '柔甜討喜・抒情語氣' },
] as const
const TTS_PREVIEW_TEXT = '嗨，我是 Mori。今天也一起在森林裡散散步吧！'
const TTS_SAMPLE_URLS: Record<string, string> = {
  'Chinese (Mandarin)_Warm_Girl': '/tts-samples/warm-girl.mp3',
  'Chinese (Mandarin)_Soft_Girl': '/tts-samples/soft-girl.mp3',
  'Chinese (Mandarin)_Warm_Bestie': '/tts-samples/warm-bestie.mp3',
  'Chinese (Mandarin)_Sweet_Lady': '/tts-samples/sweet-lady.mp3',
}
const DEFAULT_TTS_SETTINGS: TtsSettings = {
  baseUrl: LARCH_TTS_DEFAULT_BASE_URL,
  apiKey: '',
  voice: TTS_VOICE_OPTIONS[0].id,
}
const WELCOME: ChatMessage = {
  role: 'model',
  text: '嗨，我是 Mori。想聊聊、看看最近的新聞，或問我今天的天氣？',
}
let bundledDemoPromise: Promise<SpritePack> | null = null

function loadTtsSettings(): TtsSettings {
  if (typeof window === 'undefined') return DEFAULT_TTS_SETTINGS
  try {
    const saved = window.localStorage.getItem(TTS_SETTINGS_STORAGE_KEY)
    if (!saved) return DEFAULT_TTS_SETTINGS
    const parsed = JSON.parse(saved) as Partial<TtsSettings>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : LARCH_TTS_DEFAULT_BASE_URL,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      voice: TTS_VOICE_OPTIONS.some((option) => option.id === parsed.voice)
        ? parsed.voice as string
        : DEFAULT_TTS_SETTINGS.voice,
    }
  } catch {
    return DEFAULT_TTS_SETTINGS
  }
}

function cleanSpeechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSpeechText(text: string, maxLength = 480): string[] {
  const remaining = Array.from(text)
  const chunks: string[] = []
  while (remaining.length > maxLength) {
    let splitAt = maxLength
    for (const boundary of [/[。！？!?；;]/, /[，,、]/]) {
      let found = -1
      for (let index = maxLength; index >= Math.floor(maxLength * 0.65); index -= 1) {
        if (boundary.test(remaining[index - 1])) { found = index; break }
      }
      if (found > 0) { splitAt = found; break }
    }
    chunks.push(remaining.splice(0, splitAt).join(''))
  }
  if (remaining.length > 0) chunks.push(remaining.join(''))
  return chunks
}

function combineAudioBuffers(context: AudioContext, buffers: AudioBuffer[]) {
  if (buffers.length === 0) throw new Error('Larch-TTS 沒有回傳可播放的音訊。')
  const channels = Math.max(...buffers.map((buffer) => buffer.numberOfChannels))
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
  const combined = context.createBuffer(channels, totalLength, buffers[0].sampleRate)
  let offset = 0
  for (const buffer of buffers) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1)
      combined.getChannelData(channel).set(buffer.getChannelData(sourceChannel), offset)
    }
    offset += buffer.length
  }
  return combined
}

function speechCacheKey(voice: string, text: string) {
  return `${voice}\u0000${text}`
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if ((message.role !== 'user' && message.role !== 'model') || typeof message.text !== 'string') return false
  if (message.media === undefined) return true
  return Array.isArray(message.media) && message.media.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const media = item as Record<string, unknown>
    return (media.type === 'image' || media.type === 'audio')
      && typeof media.src === 'string'
      && typeof media.filename === 'string'
  })
}

function geminiWebEndpoint(baseUrl: string, path: string) {
  const value = baseUrl.trim()
  if (!value) throw new Error('請先填入 Gemini-Web Base URL。')
  const normalized = value.endsWith('/') ? value : `${value}/`
  const url = new URL(path.replace(/^\/+/, ''), normalized)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Gemini-Web Base URL 必須使用 HTTP 或 HTTPS。')
  }
  return url.toString()
}

function responseError(result: Record<string, unknown> | null) {
  const detail = result?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return detail.message
  for (const key of ['error', 'message']) {
    if (typeof result?.[key] === 'string') return result[key] as string
  }
  return ''
}

async function readGeminiWebResult(response: Response) {
  const result = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || result?.success === false) {
    throw new Error(responseError(result) || `Gemini-Web 請求失敗（${response.status}）。`)
  }
  if (!result) throw new Error('Gemini-Web 回傳的資料格式無法讀取。')
  return result
}

function asDataUrl(value: string, mime: string) {
  return value.startsWith('data:') ? value : `data:${mime};base64,${value}`
}

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
  const [messagesReady, setMessagesReady] = useState(false)
  const [draft, setDraft] = useState('')
  const [composerMode, setComposerMode] = useState<ComposerMode>('chat')
  const [activity, setActivity] = useState<Activity>('idle')
  const [isWalking, setIsWalking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [facesLeft, setFacesLeft] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 66 })
  const [walkDurationMs, setWalkDurationMs] = useState(3500)
  const [voiceSupported] = useState(supportsSpeechRecognition)
  const [voiceError, setVoiceError] = useState('')
  const [connection, setConnection] = useState<ConnectionSettings>(loadConnectionSettings)
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(loadTtsSettings)
  const [connectionSettingsOpen, setConnectionSettingsOpen] = useState(() => !connection.apiKey.trim())
  const [showApiKey, setShowApiKey] = useState(false)
  const [showTtsApiKey, setShowTtsApiKey] = useState(false)
  const [loadingTtsKey, setLoadingTtsKey] = useState('')
  const [playingTtsKey, setPlayingTtsKey] = useState('')

  const stageRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(position)
  const dragRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const ignoreRecognitionEndRef = useRef(false)
  const activityTimerRef = useRef<number | undefined>(undefined)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const playbackKeyRef = useRef('')
  const loadingTtsKeyRef = useRef('')
  const preparedAudioRef = useRef(new Map<string, AudioBuffer>())

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
    let cancelled = false
    const restoreMessages = async () => {
      try {
        const saved = await get<unknown>(CHAT_HISTORY_STORAGE_KEY)
        if (cancelled || !Array.isArray(saved)) return
        const restored = saved.filter(isChatMessage)
        if (restored.length > 0) setMessages(restored)
      } catch {
        // Keep the chat available if IndexedDB is disabled or unavailable.
      } finally {
        if (!cancelled) setMessagesReady(true)
      }
    }
    void restoreMessages()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!messagesReady) return
    void set(CHAT_HISTORY_STORAGE_KEY, messages).catch(() => {
      // Keep the chat usable if the browser cannot persist local history.
    })
  }, [messages, messagesReady])

  useEffect(() => {
    try {
      window.localStorage.setItem(CONNECTION_SETTINGS_STORAGE_KEY, JSON.stringify(connection))
    } catch {
      // Keep the form usable when browser storage is unavailable.
    }
  }, [connection])

  useEffect(() => {
    try {
      window.localStorage.setItem(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(ttsSettings))
    } catch {
      // Keep settings editable when browser storage is unavailable.
    }
  }, [ttsSettings])

  useEffect(() => () => {
    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    recognitionRef.current?.stop()
    if (playbackSourceRef.current) {
      playbackSourceRef.current.onended = null
      try { playbackSourceRef.current.stop() } catch { /* It may already have ended. */ }
    }
    void audioContextRef.current?.close()
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

  const stopTtsPlayback = () => {
    const source = playbackSourceRef.current
    playbackSourceRef.current = null
    playbackKeyRef.current = ''
    if (source) {
      source.onended = null
      try { source.stop() } catch { /* It may already have ended. */ }
    }
    setPlayingTtsKey('')
    setActivity((current) => current === 'done' ? 'idle' : current)
  }

  const startTtsAudio = async (context: AudioContext, cacheKey: string, audioBuffer: AudioBuffer) => {
    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(context.destination)
    source.onended = () => {
      if (playbackSourceRef.current !== source) return
      playbackSourceRef.current = null
      playbackKeyRef.current = ''
      setPlayingTtsKey('')
      setActivity((current) => current === 'done' ? 'idle' : current)
    }
    playbackSourceRef.current = source
    playbackKeyRef.current = cacheKey
    setPlayingTtsKey(cacheKey)
    await context.resume()
    source.start()
    setActivity('done')
  }

  const playVoicePreview = async () => {
    if (ttsSettings.apiKey.trim()) {
      await playTts(TTS_PREVIEW_TEXT)
      return
    }

    const cacheKey = `preview:${ttsSettings.voice}`
    if (playbackKeyRef.current === cacheKey && playbackSourceRef.current) {
      stopTtsPlayback()
      return
    }
    if (loadingTtsKeyRef.current) return

    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    setVoiceError('')
    if (playbackSourceRef.current) stopTtsPlayback()
    loadingTtsKeyRef.current = cacheKey
    setLoadingTtsKey(cacheKey)

    try {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) throw new Error('此瀏覽器不支援語音播放。')
      const context = audioContextRef.current ?? new AudioContextConstructor()
      audioContextRef.current = context
      await context.resume()

      const sampleKey = `sample:${ttsSettings.voice}`
      let audioBuffer = preparedAudioRef.current.get(sampleKey)
      if (!audioBuffer) {
        const response = await fetch(TTS_SAMPLE_URLS[ttsSettings.voice])
        if (!response.ok) throw new Error('預錄試聽檔載入失敗，請重新整理頁面再試。')
        audioBuffer = await context.decodeAudioData(await response.arrayBuffer())
        preparedAudioRef.current.set(sampleKey, audioBuffer)
      }
      await startTtsAudio(context, cacheKey, audioBuffer)
    } catch (error) {
      stopTtsPlayback()
      const message = error instanceof Error ? error.message : '預錄試聽檔載入失敗，請重新整理頁面再試。'
      setVoiceError(message)
      setTransientActivity('error', 2200)
    } finally {
      loadingTtsKeyRef.current = ''
      setLoadingTtsKey('')
    }
  }

  const playTts = async (rawText: string) => {
    const text = cleanSpeechText(rawText)
    if (!text) {
      setVoiceError('這則訊息沒有可播放的文字。')
      setTransientActivity('error', 2200)
      return
    }
    const cacheKey = speechCacheKey(ttsSettings.voice, text)
    if (playbackKeyRef.current === cacheKey && playbackSourceRef.current) {
      stopTtsPlayback()
      return
    }
    if (loadingTtsKeyRef.current) return
    if (!ttsSettings.apiKey.trim() || !ttsSettings.baseUrl.trim()) {
      setConnectionSettingsOpen(true)
      setVoiceError('請先在編輯設定填入 Larch-TTS Base URL 和 API Key。')
      setTransientActivity('error', 2200)
      return
    }

    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    setVoiceError('')
    if (playbackSourceRef.current) stopTtsPlayback()
    loadingTtsKeyRef.current = cacheKey
    setLoadingTtsKey(cacheKey)

    try {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) throw new Error('此瀏覽器不支援語音播放。')
      const context = audioContextRef.current ?? new AudioContextConstructor()
      audioContextRef.current = context
      await context.resume()

      let audioBuffer = preparedAudioRef.current.get(cacheKey)
      if (!audioBuffer) {
        const chunks = splitSpeechText(text)
        const decoded: AudioBuffer[] = []
        for (const chunk of chunks) {
          const response = await fetch('/api/live-demo/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseUrl: ttsSettings.baseUrl,
              apiKey: ttsSettings.apiKey,
              voice: ttsSettings.voice,
              text: chunk,
            }),
          })
          if (!response.ok) {
            const result = await response.json().catch(() => null) as { error?: unknown } | null
            throw new Error(typeof result?.error === 'string' ? result.error : 'Larch-TTS 配音失敗，請稍後再試。')
          }
          decoded.push(await context.decodeAudioData(await response.arrayBuffer()))
        }
        audioBuffer = combineAudioBuffers(context, decoded)
        if (preparedAudioRef.current.size >= 8) {
          const oldestKey = preparedAudioRef.current.keys().next().value
          if (oldestKey) preparedAudioRef.current.delete(oldestKey)
        }
        preparedAudioRef.current.set(cacheKey, audioBuffer)
      }

      await startTtsAudio(context, cacheKey, audioBuffer)
    } catch (error) {
      stopTtsPlayback()
      const message = error instanceof Error ? error.message : 'Larch-TTS 配音失敗，請稍後再試。'
      setVoiceError(message)
      setTransientActivity('error', 2200)
    } finally {
      loadingTtsKeyRef.current = ''
      setLoadingTtsKey('')
    }
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
    if (!messagesReady || !text || activity === 'thinking') return
    const inferredMode = composerMode === 'chat' ? detectMoriCreationMode(text) : null
    const mode = inferredMode ?? composerMode
    if (inferredMode) setComposerMode(inferredMode)
    stopVoiceInput(true)
    setVoiceError('')
    const nextMessages = [...messages, { role: 'user' as const, text }]
    setMessages(nextMessages)
    setDraft('')
    if (activityTimerRef.current !== undefined) window.clearTimeout(activityTimerRef.current)
    setActivity('thinking')

    if (!connection.apiKey.trim()) {
      setConnectionSettingsOpen(true)
      setMessages((current) => [...current, { role: 'model', text: '請先在上方連線設定填入 Gemini-Web API Key，再試一次。' }])
      setTransientActivity('error', 2200)
      return
    }

    try {
      if (mode === 'chat') {
        const response = await fetch('/api/live-demo/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.map(({ role, text: messageText }) => ({ role, text: messageText })),
            baseUrl: connection.baseUrl,
            apiKey: connection.apiKey,
          }),
        })
        const result = await response.json() as { text?: string; error?: string }
        if (!response.ok) throw new Error(result.error || 'Mori 暫時沒有回應，請稍後再試。')
        if (!result.text?.trim()) throw new Error('Mori 這次沒有回覆內容，請再試一次。')
        setMessages((current) => [...current, { role: 'model', text: formatAssistantReply(result.text!, text) }])
      } else {
        const isImage = mode === 'image'
        const useMoriReference = isImage && isMoriSelfieRequest(text)
        const useMoriSongProfile = mode === 'music' && isMoriSingingRequest(text)
        const endpointPath = isImage ? (useMoriReference ? 'api/edit' : 'api/generate') : 'api/music'
        const endpoint = geminiWebEndpoint(connection.baseUrl, endpointPath)
        const payload: Record<string, unknown> = {
          prompt: useMoriReference
            ? buildMoriSelfiePrompt(text)
            : useMoriSongProfile ? buildMoriSongPrompt(text) : text,
          timeout: isImage ? 180 : 600,
        }
        if (useMoriReference) payload.reference_images = [await loadMoriReferenceImage()]
        if (useMoriSongProfile) {
          payload.length = 'standard'
          payload.vocals = 'vocals'
          payload.genre = 'folk'
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': connection.apiKey,
          },
          body: JSON.stringify(payload),
        })
        const result = await readGeminiWebResult(response)
        if (isImage) {
          const images = Array.isArray(result.images)
            ? result.images.filter((image): image is string => typeof image === 'string' && image.length > 0)
            : []
          if (images.length === 0) throw new Error('Gemini-Web 沒有回傳圖片，請調整描述後再試一次。')
          const media = images.map((image, index) => {
            const mimeSubtype = image.match(/^data:image\/([^;,]+)/i)?.[1]?.toLowerCase()
            const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype || 'png'
            return {
              type: 'image' as const,
              src: asDataUrl(image, 'image/png'),
              filename: `mori-image-${index + 1}.${extension}`,
            }
          })
          setMessages((current) => [...current, { role: 'model', text: `圖片生成完成，共 ${media.length} 張。`, media }])
        } else {
          if (typeof result.audio !== 'string' || !result.audio) throw new Error('Gemini-Web 沒有回傳音訊，請調整描述後再試一次。')
          const mime = typeof result.mime === 'string' && result.mime.startsWith('audio/') ? result.mime : 'audio/mpeg'
          const extension = mime === 'audio/wav' ? 'wav' : mime === 'audio/mp4' ? 'm4a' : 'mp3'
          setMessages((current) => [...current, {
            role: 'model',
            text: '音樂生成完成。',
            media: [{ type: 'audio', src: asDataUrl(result.audio as string, mime), filename: `mori-music.${extension}` }],
          }])
        }
      }
      setTransientActivity('done', 1800)
    } catch (error) {
      const message = error instanceof TypeError
        ? '無法連線到 Gemini-Web。請確認 Base URL、API Key，以及服務是否允許這個網站跨來源連線。'
        : error instanceof Error ? error.message : '連線發生問題，請稍後再試。'
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
  const modeStatus = composerMode === 'image' ? '正在生成圖片…' : composerMode === 'music' ? '正在創作音樂…' : '正在思考…'
  const composerPlaceholder = composerMode === 'image'
    ? '描述想生成的圖片…'
    : composerMode === 'music' ? '描述想生成的音樂…' : '跟 Mori 說說話…'
  const modeHint = composerMode === 'chat'
    ? '對話經 Live Demo 後端傳送；直接說「畫你的自拍照」或「你唱一首歌」會切換到對應功能。'
    : composerMode === 'image'
      ? '輸入「畫你的自拍照」會附上 Mori 立繪作為角色參考。'
      : '輸入「Mori 唱一首歌」會套用女聲、繁體中文歌詞與森林民謠設定。'

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
                <span>{composerMode === 'chat' ? '聊天 · 新聞 · 天氣' : composerMode === 'image' ? 'Gemini-Web 生圖' : 'Gemini-Web 音樂'}</span>
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
                  {connection.apiKey.trim() ? 'API Key 已儲存；可使用聊天、生圖與音樂' : '填入測試用 API Key 後即可使用聊天、生圖與音樂'}
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
                    設定與聊天記錄（含生成圖片、音訊）儲存在這個瀏覽器。聊天經 Live Demo 後端轉送；生圖與音樂會由瀏覽器直接帶 API Key 呼叫 Gemini-Web。
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

                <div className="pointer-events-auto space-y-3 border-t border-stone-200 pt-3">
                  <div>
                    <h3 className="text-[11px] font-semibold text-stone-800">Mori 語音回覆｜Larch-TTS</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-stone-500">選一種女聲後按「試聽」比較；未填 API Key 時播放預錄試聽檔，填入後會即時試聽。回覆泡泡的播放鍵使用目前選擇並即時配音；設定留在這個瀏覽器，TTS 請求會經 Studio 轉送。回覆配音未設定 URL 或 API Key 時，Mori 會播放 error 動作。</p>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium text-stone-700">Larch-TTS Base URL</span>
                    <input
                      type="url"
                      value={ttsSettings.baseUrl}
                      onChange={(event) => {
                        const baseUrl = event.currentTarget.value
                        setTtsSettings((current) => ({ ...current, baseUrl }))
                      }}
                      placeholder={LARCH_TTS_DEFAULT_BASE_URL}
                      autoComplete="url"
                      spellCheck={false}
                      className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium text-stone-700">Larch-TTS API Key</span>
                    <span className="flex h-9 overflow-hidden rounded-lg border border-stone-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                      <input
                        type={showTtsApiKey ? 'text' : 'password'}
                        value={ttsSettings.apiKey}
                        onChange={(event) => {
                          const apiKey = event.currentTarget.value
                          setTtsSettings((current) => ({ ...current, apiKey }))
                        }}
                        placeholder="貼上 Larch-TTS API Key"
                        autoComplete="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 bg-transparent px-3 text-xs text-stone-800 outline-none placeholder:text-stone-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTtsApiKey((visible) => !visible)}
                        aria-label={showTtsApiKey ? '隱藏 Larch-TTS API Key' : '顯示 Larch-TTS API Key'}
                        className="flex w-10 shrink-0 items-center justify-center text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                      >
                        {showTtsApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </span>
                  </label>

                  <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 space-y-1.5">
                      <span className="text-[11px] font-medium text-stone-700">Mori 女聲</span>
                      <select
                        value={ttsSettings.voice}
                        onChange={(event) => {
                          const voice = event.currentTarget.value
                          stopTtsPlayback()
                          setTtsSettings((current) => ({ ...current, voice }))
                        }}
                        disabled={Boolean(loadingTtsKey)}
                        className="h-9 w-full rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {TTS_VOICE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}｜{option.hint}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void playVoicePreview()}
                      disabled={Boolean(loadingTtsKey) || activity === 'thinking' || activity === 'recording'}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingTtsKey === (ttsSettings.apiKey.trim() ? speechCacheKey(ttsSettings.voice, cleanSpeechText(TTS_PREVIEW_TEXT)) : `preview:${ttsSettings.voice}`)
                        ? <LoaderCircle size={13} className="animate-spin" />
                        : playingTtsKey === (ttsSettings.apiKey.trim() ? speechCacheKey(ttsSettings.voice, cleanSpeechText(TTS_PREVIEW_TEXT)) : `preview:${ttsSettings.voice}`)
                          ? <Square size={12} />
                          : <Volume2 size={14} />}
                      試聽
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        stopTtsPlayback()
                        setTtsSettings(DEFAULT_TTS_SETTINGS)
                        setShowTtsApiKey(false)
                        setVoiceError('')
                      }}
                      className="rounded-md px-2 py-1 text-[10px] font-medium text-stone-500 transition-colors hover:bg-white hover:text-stone-800"
                    >
                      清除 Larch-TTS 設定
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="pointer-events-none min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent px-4 py-4 sm:px-6 sm:py-6" aria-live="polite" aria-label="對話內容">
            {messages.map((message, index) => {
              const cleanedText = message.role === 'model' ? cleanSpeechText(message.text) : ''
              const messageTtsKey = speechCacheKey(ttsSettings.voice, cleanedText)
              return (
              <div key={`${index}-${message.role}`} className={`flex min-w-0 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`pointer-events-auto min-w-0 w-fit max-w-[96%] rounded-2xl ${message.role === 'user' ? 'whitespace-pre-wrap rounded-tr-md bg-emerald-700 text-white' : 'rounded-tl-md border border-stone-200 bg-white text-stone-800 shadow-sm'} break-words [overflow-wrap:anywhere] px-4 py-3 text-sm leading-6`}>
                  {message.role === 'model' ? renderAssistantMarkdown(message.text) : message.text}
                  {message.role === 'model' && (
                    <button
                      type="button"
                      onClick={() => void playTts(message.text)}
                      disabled={Boolean(loadingTtsKey) || activity === 'thinking' || activity === 'recording'}
                      aria-label={playingTtsKey === messageTtsKey ? '停止 Mori 語音播放' : '播放 Mori 語音回覆'}
                      className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingTtsKey === messageTtsKey
                        ? <LoaderCircle size={13} className="animate-spin" />
                        : playingTtsKey === messageTtsKey
                          ? <Square size={11} />
                          : <Volume2 size={14} />}
                      {loadingTtsKey === messageTtsKey ? '正在準備語音…' : playingTtsKey === messageTtsKey ? '停止播放' : '播放語音'}
                    </button>
                  )}
                  {message.media?.map((media, mediaIndex) => (
                    <div key={`${media.filename}-${mediaIndex}`} className="mt-3 space-y-2">
                      {media.type === 'image' ? (
                        <img src={media.src} alt="Mori 生成的圖片" className="max-h-[min(60vh,32rem)] max-w-full rounded-xl border border-stone-200 object-contain" />
                      ) : (
                        <audio controls preload="metadata" src={media.src} className="max-w-full" aria-label="Mori 生成的音樂" />
                      )}
                      <a href={media.src} download={media.filename} className="pointer-events-auto inline-flex rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200">
                        下載{media.type === 'image' ? '圖片' : '音樂'}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
            {activity === 'thinking' && (
              <div className="flex justify-start">
                <div className="pointer-events-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-500 shadow-sm">
                  <LoaderCircle size={14} className="animate-spin" /> Mori {modeStatus}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="pointer-events-none shrink-0 border-t border-stone-100 bg-white/90 p-3 sm:p-4" onSubmit={(event) => void sendMessage(event)}>
            <div role="group" aria-label="選擇 Mori 功能" className="pointer-events-none mb-2 flex gap-1.5">
              {([
                { id: 'chat', label: '聊天', Icon: MessageCircle },
                { id: 'image', label: '生圖', Icon: ImagePlus },
                { id: 'music', label: '音樂', Icon: Music2 },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setComposerMode(id)}
                  disabled={activity === 'thinking'}
                  aria-pressed={composerMode === id}
                  className={`pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${composerMode === id ? 'bg-emerald-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  <Icon size={14} strokeWidth={1.8} />{label}
                </button>
              ))}
            </div>
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
                aria-label={composerPlaceholder}
                placeholder={composerPlaceholder}
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
                disabled={!messagesReady || !draft.trim() || activity === 'thinking'}
                aria-label={composerMode === 'chat' ? '送出訊息' : composerMode === 'image' ? '生成圖片' : '生成音樂'}
                className="pointer-events-auto mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-stone-400">
              <span className={voiceError ? 'text-rose-600' : ''} role={voiceError ? 'alert' : undefined}>
                {voiceError || (!voiceSupported ? '此瀏覽器不支援語音輸入，請使用 Chrome 或 Edge。' : modeHint)}
              </span>
              <span className="shrink-0">{draft.length}/1500</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
