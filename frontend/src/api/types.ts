export type PaymentInterval =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom'
  | 'one_time'

export type EntryType = 'expense' | 'income'

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  expense: 'Ausgabe',
  income: 'Einnahme',
}

export interface NamedAmount {
  id?: number | null
  name: string
  amount: string | number
}

export interface UpcomingDue {
  cost_item_id: number
  name: string
  due_day?: number | null
  due_month?: number | null
  due_label: string
  amount: string | number
  payment_interval: PaymentInterval
  entry_type?: EntryType
}

export interface DashboardSummary {
  year: number
  monthly_fixed_costs: string | number
  yearly_fixed_costs: string | number
  monthly_income: string | number
  yearly_income: string | number
  monthly_net: string | number
  yearly_net: string | number
  ytd_fixed_costs: string | number
  ytd_income: string | number
  one_time_expense: string | number
  one_time_income: string | number
  active_contracts: number
  active_cost_items: number
  costs_by_person: NamedAmount[]
  costs_by_party: NamedAmount[]
  costs_by_object: NamedAmount[]
  costs_by_category: NamedAmount[]
  top_cost_blocks: NamedAmount[]
  upcoming_dues: UpcomingDue[]
}

export interface CostHistoryPoint {
  month: string
  date: string
  monthly_total: string | number
  is_forecast: boolean
}

export interface CostHistoryEvent {
  date: string
  cost_item_id: number
  cost_item_name: string
  event_type: 'created' | 'changed' | 'ended' | 'reactivated' | string
  amount: string | number
  monthly_amount: string | number
  notes?: string | null
}

export interface CostHistorySummary {
  current_monthly: string | number
  start_monthly: string | number
  change_monthly: string | number
  change_percent: string | number
  active_items: number
  months_back: number
  forecast_months: number
}

export interface CostHistoryResponse {
  series: CostHistoryPoint[]
  events: CostHistoryEvent[]
  summary: CostHistorySummary
}

export type UserRole = 'admin' | 'user' | 'viewer'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  user: 'Benutzer',
  viewer: 'Nur Lesen',
}

export interface User {
  id: number
  username: string
  email?: string | null
  role: UserRole
  is_active: boolean
  person_id?: number | null
}

export interface Person {
  id: number
  name: string
  color?: string | null
  email?: string | null
  notes?: string | null
  party_id?: number | null
  is_active: boolean
}

export interface Party {
  id: number
  name: string
  description?: string | null
  is_active: boolean
}

export interface ObjectEntity {
  id: number
  name: string
  description?: string | null
  party_id?: number | null
  person_id?: number | null
  is_active: boolean
}

export interface Category {
  id: number
  name: string
  sort_order: number
}

export interface Tag {
  id: number
  name: string
  color?: string | null
}

export interface CostAllocation {
  id?: number
  person_id?: number | null
  party_id?: number | null
  is_household: boolean
  percentage: string | number
}

export interface CostItem {
  id: number
  name: string
  description?: string | null
  category_id: number
  object_id?: number | null
  contract_partner?: string | null
  amount: string | number
  currency: string
  entry_type: EntryType
  payment_interval: PaymentInterval
  custom_interval_months?: number | null
  start_date?: string | null
  end_date?: string | null
  due_day?: number | null
  due_month?: number | null
  notes?: string | null
  is_active: boolean
  tags: Tag[]
  allocations: CostAllocation[]
  monthly_amount: string | number
  yearly_amount: string | number
}

export interface PriceHistoryEntry {
  id: number
  cost_item_id: number
  amount: string | number
  monthly_amount: string | number
  valid_from: string
  event_type: string
  notes?: string | null
  created_at?: string
}

export interface Contract {
  id: number
  cost_item_id: number
  provider: string
  contract_number?: string | null
  start_date?: string | null
  end_date?: string | null
  notice_period_days?: number | null
  auto_renewal: boolean
  notes?: string | null
}

export interface CostOverviewRow {
  id: number
  name: string
  description?: string | null
  category?: string | null
  category_id?: number | null
  tags?: string | null
  tag_ids?: number[]
  object?: string | null
  object_party?: string | null
  object_person?: string | null
  object_person_id?: number | null
  related_person_ids?: number[]
  contract_partner?: string | null
  amount: string | number
  currency: string
  entry_type: EntryType
  entry_type_label: string
  payment_interval: PaymentInterval
  payment_interval_label: string
  monthly_amount: string | number
  yearly_amount: string | number
  due_label: string
  due_day?: number | null
  due_month?: number | null
  allocations: string
  contract_provider?: string | null
  contract_number?: string | null
  contract_notice_days?: number | null
  contract_auto_renewal?: boolean | null
  contract_start?: string | null
  contract_end?: string | null
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
}

export const INTERVAL_LABELS: Record<PaymentInterval, string> = {
  monthly: 'Monatlich',
  bimonthly: 'Zweimonatlich',
  quarterly: 'Vierteljährlich',
  semiannual: 'Halbjährlich',
  annual: 'Jährlich',
  custom: 'Individuell',
  one_time: 'Einmalig',
}

export const MONTH_LABELS: Record<number, string> = {
  1: 'Januar',
  2: 'Februar',
  3: 'März',
  4: 'April',
  5: 'Mai',
  6: 'Juni',
  7: 'Juli',
  8: 'August',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Dezember',
}

export function intervalNeedsDueMonth(interval: PaymentInterval): boolean {
  return interval !== 'monthly' && interval !== 'bimonthly' && interval !== 'one_time'
}

export interface SmtpSettings {
  enabled: boolean
  host?: string | null
  port: number
  use_tls: boolean
  use_ssl: boolean
  username?: string | null
  password_set: boolean
  from_email?: string | null
  from_name?: string | null
  default_cc_email?: string | null
  remind_days_before: string
}

export interface ReminderRunResult {
  status: string
  sent: number
  skipped: number
  candidates?: number
  reason?: string | null
  errors?: string[]
}
