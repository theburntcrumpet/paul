import { jsonResponse, mockFetch } from '../test/render'
import { api, apiFetch, ApiError, csrfToken } from './client'

describe('apiFetch', () => {
  it('sends same-origin credentials and parses JSON', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ hello: 'world' }))

    await expect(apiFetch('/api/thing')).resolves.toEqual({ hello: 'world' })

    const [url, init = {}] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/thing')
    expect(init.credentials).toBe('same-origin')
    expect((init.headers as Record<string, string>).Accept).toBe('application/json')
    expect(init.body).toBeUndefined()
  })

  it('encodes json bodies and sets the content type', async () => {
    const fetchMock = mockFetch(() => jsonResponse(undefined, 204))

    await expect(
      apiFetch('/api/thing', { method: 'POST', json: { a: 1 } }),
    ).resolves.toBeUndefined()

    const init = fetchMock.mock.calls[0][1] ?? {}
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('throws ApiError using the server message when present', async () => {
    mockFetch(() => jsonResponse({ message: 'Book not found' }, 404))

    const error = await apiFetch('/api/books/1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Book not found' })
  })

  it('falls back to the status line for non-JSON errors', async () => {
    mockFetch(
      () =>
        ({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          text: () => Promise.resolve('<html>oops</html>'),
        }) as Response,
    )

    await expect(apiFetch('/api/x')).rejects.toMatchObject({
      status: 502,
      message: '502 Bad Gateway',
      body: '<html>oops</html>',
    })
  })

  it('echoes the CSRF cookie on state-changing requests only', async () => {
    document.cookie = 'other=1'
    document.cookie = 'XSRF-TOKEN=tok%3D123'
    const fetchMock = mockFetch(() => jsonResponse({}))

    await apiFetch('/api/a', { method: 'POST', json: {} })
    await apiFetch('/api/b', { method: 'delete' })
    await apiFetch('/api/c')

    const headers = fetchMock.mock.calls.map(([, init]) => init?.headers as Record<string, string>)
    expect(headers[0]['X-XSRF-TOKEN']).toBe('tok=123')
    expect(headers[1]['X-XSRF-TOKEN']).toBe('tok=123')
    expect(headers[2]['X-XSRF-TOKEN']).toBeUndefined()
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('omits the CSRF header when there is no cookie', async () => {
    const fetchMock = mockFetch(() => jsonResponse({}))
    expect(csrfToken()).toBeUndefined()

    await apiFetch('/api/a', { method: 'POST' })

    const headers = (fetchMock.mock.calls[0][1] ?? {}).headers as Record<string, string>
    expect(headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('exposes error codes and field messages', async () => {
    mockFetch(() =>
      jsonResponse(
        { code: 'VALIDATION', message: 'Check fields', fields: { name: 'required' } },
        400,
      ),
    )

    const error = (await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('VALIDATION')
    expect(error.fields).toEqual({ name: 'required' })
    expect(new ApiError(500, 'plain').fields).toEqual({})
    expect(new ApiError(500, 'plain').code).toBeUndefined()
  })

  it('returns null from me() when signed out, but rethrows other failures', async () => {
    mockFetch(() => jsonResponse({ code: 'UNAUTHENTICATED' }, 401))
    await expect(api.auth.me()).resolves.toBeNull()

    mockFetch(() => jsonResponse({ message: 'boom' }, 500))
    await expect(api.auth.me()).rejects.toMatchObject({ status: 500 })
  })

  it('calls the user management endpoints', async () => {
    const fetchMock = mockFetch(() => jsonResponse({}))

    await api.users.list()
    await api.users.create('jo', 'temp-pass')
    await api.users.resetPassword(7, 'temp-pass')

    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)).toEqual([
      'GET /api/users',
      'POST /api/users',
      'POST /api/users/7/password',
    ])
  })

  it('exposes a typed health call', async () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: '1.2.3' }))
    await expect(api.health()).resolves.toEqual({ status: 'ok', version: '1.2.3' })
  })
})
