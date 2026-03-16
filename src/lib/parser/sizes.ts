import { SEM_TAMANHO_KEY, type TamanhoValor } from './types'
import { isSemTamanhoValue } from './shared'

export function parseTamanho(value: unknown): TamanhoValor {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null
    return Math.round(value)
  }

  const raw = String(value).trim()
  if (!raw || raw === '-' || isSemTamanhoValue(raw)) return null

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
