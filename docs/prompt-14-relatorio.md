# Prompt 14 — bloqueio comercial e assinatura

## Diretório e auditoria

- Workspace autorizado: `C:\Users\lucas.silva\Downloads\Conecta Agenda\Conecta-Agenda`.
- Branch: `main`. Estado inicial: apenas `.vscode/` não rastreado, preservado.
- Não foram encontrados arquivos `AGENTS.md` no projeto.
- O helper existente era informativo, permitia `PAST_DUE` indefinidamente e assinatura ativa sem data final. Rotas profissionais usavam apenas `authenticate`.
- A assinatura pertence ao usuário; o negócio referencia esse proprietário. Essa arquitetura foi preservada.
- O painel já possuía bloqueio, desbloqueio e cortesia. Essas ações permanecem e passam a ter efeito nas requisições protegidas.

## Implementação

1. `requireBusinessAccess` roda depois de `authenticate`, consulta o negócio da sessão e a assinatura do proprietário a cada requisição e usa `resolveBusinessAccess`. SUPER_ADMIN é isento de restrição comercial. Negócio ausente recebe 403.
2. Rotas protegidas: dashboard, services, working-hours, blocked-times, customers, appointments, finance, PUT business/me e POST onboarding/complete. A última evita contornar a proibição de alterações de perfil.
3. Leitura de business/me, auth/me, login e billing/status permanecem acessíveis. Admin mantém requireSuperAdmin, sem guarda comercial.
4. Tolerância central: PAYMENT_GRACE_PERIOD_DAYS, padrão 3, validada no env e documentada nos exemplos. Prazo contado de currentPeriodEnd, com corte exato no instante final. PAST_DUE sem vencimento conhecido não concede acesso indefinido.
5. Bloqueio manual prevalece sobre cortesia e assinatura. Cortesia futura libera acesso. ACTIVE exige período válido; TRIALING exige teste futuro; CANCELED e EXPIRED com período pago futuro permitem uso até o vencimento. Nenhum status é alterado automaticamente.
6. GET billing/status retorna plano, preço, status financeiro, datas, estado de acesso e tolerância. blockReason é mensagem controlada; texto administrativo e identidade do administrador não são retornados.
7. billing-required é autenticada, mostra mensagem correspondente ao estado, suporte, atualização da situação e saída. Se o acesso voltar, encaminha ao dashboard.
8. settings/billing mostra plano, preço, status, período, teste, tolerância, cortesia e acesso. O botão de pagamento é desabilitado e informa indisponibilidade. A rota opcional request-payment foi omitida, pois não acrescentaria função real.
9. AuthProvider conserva o acesso de auth/me. AppShell impede renderização das áreas restritas e mostra banner durante a tolerância. Login direciona bloqueados à tela de assinatura. Menus privados são ocultados para bloqueados.
10. apiFetch preserva mensagem e código. BUSINESS_ACCESS_BLOCKED com 402/403 provoca navegação completa para billing-required, descartando estado das páginas e conservando o token. auth/me e billing/status atualizam a situação após a navegação. Não é tratado como 401.
11. GET public/:slug retorna bookingAvailable e mensagem neutra quando indisponível. Serviços continuam disponíveis pela API; a tela pública preserva o cabeçalho comercial e substitui o formulário pela mensagem neutra. available-times e criação pública retornam 403 antes de consultar horários ou gravar clientes/agendamentos.
12. Admin mantém filtros por estado e ganha filtro agregado de acesso liberado. Lista e detalhe mostram canAccess, requiresPaymentAttention e gracePeriodEndsAt; PAST_DUE recebe destaque vermelho, inclusive sob cortesia ou bloqueio manual.
13. Códigos: BUSINESS_ACCESS_BLOCKED para acesso privado; PUBLIC_BOOKING_UNAVAILABLE para agendamento público; PAYMENT_ATTENTION identifica o estado de tolerância e orienta o banner. Bloqueio financeiro usa 402 e manual usa 403.
14. Segurança: decisão no servidor, negócio obtido da sessão, schemas e campos explícitos preservados nas alterações profissionais, sem aceitação de campos de bloqueio/cortesia/status financeiro. JWT não recebeu estado comercial. Dados e agendamentos existentes são preservados.
15. next.config.ts tinha raiz absoluta do computador anterior. Foi substituída por resolução relativa à raiz do monorepo, necessária para o build neste clone.

## Validação e comandos

Resultados finais:

- `pnpm db:generate`: passou, gerando apenas o cliente Prisma local.
- `pnpm lint`: passou em todos os pacotes.
- `pnpm build`: passou em todos os pacotes, com Turbopack e as duas novas páginas.
- `pnpm exec tsx --test apps/api/src/domain/business-access.test.ts apps/api/src/routes/business-access.test.ts`: 13 testes passaram.
- `git diff --check`: passou.

Os testes cobrem ACTIVE, teste válido/expirado, cortesia, precedência manual, cancelamento com e sem período pago, EXPIRED, ausência de datas, tolerância e limite exato; também requisições Fastify com Prisma simulado para bloqueio privado, HTTP 402/403 versus 401, leitura de assinatura/perfil, identidade do negócio da sessão, mensagens públicas sem dados financeiros, ausência de transação de escrita no bloqueio, desbloqueio com o mesmo token e passagem da autorização administrativa para SUPER_ADMIN. Nenhum teste acessa o Neon. Não foi realizado teste visual em navegador nem integração com banco real.

Outros comandos utilizados:

- Inspeção: `Get-Location`, `git branch --show-current`, `git status --short`, `git diff --stat`, `git diff --numstat`, `git diff --name-only`, `git ls-files --others --exclude-standard`, `rg`, `Get-Content`, `Get-ChildItem`, `Get-Command`, `Test-Path`.
- Instalação: `corepack pnpm install --frozen-lockfile`, depois `corepack pnpm install --frozen-lockfile --offline=false`. Cache offline e rede restrita falharam inicialmente; instalação autorizada concluiu sem alterar lockfile.
- COREPACK_HOME foi apontado para `node_modules/.corepack`. Criado shim local ignorado `node_modules/.bin/pnpm.cmd` e adicionado ao PATH dos comandos, pois pnpm não estava disponível globalmente.
- Geração do Prisma repetida com download autorizado do binário após bloqueio de rede. Lint/build/testes executados com subprocessos autorizados após EPERM do sandbox.
- `pnpm --filter @conecta-agenda/web exec next build --webpack`: passou como diagnóstico antes da correção da raiz do Turbopack; o build padrão foi posteriormente validado com sucesso.
- `pnpm exec prettier --write` limitado aos arquivos TypeScript modificados/criados. Edições locais por apply_patch e scripts Python; remoção apenas de dois arquivos JS/map gerados pela tentativa inicial de build em packages/types/src.

## Pendências e limites

- Configurar opcionalmente NEXT_PUBLIC_SUPPORT_WHATSAPP ou NEXT_PUBLIC_SUPPORT_EMAIL para habilitar o contato. Não há contato pessoal fixo no código.
- Não há checkout, provedor, webhook, cobrança ou pagamento simulado. Isso está fora do escopo.
- A validação de interface foi por compilação e revisão; teste visual em navegador permanece recomendado.
- Não houve commit, push, merge, deploy, migration, seed ou alteração no Neon.

## Arquivos

Lista completa abaixo; `.vscode/` é preexistente e não foi alterada.

### Alterados

- `.env.example`
- `apps/api/.env.example`
- `apps/api/src/app.ts`
- `apps/api/src/domain/business-access.ts`
- `apps/api/src/env.ts`
- `apps/api/src/middlewares/auth.ts`
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/appointments.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/blocked-times.ts`
- `apps/api/src/routes/business.ts`
- `apps/api/src/routes/customers.ts`
- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/routes/finance.ts`
- `apps/api/src/routes/onboarding.ts`
- `apps/api/src/routes/public.ts`
- `apps/api/src/routes/services.ts`
- `apps/api/src/routes/working-hours.ts`
- `apps/api/src/schemas/admin.ts`
- `apps/web/.env.example`
- `apps/web/next.config.ts`
- `apps/web/src/app/[slug]/page.tsx`
- `apps/web/src/app/admin/businesses/[id]/page.tsx`
- `apps/web/src/app/admin/businesses/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/components/app/app-shell.tsx`
- `apps/web/src/components/app/header.tsx`
- `apps/web/src/components/app/nav-items.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/providers/auth-provider.tsx`
- `packages/types/src/index.ts`

### Criados

- `apps/api/src/domain/business-access.test.ts`
- `apps/api/src/middlewares/business-access.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/business-access.test.ts`
- `apps/web/src/app/billing-required/page.tsx`
- `apps/web/src/app/settings/billing/page.tsx`
- `apps/web/src/components/app/billing-page.tsx`
- `docs/prompt-14-relatorio.md`
