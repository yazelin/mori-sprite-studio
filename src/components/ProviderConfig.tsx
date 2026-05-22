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
                  <p className="text-xs text-slate-600">
                    使用作者的 API key(server-side env var)。免設定。MVP 無 rate limit。
                  </p>
                )}
                {name === 'codex-image' && (
                  <>
                    <Field label="Base URL">
                      <Input
                        value={provider.codexImage.baseUrl}
                        onChange={(e) => update('codexImage', { baseUrl: e.target.value })}
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
                    <Field label="API Key">
                      <Input
                        type="password"
                        value={provider[name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini'].apiKey}
                        onChange={(e) => update(
                          name === 'vertex-gemini' ? 'vertexGemini' : 'googleGemini',
                          { apiKey: e.target.value },
                        )}
                        placeholder="AIza..."
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
