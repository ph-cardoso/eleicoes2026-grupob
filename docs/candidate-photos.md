# Official 2026 candidate photos

Verified on **4 October 2026** against the TSE's current download instructions and three real photo responses. No archive or bulk candidate-photo download was used.

## URL contract

The official guide specifies photo filenames as `<sqcand>.jpeg` within an election's `fotos/{scope}` directory. EA20 supplies `sqcand` on each candidate, vice, and Senate alternate. This is the unique candidature identifier, **not** the ballot number `n`. [2026 download instructions, page 5](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-instrucoes-para-download-dos-arquivos-da-divulgacao-2026), [EA20 candidate fields, pages 12–13](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado).

```text
https://resultados.tse.jus.br/oficial/ele2026/{election}/fotos/{photoScope}/{sqcand}.jpeg
```

The election directory is the plain election number, with no zero padding. The extension is `.jpeg`.

| Contest | Election | Photo scope |
| --- | --- | --- |
| President, including a regional results view | `6257` | `br` |
| Governor / Senator / deputies | `6259` | Candidate's lowercase UF, such as `sp` |

Presidential candidates are national candidates, so use the verified national photo directory when displaying their votes filtered to a state or the exterior. Regional filtering changes the vote scope; it does not change the candidature ID. The live presidency and governor fixtures contain the tested IDs. [President results](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json), [SP governor results](https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json).

## Successful live probes

All three returned **HTTP 200**, `Content-Type: image/jpeg`, and a JPEG byte signature. Requests were sequential, spaced more than one second apart:

| Candidate | Tested photo | Bytes |
| --- | --- | --- |
| Lula | [6257/fotos/br/280002542548.jpeg](https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002542548.jpeg) | 6,969 |
| Flavio Bolsonaro | [6257/fotos/br/280002551544.jpeg](https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551544.jpeg) | 6,753 |
| Tarcísio | [6259/fotos/sp/250002541303.jpeg](https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sp/250002541303.jpeg) | 6,982 |

Photo responses included ETag and Last-Modified. Observed `Cache-Control` was approximately `max-age=3510534` seconds for presidents and `max-age=3513114` for Tarcísio; these assets can be cached far longer than election totals. Those headers describe these probes, not a guaranteed policy for every image.

## Implemented proxy and cache

The fixed-host image proxy is restricted to `https://resultados.tse.jus.br`, current election IDs, an allowed photo UF, and a digits-only candidature ID registered from a successful results query. It preserves `sqcand`, generates photo URLs internally, refuses unregistered IDs without an upstream request, and never accepts an arbitrary upstream URL.

Successful image bytes are persisted in SQLite for 24 hours, with in-flight deduplication, ETag, conditional HTTP 304 and browser cache headers. Images load lazily for visible candidate cards. JPEG content type, signature and a 1 MB size limit are checked. No unrelated portrait replaces the official photo.

There is no documented universal placeholder URL in the inspected guide. Missing-photo HTTP behavior was deliberately **not probed with a fabricated ID**, because repeated 404s can block the IP. Missing IDs, 404, invalid content type, timeout, or decode failure leave the ballot number in the same-sized avatar. A 404 is negatively cached for 24 hours; transient failures wait at least 60 seconds, subject to the global TSE pause. Previously stored photo bytes remain available during failures. No alternate-extension or alternate-folder probing occurs.

The documented service limit is **100 requests per second per IP**; excess traffic may block an IP for ten minutes, and attempts during blocking may reset that period. Repeated 404s also risk blocking. Share the proxy's upstream request limiter with results fetching, respect Retry-After, and pause upstream calls for ten minutes on 429/403. [Official TSE rate-limit FAQ](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

## Scope of verification

President and SP governor photos were verified directly. The same UF template for Senator/deputies comes from the official election-directory specification; each image was not individually probed. A read of the official application's main JavaScript bundle contained no photo construction code, so the verified contract above is grounded in the current guide and successful CDN responses.

`tests/fixtures/candidate-photo.jpeg` is the real Flavio response above, downloaded on 4 October 2026 for deterministic browser rendering and missing-photo tests. The fixture is never included in production or used as a fallback. The live browser test requests a real registered photo through the application's proxy.
