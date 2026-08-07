import { motion } from 'framer-motion'

const AppRouteLoading = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
    className="space-y-4 pt-2"
  >
    <div className="alife-skeleton h-10 w-48 rounded-[var(--alife-radius-control)]" />
    <div className="alife-skeleton h-36 rounded-[var(--alife-radius-card)]" />
    <div className="flex gap-3">
      <div className="alife-skeleton h-24 flex-1 rounded-[var(--alife-radius-card)]" />
      <div className="alife-skeleton h-24 flex-1 rounded-[var(--alife-radius-card)] opacity-75" />
    </div>
  </motion.div>
)

export default AppRouteLoading
