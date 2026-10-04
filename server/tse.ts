import type { Candidate, Result } from '../src/types';

export const UF_CODES = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];
export const ORIGIN = 'https://resultados.tse.jus.br';
export const CACHE_MS = 60_000;
type Json = Record<string, any>;
export function numeric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const count = (value: unknown) => numeric(value) ?? 0;
export function queryFor(uf: string, office: number) {
  if ((!UF_CODES.includes(uf) && uf !== 'br') || ![1,3,5,6,7,8].includes(office) || (uf === 'br' && office !== 1) || (office === 8 && uf !== 'df') || (office === 7 && uf === 'df')) throw new Error('Filtro inválido.');
  const election = office === 1 ? '6257' : '6259';
  return { election, source: `${ORIGIN}/oficial/ele2026/${election}/dados/${uf}/${uf}-c${String(office).padStart(4,'0')}-e${election.padStart(6,'0')}-u.json` };
}
export function normalize(raw: Json, uf: string, office: number, now = new Date()): Result {
  const { election, source } = queryFor(uf,office);
  if (raw.f !== 'o' || String(raw.ele) !== election || String(raw.cdabr).toLowerCase() !== uf || !raw.s || !raw.v || !Array.isArray(raw.carg)) throw new Error('Formato inesperado dos dados do TSE.');
  const cargo = raw.carg.find((c: Json) => Number(c.cd ?? c.c) === office);
  if (!cargo) throw new Error('Cargo ausente no arquivo do TSE.');
  const required = [raw.s.ts, raw.s.st, raw.s.pst, raw.e?.c, raw.e?.a, raw.e?.pc, raw.e?.pa, raw.v.tv, raw.v.vv, raw.v.vb, raw.v.tvn, raw.v.pvb, raw.v.ptvn];
  if (required.some(value => numeric(value) === null) || count(raw.s.pst)>100) throw new Error('Estatísticas incompletas no arquivo do TSE.');
  const candidates: Candidate[] = [];
  for (const group of cargo.agr ?? []) for (const party of group.par ?? []) for (const c of party.cand ?? []) {
    candidates.push({ id: String(c.sqcand ?? c.n), number: String(c.n), name: String(c.nmu ?? c.nm ?? 'Nome não informado'), party: String(party.sg ?? ''), votes: count(c.vap), percent: numeric(c.pvap), status: String(c.st ?? ''), voteStatus: String(c.dvt ?? '') });
  }
  candidates.sort((a,b)=>b.votes-a.votes || a.name.localeCompare(b.name,'pt-BR'));
  const timestamp = raw.dg && raw.hg ? `${String(raw.dg).split('/').reverse().join('-')}T${raw.hg}-03:00` : null;
  const sourceTime = timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null;
  return { uf, office, election, round: count(raw.t) || 1, source, sourceTime, fetchedAt: now.toISOString(), stale: false, released:raw.dv==='s', final:raw.tf==='s',
    sections: { total: count(raw.s.ts), counted: count(raw.s.st), percent: numeric(raw.s.pst) },
    voters: { turnout: count(raw.e?.c), abstention: count(raw.e?.a), turnoutPercent: numeric(raw.e?.pc), abstentionPercent: numeric(raw.e?.pa) },
    votes: { total: count(raw.v.tv), valid: count(raw.v.vv), blank: count(raw.v.vb), null: count(raw.v.tvn), blankPercent: numeric(raw.v.pvb), nullPercent: numeric(raw.v.ptvn), validPercent: count(raw.v.tv)>0?count(raw.v.vv)/count(raw.v.tv)*100:null }, candidates:raw.dv==='s'?candidates:[] };
}

type Entry = { value?: Result; nextFetch: number; error?: string; pending?: Promise<Result> };
export class TseClient {
  private cache = new Map<string, Entry>();
  private queue: Promise<unknown> = Promise.resolve();
  private blockedUntil = 0;
  constructor(private request: typeof fetch = fetch, private clock = () => Date.now()) {}
  async get(uf: string, office: number): Promise<Result> {
    const {source} = queryFor(uf,office);
    const key = `${uf}:${office}`;
    let entry = this.cache.get(key);
    if (entry?.pending) return entry.pending;
    if (entry && this.clock() < entry.nextFetch) {
      if (entry.value) return {...entry.value, stale: !!entry.error, ...(entry.error ? {warning:entry.error} : {})};
      throw new Error(entry.error);
    }
    if (this.clock() < this.blockedUntil) {
      if (entry?.value) return {...entry.value,stale:true,warning:'O TSE pediu uma pausa nas consultas. Últimos dados disponíveis.'};
      throw new Error('O TSE pediu uma pausa. A consulta será retomada automaticamente.');
    }
    entry ??= { nextFetch:0 };
    this.cache.set(key,entry);
    const current = entry;
    const task = async () => {
      try {
        if (this.clock() < this.blockedUntil) throw new Error('O TSE pediu uma pausa nas consultas.');
        const response = await this.request(source, { signal: AbortSignal.timeout(12_000), headers: { Accept:'application/json' }, redirect:'error' });
        if (!response.ok) {
          if ([429,403].includes(response.status)) {
            const retry = response.headers.get('retry-after');
            const retryMs = retry && Number.isFinite(Number(retry)) ? Number(retry)*1000 : retry ? Date.parse(retry)-this.clock() : 0;
            this.blockedUntil = this.clock() + Math.max(610_000, Number.isFinite(retryMs) ? retryMs : 0);
          }
          current.nextFetch = this.clock() + (response.status === 404 ? 300_000 : 60_000);
          throw new Error(response.status === 404 ? 'O TSE ainda não publicou este resultado. Nova consulta em até 5 minutos.' : `Dados do TSE temporariamente indisponíveis (HTTP ${response.status}).`);
        }
        const length=Number(response.headers.get('content-length') ?? 0);
        if(length>12_000_000) throw new Error('Arquivo do TSE excedeu o tamanho esperado.');
        const raw = await response.json();
        current.value = normalize(raw,uf,office,new Date(this.clock()));
        current.error = undefined;
        current.nextFetch = this.clock() + CACHE_MS;
        return current.value;
      } catch (error) {
        const message = error instanceof Error && !['TimeoutError','AbortError'].includes(error.name) ? error.message : 'A consulta ao TSE demorou. Tentaremos novamente em um minuto.';
        current.error = message;
        current.nextFetch = Math.max(current.nextFetch,this.clock()+CACHE_MS);
        if (current.value) return {...current.value,stale:true,warning:message};
        throw new Error(message);
      } finally { current.pending = undefined; }
    };
    // A single upstream request at a time, with one-second spacing across all filters.
    current.pending = this.queue.then(task);
    this.queue = current.pending.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,1_000)));
    return current.pending;
  }
}
