import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserSummary } from '../api/client'
import { jsonResponse, mockApi, renderApp, sentJson, signedIn } from '../test/render'

const writer: UserSummary = {
  id: 1,
  username: 'writer',
  mustChangePassword: false,
  createdAt: '2026-11-27T00:00:00Z',
}
const editor: UserSummary = {
  id: 2,
  username: 'editor',
  mustChangePassword: true,
  createdAt: '2026-11-27T00:00:00Z',
}

describe('users page', () => {
  it('is linked from settings', async () => {
    mockApi({ ...signedIn(), 'GET /api/users': () => jsonResponse([writer]) })
    renderApp('/settings')

    await userEvent.click(await screen.findByRole('link', { name: /Users/ }))

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('lists users, marks you and temporary passwords', async () => {
    mockApi({ ...signedIn(), 'GET /api/users': () => jsonResponse([editor, writer]) })
    renderApp('/settings/users')

    const list = await screen.findByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('editor')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Temporary password')).toBeInTheDocument()
    expect(within(rows[1]).getByText('(you)')).toBeInTheDocument()
    // You can't reset yourself from here.
    expect(within(rows[1]).queryByRole('button', { name: 'Reset password' })).toBeNull()
    expect(within(rows[0]).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
  })

  it('shows an error when the list fails to load', async () => {
    mockApi({ ...signedIn(), 'GET /api/users': () => jsonResponse({ message: 'nope' }, 500) })
    renderApp('/settings/users')

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load users: nope')
  })

  it('adds a user and refreshes the list', async () => {
    let users = [writer]
    const api = mockApi({
      ...signedIn(),
      'GET /api/users': () => jsonResponse(users),
      'POST /api/users': (init) => {
        const body = sentJson(init) as { username: string }
        const created = { ...editor, id: 3, username: body.username }
        users = [...users, created]
        return jsonResponse(created, 201)
      },
    })
    renderApp('/settings/users')
    const form = await screen.findByRole('form', { name: 'Add user' })

    const submit = within(form).getByRole('button', { name: 'Add user' })
    expect(submit).toBeDisabled()
    await userEvent.type(within(form).getByLabelText('Username'), 'newbie')
    await userEvent.type(within(form).getByLabelText('Temporary password'), 'temp-password')
    await userEvent.click(submit)

    expect(await within(form).findByRole('status')).toHaveTextContent('Added newbie')
    expect(await screen.findByText('newbie', { selector: 'span' })).toBeInTheDocument()
    expect(within(form).getByLabelText('Username')).toHaveValue('')
    const call = api.mock.calls.find(
      ([url, init]) => url === '/api/users' && init?.method === 'POST',
    )
    expect(sentJson(call?.[1])).toEqual({ username: 'newbie', password: 'temp-password' })
  })

  it('shows username problems against the username field', async () => {
    mockApi({
      ...signedIn(),
      'GET /api/users': () => jsonResponse([writer]),
      'POST /api/users': () =>
        jsonResponse(
          { code: 'USERNAME_TAKEN', message: "Username 'writer' is already taken" },
          409,
        ),
    })
    renderApp('/settings/users')
    const form = await screen.findByRole('form', { name: 'Add user' })

    await userEvent.type(within(form).getByLabelText('Username'), 'writer')
    await userEvent.type(within(form).getByLabelText('Temporary password'), 'temp-password')
    await userEvent.click(within(form).getByRole('button', { name: 'Add user' }))

    expect(await within(form).findByText("Username 'writer' is already taken")).toBeInTheDocument()
    expect(within(form).getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows unexpected errors at the top of the form', async () => {
    mockApi({
      ...signedIn(),
      'GET /api/users': () => jsonResponse([writer]),
      'POST /api/users': () => jsonResponse({ message: 'Server exploded' }, 500),
    })
    renderApp('/settings/users')
    const form = await screen.findByRole('form', { name: 'Add user' })

    await userEvent.type(within(form).getByLabelText('Username'), 'someone')
    await userEvent.type(within(form).getByLabelText('Temporary password'), 'temp-password')
    await userEvent.click(within(form).getByRole('button', { name: 'Add user' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Server exploded')
  })

  it('resets another user’s password', async () => {
    const api = mockApi({
      ...signedIn(),
      'GET /api/users': () => jsonResponse([{ ...editor, mustChangePassword: false }, writer]),
      'POST /api/users/2/password': () => jsonResponse(editor),
    })
    renderApp('/settings/users')

    await userEvent.click(await screen.findByRole('button', { name: 'Reset password' }))
    const form = screen.getByRole('form', { name: 'Reset password for editor' })
    expect(screen.getByText(/signed out on every device/)).toBeInTheDocument()

    await userEvent.type(within(form).getByLabelText('New temporary password'), 'another-temp')
    await userEvent.click(within(form).getByRole('button', { name: 'Set password' }))

    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Reset password for editor' })).toBeNull(),
    )
    const call = api.mock.calls.find(([url]) => url === '/api/users/2/password')
    expect(sentJson(call?.[1])).toEqual({ password: 'another-temp' })
  })

  it('can cancel a reset and shows reset errors', async () => {
    mockApi({
      ...signedIn(),
      'GET /api/users': () => jsonResponse([editor, writer]),
      'POST /api/users/2/password': () =>
        jsonResponse({ code: 'INVALID_PASSWORD', message: 'Password too weak' }, 400),
    })
    renderApp('/settings/users')

    await userEvent.click(await screen.findByRole('button', { name: 'Reset password' }))
    const form = screen.getByRole('form', { name: 'Reset password for editor' })
    await userEvent.type(within(form).getByLabelText('New temporary password'), 'whatever-1')
    await userEvent.click(within(form).getByRole('button', { name: 'Set password' }))
    expect(await within(form).findByText('Password too weak')).toBeInTheDocument()

    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'Reset password for editor' })).toBeNull()
  })
})
