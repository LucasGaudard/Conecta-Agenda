# Preparacao para deploy

Nenhum deploy foi executado por este projeto.

## Neon PostgreSQL

1. Crie o banco e copie a connection string com SSL.
2. Configure `DATABASE_URL` apenas no ambiente da API.
3. Execute `pnpm db:generate`, `pnpm db:migrate` e `pnpm db:seed` em um ambiente controlado.

## Render - API

- Root directory: repositorio/monorepo
- Build: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @conecta-agenda/api build`
- Start: `pnpm --filter @conecta-agenda/api start`
- Variaveis: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `API_PORT` ou `PORT`
- `JWT_SECRET` deve ter pelo menos 32 caracteres e nunca deve ir para o frontend.

## Vercel - frontend

- Projeto: `apps/web`, preservando acesso ao workspace
- Variaveis: `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_URL` e usado pelo link publico e QR Code.

## Checklist

- Use HTTPS nas URLs publicas.
- Configure `FRONTEND_URL` exatamente para o dominio web.
- Aplique migrations antes de liberar trafego.
- Rode seed idempotente para garantir os planos.
- Valide `/health`, cadastro, login, agenda e fluxo publico.
- Nao exponha `DATABASE_URL` ou `JWT_SECRET` no frontend.
