import { useState, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '../../stores/auth'
import { getCopy, type Language } from './homeCopy'

type GuardedLinkProps = {
  language: Language
  to: string
  className?: string
  children: ReactNode
  onBeforeNavigate?: () => void
}

const GuardedLink = ({ language, to, className, children, onBeforeNavigate }: GuardedLinkProps) => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const copy = getCopy(language, '')

  const handleClick = useCallback(() => {
    if (auth.isGuest) {
      setOpen(true)
    } else {
      onBeforeNavigate?.()
      navigate(to)
    }
  }, [auth.isGuest, navigate, to, onBeforeNavigate])

  return (
    <>
      <button type="button" className={className} onClick={handleClick}>
        {children}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-home-green/10 text-home-green">
                  <LogIn className="h-5 w-5" />
                </div>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg text-home-muted transition hover:bg-home-border/40"
                  onClick={() => setOpen(false)}
                  aria-label={copy.loginPromptCloseAria}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-4 text-lg font-bold text-home-dark">{copy.loginPromptTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-home-muted">{copy.loginPromptBody}</p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-home-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover"
                  onClick={() => {
                    setOpen(false)
                    navigate('/onboarding')
                  }}
                >
                  {copy.loginPromptLogin}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-home-border px-4 py-2.5 text-sm font-semibold text-home-muted transition hover:bg-home-border/30"
                  onClick={() => setOpen(false)}
                >
                  {copy.loginPromptCancel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export default GuardedLink
