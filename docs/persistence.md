# Persistência dos resultados e fotos

O serviço usa o [SQLite integrado ao Node.js](https://nodejs.org/api/sqlite.html), sem novas dependências nem um banco exposto na rede. O Coolify administra um volume persistente montado em `/app/data`; o processo executa como o usuário `node`. O [endpoint oficial de storage do Coolify](https://coolify.io/docs/api/endpoints/applications/create-storage-by-application-uuid) cria esse volume na aplicação existente.

## Dados guardados

| Tabela | Conteúdo |
| --- | --- |
| `snapshots` | JSON original EA20/EA14, representação normalizada, chave localidade/cargo, SHA-256 da geração, horário de publicação e primeira/última captura |
| `latest` | Último resultado válido e prazos de cache/falha por consulta |
| `metadata` | Identificador do banco e pausa global solicitada pelo TSE |
| `candidate_photos` | IDs oficiais registrados, endereço fixo, bytes JPEG, ETag, status e prazo da próxima consulta |

As gravações usam transações, WAL e sincronização completa. Snapshots da mesma geração são deduplicados pelo hash do JSON. Uma geração anterior fica registrada para auditoria, mas não substitui a consulta mais recente; a resposta informa essa condição. Falhas do TSE mantêm os dados válidos com indicação de consulta antiga. O mapa por partido é preenchido com resultados persistidos imediatamente após reinício enquanto a atualização ocorre na fila compartilhada.

`/api/history?uf=br&office=1` retorna até 24 horários oficiais distintos com percentual e quantidade de seções apuradas. O histórico é compartilhado entre dispositivos e começa com a captura efetiva pelo servidor. O endpoint não provoca uma chamada ao TSE. O JSON original e o arquivo do banco permanecem privados no volume; não há endpoint de download do SQLite.

O cache continua em 30 segundos e a interface lê as APIs a cada 15 segundos quando visível. Resultados e imagens passam pela mesma fila serial, com intervalo de um segundo. Os prazos de falha e a pausa global de pelo menos dez minutos para HTTP 403/429 são restaurados do banco após reinício. Fotos válidas duram 24 horas; IDs desconhecidos não provocam consultas ao TSE.

## Cópias locais

O backup online nativo cria um banco independente e consistente sem copiar apenas o arquivo principal durante uma transação WAL. A cópia é renomeada após conclusão; quatro versões ficam em `/app/data/backups`. A rotina roda a cada hora e ao iniciar um banco existente. Essas cópias ficam no mesmo host e não são um backup remoto. Parar a aplicação preserva o volume; removê-lo elimina o banco e suas cópias.

## Verificação

Os testes abrem um banco temporário, capturam fixtures oficiais, fecham e reabrem o banco. Verificam restauração sem nova chamada, histórico compartilhado, deduplicação, rejeição de regressão de geração, restauração de backoff e fotos, e `PRAGMA integrity_check` da cópia online. O Playwright verifica as imagens e a alternativa de número no celular/desktop, o histórico após limpar o navegador, e o fluxo real TSE → SQLite → API → interface. A persistência em produção é conferida comparando o identificador do banco, snapshots e fotos antes e depois de um novo deploy.
