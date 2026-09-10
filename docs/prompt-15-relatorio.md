# Prompt 15 — preparação de billing

## Diretório, branch e auditoria

Workspace: `C:\Users\lucas.silva\Downloads\Conecta Agenda\Conecta-Agenda`. Branch: `main`.

Get-Location, git branch --show-current e git status --short foram executados antes das alterações. As alterações locais do Prompt 14 e a pasta .vscode foram preservadas. A aplicação já possuía billing/status, páginas de assinatura, apiFetch com códigos de erro e guarda comercial. Subscription tem plano, status, teste e período, vinculados ao usuário proprietário do negócio; não tem referências do provedor.

## Arquivos criados neste prompt

- `apps/api/src/billing/config.ts`
- `apps/api/src/billing/provider.ts`
- `apps/api/src/billing/unconfigured-provider.ts`
- `apps/api/src/billing/mercado-pago-provider.ts`
- `apps/api/src/billing/index.ts`
- `apps/api/src/billing/billing.test.ts`
- `apps/api/src/routes/billing-webhook.ts`
- `apps/web/src/lib/billing.ts`
- `docs/prompt-15-relatorio.md`

## Arquivos alterados neste prompt

- `.env.example`
- `apps/api/.env.example`
- `apps/api/src/app.ts`
- `apps/api/src/routes/billing.ts` (criado anteriormente no Prompt 14)
- `apps/web/src/components/app/billing-page.tsx` (criado anteriormente no Prompt 14)
- `packages/types/src/index.ts`

## Prisma e migration

Nenhuma alteração no schema e nenhuma migration criada ou executada. Os campos externos não são necessários para esta etapa sem operações reais. A próxima etapa deverá definir persistência de referências únicas do provedor, histórico/idempotência de eventos e informações financeiras confirmadas. A próxima cobrança é retornada como null, sem inferir cobrança a partir do fim do período.

## Provider e configuração

BillingProvider define createSubscriptionCheckout, getSubscription, cancelSubscription e reactivateSubscription. A fábrica seleciona UnconfiguredBillingProvider ou MercadoPagoBillingProvider. O fallback rejeita operações com BillingProviderError e código BILLING_PROVIDER_NOT_CONFIGURED (503). O adaptador Mercado Pago é um scaffold sem transporte HTTP e retorna BILLING_PROVIDER_NOT_IMPLEMENTED (503) mesmo com configuração completa.

getBillingConfig aceita ausência, valores vazios e configuração parcial sem quebrar startup. Verifica presença dos seis campos e estrutura HTTP/HTTPS das URLs, sem credenciais embutidas. Isso indica completude, não valida autenticidade de token ou compatibilidade com o provedor. As seis variáveis opcionais foram adicionadas vazias aos exemplos da raiz e API. Nenhuma variável secreta é pública.

providerConfigured informa a completude da configuração. checkoutAvailable e cancellationAvailable permanecem false porque ainda não há implementação real. Preencher envs não habilita operações por si só.

## Rotas e segurança

- GET /billing/status: mantém a situação comercial e adiciona provider, providerConfigured, checkoutAvailable, cancellationAvailable e nextPaymentAt. Acesso exclusivo do profissional com negócio.
- POST /billing/checkout: autenticação obrigatória, PROFESSIONAL com Business da sessão; rejeita quaisquer campos em body/query, inclusive businessId, preço, status e referência externa. Obtém o plano atual no servidor. Sem configuração, retorna 503 com BILLING_PROVIDER_NOT_CONFIGURED e mensagem amigável. Configurado, o adaptador permanece indisponível; não gera checkout falso.
- POST /billing/cancel: mesmas restrições. Sem configuração, erro controlado; configurado, BILLING_PROVIDER_NOT_IMPLEMENTED. Não apaga nem modifica assinatura ou período. A chamada futura a cancelSubscription depende da referência externa persistida, deliberadamente ausente nesta etapa.
- POST /webhooks/mercado-pago: endpoint sem autenticação de usuário, limite de 16 KB, valida formato básico de type e data.id. Payload inválido retorna 400. Secret ausente retorna 503; com secret, retorna 503 e processed false. Nunca afirma que processou evento não verificado. Há TODO explícito para verificação oficial, proteção contra replay e consulta autoritativa.

Nenhum token, secret ou referência externa de cliente é retornado ao frontend. Não há chamadas reais, ativação por redirect, alteração de status por body de webhook, exclusão de dados ou mudança nas prioridades de bloqueio/cortesia/tolerância.

## Frontend

Cliente billing reutiliza apiFetch com getBillingStatus, createBillingCheckout e cancelBillingSubscription. As duas páginas compartilham BillingPage, agora com próxima cobrança e ações Regularizar assinatura, Gerenciar assinatura e Cancelar assinatura. Gerenciar leva à página local de assinatura. Regularização/cancelamento ficam desabilitados enquanto as capacidades não estiverem disponíveis; suporte continua acessível.

O fluxo futuro de checkout recebe URL do backend, exige HTTPS e ausência de credenciais na URL e redireciona sem ativar assinatura localmente. Erro BILLING_PROVIDER_NOT_CONFIGURED recebe mensagem amigável. Cancelamento tem confirmação local preparada. BUSINESS_ACCESS_BLOCKED continua tratado centralmente no apiFetch; PAYMENT_ATTENTION continua representado pelo estado e banner comercial existente.

## Testes e comandos

- `pnpm db:generate`: passou; geração local do cliente, sem banco.
- `pnpm lint`: passou em todos os pacotes.
- `pnpm build`: passou em todos os pacotes, incluindo as páginas de billing, sem envs do Mercado Pago.
- `pnpm exec tsx --test apps/api/src/domain/business-access.test.ts apps/api/src/routes/business-access.test.ts apps/api/src/billing/billing.test.ts`: 16 testes passaram, zero falhas.
- `git diff --check`: passou.
- Formatação: `pnpm exec prettier --write` apenas nos arquivos deste prompt.
- Inspeção: Get-Location, git branch --show-current, git status --short, Get-Content e rg. Edições via apply_patch e scripts Python locais.

COREPACK_HOME e PATH apontaram para o pnpm local instalado no Prompt 14. Lint/build/testes rodaram com subprocessos autorizados e MERCADO_PAGO_* removidas apenas do ambiente dos processos de validação. Testes de configuração completa usam marcadores test-only e example.com, sem credenciais reais. Prisma e fetch são simulados nos testes; foram verificadas ausência de rede, ausência de escrita, autenticação, acesso de profissional sem negócio/SUPER_ADMIN, rejeição de parâmetros externos, cancelamento sem alteração, webhook inválido/sem secret/com secret e regressões do Prompt 14.

## Pendências para configurar em casa

1. Em etapa futura, configurar as seis variáveis somente no backend, em arquivo local ignorado ou gerenciador de segredos. As URLs devem apontar aos destinos corretos do ambiente; não ativam plano ao retornar.
2. Implementar transporte oficial Mercado Pago, mapeamento seguro do plano atual para o plano do provedor e idempotência. Definir schema/migration incremental para referências externas quando forem efetivamente usadas.
3. Implementar verificação oficial de webhook, proteção contra replay e reconciliação com dados consultados do provedor antes de alterar status.
4. Implementar cancelamento/reativação reais preservando o período pago, testes com ambiente de testes do provedor e só então habilitar capacidades no backend.
5. Configurar suporte público opcional e validar as telas em navegador. Nesta etapa a interface foi validada por revisão e build, sem teste visual automatizado.

Não houve commit, push, merge, deploy, migration em banco, seed, uso de credenciais reais ou chamadas financeiras. Nenhuma cobrança, Pix, cartão, invoice, refund, retry automático ou e-mail foi implementado.
