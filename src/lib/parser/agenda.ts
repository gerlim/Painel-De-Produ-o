import { parseOrderId } from './orders'
import { parseTamanho } from './sizes'
import { mesFromData, normalizeDatePtBr, normalizeMes, parseNumber, parseTipoCaixa, stringOrNull } from './shared'
import type { AgendaItem, AtrasoMotivo, Pedido } from './types'

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
    atrasoMotivo: null,
    atrasoObservacao: null,
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
    atrasoMotivo: stringOrNull(row.atraso_motivo) as AtrasoMotivo | null,
    atrasoObservacao: stringOrNull(row.atraso_observacao),
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
    atraso_motivo: item.atrasoMotivo,
    atraso_observacao: item.atrasoObservacao,
    created_by: createdBy || null,
  }
  if (includeMes) row.mes = item.mes || mesFromData(item.agendaData)
  return row
}

function extractAgendaClientName(descricao: string): string | null {
  const text = String(descricao || '').trim()
  if (!text) return null

  const sizeMatch = text.match(/\b\d{2}(?:x\d+(?:x\d+)?)?\s*cm\b/i)
  if (!sizeMatch || typeof sizeMatch.index !== 'number') return null

  let tail = text.slice(sizeMatch.index + sizeMatch[0].length).trim()
  const monthMatch = tail.match(/\b(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{2}\b/i)
  if (monthMatch && typeof monthMatch.index === 'number') {
    tail = tail.slice(0, monthMatch.index).trim()
  } else {
    const quantityMatch = tail.match(/\bC\/\s*\d+\s*UN\b/i)
    if (quantityMatch && typeof quantityMatch.index === 'number') {
      tail = tail.slice(0, quantityMatch.index).trim()
    }
  }

  tail = tail
    .replace(/^(?:QM\d+\s+)*(?:MICRO|KRAFT|OND[A-Z]*|PAPELAO|PAPELÃƒO|OFFSET|COUCHE|TRIPLEX|DUPLEX|BOPP)\s+/i, '')
    .trim()

  return tail || null
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
  const { read, utils } = await import('xlsx')
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
    const nomeClienteAgenda = extractAgendaClientName(descricao)
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
      nomeCliente: nomeClienteAgenda || parsed.nomeCliente,
      tamanhoCm: parsed.tamanhoCm,
      tipoCaixa: parsed.tipoCaixa,
      pecaUnica: parsed.pecaUnica,
      maquinaImp: parsed.maquinaImp,
      qtdImagens: parsed.qtdImagens || 1,
      chapasPlanejadas: quantidade,
      caixasPlanejadas: quantidade * (parsed.qtdImagens || 1),
      atrasoMotivo: null,
      atrasoObservacao: null,
    })
  }

  return result
}
