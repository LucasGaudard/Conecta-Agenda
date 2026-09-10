# Prompt 16 — recuperação segura de senha

## Diretório, branch e auditoria

Diretório: `C:\Users\lucas.silva\Downloads\Conecta Agenda\Conecta-Agenda`.
Branch: `main`. `Get-Location`, `git branch --show-current` e `git status --short` foram executados antes das alterações; o Git estava limpo no início deste prompt. As implementações anteriores foram preservadas.

A auditoria encontrou cadastro/login com e-mail normalizado para minúsculas, senha mínima de 6 caracteres, bcrypt com custo 10, JWT stateless com validade de 7 dias e ausência de revogação de sessão/rate limiter central. Não existia modelo de recuperação. `NEXT_PUBLIC_APP_URL` já estava no exemplo do frontend; foi reutilizado sem duplicação. O backend usa `FRONTEND_URL`, já existente, como origem confiável dos links.

## Prisma e migration

Adicionado `PasswordResetToken`, relacionado a User com exclusão em cascata, contendo id, userId, tokenHash único, expiresAt obrigatório, usedAt opcional e createdAt. Índices adicionais por userId/usedAt e expiresAt.

Migration incremental criada: `prisma/migrations/20260910180000_password_reset_tokens/migration.sql`. Nenhuma migration antiga foi editada. A nova migration **não foi executada**; nenhum banco real foi acessado.

## Rotas, serviço e provider

- `POST /auth/forgot-password`: recebe e-mail, normaliza conforme cadastro e retorna a mesma mensagem pública para conta existente, inexistente, SUPER_ADMIN e falha interna de emissão/notificação. Não inclui token, link, role, Business ou passwordHash. Há tempo mínimo comum de 300 ms para reduzir a diferença trivial de tempo de resposta; isso não equivale a garantia de tempo constante sob variações do banco/rede.
- `POST /auth/reset-password`: valida formato do token, senha mínima de 6 caracteres e confirmação idêntica. Token inexistente, expirado ou consumido retorna 400 com `RESET_TOKEN_INVALID_OR_EXPIRED`. Senha/confirmacão inválidas retornam `RESET_PASSWORD_INVALID`; falha de persistência retorna 503 com mensagem controlada.
- O serviço usa `crypto.randomBytes(32)`: 256 bits de aleatoriedade, representados por 64 caracteres hexadecimais. Calcula SHA-256 e passa exclusivamente o hash para persistência/consulta.
- `PASSWORD_RESET_TOKEN_TTL_MINUTES` tem padrão 30, aceita inteiros de 1 a 120 e foi adicionado aos exemplos da raiz/API.
- Emissão e consumo usam transações e bloqueio parametrizado `SELECT ... FOR UPDATE` na linha de User. A emissão invalida os tokens anteriores. O consumo verifica expiração/usedAt após adquirir o bloqueio, consome condicionalmente o token, atualiza passwordHash via bcrypt e invalida os demais tokens na mesma transação. Falha na atualização da senha desfaz o consumo.
- `EmailProvider.sendPasswordResetEmail` recebe os dados internos para envio futuro. `UnconfiguredEmailProvider` não envia, registra, persiste nem retorna links. Os testes injetam um capturador de links em memória; não há endpoint de debug nem retorno de link na API, inclusive em desenvolvimento.
- O provider padrão é inativo também em produção. Até implementar e configurar envio real, nenhum usuário receberá instruções por e-mail, apesar da resposta pública genérica.

## Frontend

Adicionado “Esqueci minha senha” ao login. Criadas `/forgot-password` e `/reset-password?token=...`, com formulário, loading, erro de rede, sucesso e estado de token inválido/expirado. A senha e confirmação seguem a regra do cadastro. O sucesso mostra “Senha alterada com sucesso.” e link para login. O token é lido da URL, enviado apenas no corpo da requisição de reset e não é salvo no localStorage. A URL é limpa após sucesso. As páginas têm metadados noindex e no-referrer.

`ForgotPasswordRequest` e `ResetPasswordRequest` foram adicionados ao pacote de tipos; o cliente reaproveita apiFetch. As validações do backend reaproveitam o schema de senha/e-mail do cadastro.

## Segurança e limites

- Token bruto não é persistido no banco.
- Token bruto e senha não são registrados pelas rotas de recuperação; logging de requisições dessas rotas é desabilitado e exceções não são serializadas publicamente. Testes em modo production verificam ausência de tokens/senha nos logs e respostas.
- E-mail inexistente e role não são revelados pela resposta; SUPER_ADMIN usa o mesmo fluxo.
- passwordHash não é retornado; bcrypt continua sendo utilizado.
- Token tem expiração e é de uso único, com atualização condicional e serialização por usuário.
- Token não é salvo no localStorage.
- Nenhuma credencial real foi adicionada, nenhum e-mail real foi enviado.
- Limitador local por IP: 10 requisições por 15 minutos em cada rota, 429 com Retry-After e até 10 mil entradas em memória por rota. O bloqueio é temporário e não depende da existência do e-mail. Payload limitado a 8 KB. JSON malformado, payload acima do limite e abuso podem retornar erros de protocolo/limite em vez da resposta genérica, sem consultar a existência da conta.
- Não há scheduler nem limpeza automática. Tokens expirados são ignorados; novas emissões/reset invalidam tokens pendentes.
- **JWTs antigos continuam válidos após reset**, até sua expiração original (até 7 dias), sujeitos às verificações normais de autenticação. Não foi criada blacklist ou revogação improvisada.

## Validações

- `pnpm db:generate`: passou; apenas geração local do cliente Prisma.
- `pnpm lint`: passou em todos os pacotes.
- `pnpm build`: passou em todos os pacotes; as duas novas páginas foram compiladas sem provider de e-mail. A primeira execução apontou índices possivelmente ausentes nas fixtures dos testes; as tipagens foram corrigidas e o build repetido passou.
- Suite equivalente: `pnpm exec tsx --test apps/api/src/domain/business-access.test.ts apps/api/src/routes/business-access.test.ts apps/api/src/billing/billing.test.ts apps/api/src/password-reset/password-reset.test.ts`: 18 testes passaram, zero falhas.
- `git diff --check`: passou.

Cobertura nova: 1.000 tokens distintos de 32 bytes, SHA-256, ausência de rede no provider padrão, e-mail existente/inexistente/SUPER_ADMIN com respostas iguais, produção sem link/token/role/passwordHash público, bcrypt, expiração, token inválido/usado, senha curta, confirmação divergente, invalidação de tokens anteriores, dois resets concorrentes com somente um sucesso, emissões concorrentes com somente um token pendente, rollback do consumo quando a senha não pode ser gravada, falha do provider sem revelar link, rate limit temporário e ausência de segredos nos logs.

Os testes usam Fastify inject e o repositório real sobre um Prisma simulado com transações serializadas e rollback. Não substituem um teste de concorrência em PostgreSQL real; nenhum banco de produção foi utilizado. Interface validada por revisão e build, sem teste visual em navegador.

Comandos auxiliares: Get-Content, rg, git diff --stat/--name-only, git ls-files, git status --short; `pnpm exec prettier --write` limitado aos arquivos TypeScript novos/alterados. Edições feitas com apply_patch e script Python local. COREPACK_HOME/PATH apontaram para o pnpm local; lint/build/testes foram executados com subprocessos autorizados quando necessário.

## Pendências para configurar em casa

1. Revisar e aplicar a migration posteriormente em ambiente autorizado. O fluxo persistente requer a tabela nova; ela não foi criada neste ambiente.
2. Implementar provider real de e-mail e configurá-lo fora do código. Validar o fluxo completo de entrega e as URLs de frontend. Não foi adicionado SMTP, Resend, Gmail ou outro transporte.
3. Validar transações e concorrência num PostgreSQL de testes, além do teste visual das páginas.
4. Para múltiplas instâncias, substituir o limitador local por infraestrutura compartilhada; configurar confiança de proxy com cuidado e avaliar proteção central contra abuso. A memória local reinicia com o processo e não limita tráfego agregado de várias instâncias.
5. Planejar revogação de sessões após reset. JWTs antigos não são invalidados nesta implementação.

Sem commit, push, merge, deploy, migration executada, seed, envio real, credenciais reais ou alterações em billing/plano.

## Arquivos alterados

- `.env.example`
- `apps/api/.env.example`
- `apps/api/src/app.ts`
- `apps/api/src/env.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/lib/auth.ts`
- `packages/types/src/index.ts`
- `prisma/schema.prisma`

## Arquivos criados

- `apps/api/src/middlewares/password-reset-rate-limit.ts`
- `apps/api/src/notifications/email-provider.ts`
- `apps/api/src/password-reset/token.ts`
- `apps/api/src/password-reset/repository.ts`
- `apps/api/src/password-reset/service.ts`
- `apps/api/src/password-reset/password-reset.test.ts`
- `apps/api/src/routes/password-reset.ts`
- `apps/api/src/schemas/password-reset.ts`
- `apps/web/src/components/auth/password-recovery.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/reset-password/page.tsx`
- `prisma/migrations/20260910180000_password_reset_tokens/migration.sql`
- `docs/prompt-16-relatorio.md`
