import { test } from 'node:test';
import assert from 'node:assert/strict';
import president from '../tests/fixtures/tse-president.json' with {type:'json'};
import { SqliteStore } from './store';
import { PhotoClient } from './photos';
import { normalize, TseClient } from './tse';
import { candidatePhotoUrl, photoQuery } from './tse-urls';
const jpeg=new Uint8Array([255,216,255,217]);
function known() {
  const store=new SqliteStore(':memory:'),value=normalize(president,'br',1);
  store.saveSuccess('br:1',value,president,Date.now()+30_000);return {store,id:value.candidates[0].id};
}
test('presidential photos use BR in state and exterior views; malformed targets are refused',()=>{
  assert.equal(candidatePhotoUrl('6257','zz','280002542548'),'/api/photos/6257/br/280002542548.jpeg');
  assert.equal(candidatePhotoUrl('6257','sp','280002542548'),'/api/photos/6257/br/280002542548.jpeg');
  assert.equal(candidatePhotoUrl('6259','sp','250002541303'),'/api/photos/6259/sp/250002541303.jpeg');
  assert.equal(candidatePhotoUrl('6257','br',undefined),null);
  for(const args of [['6257','sp','280002542548'],['6259','zz','280002542548'],['9999','br','280002542548'],['6257','br','../bad']] as const)assert.throws(()=>photoQuery(args[0],args[1],args[2]));
});
test('eight viewers share one photo download; bytes and ETag remain in SQLite and unknown IDs never fetch',async()=>{
  const {store,id}=known();let calls=0;
  const photos=new PhotoClient(store,{requestOfficial:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return new Response(jpeg,{headers:{'Content-Type':'image/jpeg'}});}});
  const values=await Promise.all(Array.from({length:8},()=>photos.get('6257','br',id)));
  assert.equal(calls,1);assert.ok(values.every(v=>v.status===200&&v.body?.length===4));assert.ok(values[0].etag);
  const reopened=new PhotoClient(store,{requestOfficial:async()=>{throw new Error('no network');}});
  assert.deepEqual(await reopened.get('6257','br',id),values[0]);
  assert.equal((await photos.get('6257','br','999999999999')).status,404);assert.equal(calls,1);store.close();
});
test('missing or invalid photos are negatively cached without guessing other URLs',async()=>{
  for(const response of [()=>new Response('',{status:404}),()=>new Response('<html>',{headers:{'Content-Type':'image/jpeg'}})]) {
    const {store,id}=known();let calls=0;
    const photos=new PhotoClient(store,{requestOfficial:async()=>{calls++;return response();}});
    const initial=await photos.get('6257','br',id);assert.ok([404,503].includes(initial.status));
    await photos.get('6257','br',id);assert.equal(calls,1);store.close();
  }
});
test('photo and result calls share a serial rate limiter; image 429 pauses result calls across a restart',async()=>{
  const {store,id}=known();let active=0,max=0,calls=0;
  const request=(async(url)=>{calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;
    return String(url).endsWith('.jpeg')?new Response(jpeg,{headers:{'Content-Type':'image/jpeg'}}):Response.json(president);}) as typeof fetch;
  const client=new TseClient(request),photos=new PhotoClient(store,client);
  await Promise.all([client.get('br',1),photos.get('6257','br',id)]);assert.equal(calls,2);assert.equal(max,1);
  const paused=new TseClient((async()=>new Response('',{status:429,headers:{'Retry-After':'900'}})) as typeof fetch,()=>Date.now(),store);
  // Force a different known portrait, which isn't already cached.
  const second=normalize(president,'br',1).candidates[1].id;
  await new PhotoClient(store,paused).get('6257','br',second);
  let subsequent=0;const restarted=new TseClient((async()=>{subsequent++;return Response.json(president);}) as typeof fetch,()=>Date.now(),store);
  await assert.rejects(restarted.get('sp',1));assert.equal(subsequent,0);store.close();
});
