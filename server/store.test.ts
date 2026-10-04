import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import president from '../tests/fixtures/tse-president.json' with {type:'json'};
import overview from '../tests/fixtures/tse-overview.json' with {type:'json'};
import { SqliteStore } from './store';
import { CACHE_MS, normalize, normalizeOverview, TseClient } from './tse';

function temporary(t:TestContext) {
  const dir=mkdtempSync(join(tmpdir(),'tse-sqlite-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'tse.sqlite');
}
test('database reopen restores cache, raw official snapshots, and history without another TSE request',async t=>{
  const path=temporary(t);let now=Date.now(),calls=0;
  const request=(async()=>{calls++;return Response.json(president);}) as typeof fetch;
  let store=new SqliteStore(path);const value=await new TseClient(request,()=>now,store).get('br',1);
  const id=store.stats().databaseId;store.close();
  store=new SqliteStore(path);assert.equal(store.stats().databaseId,id);
  const restored=await new TseClient(request,()=>now,store).get('br',1);
  assert.deepEqual(restored,value);assert.equal(calls,1);assert.equal(store.history('br:1').length,1);
  const inspected=new DatabaseSync(path,{readOnly:true});
  assert.deepEqual(JSON.parse(String(inspected.prepare('SELECT raw_json FROM snapshots').get()!.raw_json)),president);
  inspected.close();
  now+=CACHE_MS+1;
  const fail=(async()=>new Response('',{status:503})) as typeof fetch;
  const stale=await new TseClient(fail,()=>now,store).get('br',1);
  assert.equal(stale.stale,true);assert.deepEqual(stale.votes,value.votes);store.close();
  store=new SqliteStore(path);let retries=0;
  const kept=await new TseClient((async()=>{retries++;throw new Error('offline');}) as typeof fetch,()=>now,store).get('br',1);
  assert.equal(retries,0);assert.equal(kept.stale,true);assert.deepEqual(kept.votes,value.votes);store.close();
});
test('repeated source generation creates one snapshot; later source creates a shared history point',t=>{
  const store=new SqliteStore(temporary(t));const start=Date.now();
  store.saveSuccess('br:1',normalize(president,'br',1,new Date(start)),president,start+CACHE_MS);
  store.saveSuccess('br:1',normalize(president,'br',1,new Date(start+30_000)),president,start+60_000);
  assert.equal(store.stats().snapshots,1);
  const raw=structuredClone(president);raw.hg='18:38:14';raw.s.st='182746';raw.s.pst='36,61';
  store.saveSuccess('br:1',normalize(raw,'br',1,new Date(start+60_000)),raw,start+90_000);
  assert.equal(store.stats().snapshots,2);assert.deepEqual(store.history('br:1').map(s=>s.percent),[36.6,36.61]);
  const old=store.saveSuccess('br:1',normalize(president,'br',1,new Date(start+90_000)),president,start+120_000);
  assert.equal(old.value?.sourceTime,'2026-10-04T21:38:14.000Z');assert.ok(old.error?.includes('geração anterior'));
  assert.equal(store.stats().snapshots,2);store.close();
});
test('EA14 cache and ten-minute TSE pause survive a process restart',async t=>{
  const path=temporary(t);let now=Date.now(),calls=0;
  let store=new SqliteStore(path);
  const client=new TseClient((async()=>{calls++;return calls===1?Response.json(overview):new Response('',{status:429,headers:{'Retry-After':'900'}});}) as typeof fetch,()=>now,store);
  await client.getOverview('6257');await assert.rejects(client.get('br',1));store.close();
  store=new SqliteStore(path);now+=60_000;
  let newCalls=0;const restarted=new TseClient((async()=>{newCalls++;throw new Error('must not fetch');}) as typeof fetch,()=>now,store);
  await assert.rejects(restarted.get('sp',3));
  const old=await restarted.getOverview('6257');assert.equal(old.stale,true);assert.equal(old.scopes.length,29);assert.equal(newCalls,0);store.close();
});
test('online backup preserves source history and candidate photo bytes in a valid standalone database',async t=>{
  const path=temporary(t),store=new SqliteStore(path),value=normalize(president,'br',1);
  store.saveSuccess('br:1',value,president,Date.now()+CACHE_MS);
  const candidate=value.candidates[0],key=`6257:br:${candidate.id}`;
  store.savePhoto(key,new Uint8Array([255,216,255,217]),200,Date.now()+86400_000);
  await store.backup();const file=readdirSync(join(path,'..','backups')).find(f=>f.endsWith('.sqlite'))!;
  const restored=new SqliteStore(join(path,'..','backups',file));
  assert.equal(restored.stats().databaseId,store.stats().databaseId);assert.equal(restored.history('br:1').length,1);assert.equal(restored.photo(key)?.body?.length,4);
  const reader=new DatabaseSync(join(path,'..','backups',file),{readOnly:true});
  assert.equal(reader.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');reader.close();restored.close();store.close();
});
