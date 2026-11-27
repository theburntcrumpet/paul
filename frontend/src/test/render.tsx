import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Me } from '../api/client'
import { createQueryClient } from '../auth/queryClient'
import { routes } from '../routes'

/** Renders the real route tree at `path` with a fresh, retry-free query client. */
export function renderApp(path = '/') {
  const queryClient = createQueryClient({ retry: false })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>

/** Replaces global fetch with a mock that answers by URL. */
export function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const fn = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  )
  global.fetch = fn as unknown as typeof fetch
  return fn
}

/**
 * Fake API keyed by `"METHOD /path"`. `/api/health` is answered by default; anything unmatched
 * is a 404 so tests notice unexpected calls.
 */
export function mockApi(routes: Record<string, Handler>) {
  const table: Record<string, Handler> = {
    'GET /api/health': () => jsonResponse({ status: 'ok', version: 'dev' }),
    ...routes,
  }
  return mockFetch((url, init) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`
    const handler = table[key]
    return handler ? handler(init, url) : jsonResponse({ code: 'NOT_MOCKED', message: key }, 404)
  })
}

export const SIGNED_IN: Me = { id: 1, username: 'writer', mustChangePassword: false }

/** API routes for a signed-in user; spread extra routes over the top. */
export function signedIn(me: Me = SIGNED_IN): Record<string, Handler> {
  return { 'GET /api/auth/me': () => jsonResponse(me) }
}

export function signedOut(): Record<string, Handler> {
  return {
    'GET /api/auth/me': () =>
      jsonResponse({ code: 'UNAUTHENTICATED', message: 'Please sign in' }, 401),
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as Response
}

/** Parses the JSON body a mocked fetch was called with. */
export function sentJson(init: RequestInit | undefined): unknown {
  return init?.body ? JSON.parse(String(init.body)) : undefined
}
