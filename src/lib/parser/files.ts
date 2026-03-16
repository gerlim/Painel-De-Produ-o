import type { WorkSheet, utils as xlsxUtils } from 'xlsx'

import { normalizeHeader } from './shared'

export function normalizarColunas(row: Record<string, unknown>): Record<string, unknown> {
  const norm: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim()
    const nk = normalizeHeader(key)
    norm[key] = v

    if (/^order.?id$/.test(nk)) norm.OrderID = v
    if (/^order.?name$/.test(nk)) norm.OrderName = v
    if (/^length/.test(nk)) norm['length(mm)'] = v
    if (/^width/.test(nk)) norm['width(mm)'] = v

    if (/^data$/.test(nk)) norm.Data = v
    if (/^operador$/.test(nk)) norm.Operador = v
    if (/^status$/.test(nk)) norm.Status = v
    if (/^tamanho/.test(nk)) norm['Tamanho (cm)'] = v
    if (nk.includes('prefixo')) norm.Prefixo = v
    if (nk.includes('codigo produto') || nk === 'codigo') norm['Codigo Produto'] = v
    if (nk.includes('nome cliente')) norm['Nome Cliente'] = v
    if (nk === 'cliente') norm.Cliente = v
    if (nk.includes('tipo caixa')) norm['Tipo Caixa'] = v
    if (nk.includes('peca unica')) norm['Peca Unica'] = v
    if ((nk.includes('maquina') || nk.includes('maq')) && nk.includes('impress')) norm['Maquina Impressao'] = v
    if (nk.includes('qtd imagens') || nk.includes('imgs chapa') || nk.includes('imagens chapa')) norm['Qtd Imagens'] = v
    if (nk.includes('chapas') || nk === 'quantity' || nk === 'qty' || nk === 'qtd') norm.quantity = v
    if (nk.includes('caixas produzidas') || nk === 'caixas') norm['Caixas Produzidas'] = v
    if (nk.includes('printingarea') || nk.includes('area m2') || nk.startsWith('area')) norm['PrintingArea(m^2)'] = v

    if (/^(c|cyan)( ml)?$/.test(nk) || nk.startsWith('c ml')) norm['C(ml)'] = v
    if (/^(m|magenta)( ml)?$/.test(nk) || nk.startsWith('m ml')) norm['M(ml)'] = v
    if (/^(y|yellow|amarelo)( ml)?$/.test(nk) || nk.startsWith('y ml')) norm['Y(ml)'] = v
    if (/^(k|black|preto)( ml)?$/.test(nk) || nk.startsWith('k ml')) norm['K(ml)'] = v

    if (nk.includes('inkcost') || nk.includes('custo tinta') || nk === 'custo') norm.InkCost = v
    if (nk.includes('totalink') || nk.includes('tinta total')) norm['TotalInkConsumption (ml)'] = v
  }

  return norm
}

function parseCsv(text: string): Record<string, unknown>[] {
  const firstLine = text.split('\n')[0] || ''
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''))
  if (lines.length < 2) return []

  const headers = lines[0]
    .replace(/^\uFEFF/, '')
    .split(sep)
    .map((h) => h.trim().replace(/^"|"$/g, ''))

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false

      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes
        else if (ch === sep && !inQuotes) {
          fields.push(current)
          current = ''
        } else {
          current += ch
        }
      }
      fields.push(current)

      const row: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        const value = (fields[index] || '').trim().replace(/^"|"$/g, '')
        row[header] = value === '' || value === '-' ? null : value
      })
      return row
    })
}

function buildRowsFromWorksheet(ws: WorkSheet, utils: typeof xlsxUtils): Record<string, unknown>[] {
  const aoa = utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false }) as unknown[][]
  const headerIndex = aoa.findIndex((row) => row.some((cell) => normalizeHeader(cell).includes('orderid')))

  if (headerIndex < 0) {
    return (utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]).map(normalizarColunas)
  }

  const headers = (aoa[headerIndex] || []).map((h, index) => {
    const text = String(h ?? '').trim()
    return text || `col_${index}`
  })

  return aoa
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell != null && String(cell).trim() !== ''))
    .map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] ?? null
      })
      return normalizarColunas(obj)
    })
}

export async function lerArquivoMaquina(file: File): Promise<Record<string, unknown>[]> {
  const isXlsx = /\.xlsx?$/i.test(file.name)
  const isCsv = /\.csv$/i.test(file.name)

  if (isXlsx) {
    const { read, utils } = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = read(buffer, { cellDates: false })

    const sheetName = workbook.SheetNames.find((name) => {
      const ws = workbook.Sheets[name]
      const preview = utils.sheet_to_json(ws, { header: 1, range: 0, blankrows: false, defval: null }) as unknown[][]
      return preview.slice(0, 8).some((row) => row.some((cell) => normalizeHeader(cell).includes('orderid')))
    }) || workbook.SheetNames[0]

    const worksheet = workbook.Sheets[sheetName]
    return buildRowsFromWorksheet(worksheet, utils)
  }

  if (isCsv) {
    let text: string
    try {
      text = await file.text()
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer())
      }
    } catch {
      text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer())
    }
    return parseCsv(text).map(normalizarColunas)
  }

  throw new Error(`Formato nao suportado: ${file.name}. Use .xlsx, .xls ou .csv`)
}
