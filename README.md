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
- ferramentas administrativas (gestao de acesso, limpeza por periodo, ajustes de operador e tamanhos nao identificados)

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

- versao atual: `v1.0.3`
- arquivo de historico: `CHANGELOG.md`
- padrao adotado: SemVer (`MAJOR.MINOR.PATCH`)

## Deploy (Vercel)

Variaveis obrigatorias no projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Comandos:

```bash
vercel deploy -y
vercel deploy --prod -y
```

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
