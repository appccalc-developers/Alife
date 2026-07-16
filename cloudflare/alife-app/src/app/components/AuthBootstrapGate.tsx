import { useEffect, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { isAuthOptionalLocation } from '../routing/publicRoutePolicy'
import AppRouteLoading from './AppRouteLoading'

const AuthBootstrapGate = ({ children }: PropsWithChildren) => {
  const auth = useAuthStore()
  const location = useLocation()
  const authOptional = isAuthOptionalLocation(location)

  useEffect(() => {
    if (authOptional || auth.initialized || auth.loading) {
      return
    }

    auth.bootstrap().catch(() => undefined)
  }, [auth.bootstrap, auth.initialized, auth.loading, authOptional])

  if (!authOptional && !auth.initialized) {
    return <AppRouteLoading />
  }

  return children
}

export default AuthBootstrapGate
