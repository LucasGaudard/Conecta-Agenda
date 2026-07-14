# Rotas da API V1

## Publicas

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /public/:slug`
- `GET /public/:slug/services`
- `GET /public/:slug/available-times`
- `POST /public/:slug/appointments`

## Autenticadas

- `GET /auth/me`
- `GET|PUT /business/me`
- `GET /onboarding/status` e `POST /onboarding/complete`
- CRUD logico de `/services`
- `GET|PUT /working-hours`
- `GET|POST|DELETE /blocked-times`
- `GET|POST|PUT /customers`
- listagem, detalhes, criacao, status, remarcacao e cancelamento em `/appointments`
- `GET /appointments/available-times`
- `GET /dashboard`
- `GET /finance/summary?month=YYYY-MM`

Todas as rotas privadas usam JWT. O `businessId` vem apenas de `request.user.businessId`. Recursos de outro negocio sao tratados como inexistentes.

O financeiro usa `priceInCents` armazenado no agendamento, preservando o valor historico do servico.
