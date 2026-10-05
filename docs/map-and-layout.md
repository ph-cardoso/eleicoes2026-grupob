# Mapa e layout integrado

Referência visual analisada em 4 de outubro de 2026: [seuimposto.com](https://seuimposto.com). A inspeção foi feita com Playwright nos tamanhos desktop e celular; o navegador de pesquisa retornou erro ao abrir esse domínio, mas o site carregou normalmente no Chromium. A referência organiza a apuração em navegação por cargo, mapa central, painéis laterais, resumos regionais, histórico, busca, compartilhamento e tela cheia.

## Adaptação ao Grupo B

| Recurso observado | Implementação |
| --- | --- |
| Tema escuro | Tema padrão, contrastes legíveis, sem fontes remotas |
| Mapa central integrado | 27 UFs clicáveis; seleção sincronizada com os filtros e dados do cargo |
| Visualização alternativa | Lista pesquisável de UFs para toque e navegação por teclado |
| Cores do mapa | Partidos por padrão, pela candidatura com maior percentual publicado; alternativa com cores de seções totalizadas |
| Filtros e visualização | Localidade e Cargo em seletores nativos; Visualização alterna Mapa/Candidatos mantendo os filtros e a seleção na URL. Mapa é a visão inicial |
| Resumo regional | Cinco regiões com percentual ponderado pelo número de seções, sem média simples de percentuais |
| Exterior | Incluído uma única vez no total nacional `br`; sempre disponível em Localidade e no atalho do mapa. Selecionar `zz` ajusta o cargo para Presidente; progresso separado das cinco regiões |
| Histórico e atualizações | Gerações oficiais capturadas e persistidas no SQLite do servidor, compartilhadas entre visitantes; histórico local como alternativa, sem inventar pontos anteriores à coleta |
| Compartilhamento | Compartilhar/copy com localidade, cargo e visualização na URL; fallback com campo de link |
| Tela cheia | Fullscreen quando disponível e layout ampliado como alternativa |
| Busca | Candidaturas e UFs por nome, sigla ou número, sem distinção de acentos |

A lista de candidaturas exibe os valores e situações publicados pelo TSE, em ordem decrescente de percentual numérico. Empates no percentual arredondado usam os votos como desempate; percentuais ausentes ficam no final. A API preserva os valores e a ordem originais. Votos brancos e nulos aparecem com quantidade e percentual no resumo principal e no retrato da votação.

Mapa e Candidatos ocupam a área principal em visualizações separadas; os resumos e histórico permanecem disponíveis em ambas. O navegador consulta o mapa por partido somente na visualização Mapa. Na visualização Candidatos, o resultado selecionado continua atualizando a cada 15 segundos com o cache compartilhado de 30 segundos; a atualização manual também não inicia uma coleta estadual do mapa. Um lote do servidor já iniciado pode terminar e atender outros visitantes.

No desktop, os cartões ocupam três colunas independentes: resumo, retrato da votação e atualização manual à esquerda; mapa ou candidaturas e gráfico histórico no centro; regiões e últimas atualizações à direita. Cada coluna mantém intervalos de 16 pixels, sem esperar a altura da coluna vizinha para posicionar o cartão seguinte. Em telas intermediárias, regiões e atualizações ficam lado a lado abaixo das duas colunas principais. No celular, a ordem visual segue resumo → mapa/candidatos → regiões → gráfico → atualizações → votos → atualização manual. O Playwright verifica posições, ausência de sobreposição e overflow nas larguras 1920, 1280, 1024, 390 e 320 pixels, com cinco gerações históricas para reproduzir uma coluna de atualizações preenchida.

O mapa usa abrangência estadual. Não implementa polígonos de municípios nem uma linha do tempo histórica nacional reconstruída: isso exigiria outros dados, arquivos e armazenamento. A versão oferece o mapa das 27 UFs e todas as consultas de cargos que já existiam, com acesso adicional ao exterior.

## Fonte dos dados do mapa

### Visão por partido

`/api/party-map?office=1` devolve um panorama progressivo das candidaturas com maior percentual publicado em cada UF e no exterior. Cada localidade usa o EA20 do cargo selecionado. Deputado estadual usa deputado distrital no DF; deputado distrital consulta apenas DF. A cor representa o partido da candidatura, não uma soma dos votos de todos os candidatos do partido, uma coligação ou uma eleição confirmada. Empates exatos em votos ficam hachurados, sem escolher uma candidatura arbitrariamente; votação não divulgada ou zerada não colore o estado.

A classificação principal é a tabela 5 de [Silva (2026), Eleições em tempos de incerteza](https://scielo.br/j/ea/a/tZ9W76RrnJx5rH6nTtMRNZz/?lang=pt), usando a referência de 2021: PT, PCdoB, PDT, PSB, PSOL e REDE à esquerda; Cidadania, MDB, PSD, PSDB e Solidariedade ao centro; PL, Novo, Podemos, PP e Republicanos à direita. O artigo também trata União Brasil à direita. Para PCB, PCO, PSTU, Avante e DC, usamos [Bolognesi, Ribeiro e Codato (2023)](https://www.scielo.br/j/dados/a/zzyM3gzHD4P45WWdytXjZWg/?lang=pt), agrupando centro-esquerda à esquerda e centro-direita à direita. As classificações são referências dos estudos, não um campo do TSE nem uma inferência da filiação a coligações. Siglas sem classificação confirmada têm hachuras distintas de centro e de dados ausentes. A legenda e suas fontes ficam no painel.

O servidor compartilha uma coleta por cargo entre os visitantes e responde imediatamente com as localidades já recebidas. A coleta usa a mesma fila e cache das consultas individuais, uma localidade de cada vez. A coleta tem uma janela de 30 segundos desde o início, sem sobrepor lotes do mesmo cargo; a interface lê o panorama a cada 15 segundos enquanto visível. O cache de cada EA20 dura 30 segundos. A fila pode prolongar a atualização das UFs, e cada uma mantém seu horário de geração. Isso não cria chamadas extras ao TSE para cada visitante. Cada localidade informa seu arquivo e horário; gerações de UFs diferentes não são tratadas como simultâneas. Falhas preservam o último resultado com indicação de consulta antiga.

### Visão de urnas

Fonte oficial: [EA14 — acompanhamento Brasil](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea14-arquivo-de-acompanhamento-brasil).

Endpoints verificados com HTTP 200:

- [Presidência, 6257](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-e006257-ab.json).
- [Eleição estadual, 6259](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/br/br-e006259-ab.json).
- [Presidência, exterior](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.json).

EA14 contém `abr[]`, com `cdabr`, seções em `s.ts/st/pst` e eleitorado em `e.te/esnt`. A eleição federal retornou 27 UFs mais `zz` e `br`; a estadual retornou 27 UFs mais `br`. O campo `e.esnt` é o eleitorado de seções não totalizadas, sem estimar votos de candidaturas. A porcentagem regional é `sum(st) / sum(ts) * 100`; regiões incompletas recebem porcentagem ausente, sem fabricar zero.

O mapa e o cargo podem ter horários diferentes porque EA14 e EA20 são gerados e distribuídos separadamente. Exibimos os horários de geração de cada fonte. O [FAQ oficial do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) documenta esse comportamento e o limite de 100 requisições por segundo por IP.

EA14 e EA20 usam a mesma fila serializada do servidor, intervalo de um segundo entre chamadas, cache de 30 segundos e deduplicação por chave. Na visão de urnas, uma consulta obtém todas as UFs pelo EA14; os EA20 estaduais são consultados somente para a visão por partido.

A fixture `tests/fixtures/tse-overview.json` veio da consulta real ao endpoint federal em 4 de outubro de 2026, com geração `04/10/2026 19:02:10` (Brasília), `idg=1552499`. As datas de totalização dentro de `abr[]` são preservadas no snapshot, mas o horário do painel usa a geração raiz `dg/hg`.

### Conferência do exterior

A [especificação EA20, página 2](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado) define a abrangência de `BR` como nacional, incluindo o exterior para seções, eleitorado, comparecimento, abstenção, votos e candidaturas. O app lê `br` diretamente e nunca soma `zz` novamente.

Na auditoria ao vivo do EA14 gerado em `04/10/2026 19:16:58` (Brasília), `497.897` seções das 27 UFs mais `1.351` do exterior resultaram exatamente nas `499.248` nacionais. Seções totalizadas, eleitorado, comparecimento e abstenção também fecharam na mesma geração do arquivo. Não comparamos totais variáveis de gerações diferentes do EA14 e EA20.

`tests/fixtures/tse-exterior.json` é uma captura real do EA20 `zz`, gerada em `04/10/2026 19:17:07` (Brasília), obtida na auditoria em 4 de outubro de 2026. Os testes verificam o fechamento UFs + exterior no EA14 e que consultar `zz` não altera votos, percentuais ou urnas de `br`.

## Geometria

A malha simplificada é do [IBGE — API de Malhas v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), obtida em uma chamada:

```text
https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=minima
```

O GeoJSON contém 27 features com `properties.codarea` no código IBGE. `scripts/generate-map.mjs` converte a malha em caminhos SVG locais com D3 Geo e corrige o sentido dos anéis para a convenção dessa biblioteca. O arquivo gerado `src/brazil-shapes.ts` fica no bundle; a aplicação não acessa IBGE ou servidores de mapas em tempo de execução. A fonte é creditada no mapa. Pequenas UFs possuem chamadas externas para facilitar a seleção; todas também estão na lista e no seletor nativo.
