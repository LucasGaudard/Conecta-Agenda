# Preparação de assinaturas Mercado Pago em teste

Esta etapa não faz chamadas à API Mercado Pago nem modifica o Neon. O cliente HTTP exige transporte `SIMULATED` injetado e não existe adapter de rede padrão. A rota `POST /billing/checkout` agora possui fluxo persistente simulado, desativado por padrão. `checkoutAvailable` só pode ser verdadeiro em teste/desenvolvimento com banco local isolado e opt-in explícito. Cancelamento público e webhook continuam indisponíveis.

## Contratos oficiais usados

- `GET /preapproval_plan/{id}`: consultar os termos do plano mapeado antes de preparar a assinatura.
- `POST /preapproval`: criação com `preapproval_plan_id`, `external_reference`, `payer_email`, token de cartão e `status=authorized`.
- `GET /preapproval/{id}`: consulta por referência persistida, validando conta, plano e referência interna.
- `PUT /preapproval/{id}` com `status=cancelled`: interromper renovações futuras. O cliente consulta e valida o recurso antes; não modifica o período pago local.

A documentação de [assinaturas com plano associado](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-associated-plan) exige token de cartão e `authorized`. O fluxo [com pagamento pendente](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments) é descrito para assinatura sem plano. Não presumir que `pending` com plano e um link de retorno fornecem o mesmo contrato. A decisão entre tokenização e checkout hospedado deve ser validada antes de conectar o cliente.

Referências: [criar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post), [consultar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-preapproval/get), [atualizar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/update-preapproval/put) e [planos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval-plan/post).

`authorized` representa autorização da assinatura, não confirmação de pagamento nem direito a um período pago. Resposta de criação, retorno do checkout e webhook não verificado nunca concedem acesso. O cliente não tem dependência de escrita em Subscription ou no resolver de acesso.

## Configuração e credenciais a obter

Em Suas integrações no painel Mercado Pago, identifique a aplicação destinada a Assinaturas e confirme o procedimento de testes desse produto. Obtenha o Access Token correspondente ao vendedor de teste, o ID da aplicação e o ID do vendedor (collector). Confirme que vendedor e comprador são contas de teste brasileiras diferentes e use somente os cartões/meios fictícios indicados para o produto. A disponibilidade e o procedimento de teste de Assinaturas devem ser confirmados no painel/documentação específica; não transpor automaticamente instruções de Checkout Pro, Orders ou Pagamentos automáticos.

A documentação de [contas de teste](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts?scope=prod) descreve vendedor/comprador e país. O [modelo de credenciais](https://www.mercadopago.com.br/developers/pt/docs/automatic-payments-orders/resources/credentials?scope=prod) alerta que prefixos variam por solução. Um token com prefixo APP_USR não prova que a conta é real; um nome de variável TEST também não comprova que a credencial pertence a uma conta de teste. Antes de um transporte conectado, verificar conta/aplicação e sua natureza de teste por um procedimento autorizado. Nesta etapa nenhuma credencial real é necessária.

As futuras variáveis de ambiente isolado são:

```dotenv
MERCADO_PAGO_ENVIRONMENT=TEST
MERCADO_PAGO_TEST_ACCESS_TOKEN=
MERCADO_PAGO_TEST_APPLICATION_ID=
MERCADO_PAGO_TEST_COLLECTOR_ID=
MERCADO_PAGO_TEST_BACK_URL=https://example.invalid/settings/billing
MERCADO_PAGO_TEST_TIMEOUT_MS=5000
```

O domínio example.invalid é apenas placeholder; substituí-lo por uma URL HTTPS da homologação na etapa conectada. Timeout aceita inteiro de 1 a 30000 ms e abrange requisição e leitura do corpo. Não configurar estes valores no Render de produção ou no frontend. Fornecer segredos por ambiente/gerenciador de segredos, nunca em Git, chat ou argumentos de terminal.

`MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN`, `MERCADO_PAGO_PRODUCTION_APPLICATION_ID`, `MERCADO_PAGO_PRODUCTION_COLLECTOR_ID` e `MERCADO_PAGO_PRODUCTION_BACK_URL` são nomes reservados e não são lidos pelo cliente de teste. Não existe fallback entre grupos. Variáveis genéricas do provider antigo permanecem somente por compatibilidade com o scaffold indisponível.

Public Key pode ser necessária na futura decisão de tokenização no navegador; não é usada nesta etapa. Client Secret/OAuth não é necessário para o modelo de cobrança da própria conta do SaaS. O segredo de webhook somente será necessário após implementar sua verificação; não registrar um webhook ativo apontando para a rota atual. A assinatura continua por conta do SaaS, não por credenciais de cada negócio.

## Autoridade, isolamento e idempotência

`prepareTestSubscriptionCreation` recebe o ator autenticado separado do pedido e consulta assinatura, plano e usuário com filtros de tenant. Busca o mapeamento `ProviderPlan` pela chave `(planId, MERCADO_PAGO, TEST)`. E-mail vem do usuário persistido; preço vem do plano interno e é comparado aos termos mensais BRL do plano externo. A referência e a chave de idempotência vêm de `BillingCheckoutAttempt` da mesma assinatura e ambiente. Dados extras como preço, businessId e IDs externos são recusados. Não são lidos passwordHash, dados de cartão ou credenciais de usuários.

O helper só prepara o pedido: não cria a tentativa, não envia POST, não salva referências nem muda assinatura. Para consulta/cancelamento, `loadTestSubscriptionReference` exige vínculo persistido TEST pertencente ao ator. Plano/mapeamento desativado continua consultável para permitir cancelamento de contratos existentes.

O cliente valida as respostas e seus application_id/collector_id, limita paths a IDs válidos, fixa a origem HTTP oficial e recusa redirecionamento. Erros não incluem corpo remoto, token, e-mail ou causa original. Não há retries automáticos de POST ou PUT.

A proteção de duplicatas de criação usa chave e hash do pedido, une chamadas concorrentes e reutiliza resultado na mesma instância. Mesmo falhas ambíguas ficam registradas; timeout ou 409 exige reconciliação, não outro POST. O cancelamento consulta primeiro e evita PUT quando já cancelado. O cache é limitado a 256 criações e falha sem remover entradas para não perder a proteção.

Essa proteção do cliente é somente local ao processo. O serviço de checkout acrescenta o claim durável descrito abaixo. Não há garantia documentada de `X-Idempotency-Key` para o POST de assinaturas nas referências consultadas; não foi enviado esse header nem presumida idempotência remota. A chave única da tentativa sozinha não impede dois POSTs externos.

## Checkout simulado com persistência

Para preparar um ambiente local descartável, fora de produção, os controles são:

```dotenv
NODE_ENV=development
MERCADO_PAGO_ENVIRONMENT=TEST
BILLING_CHECKOUT_MODE=SIMULATED
# Exemplo somente; fornecer conexão do banco local isolado pelo ambiente.
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/conecta_agenda_billing_test
```

OFF é o default. A combinação acima só é aceita para hosts localhost, 127.0.0.1 ou ::1 e database exatamente conecta_agenda_billing_test. NODE_ENV=production, conexão Neon/remota, outro database, PRODUCTION ou modo LIVE mantêm o fluxo desabilitado antes de qualquer escrita. Não modificar o .env real de produção para testar. O banco isolado precisa do schema e de dados de teste próprios, preparados por procedimento separado; nenhum comando de banco foi executado nesta etapa.

O simulador usa identidade e token fictícios constantes, sem ler credenciais TEST/PRODUCTION. Respostas de planos são geradas a partir dos mapeamentos TEST locais; isso testa a aplicação, não comprova termos reais do Mercado Pago. O token de cartão é fictício e derivado do UUID da tentativa; nenhum token/cardId é aceito do navegador neste modo.

O fluxo usa as tabelas existentes, sem nova migration:

1. Transação curta bloqueia a linha de Subscription com FOR UPDATE, filtrando userId e businessId da sessão, valida ambiente e bloqueio manual e cria/reutiliza BillingCheckoutAttempt. ID, externalReference e idempotencyKey são UUIDs independentes. A reserva é commitada antes de qualquer operação HTTP simulada, inclusive GET do plano.
2. Preparação valida ProviderPlan TEST, preço interno, mensalidade/BRL e o trial persistido. Falha nesta fase permite repetir somente a preparação, com a mesma tentativa e chave.
3. Nova transação, sob o mesmo lock, revalida os termos e cria um BillingEvent interno com tópico internal_checkout_simulated, chave única da tentativa, hash do pedido/termos e status PROCESSING. O claim é commitado antes do POST. Não há chamadas HTTP dentro das transações.
4. Somente o vencedor do claim pode enviar POST. Outra instância ou worker reiniciado encontra o marcador e não envia novamente. O marcador não expira automaticamente nem é liberado por timeout.
5. Resposta validada grava referências do provedor, tentativa PROVIDER_CREATED e marcador PROCESSED em transação. Nunca escreve status comercial, trialEndsAt, currentPeriodStart ou currentPeriodEnd. Replay usa o ID persistido e a URL canônica validada, sem novo POST.
6. Falha/timeout/URL inválida/falha de persistência marca FAILED para revisão quando possível; se a marcação também falhar, PROCESSING continua impedindo reenvio. Não iniciar outra tentativa para contornar a incerteza.

O hash é um compromisso persistente dos termos, não um snapshot completo reversível. Não são persistidos corpo com e-mail, token de cartão ou credenciais. Mudança de termos antes do claim impede criação. Antes de um adapter conectado, decidir versionamento/imutabilidade dos planos e o snapshot completo necessário à reconciliação.

`SimulatedCheckoutService.reconcile` é somente uma operação interna testável, sem rota pública: recebe um ID candidato obtido por investigação autorizada e consulta a assinatura via cliente simulado, verificando aplicação, vendedor, plano e externalReference antes de concluir a tentativa original. Nunca faz outro POST. Se o ID é desconhecido ou a consulta falha, manter a revisão pendente. A [busca oficial](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/search-preapproval/get.md) oferece filtros como plano/pagador e q livre; não há promessa de filtro exato por externalReference nem de consistência imediata. Resultado vazio não comprova ausência de criação.

O estado de recursos do simulador padrão é em memória e pode desaparecer ao reiniciar. Tentativas já concluídas continuam reutilizáveis pelo ID persistido; uma tentativa ambígua sem ID confirmado fica em revisão. Testes de reconciliação usam um servidor simulado compartilhado. Ainda é necessário ensaiar locks e concorrência com processos independentes em PostgreSQL isolado antes de habilitar sandbox conectado.

O retorno HTTP inclui mode=SIMULATED. O frontend valida HTTPS, host exato www.mercadopago.com.br, path de checkout e um único parâmetro preapproval_id, sem credenciais, porta extra, fragmento ou parâmetros de redirect. Em modo simulado, exibe uma confirmação local e não navega para esse endereço. Nenhum redirect concede acesso.

## Trial de sete dias: o que precisa ser comprovado

O trial interno permanece contado desde Business.createdAt, sem alteração de registros existentes. O helper devolve trialEndsAt persistido e tempo restante, sem reiniciar o prazo nem enviar automaticamente free_trial/start_date ao provedor. Toda preparação marca `requiresSandboxValidation=true`.

Planos externos podem definir free_trial, mas não presumir que sete dias a partir da autorização equivalem a sete dias desde o cadastro. Exemplo: cliente cadastrado há três dias tem quatro dias restantes; um novo trial externo de sete dias estenderia a primeira cobrança além do prazo comercial interno.

Antes de criar assinaturas conectadas, comprovar em ambiente isolado:

1. Se a solução aceita free_trial de sete dias e de qual evento conta o início.
2. Se permite configurar a primeira cobrança exatamente a partir do trialEndsAt interno usando plano associado; não presumir que start_date sobrescreve as regras do plano.
3. Observar plano, resposta e consulta posterior da assinatura, especialmente next_payment_date e primeira fatura. Não basta receber authorized ou um init_point.
4. Testar autorização no dia do cadastro, no terceiro dia e após o trial, evitando cobrança antecipada e um segundo trial.
5. Confirmar comportamento de atraso, renovação e cancelamento. Somente pagamento confirmado e reconciliado poderá conceder período pago; tolerância e cortesia permanecem internas.

Se não houver alinhamento comprovado, manter checkout desabilitado e decidir um fluxo alternativo explicitamente. Nenhuma regra do provedor pode redefinir o trial local ou liberar acesso pelo retorno.

## Próxima etapa conectada

Ensaiar o fluxo persistente em PostgreSQL isolado com processos independentes. Depois preparar backend e contas vendedora/compradora de teste, verificar identidade da credencial, validar o fluxo de autorização/checkout e alinhar trial/primeira cobrança. Decidir snapshot completo e reconciliação automatizada, implementar verificação de webhook e somente então autorizar um adapter conectado em sandbox separado. Nenhuma variável atual habilita rede. Não adicionar migrations, seed, backfill ou operações financeiras ao build/start.
