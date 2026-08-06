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

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('kp_access_token', access)
  localStorage.setItem('kp_refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('kp_access_token')
  localStorage.removeItem('kp_refresh_token')
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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
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
  const response = await fetch(`${API_BASE}${path}`, { headers })
  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
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
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  })
  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return response.json() as Promise<T>
}
