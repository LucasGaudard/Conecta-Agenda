# Preparação de assinaturas Mercado Pago em teste

Esta etapa não faz chamadas à API Mercado Pago, não cria checkout nem modifica o Neon. O cliente HTTP exige transporte `SIMULATED` injetado. Não existe adapter de rede padrão, comando de sandbox conectado ou alteração nas rotas públicas. `checkoutAvailable` e `cancellationAvailable` continuam falsos e o webhook continua indisponível.

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

Essa proteção é somente local ao processo, não durável e não compartilhada entre instâncias. Não há garantia documentada de `X-Idempotency-Key` para o POST de assinaturas nas referências consultadas; não foi enviado esse header nem presumida idempotência remota. Antes de habilitar uma rota conectada, implementar reserva/transação da tentativa, snapshot persistente do pedido e reconciliação por referência/ID após reinício, concorrência ou timeout. A chave única da tentativa sozinha não impede dois POSTs externos.

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

Preparar banco e backend isolados, fora do Neon production, com conta vendedora/compradora de teste e mapeamentos TEST próprios. Validar identidade da credencial antes de implementar/autorizar um transporte real. Implementar persistência e reconciliação das tentativas, verificação de webhook e alinhamento do trial. Só então habilitar operações de sandbox sob controle explícito. Não adicionar migrations, seed, backfill ou operações financeiras ao build/start.
