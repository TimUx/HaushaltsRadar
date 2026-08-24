import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellInput, UserOptions } from 'jspdf-autotable'

export type PdfDoc = jsPDF & {
  lastAutoTable?: { finalY: number }
}

export const PDF_PAGE_TOP = 16
export const PDF_PAGE_BOTTOM = 14
export const PDF_MARGIN_X = 14

/** Title line + gap before the table body. */
const SECTION_TITLE_BLOCK = 11

export function remainingHeight(doc: PdfDoc, y: number): number {
  return doc.internal.pageSize.getHeight() - PDF_PAGE_BOTTOM - y
}

export function fullUsableHeight(doc: PdfDoc): number {
  return doc.internal.pageSize.getHeight() - PDF_PAGE_BOTTOM - PDF_PAGE_TOP
}

/** Approximate height (mm) of a standard striped autoTable. */
export function estimateTableHeight(
  bodyRowCount: number,
  opts: { fontSize?: number; cellPadding?: number; headFontSize?: number } = {},
): number {
  const fontSize = opts.fontSize ?? 9
  const headFontSize = opts.headFontSize ?? 8
  const pad = opts.cellPadding ?? 1.8
  const ptToMm = 0.352778
  const lineFactor = 1.15
  const bodyRow = fontSize * ptToMm * lineFactor + pad * 2
  const headRow = headFontSize * ptToMm * lineFactor + pad * 2
  // Slight padding so keep-together decisions stay conservative vs. real autoTable layout.
  return headRow + Math.max(0, bodyRowCount) * bodyRow + 2
}

/**
 * Keep a section (title + table) together when it fits on one page.
 * Multi-page tables still start here unless only a tiny strip remains.
 */
export function ensureBlockFits(doc: PdfDoc, y: number, blockHeight: number): number {
  const remaining = remainingHeight(doc, y)
  const full = fullUsableHeight(doc)
  const minChunk = SECTION_TITLE_BLOCK + estimateTableHeight(2)

  if (blockHeight <= full) {
    if (blockHeight > remaining) {
      doc.addPage()
      return PDF_PAGE_TOP
    }
    return y
  }

  if (remaining < minChunk) {
    doc.addPage()
    return PDF_PAGE_TOP
  }
  return y
}

export function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  if (remainingHeight(doc, y) < needed) {
    doc.addPage()
    return PDF_PAGE_TOP
  }
  return y
}

export function sectionTitle(doc: PdfDoc, title: string, y: number): number {
  y = ensureSpace(doc, y, 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 45, 60)
  doc.text(title, PDF_MARGIN_X, y)
  return y + 3
}

export function emptyNote(doc: PdfDoc, text: string, y: number): number {
  y = ensureSpace(doc, y, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text(text, PDF_MARGIN_X, y)
  return y + 6
}

type SectionTableOptions = {
  head: NonNullable<UserOptions['head']>
  body: CellInput[][]
  columnStyles?: UserOptions['columnStyles']
  fontSize?: number
  cellPadding?: number
  afterGap?: number
}

/** Draw a titled striped table, keeping it on one page when possible; repeat head when split. */
export function drawSectionTable(doc: PdfDoc, y: number, title: string, opts: SectionTableOptions): number {
  const fontSize = opts.fontSize ?? 9
  const cellPadding = opts.cellPadding ?? 1.8
  const afterGap = opts.afterGap ?? 7
  const tableH = estimateTableHeight(opts.body.length, { fontSize, cellPadding })
  y = ensureBlockFits(doc, y, SECTION_TITLE_BLOCK + tableH)
  y = sectionTitle(doc, title, y)
  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize, cellPadding },
    headStyles: {
      fillColor: [47, 93, 140],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: opts.columnStyles,
    head: opts.head,
    body: opts.body,
    showHead: 'everyPage',
    margin: {
      left: PDF_MARGIN_X,
      right: PDF_MARGIN_X,
      top: PDF_PAGE_TOP,
      bottom: PDF_PAGE_BOTTOM,
    },
  })
  return (doc.lastAutoTable?.finalY ?? y) + afterGap
}
