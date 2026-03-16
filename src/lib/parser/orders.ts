import { normalizarColunas } from './files'
import { parseTamanho } from './sizes'
import {
  TESTE_PREFIXO_RE,
  calcMetrosLineares,
  isStatusTeste,
  mesFromData,
  normalizeDatePtBr,
  normalizeMes,
  normalizeText,
  parseBoolean,
  parseNumber,
  parseStatus,
  parseTipoCaixa,
  stringOrNull,
} from './shared'
import { STATUS_SERVICO, STATUS_TESTE, type ParsedOrder, type Pedido, type StatusPedido } from './types'

export function parseOrderId(orderID: string): ParsedOrder {
  const result: ParsedOrder = {
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
    result.prefixo = 'TESTE'
    result.codigo = 'TESTE'
    resto = orderID.replace(TESTE_PREFIXO_RE, '').replace(/^[_-]+/, '')
  } else {
    const match = orderID.match(/^(\d+)_(\d+)_?(.*)/)
    if (match) {
      result.prefixo = match[1]
      result.codigo = match[2]
      resto = match[3]
    } else {
      resto = orderID
    }
  }

  resto = resto.replace(/^[-_]+/, '')

  const matchSizeX = resto.match(/(\d{2})\s*x\s*(\d+)\s*cm/i)
  const matchSizeN = resto.match(/(\d{2})\s*_?\s*cm/i)

  if (matchSizeX) result.tamanhoCm = `${parseInt(matchSizeX[1], 10)}x${parseInt(matchSizeX[2], 10)}`
  else if (matchSizeN) result.tamanhoCm = parseInt(matchSizeN[1], 10)

  const matchImages = resto.match(/(\d+)\s*_?\s*imagens?/i)
  result.qtdImagens = matchImages ? parseInt(matchImages[1], 10) : 1

  const matchMachine = resto.match(/(Elite|Wonder|DFLEXO)/i)
  result.maquinaImp = matchMachine ? matchMachine[1].toUpperCase() : null

  result.pecaUnica = /pe[cc]a[_\s]?[uu]nica|_PU_/i.test(normalizeText(resto).toLowerCase())

  if (/D?FLEXO/i.test(resto)) result.tipoCaixa = 'Flexo'
  else if (/Oitavada/i.test(resto)) result.tipoCaixa = 'Oitavada'
  else if (/Maleta/i.test(resto)) result.tipoCaixa = 'Maleta'
  else if (/Quadrada/i.test(resto)) result.tipoCaixa = 'Quadrada'
  else result.tipoCaixa = 'Outro'

  const sizeMatch = matchSizeX || matchSizeN
  if (sizeMatch) {
    const nomeRaw = resto.slice(0, sizeMatch.index).replace(/[-_]+$/, '')
    const nomeCliente = nomeRaw
      .replace(/_?[A-Za-z]{3}\d{4}.*$/, '')
      .replace(/_?[A-Za-z]{3}_?\d{4}.*$/, '')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^[\s-]+|[\s-]+$/g, '')
    result.nomeCliente = nomeCliente || nomeRaw.replace(/_/g, ' ').trim()
  } else {
    result.nomeCliente = resto.slice(0, 40).replace(/_/g, ' ').trim()
  }

  return result
}

export function calcStatus(orderID: string, chapas: number): StatusPedido {
  if (chapas < 10) return STATUS_TESTE
  if (TESTE_PREFIXO_RE.test(orderID)) return STATUS_TESTE
  return STATUS_SERVICO
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
      const metrosLineares = calcMetrosLineares(row['length(mm)'], chapas)
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
        metrosLineares,
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
    metrosLineares: parseNumber(row.metros_lineares),
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
  includeMetrosLineares = true,
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
  if (includeMetrosLineares) row.metros_lineares = pedido.metrosLineares
  return row
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
    metrosLineares: parseNumber(row.metrosLineares),
    areaMq: parseNumber(row.areaMq),
    cMl: parseNumber(row.cMl),
    mMl: parseNumber(row.mMl),
    yMl: parseNumber(row.yMl),
    kMl: parseNumber(row.kMl),
    tintaTotal: parseNumber(row.tintaTotal),
    custoTinta: parseNumber(row.custoTinta),
  }
}
