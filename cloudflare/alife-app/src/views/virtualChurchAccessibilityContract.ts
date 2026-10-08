export const VIRTUAL_CHURCH_DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export const virtualChurchDialogTabDestination = (
  focusableCount: number,
  currentIndex: number,
  backwards: boolean,
) => {
  if (focusableCount <= 0) return null
  if (currentIndex < 0) return backwards ? focusableCount - 1 : 0
  if (backwards && currentIndex === 0) return focusableCount - 1
  if (!backwards && currentIndex === focusableCount - 1) return 0
  return null
}
