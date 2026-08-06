import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DashboardSummary } from '../api/types'
import { INTERVAL_LABELS } from '../api/types'
import { formatCurrency } from './format'

export type DashboardPdfFilters = {
  objectName?: string | null
  shareLabel?: string | null
  includePartyComparison?: boolean
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

function money(value: string | number): string {
  return formatCurrency(value)
}

function pct(part: number, total: number): string {
  if (total <= 0) return '–'
  return `${((part / total) * 100).toFixed(0)} %`
}

function filenameStamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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

function emptyNote(doc: JsPdfWithAutoTable, text: string, y: number): number {
  y = ensureSpace(doc, y, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text(text, 14, y)
  return y + 6
}

export function exportDashboardPdf(
  data: DashboardSummary,
  filters: DashboardPdfFilters = {},
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 45, 60)
  doc.text('KostenPilot', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text('Dashboard-Übersicht', 14, y + 6)

  const exportedAt = new Date().toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  doc.text(`Exportiert: ${exportedAt}`, pageWidth - 14, y, { align: 'right' })
  y += 14

  doc.setDrawColor(200, 205, 210)
  doc.setLineWidth(0.3)
  doc.line(14, y, pageWidth - 14, y)
  y += 7

  const filterParts: string[] = []
  if (filters.objectName) filterParts.push(`Objekt: ${filters.objectName}`)
  if (filters.shareLabel) filterParts.push(`Anteil: ${filters.shareLabel}`)
  const filterText = filterParts.length ? filterParts.join('  ·  ') : 'Keine Filter · Gesamtsicht'

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`Filter: ${filterText}`, 14, y)
  y += 8

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [47, 93, 140],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 45 },
      3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    head: [['Kennzahl', 'Wert', 'Kennzahl', 'Wert']],
    body: [
      [
        'Monatliche Fixkosten',
        money(data.monthly_fixed_costs),
        'Jährliche Fixkosten',
        money(data.yearly_fixed_costs),
      ],
      [
        'Aktive Verträge',
        String(data.active_contracts),
        'Kostenpositionen',
        String(data.active_cost_items),
      ],
    ],
    margin: { left: 14, right: 14 },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  const partyTotal = data.costs_by_party.reduce((sum, row) => sum + Number(row.amount), 0)
  if (filters.includePartyComparison !== false && data.costs_by_party.length > 0) {
    y = sectionTitle(doc, 'Vergleich Parteien (monatlich)', y)
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      head: [['Partei', 'Monatlich', 'Anteil']],
      body: [
        ...data.costs_by_party.map((row) => [
          row.name,
          money(row.amount),
          pct(Number(row.amount), partyTotal),
        ]),
        [
          { content: 'Gesamt Parteien', styles: { fontStyle: 'bold' } },
          { content: money(partyTotal), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: '100 %', styles: { fontStyle: 'bold', halign: 'right' } },
        ],
      ],
      margin: { left: 14, right: 14 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 7
  }

  y = sectionTitle(doc, 'Kosten nach Kategorie (monatlich)', y)
  if (data.costs_by_category.length === 0) {
    y = emptyNote(doc, 'Keine Daten für diesen Filter.', y)
  } else {
    const categoryTotal = data.costs_by_category.reduce((sum, row) => sum + Number(row.amount), 0)
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      head: [['Kategorie', 'Monatlich', 'Anteil']],
      body: data.costs_by_category.map((row) => [
        row.name,
        money(row.amount),
        pct(Number(row.amount), categoryTotal),
      ]),
      margin: { left: 14, right: 14 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 7
  }

  y = sectionTitle(doc, 'Kosten je Person / Haushalt (monatlich)', y)
  if (data.costs_by_person.length === 0) {
    y = emptyNote(doc, 'Keine Daten für diesen Filter.', y)
  } else {
    const personTotal = data.costs_by_person.reduce((sum, row) => sum + Number(row.amount), 0)
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      head: [['Person / Haushalt', 'Monatlich', 'Anteil']],
      body: data.costs_by_person.map((row) => [
        row.name,
        money(row.amount),
        pct(Number(row.amount), personTotal),
      ]),
      margin: { left: 14, right: 14 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 7
  }

  // Two compact side-by-side tables: top blocks + objects
  y = ensureSpace(doc, y, 40)
  const leftX = 14
  const midGap = 6
  const colWidth = (pageWidth - 28 - midGap) / 2
  const rightX = leftX + colWidth + midGap
  const startY = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 45, 60)
  doc.text('Größte Kostenblöcke', leftX, startY)
  doc.text('Kosten je Objekt', rightX, startY)

  const topBody =
    data.top_cost_blocks.length === 0
      ? [['Keine Einträge', '']]
      : data.top_cost_blocks.map((row) => [row.name, money(row.amount)])
  const objectBody =
    data.costs_by_object.length === 0
      ? [['Keine Einträge', '']]
      : data.costs_by_object.map((row) => [row.name, money(row.amount)])

  autoTable(doc, {
    startY: startY + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: colWidth * 0.62 },
      1: { cellWidth: colWidth * 0.38, halign: 'right' },
    },
    head: [['Position', 'Betrag']],
    body: topBody,
    margin: { left: leftX, right: pageWidth - leftX - colWidth },
    tableWidth: colWidth,
  })
  const leftFinalY = doc.lastAutoTable?.finalY ?? startY

  autoTable(doc, {
    startY: startY + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: colWidth * 0.62 },
      1: { cellWidth: colWidth * 0.38, halign: 'right' },
    },
    head: [['Objekt', 'Monatlich']],
    body: objectBody,
    margin: { left: rightX, right: 14 },
    tableWidth: colWidth,
  })
  const rightFinalY = doc.lastAutoTable?.finalY ?? startY
  y = Math.max(leftFinalY, rightFinalY) + 8

  y = sectionTitle(doc, 'Fälligkeiten', y)
  if (data.upcoming_dues.length === 0) {
    y = emptyNote(doc, 'Keine Fälligkeiten hinterlegt.', y)
  } else {
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [47, 93, 140], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        3: { halign: 'right' },
      },
      head: [['Name', 'Fälligkeit', 'Intervall', 'Monatsäquivalent']],
      body: data.upcoming_dues.map((due) => [
        due.name,
        due.due_label || '–',
        INTERVAL_LABELS[due.payment_interval],
        money(due.amount),
      ]),
      margin: { left: 14, right: 14 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 6
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `KostenPilot · Seite ${page} / ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    )
  }

  const filterSlug = filterParts.length
    ? `_${filterParts
        .join('_')
        .replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)}`
    : ''
  doc.save(`KostenPilot-Dashboard_${filenameStamp()}${filterSlug}.pdf`)
}
