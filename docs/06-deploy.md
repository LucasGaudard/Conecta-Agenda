# Ambiente, provisionamento e publicação

Nenhum comando de banco ou publicação foi executado no Prompt 18. Use Node >=22.16 (validado com 24.11) e pnpm 10.23. Nunca coloque segredos em NEXT_PUBLIC, logs, argumentos de terminal ou arquivos rastreados.

## Carregamento de ambiente

Fastify não carrega dotenv por conta própria. A API carrega explicitamente `apps/api/.env`, depois `.env` da raiz, antes da validação. Variáveis fornecidas pelo processo prevalecem, inclusive vazias. Funciona em src e dist, sem depender do diretório corrente. NODE_ENV=production ou test no processo desabilita arquivos locais. Produção deve fornecer NODE_ENV antes do processo iniciar.

Admin e seed usam o mesmo carregador, sem importar toda a configuração da API. Prisma 6 CLI tem carregamento próprio de `.env` da raiz: execute da raiz, sem arquivos Prisma de ambiente duplicados. Produção deve usar checkout limpo sem `.env` local e variáveis do gerenciador de segredos.

Next.js carrega nativamente em `apps/web`: processo, `.env.<ambiente>.local`, `.env.local` (exceto test), `.env.<ambiente>`, `.env`. O `.env` da raiz do monorepo não substitui o arquivo do frontend. NEXT_PUBLIC é incorporado ao build: mudanças exigem novo build.

Prefira `.env` da raiz para API e Prisma local; `apps/api/.env` é override opcional e pode fazer a API apontar a banco diferente da CLI. Não mantenha DATABASE_URL divergente. Nos testes simulados use NODE_ENV=test para isolar arquivos locais.

| Uso                                    | Variáveis                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API local                              | NODE_ENV=development, DATABASE_URL, JWT_SECRET, FRONTEND_URL; API_PORT default 3333, HOST default 0.0.0.0                                                  |
| Web local                              | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL; defaults localhost fora de produção                                                                              |
| Render API                             | NODE_ENV=production, DATABASE_URL, JWT_SECRET aleatório >=32 caracteres, FRONTEND_URL HTTPS, PORT fornecida pela plataforma, HOST=0.0.0.0                  |
| Vercel web                             | NEXT_PUBLIC_API_URL HTTPS da API, NEXT_PUBLIC_APP_URL HTTPS do frontend                                                                                    |
| Admin, somente durante provisionamento | SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD                                                                                                  |
| Comercial                              | PAYMENT_GRACE_PERIOD_DAYS: inteiro 0 a 365, default 3                                                                                                      |
| Recuperação                            | PASSWORD_RESET_TOKEN_TTL_MINUTES: 1 a 120, default 30; FRONTEND_URL, DATABASE_URL                                                                          |
| Mercado Pago opcional, backend         | MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_WEBHOOK_SECRET, MERCADO_PAGO_PLAN_ID, MERCADO_PAGO_SUCCESS_URL, MERCADO_PAGO_FAILURE_URL, MERCADO_PAGO_PENDING_URL |
| Suporte público opcional               | NEXT_PUBLIC_SUPPORT_WHATSAPP, NEXT_PUBLIC_SUPPORT_EMAIL                                                                                                    |
| Seed demo                              | NODE_ENV=development, ALLOW_DEMO_SEED=true; somente banco descartável                                                                                      |

API_PORT prevalece sobre PORT; no Render deixe API_PORT ausente. FRONTEND_URL é a origem exata de CORS e links de reset. O marcador change-me dos exemplos é recusado em produção. NEXT_PUBLIC_APP_NAME está no exemplo, mas não é consumido.

Mercado Pago permanece scaffold, mesmo com variáveis completas. Provider de e-mail permanece inativo, sem variáveis SMTP/Resend; nenhum desses segredos é necessário para iniciar. JWTs antigos não são revogados após reset, e rate limiter continua por instância.

## Provisionamento SUPER_ADMIN

Após migrations, em ambiente controlado com destino confirmado, execute futuramente:

```powershell
pnpm db:admin:create
```

As três variáveis são obrigatórias antes da consulta ao banco. Valida e normaliza e-mail; senha exige >=12 caracteres, maiúscula, minúscula, número e símbolo, até 72 bytes UTF-8 (limite bcrypt). Cria apenas User SUPER_ADMIN, sem Business, assinatura, planos ou demo.

É idempotente quanto ao estado: repetir não muda dados, mas retorna falha segura se e-mail existir, inclusive para SUPER_ADMIN. Não altera nome, senha ou role. Busca colisões sem distinguir maiúsculas/minúsculas; colisão concorrente na restrição única falha sem fallback de update. Falhas não serializam erros Prisma ou credenciais. Em falha de transporte, confirme manualmente se a criação foi concluída antes de repetir.

Para e-mail existente, confirme identidade/role em acesso autorizado e prefira outro e-mail exclusivo. Promoção ou recuperação exige procedimento humano separado e auditado; não contorne com upsert. Retire SUPER_ADMIN_PASSWORD do ambiente após uso.

O seed demo não provisiona admin. Bloqueia produção, test, ambiente indefinido ou opt-in ausente antes de instanciar Prisma. Ainda sobrescreve dados demo e planos, sem transação global: use apenas banco descartável. NODE_ENV=development não prova que o destino é descartável. O período demo é limitado a 30 dias.

## Migrations e banco existente

SQL das três migrations preservado: initial_schema, admin_access_control e password_reset_tokens. O lock antes ausente agora declara PostgreSQL. Não se confirmou estado aplicado no banco. As migrations administrativas e de tokens são aditivas; ALTER TABLE pode adquirir locks. Exclusão de User elimina seus tokens por cascade, conforme o modelo.

Antes de aplicar: confirme projeto/branch Neon, host e nome do banco em console seguro sem imprimir connection string; garanta backup/snapshot e restauração testada; reserve janela para locks; valide SQL em staging. Banco sem histórico ou criado com db push exige decisão de baseline após comparar schema real. Não marque migrations como aplicadas às cegas nem edite SQL já aplicado.

Na raiz, em job controlado usando Prisma 6 do lockfile:

```powershell
pnpm exec prisma migrate status --schema prisma/schema.prisma
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma migrate status --schema prisma/schema.prisma
```

Status consulta o banco; deploy modifica schema aplicando pendências, sem seed. Deploy não detecta todo drift. Não usar migrate dev, db push ou migrate reset em produção. Falha/divergência exige investigação antes de repetir ou usar migrate resolve. Gere cliente separadamente com `pnpm db:generate`.

## Estratégia explícita para assinaturas legadas

ACTIVE sem currentPeriodEnd não comprova período pago. Resolver mantém restrição e indica revisão administrativa; datas inválidas são tratadas como ausentes sem erro de serialização. Não há atualização automática nem janela renovada a cada requisição.

Antes de liberar tráfego, um responsável deve inventariar ACTIVE sem vencimento, TRIALING sem fim de teste, PAST_DUE sem vencimento e outras inconsistências. Para cada conta, registre a decisão: confirmar período pago com evidência e corrigir data por procedimento autorizado; conceder cortesia explícita accessOverrideUntil com prazo fixo e revisão agendada no painel admin; ou confirmar restrição quando não houver direito válido.

O modelo atual suporta cortesia limitada, inclusive sem assinatura. Bloqueio manual prevalece, e cortesia expira exatamente no prazo. Contas não revisadas impedem liberar tráfego desta versão. Não publique antes dessa revisão para evitar bloqueios inesperados. O resolver não tem dados para inferir pagamentos nem identificar sozinho contas legadas.

## Ordem de publicação futura

1. Preparar staging, segredos, backup, lint, build e testes.
2. Confirmar destino/histórico e aplicar migrations em job controlado antes da nova API.
3. Provisionar admin, revisar contas legadas e catálogo de planos. Planos/preços de produção exigem procedimento separado aprovado; nunca seed demo.
4. Render: raiz do monorepo; build: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @conecta-agenda/api build`; start: `pnpm --filter @conecta-agenda/api start`. Migrations são etapa anterior separada, não efeito oculto do start.
5. Vercel: apps/web com acesso ao workspace e envs definidos antes do build. FRONTEND_URL deve corresponder à origem publicada; previews não são autorizados automaticamente pelo CORS.
6. Liberar tráfego após revisão comercial; validar health, login admin/profissional, agenda, fluxo público e bloqueios. Anunciar pagamentos/recuperação somente depois de implementar e validar providers.
