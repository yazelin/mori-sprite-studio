export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadReferences(
  refs: { name: string; blob: Blob }[],
): void {
  for (const { name, blob } of refs) {
    downloadBlob(blob, name)
  }
}
