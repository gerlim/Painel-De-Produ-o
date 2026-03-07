'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  parseTamanho,
  sanitizeLegacyPedido,
  toPedido,
  toPedidoInsertRow,
  type Pedido,
  type StatusPedido,
  type TipoCaixa,
} from './parser'
import { getSupabaseBrowserClient } from './supabase/client'

const LEGACY_STORAGE_KEYS = ['producao_pedidos', 'delpapeis_pedidos']

export type UserRole = 'admin' | 'operador' | 'visualizador'
export type ClearPeriod = 'day' | 'week' | 'month'
export type ClassificacaoMatchField = 'prefixo' | 'codigo'

export interface UserProfile {
  id: string
  role: UserRole
  displayName: string
  active: boolean
}

export interface PendingProfile {
  id: string
  role: UserRole
  displayName: string
  active: boolean
  createdAt: string
}

export interface ManagedProfile {
  id: string
  role: UserRole
  displayName: string
  active: boolean
  createdAt: string
}

export interface ClassificacaoRegra {
  id: number
  matchField: ClassificacaoMatchField
  matchValue: string
  statusDestino: StatusPedido | null
  tipoCaixaDestino: TipoCaixa | null
  tamanhoDestino: string | null
  prefixoDestino: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveClassificacaoRegraInput {
  id?: number
  matchField: ClassificacaoMatchField
  matchValue: string
  statusDestino: StatusPedido | null
  tipoCaixaDestino: TipoCaixa | null
  tamanhoDestino: string | null
  prefixoDestino: string | null
  active: boolean
  applyToExisting: boolean
}

export interface SaveClassificacaoRegraReport {
  id: number
  atualizados: number
}

interface AddPedidosResult {
  adicionados: number
  duplicatas: number
}

interface MigrationReport {
  inseridos: number
  duplicados: number
  falhas: number
  totalLocal: number
}

interface ClearByPeriodReport {
  removidos: number
  intervalo: string
}

interface UpdateOperadorReport {
  atualizados: number
  conflitos: number
  total: number
}

interface UpdateTamanhoReport {
  atualizados: number
  total: number
}

const TIPO_CAIXA_VALUES: TipoCaixa[] = ['Oitavada', 'Maleta', 'Quadrada', 'Flexo', 'Outro']
const STATUS_VALUES: StatusPedido[] = ['SERVICO', 'TESTE']

function dataToIso(value: string): string {
  const parts = value.split('/')
  if (parts.length !== 3) return value
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

function isoToData(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function parseDataToDate(value: string): Date | null {
  const parts = value.split('/')
  if (parts.length !== 3) return null
  const year = Number(parts[2])
  const month = Number(parts[1])
  const day = Number(parts[0])
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function parseIsoToDate(value: string): Date | null {
  const parts = value.split('-')
  if (parts.length !== 3) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function normalizeDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function periodBounds(anchor: Date, period: ClearPeriod): { start: Date; end: Date } {
  const ref = normalizeDateOnly(anchor)
  if (period === 'day') return { start: ref, end: ref }

  if (period === 'week') {
    const day = ref.getDay()
    const diffToMonday = (day + 6) % 7
    const start = new Date(ref)
    start.setDate(start.getDate() - diffToMonday)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return { start, end }
  }

  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  return { start, end }
}

async function deleteByIds(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  ids: number[],
) {
  if (!supabase || !ids.length) return
  const chunkSize = 500
  for (let i = 0; i < ids.length; i += chunkSize) {
    const batch = ids.slice(i, i + chunkSize)
    const { error } = await supabase.from('pedidos').delete().in('id', batch)
    if (error) throw new Error(error.message)
  }
}

function sortPedidos(list: Pedido[]) {
  return [...list].sort((a, b) => {
    const dateCmp = dataToIso(a.data).localeCompare(dataToIso(b.data))
    if (dateCmp !== 0) return dateCmp
    const opCmp = a.operador.localeCompare(b.operador)
    if (opCmp !== 0) return opCmp
    return a.orderID.localeCompare(b.orderID)
  })
}

function getLegacyRawCount(): number {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.length
    }
    return 0
  } catch {
    return 0
  }
}

function getLegacyRaw(): { key: string; raw: string } | null {
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw) return { key, raw }
  }
  return null
}

function clearLegacyStorage() {
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
}

function normalizeRole(value: unknown): UserRole {
  if (value === 'admin') return 'admin'
  if (value === 'operador') return 'operador'
  return 'visualizador'
}

function normalizeRuleMatchField(value: unknown): ClassificacaoMatchField {
  return value === 'codigo' ? 'codigo' : 'prefixo'
}

function normalizeRuleMatchValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function normalizeOptionalStatus(value: unknown): StatusPedido | null {
  if (value == null) return null
  const text = String(value).trim().toUpperCase()
  if (STATUS_VALUES.includes(text as StatusPedido)) return text as StatusPedido
  return null
}

function normalizeOptionalTipoCaixa(value: unknown): TipoCaixa | null {
  if (value == null) return null
  const text = String(value).trim()
  const found = TIPO_CAIXA_VALUES.find((item) => item.toLowerCase() === text.toLowerCase())
  return found || null
}

function normalizeOptionalTamanho(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parsed = parseTamanho(text)
  if (parsed == null) return null
  return String(parsed).toLowerCase().replace(/\s+/g, '')
}

function parseClassificacaoRegra(row: Record<string, unknown>): ClassificacaoRegra | null {
  const rawId = row.id
  const id = typeof rawId === 'number' ? rawId : Number(rawId)
  if (!Number.isFinite(id)) return null
  return {
    id,
    matchField: normalizeRuleMatchField(row.match_field),
    matchValue: normalizeRuleMatchValue(row.match_value),
    statusDestino: normalizeOptionalStatus(row.status_destino),
    tipoCaixaDestino: normalizeOptionalTipoCaixa(row.tipo_caixa_destino),
    tamanhoDestino: normalizeOptionalTamanho(row.tamanho_destino),
    prefixoDestino: normalizeOptionalText(row.prefixo_destino),
    active: Boolean(row.active),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

function isMissingRelationError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('42p01')
}

function normalizeUnknownSizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function isKnownSizeText(value: string): boolean {
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return /^\d+$/.test(normalized) || /^\d+x\d+$/.test(normalized)
}

function normalizeKnownTargetSize(value: string): string {
  const parsed = parseTamanho(value)
  if (typeof parsed === 'number') return String(parsed)
  if (typeof parsed !== 'string') {
    throw new Error('Informe um tamanho valido (ex.: 35 ou 35x4).')
  }

  const normalized = parsed.toLowerCase().replace(/\s+/g, '')
  if (!isKnownSizeText(normalized)) {
    throw new Error('Use um tamanho reconhecido (ex.: 35 ou 35x4).')
  }
  return normalized
}

function sortedRules(rules: ClassificacaoRegra[]): ClassificacaoRegra[] {
  return [...rules]
    .filter((rule) => rule.active && rule.matchValue)
    .sort((a, b) => {
      const aScore = a.matchField === 'codigo' ? 0 : 1
      const bScore = b.matchField === 'codigo' ? 0 : 1
      if (aScore !== bScore) return aScore - bScore
      return a.matchValue.localeCompare(b.matchValue, 'pt-BR')
    })
}

function applyClassificacaoToPedido(pedido: Pedido, rules: ClassificacaoRegra[]): Pedido {
  if (!rules.length) return pedido
  const normalizedPrefixo = normalizeRuleMatchValue(pedido.prefixo)
  const normalizedCodigo = normalizeRuleMatchValue(pedido.codigo)
  let next = { ...pedido }

  for (const rule of rules) {
    const candidate = rule.matchField === 'prefixo' ? normalizedPrefixo : normalizedCodigo
    if (!candidate || candidate !== rule.matchValue) continue

    if (rule.prefixoDestino) next.prefixo = rule.prefixoDestino
    if (rule.tamanhoDestino) next.tamanhoCm = rule.tamanhoDestino
    if (rule.tipoCaixaDestino) next.tipoCaixa = rule.tipoCaixaDestino
    if (rule.statusDestino) next.status = rule.statusDestino
  }

  return next
}

export function usePedidos() {
  const supabase = getSupabaseBrowserClient()
  const supabaseEnabled = Boolean(supabase)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [hasMesColumn, setHasMesColumn] = useState<boolean>(true)
  const [classificacaoRules, setClassificacaoRules] = useState<ClassificacaoRegra[]>([])
  const [classificacaoRulesTableEnabled, setClassificacaoRulesTableEnabled] = useState<boolean>(true)
  const [loaded, setLoaded] = useState(false)
  const [legacyCount, setLegacyCount] = useState(0)
  const initialized = useRef(false)

  async function detectMesColumn() {
    if (!supabase) return false
    const { error } = await supabase.from('pedidos').select('mes').limit(1)
    if (!error) {
      setHasMesColumn(true)
      return true
    }
    const message = error.message.toLowerCase()
    const missingColumn = message.includes('column') && message.includes('mes')
    setHasMesColumn(!missingColumn)
    return !missingColumn
  }

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, active')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: String(data.id),
      role: normalizeRole(data.role),
      displayName: String(data.display_name || ''),
      active: Boolean(data.active),
    }
  }

  async function fetchPedidos() {
    if (!supabase) {
      setPedidos([])
      return
    }
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('data_producao', { ascending: true })
      .order('operador', { ascending: true })
      .order('order_id', { ascending: true })

    if (error || !data) {
      setPedidos([])
      return
    }

    const parsed = data.map((row) => toPedido(row as Record<string, unknown>))
    setPedidos(sortPedidos(parsed))
  }

  async function fetchClassificacaoRules() {
    if (!supabase) {
      setClassificacaoRules([])
      return
    }

    const { data, error } = await supabase
      .from('classificacao_regras')
      .select('*')
      .order('match_field', { ascending: true })
      .order('match_value', { ascending: true })

    if (error) {
      if (isMissingRelationError(error.message)) {
        setClassificacaoRulesTableEnabled(false)
        setClassificacaoRules([])
        return
      }
      throw new Error(error.message)
    }

    setClassificacaoRulesTableEnabled(true)
    const parsed = (data || [])
      .map((row) => parseClassificacaoRegra(row as Record<string, unknown>))
      .filter((item): item is ClassificacaoRegra => Boolean(item))
    setClassificacaoRules(parsed)
  }

  async function bootstrap(currentSession: Session | null) {
    setSession(currentSession)
    if (!currentSession?.user) {
      setProfile(null)
      setPedidos([])
      setClassificacaoRules([])
      setLoaded(true)
      return
    }

    const fetchedProfile = await fetchProfile(currentSession.user.id)
    setProfile(fetchedProfile)
    await detectMesColumn()
    await Promise.all([fetchPedidos(), fetchClassificacaoRules()])
    setLegacyCount(getLegacyRawCount())
    setLoaded(true)
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (!supabase) {
      setLegacyCount(getLegacyRawCount())
      setLoaded(true)
      return
    }

    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        return bootstrap(data.session)
      })
      .catch(() => {
        if (!mounted) return
        setLoaded(true)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      bootstrap(nextSession).catch(() => {
        setLoaded(true)
      })
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function addPedidos(novos: Pedido[]): Promise<AddPedidosResult> {
    if (!supabase) return { adicionados: 0, duplicatas: novos.length }
    const userId = session?.user?.id
    if (!userId) return { adicionados: 0, duplicatas: novos.length }
    if (profile?.role === 'visualizador') {
      throw new Error('Seu perfil e somente visualizacao. Solicite permissao de importacao ao administrador.')
    }
    if (!novos.length) return { adicionados: 0, duplicatas: 0 }

    const activeRules = sortedRules(classificacaoRules)
    const normalizedPedidos = activeRules.length
      ? novos.map((pedido) => applyClassificacaoToPedido(pedido, activeRules))
      : novos

    let includeMes = hasMesColumn
    let payload = normalizedPedidos.map((pedido) => toPedidoInsertRow(pedido, userId, includeMes))

    let { data, error } = await supabase
      .from('pedidos')
      .upsert(payload, {
        onConflict: 'data_producao,operador,order_id',
        ignoreDuplicates: true,
      })
      .select('id')

    if (error) {
      const message = error.message.toLowerCase()
      const missingMes = includeMes && message.includes('column') && message.includes('mes')
      if (!missingMes) throw new Error(error.message)

      includeMes = false
      setHasMesColumn(false)
      payload = normalizedPedidos.map((pedido) => toPedidoInsertRow(pedido, userId, includeMes))
      const retry = await supabase
        .from('pedidos')
        .upsert(payload, {
          onConflict: 'data_producao,operador,order_id',
          ignoreDuplicates: true,
        })
        .select('id')
      data = retry.data
      error = retry.error
      if (error) throw new Error(error.message)
    }

    const adicionados = data?.length || 0
    const duplicatas = Math.max(0, novos.length - adicionados)
    await fetchPedidos()
    return { adicionados, duplicatas }
  }

  async function clearAll() {
    if (!supabase) return
    if (profile?.role !== 'admin') return
    const { error } = await supabase.from('pedidos').delete().not('id', 'is', null)
    if (error) throw new Error(error.message)
    setPedidos([])
  }

  async function clearByPeriod(anchorDateIso: string, period: ClearPeriod): Promise<ClearByPeriodReport> {
    if (!supabase) return { removidos: 0, intervalo: '' }
    if (profile?.role !== 'admin') return { removidos: 0, intervalo: '' }

    const anchor = parseIsoToDate(anchorDateIso)
    if (!anchor) throw new Error('Data de referencia invalida')

    const { start, end } = periodBounds(anchor, period)
    const ids = pedidos
      .filter((pedido) => {
        const date = parseDataToDate(pedido.data)
        if (!date) return false
        const normalized = normalizeDateOnly(date)
        return normalized >= start && normalized <= end
      })
      .map((pedido) => pedido.id)
      .filter((id): id is number => typeof id === 'number')

    if (!ids.length) {
      const intervalo = start.getTime() === end.getTime() ? formatDate(start) : `${formatDate(start)} a ${formatDate(end)}`
      return { removidos: 0, intervalo }
    }

    await deleteByIds(supabase, ids)
    await fetchPedidos()
    const intervalo = start.getTime() === end.getTime() ? formatDate(start) : `${formatDate(start)} a ${formatDate(end)}`
    return { removidos: ids.length, intervalo }
  }

  async function updateOperadorByDate(
    dataIso: string,
    operadorOrigem: string,
    operadorDestino: string,
  ): Promise<UpdateOperadorReport> {
    if (!supabase) return { atualizados: 0, conflitos: 0, total: 0 }
    if (profile?.role !== 'admin') return { atualizados: 0, conflitos: 0, total: 0 }

    const origem = operadorOrigem.trim()
    const destino = operadorDestino.trim()
    if (!origem || !destino) throw new Error('Informe operador de origem e destino')
    if (origem === destino) throw new Error('Operadores de origem e destino sao iguais')

    const dataPt = isoToData(dataIso)
    const candidatos = pedidos.filter((pedido) => pedido.data === dataPt && pedido.operador === origem)
    if (!candidatos.length) return { atualizados: 0, conflitos: 0, total: 0 }

    const existingKeys = new Set(
      pedidos
        .filter((pedido) => pedido.data === dataPt && pedido.operador === destino)
        .map((pedido) => `${pedido.data}|${destino}|${pedido.orderID}`),
    )

    let atualizados = 0
    let conflitos = 0
    for (const pedido of candidatos) {
      const key = `${pedido.data}|${destino}|${pedido.orderID}`
      if (existingKeys.has(key)) {
        conflitos += 1
        continue
      }
      if (typeof pedido.id !== 'number') continue

      const { error } = await supabase
        .from('pedidos')
        .update({ operador: destino })
        .eq('id', pedido.id)

      if (error) {
        if (error.message.toLowerCase().includes('duplicate key')) {
          conflitos += 1
          continue
        }
        throw new Error(error.message)
      }

      atualizados += 1
      existingKeys.add(key)
    }

    await fetchPedidos()
    return { atualizados, conflitos, total: candidatos.length }
  }

  async function updateTamanhoNaoIdentificado(
    tamanhoOrigem: string,
    tamanhoDestino: string,
  ): Promise<UpdateTamanhoReport> {
    if (!supabase) return { atualizados: 0, total: 0 }
    if (profile?.role !== 'admin') return { atualizados: 0, total: 0 }

    const origemKey = normalizeUnknownSizeKey(tamanhoOrigem)
    if (!origemKey) throw new Error('Informe o tamanho de origem.')
    const destinoNormalizado = normalizeKnownTargetSize(tamanhoDestino)

    const ids = pedidos
      .filter((pedido) => {
        if (typeof pedido.id !== 'number') return false
        if (typeof pedido.tamanhoCm !== 'string') return false
        const currentKey = normalizeUnknownSizeKey(pedido.tamanhoCm)
        if (!currentKey) return false
        if (isKnownSizeText(currentKey.replace(/\s+/g, ''))) return false
        return currentKey === origemKey
      })
      .map((pedido) => pedido.id as number)

    if (!ids.length) return { atualizados: 0, total: 0 }

    const chunkSize = 500
    let atualizados = 0
    for (let i = 0; i < ids.length; i += chunkSize) {
      const batch = ids.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('pedidos')
        .update({ tamanho_cm: destinoNormalizado })
        .in('id', batch)

      if (error) throw new Error(error.message)
      atualizados += batch.length
    }

    await fetchPedidos()
    return { atualizados, total: ids.length }
  }

  async function applyClassificacaoRuleToExisting(input: {
    matchField: ClassificacaoMatchField
    matchValue: string
    statusDestino: StatusPedido | null
    tipoCaixaDestino: TipoCaixa | null
    tamanhoDestino: string | null
    prefixoDestino: string | null
  }): Promise<number> {
    if (!supabase) return 0
    const ids = pedidos
      .filter((pedido) => {
        if (typeof pedido.id !== 'number') return false
        const candidate = input.matchField === 'prefixo' ? pedido.prefixo : pedido.codigo
        return normalizeRuleMatchValue(candidate) === input.matchValue
      })
      .map((pedido) => pedido.id as number)

    if (!ids.length) return 0

    const updatePayload: Record<string, unknown> = {}
    if (input.statusDestino) updatePayload.status = input.statusDestino
    if (input.tipoCaixaDestino) updatePayload.tipo_caixa = input.tipoCaixaDestino
    if (input.tamanhoDestino) updatePayload.tamanho_cm = input.tamanhoDestino
    if (input.prefixoDestino) updatePayload.prefixo = input.prefixoDestino

    if (!Object.keys(updatePayload).length) return 0

    const chunkSize = 500
    let updated = 0
    for (let i = 0; i < ids.length; i += chunkSize) {
      const batch = ids.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('pedidos')
        .update(updatePayload)
        .in('id', batch)
      if (error) throw new Error(error.message)
      updated += batch.length
    }
    return updated
  }

  async function saveClassificacaoRegra(input: SaveClassificacaoRegraInput): Promise<SaveClassificacaoRegraReport> {
    if (!supabase) return { id: 0, atualizados: 0 }
    if (profile?.role !== 'admin') return { id: 0, atualizados: 0 }
    if (!classificacaoRulesTableEnabled) {
      throw new Error('Tabela de regras nao encontrada. Rode o SQL atualizado do schema.')
    }

    const matchField = normalizeRuleMatchField(input.matchField)
    const matchValue = normalizeRuleMatchValue(input.matchValue)
    if (!matchValue) throw new Error('Informe o prefixo/codigo da regra.')

    const payload = {
      match_field: matchField,
      match_value: matchValue,
      status_destino: normalizeOptionalStatus(input.statusDestino),
      tipo_caixa_destino: normalizeOptionalTipoCaixa(input.tipoCaixaDestino),
      tamanho_destino: normalizeOptionalTamanho(input.tamanhoDestino),
      prefixo_destino: normalizeOptionalText(input.prefixoDestino),
      active: Boolean(input.active),
      updated_at: new Date().toISOString(),
      created_by: session?.user?.id || null,
    }

    let targetId = typeof input.id === 'number' ? input.id : 0

    if (!targetId) {
      const lookup = await supabase
        .from('classificacao_regras')
        .select('id')
        .eq('match_field', matchField)
        .eq('match_value', matchValue)
        .maybeSingle()

      if (lookup.error) {
        if (isMissingRelationError(lookup.error.message)) {
          setClassificacaoRulesTableEnabled(false)
          throw new Error('Tabela de regras nao encontrada. Rode o SQL atualizado do schema.')
        }
        throw new Error(lookup.error.message)
      }
      targetId = lookup.data?.id ? Number(lookup.data.id) : 0
    }

    if (targetId) {
      const { error } = await supabase
        .from('classificacao_regras')
        .update(payload)
        .eq('id', targetId)
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await supabase
        .from('classificacao_regras')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      targetId = Number(data.id)
    }

    let atualizados = 0
    if (input.applyToExisting) {
      atualizados = await applyClassificacaoRuleToExisting({
        matchField,
        matchValue,
        statusDestino: normalizeOptionalStatus(input.statusDestino),
        tipoCaixaDestino: normalizeOptionalTipoCaixa(input.tipoCaixaDestino),
        tamanhoDestino: normalizeOptionalTamanho(input.tamanhoDestino),
        prefixoDestino: normalizeOptionalText(input.prefixoDestino),
      })
      if (atualizados > 0) await fetchPedidos()
    }

    await fetchClassificacaoRules()
    return { id: targetId, atualizados }
  }

  async function removeClassificacaoRegra(ruleId: number) {
    if (!supabase) return
    if (profile?.role !== 'admin') return
    if (!Number.isFinite(ruleId) || ruleId <= 0) return
    if (!classificacaoRulesTableEnabled) return

    const { error } = await supabase
      .from('classificacao_regras')
      .delete()
      .eq('id', ruleId)

    if (error) throw new Error(error.message)
    await fetchClassificacaoRules()
  }

  async function migrateLegacyPedidos(): Promise<MigrationReport> {
    const legacy = getLegacyRaw()
    if (!legacy) return { inseridos: 0, duplicados: 0, falhas: 0, totalLocal: 0 }

    let parsed: unknown
    try {
      parsed = JSON.parse(legacy.raw)
    } catch {
      return { inseridos: 0, duplicados: 0, falhas: 1, totalLocal: 0 }
    }

    if (!Array.isArray(parsed)) {
      return { inseridos: 0, duplicados: 0, falhas: 1, totalLocal: 0 }
    }

    const sanitized = parsed
      .map((item) => sanitizeLegacyPedido(item as Record<string, unknown>))
      .filter((item): item is Pedido => Boolean(item))

    const falhasBase = parsed.length - sanitized.length

    if (!sanitized.length) {
      clearLegacyStorage()
      setLegacyCount(0)
      return { inseridos: 0, duplicados: 0, falhas: falhasBase, totalLocal: parsed.length }
    }

    const result = await addPedidos(sanitized)
    clearLegacyStorage()
    setLegacyCount(0)

    return {
      inseridos: result.adicionados,
      duplicados: result.duplicatas,
      falhas: falhasBase,
      totalLocal: parsed.length,
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function listPendingProfiles(): Promise<PendingProfile[]> {
    if (!supabase) return []
    if (profile?.role !== 'admin') return []

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, active, created_at')
      .eq('active', false)
      .order('created_at', { ascending: true })

    if (error || !data) return []

    return data.map((item) => ({
      id: String(item.id),
      role: normalizeRole(item.role),
      displayName: String(item.display_name || ''),
      active: Boolean(item.active),
      createdAt: String(item.created_at || ''),
    }))
  }

  async function listProfiles(): Promise<ManagedProfile[]> {
    if (!supabase) return []
    if (profile?.role !== 'admin') return []

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, active, created_at')
      .order('active', { ascending: false })
      .order('created_at', { ascending: true })

    if (error || !data) return []

    return data.map((item) => ({
      id: String(item.id),
      role: normalizeRole(item.role),
      displayName: String(item.display_name || ''),
      active: Boolean(item.active),
      createdAt: String(item.created_at || ''),
    }))
  }

  async function approveProfile(profileId: string, role: UserRole = 'visualizador') {
    if (!supabase) return
    if (profile?.role !== 'admin') return

    const { error } = await supabase
      .from('profiles')
      .update({
        active: true,
        role,
      })
      .eq('id', profileId)

    if (error) throw new Error(error.message)
  }

  async function updateProfileAccess(profileId: string, role: UserRole, active: boolean) {
    if (!supabase) return
    if (profile?.role !== 'admin') return

    const isSelf = profile?.id === profileId
    if (isSelf && (!active || role !== 'admin')) {
      throw new Error('Nao e permitido remover seu proprio acesso de administrador.')
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        active,
      })
      .eq('id', profileId)

    if (error) throw new Error(error.message)
  }

  return {
    pedidos,
    loaded,
    session,
    profile,
    supabaseEnabled,
    role: profile?.role || null,
    isAdmin: profile?.role === 'admin',
    canImport: profile?.role === 'admin' || profile?.role === 'operador',
    classificacaoRules,
    classificacaoRulesTableEnabled,
    legacyCount,
    addPedidos,
    clearAll,
    clearByPeriod,
    updateOperadorByDate,
    updateTamanhoNaoIdentificado,
    saveClassificacaoRegra,
    removeClassificacaoRegra,
    refreshClassificacaoRules: fetchClassificacaoRules,
    migrateLegacyPedidos,
    refreshPedidos: fetchPedidos,
    listPendingProfiles,
    listProfiles,
    approveProfile,
    updateProfileAccess,
    signOut,
  }
}
