import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { safeNext } from '../auth/redirect'
import { useLogin, useMe } from '../auth/useAuth'
import { Button, Field, FormError } from '../components/forms'

export function LoginPage() {
  const { data: me } = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (me) {
    return <Navigate to={me.mustChangePassword ? '/change-password' : next} replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate(
      { username, password },
      {
        onSuccess: (user) =>
          navigate(user.mustChangePassword ? '/change-password' : next, { replace: true }),
      },
    )
  }

  const error =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Something went wrong. Please try again.'
        : undefined

  return (
    <AuthLayout title="Sign in">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{error}</FormError>
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={login.isPending || !username || !password}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center font-serif text-4xl">Paul</p>
        <h1 className="mt-6 mb-6 text-center text-lg text-muted">{title}</h1>
        {children}
      </div>
    </main>
  )
}
