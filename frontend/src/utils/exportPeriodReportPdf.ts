import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './format'

export type PeriodReportData = {
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

export type PeriodReportMeta = {
  objectName?: string | null
  shareLabel?: string | null
  categoryName?: string | null
  tagName?: string | null
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

function money(value: string | number): string {
  return formatCurrency(value)
}

function ensureSpace(doc: JsPdfWithAutoTable, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 14) {
    doc.addPage()
    return 16
  }
  return y
}

function sectionTitle(doc: JsPdfWithAutoTable, title: string, y: number): number {
  y = ensureSpace(doc, y, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 45, 60)
  doc.text(title, 14, y)
  return y + 3
}

function namedTable(
  doc: JsPdfWithAutoTable,
  y: number,
  title: string,
  rows: { name: string; amount: string | number }[],
): number {
  if (!rows.length) return y
  y = sectionTitle(doc, title, y)
  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 50, halign: 'right' },
    },
    head: [['Bezeichnung', 'Betrag']],
    body: rows.map((r) => [r.name, money(r.amount)]),
    margin: { left: 14, right: 14 },
  })
  return (doc.lastAutoTable?.finalY ?? y) + 8
}

export function exportPeriodReportPdf(
  data: PeriodReportData,
  meta: PeriodReportMeta = {},
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 45, 60)
  doc.text('KostenPilot', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text('Periodenbericht', 14, y + 6)

  y = 28
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 45, 60)
  doc.text(data.period_label, 14, y)

  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  const generated = new Date(data.generated_at).toLocaleString('de-DE')
  doc.text(
    `Zeitraum: ${data.date_from} – ${data.date_to} · ${data.months_covered} Monate · erstellt ${generated}`,
    14,
    y,
  )

  const filterParts = [
    meta.objectName ? `Objekt: ${meta.objectName}` : null,
    meta.shareLabel ? `Anteil: ${meta.shareLabel}` : null,
    meta.categoryName ? `Kategorie: ${meta.categoryName}` : null,
    meta.tagName ? `Tag: ${meta.tagName}` : null,
  ].filter(Boolean)
  if (filterParts.length) {
    y += 5
    doc.text(filterParts.join(' · '), 14, y)
  }

  y += 10
  y = sectionTitle(doc, 'Zusammenfassung', y)
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 45 },
      3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    body: [
      ['Ausgaben', money(data.summary.expense_total), 'Einnahmen', money(data.summary.income_total)],
      ['Netto', money(data.summary.net_total), 'Positionen', String(data.summary.active_items)],
      [
        'Einmalige Ausgaben',
        money(data.summary.one_time_expense),
        'Erstattungen',
        money(data.summary.one_time_income),
      ],
    ],
    margin: { left: 14, right: 14 },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  if (data.comment) {
    y = sectionTitle(doc, 'Kommentar', y)
    y = ensureSpace(doc, y, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    const lines = doc.splitTextToSize(data.comment, 180)
    doc.text(lines, 14, y)
    y += lines.length * 4.5 + 6
  }

  if (data.monthly_series.length > 0) {
    y = sectionTitle(doc, 'Monatsverlauf', y)
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      head: [['Monat', 'Ausgaben', 'Einnahmen', 'Netto']],
      body: data.monthly_series.map((row) => [
        row.label,
        money(row.expense),
        money(row.income),
        money(row.net),
      ]),
      margin: { left: 14, right: 14 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }

  y = namedTable(doc, y, 'Nach Kategorie', data.by_category)
  y = namedTable(doc, y, 'Nach Person / Haushalt', data.by_person)
  y = namedTable(doc, y, 'Nach Partei', data.by_party)
  y = namedTable(doc, y, 'Nach Objekt', data.by_object)
  namedTable(doc, y, 'Größte Kostenblöcke (Periode)', data.top_items)

  const stamp = new Date().toISOString().slice(0, 10)
  const slug = data.period_label.replace(/[^a-zA-Z0-9äöüÄÖÜ]+/g, '_').replace(/^_|_$/g, '')
  doc.save(`KostenPilot-Bericht_${slug}_${stamp}.pdf`)
}
