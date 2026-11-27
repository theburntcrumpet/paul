import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { FullPageMessage } from '../auth/RequireAuth'
import { useChangePassword, useLogout, useMe } from '../auth/useAuth'
import { Button, Field, FormError } from '../components/forms'
import { AuthLayout } from './LoginPage'

export const MIN_PASSWORD_LENGTH = 8

/**
 * Change your own password. Users with an initial or reset password are sent here and cannot
 * use anything else until they've chosen a new one.
 */
export function ChangePasswordPage() {
  const { data: me, isPending } = useMe()
  const change = useChangePassword()
  const logout = useLogout()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (!me) return <Navigate to="/login" replace />

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current && next.length >= MIN_PASSWORD_LENGTH && next === confirm

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit) return
    change.mutate(
      { currentPassword: current, newPassword: next },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  const serverError = change.error instanceof ApiError ? change.error : undefined
  const forced = me.mustChangePassword

  return (
    <AuthLayout title={forced ? 'Choose a new password' : 'Change password'}>
      {forced && (
        <p className="mb-4 text-sm text-muted">
          Signed in as <strong className="text-ink">{me.username}</strong>. You need to replace your
          temporary password before you can continue.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>
          {serverError && serverError.code !== 'WRONG_PASSWORD' ? serverError.message : undefined}
        </FormError>
        <Field
          label={forced ? 'Temporary password' : 'Current password'}
          name="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={serverError?.code === 'WRONG_PASSWORD' ? serverError.message : undefined}
        />
        <Field
          label="New password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={
            tooShort || (submitted && next.length < MIN_PASSWORD_LENGTH)
              ? `At least ${MIN_PASSWORD_LENGTH} characters`
              : undefined
          }
        />
        <Field
          label="Confirm new password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? 'Passwords don’t match' : undefined}
        />
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Saving…' : 'Save new password'}
        </Button>
        {forced ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
          >
            Sign out
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
