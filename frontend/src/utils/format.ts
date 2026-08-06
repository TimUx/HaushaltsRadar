export function formatCurrency(value: string | number, currency = 'EUR'): string {
  const amount = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}
