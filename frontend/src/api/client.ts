const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('kp_access_token')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('kp_refresh_token')
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('kp_access_token', access)
  localStorage.setItem('kp_refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('kp_access_token')
  localStorage.removeItem('kp_refresh_token')
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!response.ok) {
      clearTokens()
      return false
    }
    const data = (await response.json()) as { access_token: string; refresh_token: string }
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    clearTokens()
    return false
  }
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshTokens().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = response.statusText
  try {
    const data = await response.json()
    detail = data.detail || detail
  } catch {
    /* ignore */
  }
  return new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && auth && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      const retryHeaders = new Headers(options.headers || {})
      if (!retryHeaders.has('Content-Type') && options.body) {
        retryHeaders.set('Content-Type', 'application/json')
      }
      const token = getToken()
      if (token) retryHeaders.set('Authorization', `Bearer ${token}`)
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
      })
    }
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export async function apiFetchBlob(
  path: string,
  auth = false,
): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers()
  if (auth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  let response = await fetch(`${API_BASE}${path}`, { headers })
  if (response.status === 401 && auth) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      const retryHeaders = new Headers()
      const token = getToken()
      if (token) retryHeaders.set('Authorization', `Bearer ${token}`)
      response = await fetch(`${API_BASE}${path}`, { headers: retryHeaders })
    }
  }
  if (!response.ok) {
    throw await parseError(response)
  }
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  return { blob: await response.blob(), filename: match?.[1] ?? null }
}

export async function apiUploadJsonFile<T>(
  path: string,
  file: File,
  auth = false,
): Promise<T> {
  const headers = new Headers()
  if (auth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const body = new FormData()
  body.append('file', file)
  let response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  })
  if (response.status === 401 && auth) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      const retryHeaders = new Headers()
      const token = getToken()
      if (token) retryHeaders.set('Authorization', `Bearer ${token}`)
      response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: retryHeaders,
        body,
      })
    }
  }
  if (!response.ok) {
    throw await parseError(response)
  }
  return response.json() as Promise<T>
}
