import { SEM_TAMANHO_KEY, STATUS_SERVICO, STATUS_TESTE, type StatusPedido, type TipoCaixa } from './types'

export const TESTE_PREFIXO_RE = /^(PROVA|TESTE|PHTEST)/i

export function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}

export function formatStatusLabel(status: StatusPedido) {
  return status === STATUS_TESTE ? 'TESTE' : 'Servico'
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isStatusTeste(status: unknown): boolean {
  const norm = normalizeHeader(status)
  return norm.includes('teste')
}

export function isStatusServico(status: unknown): boolean {
  return !isStatusTeste(status)
}

export function stringOrNull(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

export function parseNumber(value: unknown): number {
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

export function calcMetrosLineares(lengthMm: unknown, chapas: number): number {
  const length = parseNumber(lengthMm)
  if (length <= 0 || chapas <= 0) return 0
  return (length * chapas) / 1000
}

export function normalizeDatePtBr(value: unknown): string | null {
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

export function normalizeMes(value: unknown): string | null {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (/^\d{4}-\d{2}$/.test(text)) return text

  const mPt = text.match(/^(\d{2})\/(\d{4})$/)
  if (mPt) return `${mPt[2]}-${mPt[1]}`

  const mIso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mIso) return `${mIso[1]}-${mIso[2]}`
  return null
}

export function parseStatus(value: unknown): StatusPedido | null {
  if (value == null || value === '') return null
  return isStatusTeste(value) ? STATUS_TESTE : STATUS_SERVICO
}

export function parseTipoCaixa(value: unknown): TipoCaixa | null {
  const norm = normalizeHeader(value)
  if (!norm) return null
  if (norm.includes('flexo')) return 'Flexo'
  if (norm.includes('oitavada')) return 'Oitavada'
  if (norm.includes('maleta')) return 'Maleta'
  if (norm.includes('quadrada')) return 'Quadrada'
  if (norm.includes('outro')) return 'Outro'
  return null
}

export function parseBoolean(value: unknown): boolean | null {
  const norm = normalizeHeader(value)
  if (!norm) return null
  if (norm === 'sim' || norm === 'yes' || norm === 'true' || norm === '1') return true
  if (norm === 'nao' || norm === 'no' || norm === 'false' || norm === '0') return false
  return null
}

export function isSemTamanhoValue(value: unknown) {
  return normalizeHeader(value) === normalizeHeader(SEM_TAMANHO_KEY)
}
