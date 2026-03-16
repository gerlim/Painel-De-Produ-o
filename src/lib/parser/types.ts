export type TipoCaixa = 'Oitavada' | 'Maleta' | 'Quadrada' | 'Flexo' | 'Outro'
export type StatusPedido = 'SERVICO' | 'TESTE'
export type TamanhoValor = number | string | null
export type AtrasoMotivo = 'falta_material' | 'falta_ordem_producao' | 'autorizacao_ctp' | 'outros'

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
  metrosLineares: number
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
  atrasoMotivo: AtrasoMotivo | null
  atrasoObservacao: string | null
}

export interface KPIs {
  totalPedidos: number
  totalChapas: number
  totalCaixas: number
  totalMetrosLineares: number
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
