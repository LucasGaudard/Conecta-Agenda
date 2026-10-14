# Frontend em modo leve (8 GB de RAM)

Na raiz do projeto:

```powershell
pnpm dev:web:light
```

Abre o frontend em `http://localhost:3001`, com Webpack, mantendo o perfil
`apps/web/.env.development.local` e a API em `http://localhost:3333`.
O comando inicia somente o frontend. A API continua sendo iniciada separadamente
com `pnpm dev:api`, quando necessária para testar autenticação.
Dentro de `apps/web`, o equivalente é `pnpm dev:light`.

## O que muda

- Webpack substitui Turbopack apenas neste comando.
- Webpack processa um módulo por vez (`parallelism: 1`), reduzindo trabalho
  simultâneo. A compilação inicial pode demorar mais.
- O buffer de páginas inativas do Webpack mantém uma página adicional em vez
  das duas padrão. Páginas descartadas podem precisar de nova compilação.
- Nenhum limite de heap é imposto. Cache, source maps, Fast Refresh e validações
  de ambiente permanecem habilitados.
- `pnpm dev:web` continua usando o modo anterior. Builds e produção não recebem
  as configurações do modo leve.

## Diagnóstico e limites

A instalação investigada usa Next.js 16.2.9. O launcher anterior chama `next dev`
sem selecionar bundler, portanto usa Turbopack. A compilação inicial de `/login`
e a retenção do grafo/cache do bundler são hipóteses para o pico de memória
observado; sem reprodução e perfil de memória, a causa exata não está confirmada.

A revisão do caminho de `/login` não encontrou efeitos com dependências instáveis,
polling ou importação de Prisma, backend, QR code ou páginas de dashboard/billing.
O efeito de restauração de sessão depende de um callback estável. Os barrels de
UI/utils são pequenos; o ícone da marca usa import nomeado de `lucide-react`,
que já está na lista de otimização de imports do Next instalado. Os redirecionamentos
do login ocorrem no envio do formulário. Há uma chamada redundante a `/auth/me`
após o login, mas ela não ocorre na abertura inicial da página e não foi alterada.
O root do Turbopack precisa incluir os pacotes compartilhados do monorepo.

Não foram executados servidores nem builds para confirmar economia de RAM.
Webpack é uma alternativa a medir, sem garantia de consumir menos em todo cenário.
`experimental.webpackMemoryOptimizations` não foi adicionado: na versão instalada,
seus usos estão no caminho de `webpack-build`, não na compilação de desenvolvimento.
Não foram desativados caches, pois isso poderia aumentar recompilações.

## Validação manual posterior

Encerre o frontend anterior antes de executar o comando leve. Abra apenas uma aba
em `/login`; espere a compilação terminar e compare a memória total dos processos
Node, o pico inicial e a memória após alguns minutos. Teste login, redirecionamento
e navegação. Evite executar os dois modos simultaneamente: ambos usam a porta 3001.

Teste automatizado leve, sem servidor ou banco:

```powershell
node scripts/test.cjs --test-isolation=none apps/web/scripts/dev-light.test.cjs apps/web/src/lib/config.test.ts
```

Referências: [Next.js 16 e seleção de Webpack](https://nextjs.org/docs/app/guides/upgrading/version-16),
[memória](https://nextjs.org/docs/app/guides/memory-usage),
[buffer de páginas em desenvolvimento](https://nextjs.org/docs/app/api-reference/config/next-config-js/onDemandEntries).
