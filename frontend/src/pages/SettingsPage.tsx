import { Link, useNavigate } from 'react-router'
import { useLogout, useMe } from '../auth/useAuth'
import { Button } from '../components/forms'

export function SettingsPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl">Settings</h1>

      <h2 className="mt-8 text-sm font-medium tracking-wide text-muted uppercase">Account</h2>
      <div className="mt-3 flex flex-col gap-4 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Signed in as <strong>{me?.username}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/change-password"
            className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-line/60"
          >
            Change password
          </Link>
          <Button
            variant="secondary"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </section>
  )
}
