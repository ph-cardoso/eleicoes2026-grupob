import type { PartyMap, PartyScope } from '../src/types';
import { highestPercentage } from '../src/domain';
import { CACHE_MS, queryFor, TseClient, UF_CODES } from './tse';

export const PARTY_MAP_REFRESH_MS=CACHE_MS;
interface Entry {
  scopes: Map<string,PartyScope>; errors: Map<string,string>; loading: boolean;
  completed: number; nextRefresh: number;
}
export class PartyMapClient {
  private entries=new Map<number,Entry>();
  constructor(private client:Pick<TseClient,'get'>&Partial<Pick<TseClient,'cached'>>,private clock=()=>Date.now()) {}
  get(office:number):PartyMap {
    queryFor(office===8?'df':'sp',office);
    const ufs=office===8?['df']:[...UF_CODES,...(office===1?['zz']:[])];
    let entry=this.entries.get(office);
    if(!entry) {
      entry={scopes:new Map(),errors:new Map(),loading:false,completed:0,nextRefresh:0};
      for(const uf of ufs) {
        const mappedOffice=uf==='df'&&office===7?8:office;
        const result=this.client.cached?.(uf,mappedOffice);
        if(result)entry.scopes.set(uf,{uf,office:mappedOffice,candidates:highestPercentage(result),source:result.source,
          sourceTime:result.sourceTime,stale:result.stale,...(result.warning?{warning:result.warning}:{})});
      }
      this.entries.set(office,entry);
    }
    if(!entry.loading&&this.clock()>=entry.nextRefresh) {
      entry.loading=true;entry.completed=0;entry.errors.clear();entry.nextRefresh=this.clock()+PARTY_MAP_REFRESH_MS;
      void this.collect(entry,ufs,office);
    }
    return {office,scopes:[...entry.scopes.values()],loading:entry.loading,completed:entry.completed,total:ufs.length,
      fetchedAt:new Date(this.clock()).toISOString(),errors:[...entry.errors].map(([uf,message])=>({uf,message}))};
  }
  private async collect(entry:Entry,ufs:string[],office:number) {
    try {
      // Request one state at a time through the same TSE queue/cache as interactive queries.
      for(const uf of ufs) {
        try {
          const mappedOffice=uf==='df'&&office===7?8:office;
          const result=await this.client.get(uf,mappedOffice);
          entry.scopes.set(uf,{uf,office:mappedOffice,candidates:highestPercentage(result),source:result.source,
            sourceTime:result.sourceTime,stale:result.stale,...(result.warning?{warning:result.warning}:{})});
          if(result.warning)entry.errors.set(uf,result.warning);
        } catch(error) {
          const message=error instanceof Error?error.message:'Resultado estadual indisponível.';
          entry.errors.set(uf,message);
          const previous=entry.scopes.get(uf);
          if(previous)entry.scopes.set(uf,{...previous,stale:true,warning:message});
        }
        entry.completed++;
      }
    } finally {entry.loading=false;}
  }
}
