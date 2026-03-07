# Changelog

Todas as mudancas relevantes deste projeto serao registradas neste arquivo.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento semantico em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Placeholder para proximas alteracoes.

## [1.0.1] - 2026-03-07

### Changed
- Documentado fluxo obrigatorio de entrega: build, deploy Vercel, atualizacao de versao e publicacao no GitHub.
- Atualizacao de versao atual no README para `v1.0.1`.

## [1.0.0] - 2026-03-07

### Added
- Autenticacao com Supabase Auth (email/senha).
- Perfis e permissao por papel (`admin`, `operador`, `visualizador`).
- Persistencia de pedidos em Supabase com RLS.
- Importacao de producao por arquivo `.xlsx`, `.xls` e `.csv`.
- Exportacao CSV da tabela filtrada de pedidos.
- Dashboard com KPIs, visoes por dia, produto e equipe.
- Ferramentas administrativas de gestao de dados e usuarios.
- Campo de mes para consolidacao mensal.
- PWA e estrutura para APK Android via Capacitor.
- Deploy em Vercel com ambiente de producao.
