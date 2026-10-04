# Mapa e layout integrado

Referência visual analisada em 4 de outubro de 2026: [seuimposto.com](https://seuimposto.com). A inspeção foi feita com Playwright nos tamanhos desktop e celular; o navegador de pesquisa retornou erro ao abrir esse domínio, mas o site carregou normalmente no Chromium. A referência organiza a apuração em navegação por cargo, mapa central, painéis laterais, resumos regionais, histórico, busca, compartilhamento e tela cheia.

## Adaptação ao Grupo B

| Recurso observado | Implementação |
| --- | --- |
| Tema escuro | Tema padrão, contrastes legíveis, sem fontes remotas |
| Mapa central integrado | 27 UFs clicáveis; seleção sincronizada com os filtros e dados do cargo |
| Visualização alternativa | Lista pesquisável de UFs para toque e navegação por teclado |
| Progresso geográfico | Cores somente pelo percentual de seções totalizadas; legenda explícita e cor distinta para dados ausentes |
| Navegação de cargos | Atalhos e seleção nativa; demais cargos exigem seleção de uma UF |
| Resumo regional | Cinco regiões com percentual ponderado pelo número de seções, sem média simples de percentuais |
| Exterior | Resultados presidenciais em `zz` e progresso separado do mapa das UFs |
| Histórico e atualizações | Gerações do arquivo do cargo observadas neste dispositivo, persistidas localmente; sem inventar pontos anteriores à visita |
| Compartilhamento | Compartilhar/copy com estado e cargo na URL; fallback com campo de link |
| Tela cheia | Fullscreen quando disponível e layout ampliado como alternativa |
| Busca | Candidaturas e UFs por nome, sigla ou número, sem distinção de acentos |

A lista de candidaturas mantém a ordem do arquivo oficial e exibe os valores e situações publicados pelo TSE. Nenhuma comparação, preferência ou projeção política é adicionada. As métricas geográficas e o histórico descrevem o processamento de seções.

O mapa usa abrangência estadual. Não implementa polígonos de municípios nem uma linha do tempo histórica nacional reconstruída: isso exigiria outros dados, arquivos e armazenamento. A versão oferece o mapa das 27 UFs e todas as consultas de cargos que já existiam, com acesso adicional ao exterior.

## Fonte dos dados do mapa

Fonte oficial: [EA14 — acompanhamento Brasil](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea14-arquivo-de-acompanhamento-brasil).

Endpoints verificados com HTTP 200:

- [Presidência, 6257](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-e006257-ab.json).
- [Eleição estadual, 6259](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/br/br-e006259-ab.json).
- [Presidência, exterior](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.json).

EA14 contém `abr[]`, com `cdabr`, seções em `s.ts/st/pst` e eleitorado em `e.te/esnt`. A eleição federal retornou 27 UFs mais `zz` e `br`; a estadual retornou 27 UFs mais `br`. O campo `e.esnt` é o eleitorado de seções não totalizadas, sem estimar votos de candidaturas. A porcentagem regional é `sum(st) / sum(ts) * 100`; regiões incompletas recebem porcentagem ausente, sem fabricar zero.

O mapa e o cargo podem ter horários diferentes porque EA14 e EA20 são gerados e distribuídos separadamente. Exibimos os horários de geração de cada fonte. O [FAQ oficial do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) documenta esse comportamento e o limite de 100 requisições por segundo por IP.

EA14 e EA20 usam a mesma fila serializada do servidor, intervalo de um segundo entre chamadas, cache de 60 segundos e deduplicação por chave. Uma consulta do mapa obtém todas as UFs; não consultamos 27 resultados EA20 para pintar o mapa.

A fixture `tests/fixtures/tse-overview.json` veio da consulta real ao endpoint federal em 4 de outubro de 2026, com geração `04/10/2026 19:02:10` (Brasília), `idg=1552499`. As datas de totalização dentro de `abr[]` são preservadas no snapshot, mas o horário do painel usa a geração raiz `dg/hg`.

## Geometria

A malha simplificada é do [IBGE — API de Malhas v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), obtida em uma chamada:

```text
https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=minima
```

O GeoJSON contém 27 features com `properties.codarea` no código IBGE. `scripts/generate-map.mjs` converte a malha em caminhos SVG locais com D3 Geo e corrige o sentido dos anéis para a convenção dessa biblioteca. O arquivo gerado `src/brazil-shapes.ts` fica no bundle; a aplicação não acessa IBGE ou servidores de mapas em tempo de execução. A fonte é creditada no mapa. Pequenas UFs possuem chamadas externas para facilitar a seleção; todas também estão na lista e no seletor nativo.
