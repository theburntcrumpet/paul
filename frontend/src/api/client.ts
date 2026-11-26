/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON when present. */
  json?: unknown
}

/**
 * Thin fetch wrapper for the Paul API. Sends cookies (session / remember-me), encodes JSON
 * bodies, and turns error responses into {@link ApiError}s.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options
  const init: RequestInit = {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  }

  const response = await fetch(path, init)
  const text = await response.text()
  const body: unknown = text ? safeJson(text) : undefined

  if (!response.ok) {
    const message =
      (isRecord(body) && typeof body.message === 'string' && body.message) ||
      `${response.status} ${response.statusText}`.trim()
    throw new ApiError(response.status, message, body)
  }
  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface Health {
  status: string
  version: string
}

export const api = {
  health: () => apiFetch<Health>('/api/health'),
}
