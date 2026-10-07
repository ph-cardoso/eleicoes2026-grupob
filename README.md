# Apuração Eleitoral 2026 · Grupo B

**Site desativado em 6 de outubro de 2026.** Banco, fotos e configuração de publicação preservados. Para voltar no segundo turno, siga [o guia de reativação](docs/operations.md).

Painel independente, em português, para acompanhar a apuração do primeiro turno de **4 de outubro de 2026** com arquivos públicos oficiais do TSE. Interface responsiva em React e Tailwind CSS, servida por Node.js.

## O que acompanha

- Presidência no Brasil, por estado e no exterior.
- Modo escuro, mapa integrado e clicável das 27 UFs, lista de estados com busca e resumo por região.
- Filtros únicos de Localidade e Cargo; seletor de visualização com Mapa ou Candidatos, preservando a seleção e os links compartilháveis.
- Exterior sempre disponível em Localidade e no atalho do mapa; escolher esse recorte ajusta o cargo para Presidente.
- Mapa por partido como padrão (azul/direita, vermelho/esquerda, cinza/centro), com classificação documentada e alternativa de progresso das urnas.
- Histórico compartilhado das gerações oficiais capturadas pelo servidor, compartilhamento da seleção e tela cheia.
- Fotos oficiais das candidaturas, carregadas quando aparecem na tela e armazenadas no servidor.
- Governador, senador (duas vagas), deputados federais e estaduais; deputados distritais no DF.
- Votos e percentuais de candidatos, seções totalizadas, válidos/brancos/nulos, comparecimento e abstenção.
- Candidatos em percentual decrescente; brancos e nulos destacados com quantidade e percentual no resumo principal. Brasil já inclui o exterior uma única vez.
- Busca de deputados, links compartilháveis com os filtros, atualização automática, aviso de dados antigos e preservação da última consulta em caso de falha.
- Status de eleição reproduzido do TSE, sem projeções ou declaração automática de vencedores.

## Dados e limites

Leia [a pesquisa da API](docs/tse-api-research.md), com endpoints, campos, fontes e limites verificados. A fonte é `resultados.tse.jus.br`; o backend aceita somente estados e cargos conhecidos. Sem contas, rastreadores ou credenciais no aplicativo.

O progresso das urnas usa um único arquivo EA14 para todas as UFs. A visão por partido usa os EA20 estaduais, coletados progressivamente e compartilhados entre visitantes, com janela de coleta de 30 segundos, sem lotes sobrepostos. A visualização Candidatos pausa a consulta periódica ao mapa por partido, mantendo a atualização do resultado selecionado. Ambas usam a mesma fila e cache das consultas individuais. Leia [as escolhas do mapa e layout](docs/map-and-layout.md), incluindo as fontes da classificação das cores.

Todos os visitantes compartilham um cache de 30 segundos por filtro, persistido em SQLite e restaurado após reinícios. Consultas simultâneas são deduplicadas; o backend permite uma consulta ao TSE por vez com intervalo de um segundo. Falhas 404 aguardam cinco minutos. HTTP 403/429 suspendem novas consultas por pelo menos dez minutos, respeitando `Retry-After`; essa pausa também sobrevive ao reinício. A interface consulta a cada 15 segundos; consultas antes da expiração reaproveitam o cache. Abas ocultas param as consultas periódicas.

As [fotos oficiais](docs/candidate-photos.md) usam `sqcand` e o diretório nacional para a Presidência, mesmo nas consultas por UF ou exterior. O proxy só aceita candidaturas já recebidas do TSE e compartilha a fila das consultas. As imagens ficam em SQLite por 24 horas, com deduplicação e ETag; uma foto ausente não provoca tentativas de outros nomes ou diretórios. Sem imagem disponível, o cartão conserva o número da candidatura.

## Persistência

O SQLite integrado ao Node.js 24 guarda o JSON oficial original de cada geração, o resultado normalizado, a última consulta válida, os prazos de cache e as fotos. Transações, WAL e `synchronous=FULL` protegem gravações; uma geração com horário anterior não substitui a mais recente. Consultas repetidas da mesma geração não criam snapshots duplicados. O histórico exibe as últimas 24 gerações distintas por localidade e cargo, capturadas desde a ativação da persistência. Não fabricamos dados anteriores. O navegador conserva seu histórico local como alternativa quando o servidor não responde.

Em produção, `DATA_DIR=/app/data` aponta para um volume persistente criado e administrado pelo Coolify. Em desenvolvimento, o padrão é `.runtime/data`. O arquivo `tse.sqlite` e suas fotos não são servidos como arquivos públicos. Não é necessário um serviço de banco com porta ou senha: apenas a aplicação acessa esse volume.

A API de backup online do SQLite cria cópias consistentes em `DATA_DIR/backups` a cada hora e ao iniciar um banco já preenchido; mantém as quatro mais recentes. As cópias estão no mesmo VPS e não protegem contra perda desse host. A coleta é acionada pelas consultas e pela atualização automática dos visitantes; não há coleta independente quando ninguém usa o painel. Leia [a implementação da persistência](docs/persistence.md).

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

O Dockerfile é implantado **somente pelo Coolify**, com porta interna 3000, volume persistente em `/app/data` e roteamento HTTPS pelo proxy existente. O DNS público deve permanecer com o proxy Cloudflare ativado. Nenhuma porta adicional é aberta no host. Não remova o volume ao redeployar ou parar o app se desejar conservar o histórico.

Este é um serviço temporário. A aplicação `eleicoes2026-grupob` foi parada no Coolify a pedido do proprietário em **6 de outubro de 2026, às 21h45 (Brasília)**. A URL pública passou a retornar HTTP 503, verificado também no Playwright em celular e desktop. O volume persistente e o domínio foram mantidos. Não há reativação automática agendada.

O [guia de operação e reativação](docs/operations.md) reúne o acesso direto à aplicação, os ajustes necessários para o segundo turno e os passos de publicação e encerramento. **O código atual ainda consulta o primeiro turno:** apenas iniciar a aplicação não muda os códigos de eleição do TSE.

## Instruções de não indexação

O HTML declara `noindex,nofollow,nosnippet,noimageindex` para `robots` e `googlebot`; todas as respostas enviam `X-Robots-Tag` com as mesmas instruções. O `robots.txt` permite ler essas diretivas, pois bloquear o rastreamento impediria o buscador de receber o `noindex`. O site não anuncia sitemap. [Documentação oficial do Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
