import type { SqliteStore, StoredPhoto } from './store';
import type { TseClient } from './tse';
import { photoQuery } from './tse-urls';
export const PHOTO_CACHE_MS=24*60*60*1000;
export class PhotoClient {
  private pending=new Map<string,Promise<StoredPhoto>>();
  constructor(private store:SqliteStore,private tse:Pick<TseClient,'requestOfficial'>,private clock=()=>Date.now()) {}
  async get(election:string,uf:string,id:string):Promise<StoredPhoto> {
    const query=photoQuery(election,uf,id);
    if(!this.store.knownPhoto(query.key))return {body:null,status:404,retryAt:this.clock()+PHOTO_CACHE_MS,etag:null};
    const cached=this.store.photo(query.key);
    if(cached&&this.clock()<cached.retryAt)return cached;
    const ongoing=this.pending.get(query.key);if(ongoing)return ongoing;
    const fetchPhoto=async()=>{
      try {
        const response=await this.tse.requestOfficial(query.source,'image/jpeg');
        if(!response.ok) {
          const retry=response.status===404?PHOTO_CACHE_MS:60_000;
          if(cached?.body)return this.store.savePhoto(query.key,cached.body,200,this.clock()+retry);
          return this.store.savePhoto(query.key,null,response.status===404?404:503,this.clock()+retry);
        }
        if(!/^image\/(jpeg|jpg)(;|$)/i.test(response.headers.get('content-type')??'')||Number(response.headers.get('content-length')??0)>1_000_000)throw new Error('Foto inválida.');
        const body=new Uint8Array(await response.arrayBuffer());
        if(body.length>1_000_000||body.length<4||body[0]!==0xff||body[1]!==0xd8)throw new Error('Foto inválida.');
        return this.store.savePhoto(query.key,body,200,this.clock()+PHOTO_CACHE_MS);
      } catch {
        if(cached?.body)return this.store.savePhoto(query.key,cached.body,200,this.clock()+60_000);
        return this.store.savePhoto(query.key,null,503,this.clock()+60_000);
      } finally {this.pending.delete(query.key);}
    };
    const promise=fetchPhoto();this.pending.set(query.key,promise);return promise;
  }
}
