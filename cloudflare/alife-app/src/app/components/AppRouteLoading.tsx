import { motion } from 'framer-motion'
import { useUiText } from '../../i18n/uiText'

const AppRouteLoading = () => {
  const t = useUiText()

  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="alife-panel rounded-2xl p-4 text-sm text-[#66766f]"
    >
      {t('loadingIdentity')}
    </motion.p>
  )
}

export default AppRouteLoading
