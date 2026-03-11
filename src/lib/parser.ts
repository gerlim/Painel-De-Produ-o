// PAINEL PRODUCAO - parser and aggregations based on spreadsheet v8

export type TipoCaixa = 'Oitavada' | 'Maleta' | 'Quadrada' | 'Flexo' | 'Outro'
export type StatusPedido = 'SERVICO' | 'TESTE'
export type TamanhoValor = number | string | null

export const STATUS_SERVICO: StatusPedido = 'SERVICO'
export const STATUS_TESTE: StatusPedido = 'TESTE'
export const SEM_TAMANHO_KEY = 'sem_tamanho'

export interface ParsedOrder {
  prefixo: string
  codigo: string
  nomeCliente: string
  tamanhoCm: TamanhoValor
  qtdImagens: number
  tipoCaixa: TipoCaixa
  pecaUnica: boolean
  maquinaImp: string | null
}

export interface Pedido {
  id?: number
  createdAt?: string
  createdBy?: string | null
  data: string
  mes: string
  operador: string
  status: StatusPedido
  orderID: string
  prefixo: string
  codigo: string
  nomeCliente: string
  tamanhoCm: TamanhoValor
  tipoCaixa: TipoCaixa
  pecaUnica: boolean
  maquinaImp: string | null
  qtdImagens: number
  chapasImpressas: number
  caixasProduzidas: number
  areaMq: number
  cMl: number
  mMl: number
  yMl: number
  kMl: number
  tintaTotal: number
  custoTinta: number
}

export interface AgendaItem {
  id?: number
  createdAt?: string
  createdBy?: string | null
  agendaData: string
  dataReferencia: string
  mes: string
  orderID: string
  prefixo: string
  codigo: string
  nomeCliente: string
  tamanhoCm: TamanhoValor
  tipoCaixa: TipoCaixa
  pecaUnica: boolean
  maquinaImp: string | null
  qtdImagens: number
  chapasPlanejadas: number
  caixasPlanejadas: number
}

export interface KPIs {
  totalPedidos: number
  totalChapas: number
  totalCaixas: number
  mediaCaixasPorPedido: number
  pedidosTeste: number
  totalCaixasTeste: number
  totalTintaMl: number
  totalAreaMq: number
}

export interface OperadorResumo {
  operador: string
  pedidos: number
  chapas: number
  caixas: number
  tinta: number
  mediaCaixasPorPedido: number
  mediaTintaPorPedido: number
  mediaServicosPorDia: number
  tamanhoMaisProduzido: string
}

export interface DiaOperadorResumo {
  data: string
  operador: string
  pedidos: number
  chapas: number
  caixas: number
  mediaCaixasPorPedido: number
  tinta: number
  tamanhoMaisProduzido: string
}

const TESTE_PREFIXO_RE = /^(PROVA|TESTE|PHTEST)/i

export const TIPO_CORES: Record<TipoCaixa, string> = {
  Oitavada: '#1A5276',
  Maleta: '#1E8449',
  Quadrada: '#7D3C98',
  Flexo: '#B7950B',
  Outro: '#717D7E',
}

export const OP_CORES: Record<string, string> = {
  Gesleyson: '#2471A3',
  Reinaldo: '#1E8449',
}

export function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}

export function formatStatusLabel(status: StatusPedido) {
  return status === STATUS_TESTE ? 'TESTE' : 'Servico'
}

export function isStatusTeste(status: unknown): boolean {
  const norm = normalizeHeader(status)
  return norm.includes('teste')
}

export function isStatusServico(status: unknown): boolean {
  return !isStatusTeste(status)
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0

  let text = String(value).trim()
  if (!text || text === '-') return 0

  text = text.replace(/\s+/g, '').replace(/^R\$/i, '')
  const hasComma = text.includes(',')
  const hasDot = text.includes('.')

  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (hasComma) {
    text = text.replace(',', '.')
  }

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDatePtBr(value: unknown): string | null {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcMs = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(utcMs)
    if (Number.isFinite(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear())}`
    }
    return null
  }

  const text = String(value).trim()
  if (!text) return null
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`

  const d = new Date(text)
  if (Number.isFinite(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear())}`
  }

  return null
}

export function mesFromData(dataPtBr: string): string {
  const parts = dataPtBr.split('/')
  if (parts.length === 3) {
    const mm = String(parts[1] || '').padStart(2, '0')
    const yyyy = String(parts[2] || '')
    if (/^\d{4}$/.test(yyyy) && /^\d{2}$/.test(mm)) return `${yyyy}-${mm}`
  }

  const iso = dataPtBr.match(/^(\d{4})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}`
  return ''
}

function normalizeMes(value: unknown): string | null {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (/^\d{4}-\d{2}$/.test(text)) return text

  const mPt = text.match(/^(\d{2})\/(\d{4})$/)
  if (mPt) return `${mPt[2]}-${mPt[1]}`

  const mIso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mIso) return `${mIso[1]}-${mIso[2]}`
  return null
}

function parseStatus(value: unknown): StatusPedido | null {
  if (value == null || value === '') return null
  return isStatusTeste(value) ? STATUS_TESTE : STATUS_SERVICO
}

function parseTipoCaixa(value: unknown): TipoCaixa | null {
  const norm = normalizeHeader(value)
  if (!norm) return null
  if (norm.includes('flexo')) return 'Flexo'
  if (norm.includes('oitavada')) return 'Oitavada'
  if (norm.includes('maleta')) return 'Maleta'
  if (norm.includes('quadrada')) return 'Quadrada'
  if (norm.includes('outro')) return 'Outro'
  return null
}

function parseBoolean(value: unknown): boolean | null {
  const norm = normalizeHeader(value)
  if (!norm) return null
  if (norm === 'sim' || norm === 'yes' || norm === 'true' || norm === '1') return true
  if (norm === 'nao' || norm === 'no' || norm === 'false' || norm === '0') return false
  return null
}

export function parseTamanho(value: unknown): TamanhoValor {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null
    return Math.round(value)
  }

  const raw = String(value).trim()
  if (!raw || raw === '-' || normalizeHeader(raw) === normalizeHeader(SEM_TAMANHO_KEY)) return null

  const mSpecial = raw.match(/(\d{2})\s*x\s*(\d+)\s*cm?/i) || raw.match(/(\d{2})\s*x\s*(\d+)/i)
  if (mSpecial) return `${parseInt(mSpecial[1], 10)}x${parseInt(mSpecial[2], 10)}`

  const mSimple = raw.match(/(\d{2})\s*_?\s*cm/i) || raw.match(/^(\d{2})$/)
  if (mSimple) return parseInt(mSimple[1], 10)

  return raw
}

export function tamanhoChave(value: TamanhoValor): string {
  const parsed = parseTamanho(value)
  if (parsed == null) return SEM_TAMANHO_KEY
  return String(parsed).toLowerCase().replace(/\s+/g, '')
}

export function tamanhoRotulo(value: TamanhoValor | string): string {
  const key = typeof value === 'string' && (value.includes('x') || /^\d+$/.test(value) || value === SEM_TAMANHO_KEY)
    ? value
    : tamanhoChave(value as TamanhoValor)

  if (key === SEM_TAMANHO_KEY) return 'Sem tamanho'
  if (/^\d+$/.test(key)) return `${key} cm`
  if (/^\d+x\d+$/i.test(key)) return `${key} cm`
  return key
}

function sizeSortParts(sizeKey: string) {
  if (sizeKey === SEM_TAMANHO_KEY) {
    return { base: Number.POSITIVE_INFINITY, kind: 3, tail: Number.POSITIVE_INFINITY, raw: sizeKey }
  }

  const num = sizeKey.match(/^(\d+)$/)
  if (num) return { base: Number(num[1]), kind: 0, tail: 0, raw: sizeKey }

  const special = sizeKey.match(/^(\d+)x(\d+)$/i)
  if (special) return { base: Number(special[1]), kind: 1, tail: Number(special[2]), raw: sizeKey }

  const parsed = Number(sizeKey)
  if (Number.isFinite(parsed)) return { base: parsed, kind: 2, tail: 0, raw: sizeKey }

  return { base: Number.POSITIVE_INFINITY, kind: 4, tail: Number.POSITIVE_INFINITY, raw: sizeKey }
}

export function compararTamanhos(a: string, b: string): number {
  const pa = sizeSortParts(a)
  const pb = sizeSortParts(b)
  if (pa.base !== pb.base) return pa.base - pb.base
  if (pa.kind !== pb.kind) return pa.kind - pb.kind
  if (pa.tail !== pb.tail) return pa.tail - pb.tail
  return pa.raw.localeCompare(pb.raw, 'pt-BR')
}

export function parseOrderId(orderID: string): ParsedOrder {
  const r: ParsedOrder = {
    prefixo: '?',
    codigo: '?',
    nomeCliente: '?',
    tamanhoCm: null,
    qtdImagens: 1,
    tipoCaixa: 'Outro',
    pecaUnica: false,
    maquinaImp: null,
  }

  let resto: string

  if (TESTE_PREFIXO_RE.test(orderID)) {
    r.prefixo = 'TESTE'
    r.codigo = 'TESTE'
    resto = orderID.replace(TESTE_PREFIXO_RE, '').replace(/^[_-]+/, '')
  } else {
    const m = orderID.match(/^(\d+)_(\d+)_?(.*)/)
    if (m) {
      r.prefixo = m[1]
      r.codigo = m[2]
      resto = m[3]
    } else {
      resto = orderID
    }
  }

  resto = resto.replace(/^[-_]+/, '')

  const mSzX = resto.match(/(\d{2})\s*x\s*(\d+)\s*cm/i)
  const mSzN = resto.match(/(\d{2})\s*_?\s*cm/i)

  if (mSzX) r.tamanhoCm = `${parseInt(mSzX[1], 10)}x${parseInt(mSzX[2], 10)}`
  else if (mSzN) r.tamanhoCm = parseInt(mSzN[1], 10)

  const mImg = resto.match(/(\d+)\s*_?\s*imagens?/i)
  r.qtdImagens = mImg ? parseInt(mImg[1], 10) : 1

  const mMaq = resto.match(/(Elite|Wonder|DFLEXO)/i)
  r.maquinaImp = mMaq ? mMaq[1].toUpperCase() : null

  r.pecaUnica = /pe[cc]a[_\s]?[uu]nica|_PU_/i.test(normalizeText(resto).toLowerCase())

  if (/D?FLEXO/i.test(resto)) r.tipoCaixa = 'Flexo'
  else if (/Oitavada/i.test(resto)) r.tipoCaixa = 'Oitavada'
  else if (/Maleta/i.test(resto)) r.tipoCaixa = 'Maleta'
  else if (/Quadrada/i.test(resto)) r.tipoCaixa = 'Quadrada'
  else r.tipoCaixa = 'Outro'

  const mSz = mSzX || mSzN
  if (mSz) {
    const nr = resto.slice(0, mSz.index).replace(/[-_]+$/, '')
    const nc = nr
      .replace(/_?[A-Za-zÀ-ú]{3}\d{4}.*$/, '')
      .replace(/_?[A-Za-zÀ-ú]{3}_?\d{4}.*$/, '')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^[\s-]+|[\s-]+$/g, '')
    r.nomeCliente = nc || nr.replace(/_/g, ' ').trim()
  } else {
    r.nomeCliente = resto.slice(0, 40).replace(/_/g, ' ').trim()
  }

  return r
}

export function calcStatus(orderID: string, chapas: number): StatusPedido {
  if (chapas < 10) return STATUS_TESTE
  if (TESTE_PREFIXO_RE.test(orderID)) return STATUS_TESTE
  return STATUS_SERVICO
}

function normalizarColunas(row: Record<string, unknown>): Record<string, unknown> {
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

function buildRowsFromWorksheet(ws: import('xlsx').WorkSheet, utils: typeof import('xlsx').utils): Record<string, unknown>[] {
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

export function processarArquivo(
  rows: Record<string, unknown>[],
  data: string,
  operador: string,
): Pedido[] {
  const fallbackData = data.trim()
  const fallbackOperador = operador.trim()

  return rows
    .map(normalizarColunas)
    .filter((row) => stringOrNull(row.OrderID))
    .map((row) => {
      const orderID = stringOrNull(row.OrderID) as string
      const parsed = parseOrderId(orderID)
      const dataProducao = normalizeDatePtBr(row.Data) || fallbackData

      const chapas = Math.trunc(parseNumber(row.quantity))
      const imgsRegistro = Math.trunc(parseNumber(row['Qtd Imagens']))
      const qtdImagens = imgsRegistro > 0 ? imgsRegistro : (parsed.qtdImagens || 1)

      const caixasRegistro = Math.trunc(parseNumber(row['Caixas Produzidas']))
      const caixasProduzidas = caixasRegistro > 0 ? caixasRegistro : chapas * qtdImagens

      const status = parseStatus(row.Status) || calcStatus(orderID, chapas)
      const tamanhoRegistro = parseTamanho(row['Tamanho (cm)'])
      const tipoRegistro = parseTipoCaixa(row['Tipo Caixa'])
      const pecaUnicaRegistro = parseBoolean(row['Peca Unica'])
      const areaRaw = parseNumber(row['PrintingArea(m^2)'])
      const areaMq = areaRaw > 1000 ? areaRaw / 1_000_000 : areaRaw

      return {
        data: dataProducao,
        mes: mesFromData(dataProducao),
        operador: stringOrNull(row.Operador) || fallbackOperador,
        status,
        orderID,
        prefixo: stringOrNull(row.Prefixo) || parsed.prefixo,
        codigo: stringOrNull(row['Codigo Produto']) || parsed.codigo,
        nomeCliente: stringOrNull(row['Nome Cliente']) || stringOrNull(row.Cliente) || parsed.nomeCliente,
        tamanhoCm: tamanhoRegistro ?? parsed.tamanhoCm,
        tipoCaixa: tipoRegistro || parsed.tipoCaixa,
        pecaUnica: pecaUnicaRegistro ?? parsed.pecaUnica,
        maquinaImp: stringOrNull(row['Maquina Impressao']) || parsed.maquinaImp,
        qtdImagens,
        chapasImpressas: chapas,
        caixasProduzidas,
        areaMq,
        cMl: parseNumber(row['C(ml)']),
        mMl: parseNumber(row['M(ml)']),
        yMl: parseNumber(row['Y(ml)']),
        kMl: parseNumber(row['K(ml)']),
        tintaTotal: parseNumber(row['TotalInkConsumption (ml)']),
        custoTinta: parseNumber(row.InkCost),
      }
    })
}

export function toPedido(row: Record<string, unknown>): Pedido {
  const status = parseStatus(row.status) || STATUS_SERVICO
  const tamanho = parseTamanho(row.tamanho_cm)
  const data = stringOrNull(row.data_producao) || ''
  const mes = normalizeMes(row.mes) || mesFromData(data)

  return {
    id: typeof row.id === 'number' ? row.id : undefined,
    createdAt: stringOrNull(row.created_at) || undefined,
    createdBy: stringOrNull(row.created_by),
    data,
    mes,
    operador: stringOrNull(row.operador) || '',
    status,
    orderID: stringOrNull(row.order_id) || '',
    prefixo: stringOrNull(row.prefixo) || '',
    codigo: stringOrNull(row.codigo) || '',
    nomeCliente: stringOrNull(row.nome_cliente) || '',
    tamanhoCm: tamanho,
    tipoCaixa: parseTipoCaixa(row.tipo_caixa) || 'Outro',
    pecaUnica: Boolean(row.peca_unica),
    maquinaImp: stringOrNull(row.maquina_impressao),
    qtdImagens: Math.trunc(parseNumber(row.qtd_imagens)),
    chapasImpressas: Math.trunc(parseNumber(row.chapas_impressas)),
    caixasProduzidas: Math.trunc(parseNumber(row.caixas_produzidas)),
    areaMq: parseNumber(row.area_mq),
    cMl: parseNumber(row.c_ml),
    mMl: parseNumber(row.m_ml),
    yMl: parseNumber(row.y_ml),
    kMl: parseNumber(row.k_ml),
    tintaTotal: parseNumber(row.tinta_total),
    custoTinta: parseNumber(row.custo_tinta),
  }
}

export function toPedidoInsertRow(
  pedido: Pedido,
  createdBy?: string | null,
  includeMes = true,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    data_producao: pedido.data,
    operador: pedido.operador,
    status: pedido.status,
    order_id: pedido.orderID,
    prefixo: pedido.prefixo,
    codigo: pedido.codigo,
    nome_cliente: pedido.nomeCliente,
    tamanho_cm: pedido.tamanhoCm == null ? null : String(pedido.tamanhoCm),
    tipo_caixa: pedido.tipoCaixa,
    peca_unica: pedido.pecaUnica,
    maquina_impressao: pedido.maquinaImp,
    qtd_imagens: pedido.qtdImagens,
    chapas_impressas: pedido.chapasImpressas,
    caixas_produzidas: pedido.caixasProduzidas,
    area_mq: pedido.areaMq,
    c_ml: pedido.cMl,
    m_ml: pedido.mMl,
    y_ml: pedido.yMl,
    k_ml: pedido.kMl,
    tinta_total: pedido.tintaTotal,
    custo_tinta: pedido.custoTinta,
    created_by: createdBy || null,
  }
  if (includeMes) row.mes = pedido.mes || mesFromData(pedido.data)
  return row
}

export function agendaFromPedidos(pedidos: Pedido[], agendaData: string): AgendaItem[] {
  return pedidos.map((pedido) => ({
    agendaData,
    dataReferencia: pedido.data,
    mes: mesFromData(agendaData),
    orderID: pedido.orderID,
    prefixo: pedido.prefixo,
    codigo: pedido.codigo,
    nomeCliente: pedido.nomeCliente,
    tamanhoCm: pedido.tamanhoCm,
    tipoCaixa: pedido.tipoCaixa,
    pecaUnica: pedido.pecaUnica,
    maquinaImp: pedido.maquinaImp,
    qtdImagens: pedido.qtdImagens,
    chapasPlanejadas: pedido.chapasImpressas,
    caixasPlanejadas: pedido.caixasProduzidas,
  }))
}

export function toAgendaItem(row: Record<string, unknown>): AgendaItem {
  const agendaData = stringOrNull(row.agenda_data) || ''
  return {
    id: typeof row.id === 'number' ? row.id : undefined,
    createdAt: stringOrNull(row.created_at) || undefined,
    createdBy: stringOrNull(row.created_by),
    agendaData,
    dataReferencia: stringOrNull(row.data_referencia) || '',
    mes: normalizeMes(row.mes) || mesFromData(agendaData),
    orderID: stringOrNull(row.order_id) || '',
    prefixo: stringOrNull(row.prefixo) || '',
    codigo: stringOrNull(row.codigo) || '',
    nomeCliente: stringOrNull(row.nome_cliente) || '',
    tamanhoCm: parseTamanho(row.tamanho_cm),
    tipoCaixa: parseTipoCaixa(row.tipo_caixa) || 'Outro',
    pecaUnica: Boolean(row.peca_unica),
    maquinaImp: stringOrNull(row.maquina_impressao),
    qtdImagens: Math.trunc(parseNumber(row.qtd_imagens)),
    chapasPlanejadas: Math.trunc(parseNumber(row.chapas_planejadas)),
    caixasPlanejadas: Math.trunc(parseNumber(row.caixas_planejadas)),
  }
}

export function toAgendaInsertRow(
  item: AgendaItem,
  createdBy?: string | null,
  includeMes = true,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    agenda_data: item.agendaData,
    data_referencia: item.dataReferencia,
    order_id: item.orderID,
    prefixo: item.prefixo,
    codigo: item.codigo,
    nome_cliente: item.nomeCliente,
    tamanho_cm: item.tamanhoCm == null ? null : String(item.tamanhoCm),
    tipo_caixa: item.tipoCaixa,
    peca_unica: item.pecaUnica,
    maquina_impressao: item.maquinaImp,
    qtd_imagens: item.qtdImagens,
    chapas_planejadas: item.chapasPlanejadas,
    caixas_planejadas: item.caixasPlanejadas,
    created_by: createdBy || null,
  }
  if (includeMes) row.mes = item.mes || mesFromData(item.agendaData)
  return row
}

function excelSerialToDatePtBr(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return normalizeDatePtBr(value)
  const utcMs = Math.round((value - 25569) * 86400 * 1000)
  const d = new Date(utcMs)
  if (!Number.isFinite(d.getTime())) return null
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear())}`
}

function splitAgendaProductCode(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return { prefixo: '', codigo: '' }
  if (digits.length <= 2) return { prefixo: digits, codigo: '' }
  return {
    prefixo: digits.slice(0, 2),
    codigo: String(Number(digits.slice(2))),
  }
}

export async function lerArquivoAgenda(file: File, fallbackAgendaData = ''): Promise<AgendaItem[]> {
  const { read, utils, SSF } = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { cellDates: false })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true, blankrows: false }) as unknown[][]

  const result: AgendaItem[] = []
  let currentAgendaData = fallbackAgendaData.trim()

  for (const row of rows) {
    const descricao = String(row[4] ?? '').trim()
    const bloco = descricao.match(/Digital\s+Elite\s*-\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (bloco) {
      currentAgendaData = bloco[1]
      continue
    }

    const referencia = excelSerialToDatePtBr(row[1]) || ''
    const ordem = String(row[2] ?? '').trim()
    const produto = row[3]
    const quantidade = Math.trunc(parseNumber(row[5]))
    if (!descricao || !produto || !quantidade) continue

    const parsed = parseOrderId(descricao)
    const { prefixo, codigo } = splitAgendaProductCode(produto)
    const agendaData = currentAgendaData || referencia
    if (!agendaData) continue

    result.push({
      agendaData,
      dataReferencia: referencia,
      mes: mesFromData(agendaData),
      orderID: ordem || String(produto),
      prefixo: prefixo || parsed.prefixo,
      codigo: codigo || parsed.codigo,
      nomeCliente: parsed.nomeCliente,
      tamanhoCm: parsed.tamanhoCm,
      tipoCaixa: parsed.tipoCaixa,
      pecaUnica: parsed.pecaUnica,
      maquinaImp: parsed.maquinaImp,
      qtdImagens: parsed.qtdImagens || 1,
      chapasPlanejadas: quantidade,
      caixasPlanejadas: quantidade * (parsed.qtdImagens || 1),
    })
  }

  return result
}

export function sanitizeLegacyPedido(row: Record<string, unknown>): Pedido | null {
  const orderID = stringOrNull(row.orderID)
  if (!orderID) return null

  const parsed = parseOrderId(orderID)
  const chapas = Math.trunc(parseNumber(row.chapasImpressas))
  const qtdImagens = Math.max(1, Math.trunc(parseNumber(row.qtdImagens || parsed.qtdImagens)))

  return {
    data: stringOrNull(row.data) || '',
    mes: normalizeMes(row.mes) || mesFromData(stringOrNull(row.data) || ''),
    operador: stringOrNull(row.operador) || '',
    status: parseStatus(row.status) || calcStatus(orderID, chapas),
    orderID,
    prefixo: stringOrNull(row.prefixo) || parsed.prefixo,
    codigo: stringOrNull(row.codigo) || parsed.codigo,
    nomeCliente: stringOrNull(row.nomeCliente) || parsed.nomeCliente,
    tamanhoCm: parseTamanho(row.tamanhoCm) ?? parsed.tamanhoCm,
    tipoCaixa: parseTipoCaixa(row.tipoCaixa) || parsed.tipoCaixa,
    pecaUnica: Boolean(row.pecaUnica),
    maquinaImp: stringOrNull(row.maquinaImp),
    qtdImagens,
    chapasImpressas: chapas,
    caixasProduzidas: Math.trunc(parseNumber(row.caixasProduzidas || (chapas * qtdImagens))),
    areaMq: parseNumber(row.areaMq),
    cMl: parseNumber(row.cMl),
    mMl: parseNumber(row.mMl),
    yMl: parseNumber(row.yMl),
    kMl: parseNumber(row.kMl),
    tintaTotal: parseNumber(row.tintaTotal),
    custoTinta: parseNumber(row.custoTinta),
  }
}

export function soServicos(pedidos: Pedido[]) {
  return pedidos.filter((pedido) => isStatusServico(pedido.status))
}

export function soTestes(pedidos: Pedido[]) {
  return pedidos.filter((pedido) => isStatusTeste(pedido.status))
}

export function calcKPIs(pedidos: Pedido[]): KPIs {
  const svcs = soServicos(pedidos)
  const tsts = soTestes(pedidos)
  const totalCaixas = svcs.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)

  return {
    totalPedidos: svcs.length,
    totalChapas: svcs.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
    totalCaixas,
    mediaCaixasPorPedido: svcs.length ? Math.round(totalCaixas / svcs.length) : 0,
    pedidosTeste: tsts.length,
    totalCaixasTeste: tsts.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0),
    totalTintaMl: svcs.reduce((acc, pedido) => acc + pedido.tintaTotal, 0),
    totalAreaMq: svcs.reduce((acc, pedido) => acc + pedido.areaMq, 0),
  }
}

export function porTipo(pedidos: Pedido[]) {
  const tipos: TipoCaixa[] = ['Oitavada', 'Maleta', 'Quadrada', 'Flexo']
  const svcs = soServicos(pedidos)

  return tipos
    .map((tipo) => {
      const rows = svcs.filter((pedido) => pedido.tipoCaixa === tipo)
      return {
        tipo,
        pedidos: rows.length,
        caixas: rows.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0),
        chapas: rows.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
        pecaUnica: rows.filter((pedido) => pedido.pecaUnica).length,
      }
    })
    .filter((item) => item.pedidos > 0)
}

function topTamanho(rows: Pedido[]) {
  const bucket: Record<string, number> = {}
  rows.forEach((pedido) => {
    const key = tamanhoChave(pedido.tamanhoCm)
    bucket[key] = (bucket[key] || 0) + pedido.caixasProduzidas
  })
  const entries = Object.entries(bucket).sort((a, b) => b[1] - a[1] || compararTamanhos(a[0], b[0]))
  return entries.length ? tamanhoRotulo(entries[0][0]) : 'Sem tamanho'
}

export function porOperador(pedidos: Pedido[]): OperadorResumo[] {
  const svcs = soServicos(pedidos)
  const operadores = Array.from(new Set(svcs.map((pedido) => pedido.operador))).sort((a, b) => a.localeCompare(b))

  return operadores.map((operador) => {
    const rows = svcs.filter((pedido) => pedido.operador === operador)
    const pedidosCount = rows.length
    const caixas = rows.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)
    const tinta = rows.reduce((acc, pedido) => acc + pedido.tintaTotal, 0)
    const diasAtivos = new Set(rows.map((pedido) => pedido.data)).size
    return {
      operador,
      pedidos: pedidosCount,
      caixas,
      chapas: rows.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
      tinta,
      mediaCaixasPorPedido: pedidosCount ? caixas / pedidosCount : 0,
      mediaTintaPorPedido: pedidosCount ? tinta / pedidosCount : 0,
      mediaServicosPorDia: diasAtivos ? pedidosCount / diasAtivos : 0,
      tamanhoMaisProduzido: topTamanho(rows),
    }
  })
}

export function resumoMaquinaGeral(pedidos: Pedido[]): OperadorResumo {
  const svcs = soServicos(pedidos)
  const pedidosCount = svcs.length
  const caixas = svcs.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)
  const tinta = svcs.reduce((acc, pedido) => acc + pedido.tintaTotal, 0)
  const diasAtivos = new Set(svcs.map((pedido) => pedido.data)).size

  return {
    operador: 'Maquina Geral',
    pedidos: pedidosCount,
    caixas,
    chapas: svcs.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
    tinta,
    mediaCaixasPorPedido: pedidosCount ? caixas / pedidosCount : 0,
    mediaTintaPorPedido: pedidosCount ? tinta / pedidosCount : 0,
    mediaServicosPorDia: diasAtivos ? pedidosCount / diasAtivos : 0,
    tamanhoMaisProduzido: topTamanho(svcs),
  }
}

export function resumoDiaOperador(pedidos: Pedido[]): DiaOperadorResumo[] {
  const svcs = soServicos(pedidos)
  const keys = Array.from(new Set(svcs.map((pedido) => `${pedido.data}|${pedido.operador}`)))

  const result = keys.map((key) => {
    const [data, operador] = key.split('|')
    const rows = svcs.filter((pedido) => pedido.data === data && pedido.operador === operador)
    const pedidosCount = rows.length
    const caixas = rows.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)
    const tinta = rows.reduce((acc, pedido) => acc + pedido.tintaTotal, 0)
    return {
      data,
      operador,
      pedidos: pedidosCount,
      chapas: rows.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
      caixas,
      mediaCaixasPorPedido: pedidosCount ? caixas / pedidosCount : 0,
      tinta,
      tamanhoMaisProduzido: topTamanho(rows),
    }
  })

  return result.sort((a, b) => {
    const isoA = a.data.split('/').reverse().join('-')
    const isoB = b.data.split('/').reverse().join('-')
    if (isoA !== isoB) return isoA.localeCompare(isoB)
    return a.operador.localeCompare(b.operador)
  })
}

export function porDia(pedidos: Pedido[]) {
  const svcs = soServicos(pedidos)
  const dias = Array.from(new Set(svcs.map((pedido) => pedido.data))).sort((a, b) => {
    const pa = a.split('/').reverse().join('-')
    const pb = b.split('/').reverse().join('-')
    return pa.localeCompare(pb)
  })

  return dias.map((data) => {
    const rows = svcs.filter((pedido) => pedido.data === data)
    return {
      data,
      pedidos: rows.length,
      caixas: rows.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0),
      chapas: rows.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
      tinta: rows.reduce((acc, pedido) => acc + pedido.tintaTotal, 0),
      operadores: Array.from(new Set(rows.map((pedido) => pedido.operador))).join(' · '),
    }
  })
}
