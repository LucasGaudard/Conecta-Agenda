# Conecta Agenda

SaaS de agendamento online para profissionais autonomos. A V1 inclui autenticacao, onboarding, servicos, clientes, horarios, bloqueios, pagina publica, agendamento online, agenda interna, dashboard, financeiro simples, WhatsApp manual e QR Code.

## Stack e estrutura

- Web: Next.js, TypeScript, Tailwind CSS, React Hook Form e Zod
- API: Fastify, TypeScript, Prisma, PostgreSQL, JWT e bcrypt
- Monorepo: pnpm workspace com `apps/api`, `apps/web` e pacotes compartilhados
- Destinos preparados: Vercel (web), Render (API) e Neon (PostgreSQL)

## Instalacao local

```powershell
pnpm install
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Configure uma URL PostgreSQL valida. O valor abaixo e apenas ilustrativo:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

Depois execute:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

API local: `http://localhost:3333`. Web local: `http://localhost:3000`.

## Comandos

```powershell
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:studio
pnpm lint
pnpm build
```

Nao execute `db:reset` em ambientes com dados importantes.

## Seguranca multiempresa

Rotas privadas usam JWT e extraem o negocio de `request.user.businessId`. IDs de negocio enviados pelo frontend nao sao aceitos. Consultas de servicos, clientes, horarios, bloqueios, agendamentos e agregacoes financeiras sao isoladas por negocio.

O token permanece armazenado no frontend nesta V1. Em producao, use HTTPS, um `JWT_SECRET` com pelo menos 32 caracteres e restrinja `FRONTEND_URL`. Cookies HttpOnly podem ser avaliados em uma versao futura.

## Limitacoes atuais

- Nao ha cobranca ou pagamento online.
- WhatsApp e manual: o sistema apenas abre `wa.me` com texto preenchido.
- Nao ha envio automatico, cron ou confirmacao de entrega.
- A infraestrutura esta preparada, mas nenhum deploy e realizado automaticamente.
- Fluxos reais exigem PostgreSQL configurado e a checklist manual em `docs/05-testes-manuais.md`.

Consulte tambem `docs/04-rotas-api.md`, `docs/06-deploy.md` e `docs/07-checklist-v1.md`.
