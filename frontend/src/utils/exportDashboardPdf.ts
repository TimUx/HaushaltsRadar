import { createTheme } from '@mui/material/styles'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DashboardSummary } from '../api/types'
import { INTERVAL_LABELS } from '../api/types'
import { buildBarOption, buildPieOption } from '../charts'
import { formatCurrency } from './format'
import { renderChartPng } from './renderChartPng'

export type DashboardPdfFilters = {
  year?: number | null
  objectName?: string | null
  shareLabel?: string | null
  categoryName?: string | null
  tagName?: string | null
  includePartyComparison?: boolean
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

/** Light theme so charts stay readable when printed / viewed in PDF. */
const printTheme = createTheme({
  palette: {
    mode: 'light',
    text: { primary: '#1e2d3c', secondary: '#666666' },
    divider: '#dde3ea',
    background: { paper: '#ffffff', default: '#ffffff' },
  },
})

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

function chartSubtitle(doc: JsPdfWithAutoTable, title: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 45, 60)
  doc.text(title, x, y)
}

type ChartImage = { url: string; widthPx: number; heightPx: number }

async function buildDashboardChartImages(data: DashboardSummary, includeParty: boolean) {
  const [category, topBlocks, party] = await Promise.all([
    data.costs_by_category.length > 0
      ? (async (): Promise<ChartImage> => {
          const widthPx = 560
          const heightPx = 360
          const url = await renderChartPng(buildPieOption(printTheme, data.costs_by_category), {
            width: widthPx,
            height: heightPx,
          })
          return { url, widthPx, heightPx }
        })()
      : Promise.resolve(null),
    data.top_cost_blocks.length > 0
      ? (async (): Promise<ChartImage> => {
          const widthPx = 560
          const heightPx = Math.max(300, data.top_cost_blocks.length * 36 + 48)
          const url = await renderChartPng(
            buildBarOption(printTheme, data.top_cost_blocks, { horizontal: true }),
            { width: widthPx, height: heightPx },
          )
          return { url, widthPx, heightPx }
        })()
      : Promise.resolve(null),
    includeParty && data.costs_by_party.length > 0
      ? (async (): Promise<ChartImage> => {
          const widthPx = 900
          const heightPx = 320
          const url = await renderChartPng(
            buildBarOption(printTheme, data.costs_by_party, { horizontal: false }),
            { width: widthPx, height: heightPx },
          )
          return { url, widthPx, heightPx }
        })()
      : Promise.resolve(null),
  ])

  return { category, topBlocks, party }
}

function addChartImage(
  doc: JsPdfWithAutoTable,
  image: { url: string; widthPx: number; heightPx: number },
  x: number,
  y: number,
  maxWidthMm: number,
  maxHeightMm: number,
): number {
  const aspect = image.heightPx / image.widthPx
  let w = maxWidthMm
  let h = w * aspect
  if (h > maxHeightMm) {
    h = maxHeightMm
    w = h / aspect
  }
  doc.addImage(image.url, 'PNG', x, y, w, h)
  return h
}

export async function exportDashboardPdf(
  data: DashboardSummary,
  filters: DashboardPdfFilters = {},
): Promise<void> {
  const includeParty = filters.includePartyComparison !== false
  const charts = await buildDashboardChartImages(data, includeParty)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 45, 60)
  doc.text('HaushaltsRadar', 14, y)

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
  if (filters.year != null) filterParts.push(`Jahr: ${filters.year}`)
  else if (data.year != null) filterParts.push(`Jahr: ${data.year}`)
  if (filters.objectName) filterParts.push(`Objekt: ${filters.objectName}`)
  if (filters.categoryName) filterParts.push(`Kategorie: ${filters.categoryName}`)
  if (filters.tagName) filterParts.push(`Tag: ${filters.tagName}`)
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
        'Monatliche Einnahmen',
        money(data.monthly_income),
      ],
      [
        'Monatliches Netto',
        money(data.monthly_net),
        `Jahresausgaben ${data.year}`,
        money(data.yearly_fixed_costs),
      ],
      [
        `Jahreseinnahmen ${data.year}`,
        money(data.yearly_income),
        `Jahresnetto ${data.year}`,
        money(data.yearly_net),
      ],
      [
        `Bisher ${data.year} (Ausgaben)`,
        money(data.ytd_fixed_costs),
        `Bisher ${data.year} (Einnahmen)`,
        money(data.ytd_income),
      ],
      [
        `Einmalig ${data.year}`,
        money(data.one_time_expense),
        `Erstattungen ${data.year}`,
        money(data.one_time_income),
      ],
      [
        'Aktive Verträge',
        String(data.active_contracts),
        'Positionen',
        String(data.active_cost_items),
      ],
    ],
    margin: { left: 14, right: 14 },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  const hasAnyChart = charts.category || charts.topBlocks || charts.party
  if (hasAnyChart) {
    y = sectionTitle(doc, 'Diagramme', y)
    y += 3

    const gap = 6
    const colWidth = (pageWidth - 28 - gap) / 2
    const leftX = 14
    const rightX = leftX + colWidth + gap
    const chartMaxH = 72

    if (charts.category || charts.topBlocks) {
      const pairHeight = chartMaxH + 8
      y = ensureSpace(doc, y, pairHeight)
      const chartTop = y + 4

      if (charts.category) {
        chartSubtitle(doc, 'Kosten nach Kategorie', leftX, y)
        addChartImage(doc, charts.category, leftX, chartTop, colWidth, chartMaxH)
      } else {
        chartSubtitle(doc, 'Kosten nach Kategorie', leftX, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(110, 110, 110)
        doc.text('Keine Daten für diesen Filter.', leftX, chartTop + 4)
      }

      if (charts.topBlocks) {
        chartSubtitle(doc, 'Größte Kostenblöcke', rightX, y)
        addChartImage(doc, charts.topBlocks, rightX, chartTop, colWidth, chartMaxH)
      } else {
        chartSubtitle(doc, 'Größte Kostenblöcke', rightX, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(110, 110, 110)
        doc.text('Keine Einträge', rightX, chartTop + 4)
      }

      y = chartTop + chartMaxH + 8
    }

    if (charts.party) {
      const partyMaxH = 68
      y = ensureSpace(doc, y, partyMaxH + 10)
      chartSubtitle(doc, 'Vergleich Parteien', 14, y)
      y += 4
      const h = addChartImage(doc, charts.party, 14, y, pageWidth - 28, partyMaxH)
      y += h + 8
    }
  }

  const partyTotal = data.costs_by_party.reduce((sum, row) => sum + Number(row.amount), 0)
  if (includeParty && data.costs_by_party.length > 0) {
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
      `HaushaltsRadar · Seite ${page} / ${pageCount}`,
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
  doc.save(`HaushaltsRadar-Dashboard_${filenameStamp()}${filterSlug}.pdf`)
}
