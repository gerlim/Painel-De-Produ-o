# Painel Producao

Aplicacao web para controle de producao com importacao de arquivos da maquina, painel de indicadores e gestao de usuarios por perfil.

## Visao geral

O sistema foi feito para operar em cima do Supabase (Auth + Postgres) e substituir o fluxo antigo baseado em `localStorage`.

Principais recursos:

- login com email/senha
- perfis `admin`, `operador` e `visualizador`
- importacao de planilhas (`.xlsx`, `.xls`, `.csv`)
- deduplicacao por `(data_producao, operador, order_id)`
- KPIs com separacao correta entre servicos e testes
- exportacao CSV da listagem filtrada
- ferramentas administrativas (gestao de acesso, limpeza por periodo, ajustes de operador, tamanhos nao identificados e regras de classificacao por prefixo/codigo)
- aba de agenda diaria com comparativo entre planejado e realizado
- comandos remotos via WhatsApp Cloud API (admin)

## Stack

- Next.js 15 + React 19
- Supabase (Auth, Postgres, RLS)
- Recharts
- Capacitor (APK Android para uso privado)

## Requisitos

- Node.js 20+
- projeto Supabase
- conta Vercel (deploy web)
- Android Studio (opcional, para APK)

## Configuracao local

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base em `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
WHATSAPP_VERIFY_TOKEN=TOKEN_DE_VERIFICACAO_WEBHOOK
WHATSAPP_API_TOKEN=TOKEN_PERMANENTE_WHATSAPP
WHATSAPP_PHONE_NUMBER_ID=PHONE_NUMBER_ID_DO_WHATSAPP
WHATSAPP_COMMAND_SECRET=SENHA_DOS_COMANDOS
WHATSAPP_ALLOWED_NUMBERS=5511999999999,5511888888888
```

3. Aplique o schema SQL:

- arquivo: `supabase/schema.sql`

4. Inicie o projeto:

```bash
npm run dev
```

Aplicacao local: `http://localhost:3000`

## Permissoes por perfil

- `admin`: acesso total (dados e gestao)
- `operador`: leitura + importacao
- `visualizador`: somente leitura

## Scripts

- `npm run dev` - desenvolvimento local
- `npm run build` - build de producao
- `npm run start` - executar build localmente
- `npm run apk:sync` - sincronizar projeto Capacitor Android
- `npm run apk:build:debug` - gerar APK debug

## Versionamento

- versao atual: `v1.1.11`
- arquivo de historico: `CHANGELOG.md`
- padrao adotado: SemVer (`MAJOR.MINOR.PATCH`)

## Deploy (Vercel)

Variaveis obrigatorias no projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (somente backend/webhook)
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_COMMAND_SECRET`
- `WHATSAPP_ALLOWED_NUMBERS`

Comandos:

```bash
vercel deploy -y
vercel deploy --prod -y
```

## Comandos remotos por WhatsApp

Webhook no app:

- `GET/POST /api/whatsapp/webhook`

Formato da mensagem:

- `/cmd <senha> <comando>`

Comandos suportados:

- `STATUS`
- `RESUMO HOJE`
- `RESUMO MES [AAAA-MM]`
- `PENDENTES`
- `APROVAR <email> [admin|operador|visualizador]`
- `PAPEL <email> <admin|operador|visualizador>`
- `ATIVAR <email>`
- `DESATIVAR <email>`

Exemplo:

- `/cmd minhaSenha STATUS`

## APK Android (uso pessoal)

Este projeto usa WebView com Capacitor apontando para o deploy web.

Passo rapido para gerar APK debug:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npm run apk:sync
npm run apk:build:debug
```

Saida:

- `android\app\build\outputs\apk\debug\app-debug.apk`

## Observacoes

- nunca versionar `.env.local` ou arquivos com chaves
- se o PWA aparentar desatualizado no celular, limpar cache/dados do site e reabrir
