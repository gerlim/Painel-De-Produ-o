import { compararTamanhos, tamanhoChave, tamanhoRotulo } from './sizes'
import { isStatusServico, isStatusTeste } from './shared'
import type { DiaOperadorResumo, KPIs, OperadorResumo, Pedido, TipoCaixa } from './types'

export function soServicos(pedidos: Pedido[]) {
  return pedidos.filter((pedido) => isStatusServico(pedido.status))
}

export function soTestes(pedidos: Pedido[]) {
  return pedidos.filter((pedido) => isStatusTeste(pedido.status))
}

export function calcKPIs(pedidos: Pedido[]): KPIs {
  const servicos = soServicos(pedidos)
  const testes = soTestes(pedidos)
  const totalCaixas = servicos.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)

  return {
    totalPedidos: servicos.length,
    totalChapas: servicos.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
    totalCaixas,
    totalMetrosLineares: servicos.reduce((acc, pedido) => acc + pedido.metrosLineares, 0),
    mediaCaixasPorPedido: servicos.length ? Math.round(totalCaixas / servicos.length) : 0,
    pedidosTeste: testes.length,
    totalCaixasTeste: testes.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0),
    totalTintaMl: servicos.reduce((acc, pedido) => acc + pedido.tintaTotal, 0),
    totalAreaMq: servicos.reduce((acc, pedido) => acc + pedido.areaMq, 0),
  }
}

export function porTipo(pedidos: Pedido[]) {
  const tipos: TipoCaixa[] = ['Oitavada', 'Maleta', 'Quadrada', 'Flexo']
  const servicos = soServicos(pedidos)

  return tipos
    .map((tipo) => {
      const rows = servicos.filter((pedido) => pedido.tipoCaixa === tipo)
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
  const servicos = soServicos(pedidos)
  const operadores = Array.from(new Set(servicos.map((pedido) => pedido.operador))).sort((a, b) => a.localeCompare(b))

  return operadores.map((operador) => {
    const rows = servicos.filter((pedido) => pedido.operador === operador)
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
  const servicos = soServicos(pedidos)
  const pedidosCount = servicos.length
  const caixas = servicos.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0)
  const tinta = servicos.reduce((acc, pedido) => acc + pedido.tintaTotal, 0)
  const diasAtivos = new Set(servicos.map((pedido) => pedido.data)).size

  return {
    operador: 'Maquina Geral',
    pedidos: pedidosCount,
    caixas,
    chapas: servicos.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
    tinta,
    mediaCaixasPorPedido: pedidosCount ? caixas / pedidosCount : 0,
    mediaTintaPorPedido: pedidosCount ? tinta / pedidosCount : 0,
    mediaServicosPorDia: diasAtivos ? pedidosCount / diasAtivos : 0,
    tamanhoMaisProduzido: topTamanho(servicos),
  }
}

export function resumoDiaOperador(pedidos: Pedido[]): DiaOperadorResumo[] {
  const servicos = soServicos(pedidos)
  const keys = Array.from(new Set(servicos.map((pedido) => `${pedido.data}|${pedido.operador}`)))

  const result = keys.map((key) => {
    const [data, operador] = key.split('|')
    const rows = servicos.filter((pedido) => pedido.data === data && pedido.operador === operador)
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
  const servicos = soServicos(pedidos)
  const dias = Array.from(new Set(servicos.map((pedido) => pedido.data))).sort((a, b) => {
    const pa = a.split('/').reverse().join('-')
    const pb = b.split('/').reverse().join('-')
    return pa.localeCompare(pb)
  })

  return dias.map((data) => {
    const rows = servicos.filter((pedido) => pedido.data === data)
    return {
      data,
      pedidos: rows.length,
      caixas: rows.reduce((acc, pedido) => acc + pedido.caixasProduzidas, 0),
      chapas: rows.reduce((acc, pedido) => acc + pedido.chapasImpressas, 0),
      tinta: rows.reduce((acc, pedido) => acc + pedido.tintaTotal, 0),
      operadores: Array.from(new Set(rows.map((pedido) => pedido.operador))).join(' Â· '),
    }
  })
}
