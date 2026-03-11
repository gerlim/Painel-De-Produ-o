# Changelog

Todas as mudancas relevantes deste projeto serao registradas neste arquivo.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento semantico em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Placeholder para proximas alteracoes.

## [1.1.2] - 2026-03-10

### Changed
- Aba `Agenda` passou a permitir analise de datas futuras mesmo sem nova importacao, mantendo o saldo pendente visivel no dia seguinte.
- Fila da agenda agora separa explicitamente `Programado Hoje`, `Carregado de Atraso`, `Fila Total do Dia` e `Concluidos Hoje`.

## [1.1.1] - 2026-03-10

### Fixed
- Importacao da agenda ajustada para o layout real do arquivo `digital.xlsx`, com leitura dos blocos `Digital Elite - DD/MM/AAAA`.
- Vinculo da agenda com a producao alterado de `order_id` para `prefixo + codigo`, alinhando com a estrutura operacional da agenda.
- Inclusao de `data_referencia` na agenda para manter a data original exibida na planilha.

## [1.1.0] - 2026-03-10

### Added
- Nova aba `Agenda` para importar a agenda diaria e acompanhar planejado x realizado.
- Importacao da agenda usando o mesmo parser do arquivo de producao.
- Vinculo automatico entre agenda e producao por `order_id`, com identificacao de `pendente`, `atrasado`, `concluido` e `concluido com atraso`.
- Persistencia da agenda em `agenda_items` com leitura para todos os usuarios ativos e escrita administrativa.

### Changed
- Itens nao feitos passam a aparecer como atraso e continuam visiveis no dia seguinte ate a conclusao.

## [1.0.8] - 2026-03-10

### Changed
- Removidos do painel os indicadores, colunas e resumos relacionados a tinta.
- Exportacao CSV de pedidos atualizada para nao incluir mais colunas de tinta e custo de tinta.

## [1.0.7] - 2026-03-08

### Changed
- Tela de login passou a traduzir erros comuns do Supabase Auth para mensagens mais claras em portugues.
- Fluxo de cadastro agora informa explicitamente a necessidade de confirmar o email antes da aprovacao do administrador.

### Added
- Botao para reenviar email de confirmacao quando o login falhar por conta ainda nao confirmada.

## [1.0.6] - 2026-03-07

### Added
- Webhook `POST/GET /api/whatsapp/webhook` para integrar comandos remotos via WhatsApp Cloud API.
- Motor de comandos com controle por senha e lista de numeros autorizados.
- Comandos operacionais: `STATUS`, `RESUMO HOJE`, `RESUMO MES`, `PENDENTES`, `APROVAR`, `PAPEL`, `ATIVAR`, `DESATIVAR`.

### Infra
- Cliente Supabase server-side com `SUPABASE_SERVICE_ROLE_KEY` para operacoes administrativas do webhook.
- Novas variaveis de ambiente documentadas para WhatsApp e service role.

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
