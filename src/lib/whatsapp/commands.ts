import type { UserRole } from '@/lib/storage'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface CommandContext {
  from: string
  text: string
  secret: string
}

interface CommandResult {
  ok: boolean
  reply: string
}

const SUPPORTED_ROLES: UserRole[] = ['admin', 'operador', 'visualizador']
const SAO_PAULO_TZ = 'America/Sao_Paulo'

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nowPtBrDate(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const dd = parts.find((item) => item.type === 'day')?.value || '01'
  const mm = parts.find((item) => item.type === 'month')?.value || '01'
  const yyyy = parts.find((item) => item.type === 'year')?.value || '1970'
  return `${dd}/${mm}/${yyyy}`
}

function nowMonthKey(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const mm = parts.find((item) => item.type === 'month')?.value || '01'
  const yyyy = parts.find((item) => item.type === 'year')?.value || '1970'
  return `${yyyy}-${mm}`
}

function formatInt(value: number): string {
  return value.toLocaleString('pt-BR')
}

async function findAuthUserByEmail(email: string) {
  const supabase = getSupabaseServiceClient()
  if (!supabase) throw new Error('Supabase service key nao configurada.')

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw new Error(error.message)
    const found = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (!data.users.length) break
  }

  return null
}

function helpText() {
  return [
    'Comandos:',
    'STATUS',
    'RESUMO HOJE',
    'RESUMO MES [AAAA-MM]',
    'PENDENTES',
    'APROVAR <email> [admin|operador|visualizador]',
    'PAPEL <email> <admin|operador|visualizador>',
    'ATIVAR <email>',
    'DESATIVAR <email>',
    'Formato: /cmd <senha> <comando>',
  ].join('\n')
}

function parseRole(value: string | undefined): UserRole | null {
  if (!value) return null
  const role = normalizeText(value).toLowerCase()
  const match = SUPPORTED_ROLES.find((item) => item === role)
  return match || null
}

async function commandStatus(): Promise<CommandResult> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return { ok: false, reply: 'Supabase service key nao configurada.' }

  const [{ count: totalPedidos, error: pedidosError }, { count: ativosCount, error: ativosError }] = await Promise.all([
    supabase.from('pedidos').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('active', true),
  ])

  if (pedidosError) return { ok: false, reply: `Erro em pedidos: ${pedidosError.message}` }
  if (ativosError) return { ok: false, reply: `Erro em profiles: ${ativosError.message}` }

  return {
    ok: true,
    reply: `Online. Pedidos: ${formatInt(totalPedidos || 0)} | Usuarios ativos: ${formatInt(ativosCount || 0)}`,
  }
}

async function commandResumoHoje(): Promise<CommandResult> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return { ok: false, reply: 'Supabase service key nao configurada.' }

  const today = nowPtBrDate()
  const { data, error } = await supabase
    .from('pedidos')
    .select('status, caixas_produzidas')
    .eq('data_producao', today)

  if (error) return { ok: false, reply: `Erro: ${error.message}` }
  const rows = data || []
  const servicos = rows.filter((item) => item.status === 'SERVICO')
  const testes = rows.filter((item) => item.status === 'TESTE')
  const caixasServicos = servicos.reduce((acc, item) => acc + Number(item.caixas_produzidas || 0), 0)
  const caixasTeste = testes.reduce((acc, item) => acc + Number(item.caixas_produzidas || 0), 0)

  return {
    ok: true,
    reply: [
      `Resumo de hoje (${today})`,
      `Servicos: ${formatInt(servicos.length)} pedidos | ${formatInt(caixasServicos)} caixas`,
      `Testes: ${formatInt(testes.length)} pedidos | ${formatInt(caixasTeste)} caixas`,
    ].join('\n'),
  }
}

async function commandResumoMes(monthArg?: string): Promise<CommandResult> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return { ok: false, reply: 'Supabase service key nao configurada.' }

  const month = monthArg && /^\d{4}-\d{2}$/.test(monthArg) ? monthArg : nowMonthKey()
  const { data, error } = await supabase
    .from('pedidos')
    .select('status, caixas_produzidas')
    .eq('mes', month)

  if (error) return { ok: false, reply: `Erro: ${error.message}` }
  const rows = data || []
  const servicos = rows.filter((item) => item.status === 'SERVICO')
  const testes = rows.filter((item) => item.status === 'TESTE')
  const caixasServicos = servicos.reduce((acc, item) => acc + Number(item.caixas_produzidas || 0), 0)
  const caixasTeste = testes.reduce((acc, item) => acc + Number(item.caixas_produzidas || 0), 0)

  return {
    ok: true,
    reply: [
      `Resumo do mes ${month}`,
      `Servicos: ${formatInt(servicos.length)} pedidos | ${formatInt(caixasServicos)} caixas`,
      `Testes: ${formatInt(testes.length)} pedidos | ${formatInt(caixasTeste)} caixas`,
    ].join('\n'),
  }
}

async function commandPendentes(): Promise<CommandResult> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return { ok: false, reply: 'Supabase service key nao configurada.' }

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('active', false)

  if (error) return { ok: false, reply: `Erro: ${error.message}` }
  return { ok: true, reply: `Cadastros pendentes: ${formatInt(count || 0)}` }
}

async function updateProfileByEmail(email: string, patch: { active?: boolean; role?: UserRole }): Promise<CommandResult> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return { ok: false, reply: 'Supabase service key nao configurada.' }
  const user = await findAuthUserByEmail(email)
  if (!user) return { ok: false, reply: `Usuario nao encontrado: ${email}` }

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) return { ok: false, reply: `Erro ao atualizar perfil: ${error.message}` }

  const summary: string[] = []
  if (typeof patch.active === 'boolean') summary.push(`ativo=${patch.active ? 'sim' : 'nao'}`)
  if (patch.role) summary.push(`papel=${patch.role}`)
  return { ok: true, reply: `Perfil atualizado (${email}): ${summary.join(' | ')}` }
}

export async function runWhatsAppCommand(ctx: CommandContext): Promise<CommandResult> {
  const trimmed = ctx.text.trim()
  if (!trimmed.toLowerCase().startsWith('/cmd ')) {
    return { ok: false, reply: 'Use o formato: /cmd <senha> <comando>' }
  }

  const withoutPrefix = trimmed.slice(5).trim()
  const firstSpace = withoutPrefix.indexOf(' ')
  if (firstSpace < 0) return { ok: false, reply: 'Formato invalido. Exemplo: /cmd <senha> STATUS' }

  const providedSecret = withoutPrefix.slice(0, firstSpace).trim()
  const commandPart = withoutPrefix.slice(firstSpace + 1).trim()

  if (!providedSecret || providedSecret !== ctx.secret) {
    return { ok: false, reply: 'Senha de comando invalida.' }
  }

  const tokens = commandPart.split(/\s+/)
  const main = normalizeText(tokens[0] || '').toUpperCase()
  const arg1 = tokens[1]
  const arg2 = tokens[2]

  if (main === 'HELP' || main === 'AJUDA') return { ok: true, reply: helpText() }
  if (main === 'STATUS') return commandStatus()
  if (main === 'PENDENTES') return commandPendentes()

  if (main === 'RESUMO') {
    const scope = normalizeText(arg1 || '').toUpperCase()
    if (scope === 'HOJE') return commandResumoHoje()
    if (scope === 'MES') return commandResumoMes(arg2)
    return { ok: false, reply: 'Use: RESUMO HOJE ou RESUMO MES [AAAA-MM]' }
  }

  if (main === 'APROVAR') {
    const email = arg1
    if (!email) return { ok: false, reply: 'Use: APROVAR <email> [admin|operador|visualizador]' }
    const role = parseRole(arg2) || 'visualizador'
    return updateProfileByEmail(email, { active: true, role })
  }

  if (main === 'PAPEL') {
    const email = arg1
    const role = parseRole(arg2)
    if (!email || !role) return { ok: false, reply: 'Use: PAPEL <email> <admin|operador|visualizador>' }
    return updateProfileByEmail(email, { role })
  }

  if (main === 'ATIVAR') {
    const email = arg1
    if (!email) return { ok: false, reply: 'Use: ATIVAR <email>' }
    return updateProfileByEmail(email, { active: true })
  }

  if (main === 'DESATIVAR') {
    const email = arg1
    if (!email) return { ok: false, reply: 'Use: DESATIVAR <email>' }
    return updateProfileByEmail(email, { active: false })
  }

  return { ok: false, reply: `Comando nao reconhecido.\n${helpText()}` }
}
