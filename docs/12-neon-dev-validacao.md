# Neon dev — correção da validação do Prompt 41

## Causa comprovada

A consulta somente leitura retornou uma linha, database `neondb`, schema `public`
e `pg_stat_ssl.ssl=false`. Host e database esperados correspondiam ao perfil;
produção direta/pooled era diferente. A única condição que falhou no Prompt 40
foi exigir `ssl === true` nessa visão, produzindo o código genérico
`DEV_CONNECTION_IDENTITY_MISMATCH`.

`pg_stat_ssl` observa o backend PostgreSQL; não comprova o trecho cliente →
proxy/pooler. A conexão Neon usa um proxy e o endpoint escolhido é pooled.
Não se deve inferir ausência de TLS no cliente pelo valor dessa visão.
Referências: [PostgreSQL pg_stat_ssl](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW),
[Neon pooling](https://neon.com/docs/connect/connection-pooling) e
[Neon security](https://neon.com/docs/security/security-overview).

## Validação corrigida, somente leitura

```powershell
pnpm dev:db:validate
```

1. Reutiliza integralmente as validações do perfil dev: host/database permitidos,
   bloqueio da produção direta/pooled, SSL obrigatório, parâmetros restritos,
   ausência de fallback e checkout OFF.
2. Compara também o host com a conexão de produção da `.env` da raiz antes de
   criar socket ou PrismaClient. A connection string nunca é exibida.
3. Faz SSLRequest PostgreSQL sem login/dados pessoais e verifica TLS mínimo 1.2,
   certificado por CA confiável e hostname/SNI do endpoint exato. Recusa resposta
   sem TLS, bytes adicionais, timeout, certificado inválido e downgrade.
4. Usa a URL dev explicitamente no Prisma, com sslmode=require, e faz a consulta
   de identidade dentro de uma transação READ ONLY. Sempre desconecta.
5. Exige database/schema correspondentes e evidência positiva de TLS externo.
   `pg_stat_ssl` continua no resultado apenas como diagnóstico, não como substituto
   da validação TLS. Falhas agora distinguem TLS, database, schema e quantidade de linhas.

O teste TLS e a consulta autenticada são conexões distintas ao mesmo endpoint;
sslmode=require continua obrigatório na conexão Prisma. Não há fallback plaintext,
aceitação de certificados inválidos ou desativação dos bloqueios de produção.

## Resultado em 14/10/2026

- Endpoint dev: `ep-morning-heart-b4dimr97-pooler.c-6.us-east-2.aws.neon.tech`.
- Host autorizado e diferente da produção, database `neondb`, schema `public`.
- TLS externo verificado, protocolo TLSv1.3; backendSsl=false (diagnóstico).
- Checkout OFF; 18 testes focados de segurança aprovados, com mocks e sem banco.
- Nome do projeto Neon não é retornado por essa consulta PostgreSQL; a associação
  a `Conecta-agenda-dev` vem do endpoint fornecido pelo usuário. Não houve consulta
  à API de controle Neon nem validação independente do nome de exibição do projeto.

A conexão está validada para a próxima etapa de preparação do schema no destino
dev confirmado. Este prompt não executou migrations, seed, provisionamento,
alterações de dados, deploy, commit ou push. Perfil, credenciais, billing,
frontend, schema e migrations existentes foram preservados.
