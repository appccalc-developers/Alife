import { useEffect } from 'react'
import { pwaSyncService, type ApiUpdateMessage } from '../services/pwaSyncService'

export function useApiUpdates(onUpdate: (message: ApiUpdateMessage) => void) {
  useEffect(() => pwaSyncService.listen(onUpdate), [onUpdate])
}
