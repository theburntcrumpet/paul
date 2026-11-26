import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router'
import { api } from '../api/client'
import { NAV_ITEMS } from './nav'

/**
 * Responsive application frame: a sidebar on desktop (md and up) and a bottom navigation bar
 * on mobile. Page content renders in the outlet.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside
        aria-label="Primary"
        className="hidden w-56 shrink-0 flex-col border-r border-line px-4 py-6 md:flex"
      >
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-line font-medium' : 'text-muted hover:bg-line/60'
                }`
              }
            >
              <span aria-hidden="true" className="mr-2">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <ServerStatus />
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
        <Brand />
        <ServerStatus />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav
        aria-label="Mobile"
        className="grid grid-cols-2 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center text-xs ${
                isActive ? 'font-medium text-accent' : 'text-muted'
              }`
            }
          >
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Brand() {
  return <span className="font-serif text-2xl tracking-tight">Paul</span>
}

export function ServerStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 60_000,
  })

  let dot = 'bg-amber-500'
  let label = 'Connecting…'
  if (isError) {
    dot = 'bg-red-600'
    label = 'Offline'
  } else if (!isPending && data) {
    dot = 'bg-emerald-600'
    label = `v${data.version}`
  }

  return (
    <span role="status" className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
