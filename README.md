# Apuração Eleitoral 2026 · Grupo B

Painel independente, em português, para acompanhar a apuração do primeiro turno de **4 de outubro de 2026** com arquivos públicos oficiais do TSE. Interface responsiva em React e Tailwind CSS, servida por Node.js.

## O que acompanha

- Presidência no Brasil, por estado e no exterior.
- Modo escuro, mapa integrado e clicável das 27 UFs, lista de estados com busca e resumo por região.
- Histórico das consultas observadas no dispositivo, compartilhamento da seleção e tela cheia.
- Governador, senador (duas vagas), deputados federais e estaduais; deputados distritais no DF.
- Votos e percentuais de candidatos, seções totalizadas, válidos/brancos/nulos, comparecimento e abstenção.
- Busca de deputados, links compartilháveis com os filtros, atualização automática, aviso de dados antigos e preservação da última consulta em caso de falha.
- Status de eleição reproduzido do TSE, sem projeções ou declaração automática de vencedores.

## Dados e limites

Leia [a pesquisa da API](docs/tse-api-research.md), com endpoints, campos, fontes e limites verificados. A fonte é `resultados.tse.jus.br`; o backend aceita somente estados e cargos conhecidos. Sem contas, rastreadores, banco de dados ou credenciais no aplicativo.

O mapa usa um único arquivo EA14 para todas as UFs, com cache e fila compartilhados com os resultados EA20. Leia [as escolhas do mapa e layout](docs/map-and-layout.md).

Todos os visitantes compartilham um cache em memória de 60 segundos por filtro. Consultas simultâneas são deduplicadas; o backend permite uma consulta ao TSE por vez com intervalo de um segundo. Falhas 404 aguardam cinco minutos. HTTP 403/429 suspendem novas consultas por pelo menos dez minutos, respeitando `Retry-After`. Abas ocultas param as consultas periódicas.

As fixtures históricas são usadas somente nos testes; nunca como fallback de produção. Este painel consulta arquivos oficiais via HTTPS, mas não verifica sua assinatura JWS. Ele não substitui o site oficial. Códigos de eleições estão fixados no primeiro turno de 2026, verificados no índice EA11.

## Desenvolvimento

Requer Node.js 24 e pnpm 11.23.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:server
# Em outro terminal:
pnpm dev
```

Ambos os serviços locais escutam apenas em `127.0.0.1`. Abra `http://127.0.0.1:5173` por encaminhamento SSH/Tailscale.

```sh
pnpm build
pnpm start
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

O Playwright verifica celular e desktop, tela de 320 px, filtros, busca, falhas, polling e uma execução ponta a ponta contra o TSE. Os demais testes usam fixtures para limitar tráfego eleitoral. Para testar a publicação:

```sh
BASE_URL=https://apuracao.phcardoso.dev pnpm test:e2e --grep 'real browser'
```

## Publicação e encerramento

O Dockerfile é implantado **somente pelo Coolify**, com porta interna 3000 e roteamento HTTPS pelo proxy existente. O DNS público deve permanecer com o proxy Cloudflare ativado. Nenhuma porta adicional é aberta no host.

Este é um serviço temporário. No dia 5 de outubro, pare somente a aplicação `eleicoes2026-grupob` no Coolify. O repositório pode permanecer como registro do projeto. Não há desligamento automático agendado; a parada e eventual remoção do DNS devem ser realizadas pelo proprietário ou com sua autorização.
