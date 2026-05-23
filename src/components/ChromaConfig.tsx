import { useAppStore } from '@/store'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ChromaKeyName, ChromaTolerance } from '@/types/chroma'

export function ChromaConfig() {
  const chroma = useAppStore((s) => s.chroma)
  const set = useAppStore((s) => s.setChroma)

  return (
    <div className="space-y-3 w-full max-w-md">
      <div className="space-y-2">
        <Label className="text-sm">Chroma key 顏色</Label>
        <RadioGroup
          value={chroma.key}
          onValueChange={(v) => set({ key: v as ChromaKeyName })}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="green" id="chroma-green" />
            <Label htmlFor="chroma-green">
              <span className="inline-block w-4 h-4 bg-[#00FF00] mr-1 border border-border align-middle" />
              綠 #00FF00
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="magenta" id="chroma-magenta" />
            <Label htmlFor="chroma-magenta">
              <span className="inline-block w-4 h-4 bg-[#FF00FF] mr-1 border border-border align-middle" />
              洋紅 #FF00FF
            </Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-slate-500">角色顏色含此色會被誤刪,擇一避開。</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-3">
        <Label className="text-sm">Tolerance</Label>
        <Select
          value={chroma.tolerance}
          onValueChange={(v) => set({ tolerance: v as ChromaTolerance })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">conservative(留更多 chroma 但邊乾淨)</SelectItem>
            <SelectItem value="balanced">balanced(預設,平衡)</SelectItem>
            <SelectItem value="aggressive">aggressive(吃更多 chroma,可能誤刪角色)</SelectItem>
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
            chroma 後再把每格外圍 N 像素強制透明 — 清掉 tolerance 沒抓乾淨的細邊殘留。預設 2 px;粉/綠光暈嚴重就調高(3-5 px)。0 = 關閉。
          </p>
        </div>
      </div>
    </div>
  )
}
