import { useAppStore } from '@/store'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ChromaKeyName, ChromaTolerance } from '@/types/chroma'
import { chromaInfo, isValidChromaRgb, parseChromaHex } from '@/lib/colorUtils'

const CHROMA_OPTIONS: Array<{ key: ChromaKeyName; label: string; hex: string }> = [
  { key: 'green', label: '綠', hex: '00FF00' },
  { key: 'magenta', label: '洋紅', hex: 'FF00FF' },
  { key: 'blue', label: '藍', hex: '0000FF' },
  { key: 'cyan', label: '青', hex: '00FFFF' },
  { key: 'yellow', label: '黃', hex: 'FFFF00' },
]

export function ChromaConfig() {
  const chroma = useAppStore((s) => s.chroma)
  const set = useAppStore((s) => s.setChroma)
  const selectedColor = chromaInfo(chroma)

  function changeCustomColor(hexWithHash: string) {
    const rgb = parseChromaHex(hexWithHash)
    if (!rgb || !isValidChromaRgb(rgb)) return
    set({ customHex: hexWithHash.slice(1).toUpperCase() })
  }

  return (
    <div className="space-y-3 w-full max-w-md">
      <div className="space-y-2">
        <Label className="text-sm">Chroma key 顏色</Label>
        <RadioGroup
          value={chroma.key}
          onValueChange={(v) => set({ key: v as ChromaKeyName })}
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {CHROMA_OPTIONS.map((option) => (
            <div className="flex items-center gap-2" key={option.key}>
              <RadioGroupItem value={option.key} id={`chroma-${option.key}`} />
              <Label htmlFor={`chroma-${option.key}`}>
                <span
                  className="inline-block w-4 h-4 mr-1 border border-border align-middle"
                  style={{ backgroundColor: `#${option.hex}` }}
                />
                {option.label}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="chroma-custom" />
            <Label htmlFor="chroma-custom">
              <span
                className="inline-block w-4 h-4 mr-1 border border-border align-middle"
                style={{ backgroundColor: `#${selectedColor.hex}` }}
              />
              自訂色
            </Label>
          </div>
        </RadioGroup>
        {chroma.key === 'custom' && (
          <div className="flex items-center gap-3 pt-1">
            <Input
              type="color"
              value={`#${selectedColor.hex}`}
              aria-label="自訂去背色幕"
              onChange={(e) => changeCustomColor(e.target.value)}
              className="h-9 w-12 cursor-pointer p-1"
            />
            <span className="font-mono text-xs">#{selectedColor.hex}</span>
          </div>
        )}
        <p className="text-xs text-slate-500">
          每次選一種色幕；角色含相近顏色時請改選其他色，避免角色區域一起透明。自訂色請選高彩度顏色，避開黑、白、灰。
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-3">
        <Label className="text-sm">Tolerance</Label>
        <Select
          value={chroma.tolerance}
          onValueChange={(v) => set({ tolerance: v as ChromaTolerance })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">conservative（保守，較多保留近似色）</SelectItem>
            <SelectItem value="balanced">balanced（預設，平衡）</SelectItem>
            <SelectItem value="aggressive">aggressive（積極，可能誤刪角色顏色）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-start gap-3 pt-1">
        <Label className="text-sm pt-2">Edge erosion</Label>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <Input
              type="range" min={0} max={10} step={1}
              value={chroma.edgeErosionPx}
              onChange={(e) => set({ edgeErosionPx: parseInt(e.target.value, 10) })}
              className="accent-emerald-600 flex-1"
            />
            <span className="text-sm font-mono tabular-nums w-12 text-right">
              {chroma.edgeErosionPx} px
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            去背後再把每格外圍 N 像素設為透明，清除殘留色邊。預設 2 px；色幕光暈明顯時可調高至 3-5 px。0 = 關閉。
          </p>
        </div>
      </div>
    </div>
  )
}
