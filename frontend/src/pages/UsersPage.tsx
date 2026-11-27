import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError, type UserSummary } from '../api/client'
import { MIN_PASSWORD_LENGTH } from '../auth/passwords'
import { useMe } from '../auth/useAuth'
import { Button, Field, FormError } from '../components/forms'

const USERS_KEY = ['users'] as const

/** Lists users, adds new ones and resets passwords. Everyone can see all books. */
export function UsersPage() {
  const { data: me } = useMe()
  const users = useQuery({ queryKey: USERS_KEY, queryFn: api.users.list })

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <Link to="/settings" className="text-sm text-accent hover:underline">
        ← Settings
      </Link>
      <h1 className="mt-2 font-serif text-3xl">Users</h1>
      <p className="mt-2 text-muted">
        Everyone here can open and edit every book. New users choose their own password the first
        time they sign in.
      </p>

      <AddUserForm />

      <h2 className="mt-10 text-sm font-medium tracking-wide text-muted uppercase">All users</h2>
      {users.isPending && <p className="mt-3 text-muted">Loading…</p>}
      {users.isError && <FormError>Couldn’t load users: {users.error.message}</FormError>}
      {users.data && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {users.data.map((user) => (
            <UserRow key={user.id} user={user} isMe={user.username === me?.username} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AddUserForm() {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState<string>()
  const create = useMutation({
    mutationFn: () => api.users.create(username, password),
    onSuccess: (user) => {
      setCreated(user.username)
      setUsername('')
      setPassword('')
      void queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
  const error = create.error instanceof ApiError ? create.error : undefined

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setCreated(undefined)
    create.mutate()
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Add user"
      className="mt-6 flex flex-col gap-4 rounded-lg border border-line p-4"
      noValidate
    >
      <h2 className="text-lg font-medium">Add a user</h2>
      {created && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Added <strong>{created}</strong>. Give them the temporary password; they’ll be asked to
          change it.
        </p>
      )}
      <FormError>
        {error &&
        !['INVALID_USERNAME', 'USERNAME_TAKEN', 'INVALID_PASSWORD'].includes(error.code ?? '')
          ? error.message
          : undefined}
      </FormError>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Username"
          name="new-username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={
            error?.code === 'INVALID_USERNAME' || error?.code === 'USERNAME_TAKEN'
              ? error.message
              : undefined
          }
        />
        <Field
          label="Temporary password"
          name="new-user-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.code === 'INVALID_PASSWORD' ? error.message : undefined}
        />
      </div>
      <div>
        <Button
          type="submit"
          disabled={create.isPending || !username || password.length < MIN_PASSWORD_LENGTH}
        >
          {create.isPending ? 'Adding…' : 'Add user'}
        </Button>
      </div>
    </form>
  )
}

function UserRow({ user, isMe }: { user: UserSummary; isMe: boolean }) {
  const queryClient = useQueryClient()
  const [resetting, setResetting] = useState(false)
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: () => api.users.resetPassword(user.id, password),
    onSuccess: () => {
      setResetting(false)
      setPassword('')
      void queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
  })

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{user.username}</span>
          {isMe && <span className="ml-2 text-sm text-muted">(you)</span>}
          {user.mustChangePassword && (
            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
              Temporary password
            </span>
          )}
        </div>
        {!isMe && !resetting && (
          <Button variant="secondary" onClick={() => setResetting(true)}>
            Reset password
          </Button>
        )}
      </div>
      {resetting && (
        <form
          aria-label={`Reset password for ${user.username}`}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            reset.mutate()
          }}
          noValidate
        >
          <div className="flex-1">
            <Field
              label="New temporary password"
              name={`reset-${user.id}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={reset.error instanceof ApiError ? reset.error.message : undefined}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={reset.isPending || password.length < MIN_PASSWORD_LENGTH}
            >
              {reset.isPending ? 'Saving…' : 'Set password'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setResetting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {resetting && (
        <p className="text-sm text-muted">
          {user.username} will be signed out on every device and asked to choose a new password.
        </p>
      )}
    </li>
  )
}
