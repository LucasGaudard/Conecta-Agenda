# Visao Geral

O Conecta Agenda sera uma plataforma SaaS de agendamento online para profissionais autônomos e pequenos negocios que dependem de horarios marcados.

## Objetivo do produto

Permitir que profissionais organizem seus atendimentos e disponibilizem uma experiência simples para clientes agendarem horarios.

## Publico inicial

- Profissionais autônomos
- Prestadores de serviço com agenda
- Pequenos negócios locais
- Equipes pequenas que precisam reduzir trabalho manual de marcação

## Diretrizes tecnicas

- Monorepo com `pnpm workspace`
- TypeScript em todos os apps e packages
- Separação clara entre frontend, backend e packages compartilhados
- Base preparada para deploy futuro em Vercel, Render e Neon
- Evolução incremental, sem antecipar regras de negocio

## Escopo desta etapa

- Setup inicial do monorepo
- API Fastify com rota de saude
- Web app Next.js com paginas simples
- Tailwind CSS e shadcn/ui preparados
- Prisma preparado sem modelos de dominio
