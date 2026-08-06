export type PaymentInterval =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom'

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
}

export interface DashboardSummary {
  monthly_fixed_costs: string | number
  yearly_fixed_costs: string | number
  active_contracts: number
  active_cost_items: number
  costs_by_person: NamedAmount[]
  costs_by_party: NamedAmount[]
  costs_by_object: NamedAmount[]
  costs_by_category: NamedAmount[]
  top_cost_blocks: NamedAmount[]
  upcoming_dues: UpcomingDue[]
}

export interface User {
  id: number
  username: string
  is_admin: boolean
  is_active: boolean
}

export interface Person {
  id: number
  name: string
  color?: string | null
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

export interface Subcategory {
  id: number
  category_id: number
  name: string
  sort_order: number
}

export interface Category {
  id: number
  name: string
  sort_order: number
  subcategories: Subcategory[]
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
  subcategory_id?: number | null
  object_id?: number | null
  contract_partner?: string | null
  amount: string | number
  currency: string
  payment_interval: PaymentInterval
  custom_interval_months?: number | null
  start_date?: string | null
  end_date?: string | null
  due_day?: number | null
  due_month?: number | null
  notes?: string | null
  is_active: boolean
  allocations: CostAllocation[]
  monthly_amount: string | number
  yearly_amount: string | number
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
  subcategory?: string | null
  object?: string | null
  object_party?: string | null
  object_person?: string | null
  contract_partner?: string | null
  amount: string | number
  currency: string
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
  return interval !== 'monthly' && interval !== 'bimonthly'
}
