import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, renderApp } from '../test/render'

describe('AppShell', () => {
  it('shows the server version once healthy', async () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: '0.1.0' }))
    renderApp('/')

    expect(await screen.findAllByText('v0.1.0')).not.toHaveLength(0)
  })

  it('shows offline when the server cannot be reached', async () => {
    mockFetch(() => jsonResponse({ message: 'down' }, 503))
    renderApp('/')

    expect(await screen.findAllByText('Offline')).not.toHaveLength(0)
  })

  it('renders both desktop and mobile navigation', () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: 'dev' }))
    renderApp('/')

    const desktop = screen.getByRole('complementary', { name: 'Primary' })
    const mobile = screen.getByRole('navigation', { name: 'Mobile' })
    for (const nav of [desktop, mobile]) {
      expect(within(nav).getByRole('link', { name: /Library/ })).toBeInTheDocument()
      expect(within(nav).getByRole('link', { name: /Settings/ })).toBeInTheDocument()
    }
  })

  it('navigates between pages and marks the active link', async () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: 'dev' }))
    const { router } = renderApp('/')
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()

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
    mockFetch(() => jsonResponse({ status: 'ok', version: 'dev' }))
    renderApp('/no/such/page')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Back to the library' }))
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })
})
