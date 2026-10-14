# Fundação de assinaturas Mercado Pago

Esta etapa prepara persistência e regras locais. Não cria checkout, cobrança, plano externo ou webhook ativo. A migration `20261012190000_billing_foundation` foi aplicada com sucesso no Neon, branch `production`, database `neondb`. As quatro migrations do projeto estão concluídas e os checksums correspondem aos arquivos locais.

## Regras comerciais

- Novos negócios recebem uma única assinatura `TRIALING` por sete dias, contados de `Business.createdAt`. Os dois caminhos de criação, cadastro público e painel administrativo, usam a mesma função. Registros existentes não recebem backfill e trials existentes não são reiniciados.
- Somente um sinal de pagamento confirmado e verificado pode definir `ACTIVE` e um período pago finito.
- `PAST_DUE` usa a tolerância existente de três dias após `currentPeriodEnd`.
- Cancelamento preserva `currentPeriodStart` e `currentPeriodEnd`; o resolver mantém acesso somente até o fim já pago.
- Bloqueio manual prevalece sobre pagamento e cortesia. Cortesia com prazo continua independente.
- Retorno de checkout e webhook não verificado geram mutação nula.

## Persistência

- `ProviderPlan`: um mapeamento por plano, provider e ambiente. IDs de teste e produção nunca compartilham a mesma linha.
- `Subscription`: referências externas opcionais, ambiente, estado bruto do provider, próxima cobrança, cancelamento e última sincronização. Colunas opcionais preservam registros legados.
- `BillingCheckoutAttempt`: chave de idempotência e referência externa únicas por tentativa.
- `BillingEvent`: chave de deduplicação única, identidade do evento/recurso e estado de processamento. Eventos desconhecidos podem ser preservados sem associação; ao excluir assinatura, a referência vira nula.
- `BillingPayment`: pagamento único por provider/ambiente/ID, sempre associado a uma assinatura. A exclusão da assinatura é restringida para preservar o registro financeiro.

As restrições compostas separam TEST e PRODUCTION e impedem que IDs externos duplicados sejam associados a tenants diferentes. O processamento futuro deve ainda consultar a assinatura interna pela referência persistida, verificar provider/ambiente e atualizar tudo em transação.

Três nomes de índices da migration excedem o limite de 63 bytes e foram truncados pelo PostgreSQL. O schema declara `map` em `Subscription`, `BillingCheckoutAttempt` e `BillingPayment` com os nomes efetivamente armazenados no Neon. Isso preserva campos, ordem das colunas e unicidade, sem exigir nova migration ou alteração no banco. O SQL já aplicado deve permanecer intacto.

## Variáveis futuras do backend

```dotenv
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_ENVIRONMENT=TEST
MERCADO_PAGO_APPLICATION_ID=
MERCADO_PAGO_COLLECTOR_ID=
MERCADO_PAGO_BACK_URL=http://localhost:3000/settings/billing
```

Access Token e segredo são exclusivos do backend. Em `PRODUCTION`, `MERCADO_PAGO_BACK_URL` exige HTTPS. IDs de planos não ficam mais em variável global: devem ser cadastrados em `ProviderPlan` por plano e ambiente, por um procedimento futuro autenticado e auditado. Nenhuma credencial real deve ser colocada nos exemplos ou no frontend.

## Cliente HTTP em teste

O cliente `MercadoPagoTestHttpClient` prepara criação com plano, consulta e cancelamento de assinaturas, além da consulta do plano externo. Exige transporte `SIMULATED` injetado e não tem adapter `fetch`. A rota de checkout agora usa serviço persistente simulado somente mediante opt-in em banco local isolado; permanece desativada em produção e para conexões Neon. O provider antigo permanece desativado mesmo com configuração completa. As variáveis genéricas acima continuam apenas no scaffold existente; o novo cliente não as usa como fallback.

Credenciais e configurações de teste têm nomes `MERCADO_PAGO_TEST_*`, separados dos nomes `MERCADO_PAGO_PRODUCTION_*`, que estão reservados e não habilitam operações. A preparação seleciona somente TEST, valida IDs de aplicação/vendedor nas respostas e exige `ProviderPlan` TEST ativo com recorrência mensal, moeda BRL e valor igual ao plano interno. O procedimento e as limitações estão em [09-mercado-pago-testes.md](09-mercado-pago-testes.md).

## Próximas etapas

1. Para publicar esta etapa, validar o schema, gerar o Prisma Client atualizado e executar testes, lint e build com conexão fictícia. A migration de billing já está aplicada em produção; não reaplicá-la nem executar seed ou backfill. Migrations futuras devem seguir o processo controlado com ambiente isolado e backup.
2. Criar procedimento administrativo para mapear os planos externos TEST e PRODUCTION, sem seed de demonstração.
3. Validar em sandbox o contrato do cliente HTTP já preparado com respostas simuladas. Antes de conectar um transporte real, verificar a conta de teste, persistir o pedido e implementar reconciliação; o endpoint de assinaturas não teve garantia de idempotência remota confirmada.
4. Escolher e validar o fluxo de checkout: assinatura com plano requer token de cartão e `authorized`; o fluxo `pending` documentado é sem plano. Validar também o alinhamento do trial interno com a primeira cobrança antes de habilitar qualquer criação conectada.
5. Validar assinatura oficial do webhook, persistir evento antes do processamento e consultar o recurso autoritativo no Mercado Pago.
6. Implementar reconciliação idempotente de assinatura, fatura e pagamento em transação.
7. Implementar cancelamento sem alterar o fim do período pago.
8. Executar testes sandbox completos antes de habilitar capacidades ou credenciais de produção.
