# TSE results API — 2026 first round

Verified on **4 October 2026, 21:39–21:43 UTC**. Only TSE primary sources and live TSE responses were used. This directory was fresh, so research notes live in `docs/`.

## Official source and election discovery

The TSE publishes public JSON files through its results CDN; an API token or prior registration is unnecessary. The official technical page identifies the first-round election codes. The live [EA11 election configuration](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json) agrees: cycle `ele2026`, pleito `3220`, election day `04/10/2026`. [Official technical information and FAQ](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

| Contest | Election | Cargo | Scope |
| --- | --- | --- | --- |
| President | `6257` | `1` | Brazil, UF, municipality |
| Governor | `6259` | `3` | UF, municipality |
| Senator | `6259` | `5` | UF, municipality |
| Federal deputy | `6259` | `6` | UF, municipality |
| State deputy | `6259` | `7` | UF, municipality |
| District deputy | `6259` | `8` | DF, municipality |

EA11 reports second-round successors `6258` and `6260`. They are not first-round fallback IDs. Cargo `25` belongs to the separate `6261` district council election. [Live configuration](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json).

## Verified URLs

The directory election number is unpadded; file election codes use **six digits**, and cargo codes use **four digits**. Scope and UF use lowercase. Each URL below returned HTTP 200 with official (`f=o`) JSON:

- [President, Brazil](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json).
- [President, São Paulo](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/sp/sp-c0001-e006257-u.json).
- [Governor, São Paulo](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json).
- [Senator, São Paulo](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0005-e006259-u.json).

```text
https://resultados.tse.jus.br/oficial/ele2026/{election}/dados/{uf}/{uf}-c{cargo:04}-e{election:06}-u.json
```

Municipality names append their TSE code after UF, using exactly five digits including leading zeros. The TSE municipality code differs from the IBGE code. Load municipality codes from EA12 before querying municipalities. [TSE documentation index](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados).

## Current payload contract

Candidates are nested at `carg[].agr[].par[].cand[]`; use `carg[].cd` to choose the requested cargo. The party abbreviation is `par.sg`. Root `e` is an **electorate object**, whereas candidate `e` is an outcome flag. Real fetched examples include every available root `s`, `e`, and `v` field in [president fixture](../tests/fixtures/tse-president.json) and [governor fixture](../tests/fixtures/tse-governor.json).

| UI value | Source field |
| --- | --- |
| Ballot name | `cand.nmu` |
| Full name / ballot number / unique ID | `cand.nm` / `cand.n` / `cand.sqcand` |
| Candidate votes | `cand.vap` |
| Candidate percentage | `cand.pvap` / precise `cand.pvapn` |
| Candidate ranking | `cand.seq` |
| Vote destination | `cand.dvt` |
| Official candidate outcome | `cand.st` |
| Vice / alternate senators | `cand.vs[]` |
| Available seats | `carg.nv` |
| Total / totalized / pending sections | `s.ts` / `s.st` / `s.snt` |
| Totalized percentage | `s.pst` / precise `s.pstn` |
| Installed / not installed sections | `s.si` / `s.sni` |
| Counted / not counted sections | `s.sa` / `s.sna` |
| Registered electorate | `e.te` |
| Electorate in totalized sections | `e.est` / `e.pest` |
| Turnout / abstentions | `e.c` / `e.a` |
| Turnout / abstention percentages | `e.pc` / `e.pa` |
| All votes / votes to candidates | `v.tv` / `v.vvc` |
| Valid votes | `v.vv` |
| Blank votes / share of all votes | `v.vb` / `v.pvb` |
| All null votes / share of all votes | `v.tvn` / `v.ptvn` |
| Ordinary / technical null votes | `v.vn` / `v.vnt` |
| Annulled / annulled under litigation | `v.van` / `v.vansj` |
| Party-list valid votes | `v.vl`, when present |
| Generated date/time / generation ID | `dg` / `hg` / `idg` |
| Totalization date/time | `dt` / `ht` |

Values are strings. Decimal strings use commas (`"36,60"`); precise percentages also use commas (`"36,604052495"`). Parse both safely and display the official two-decimal values. Do not assume an absent field is a confirmed zero. [Live president JSON](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json), [live governor JSON](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json).

## Interpretation safeguards

- `cand.e=s` includes candidates who advance to a runoff. Use `cand.st` to distinguish `Eleito` from `2º turno`; it is populated after final totalization. Never call the current leader elected.
- `tf=s` means final totalization. `and=n/p/f` means not started/partial/finished. Fully received sections do not independently prove final election outcomes.
- `md=e/s/n` signals mathematically determined election/runoff/undetermined for President or Governor. `esae=s` means no elected candidate could be assigned; preserve `mnae` reasons.
- `dv=n` means presidential votes cannot yet be published. `f=s` is simulation, unsuitable for live results.
- `s.pst` is progress through **all sections**. `s.psa` describes counted sections among installed sections, so it can be 100% early in the evening.
- Candidate percentage denominator is `v.vvc`, including annulled votes; `v.vv` is strictly valid votes. Label percentages accordingly. `e.pc/pa` cover installed sections already received, not the whole electorate.

Source: [EA20 specification, pages 8–9, 12–13, 15–21](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado).

The Senate contest has two available seats and each voter may cast two Senate votes. The verified SP response reported `carg[0].nv="2"`; its all-vote total was twice turnout. Candidate percentage remains a share of candidate votes, not people. Use TSE's `pvap`, and never divide senator votes by turnout. [Official Senate clarification](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [live Senate JSON](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0005-e006259-u.json).

The TSE requires preservation of the distributed results and display of vote destination. Results begin at 17:00 Brasília time; date/time display should use `America/Sao_Paulo`. [Resolution 23.751/2026, articles 265, 267, and 282](https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-751-de-26-de-fevereiro-de-2026).

## Rate limits and proposed client behavior

Official limit: **100 requests per second per IP**. Exceeding the limit may cause a ten-minute block; retries during that block can restart its duration. Repeated 404s can also cause blocking; TSE does not disclose that threshold. No exact recommended polling interval is published. Conditional ETag/Last-Modified requests are supported, but HTTP 304 still counts toward the rate limit. [Official FAQ](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

Implementation choice for eight viewers: refresh the selected contest every 15 seconds; share a 30-second server cache across visitors; deduplicate simultaneous requests; cap upstream concurrency; preserve the last successful result when unavailable; back off on 404; honor Retry-After and wait at least ten minutes after a 429/403. Use a fixed TSE host and validate election, cargo, and UF rather than accepting arbitrary upstream URLs. Pause polling while the browser is hidden.

The observed response headers included `Cache-Control: max-age=48`/`51`, ETag, and Last-Modified. Although observed header limits were larger, follow the documented **100/sec** limit. Probes ran sequentially at approximately one request per second, with no speculative URL enumeration or repeated missing-file calls.

## Fixture provenance and limitations

- `tests/fixtures/tse-president.json`: HTTP 200 capture **2026-10-04T21:40:30.262883Z**, source [BR President EA20](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json), generation `idg=1435247`, source generation `04/10/2026 18:37:14`.
- `tests/fixtures/tse-governor.json`: HTTP 200 capture **2026-10-04T21:40:31.283218Z**, source [SP Governor EA20](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json), generation `idg=1426073`, source generation `04/10/2026 18:35:17`.

These snapshots are test inputs, never a production fallback presented as current results. They have partial results and blank final outcome fields. The initial API probes did not save their payloads, so the fixture captures required a subsequent request per fixture after approximately a minute.

EA20 was read through browser-extracted PDF text, including candidate status and voting hierarchy pages. A separate Python download of the TSE portal's PDF returned HTTP 403; it did not affect the successful results-CDN queries. Municipality and every-UF coverage was not exhaustively probed, to keep election-day upstream calls minimal.
