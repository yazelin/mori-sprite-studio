import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProviderName } from '@/types/provider'

const PROVIDER_LABELS: Record<ProviderName, string> = {
  'google-gemini':   'Google Gemini Direct (AI Studio)',
  'codex-image':     'Codex-Image (ChatGPT 訂閱)',
  'vertex-gemini':   'Vertex Gemini (Google Cloud)',
}

const ORDER: ProviderName[] = ['google-gemini', 'codex-image', 'vertex-gemini']

export function ProviderConfig() {
  const provider = useAppStore((s) => s.provider)
  const setActive = useAppStore((s) => s.setProviderActive)
  const update = useAppStore((s) => s.updateProviderConfig)

  return (
    <div className="space-y-4 w-full max-w-xl">
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
                        onValueChange={(v) => update('codexImage', { quality: v as 'low' | 'medium' | 'high' | 'auto' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">auto(預設,讓 service 自動選)</SelectItem>
                          <SelectItem value="low">low(快,省 quota)</SelectItem>
                          <SelectItem value="medium">medium</SelectItem>
                          <SelectItem value="high">high(慢,品質最好)</SelectItem>
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
                    {name === 'google-gemini' && (
                      <Field label="Base URL(選填,GenAI 相容 gateway)">
                        <Input
                          value={provider.googleGemini.baseUrl ?? ''}
                          onChange={(e) => update('googleGemini', { baseUrl: e.target.value })}
                          placeholder="https://generativelanguage.googleapis.com"
                        />
                      </Field>
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
    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-3">
      <Label className="text-xs text-slate-600">{label}</Label>
      <div>{children}</div>
    </div>
  )
}
