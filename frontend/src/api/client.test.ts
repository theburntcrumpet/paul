import { jsonResponse, mockFetch } from '../test/render'
import { api, apiFetch, ApiError } from './client'

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

  it('exposes a typed health call', async () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: '1.2.3' }))
    await expect(api.health()).resolves.toEqual({ status: 'ok', version: '1.2.3' })
  })
})
