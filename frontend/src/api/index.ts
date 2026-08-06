import { apiFetch, clearTokens, setTokens } from './client'
import type {
  Category,
  Contract,
  CostHistoryResponse,
  CostItem,
  CostOverviewRow,
  DashboardSummary,
  ObjectEntity,
  Party,
  Person,
  Tag,
  User,
  UserRole,
} from './types'

export type DashboardFilters = {
  objectId?: number | null
  personId?: number | null
  partyId?: number | null
  household?: boolean
  categoryId?: number | null
  tagId?: number | null
}

export type CostHistoryFilters = DashboardFilters & {
  monthsBack?: number
  forecastMonths?: number
}

export const analyticsApi = {
  dashboard: (params?: DashboardFilters) => {
    const search = new URLSearchParams()
    if (params?.objectId != null) search.set('object_id', String(params.objectId))
    if (params?.personId != null) search.set('person_id', String(params.personId))
    if (params?.partyId != null) search.set('party_id', String(params.partyId))
    if (params?.household) search.set('household', 'true')
    if (params?.categoryId != null) search.set('category_id', String(params.categoryId))
    if (params?.tagId != null) search.set('tag_id', String(params.tagId))
    const query = search.toString()
    return apiFetch<DashboardSummary>(`/analytics/dashboard${query ? `?${query}` : ''}`, {}, true)
  },
  costHistory: (params?: CostHistoryFilters) => {
    const search = new URLSearchParams()
    if (params?.monthsBack != null) search.set('months_back', String(params.monthsBack))
    if (params?.forecastMonths != null) search.set('forecast_months', String(params.forecastMonths))
    if (params?.objectId != null) search.set('object_id', String(params.objectId))
    if (params?.personId != null) search.set('person_id', String(params.personId))
    if (params?.partyId != null) search.set('party_id', String(params.partyId))
    if (params?.household) search.set('household', 'true')
    if (params?.categoryId != null) search.set('category_id', String(params.categoryId))
    if (params?.tagId != null) search.set('tag_id', String(params.tagId))
    const query = search.toString()
    return apiFetch<CostHistoryResponse>(
      `/analytics/cost-history${query ? `?${query}` : ''}`,
      {},
      true,
    )
  },
  filterOptions: () =>
    apiFetch<{
      persons: { id: number; name: string; party_id?: number | null }[]
      parties: { id: number; name: string }[]
      objects: { id: number; name: string; party_id?: number | null; person_id?: number | null }[]
      categories: { id: number; name: string }[]
      tags: { id: number; name: string }[]
    }>('/analytics/filter-options', {}, true),
  structure: () =>
    apiFetch<{
      root_name: string
      parties: {
        id: number
        name: string
        description?: string | null
        persons: { id: number; name: string; type: string; objects?: { id: number; name: string; type: string }[] }[]
        objects: { id: number; name: string; type: string }[]
      }[]
      unassigned_persons: { id: number; name: string; type: string; objects?: { id: number; name: string; type: string }[] }[]
      unassigned_objects: { id: number; name: string; type: string }[]
    }>('/analytics/structure', {}, true),
  costOverview: () => apiFetch<CostOverviewRow[]>('/analytics/cost-overview', {}, true),
}

export const authApi = {
  login: async (username: string, password: string) => {
    const data = await apiFetch<{ access_token: string; refresh_token: string }>(
      '/auth/login/json',
      { method: 'POST', body: JSON.stringify({ username, password }) },
    )
    setTokens(data.access_token, data.refresh_token)
    return data
  },
  me: () => apiFetch<User>('/auth/me', {}, true),
  logout: () => clearTokens(),
}

export const personsApi = {
  list: () => apiFetch<Person[]>('/persons', {}, true),
  create: (body: Partial<Person>) =>
    apiFetch<Person>('/persons', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: Partial<Person>) =>
    apiFetch<Person>(`/persons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/persons/${id}`, { method: 'DELETE' }, true),
}

export const partiesApi = {
  list: () => apiFetch<Party[]>('/parties', {}, true),
  create: (body: Partial<Party>) =>
    apiFetch<Party>('/parties', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: Partial<Party>) =>
    apiFetch<Party>(`/parties/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/parties/${id}`, { method: 'DELETE' }, true),
}

export const objectsApi = {
  list: () => apiFetch<ObjectEntity[]>('/objects', {}, true),
  create: (body: Partial<ObjectEntity>) =>
    apiFetch<ObjectEntity>('/objects', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: Partial<ObjectEntity>) =>
    apiFetch<ObjectEntity>(`/objects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/objects/${id}`, { method: 'DELETE' }, true),
}

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/categories', {}, true),
  create: (body: { name: string; sort_order?: number }) =>
    apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: { name?: string; sort_order?: number }) =>
    apiFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }, true),
}

export const tagsApi = {
  list: () => apiFetch<Tag[]>('/tags', {}, true),
  create: (body: { name: string; color?: string | null }) =>
    apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: { name?: string; color?: string | null }) =>
    apiFetch<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }, true),
}

export const costItemsApi = {
  list: () => apiFetch<CostItem[]>('/cost-items', {}, true),
  create: (body: Record<string, unknown>) =>
    apiFetch<CostItem>('/cost-items', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: Record<string, unknown>) =>
    apiFetch<CostItem>(`/cost-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/cost-items/${id}`, { method: 'DELETE' }, true),
}

export const contractsApi = {
  list: () => apiFetch<Contract[]>('/contracts', {}, true),
  create: (body: Partial<Contract>) =>
    apiFetch<Contract>('/contracts', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (id: number, body: Partial<Contract>) =>
    apiFetch<Contract>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/contracts/${id}`, { method: 'DELETE' }, true),
}

export const usersApi = {
  list: () => apiFetch<User[]>('/users', {}, true),
  create: (body: {
    username: string
    password: string
    role: UserRole
    is_active?: boolean
  }) => apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (
    id: number,
    body: {
      username?: string
      password?: string
      role?: UserRole
      is_active?: boolean
    },
  ) => apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }, true),
}
