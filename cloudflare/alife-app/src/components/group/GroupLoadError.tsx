import { groupLoadErrorText } from '../../i18n/groupLoadError.ts'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { isNotFound } from '../../db/httpError'
import AppEmptyState from '../layout/AppEmptyState'

export default function GroupLoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  const { language } = useAuthStore()
  const navigate = useNavigate()
  const zh = language === 'zh'
  const missing = isNotFound(error)
  return <AppEmptyState
    title={missing ? (zh ? groupLoadErrorText.groupNotFoundOrDissolved.zh : groupLoadErrorText.groupNotFoundOrDissolved.en) : (zh ? groupLoadErrorText.unableToLoadGroup.zh : groupLoadErrorText.unableToLoadGroup.en)}
    description={missing ? (zh ? groupLoadErrorText.returnToGroupLifeToFindAvailableGroups.zh : groupLoadErrorText.returnToGroupLifeToFindAvailableGroups.en) : (zh ? groupLoadErrorText.pleaseTryAgain.zh : groupLoadErrorText.pleaseTryAgain.en)}
    actionLabel={missing ? (zh ? groupLoadErrorText.backToGroupLife.zh : groupLoadErrorText.backToGroupLife.en) : (zh ? groupLoadErrorText.retry.zh : groupLoadErrorText.retry.en)}
    onAction={missing ? () => navigate('/groups') : retry}
  />
}
