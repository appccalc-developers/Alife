import { useEffect, useRef, useState } from 'react'
import {
  VIRTUAL_CHURCH_DIALOG_FOCUSABLE_SELECTOR,
  virtualChurchDialogTabDestination,
} from './virtualChurchAccessibilityContract'

// The full-screen scene lives beside #root in a body portal. Its dialogs only
// isolate scene-local siblings, so the covered app shell needs a separate lease.
export const useVirtualChurchPageIsolation = () => {
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page?.parentElement) return
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const backgroundElements = [...page.parentElement.children]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== page)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }))

    // Move focus before hiding its former ancestor from assistive technology.
    if (!page.contains(document.activeElement)) page.focus({ preventScroll: true })
    backgroundElements.forEach(({ element }) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    return () => {
      backgroundElements.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return pageRef
}

export const useVirtualChurchDialogFocus = (onClose: () => void) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const modalLayer = dialog.parentElement
    const modalRoot = modalLayer?.parentElement
    const backgroundElements = modalRoot
      ? [...modalRoot.children]
        .filter((element): element is HTMLElement => (
          element instanceof HTMLElement && element !== modalLayer
        ))
        .map((element) => ({
          element,
          inert: element.inert,
          ariaHidden: element.getAttribute('aria-hidden'),
        }))
      : []
    backgroundElements.forEach(({ element }) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    const focusableElements = () => [
      ...dialog.querySelectorAll<HTMLElement>(
        VIRTUAL_CHURCH_DIALOG_FOCUSABLE_SELECTOR,
      ),
    ].filter(
      (element) => (
        element.getAttribute('aria-hidden') !== 'true'
        && !element.hasAttribute('disabled')
      ),
    )

    const focusFrame = window.requestAnimationFrame(() => {
      const autofocusTarget = dialog.querySelector<HTMLElement>('[data-autofocus]')
      const target = autofocusTarget ?? focusableElements()[0] ?? dialog
      target.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = focusableElements()
      const currentIndex = focusables.indexOf(
        document.activeElement as HTMLElement,
      )
      const targetIndex = virtualChurchDialogTabDestination(
        focusables.length,
        currentIndex,
        event.shiftKey,
      )
      if (targetIndex === null) return

      event.preventDefault()
      ;(focusables[targetIndex] ?? dialog).focus()
    }

    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      dialog.removeEventListener('keydown', onKeyDown)
      backgroundElements.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return dialogRef
}

export const useVirtualChurchReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}
