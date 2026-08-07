import { apiFetch, apiFetchBlob, apiUploadJsonFile, clearTokens, setTokens } from './client'
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
  PriceHistoryEntry,
  ReminderRunResult,
  SmtpSettings,
  Tag,
  User,
  UserRole,
} from './types'

export type DashboardFilters = {
  year?: number | null
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

export type BreakdownGroupBy = 'category' | 'person' | 'object' | 'tag' | 'party'

export type NamedAmountItem = {
  id?: number | null
  name: string
  amount: string | number
}

export type HierarchyNodeDto = {
  id?: number | string | null
  name: string
  value: string | number
  children?: HierarchyNodeDto[]
}

function appendDashboardFilters(search: URLSearchParams, params?: DashboardFilters) {
  if (params?.year != null) search.set('year', String(params.year))
  if (params?.objectId != null) search.set('object_id', String(params.objectId))
  if (params?.personId != null) search.set('person_id', String(params.personId))
  if (params?.partyId != null) search.set('party_id', String(params.partyId))
  if (params?.household) search.set('household', 'true')
  if (params?.categoryId != null) search.set('category_id', String(params.categoryId))
  if (params?.tagId != null) search.set('tag_id', String(params.tagId))
}

export const analyticsApi = {
  dashboard: (params?: DashboardFilters) => {
    const search = new URLSearchParams()
    appendDashboardFilters(search, params)
    const query = search.toString()
    return apiFetch<DashboardSummary>(`/analytics/dashboard${query ? `?${query}` : ''}`, {}, true)
  },
  costHistory: (params?: CostHistoryFilters) => {
    const search = new URLSearchParams()
    if (params?.monthsBack != null) search.set('months_back', String(params.monthsBack))
    if (params?.forecastMonths != null) search.set('forecast_months', String(params.forecastMonths))
    appendDashboardFilters(search, params)
    const query = search.toString()
    return apiFetch<CostHistoryResponse>(
      `/analytics/cost-history${query ? `?${query}` : ''}`,
      {},
      true,
    )
  },
  breakdown: (groupBy: BreakdownGroupBy, params?: DashboardFilters) => {
    const search = new URLSearchParams()
    search.set('group_by', groupBy)
    appendDashboardFilters(search, params)
    return apiFetch<{ group_by: string; items: NamedAmountItem[] }>(
      `/analytics/breakdown?${search.toString()}`,
      {},
      true,
    )
  },
  hierarchy: (mode: 'category' | 'structure', params?: DashboardFilters) => {
    const search = new URLSearchParams()
    search.set('mode', mode)
    appendDashboardFilters(search, params)
    return apiFetch<{ mode: string; nodes: HierarchyNodeDto[] }>(
      `/analytics/hierarchy?${search.toString()}`,
      {},
      true,
    )
  },
  heatmap: (params?: DashboardFilters) => {
    const search = new URLSearchParams()
    appendDashboardFilters(search, params)
    const query = search.toString()
    return apiFetch<{
      year: number
      categories: string[]
      months: string[]
      values: number[][]
    }>(`/analytics/heatmap${query ? `?${query}` : ''}`, {}, true)
  },
  flow: (params?: DashboardFilters) => {
    const search = new URLSearchParams()
    appendDashboardFilters(search, params)
    const query = search.toString()
    return apiFetch<{
      nodes: { name: string }[]
      links: { source: string; target: string; value: number }[]
    }>(`/analytics/flow${query ? `?${query}` : ''}`, {}, true)
  },
  filterOptions: () =>
    apiFetch<{
      persons: { id: number; name: string; party_id?: number | null }[]
      parties: { id: number; name: string }[]
      objects: { id: number; name: string; party_id?: number | null; person_id?: number | null }[]
      categories: { id: number; name: string }[]
      tags: { id: number; name: string }[]
      years: number[]
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

export type PeriodType = 'month' | 'quarter' | 'half' | 'year' | 'custom'

export type PeriodReportParams = DashboardFilters & {
  periodType: PeriodType
  month?: number | null
  quarter?: number | null
  half?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  comment?: string | null
}

export type PeriodReport = {
  title: string
  period_type: string
  period_label: string
  date_from: string
  date_to: string
  months_covered: number
  generated_at: string
  comment?: string | null
  summary: {
    expense_total: string | number
    income_total: string | number
    net_total: string | number
    one_time_expense: string | number
    one_time_income: string | number
    active_items: number
  }
  by_category: { id?: number | null; name: string; amount: string | number }[]
  by_object: { id?: number | null; name: string; amount: string | number }[]
  by_person: { name: string; amount: string | number }[]
  by_party: { name: string; amount: string | number }[]
  top_items: { id?: number | null; name: string; amount: string | number }[]
  monthly_series: {
    month: string
    label: string
    expense: string | number
    income: string | number
    net: string | number
  }[]
}

export const reportsApi = {
  period: (params: PeriodReportParams) => {
    const search = new URLSearchParams()
    search.set('period_type', params.periodType)
    if (params.year != null) search.set('year', String(params.year))
    if (params.month != null) search.set('month', String(params.month))
    if (params.quarter != null) search.set('quarter', String(params.quarter))
    if (params.half != null) search.set('half', String(params.half))
    if (params.dateFrom) search.set('date_from', params.dateFrom)
    if (params.dateTo) search.set('date_to', params.dateTo)
    if (params.objectId != null) search.set('object_id', String(params.objectId))
    if (params.personId != null) search.set('person_id', String(params.personId))
    if (params.partyId != null) search.set('party_id', String(params.partyId))
    if (params.household) search.set('household', 'true')
    if (params.categoryId != null) search.set('category_id', String(params.categoryId))
    if (params.tagId != null) search.set('tag_id', String(params.tagId))
    if (params.comment) search.set('comment', params.comment)
    return apiFetch<PeriodReport>(`/reports/period?${search.toString()}`, {}, true)
  },
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
  deactivate: (id: number) => apiFetch<void>(`/cost-items/${id}`, { method: 'DELETE' }, true),
  removePermanent: (id: number) =>
    apiFetch<void>(`/cost-items/${id}?permanent=true`, { method: 'DELETE' }, true),
  listPriceHistory: (id: number) =>
    apiFetch<PriceHistoryEntry[]>(`/cost-items/${id}/price-history`, {}, true),
  addPriceHistory: (
    id: number,
    body: {
      amount: number
      valid_from: string
      notes?: string | null
      event_type?: string
      sync_current_amount?: boolean
    },
  ) =>
    apiFetch<PriceHistoryEntry>(
      `/cost-items/${id}/price-history`,
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
  removePriceHistory: (id: number, entryId: number) =>
    apiFetch<void>(`/cost-items/${id}/price-history/${entryId}`, { method: 'DELETE' }, true),
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
    email?: string | null
    role: UserRole
    is_active?: boolean
    person_id?: number | null
  }) => apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(body) }, true),
  update: (
    id: number,
    body: {
      username?: string
      password?: string
      email?: string | null
      role?: UserRole
      is_active?: boolean
      person_id?: number | null
    },
  ) => apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, true),
  remove: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }, true),
}

export const smtpApi = {
  get: () => apiFetch<SmtpSettings>('/admin/smtp', {}, true),
  update: (body: Partial<SmtpSettings> & { password?: string; clear_password?: boolean }) =>
    apiFetch<SmtpSettings>(
      '/admin/smtp',
      { method: 'PUT', body: JSON.stringify(body) },
      true,
    ),
  test: (to_email?: string) =>
    apiFetch<{ status: string; to: string }>(
      '/admin/smtp/test',
      { method: 'POST', body: JSON.stringify({ to_email: to_email || null }) },
      true,
    ),
  runReminders: () =>
    apiFetch<ReminderRunResult>('/admin/smtp/run-reminders', { method: 'POST' }, true),
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const adminDataApi = {
  exportJson: async (filenameHint?: string) => {
    const { blob, filename } = await apiFetchBlob('/admin/export', true)
    triggerDownload(blob, filenameHint || filename || 'haushaltsradar-export.json')
  },
  importJson: (file: File) =>
    apiUploadJsonFile<{ status: string; imported: Record<string, number> }>(
      '/admin/import',
      file,
      true,
    ),
}
