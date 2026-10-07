# Desativação e reativação no segundo turno

## Estado após a desativação

A aplicação foi parada pelo Coolify em **6 de outubro de 2026, às 21h45 em Brasília** (7 de outubro, 00h45 UTC). O Coolify confirmou `container_present=false` e `status=exited:unhealthy`; esse status é esperado para a aplicação parada. A URL pública retornou HTTP 503 no curl e no Playwright, em celular e desktop.

O banco, as fotos, os backups locais, a configuração da aplicação e o domínio foram preservados. Com a aplicação parada, não há coleta nem atualização do dashboard. Não foi agendada uma reativação automática.

| Recurso | Identificação |
| --- | --- |
| Site público | <https://apuracao.phcardoso.dev> |
| Aplicação | `eleicoes2026-grupob` |
| UUID Coolify | `iicukhvzrwqalk3ura2j5d13` |
| Repositório / branch | [ph-cardoso/eleicoes2026-grupob](https://github.com/ph-cardoso/eleicoes2026-grupob), `main` |
| Última versão publicada antes da parada | `62380f8c10056dff018c45c61ffdf6ac1af90a14` |
| Volume preservado | `iicukhvzrwqalk3ura2j5d13-eleicoes2026-data`, montado em `/app/data` |
| Banco do primeiro turno | `/app/data/tse.sqlite` |
| Backups do primeiro turno | `/app/data/backups` |

Antes da parada, `/api/health` informou SQLite, **2.196 snapshots** e **724 fotos**, com `databaseId=1acd5285-e796-46ca-a440-ab016c1fce73`. Esses números registram a última verificação, não uma coleta em andamento.

## Caminho rápido para voltar

1. Conecte-se ao Tailscale e abra [a aplicação no Coolify](https://coolify.phcardoso.dev/project/urqkbbokuuydgimaz7oq83kf/environment/u84c1fmzprehir320nfyaduu/application/iicukhvzrwqalk3ura2j5d13).
2. Prepare o código para o segundo turno conforme a seção seguinte, mantendo o site parado durante os ajustes.
3. Nas variáveis de ambiente da aplicação no Coolify, defina `DATA_DIR=/app/data/segundo-turno-2026`. Mantenha o volume existente montado em `/app/data`. O servidor criará um banco separado dentro desse volume, preservando o primeiro turno.
4. Quando for usar o painel, publique as alterações na branch `main` e clique em **Deploy** no Coolify. Esse passo reativa a aplicação; deve acontecer somente quando houver intenção de colocá-la no ar.
5. Aguarde o estado saudável e faça as verificações abaixo. A URL pública continua sendo a mesma.

O botão **Start** também reativa a aplicação, mas o código atual continua configurado para o **primeiro turno**. Para acompanhar o segundo turno, conclua a preparação antes de iniciar ou publicar.

Para pedir a reativação a um agente, copie esta instrução:

> Reative este projeto para o segundo turno de 2026. Siga docs/operations.md: confirme os códigos e as UFs no TSE, ajuste cargos, mapas, fotos e identificação do turno, separe os dados do primeiro turno e valide API e UI com Playwright respeitando o cache. Preserve o volume e o domínio existentes. Publique pelo Coolify em https://apuracao.phcardoso.dev e verifique a publicação.

## Preparar o segundo turno

A [pesquisa realizada em 4 de outubro](tse-api-research.md) registrou os sucessores **6258 para Presidente** e **6260 para eleições estaduais**. Reconfirme-os no [índice oficial EA11](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json) antes da publicação. Não trate esses códigos como endpoints já testados neste projeto: as consultas e fixtures atuais são do primeiro turno.

Confirme quais disputas e UFs efetivamente terão segundo turno. Ofereça somente os cargos aplicáveis, Presidente e Governador, e somente as UFs com disputa correspondente. O mapa de Governador deve identificar as demais UFs como sem disputa neste turno, sem consultar arquivos inexistentes. Preserve Exterior (`zz`) para Presidente; o resultado Brasil (`br`) já o inclui uma única vez.

| Arquivo | Ajuste necessário |
| --- | --- |
| [`server/tse-urls.ts`](../server/tse-urls.ts) | Códigos aceitos, URLs de resultados e panorama, cargos/UFs válidos e diretório nacional das fotos presidenciais. |
| [`server/index.ts`](../server/index.ts) | Eleição padrão de `/api/overview` e códigos aceitos pela rota `/api/photos`. |
| [`server/tse.ts`](../server/tse.ts) | Inclusão de Exterior no panorama presidencial e validação de eleição e turno dos resultados. |
| [`server/store.ts`](../server/store.ts) | Registro das fotos presidenciais no diretório `br`, inclusive para resultados de UF e Exterior. |
| [`server/party-map.ts`](../server/party-map.ts) | Coleta somente nas UFs e disputas participantes, mantendo Exterior no mapa presidencial. |
| [`src/domain.ts`](../src/domain.ts) | Cargos e localidades válidos para o turno. |
| [`src/useResults.ts`](../src/useResults.ts) | Código de eleição do panorama e chave do histórico local. Use uma nova chave, como `grupob-history-2026-2`, para não recuperar o histórico do primeiro turno. |
| [`src/main.tsx`](../src/main.tsx) | Data/identificação do turno e links para a eleição correta no site do TSE. |
| [`tests/`](../tests/) e [`server/*.test.ts`](../server/) | Expectativas de códigos/cargos e fixtures de segundo turno, quando publicadas pelo TSE. |

Separe os bancos pelo `DATA_DIR` acima: as chaves atuais de cache e histórico usam `uf:cargo`, sem distinguir a eleição. Reutilizar o banco anterior poderia mostrar dados do primeiro turno como cache ou fallback. Não apague nem renomeie o banco antigo. Se preferir um banco único no futuro, será necessário mudar as chaves de persistência, cache e histórico para incluir a eleição antes de reutilizá-lo.

Mantenha o polling de **15 segundos**, o cache compartilhado de **30 segundos**, a fila única com intervalo mínimo de **um segundo** e os recuos para 404/403/429. Use as fontes oficiais confirmadas; evite adivinhar URLs ou repetir consultas a arquivos ainda não publicados. Dados não divulgados devem aparecer como indisponíveis, sem reutilizar resultados do turno anterior.

## Verificar antes de compartilhar

Na preparação local, use Node.js 24 e pnpm 11.23.0:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm exec playwright test tests/ui.spec.ts
```

Atualize primeiro os testes para o segundo turno. O teste `tests/ui.spec.ts` usa respostas simuladas para a UI; as fixtures históricas não são fallback de produção. Depois da publicação, execute apenas uma passagem do teste real, no projeto mobile, para limitar consultas ao TSE:

```sh
BASE_URL=https://apuracao.phcardoso.dev pnpm exec playwright test tests/live.spec.ts --project=mobile
```

Confirme no teste e no navegador:

- `/api/health` retorna HTTP 200 com SQLite; o banco separado tem um novo `databaseId` e novos registros quando houver resultados oficiais.
- `/api/results?uf=br&office=1` informa a eleição correta e `round=2`, sem dados ou histórico do primeiro turno.
- Brasil inclui Exterior exatamente uma vez; Exterior continua selecionável e usa Presidente.
- Candidatos estão em percentual decrescente, com brancos, nulos e fotos oficiais quando disponíveis.
- Mapa por partido continua como padrão, com a opção de progresso das urnas; filtros e seletor Mapa/Candidatos funcionam em celular e desktop.
- Atualização automática, cache compartilhado, avisos de indisponibilidade e instruções de não indexação continuam funcionando.

Se os resultados oficiais ainda não tiverem sido publicados, não afirme que a validação real passou. Preserve o recuo das consultas e refaça essa verificação quando a fonte estiver disponível.

## Parar novamente após o evento

Na mesma aplicação do Coolify, clique em **Stop** e confirme. Verifique a aplicação parada e a URL pública indisponível; nesta desativação a resposta foi HTTP 503. Preserve o volume `/app/data` e o DNS com proxy Cloudflare ativado para permitir outra reativação.

Para agentes com o MCP Coolify, a parada corresponde a `control` com `resource=application`, `action=stop`, `uuid=iicukhvzrwqalk3ura2j5d13` e `confirm=true`, após autorização do proprietário. Não remova a aplicação, o volume ou o DNS para realizar uma parada temporária.
