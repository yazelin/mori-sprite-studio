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
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>使用 yazelin 的 API key(server-side env var,你不用設定)。我自掏腰包暫時開放給大家試用。</p>
                    <p className="text-amber-700">
                      ⚠ 每 IP 每日上限 100 次 · 同時並行 1 張。
                      <br />
                      **錢花完就會關掉**,不是長期承諾,只是讓陌生人也能試一下這個工具。如果你會大量用,建議切其他 provider 自帶 key。
                    </p>
                    <p>
                      想讓它繼續開著?{' '}
                      <a
                        href="https://buymeacoffee.com/yazelin"
                        target="_blank" rel="noreferrer"
                        className="underline text-emerald-700 hover:text-emerald-800"
                      >
                        ☕ buymeacoffee.com/yazelin
                      </a>{' '}
                      補一點咖啡錢,我才能繼續把 quota 加進來。
                    </p>
                  </div>
                )}
                {name === 'codex-image' && (
                  <>
                    <p className="text-xs text-slate-600">
                      呼叫{' '}
                      <a
                        href="https://github.com/yazelin/codex-image-service"
                        target="_blank" rel="noreferrer"
                        className="underline text-emerald-700 hover:text-emerald-800"
                      >
                        yazelin/codex-image-service
                      </a>
                      {' '}建立的 endpoint。這個 service 是把你的 ChatGPT Plus / Pro 訂閱包成 image generation API,讓你**用 ChatGPT 訂閱 quota 跑 gpt-image-2**,不必另外買 OpenAI API credit。需 self-host 該 service,Base URL 填你部署的地址(例:Vercel / Render / 自家伺服器)。
                    </p>
                    <Field label="Base URL">
                      <Input
                        value={provider.codexImage.baseUrl}
                        onChange={(e) => update('codexImage', { baseUrl: e.target.value })}
                        placeholder="https://your-codex-image-service.vercel.app"
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
                    {name === 'vertex-gemini' && (
                      <p className="text-xs text-slate-600">
                        Vertex AI Express key,於{' '}
                        <a
                          href="https://console.cloud.google.com/vertex-ai/express"
                          target="_blank" rel="noreferrer"
                          className="underline text-emerald-700"
                        >
                          console.cloud.google.com/vertex-ai/express
                        </a>{' '}
                        建立。免費試用 quota 通常夠跑 30-50 張圖。
                      </p>
                    )}
                    {name === 'google-gemini' && (
                      <p className="text-xs text-slate-600">
                        AI Studio key,於{' '}
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank" rel="noreferrer"
                          className="underline text-emerald-700"
                        >
                          aistudio.google.com/apikey
                        </a>{' '}
                        建立。免費 tier 有 daily req 上限。
                      </p>
                    )}
                    <Field label="API Key">
                      <Input
                        type="password"
                        value={provider[name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini'].apiKey}
                        onChange={(e) => update(
                          name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini',
                          { apiKey: e.target.value },
                        )}
                        placeholder={name === 'vertex-gemini' ? 'AQ.AAAA...' : 'AIza...'}
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
