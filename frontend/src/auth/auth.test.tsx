import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../api/client'
import {
  jsonResponse,
  mockApi,
  renderApp,
  sentJson,
  SIGNED_IN,
  signedIn,
  signedOut,
} from '../test/render'
import { createQueryClient } from './queryClient'
import { safeNext } from './redirect'
import { handleAuthError, ME_KEY } from './useAuth'

describe('route guard', () => {
  it('sends signed-out users to the login page', async () => {
    mockApi(signedOut())
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
  })

  it('remembers the deep link to return to', async () => {
    mockApi(signedOut())
    const { router } = renderApp('/settings?tab=users')

    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.search).toBe('?next=%2Fsettings%3Ftab%3Dusers')
  })

  it('shows a retry message when the server is unreachable', async () => {
    mockApi({ 'GET /api/auth/me': () => jsonResponse({ message: 'boom' }, 500) })
    renderApp('/')

    expect(await screen.findByText(/Can’t reach the server/)).toBeInTheDocument()
  })

  it('sends users with a temporary password to change it', async () => {
    mockApi(signedIn({ ...SIGNED_IN, mustChangePassword: true }))
    const { router } = renderApp('/settings')

    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/change-password')
  })
})

describe('login page', () => {
  it('signs in and returns to the requested page', async () => {
    const api = mockApi({
      ...signedOut(),
      'POST /api/auth/login': () => jsonResponse(SIGNED_IN),
    })
    const { router } = renderApp('/settings')

    await userEvent.type(await screen.findByLabelText('Username'), 'writer')
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')
    const loginCall = api.mock.calls.find(([url]) => url === '/api/auth/login')
    expect(sentJson(loginCall?.[1])).toEqual({ username: 'writer', password: 'secret-pass' })
  })

  it('shows the server error for bad credentials', async () => {
    mockApi({
      ...signedOut(),
      'POST /api/auth/login': () =>
        jsonResponse({ code: 'BAD_CREDENTIALS', message: 'Incorrect username or password' }, 401),
    })
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Username'), 'writer')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('disables submit until both fields are filled', async () => {
    mockApi(signedOut())
    renderApp('/login')

    const submit = await screen.findByRole('button', { name: 'Sign in' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Username'), 'writer')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    expect(submit).toBeEnabled()
  })

  it('goes straight to the app when already signed in', async () => {
    mockApi(signedIn())
    renderApp('/login?next=/settings')

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('only follows same-app redirects', () => {
    expect(safeNext('/books/1')).toBe('/books/1')
    expect(safeNext(null)).toBe('/')
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('//evil.example')).toBe('/')
  })
})

describe('change password page', () => {
  const forced = { ...SIGNED_IN, mustChangePassword: true }

  it('lets a user with a temporary password choose a new one', async () => {
    const api = mockApi({
      ...signedIn(forced),
      'POST /api/auth/password': () => jsonResponse(SIGNED_IN),
    })
    const { router } = renderApp('/change-password')

    await userEvent.type(await screen.findByLabelText('Temporary password'), 'admin')
    await userEvent.type(screen.getByLabelText('New password'), 'a-much-better-one')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a-much-better-one')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    const call = api.mock.calls.find(([url]) => url === '/api/auth/password')
    expect(sentJson(call?.[1])).toEqual({
      currentPassword: 'admin',
      newPassword: 'a-much-better-one',
    })
  })

  it('validates length and confirmation before sending', async () => {
    const api = mockApi(signedIn(forced))
    renderApp('/change-password')

    await userEvent.type(await screen.findByLabelText('Temporary password'), 'admin')
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('New password'), '-but-longer')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different')
    expect(screen.getByText('Passwords don’t match')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(api.mock.calls.some(([url]) => url === '/api/auth/password')).toBe(false)
  })

  it('shows a wrong current password against that field', async () => {
    mockApi({
      ...signedIn(forced),
      'POST /api/auth/password': () =>
        jsonResponse({ code: 'WRONG_PASSWORD', message: 'Current password is incorrect' }, 400),
    })
    renderApp('/change-password')

    await userEvent.type(await screen.findByLabelText('Temporary password'), 'nope')
    await userEvent.type(screen.getByLabelText('New password'), 'a-much-better-one')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a-much-better-one')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
    expect(screen.getByLabelText('Temporary password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows other server errors at the top of the form', async () => {
    mockApi({
      ...signedIn(forced),
      'POST /api/auth/password': () =>
        jsonResponse({ code: 'PASSWORD_UNCHANGED', message: 'Must be different' }, 400),
    })
    renderApp('/change-password')

    await userEvent.type(await screen.findByLabelText('Temporary password'), 'same-same-same')
    await userEvent.type(screen.getByLabelText('New password'), 'same-same-same')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'same-same-same')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Must be different')
  })

  it('lets a forced user sign out instead', async () => {
    const api = mockApi({
      ...signedIn(forced),
      'POST /api/auth/logout': () => jsonResponse(undefined, 200),
    })
    const { router } = renderApp('/change-password')

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(api.mock.calls.some(([url]) => url === '/api/auth/logout')).toBe(true)
  })

  it('is reachable from settings for a normal password change', async () => {
    mockApi(signedIn())
    renderApp('/settings')

    await userEvent.click(await screen.findByRole('link', { name: 'Change password' }))

    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('redirects signed-out visitors to login', async () => {
    mockApi(signedOut())
    const { router } = renderApp('/change-password')

    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('signing out', () => {
  it('signs out from settings', async () => {
    const api = mockApi({ ...signedIn(), 'POST /api/auth/logout': () => jsonResponse(undefined) })
    const { router } = renderApp('/settings')

    const main = await screen.findByRole('main')
    await userEvent.click(within(main).getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    const call = api.mock.calls.find(([url]) => url === '/api/auth/logout')
    expect(call?.[1]?.method).toBe('POST')
  })
})

describe('desktop sidebar', () => {
  it('signs out from the sidebar', async () => {
    mockApi({ ...signedIn(), 'POST /api/auth/logout': () => jsonResponse(undefined) })
    const { router } = renderApp('/')

    const sidebar = await screen.findByRole('complementary', { name: 'Primary' })
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('handleAuthError', () => {
  it('clears the user on 401 so the guard redirects', () => {
    const queryClient = createQueryClient({ retry: false })
    queryClient.setQueryData(ME_KEY, SIGNED_IN)

    handleAuthError(queryClient, new ApiError(401, 'gone'))

    expect(queryClient.getQueryData(ME_KEY)).toBeNull()
  })

  it('refetches the user when a password change becomes required', () => {
    const queryClient = createQueryClient({ retry: false })
    queryClient.setQueryData(ME_KEY, SIGNED_IN)
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    handleAuthError(queryClient, new ApiError(403, 'x', { code: 'PASSWORD_CHANGE_REQUIRED' }))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ME_KEY })
  })

  it('ignores other errors', () => {
    const queryClient = createQueryClient({ retry: false })
    queryClient.setQueryData(ME_KEY, SIGNED_IN)

    handleAuthError(queryClient, new ApiError(500, 'x'))
    handleAuthError(queryClient, new Error('not an api error'))

    expect(queryClient.getQueryData(ME_KEY)).toEqual(SIGNED_IN)
  })
})
