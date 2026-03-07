# Changelog

Todas as mudancas relevantes deste projeto serao registradas neste arquivo.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento semantico em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Placeholder para proximas alteracoes.

## [1.0.5] - 2026-03-07

### Added
- Nova area de gestao para classificar modelos/prefixos nao mapeados com atalhos de preenchimento.
- Cadastro de regras por `prefixo` ou `codigo` com opcoes de destino para status, tipo de caixa, tamanho e novo prefixo.
- Edicao e exclusao de regras de classificacao diretamente no modal de Gestao (admin).

### Changed
- Importacao agora aplica regras ativas de classificacao automaticamente.
- Opcao de aplicar regra tambem nos pedidos ja importados.

### Infra
- Schema Supabase atualizado com tabela `classificacao_regras`, indice unico e politicas RLS (admin para escrita, usuarios ativos para leitura).

## [1.0.4] - 2026-03-07

### Fixed
- Removido o destaque de fundo (cursor) no grafico "Ranking de Operadores" ao tocar.
- Corrigida rotulagem do tooltip para exibir "Caixas" e "Pedidos" corretamente.

## [1.0.3] - 2026-03-07

### Added
- Tela de abertura animada com a logo ao iniciar o app.

### Changed
- Melhorado contraste dos tooltips dos graficos para leitura no celular.
- Ajustes de scroll vertical/horizontal para melhor navegacao em telas menores.

## [1.0.2] - 2026-03-07

### Changed
- Removida do README a instrucao de fluxo interno de versionamento.
- Atualizada versao atual no README para `v1.0.2`.

## [1.0.1] - 2026-03-07

### Changed
- Ajustes na documentacao de versionamento.

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
