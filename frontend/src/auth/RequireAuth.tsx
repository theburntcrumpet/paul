import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from './useAuth'

/**
 * Route guard. Signed-out users go to /login (remembering where they were heading); users who
 * must replace an initial or reset password go to /change-password.
 */
export function RequireAuth() {
  const { data: me, isPending, isError } = useMe()
  const location = useLocation()

  if (isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>
  }
  if (isError) {
    return <FullPageMessage>Can’t reach the server. Retrying…</FullPageMessage>
  }
  if (!me) {
    const next = location.pathname + location.search
    return (
      <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
    )
  }
  if (me.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

export function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex h-full items-center justify-center text-muted">
      {children}
    </div>
  )
}
