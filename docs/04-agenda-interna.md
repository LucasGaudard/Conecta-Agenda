# Agenda Interna

Esta etapa implementa a agenda autenticada do profissional em `/agenda`.

## Rotas

Todas as rotas usam JWT e isolam os dados pelo `request.user.businessId`. Nenhuma rota aceita `businessId` vindo do frontend.

- `GET /appointments`: lista agendamentos do negocio autenticado. Aceita `date`, `from`, `to` e `status`.
- `GET /appointments/:id`: retorna detalhes de um agendamento do negocio autenticado.
- `POST /appointments`: cria agendamento manual interno.
- `PUT /appointments/:id/status`: atualiza o status.
- `PUT /appointments/:id/reschedule`: remarca data e horario.
- `DELETE /appointments/:id`: cancela sem apagar do banco.
- `GET /appointments/available-times`: retorna horarios disponiveis para criacao e remarcacao interna.

## Status

- `SCHEDULED`: agendado.
- `CONFIRMED`: confirmado.
- `COMPLETED`: concluido.
- `CANCELED`: cancelado.
- `NO_SHOW`: falta.

Cancelamento muda o status para `CANCELED` e libera o horario para novos calculos. Agendamentos `SCHEDULED` e `CONFIRMED` bloqueiam disponibilidade. Agendamentos `CANCELED`, `COMPLETED` e `NO_SHOW` nao bloqueiam horarios futuros.

## Criacao Manual

A criacao interna recebe servico, data, horario e cliente. O cliente pode ser existente por `customerId` ou novo por nome e WhatsApp.

Regras:

- o servico precisa pertencer ao negocio autenticado e estar ativo;
- o cliente existente precisa pertencer ao negocio autenticado;
- se o WhatsApp informado ja existir no negocio, o cliente e reutilizado;
- o agendamento salva `serviceName`, `priceInCents` e `durationMinutes` para preservar historico;
- a disponibilidade e calculada pela mesma funcao usada no agendamento publico.

## Remarcacao

A remarcacao usa a disponibilidade existente com `ignoreAppointmentId`, evitando conflito com o proprio agendamento atual.

Regras:

- nao e permitido remarcar `COMPLETED`;
- nao e permitido remarcar `CANCELED`;
- o novo `endTime` usa o `durationMinutes` salvo no proprio appointment;
- se o horario estiver indisponivel, a API retorna `409`.

## Frontend

A tela `/agenda` permite:

- selecionar data;
- listar atendimentos do dia;
- ver detalhes;
- confirmar;
- concluir;
- marcar falta;
- cancelar;
- remarcar;
- criar agendamento interno.

A tela possui estados de loading, erro, sucesso e lista vazia.

## Observacao de Banco Real

Ainda nao ha `DATABASE_URL` real configurada no projeto. Por isso, os fluxos foram preparados para Prisma/PostgreSQL, mas nao devem ser considerados testados ponta a ponta contra banco real ate a configuracao da variavel e aplicacao da migration.
