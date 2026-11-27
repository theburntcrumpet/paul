import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockApi, renderApp, signedIn } from '../test/render'

describe('AppShell', () => {
  it('shows the server version once healthy', async () => {
    mockApi({
      ...signedIn(),
      'GET /api/health': () => jsonResponse({ status: 'ok', version: '0.1.0' }),
    })
    renderApp('/')

    expect(await screen.findAllByText('v0.1.0')).not.toHaveLength(0)
  })

  it('shows offline when the server cannot be reached', async () => {
    mockApi({ ...signedIn(), 'GET /api/health': () => jsonResponse({ message: 'down' }, 503) })
    renderApp('/')

    expect(await screen.findAllByText('Offline')).not.toHaveLength(0)
  })

  it('renders both desktop and mobile navigation', async () => {
    mockApi(signedIn())
    renderApp('/')

    const desktop = await screen.findByRole('complementary', { name: 'Primary' })
    const mobile = screen.getByRole('navigation', { name: 'Mobile' })
    for (const nav of [desktop, mobile]) {
      expect(within(nav).getByRole('link', { name: /Library/ })).toBeInTheDocument()
      expect(within(nav).getByRole('link', { name: /Settings/ })).toBeInTheDocument()
    }
    expect(within(desktop).getByText('writer')).toBeInTheDocument()
  })

  it('navigates between pages and marks the active link', async () => {
    mockApi(signedIn())
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument()

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile' })
    await userEvent.click(within(mobileNav).getByRole('link', { name: /Settings/ }))

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')
    expect(within(mobileNav).getByRole('link', { name: /Settings/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('shows a not-found page for unknown routes', async () => {
    mockApi(signedIn())
    renderApp('/no/such/page')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Back to the library' }))
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })
})
