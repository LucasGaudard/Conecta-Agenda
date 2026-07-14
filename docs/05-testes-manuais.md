# Testes manuais da V1

## Preparacao

1. Configure PostgreSQL em `DATABASE_URL`.
2. Execute `pnpm db:generate`, `pnpm db:migrate` e `pnpm db:seed`.
3. Inicie `pnpm dev`.

## Fluxos essenciais

- Cadastre uma conta e confirme criacao do negocio, configuracoes e plano Starter.
- Termine o onboarding e edite o perfil/slug.
- Cadastre servicos, horarios, intervalos e bloqueios.
- Abra o link publico sem login, selecione servico/data/horario e crie agendamento.
- Tente reservar o mesmo horario novamente e confirme resposta 409.
- Na agenda interna, crie, confirme, conclua, marque falta, cancele e remarque.
- Confirme que cancelados liberam horario e que concluidos/cancelados nao podem ser remarcados.
- Valide que preco e duracao historicos nao mudam ao editar o servico.
- Abra links manuais do WhatsApp e confirme numero/texto; nenhum envio deve ser automatico.
- Confira dashboard, lembretes de amanha, link publico, compartilhamento e QR Code.
- Confira o resumo financeiro em meses com e sem atendimentos.

## Multiempresa

Crie dois usuarios/negocios. Com o token do primeiro, tente usar IDs de servicos, clientes, bloqueios e agendamentos do segundo. As respostas devem ser 404 e nenhuma informacao deve vazar.

## Responsividade

Revise landing, autenticacao, onboarding, dashboard, agenda, servicos, clientes, horarios, perfil, configuracoes, financeiro e pagina publica em larguras de celular e desktop.
