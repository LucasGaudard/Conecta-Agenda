# Banco de Dados

Esta etapa define a modelagem inicial do Conecta Agenda com Prisma e PostgreSQL. O objetivo e preparar a base para um SaaS multiempresa sem implementar regras de negocio, autenticacao ou CRUDs.

## Entidades principais

- `User`: representa o profissional dono da conta.
- `Business`: representa o negocio vinculado a um usuario.
- `BusinessSettings`: guarda preferencias operacionais do negocio, como timezone, moeda e intervalo de agenda.
- `Plan`: representa planos comerciais do SaaS.
- `Subscription`: representa a assinatura do usuario em um plano.
- `Service`: representa servicos oferecidos por um negocio.
- `Customer`: representa clientes de um negocio.
- `WorkingHour`: representa horarios de atendimento por dia da semana.
- `Appointment`: representa agendamentos.
- `BlockedTime`: representa bloqueios de agenda.
- `Notification`: representa notificacoes planejadas ou enviadas.

## Enums

- `AppointmentStatus`: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELED`, `NO_SHOW`
- `SubscriptionStatus`: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`
- `DayOfWeek`: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`
- `NotificationType`: `APPOINTMENT_CONFIRMATION`, `APPOINTMENT_REMINDER`, `APPOINTMENT_CANCELLATION`, `APPOINTMENT_RESCHEDULE`
- `NotificationChannel`: `WHATSAPP_MANUAL`, `EMAIL`, `SYSTEM`
- `NotificationStatus`: `PENDING`, `SENT`, `FAILED`, `CANCELED`

## Relacao User > Business

Cada `User` pode ter um unico `Business`, e cada `Business` pertence a um unico `User`.

O campo `Business.userId` e unico. Essa decisao prepara a aplicacao para isolar dados por negocio nas proximas etapas. Rotas futuras deverao sempre filtrar dados por `businessId` derivado do usuario autenticado.

## Multiempresa

As entidades operacionais possuem relacao direta com `Business`:

- `Service`
- `Customer`
- `Appointment`
- `WorkingHour`
- `BlockedTime`
- `Notification`
- `BusinessSettings`

Esse desenho evita misturar dados entre negocios e cria uma fronteira clara para autorizacao nas proximas etapas.

## Historico de servico no Appointment

O `Appointment` possui `serviceId` opcional e tambem salva:

- `serviceName`
- `priceInCents`
- `durationMinutes`

Esses campos preservam o historico do agendamento mesmo se o servico original mudar de nome, preco ou duracao depois.

## Planos iniciais

O seed cria tres planos:

- Starter: R$39,00
- Pro: R$69,00
- Premium: R$99,00

O usuario de teste recebe uma assinatura ativa no plano Starter.

## Seed

O seed e idempotente e usa `upsert` para evitar duplicacao de planos, usuario, negocio, assinatura, servicos e horarios de atendimento.

Usuario de teste:

- Email: `admin@conectaagenda.com`
- Senha base: `123456`

Negocio de teste:

- Nome: `Barbearia Teste`
- Slug: `barbeariateste`
