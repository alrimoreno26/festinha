/** Dispara o download de uma URL (assinada do R2 no real; blob no mock). */
export function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
