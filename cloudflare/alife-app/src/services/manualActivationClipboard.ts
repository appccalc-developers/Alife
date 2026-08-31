type ClipboardWriter = {
  writeText: (value: string) => Promise<void>
}

export const writeManualActivationClipboard = async (
  value: string,
  clipboard: ClipboardWriter | null | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard,
) => {
  if (!clipboard?.writeText) return false
  try {
    await clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
