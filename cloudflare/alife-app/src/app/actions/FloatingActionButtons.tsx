import { motion } from 'framer-motion'
import type { ShellFabItem } from './types'

const toneClass: Record<ShellFabItem['tone'], string> = {
  manage: 'bg-emerald-700 text-white shadow-emerald-950/20 hover:bg-emerald-800 focus:ring-emerald-200',
  edit: 'bg-amber-500 text-slate-950 shadow-amber-900/20 hover:bg-amber-400 focus:ring-amber-200',
  save: 'bg-emerald-600 text-white shadow-emerald-950/25 hover:bg-emerald-700 focus:ring-emerald-200',
  exit: 'bg-white text-slate-700 shadow-slate-950/10 ring-1 ring-slate-200 hover:bg-slate-50 focus:ring-slate-200',
}

const FloatingActionButtons = ({ items }: { items: ShellFabItem[] }) => (
  <div className="fixed bottom-28 right-4 z-40 flex flex-col-reverse items-end gap-2.5 desktop:bottom-7 desktop:right-7">
    {items.map((item, index) => (
      <motion.div
        key={item.label}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 + index * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
      >
        <button
          type="button"
          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition focus:outline-none focus:ring-4 ${toneClass[item.tone]}`}
          aria-label={item.label}
          title={item.label}
          onClick={item.onClick}
        >
          {item.icon}
        </button>
      </motion.div>
    ))}
  </div>
)

export default FloatingActionButtons
