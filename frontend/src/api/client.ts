/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined
  }

  /** Field-level validation messages, when the server sent them. */
  get fields(): Record<string, string> {
    return isRecord(this.body) && isRecord(this.body.fields)
      ? (this.body.fields as Record<string, string>)
      : {}
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON when present. */
  json?: unknown
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'

/** Reads the CSRF token the server hands out in a (non-HttpOnly) cookie. */
export function csrfToken(): string | undefined {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`))
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : undefined
}

/**
 * Thin fetch wrapper for the Paul API. Sends cookies (session / remember-me), echoes the CSRF
 * token on state-changing requests, encodes JSON bodies, and turns error responses into
 * {@link ApiError}s.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options
  const method = (rest.method ?? 'GET').toUpperCase()
  const token = SAFE_METHODS.has(method) ? undefined : csrfToken()
  const init: RequestInit = {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { [CSRF_HEADER]: token } : {}),
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

export interface Me {
  id: number
  username: string
  mustChangePassword: boolean
}

export interface UserSummary {
  id: number
  username: string
  mustChangePassword: boolean
  createdAt: string
}

export const api = {
  health: () => apiFetch<Health>('/api/health'),
  auth: {
    /** The signed-in user, or `null` when nobody is signed in. */
    me: async (): Promise<Me | null> => {
      try {
        return await apiFetch<Me>('/api/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    login: (username: string, password: string) =>
      apiFetch<Me>('/api/auth/login', { method: 'POST', json: { username, password } }),
    logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      apiFetch<Me>('/api/auth/password', {
        method: 'POST',
        json: { currentPassword, newPassword },
      }),
  },
  users: {
    list: () => apiFetch<UserSummary[]>('/api/users'),
    create: (username: string, password: string) =>
      apiFetch<UserSummary>('/api/users', { method: 'POST', json: { username, password } }),
    resetPassword: (id: number, password: string) =>
      apiFetch<UserSummary>(`/api/users/${id}/password`, { method: 'POST', json: { password } }),
  },
}
