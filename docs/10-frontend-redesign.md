# Frontend — redesign do Prompt 36

A interface usa branco/lavanda, roxo, cartões arredondados, ícones Lucide,
tipografia do sistema e componentes existentes. Nenhuma dependência foi adicionada.
A imagem de referência orientou a composição; pessoas, avaliações, valores e tendências
da imagem não foram incorporados.

## Telas e componentes

- Empreendedor: sidebar fixa no desktop, cabeçalho, acesso à assinatura e perfil.
  Menu mobile em `dialog` nativo com foco contido, Escape e bloqueio de scroll.
- Dashboard: saudação com o nome da sessão, banner, seis indicadores da API,
  atalhos para agenda/clientes/financeiro/horários, próximos atendimentos,
  lembretes WhatsApp, link público, compartilhamento e download de QR Code.
- Calendário compacto: navegação entre meses, dia atual e pontos apenas nos dias
  dos atendimentos exibidos. Não representa disponibilidade nem toda a agenda.
- Agenda, clientes, serviços, horários/bloqueios, financeiro, perfil e configurações:
  superfícies, campos, ações, listas e feedbacks padronizados; formulários existentes
  preservados. Detalhes/remarcação da agenda usam um modal nativo acessível.
- Assinatura/bloqueio: recebe o tema pelo shell, CSS e botão compartilhado. O arquivo
  `billing-page.tsx`, inclusive checkout simulado, não foi alterado neste trabalho.
- SUPER_ADMIN: layout identificado como Administração global; somente indicadores,
  profissionais, criação, gestão de acesso e cortesias existentes. O antigo link
  para `/dashboard` foi removido do cabeçalho porque essa rota redireciona o admin
  para `/admin`; não há acesso cruzado a um tenant.
- Landing, login, cadastro, recuperação de senha, onboarding e página pública:
  identidade visual consistente. A página pública preserva a cor configurada pelo
  profissional, serviços, etapas, horários e permissões de agendamento.

Componentes novos: `Brand`, `OverviewCard`, `MiniCalendar` e `AppDialog`.
`calendar.ts` trabalha com datas civis locais e tem testes de semanas, meses,
ano bissexto e virada de ano. O dashboard elimina duplicações entre próximo
atendimento e lista de amanhã, mantendo lembretes quando disponíveis.

## Dados e preservação

O financeiro do dashboard é **previsto**, não pagamento confirmado. Não há
percentuais de crescimento, avaliações, gráficos de receita ou contadores fictícios.
Estados vazios dependem das respostas da API; em falhas de carregamento, listas
não são apresentadas como vazias; dados já carregados são identificados como anteriores. Os módulos não foram reescritos.

Backend, contratos, regras de trial/acesso, provider, schema e migrations não foram
alterados. As alterações pendentes dos Prompts 33/35 foram preservadas. Não houve
conexão ao Neon, chamadas financeiras, migrations, seed, commit, push ou deploy.

## Verificação e aceite visual

Resultados locais em 13/10/2026:

- `pnpm test`: 69 testes passaram, incluindo os três testes novos do calendário.
- `pnpm lint`: passou para todos os pacotes; lint web passou novamente após o último ajuste.
- `pnpm build`: passou para todos os pacotes, incluindo TypeScript e geração das rotas;
  build web passou novamente após o último ajuste.
- `pnpm exec prisma validate --schema prisma/schema.prisma`: schema válido, usando URL fictícia.
- `git diff --check`: sem erros.
- 21 rotas responderam HTTP 200 no servidor local de smoke test, depois encerrado.
- 16 destinos de links internos literais conferidos contra as rotas, sem links ausentes.
- Hashes de 87 arquivos de backend, Prisma, contratos e billing/checkout conferidos
  antes e depois: nenhum mudou durante o Prompt 36.
- Branch `main`, HEAD `d7074f4`, sem commit, push ou deploy.

Executar os testes existentes, lint, build, `prisma validate` e `git diff --check`
com ambiente de teste e DATABASE_URL fictícia. Não iniciar a API com a `.env` de
produção para testar o visual.

O smoke test HTTP local confirma as rotas e a renderização inicial; ele não valida
hidratação, interações autenticadas ou disposição visual no navegador. Não havia
navegador conectado nesta sessão. O aceite visual deve ser feito em ambiente
isolado, com dados de teste e checkout indisponível/simulado:

1. Conferir desktop e larguras de 320, 375, 768 e 1024 px, zoom de 200% e textos longos.
2. Testar menu mobile, Escape, foco, retorno do foco, scroll e mudança para desktop.
3. Validar sessão profissional/admin, expirada, bloqueada e onboarding incompleto.
4. Conferir dashboard vazio/com dados/erro/loading; calendário e QR/link público.
5. Conferir criação/edição de clientes e serviços; agenda, detalhes, remarcação,
   confirmação, conclusão, cancelamento e lembretes em fixtures isoladas.
6. Conferir horários, bloqueios, filtros financeiros, perfil e configurações.
7. Conferir login, cadastro, recuperação, onboarding e etapas de agendamento público.
8. Conferir assinatura simulado/indisponível sem ativação por checkout; não usar
   credenciais de produção nem criar cobranças para validar o redesign.

Publicação e validação nos painéis Render/Vercel ficam para uma autorização futura.
