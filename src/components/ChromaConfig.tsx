import { useAppStore } from '@/store'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ChromaKeyName, ChromaTolerance } from '@/types/chroma'

export function ChromaConfig() {
  const chroma = useAppStore((s) => s.chroma)
  const set = useAppStore((s) => s.setChroma)

  return (
    <div className="space-y-3 max-w-md">
      <div className="space-y-2">
        <Label className="text-sm">Chroma key 顏色</Label>
        <RadioGroup
          value={chroma.key}
          onValueChange={(v) => set({ key: v as ChromaKeyName })}
          className="flex gap-4"
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

      <div className="grid grid-cols-[100px_1fr] items-center gap-3">
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
    </div>
  )
}
