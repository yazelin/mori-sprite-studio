import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function MetadataForm() {
  const metadata = useAppStore((s) => s.project.metadata)
  const update = useAppStore((s) => s.updateMetadata)

  return (
    <div className="space-y-3 w-full max-w-md">
      <Row label="package_name">
        <Input
          value={metadata.packageName}
          onChange={(e) => update({ packageName: e.target.value })}
          placeholder="mori"
        />
      </Row>
      <Row label="display_name">
        <Input
          value={metadata.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          placeholder="Mori"
        />
      </Row>
      <Row label="version">
        <Input
          value={metadata.version}
          onChange={(e) => update({ version: e.target.value })}
          placeholder="1.0.0"
        />
      </Row>
      <Row label="author">
        <Input
          value={metadata.author}
          onChange={(e) => update({ author: e.target.value })}
        />
      </Row>
      <Row label="license">
        <Input
          value={metadata.license}
          onChange={(e) => update({ license: e.target.value })}
        />
      </Row>
      <Row label="description">
        <Textarea
          value={metadata.description}
          onChange={(e) => update({ description: e.target.value })}
          rows={2}
        />
      </Row>
      <Row label="tags (comma-separated)">
        <Input
          value={metadata.tags.join(', ')}
          onChange={(e) => update({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
        />
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-3">
      <Label className="text-sm text-slate-600">{label}</Label>
      <div>{children}</div>
    </div>
  )
}
