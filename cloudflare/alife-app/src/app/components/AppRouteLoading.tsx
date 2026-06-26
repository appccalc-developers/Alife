import { motion } from 'framer-motion'

const AppRouteLoading = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
    className="space-y-4 pt-2"
  >
    <div className="h-10 w-48 animate-pulse rounded-xl bg-emerald-100/60" />
    <div className="h-36 animate-pulse rounded-2xl bg-emerald-50/80" />
    <div className="flex gap-3">
      <div className="h-24 flex-1 animate-pulse rounded-2xl bg-emerald-50/60" />
      <div className="h-24 flex-1 animate-pulse rounded-2xl bg-emerald-50/40" />
    </div>
  </motion.div>
)

export default AppRouteLoading
