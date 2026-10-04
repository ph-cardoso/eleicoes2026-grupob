import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Overview, Result, Snapshot } from '../src/types';
import { photoQuery } from './tse-urls';

export type Payload=Result|Overview;
export interface StoredEntry {value?:Payload;nextFetch:number;error?:string;}
export interface StoredPhoto {body:Uint8Array|null;status:number;retryAt:number;etag:string|null;}
export class SqliteStore {
  private db:DatabaseSync;
  private backupPending:Promise<void>|null=null;
  constructor(readonly path:string) {
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path,{timeout:10_000});
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      PRAGMA foreign_keys=ON;
      PRAGMA trusted_schema=OFF;
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS snapshots(
        key TEXT NOT NULL,generation TEXT NOT NULL,source_time TEXT,
        first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL,
        value_json TEXT NOT NULL,raw_json TEXT NOT NULL,
        PRIMARY KEY(key,generation)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS snapshots_by_time ON snapshots(key,source_time DESC,first_seen DESC);
      CREATE TABLE IF NOT EXISTS latest(
        key TEXT PRIMARY KEY,value_json TEXT,generation TEXT,next_fetch INTEGER NOT NULL,error TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS candidate_photos(
        key TEXT PRIMARY KEY,source TEXT NOT NULL,
        body BLOB,status INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,etag TEXT
      ) STRICT;
      PRAGMA user_version=1;
    `);
    this.db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)').run('database_id',randomUUID());
  }
  setting(key:string):string|undefined {
    return this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value as string|undefined;
  }
  setSetting(key:string,value:string) {
    this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);
  }
  load(key:string):StoredEntry|undefined {
    const row=this.db.prepare('SELECT value_json,next_fetch,error FROM latest WHERE key=?').get(key);
    if(!row)return undefined;
    return {value:row.value_json?JSON.parse(String(row.value_json)):undefined,nextFetch:Number(row.next_fetch),...(row.error?{error:String(row.error)}:{})};
  }
  saveSuccess(key:string,value:Payload,raw:unknown,nextFetch:number):StoredEntry {
    const json=JSON.stringify(value),rawJson=JSON.stringify(raw);
    const generation=createHash('sha256').update(rawJson).digest('hex');
    const observed=Date.parse(value.fetchedAt);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous=this.load(key);
      this.db.prepare(`INSERT INTO snapshots(key,generation,source_time,first_seen,last_seen,value_json,raw_json)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(key,generation) DO UPDATE SET last_seen=excluded.last_seen`)
        .run(key,generation,value.sourceTime,observed,observed,json,rawJson);
      if(previous?.value?.sourceTime&&value.sourceTime&&Date.parse(value.sourceTime)<Date.parse(previous.value.sourceTime)) {
        const error='O TSE retornou uma geração anterior. Preservamos a atualização oficial mais recente.';
        this.db.prepare('UPDATE latest SET next_fetch=?,error=? WHERE key=?').run(nextFetch,error,key);
        this.db.exec('COMMIT');return {...previous,nextFetch,error};
      }
      this.db.prepare(`INSERT INTO latest(key,value_json,generation,next_fetch,error) VALUES(?,?,?,?,NULL)
        ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,generation=excluded.generation,next_fetch=excluded.next_fetch,error=NULL`)
        .run(key,json,generation,nextFetch);
      if('candidates' in value) {
        const insert=this.db.prepare('INSERT OR IGNORE INTO candidate_photos(key,source) VALUES(?,?)');
        for(const candidate of value.candidates) {
          if(!candidate.photoUrl)continue;
          const photo=photoQuery(value.election,value.election==='6257'?'br':value.uf,candidate.id);
          insert.run(photo.key,photo.source);
        }
      }
      this.db.exec('COMMIT');return {value,nextFetch};
    } catch(error) {this.db.exec('ROLLBACK');throw error;}
  }
  saveFailure(key:string,error:string,nextFetch:number) {
    this.db.prepare(`INSERT INTO latest(key,next_fetch,error) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET next_fetch=excluded.next_fetch,error=excluded.error`).run(key,nextFetch,error);
  }
  history(key:string):Snapshot[] {
    const rows=this.db.prepare(`SELECT source_time,value_json FROM (
      SELECT source_time,value_json,ROW_NUMBER() OVER(PARTITION BY source_time ORDER BY first_seen DESC,generation DESC) AS rn
      FROM snapshots WHERE key=? AND source_time IS NOT NULL
    ) WHERE rn=1 ORDER BY source_time DESC LIMIT 24`).all(key);
    return rows.map(row=>{const value=JSON.parse(String(row.value_json)) as Result;
      return {key,at:String(row.source_time),percent:value.sections.percent,counted:value.sections.counted};}).reverse();
  }
  knownPhoto(key:string):boolean {
    return !!this.db.prepare('SELECT key FROM candidate_photos WHERE key=?').get(key);
  }
  photo(key:string):StoredPhoto|undefined {
    const row=this.db.prepare('SELECT body,status,retry_at,etag FROM candidate_photos WHERE key=? AND status!=0').get(key);
    return row?{body:row.body as Uint8Array|null,status:Number(row.status),retryAt:Number(row.retry_at),etag:row.etag as string|null}:undefined;
  }
  savePhoto(key:string,body:Uint8Array|null,status:number,retryAt:number) {
    const etag=body?`"${createHash('sha256').update(body).digest('hex')}"`:null;
    this.db.prepare('UPDATE candidate_photos SET body=?,status=?,retry_at=?,etag=? WHERE key=?').run(body,status,retryAt,etag,key);
    return {body,status,retryAt,etag};
  }
  stats() {
    return {databaseId:this.setting('database_id'),snapshots:Number(this.db.prepare('SELECT COUNT(*) AS count FROM snapshots').get()!.count),
      photos:Number(this.db.prepare('SELECT COUNT(*) AS count FROM candidate_photos WHERE status=200').get()!.count)};
  }
  backup():Promise<void> {
    if(this.backupPending)return this.backupPending;
    if(this.path===':memory:')return Promise.resolve();
    const directory=join(dirname(this.path),'backups');mkdirSync(directory,{recursive:true,mode:0o700});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const target=join(directory,`tse-${stamp}.sqlite`),temporary=`${target}.tmp`;
    const task=async()=>{
      await backup(this.db,temporary);renameSync(temporary,target);
      const files=readdirSync(directory).filter(file=>/^tse-.*\.sqlite$/.test(file)).sort();
      for(const file of files.slice(0,-4))unlinkSync(join(directory,file));
    };
    this.backupPending=task().finally(()=>{this.backupPending=null;});return this.backupPending;
  }
  close() {this.db.close();}
}
