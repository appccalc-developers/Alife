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
    title={missing ? (zh ? '小组不存在或已解散' : 'Group not found or dissolved') : (zh ? '无法加载小组' : 'Unable to load group')}
    description={missing ? (zh ? '请返回小组生活查看当前可用的小组。' : 'Return to Group Life to find available groups.') : (zh ? '请稍后重试。' : 'Please try again.')}
    actionLabel={missing ? (zh ? '返回小组生活' : 'Back to Group Life') : (zh ? '重试' : 'Retry')}
    onAction={missing ? () => navigate('/groups') : retry}
  />
}
