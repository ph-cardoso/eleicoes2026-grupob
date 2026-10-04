import type { Candidate, Result, Overview } from '../src/types';
import { RESULT_CACHE_MS } from '../src/config';
import { candidatePhotoUrl, ORIGIN, overviewQuery, queryFor, UF_CODES } from './tse-urls';
import type { SqliteStore, StoredEntry } from './store';
export { ORIGIN, overviewQuery, queryFor, UF_CODES } from './tse-urls';

export const CACHE_MS = RESULT_CACHE_MS;
type Json = Record<string, any>;
export function numeric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const count = (value: unknown) => numeric(value) ?? 0;
export function normalize(raw: Json, uf: string, office: number, now = new Date()): Result {
  const { election, source } = queryFor(uf,office);
  if (raw.f !== 'o' || String(raw.ele) !== election || String(raw.cdabr).toLowerCase() !== uf || !raw.s || !raw.v || !Array.isArray(raw.carg)) throw new Error('Formato inesperado dos dados do TSE.');
  const cargo = raw.carg.find((c: Json) => Number(c.cd ?? c.c) === office);
  if (!cargo) throw new Error('Cargo ausente no arquivo do TSE.');
  const required = [raw.s.ts, raw.s.st, raw.s.pst, raw.e?.c, raw.e?.a, raw.e?.pc, raw.e?.pa, raw.v.tv, raw.v.vv, raw.v.vb, raw.v.tvn, raw.v.pvb, raw.v.ptvn];
  if (required.some(value => numeric(value) === null) || count(raw.s.pst)>100) throw new Error('Estatísticas incompletas no arquivo do TSE.');
  const candidates: Candidate[] = [];
  for (const group of cargo.agr ?? []) for (const party of group.par ?? []) for (const c of party.cand ?? []) {
    candidates.push({ id: String(c.sqcand ?? c.n), number: String(c.n), name: String(c.nmu ?? c.nm ?? 'Nome não informado'), party: String(party.sg ?? ''), votes: count(c.vap), percent: numeric(c.pvap), status: String(c.st ?? ''), voteStatus: String(c.dvt ?? ''), photoUrl:candidatePhotoUrl(election,uf,c.sqcand) });
  }
  const timestamp = raw.dg && raw.hg ? `${String(raw.dg).split('/').reverse().join('-')}T${raw.hg}-03:00` : null;
  const sourceTime = timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null;
  return { uf, office, election, round: count(raw.t) || 1, source, sourceTime, fetchedAt: now.toISOString(), stale: false, released:raw.dv==='s', final:raw.tf==='s',
    sections: { total: count(raw.s.ts), counted: count(raw.s.st), percent: numeric(raw.s.pst) },
    voters: { turnout: count(raw.e?.c), abstention: count(raw.e?.a), turnoutPercent: numeric(raw.e?.pc), abstentionPercent: numeric(raw.e?.pa) },
    votes: { total: count(raw.v.tv), valid: count(raw.v.vv), blank: count(raw.v.vb), null: count(raw.v.tvn), blankPercent: numeric(raw.v.pvb), nullPercent: numeric(raw.v.ptvn), validPercent: count(raw.v.tv)>0?count(raw.v.vv)/count(raw.v.tv)*100:null }, candidates:raw.dv==='s'?candidates:[] };
}

export function normalizeOverview(raw: Json, election: string, now = new Date()): Overview {
  const source = overviewQuery(election);
  if (raw.f !== 'o' || String(raw.ele) !== election || !Array.isArray(raw.abr)) throw new Error('Formato inesperado do mapa do TSE.');
  const scopes = raw.abr.filter((scope: Json) => [...UF_CODES,'br',...(election==='6257'?['zz']:[])].includes(scope.cdabr)).map((scope: Json) => {
    const total=numeric(scope.s?.ts), counted=numeric(scope.s?.st), percent=numeric(scope.s?.pst);
    if (total===null || counted===null || percent===null || percent>100 || counted>total) throw new Error('Estatísticas incompletas no mapa do TSE.');
    return {uf:String(scope.cdabr),total,counted,percent,registered:numeric(scope.e?.te),pendingVoters:numeric(scope.e?.esnt)};
  });
  if (!scopes.length || new Set(scopes.map((scope: {uf:string})=>scope.uf)).size!==scopes.length) throw new Error('Abrangências inválidas no mapa do TSE.');
  const timestamp=raw.dg&&raw.hg?`${String(raw.dg).split('/').reverse().join('-')}T${raw.hg}-03:00`:null;
  const sourceTime=timestamp&&Number.isFinite(Date.parse(timestamp))?new Date(timestamp).toISOString():null;
  return {election,source,sourceTime,fetchedAt:now.toISOString(),stale:false,scopes};
}
type Payload = Result | Overview;
type Entry = { value?: Payload; nextFetch: number; error?: string; pending?: Promise<Payload> };
export class TseClient {
  private cache = new Map<string, Entry>();
  private queue: Promise<unknown> = Promise.resolve();
  private blockedUntil = 0;
  constructor(private request: typeof fetch = fetch, private clock = () => Date.now(), private store?:SqliteStore) {
    this.blockedUntil=Number(store?.setting('blocked_until')??0);
  }
  async requestOfficial(source:string,accept='application/json'):Promise<Response> {
    if(new URL(source).origin!==ORIGIN)throw new Error('Fonte inválida.');
    const task=async()=>{
      this.blockedUntil=Math.max(this.blockedUntil,Number(this.store?.setting('blocked_until')??0));
      if(this.clock()<this.blockedUntil)throw new Error('O TSE pediu uma pausa nas consultas.');
      const response=await this.request(source,{signal:AbortSignal.timeout(12_000),headers:{Accept:accept},redirect:'error'});
      if([429,403].includes(response.status)) {
        const retry=response.headers.get('retry-after');
        const retryMs=retry&&Number.isFinite(Number(retry))?Number(retry)*1000:retry?Date.parse(retry)-this.clock():0;
        this.blockedUntil=this.clock()+Math.max(610_000,Number.isFinite(retryMs)?retryMs:0);
        this.store?.setSetting('blocked_until',String(this.blockedUntil));
      }
      return response;
    };
    const pending=this.queue.then(task);
    this.queue=pending.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,1_000)));
    return pending;
  }
  async get(uf: string, office: number): Promise<Result> {
    const {source} = queryFor(uf,office);
    const key = `${uf}:${office}`;
    return this.retrieve(key,source,(raw,now)=>normalize(raw,uf,office,now));
  }
  cached(uf:string,office:number):Result|undefined {
    queryFor(uf,office);
    const entry=this.cache.get(`${uf}:${office}`)??this.store?.load(`${uf}:${office}`);
    if(!entry?.value||!('candidates' in entry.value))return undefined;
    return {...entry.value,stale:!!entry.error||this.clock()>=entry.nextFetch,
      ...(entry.error?{warning:entry.error}:this.clock()>=entry.nextFetch?{warning:'Aguardando nova consulta ao TSE.'}:{})};
  }
  async getOverview(election: string): Promise<Overview> {
    return this.retrieve(`overview:${election}`,overviewQuery(election),(raw,now)=>normalizeOverview(raw,election,now));
  }
  private async retrieve<T extends Payload>(key: string, source: string, parse:(raw:Json, now:Date)=>T): Promise<T> {
    let entry = this.cache.get(key);
    if(!entry) {const persisted=this.store?.load(key);if(persisted){entry={...persisted};this.cache.set(key,entry);}}
    if (entry?.pending) return entry.pending as Promise<T>;
    if (entry && this.clock() < entry.nextFetch) {
      if (entry.value) return {...entry.value, stale: !!entry.error, ...(entry.error ? {warning:entry.error} : {})} as T;
      throw new Error(entry.error);
    }
    if (this.clock() < this.blockedUntil) {
      if (entry?.value) return {...entry.value,stale:true,warning:'O TSE pediu uma pausa nas consultas. Últimos dados disponíveis.'} as T;
      throw new Error('O TSE pediu uma pausa. A consulta será retomada automaticamente.');
    }
    entry ??= { nextFetch:0 };
    this.cache.set(key,entry);
    const current = entry;
    const task = async (): Promise<Payload> => {
      try {
        if (this.clock() < this.blockedUntil) throw new Error('O TSE pediu uma pausa nas consultas.');
        const response = await this.requestOfficial(source);
        if (!response.ok) {
          current.nextFetch = this.clock() + (response.status === 404 ? 300_000 : 60_000);
          throw new Error(response.status === 404 ? 'O TSE ainda não publicou este resultado. Nova consulta em até 5 minutos.' : `Dados do TSE temporariamente indisponíveis (HTTP ${response.status}).`);
        }
        const length=Number(response.headers.get('content-length') ?? 0);
        if(length>12_000_000) throw new Error('Arquivo do TSE excedeu o tamanho esperado.');
        const raw = await response.json();
        const value = parse(raw,new Date(this.clock()));
        const saved:StoredEntry=this.store?this.store.saveSuccess(key,value,raw,this.clock()+CACHE_MS):{value,nextFetch:this.clock()+CACHE_MS};
        current.value=saved.value;current.error=saved.error;current.nextFetch=saved.nextFetch;
        return {...current.value!,stale:!!saved.error,...(saved.error?{warning:saved.error}:{})};
      } catch (error) {
        const message = error instanceof Error && !['TimeoutError','AbortError'].includes(error.name) ? error.message : 'A consulta ao TSE demorou. Tentaremos novamente automaticamente.';
        current.error = message;
        current.nextFetch = Math.max(current.nextFetch,this.clock()+CACHE_MS);
        try {this.store?.saveFailure(key,message,current.nextFetch);}catch{current.error='Não foi possível guardar a atualização. Mostrando a última consulta válida.';}
        if (current.value) return {...current.value,stale:true,warning:current.error};
        throw new Error(message);
      } finally { current.pending = undefined; }
    };
    const pending=task();current.pending=pending;
    return pending as Promise<T>;
  }
}
