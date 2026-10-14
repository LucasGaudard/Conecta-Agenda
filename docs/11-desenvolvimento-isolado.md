# Desenvolvimento isolado — Prompt 39

## Comandos protegidos de banco dev — Prompt 42

**Preparação concluída no Prompt 43:** as quatro migrations existentes foram
aplicadas exclusivamente no projeto Neon dev e o status final ficou sem pendências
ou falhas. Foram criados dois usuários fictícios (PROFESSIONAL e SUPER_ADMIN),
um negócio, três planos internos, três serviços (dois ativos), quatro clientes,
oito agendamentos com estados variados, sete dias de horários e um bloqueio.
As contas passaram por login real via Fastify.inject, sem abrir um servidor.
Onboarding, permissões, indicadores, financeiro, disponibilidade pública e trial
de sete dias desde Business.createdAt foram verificados. Mercado Pago permanece OFF,
sem ProviderPlan, checkout, pagamento ou período pago fictício.

### Acesso às contas dev

- PROFESSIONAL: `profissional@conecta-agenda.test`, painel `/dashboard`.
- SUPER_ADMIN: `superadmin@conecta-agenda.test`, painel `/admin`; sem Business ou assinatura.
- Senhas novas e diferentes estão somente no arquivo privado
  `apps/api/.env.development.accounts.local`, ignorado pelo Git. Abra esse arquivo
  localmente no editor para usar a senha correspondente; não compartilhe seu conteúdo
  em chat, capturas de tela ou repositório. O script não imprime senhas nem tokens.
- Login: http://localhost:3001/login. Link público fictício:
  http://localhost:3001/agenda-ficticia-dev. Telefones e nomes são fictícios;
  não enviar mensagens para esses contatos.
- O trial expira naturalmente sete dias depois da criação do negócio. A preparação
  nunca reinicia o prazo, troca senhas existentes nem promove profissionais existentes.
  Não reutilizar essas credenciais fora do dev.

Na raiz, iniciar primeiro `pnpm dev:api` (3333, sem watcher), aguardar ficar pronto e
em outro terminal iniciar `pnpm dev:web` (3001). Não executar build/testes junto dos
servidores num computador com 8 GB de RAM. Nenhum servidor foi iniciado pela preparação.

`pnpm dev:db:fixtures` é o preparo separado deste dev: revalida identidade/TLS
imediatamente antes da primeira escrita, usa datasource explícito, impede HTTP externo,
recusa contas estranhas e preserva usuários/trials existentes. Um segundo uso no mesmo
dia não duplica os registros fixos. Os agendamentos mantêm suas datas originais e não
são reposicionados em execuções posteriores; checks de indicadores diários dependem
dessas datas. Não executa `prisma/seed.ts` nem os scripts admin/seed de produção.

- `pnpm dev:db`: validação de identidade/TLS somente leitura (alias de `dev:db:validate`).
- `pnpm dev:db:status`: valida o destino e consulta o histórico e `migrate status`.
- `pnpm dev:db:migrate`: comando de escrita exclusivo para dev; aplica somente
  migrations existentes e pendentes por `migrate deploy`, após revalidar imediatamente
  a conexão. Recusa produção direta/pooled, mudança de perfil, histórico divergente,
  migration falha e schema populado sem histórico. Não executa seed nem cria migrations.

Os comandos leem apenas o perfil dev como fonte de configuração. A `.env` da raiz
serve exclusivamente para excluir o endpoint de produção. O perfil validado é
instalado no processo antes da construção do Prisma, impedindo que o carregamento
automático do Prisma preencha DATABASE_URL/JWT/URLs com valores da raiz. Variáveis
herdadas conflitantes continuam sendo recusadas. Erros são sanitizados.

Na execução inicial do Prompt 42, `dev:db` confirmou o destino, mas a conferência
seguinte detectou conflito de variáveis durante a construção do Prisma. A ordem de
carregamento do novo comando foi corrigida e testada sem banco. Conforme a regra de
interromper após falha, nenhuma migration, seed ou conta foi criada; a preparação do
banco e os testes de login/onboarding ainda precisam ser retomados. Não iniciar o
teste funcional do frontend antes de concluir essa preparação.

Frontend: http://localhost:3001. API: http://localhost:3333, bind 127.0.0.1.
Não há PostgreSQL local nem Docker neste perfil. Nenhum servidor ou comando de
banco foi executado durante a preparação.

## Configuração manual

1. Criar um **projeto Neon exclusivo de desenvolvimento**, com dados de teste e
   credenciais próprias. Não copiar dados pessoais ou credenciais da produção.
2. Confirmar projeto, branch, endpoint e database no painel. No arquivo privado
   `apps/api/.env.development.local`, preencher somente `DATABASE_URL`,
   `DEV_DATABASE_HOST` (host sem protocolo/porta/credenciais) e `DEV_DATABASE_NAME`.
   Se o database for `neondb`, esse nome já está preparado. A URL exige sslmode=require.
3. A chave JWT dev foi gerada no arquivo privado sem exibição. Não copiar a chave
   de produção. Os dois arquivos `.env.development.local` são ignorados pelo Git.
4. Preparar schema, plano e contas de teste em uma etapa de banco separada e
   autorizada, após confirmar o destino. Um projeto vazio ainda não permite login.

_*Não executar os scripts db:* ou Prisma CLI neste momento._* Eles mantêm seu
carregamento anterior e podem usar a `.env` de produção da raiz. Este perfil
protege a inicialização da API; não transforma automaticamente a CLI de banco
nem os scripts de seed/admin em comandos de desenvolvimento.

## Proteções

- API em desenvolvimento lê apenas `apps/api/.env.development.local`; não usa
  `apps/api/.env` nem `.env` da raiz como fallback.
- Validação ocorre antes do build no launcher e antes da aplicação/Prisma no
  entrypoint. Falta de configuração impede iniciar a API.
- Host/database precisam corresponder aos confirmados no perfil; endpoint de
  produção `ep-rough-pine-ai569xud` é recusado, direto ou pooled, mesmo declarado
  como destino dev. SSL é obrigatório e parâmetros alternativos de destino são recusados.
- Configuração conflitante herdada do terminal é recusada, sem substituição
  silenciosa. Use terminais novos e sem variáveis de produção. Erros exibem códigos,
  nunca valores secretos.
- `NODE_ENV=development`, `HOST=127.0.0.1`, `API_PORT=3333`,
  `FRONTEND_URL=http://localhost:3001`, `BILLING_CHECKOUT_MODE=OFF`.
- Credenciais/configuração Mercado Pago são recusadas neste perfil. A proteção
  original da simulação continua intacta: Neon dev não habilita checkout simulado.
- Web usa `apps/web/.env.development.local` e recusa URLs de API/aplicação remotas
  durante desenvolvimento. CORS e URLs de recuperação usam FRONTEND_URL; a sessão
  do navegador é separada da porta 3000 e usa a chave JWT própria do ambiente.
- Produção continua usando o ambiente fornecido pelo Render; o script start não
  foi alterado. Testes com mocks continuam usando NODE_ENV=test.

## Execução, somente depois de configurar e preparar o banco dev

Na raiz do projeto, em dois terminais:

```powershell
# Terminal da API: valida, compila apenas a API e executa uma instância sem watcher.
pnpm dev:api
```

```powershell
# Terminal do frontend: uma instância do Next.js, porta explícita 3001.
pnpm dev:web
```

Abrir http://localhost:3001/login. Profissional com acesso/onboarding completos:
/dashboard. SUPER_ADMIN de teste: /admin. Plano expirado/bloqueado: /billing-required.
/health da API só indica servidor ativo, não verifica o banco.

`pnpm dev` agora apenas orienta a iniciar separadamente; não abre outro par de
servidores. Interromper o terminal correspondente com Ctrl+C antes de reiniciar.
Não encerrar todos os processos Node, pois IDE e ferramentas podem usá-los.
Após alterar código da API, reiniciar explicitamente para recompilar; não há watcher.

Para 8 GB de RAM, evitar executar build/testes/lint junto dos servidores e manter
poucas abas abertas. Next pode usar subprocessos internos; isso não significa duas
instâncias da aplicação. A compilação do frontend ainda exige memória e deve ser
medida na primeira execução. Nenhum limite experimental de heap foi imposto.

## Verificações leves

`pnpm test:dev-config` testa apenas configuração/isolamento, sem banco e sem
servidores. O launcher de testes fornece NODE_ENV=test, conexão fictícia e chave
JWT de fixture; não herda credenciais de billing/admin de produção. Os testes
não precisam de credenciais reais. Typecheck pode ser feito
separadamente com tsc --noEmit; nenhum build completo do frontend é necessário
para conferir este perfil. Os 69 testes anteriores permanecem na suíte, com os
novos testes de configuração acrescentados.

Verificações da preparação: 11 testes focados de isolamento e três testes de
calendário aprovados; tsc --noEmit de API/web, lint dos arquivos afetados,
checagem sintática dos launchers e git diff --check aprovados. O teste de calendário
recebeu apenas asserções de existência para satisfazer o typecheck estrito.
Não houve build completo do frontend, inicialização de servidor ou acesso ao banco.

O próximo passo é obter o endpoint dev, preencher o perfil e autorizar a preparação
exclusiva do banco dev. Billing/redesign e as migrations existentes foram preservados.
