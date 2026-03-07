'use client'

import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Download, Factory, LogOut, Settings2, TrendingUp, Upload, UserRound, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  calcKPIs,
  formatStatusLabel,
  fmt,
  isStatusServico,
  isStatusTeste,
  lerArquivoMaquina,
  porDia,
  porOperador,
  porTipo,
  processarArquivo,
  resumoDiaOperador,
  resumoMaquinaGeral,
  soServicos,
  TIPO_CORES,
  tamanhoChave,
  tamanhoRotulo,
  type Pedido,
} from '@/lib/parser'
import {
  usePedidos,
  type ClassificacaoMatchField,
  type ClassificacaoRegra,
  type ClearPeriod,
  type ManagedProfile,
  type PendingProfile,
  type SaveClassificacaoRegraInput,
  type UserRole,
} from '@/lib/storage'
import ThemeModeControl from '@/components/ThemeModeControl'

type TabId = 'resumo' | 'dinamica' | 'produtos' | 'pedidos' | 'operadores'

const CHART_TOOLTIP_CONTENT_STYLE = {
  background: '#0f1d31',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 10,
  color: '#e8eef8',
}

const CHART_TOOLTIP_LABEL_STYLE = {
  color: '#e8eef8',
  fontWeight: 700,
}

const CHART_TOOLTIP_ITEM_STYLE = {
  color: '#e8eef8',
}

function toIsoDate(datePtBr: string) {
  const [dd, mm, yyyy] = datePtBr.split('/')
  if (!dd || !mm || !yyyy) return datePtBr
  return `${yyyy}-${mm}-${dd}`
}

function todayIsoDate() {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function percentDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function mesLabel(mes: string) {
  const m = mes.match(/^(\d{4})-(\d{2})$/)
  if (!m) return mes
  return `${m[2]}/${m[1]}`
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

function roleLabel(role: UserRole) {
  if (role === 'admin') return 'Administrador'
  if (role === 'operador') return 'Operador'
  return 'Visualizador'
}

function roleColors(role: UserRole) {
  if (role === 'admin') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' }
  if (role === 'operador') return { color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.32)' }
  return { color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.32)' }
}

function statusColors(active: boolean) {
  if (active) return { color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.32)' }
  return { color: '#fb7185', bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.32)' }
}

function chartSerieLabel(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes('caix')) return 'Caixas'
  if (normalized.includes('pedid')) return 'Pedidos'
  return name
}

function matchFieldLabel(field: ClassificacaoMatchField) {
  return field === 'codigo' ? 'Codigo' : 'Prefixo'
}

function toCsvValue(value: unknown) {
  if (value == null) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

function codigoComPrefixo(prefixo: string, codigo: string) {
  const p = prefixo.trim()
  const c = codigo.trim()
  if (p && c) return `${p}-${c}`
  return p || c || '-'
}

function normalizeUnknownSizeKey(value: string) {
  return value.trim().toLowerCase()
}

function isKnownSizeValue(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return /^\d+$/.test(normalized) || /^\d+x\d+$/.test(normalized)
}

function isUnknownSizeValue(value: Pedido['tamanhoCm']): value is string {
  if (typeof value !== 'string') return false
  const raw = value.trim()
  if (!raw) return false
  return !isKnownSizeValue(raw)
}

function downloadCsv(rows: Pedido[]) {
  const header = [
    'Data',
    'Operador',
    'Status',
    'Tamanho (cm)',
    'OrderID',
    'Prefixo',
    'Codigo Produto',
    'Nome Cliente',
    'Tipo Caixa',
    'Peca Unica',
    'Maquina Impressao',
    'Qtd Imagens',
    'Chapas Impressas',
    'Caixas Produzidas',
    'Area (m2)',
    'C (ml)',
    'M (ml)',
    'Y (ml)',
    'K (ml)',
    'Tinta Total (ml)',
    'Custo Tinta (R$)',
  ]

  const lines = rows.map((pedido) =>
    [
      pedido.data,
      pedido.operador,
      formatStatusLabel(pedido.status),
      pedido.tamanhoCm == null ? '' : tamanhoRotulo(pedido.tamanhoCm),
      pedido.orderID,
      pedido.prefixo,
      pedido.codigo,
      pedido.nomeCliente,
      pedido.tipoCaixa,
      pedido.pecaUnica ? 'Sim' : 'Nao',
      pedido.maquinaImp || '',
      pedido.qtdImagens,
      pedido.chapasImpressas,
      pedido.caixasProduzidas,
      pedido.areaMq.toFixed(6),
      pedido.cMl.toFixed(2),
      pedido.mMl.toFixed(2),
      pedido.yMl.toFixed(2),
      pedido.kMl.toFixed(2),
      pedido.tintaTotal.toFixed(2),
      pedido.custoTinta.toFixed(2),
    ]
      .map(toCsvValue)
      .join(';'),
  )

  const csv = `\uFEFF${header.map(toCsvValue).join(';')}\r\n${lines.join('\r\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `producao_pedidos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>{title}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: string
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        <span>{title}</span>
        <span>{icon}</span>
      </div>
      <div className="big-number" style={{ fontSize: 28, marginTop: 8, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>{hint}</div>
    </div>
  )
}

function UploadModal({
  onClose,
  onImport,
  operadores,
}: {
  onClose: () => void
  onImport: (pedidos: Pedido[], info: string) => Promise<void>
  operadores: string[]
}) {
  const [data, setData] = useState('')
  const [operador, setOperador] = useState(operadores[0] || 'Operador')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  function onFile(next: File) {
    setFile(next)
    setError('')
    const m = next.name.match(/(\d{4})(\d{2})(\d{2})/)
    if (m) setData(`${m[3]}/${m[2]}/${m[1]}`)
  }

  async function handleImport() {
    if (!file || !data || !operador) {
      setError('Preencha todos os campos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await lerArquivoMaquina(file)
      const pedidos = processarArquivo(rows, data, operador)
      const info = `${pedidos.filter((p) => isStatusServico(p.status)).length} servicos + ${pedidos.filter((p) => isStatusTeste(p.status)).length} testes`
      await onImport(pedidos, info)
    } catch {
      setError('Erro ao ler arquivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 100, display: 'grid', placeItems: 'end center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 540, borderRadius: '16px 16px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', fontSize: 22 }}>IMPORTAR PRODUCAO</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} style={{ display: 'none' }} />
        <button onClick={() => ref.current?.click()} className="upload-zone" style={{ width: '100%', marginBottom: 12 }}>
          {file ? file.name : 'Selecionar arquivo .xlsx/.csv'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <input value={data} onChange={(e) => setData(e.target.value)} placeholder="DD/MM/AAAA" style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }} />
          <select value={operador} onChange={(e) => setOperador(e.target.value)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }}>
            {operadores.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        {error && <div style={{ color: '#fb7185', marginBottom: 8, fontSize: 12 }}>{error}</div>}
        <button onClick={handleImport} disabled={loading || !file} style={{ width: '100%', border: 'none', borderRadius: 8, background: 'var(--cyan)', color: '#00131b', padding: 12, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'PROCESSANDO...' : 'IMPORTAR'}
        </button>
      </div>
    </div>
  )
}

function AdminToolsModal({
  onClose,
  onClearPeriod,
  onUpdateOperador,
  onUpdateUnknownSize,
  classificacaoRules,
  classificacaoRulesTableEnabled,
  onSaveClassificacaoRegra,
  onRemoveClassificacaoRegra,
  operadores,
  pedidos,
  pendingProfiles,
  loadingPendingProfiles,
  managedProfiles,
  loadingManagedProfiles,
  approvingProfileId,
  savingProfileId,
  currentUserId,
  onRefreshPendingProfiles,
  onRefreshManagedProfiles,
  onApprovePendingProfile,
  onUpdateProfileAccess,
}: {
  onClose: () => void
  onClearPeriod: (dateIso: string, period: ClearPeriod) => Promise<void>
  onUpdateOperador: (dateIso: string, operadorOrigem: string, operadorDestino: string) => Promise<void>
  onUpdateUnknownSize: (tamanhoOrigem: string, tamanhoDestino: string) => Promise<void>
  classificacaoRules: ClassificacaoRegra[]
  classificacaoRulesTableEnabled: boolean
  onSaveClassificacaoRegra: (input: SaveClassificacaoRegraInput) => Promise<{ atualizados: number }>
  onRemoveClassificacaoRegra: (ruleId: number) => Promise<void>
  operadores: string[]
  pedidos: Pedido[]
  pendingProfiles: PendingProfile[]
  loadingPendingProfiles: boolean
  managedProfiles: ManagedProfile[]
  loadingManagedProfiles: boolean
  approvingProfileId: string
  savingProfileId: string
  currentUserId: string
  onRefreshPendingProfiles: () => Promise<void>
  onRefreshManagedProfiles: () => Promise<void>
  onApprovePendingProfile: (profileId: string, role: UserRole) => Promise<void>
  onUpdateProfileAccess: (profileId: string, role: UserRole, active: boolean) => Promise<boolean>
}) {
  const [clearDate, setClearDate] = useState(todayIsoDate())
  const [clearPeriod, setClearPeriod] = useState<ClearPeriod>('day')
  const [origem, setOrigem] = useState(operadores[0] || '')
  const [destino, setDestino] = useState('')
  const [opDate, setOpDate] = useState(todayIsoDate())
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({})
  const [managedEdits, setManagedEdits] = useState<Record<string, { role: UserRole; active: boolean }>>({})
  const [pendingSearch, setPendingSearch] = useState('')
  const [managedSearch, setManagedSearch] = useState('')
  const [managedRoleFilter, setManagedRoleFilter] = useState<'todos' | UserRole>('todos')
  const [managedStatusFilter, setManagedStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [operatorCandidateId, setOperatorCandidateId] = useState('')
  const [unknownTargets, setUnknownTargets] = useState<Record<string, string>>({})
  const [ruleEditingId, setRuleEditingId] = useState<number | null>(null)
  const [ruleMatchField, setRuleMatchField] = useState<ClassificacaoMatchField>('prefixo')
  const [ruleMatchValue, setRuleMatchValue] = useState('')
  const [ruleStatusDestino, setRuleStatusDestino] = useState<'AUTO' | 'SERVICO' | 'TESTE'>('AUTO')
  const [ruleTipoCaixaDestino, setRuleTipoCaixaDestino] = useState<'AUTO' | 'Oitavada' | 'Maleta' | 'Quadrada' | 'Flexo' | 'Outro'>('AUTO')
  const [ruleTamanhoDestino, setRuleTamanhoDestino] = useState('')
  const [rulePrefixoDestino, setRulePrefixoDestino] = useState('')
  const [ruleActive, setRuleActive] = useState(true)
  const [ruleApplyToExisting, setRuleApplyToExisting] = useState(true)
  const [savingRule, setSavingRule] = useState(false)
  const [removingRuleId, setRemovingRuleId] = useState(0)
  const [loadingClear, setLoadingClear] = useState(false)
  const [loadingOp, setLoadingOp] = useState(false)
  const [loadingUnknownKey, setLoadingUnknownKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setPendingRoles((current) => {
      const next: Record<string, UserRole> = {}
      pendingProfiles.forEach((profile) => {
        next[profile.id] = current[profile.id] || 'visualizador'
      })
      return next
    })
  }, [pendingProfiles])

  useEffect(() => {
    setManagedEdits((current) => {
      const next: Record<string, { role: UserRole; active: boolean }> = {}
      managedProfiles.forEach((profile) => {
        next[profile.id] = current[profile.id] || { role: profile.role, active: profile.active }
      })
      return next
    })
  }, [managedProfiles])

  async function handleClear() {
    setError('')
    setLoadingClear(true)
    try {
      await onClearPeriod(clearDate, clearPeriod)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingClear(false)
    }
  }

  async function handleChangeOperador() {
    setError('')
    if (!origem.trim() || !destino.trim()) {
      setError('Informe operador de origem e operador destino')
      return
    }
    setLoadingOp(true)
    try {
      await onUpdateOperador(opDate, origem, destino)
      setDestino('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingOp(false)
    }
  }

  async function handleAddOperator() {
    setError('')
    if (!operatorCandidateId) {
      setError('Selecione um usuario para adicionar como operador')
      return
    }
    const target = managedProfiles.find((profile) => profile.id === operatorCandidateId)
    if (!target) {
      setError('Usuario selecionado nao encontrado')
      return
    }
    try {
      const updated = await onUpdateProfileAccess(target.id, 'operador', true)
      if (updated) setOperatorCandidateId('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemoveOperator(profileId: string) {
    setError('')
    try {
      await onUpdateProfileAccess(profileId, 'visualizador', true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleFixUnknownSize(sizeKey: string) {
    setError('')
    const target = (unknownTargets[sizeKey] || '').trim()
    if (!target) {
      setError('Informe o tamanho correto para aplicar a correção.')
      return
    }
    setLoadingUnknownKey(sizeKey)
    try {
      await onUpdateUnknownSize(sizeKey, target)
      setUnknownTargets((current) => ({ ...current, [sizeKey]: '' }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingUnknownKey('')
    }
  }

  function resetRuleForm() {
    setRuleEditingId(null)
    setRuleMatchField('prefixo')
    setRuleMatchValue('')
    setRuleStatusDestino('AUTO')
    setRuleTipoCaixaDestino('AUTO')
    setRuleTamanhoDestino('')
    setRulePrefixoDestino('')
    setRuleActive(true)
    setRuleApplyToExisting(true)
  }

  function loadRuleToForm(rule: ClassificacaoRegra) {
    setRuleEditingId(rule.id)
    setRuleMatchField(rule.matchField)
    setRuleMatchValue(rule.matchValue)
    setRuleStatusDestino(rule.statusDestino || 'AUTO')
    setRuleTipoCaixaDestino(rule.tipoCaixaDestino || 'AUTO')
    setRuleTamanhoDestino(rule.tamanhoDestino || '')
    setRulePrefixoDestino(rule.prefixoDestino || '')
    setRuleActive(rule.active)
    setRuleApplyToExisting(true)
  }

  function prefFillRuleFromItem(field: ClassificacaoMatchField, value: string, status: 'AUTO' | 'SERVICO' | 'TESTE' = 'AUTO') {
    setRuleEditingId(null)
    setRuleMatchField(field)
    setRuleMatchValue(value)
    setRuleStatusDestino(status)
    setRuleApplyToExisting(true)
  }

  async function handleSaveRule() {
    setError('')
    if (!ruleMatchValue.trim()) {
      setError('Informe o valor da regra (prefixo ou codigo).')
      return
    }

    setSavingRule(true)
    try {
      const report = await onSaveClassificacaoRegra({
        id: ruleEditingId || undefined,
        matchField: ruleMatchField,
        matchValue: ruleMatchValue,
        statusDestino: ruleStatusDestino === 'AUTO' ? null : ruleStatusDestino,
        tipoCaixaDestino: ruleTipoCaixaDestino === 'AUTO' ? null : ruleTipoCaixaDestino,
        tamanhoDestino: ruleTamanhoDestino.trim() || null,
        prefixoDestino: rulePrefixoDestino.trim() || null,
        active: ruleActive,
        applyToExisting: ruleApplyToExisting,
      })
      if (report.atualizados > 0) {
        setError('')
      }
      resetRuleForm()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingRule(false)
    }
  }

  async function handleRemoveRule(ruleId: number) {
    setError('')
    setRemovingRuleId(ruleId)
    try {
      await onRemoveClassificacaoRegra(ruleId)
      if (ruleEditingId === ruleId) resetRuleForm()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRemovingRuleId(0)
    }
  }

  const pendingSearchTerm = pendingSearch.trim().toLowerCase()
  const managedSearchTerm = managedSearch.trim().toLowerCase()

  const filteredPendingProfiles = pendingProfiles.filter((profile) => {
    if (!pendingSearchTerm) return true
    return profile.displayName.toLowerCase().includes(pendingSearchTerm) || profile.id.toLowerCase().includes(pendingSearchTerm)
  })

  const filteredManagedProfiles = managedProfiles.filter((profile) => {
    const matchesSearch = !managedSearchTerm
      || profile.displayName.toLowerCase().includes(managedSearchTerm)
      || profile.id.toLowerCase().includes(managedSearchTerm)
    const matchesRole = managedRoleFilter === 'todos' || profile.role === managedRoleFilter
    const matchesStatus = managedStatusFilter === 'todos'
      || (managedStatusFilter === 'ativos' && profile.active)
      || (managedStatusFilter === 'inativos' && !profile.active)
    return matchesSearch && matchesRole && matchesStatus
  })

  const operatorCandidates = managedProfiles
    .filter((profile) => profile.role !== 'operador' || !profile.active)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const activeOperators = managedProfiles
    .filter((profile) => profile.role === 'operador' && profile.active)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const unknownSizesMap = pedidos.reduce<Record<string, { key: string; raw: string; total: number; servicos: number }>>((acc, pedido) => {
    if (!isUnknownSizeValue(pedido.tamanhoCm)) return acc
    const raw = pedido.tamanhoCm.trim()
    const key = normalizeUnknownSizeKey(raw)
    if (!key) return acc

    const existing = acc[key]
    if (existing) {
      existing.total += 1
      if (isStatusServico(pedido.status)) existing.servicos += 1
      return acc
    }

    acc[key] = {
      key,
      raw,
      total: 1,
      servicos: isStatusServico(pedido.status) ? 1 : 0,
    }
    return acc
  }, {})

  const unknownSizes = Object.values(unknownSizesMap).sort((a, b) => b.total - a.total || a.raw.localeCompare(b.raw, 'pt-BR'))
  const unknownModelsMap = pedidos.reduce<Record<string, {
    key: string
    prefixo: string
    codigo: string
    total: number
    servicos: number
    testes: number
    tipoOutro: number
    tamanhoNaoIdentificado: number
  }>>((acc, pedido) => {
    const tipoOutro = pedido.tipoCaixa === 'Outro'
    const tamanhoNaoIdentificado = isUnknownSizeValue(pedido.tamanhoCm)
    if (!tipoOutro && !tamanhoNaoIdentificado) return acc

    const key = `${pedido.prefixo.trim().toLowerCase()}|${pedido.codigo.trim().toLowerCase()}`
    const existing = acc[key]
    if (existing) {
      existing.total += 1
      if (isStatusServico(pedido.status)) existing.servicos += 1
      if (isStatusTeste(pedido.status)) existing.testes += 1
      if (tipoOutro) existing.tipoOutro += 1
      if (tamanhoNaoIdentificado) existing.tamanhoNaoIdentificado += 1
      return acc
    }

    acc[key] = {
      key,
      prefixo: pedido.prefixo.trim(),
      codigo: pedido.codigo.trim(),
      total: 1,
      servicos: isStatusServico(pedido.status) ? 1 : 0,
      testes: isStatusTeste(pedido.status) ? 1 : 0,
      tipoOutro: tipoOutro ? 1 : 0,
      tamanhoNaoIdentificado: tamanhoNaoIdentificado ? 1 : 0,
    }
    return acc
  }, {})

  const unknownModels = Object.values(unknownModelsMap)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'pt-BR'))
    .slice(0, 40)

  const sortedRules = [...classificacaoRules].sort((a, b) => {
    const fieldCmp = a.matchField.localeCompare(b.matchField, 'pt-BR')
    if (fieldCmp !== 0) return fieldCmp
    return a.matchValue.localeCompare(b.matchValue, 'pt-BR')
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 120,
        overflowY: 'auto',
        padding: 'max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 700,
          borderRadius: 16,
          padding: 12,
          margin: '0 auto',
          maxHeight: 'calc(100dvh - 20px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, background: 'rgba(19,29,45,0.95)', paddingBottom: 8, zIndex: 2 }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', fontSize: 'clamp(16px, 5vw, 22px)', letterSpacing: '0.04em' }}>GESTAO DE DADOS</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Limpar por periodo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <input type="date" value={clearDate} onChange={(e) => setClearDate(e.target.value)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }} />
            <select value={clearPeriod} onChange={(e) => setClearPeriod(e.target.value as ClearPeriod)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }}>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <button onClick={handleClear} disabled={loadingClear} style={{ border: 'none', borderRadius: 8, background: 'rgba(244,63,94,0.18)', color: '#fb7185', padding: '0 12px', fontWeight: 700, cursor: 'pointer' }}>
              {loadingClear ? 'Limpando...' : 'Limpar'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Alterar operador por data</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }} />
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }}>
              <option value="">Operador origem</option>
              {operadores.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Novo operador"
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }}
            />
          </div>
          <button onClick={handleChangeOperador} disabled={loadingOp} style={{ border: 'none', borderRadius: 8, background: 'var(--cyan)', color: '#00131b', padding: '10px 12px', fontWeight: 700, cursor: 'pointer' }}>
            {loadingOp ? 'Aplicando...' : 'Aplicar alteracao'}
          </button>
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Tamanhos nao identificados</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Corrija tamanhos fora do padrao para um valor reconhecido (ex.: <code>35</code> ou <code>35x4</code>).
          </div>

          {unknownSizes.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhum tamanho nao identificado encontrado.</div>
          )}

          {unknownSizes.map((item) => (
            <div
              key={item.key}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.raw}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {fmt(item.total)} registro(s) - {fmt(item.servicos)} servico(s)
                </div>
              </div>
              <input
                value={unknownTargets[item.key] || ''}
                onChange={(event) =>
                  setUnknownTargets((current) => ({
                    ...current,
                    [item.key]: event.target.value,
                  }))
                }
                placeholder="Tamanho correto (35 ou 35x4)"
                style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
              />
              <button
                onClick={() => handleFixUnknownSize(item.key)}
                disabled={loadingUnknownKey === item.key}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  background: 'var(--cyan)',
                  color: '#00131b',
                  fontWeight: 700,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                {loadingUnknownKey === item.key ? 'Aplicando...' : 'Corrigir'}
              </button>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Modelos/prefixos para classificar</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Itens com tipo <code>Outro</code> ou tamanho nao identificado. Use os atalhos para preencher a regra.
          </div>

          {unknownModels.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhum item pendente de classificacao.</div>
          )}

          {unknownModels.map((item) => (
            <div
              key={item.key}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                marginTop: 8,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  {codigoComPrefixo(item.prefixo, item.codigo)}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {fmt(item.total)} registro(s) - {fmt(item.servicos)} servico(s) - {fmt(item.testes)} teste(s)
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Tipo Outro: {fmt(item.tipoOutro)} | Tamanho nao identificado: {fmt(item.tamanhoNaoIdentificado)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => prefFillRuleFromItem('prefixo', item.prefixo)}
                  disabled={!item.prefixo}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--ink-700)', color: 'var(--text-primary)', padding: '6px 10px', cursor: 'pointer' }}
                >
                  Usar prefixo {item.prefixo || '-'}
                </button>
                <button
                  onClick={() => prefFillRuleFromItem('codigo', item.codigo)}
                  disabled={!item.codigo}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--ink-700)', color: 'var(--text-primary)', padding: '6px 10px', cursor: 'pointer' }}
                >
                  Usar codigo {item.codigo || '-'}
                </button>
                <button
                  onClick={() => prefFillRuleFromItem('codigo', item.codigo, 'TESTE')}
                  disabled={!item.codigo}
                  style={{ border: 'none', borderRadius: 8, background: 'rgba(245,158,11,0.22)', color: '#f59e0b', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Marcar como TESTE
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Regras de classificacao (prefixo/codigo)</div>
          {!classificacaoRulesTableEnabled && (
            <div style={{ color: '#fb7185', fontSize: 12, marginBottom: 8 }}>
              A tabela <code>classificacao_regras</code> ainda nao existe no Supabase. Rode o SQL atualizado para habilitar cadastro/edicao.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 8 }}>
            <select
              value={ruleMatchField}
              onChange={(event) => setRuleMatchField(event.target.value as ClassificacaoMatchField)}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="prefixo">Prefixo</option>
              <option value="codigo">Codigo</option>
            </select>
            <input
              value={ruleMatchValue}
              onChange={(event) => setRuleMatchValue(event.target.value)}
              placeholder={ruleMatchField === 'prefixo' ? 'Valor do prefixo (ex.: 57)' : 'Valor do codigo (ex.: 958)'}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            />
            <select
              value={ruleStatusDestino}
              onChange={(event) => setRuleStatusDestino(event.target.value as 'AUTO' | 'SERVICO' | 'TESTE')}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="AUTO">Status: manter</option>
              <option value="SERVICO">Status: SERVICO</option>
              <option value="TESTE">Status: TESTE</option>
            </select>
            <select
              value={ruleTipoCaixaDestino}
              onChange={(event) => setRuleTipoCaixaDestino(event.target.value as 'AUTO' | 'Oitavada' | 'Maleta' | 'Quadrada' | 'Flexo' | 'Outro')}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="AUTO">Tipo: manter</option>
              <option value="Oitavada">Oitavada</option>
              <option value="Maleta">Maleta</option>
              <option value="Quadrada">Quadrada</option>
              <option value="Flexo">Flexo</option>
              <option value="Outro">Outro</option>
            </select>
            <input
              value={rulePrefixoDestino}
              onChange={(event) => setRulePrefixoDestino(event.target.value)}
              placeholder="Novo prefixo (opcional)"
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            />
            <input
              value={ruleTamanhoDestino}
              onChange={(event) => setRuleTamanhoDestino(event.target.value)}
              placeholder="Novo tamanho (35, 35x4...) opcional"
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: 12 }}>
              <input type="checkbox" checked={ruleActive} onChange={(event) => setRuleActive(event.target.checked)} />
              Regra ativa
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: 12 }}>
              <input type="checkbox" checked={ruleApplyToExisting} onChange={(event) => setRuleApplyToExisting(event.target.checked)} />
              Aplicar tambem nos dados ja importados
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              onClick={handleSaveRule}
              disabled={savingRule || !classificacaoRulesTableEnabled}
              style={{
                border: 'none',
                borderRadius: 8,
                background: !classificacaoRulesTableEnabled ? 'var(--ink-700)' : 'var(--cyan)',
                color: !classificacaoRulesTableEnabled ? 'var(--text-muted)' : '#00131b',
                fontWeight: 700,
                padding: '8px 12px',
                cursor: !classificacaoRulesTableEnabled ? 'not-allowed' : 'pointer',
              }}
            >
              {savingRule ? 'Salvando...' : ruleEditingId ? 'Atualizar regra' : 'Adicionar regra'}
            </button>
            {ruleEditingId && (
              <button
                onClick={resetRuleForm}
                style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--ink-700)', color: 'var(--text-primary)', padding: '8px 12px', cursor: 'pointer' }}
              >
                Cancelar edicao
              </button>
            )}
          </div>

          {sortedRules.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma regra cadastrada.</div>
          )}

          {sortedRules.map((rule) => (
            <div
              key={rule.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                marginTop: 8,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {matchFieldLabel(rule.matchField)}: <code>{rule.matchValue}</code> {rule.active ? '' : '(inativa)'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Status: {rule.statusDestino || 'manter'} | Tipo: {rule.tipoCaixaDestino || 'manter'} | Tamanho: {rule.tamanhoDestino || 'manter'} | Prefixo novo: {rule.prefixoDestino || 'manter'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => loadRuleToForm(rule)}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--ink-700)', color: 'var(--text-primary)', padding: '6px 10px', cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleRemoveRule(rule.id)}
                  disabled={removingRuleId === rule.id}
                  style={{ border: 'none', borderRadius: 8, background: 'rgba(244,63,94,0.18)', color: '#fb7185', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {removingRuleId === rule.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Solicitacoes de cadastro</div>
            <button
              onClick={() => onRefreshPendingProfiles()}
              disabled={loadingPendingProfiles}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--ink-700)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              {loadingPendingProfiles ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>

          <input
            value={pendingSearch}
            onChange={(event) => setPendingSearch(event.target.value)}
            placeholder="Buscar solicitacao por nome ou ID"
            style={{ width: '100%', background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px', marginBottom: 8 }}
          />

          {loadingPendingProfiles && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando solicitacoes...</div>
          )}

          {!loadingPendingProfiles && filteredPendingProfiles.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sem solicitacoes pendentes.</div>
          )}

          {!loadingPendingProfiles &&
            filteredPendingProfiles.map((pending) => (
              <div
                key={pending.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 8,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{pending.displayName || 'Sem nome'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, wordBreak: 'break-all' }}>ID: {pending.id}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Solicitado em: {formatDateTime(pending.createdAt)}</div>
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <select
                    value={pendingRoles[pending.id] || 'visualizador'}
                    onChange={(event) =>
                      setPendingRoles((current) => ({
                        ...current,
                        [pending.id]: event.target.value as UserRole,
                      }))
                    }
                    style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '6px 8px', minWidth: 136 }}
                  >
                    <option value="visualizador">Visualizador</option>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={() => onApprovePendingProfile(pending.id, pendingRoles[pending.id] || 'visualizador')}
                    disabled={approvingProfileId === pending.id}
                    style={{
                      border: 'none',
                      borderRadius: 8,
                      background: '#10b981',
                      color: '#012e20',
                      fontWeight: 700,
                      padding: '8px 10px',
                      minWidth: 92,
                      cursor: 'pointer',
                    }}
                  >
                    {approvingProfileId === pending.id ? 'Aprovando...' : 'Aprovar'}
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Gestao de operadores</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Adicione como operador usuarios ja cadastrados. Excluir operador remove o perfil operacional e volta para visualizador.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 10 }}>
            <select
              value={operatorCandidateId}
              onChange={(event) => setOperatorCandidateId(event.target.value)}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="">Selecionar usuario para adicionar como operador</option>
              {operatorCandidates.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName || 'Sem nome'} - {roleLabel(profile.role)} - {profile.active ? 'ativo' : 'inativo'}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddOperator}
              disabled={!operatorCandidateId || savingProfileId === operatorCandidateId}
              style={{
                border: 'none',
                borderRadius: 8,
                background: !operatorCandidateId ? 'var(--ink-700)' : 'var(--cyan)',
                color: !operatorCandidateId ? 'var(--text-muted)' : '#00131b',
                fontWeight: 700,
                padding: '8px 12px',
                cursor: !operatorCandidateId ? 'not-allowed' : 'pointer',
              }}
            >
              {savingProfileId === operatorCandidateId ? 'Adicionando...' : 'Adicionar operador'}
            </button>
          </div>

          {activeOperators.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhum operador ativo no momento.</div>
          )}

          {activeOperators.map((operator) => (
            <div
              key={operator.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 8,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{operator.displayName || 'Sem nome'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, wordBreak: 'break-all' }}>ID: {operator.id}</div>
              </div>
              <button
                onClick={() => handleRemoveOperator(operator.id)}
                disabled={savingProfileId === operator.id}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  background: 'rgba(244,63,94,0.18)',
                  color: '#fb7185',
                  fontWeight: 700,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                {savingProfileId === operator.id ? 'Excluindo...' : 'Excluir operador'}
              </button>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Permissoes de usuarios</div>
            <button
              onClick={() => onRefreshManagedProfiles()}
              disabled={loadingManagedProfiles}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--ink-700)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              {loadingManagedProfiles ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input
              value={managedSearch}
              onChange={(event) => setManagedSearch(event.target.value)}
              placeholder="Buscar usuario por nome ou ID"
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            />
            <select
              value={managedRoleFilter}
              onChange={(event) => setManagedRoleFilter(event.target.value as 'todos' | UserRole)}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="todos">Todos perfis</option>
              <option value="visualizador">Visualizador</option>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              value={managedStatusFilter}
              onChange={(event) => setManagedStatusFilter(event.target.value as 'todos' | 'ativos' | 'inativos')}
              style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
            >
              <option value="todos">Todos status</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
            {filteredManagedProfiles.length} usuario(s) no filtro
          </div>

          {loadingManagedProfiles && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando usuarios...</div>
          )}

          {!loadingManagedProfiles && filteredManagedProfiles.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhum usuario encontrado.</div>
          )}

          {!loadingManagedProfiles &&
            filteredManagedProfiles.map((managed) => {
              const edit = managedEdits[managed.id] || { role: managed.role, active: managed.active }
              const isSelf = managed.id === currentUserId
              const changed = edit.role !== managed.role || edit.active !== managed.active
              const roleStyle = roleColors(managed.role)
              const statusStyle = statusColors(managed.active)
              return (
                <div
                  key={managed.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 10,
                    marginTop: 8,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{managed.displayName || 'Sem nome'} {isSelf ? '(voce)' : ''}</span>
                      <span style={{ border: `1px solid ${roleStyle.border}`, borderRadius: 999, padding: '2px 8px', fontSize: 10, color: roleStyle.color, background: roleStyle.bg }}>
                        {roleLabel(managed.role)}
                      </span>
                      <span style={{ border: `1px solid ${statusStyle.border}`, borderRadius: 999, padding: '2px 8px', fontSize: 10, color: statusStyle.color, background: statusStyle.bg }}>
                        {managed.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, wordBreak: 'break-all' }}>ID: {managed.id}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Criado em: {formatDateTime(managed.createdAt)}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, alignItems: 'center' }}>
                    <select
                      value={edit.role}
                      onChange={(event) =>
                        setManagedEdits((current) => ({
                          ...current,
                          [managed.id]: {
                            role: event.target.value as UserRole,
                            active: current[managed.id]?.active ?? managed.active,
                          },
                        }))
                      }
                      style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px' }}
                    >
                      <option value="visualizador">Visualizador</option>
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={edit.active}
                        onChange={(event) =>
                          setManagedEdits((current) => ({
                            ...current,
                            [managed.id]: {
                              role: current[managed.id]?.role ?? managed.role,
                              active: event.target.checked,
                            },
                          }))
                        }
                        disabled={isSelf}
                      />
                      Ativo
                    </label>

                    <button
                      onClick={() => onUpdateProfileAccess(managed.id, edit.role, edit.active)}
                      disabled={!changed || savingProfileId === managed.id}
                      style={{
                        border: 'none',
                        borderRadius: 8,
                        background: changed ? 'var(--cyan)' : 'var(--ink-700)',
                        color: changed ? '#00131b' : 'var(--text-muted)',
                        fontWeight: 700,
                        padding: '8px 10px',
                        cursor: changed ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {savingProfileId === managed.id ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>

                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Perfil atual: {roleLabel(managed.role)} {managed.active ? '- ativo' : '- pendente/inativo'}
                  </div>
                </div>
              )
            })}
        </div>

        {error && <div style={{ marginTop: 10, color: '#fb7185', fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  )
}

function ResumoTab({ pedidos, isAdmin }: { pedidos: Pedido[]; isAdmin: boolean }) {
  const k = calcKPIs(pedidos)
  const tipos = porTipo(pedidos)
  const dias = porDia(pedidos)
  const servicos = soServicos(pedidos)
  const meses = Array.from(new Set(servicos.map((pedido) => pedido.mes).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const [mesSelecionado, setMesSelecionado] = useState(meses[meses.length - 1] || '')
  useEffect(() => {
    if (!meses.length) {
      setMesSelecionado('')
      return
    }
    if (!meses.includes(mesSelecionado)) {
      setMesSelecionado(meses[meses.length - 1])
    }
  }, [mesSelecionado, meses])

  const servicosMes = mesSelecionado ? servicos.filter((pedido) => pedido.mes === mesSelecionado) : servicos
  const kMes = calcKPIs(servicosMes)
  const diasAtivosMes = new Set(servicosMes.map((pedido) => pedido.data)).size
  const mediaServicosDiaMes = diasAtivosMes ? servicosMes.length / diasAtivosMes : 0
  const operadoresMes = Array.from(new Set(servicosMes.map((pedido) => pedido.operador))).length
  const operadores = porOperador(pedidos).sort((a, b) => b.caixas - a.caixas)
  const maquina = resumoMaquinaGeral(pedidos)
  const ultimoDia = dias[dias.length - 1]
  const penultimoDia = dias[dias.length - 2]
  const tendenciaCaixas = percentDelta(ultimoDia?.caixas || 0, penultimoDia?.caixas || 0)
  if (!pedidos.length) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Importe dados para visualizar o resumo.</div>

  return (
    <div style={{ padding: 14, paddingBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        <MetricCard title="Caixas de Servico" value={fmt(k.totalCaixas)} hint={`${fmt(k.totalPedidos)} pedidos validos`} icon={<TrendingUp size={14} />} />
        <MetricCard title="Chapas" value={fmt(k.totalChapas)} hint={`Media ${fmt(k.mediaCaixasPorPedido)} cx/pedido`} icon={<Factory size={14} />} />
        <MetricCard title="Tinta Total" value={`${fmt(Math.round(k.totalTintaMl))} ml`} hint={`${k.totalAreaMq.toFixed(2)} m2 de area`} icon={<span style={{ fontWeight: 700 }}>C+M+Y+K</span>} />
        <MetricCard
          title="Tendencia do Ultimo Dia"
          value={`${tendenciaCaixas >= 0 ? '+' : ''}${tendenciaCaixas.toFixed(1)}%`}
          hint={ultimoDia ? `${ultimoDia.data} vs ${penultimoDia?.data || 'sem base anterior'}` : 'Sem dados diários'}
          icon={<UserRound size={14} />}
        />
        {isAdmin && (
          <MetricCard
            title="Media da Maquina"
            value={`${maquina.mediaServicosPorDia.toFixed(1)} serv/dia`}
            hint="Servicos validos por dia ativo"
            icon={<Factory size={14} />}
          />
        )}
      </div>

      <TableCard title="Resumo do Mes">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Mes de referencia dos dados importados</div>
            <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px', minWidth: 130 }}>
              {meses.map((mes) => <option key={mes} value={mes}>{mesLabel(mes)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Servicos no mes</div>
              <div className="big-number" style={{ fontSize: 22 }}>{fmt(kMes.totalPedidos)}</div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Caixas no mes</div>
              <div className="big-number" style={{ fontSize: 22 }}>{fmt(kMes.totalCaixas)}</div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Media maquina (serv/dia)</div>
              <div className="big-number" style={{ fontSize: 22 }}>{mediaServicosDiaMes.toFixed(1)}</div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Operadores ativos no mes</div>
              <div className="big-number" style={{ fontSize: 22 }}>{fmt(operadoresMes)}</div>
            </div>
          </div>
        </div>
      </TableCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <ChartCard title="Ritmo de Producao" subtitle="Caixas e chapas por dia (somente servicos)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dias} margin={{ top: 10, right: 14, left: -8, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="data" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [fmt(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="caixas" stroke="#00d4ff" strokeWidth={2.2} name="Caixas" dot={{ r: 2 }} />
              <Line type="monotone" dataKey="chapas" stroke="#f59e0b" strokeWidth={1.8} name="Chapas" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tipos de Caixa" subtitle="Participacao por volume de caixas">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={tipos}
                dataKey="caixas"
                nameKey="tipo"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={92}
                paddingAngle={3}
              >
                {tipos.map((item) => (
                  <Cell key={item.tipo} fill={TIPO_CORES[item.tipo] || '#00d4ff'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [`${fmt(Number(value))} caixas`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Ranking de Operadores" subtitle="Comparativo por caixas produzidas" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={operadores} layout="vertical" margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
            <YAxis dataKey="operador" type="category" tick={{ fill: '#e8e4dc', fontSize: 11 }} width={90} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              cursor={false}
              formatter={(value: number, name: string) => [fmt(Number(value)), chartSerieLabel(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="caixas" fill="#00d4ff" radius={[0, 6, 6, 0]} name="Caixas" />
            <Bar dataKey="pedidos" fill="#10b981" radius={[0, 6, 6, 0]} name="Pedidos" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <TableCard title="Tipos de Caixa">
        <table className="data-table">
          <thead><tr><th>Tipo</th><th style={{ textAlign: 'right' }}>Pedidos</th><th style={{ textAlign: 'right' }}>Caixas</th></tr></thead>
          <tbody>{tipos.map((t) => <tr key={t.tipo}><td>{t.tipo}</td><td style={{ textAlign: 'right' }}>{fmt(t.pedidos)}</td><td style={{ textAlign: 'right' }}>{fmt(t.caixas)}</td></tr>)}</tbody>
        </table>
      </TableCard>
      <TableCard title="Dias de Producao">
        <table className="data-table">
          <thead><tr><th>Data</th><th style={{ textAlign: 'right' }}>Pedidos</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th></tr></thead>
          <tbody>{dias.map((d) => <tr key={d.data}><td>{d.data}</td><td style={{ textAlign: 'right' }}>{fmt(d.pedidos)}</td><td style={{ textAlign: 'right' }}>{fmt(d.chapas)}</td><td style={{ textAlign: 'right' }}>{fmt(d.caixas)}</td></tr>)}</tbody>
        </table>
      </TableCard>
    </div>
  )
}

function DinamicaTab({ pedidos }: { pedidos: Pedido[] }) {
  const svcs = soServicos(pedidos)
  const tamanhos = Array.from(new Set(svcs.map((p) => tamanhoChave(p.tamanhoCm))))
  const combos = Array.from(new Set(svcs.map((p) => `${p.data}|${p.operador}`)))
  const totalByCombo = (data: string, op: string, tam: string) => svcs.filter((p) => p.data === data && p.operador === op && tamanhoChave(p.tamanhoCm) === tam).reduce((a, p) => a + p.caixasProduzidas, 0)
  if (!pedidos.length) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Importe dados para ver a tabela dinamica.</div>
  return (
    <div style={{ padding: 14, paddingBottom: 24 }}>
      <TableCard title="Tabela Dinamica (Data x Operador x Tamanho)">
        <div className="mobile-h-scroll">
          <table className="data-table" style={{ minWidth: 700 }}>
            <thead><tr><th>Data</th><th>Operador</th>{tamanhos.map((t) => <th key={t} style={{ textAlign: 'right' }}>{tamanhoRotulo(t)}</th>)}</tr></thead>
            <tbody>{combos.map((c) => { const [data, op] = c.split('|'); return <tr key={c}><td>{data}</td><td>{op}</td>{tamanhos.map((t) => <td key={`${c}-${t}`} style={{ textAlign: 'right' }}>{fmt(totalByCombo(data, op, t))}</td>)}</tr> })}</tbody>
          </table>
        </div>
      </TableCard>
    </div>
  )
}

function ProdutosTab({ pedidos }: { pedidos: Pedido[] }) {
  const [busca, setBusca] = useState('')
  const deferred = useDeferredValue(busca)
  const map: Record<string, { codigo: string; nome: string; tipo: string; chapas: number; caixas: number; dias: Set<string>; operadores: Set<string>; tinta: number }> = {}
  soServicos(pedidos).forEach((p) => {
    const codigo = codigoComPrefixo(p.prefixo, p.codigo)
    if (!map[codigo]) map[codigo] = { codigo, nome: p.nomeCliente, tipo: p.tipoCaixa, chapas: 0, caixas: 0, dias: new Set(), operadores: new Set(), tinta: 0 }
    const r = map[codigo]
    r.chapas += p.chapasImpressas
    r.caixas += p.caixasProduzidas
    r.tinta += p.tintaTotal
    r.dias.add(p.data)
    r.operadores.add(p.operador)
  })
  const rows = Object.values(map)
    .filter((r) => !deferred || r.nome.toLowerCase().includes(deferred.toLowerCase()) || r.codigo.toLowerCase().includes(deferred.toLowerCase()))
    .sort((a, b) => b.caixas - a.caixas)
  if (!pedidos.length) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Importe dados para ver produtos.</div>
  return (
    <div style={{ padding: 14, paddingBottom: 24 }}>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." style={{ width: '100%', marginBottom: 10, background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }} />
      <TableCard title="Analise por Produto">
        <table className="data-table">
          <thead><tr><th>Prefixo + Codigo</th><th>Cliente</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th><th style={{ textAlign: 'right' }}>Dias</th><th>Operadores</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.codigo}><td>{r.codigo}</td><td>{r.nome}</td><td>{r.tipo}</td><td style={{ textAlign: 'right' }}>{fmt(r.chapas)}</td><td style={{ textAlign: 'right' }}>{fmt(r.caixas)}</td><td style={{ textAlign: 'right' }}>{fmt(r.dias.size)}</td><td>{Array.from(r.operadores).join(', ')}</td></tr>)}</tbody>
        </table>
      </TableCard>
    </div>
  )
}

function PedidosTab({ pedidos }: { pedidos: Pedido[] }) {
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'todos' | 'servico' | 'teste'>('servico')
  const deferred = useDeferredValue(busca)
  const rows = pedidos
    .filter((p) => status === 'todos' || (status === 'servico' ? isStatusServico(p.status) : isStatusTeste(p.status)))
    .filter((p) => !deferred || p.nomeCliente.toLowerCase().includes(deferred.toLowerCase()) || p.orderID.toLowerCase().includes(deferred.toLowerCase()) || p.codigo.toLowerCase().includes(deferred.toLowerCase()) || p.prefixo.toLowerCase().includes(deferred.toLowerCase()) || codigoComPrefixo(p.prefixo, p.codigo).toLowerCase().includes(deferred.toLowerCase()))
  const totalServicos = pedidos.filter((p) => isStatusServico(p.status)).length
  const totalTestes = pedidos.filter((p) => isStatusTeste(p.status)).length
  const caixasFiltro = rows.reduce((acc, item) => acc + item.caixasProduzidas, 0)
  const tintaFiltro = rows.reduce((acc, item) => acc + item.tintaTotal, 0)
  if (!pedidos.length) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Importe dados para ver pedidos.</div>
  return (
    <div style={{ padding: 14, paddingBottom: 24 }}>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Pedidos no filtro</div>
            <div className="big-number" style={{ fontSize: 24 }}>{fmt(rows.length)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Caixas no filtro</div>
            <div className="big-number" style={{ fontSize: 24 }}>{fmt(caixasFiltro)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tinta no filtro</div>
            <div className="big-number" style={{ fontSize: 24 }}>{fmt(Math.round(tintaFiltro))} ml</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Base total: {fmt(totalServicos)} servicos / {fmt(totalTestes)} testes</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pedidos.length ? (totalServicos / pedidos.length) * 100 : 0}%`, background: 'var(--emerald)' }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, marginBottom: 10 }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." style={{ background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: 10 }} />
        <button onClick={() => setStatus('todos')} style={{ border: 'none', borderRadius: 8, padding: '0 10px', background: status === 'todos' ? 'var(--cyan)' : 'var(--ink-700)', color: status === 'todos' ? '#00131b' : 'var(--text-muted)' }}>Todos</button>
        <button onClick={() => setStatus('servico')} style={{ border: 'none', borderRadius: 8, padding: '0 10px', background: status === 'servico' ? 'var(--cyan)' : 'var(--ink-700)', color: status === 'servico' ? '#00131b' : 'var(--text-muted)' }}>Servicos</button>
        <button onClick={() => setStatus('teste')} style={{ border: 'none', borderRadius: 8, padding: '0 10px', background: status === 'teste' ? 'var(--cyan)' : 'var(--ink-700)', color: status === 'teste' ? '#00131b' : 'var(--text-muted)' }}>Testes</button>
        <button onClick={() => downloadCsv(rows)} style={{ border: 'none', borderRadius: 8, padding: '0 10px', background: 'var(--amber)', color: '#221100', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={13} />CSV</button>
      </div>
      <TableCard title={`Pedidos (${rows.length})`}>
        <div className="mobile-h-scroll">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead><tr><th>Data</th><th>Operador</th><th>Status</th><th>Cliente</th><th>Prefixo + Codigo</th><th>Tam</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Imgs</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th><th style={{ textAlign: 'right' }}>Tinta(ml)</th></tr></thead>
            <tbody>{rows.map((p, i) => <tr key={`${p.orderID}-${i}`}><td>{p.data}</td><td>{p.operador}</td><td>{formatStatusLabel(p.status)}</td><td>{p.nomeCliente}</td><td>{codigoComPrefixo(p.prefixo, p.codigo)}</td><td>{tamanhoRotulo(p.tamanhoCm)}</td><td>{p.tipoCaixa}</td><td style={{ textAlign: 'right' }}>{fmt(p.qtdImagens)}</td><td style={{ textAlign: 'right' }}>{fmt(p.chapasImpressas)}</td><td style={{ textAlign: 'right' }}>{fmt(p.caixasProduzidas)}</td><td style={{ textAlign: 'right' }}>{fmt(Math.round(p.tintaTotal))}</td></tr>)}</tbody>
          </table>
        </div>
      </TableCard>
    </div>
  )
}

function OperadoresTab({ pedidos }: { pedidos: Pedido[] }) {
  const ops = porOperador(pedidos)
  const opsOrdenados = [...ops].sort((a, b) => b.caixas - a.caixas)
  const maquina = resumoMaquinaGeral(pedidos)
  const diaOp = resumoDiaOperador(pedidos)
  const historico = soServicos(pedidos)
  const topOperadores = opsOrdenados.slice(0, 3).map((o) => o.operador)
  const coresSeries = ['#00d4ff', '#10b981', '#f59e0b']
  const diasOrdenados = Array.from(new Set(diaOp.map((d) => d.data))).sort((a, b) => toIsoDate(a).localeCompare(toIsoDate(b)))
  const evolucaoTopOps = diasOrdenados.map((data) => {
    const row: Record<string, string | number> = { data }
    topOperadores.forEach((operador) => {
      row[operador] = diaOp
        .filter((item) => item.data === data && item.operador === operador)
        .reduce((acc, item) => acc + item.caixas, 0)
    })
    return row
  })

  if (!pedidos.length) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Importe dados para ver operadores.</div>
  return (
    <div style={{ padding: 14, paddingBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <ChartCard title="Efetividade por Operador" subtitle="Caixas totais x media de servicos por dia">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={opsOrdenados} margin={{ top: 8, right: 18, left: -8, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <XAxis dataKey="operador" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [name === 'mediaServicosPorDia' ? Number(value).toFixed(1) : fmt(Number(value)), name === 'caixas' ? 'Caixas' : 'Media Servicos/Dia']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="caixas" fill="#00d4ff" name="Caixas" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="mediaServicosPorDia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Media Servicos/Dia" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolucao dos Top Operadores" subtitle="Caixas por dia para os 3 maiores volumes">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoTopOps} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="data" tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8a9ab5', fontSize: 11 }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [fmt(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {topOperadores.map((operador, index) => (
                <Line
                  key={operador}
                  type="monotone"
                  dataKey={operador}
                  stroke={coresSeries[index % coresSeries.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TableCard title="KPIs por Operador + Maquina Geral">
        <table className="data-table">
          <thead><tr><th>Operador</th><th style={{ textAlign: 'right' }}>Pedidos</th><th style={{ textAlign: 'right' }}>Media Serv/Dia</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th><th style={{ textAlign: 'right' }}>Media Cx/Ped</th><th style={{ textAlign: 'right' }}>Tinta Total</th><th style={{ textAlign: 'right' }}>Media Tinta/Ped</th><th>Tam Mais Prod</th></tr></thead>
          <tbody>{[...ops, maquina].map((o) => <tr key={o.operador}><td>{o.operador}</td><td style={{ textAlign: 'right' }}>{fmt(o.pedidos)}</td><td style={{ textAlign: 'right' }}>{o.mediaServicosPorDia.toFixed(1)}</td><td style={{ textAlign: 'right' }}>{fmt(o.chapas)}</td><td style={{ textAlign: 'right' }}>{fmt(o.caixas)}</td><td style={{ textAlign: 'right' }}>{o.mediaCaixasPorPedido.toFixed(1)}</td><td style={{ textAlign: 'right' }}>{fmt(Math.round(o.tinta))}</td><td style={{ textAlign: 'right' }}>{o.mediaTintaPorPedido.toFixed(1)}</td><td>{o.tamanhoMaisProduzido}</td></tr>)}</tbody>
        </table>
      </TableCard>
      <TableCard title="Resumo por Dia e Operador">
        <table className="data-table">
          <thead><tr><th>Data</th><th>Operador</th><th style={{ textAlign: 'right' }}>Pedidos</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th><th style={{ textAlign: 'right' }}>Media Cx/Ped</th><th style={{ textAlign: 'right' }}>Tinta Total</th><th>Tam Mais Prod</th></tr></thead>
          <tbody>{diaOp.map((d) => <tr key={`${d.data}-${d.operador}`}><td>{d.data}</td><td>{d.operador}</td><td style={{ textAlign: 'right' }}>{fmt(d.pedidos)}</td><td style={{ textAlign: 'right' }}>{fmt(d.chapas)}</td><td style={{ textAlign: 'right' }}>{fmt(d.caixas)}</td><td style={{ textAlign: 'right' }}>{d.mediaCaixasPorPedido.toFixed(1)}</td><td style={{ textAlign: 'right' }}>{fmt(Math.round(d.tinta))}</td><td>{d.tamanhoMaisProduzido}</td></tr>)}</tbody>
        </table>
      </TableCard>
      <TableCard title="Historico Completo (Servicos)">
        <div className="mobile-h-scroll">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead><tr><th>#</th><th>Data</th><th>Operador</th><th>Prefixo + Codigo</th><th>Tam</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Imgs</th><th style={{ textAlign: 'right' }}>Chapas</th><th style={{ textAlign: 'right' }}>Caixas</th><th>Calculo</th><th style={{ textAlign: 'right' }}>Tinta</th></tr></thead>
            <tbody>{historico.map((p, i) => <tr key={`${p.orderID}-${i}`}><td>{i + 1}</td><td>{p.data}</td><td>{p.operador}</td><td>{codigoComPrefixo(p.prefixo, p.codigo)}</td><td>{tamanhoRotulo(p.tamanhoCm)}</td><td>{p.tipoCaixa}</td><td style={{ textAlign: 'right' }}>{fmt(p.qtdImagens)}</td><td style={{ textAlign: 'right' }}>{fmt(p.chapasImpressas)}</td><td style={{ textAlign: 'right' }}>{fmt(p.caixasProduzidas)}</td><td>{p.chapasImpressas}x{p.qtdImagens}={p.caixasProduzidas}</td><td style={{ textAlign: 'right' }}>{fmt(Math.round(p.tintaTotal))}</td></tr>)}</tbody>
          </table>
        </div>
      </TableCard>
    </div>
  )
}

export default function App() {
  const {
    pedidos,
    addPedidos,
    clearByPeriod,
    updateOperadorByDate,
    loaded,
    session,
    profile,
    isAdmin,
    signOut,
    migrateLegacyPedidos,
    legacyCount,
    supabaseEnabled,
    canImport,
    listPendingProfiles,
    listProfiles,
    approveProfile,
    updateProfileAccess,
    updateTamanhoNaoIdentificado,
    classificacaoRules,
    classificacaoRulesTableEnabled,
    saveClassificacaoRegra,
    removeClassificacaoRegra,
  } = usePedidos()
  const [tab, setTab] = useState<TabId>('resumo')
  const [modal, setModal] = useState(false)
  const [adminModal, setAdminModal] = useState(false)
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([])
  const [loadingPendingProfiles, setLoadingPendingProfiles] = useState(false)
  const [managedProfiles, setManagedProfiles] = useState<ManagedProfile[]>([])
  const [loadingManagedProfiles, setLoadingManagedProfiles] = useState(false)
  const [approvingProfileId, setApprovingProfileId] = useState('')
  const [savingProfileId, setSavingProfileId] = useState('')
  const [toast, setToast] = useState('')
  const [migrando, setMigrando] = useState(false)
  const operadores = Array.from(new Set([profile?.displayName || '', 'Gesleyson', 'Reinaldo', ...pedidos.map((p) => p.operador)].filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const activeTab: TabId = !isAdmin && tab === 'operadores' ? 'resumo' : tab
  const navTabs: Array<readonly [TabId, string]> = isAdmin
    ? [
      ['resumo', 'Resumo'],
      ['dinamica', 'Dinamica'],
      ['produtos', 'Produtos'],
      ['pedidos', 'Pedidos'],
      ['operadores', 'Equipe'],
    ]
    : [
      ['resumo', 'Resumo'],
      ['dinamica', 'Dinamica'],
      ['produtos', 'Produtos'],
      ['pedidos', 'Pedidos'],
    ]

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function refreshPendingProfiles() {
    if (!isAdmin) return
    setLoadingPendingProfiles(true)
    try {
      const items = await listPendingProfiles()
      setPendingProfiles(items)
    } catch (error) {
      showToast(`Erro ao carregar solicitacoes: ${(error as Error).message}`)
    } finally {
      setLoadingPendingProfiles(false)
    }
  }

  async function refreshManagedProfiles() {
    if (!isAdmin) return
    setLoadingManagedProfiles(true)
    try {
      const items = await listProfiles()
      setManagedProfiles(items)
    } catch (error) {
      showToast(`Erro ao carregar usuarios: ${(error as Error).message}`)
    } finally {
      setLoadingManagedProfiles(false)
    }
  }

  async function onImport(novos: Pedido[], info: string) {
    try {
      const res = await addPedidos(novos)
      setModal(false)
      showToast(res.duplicatas > 0 ? `${res.adicionados} importados • ${res.duplicatas} duplicados` : info)
    } catch (error) {
      showToast(`Erro ao importar: ${(error as Error).message}`)
    }
  }

  async function onMigrate() {
    setMigrando(true)
    try {
      const r = await migrateLegacyPedidos()
      showToast(`Migracao local: ${r.inseridos} inseridos • ${r.duplicados} duplicados • ${r.falhas} falhas`)
    } catch (error) {
      showToast(`Erro na migracao: ${(error as Error).message}`)
    } finally {
      setMigrando(false)
    }
  }

  async function onClearPeriod(dateIso: string, period: ClearPeriod) {
    const report = await clearByPeriod(dateIso, period)
    const periodLabel = period === 'day' ? 'dia' : period === 'week' ? 'semana' : 'mes'
    showToast(`${report.removidos} registro(s) removidos - ${periodLabel}: ${report.intervalo}`)
  }

  async function onUpdateOperador(dateIso: string, origem: string, destino: string) {
    const report = await updateOperadorByDate(dateIso, origem, destino)
    if (!report.total) {
      showToast('Nenhum registro encontrado para a data e operador informados')
      return
    }
    showToast(`Operador atualizado: ${report.atualizados} sucesso(s) e ${report.conflitos} conflito(s)`)
  }

  async function onUpdateUnknownSize(tamanhoOrigem: string, tamanhoDestino: string) {
    const report = await updateTamanhoNaoIdentificado(tamanhoOrigem, tamanhoDestino)
    if (!report.total) {
      showToast('Nenhum registro com esse tamanho nao identificado foi encontrado')
      return
    }
    showToast(`Tamanho corrigido em ${report.atualizados} registro(s)`)
  }

  async function onSaveClassificacaoRegra(input: SaveClassificacaoRegraInput) {
    const report = await saveClassificacaoRegra(input)
    if (report.atualizados > 0) {
      showToast(`Regra salva e aplicada em ${report.atualizados} registro(s)`)
      return report
    }
    showToast('Regra salva com sucesso')
    return report
  }

  async function onRemoveClassificacaoRegra(ruleId: number) {
    await removeClassificacaoRegra(ruleId)
    showToast('Regra removida com sucesso')
  }

  async function onApprovePendingProfile(profileId: string, role: UserRole) {
    setApprovingProfileId(profileId)
    try {
      await approveProfile(profileId, role)
      showToast('Cadastro aprovado com sucesso')
      await Promise.all([refreshPendingProfiles(), refreshManagedProfiles()])
    } catch (error) {
      showToast(`Erro ao aprovar cadastro: ${(error as Error).message}`)
    } finally {
      setApprovingProfileId('')
    }
  }

  async function onUpdateProfileAccess(profileId: string, role: UserRole, active: boolean): Promise<boolean> {
    setSavingProfileId(profileId)
    try {
      await updateProfileAccess(profileId, role, active)
      showToast('Permissao atualizada com sucesso')
      await Promise.all([refreshPendingProfiles(), refreshManagedProfiles()])
      return true
    } catch (error) {
      showToast(`Erro ao atualizar permissao: ${(error as Error).message}`)
      return false
    } finally {
      setSavingProfileId('')
    }
  }

  useEffect(() => {
    if (!adminModal || !isAdmin) return
    Promise.all([refreshPendingProfiles(), refreshManagedProfiles()]).catch(() => {
      // erros tratados nas funcoes de refresh
    })
  }, [adminModal, isAdmin])

  if (!loaded) {
    return <div className="z-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><Factory size={34} color="var(--cyan)" /><span style={{ color: 'var(--text-muted)' }}>Carregando...</span></div></div>
  }

  if (!session?.user) {
    if (!supabaseEnabled) {
      return (
        <div className="z-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>
          Configure as envs <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para habilitar login e banco.
        </div>
      )
    }
    return <div className="z-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>Sem sessao. Acesse <a href="/login" style={{ color: 'var(--cyan)' }}>/login</a>.</div>
  }

  if (!profile) {
    return <div className="z-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', padding: 20 }}>Perfil nao encontrado na tabela <code>profiles</code> do Supabase.</div>
  }

  if (!profile.active) {
    return (
      <div className="z-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 520, padding: 18 }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>Cadastro pendente</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 14 }}>
            Seu cadastro foi criado, mas ainda precisa de aprovacao do administrador.
          </div>
          <button
            onClick={() => signOut()}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--ink-700)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="z-content">
      <header style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(10px)', background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>PAINEL PRODUCAO</div>
            <select
              value={activeTab}
              onChange={(event) => setTab(event.target.value as TabId)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--ink-700)',
                color: 'var(--text-primary)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
              aria-label="Selecionar aba"
            >
              {navTabs.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{profile.displayName} • {roleLabel(profile.role)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ThemeModeControl />
          {isAdmin && <button onClick={() => setAdminModal(true)} style={{ border: '1px solid rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.14)', color: '#fb7185', borderRadius: 8, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Settings2 size={13} />Gestao</button>}
          <button onClick={() => signOut()} style={{ border: '1px solid var(--border)', background: 'var(--ink-700)', color: 'var(--text-primary)', borderRadius: 8, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogOut size={13} />Sair</button>
        </div>
      </header>

      {legacyCount > 0 && (
        <div style={{ padding: '10px 14px 0' }}>
          <div className="card" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{legacyCount} registro(s) local(is) encontrado(s) para migracao.</div>
              <button onClick={onMigrate} disabled={migrando} style={{ border: 'none', background: '#10b981', color: '#02150f', borderRadius: 8, padding: '6px 10px', fontWeight: 700 }}>{migrando ? 'Migrando...' : 'Migrar'}</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resumo' && <ResumoTab pedidos={pedidos} isAdmin={isAdmin} />}
      {activeTab === 'dinamica' && <DinamicaTab pedidos={pedidos} />}
      {activeTab === 'produtos' && <ProdutosTab pedidos={pedidos} />}
      {activeTab === 'pedidos' && <PedidosTab pedidos={pedidos} />}
      {activeTab === 'operadores' && <OperadoresTab pedidos={pedidos} />}

      {canImport && (
        <button onClick={() => setModal(true)} style={{ position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 30, width: 52, height: 52, borderRadius: 999, border: 'none', background: 'var(--cyan)', color: '#06202d', display: 'grid', placeItems: 'center', boxShadow: '0 0 24px rgba(0,212,255,0.45)' }}>
          <Upload size={18} />
        </button>
      )}

      {modal && <UploadModal onClose={() => setModal(false)} onImport={onImport} operadores={operadores} />}
      {adminModal && isAdmin && (
        <AdminToolsModal
          onClose={() => setAdminModal(false)}
          onClearPeriod={onClearPeriod}
          onUpdateOperador={onUpdateOperador}
          onUpdateUnknownSize={onUpdateUnknownSize}
          classificacaoRules={classificacaoRules}
          classificacaoRulesTableEnabled={classificacaoRulesTableEnabled}
          onSaveClassificacaoRegra={onSaveClassificacaoRegra}
          onRemoveClassificacaoRegra={onRemoveClassificacaoRegra}
          operadores={operadores}
          pedidos={pedidos}
          pendingProfiles={pendingProfiles}
          loadingPendingProfiles={loadingPendingProfiles}
          managedProfiles={managedProfiles}
          loadingManagedProfiles={loadingManagedProfiles}
          approvingProfileId={approvingProfileId}
          savingProfileId={savingProfileId}
          currentUserId={session.user.id}
          onRefreshPendingProfiles={refreshPendingProfiles}
          onRefreshManagedProfiles={refreshManagedProfiles}
          onApprovePendingProfile={onApprovePendingProfile}
          onUpdateProfileAccess={onUpdateProfileAccess}
        />
      )}
      {toast && <div style={{ position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--ink-700)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px', fontSize: 12 }}>{toast}</div>}
    </div>
  )
}
