import { test } from 'node:test';
import assert from 'node:assert/strict';
import president from '../tests/fixtures/tse-president.json' with { type: 'json' };
import governor from '../tests/fixtures/tse-governor.json' with { type: 'json' };
import overview from '../tests/fixtures/tse-overview.json' with { type: 'json' };
import exterior from '../tests/fixtures/tse-exterior.json' with { type: 'json' };
import { CACHE_MS, normalize, normalizeOverview, numeric, queryFor, TseClient } from './tse';
import { regionProgress } from '../src/domain';

test('real TSE fixtures: source percentages, totalized sections, nested parties and timestamps',()=>{
  const value=normalize(president,'br',1);
  assert.equal(value.sections.percent,36.6);
  assert.equal(value.sections.counted,182745);
  assert.notEqual(value.sections.percent,numeric(president.s.psa));
  assert.equal(value.candidates[0].name,'FLAVIO BOLSONARO');
  assert.equal(value.candidates[0].percent,50.63);
  assert.equal(value.candidates[0].party,'PL');
  assert.equal(value.sourceTime,'2026-10-04T21:37:14.000Z');
  assert.equal(normalize(governor,'sp',3).votes.valid,Number(governor.v.vv));
});
test('runoff flag is not treated as election; unreleased votes and simulated results are rejected or hidden',()=>{
  const raw=structuredClone(president);
  raw.carg[0].agr[0].par[0].cand[0].e='s';
  raw.carg[0].agr[0].par[0].cand[0].st='2º turno';
  assert.equal(normalize(raw,'br',1).candidates[0].status,'2º turno');
  raw.dv='n';assert.deepEqual(normalize(raw,'br',1).candidates,[]);
  raw.f='s';assert.throws(()=>normalize(raw,'br',1));
});
test('query allowlist blocks arbitrary targets and mismatched cargos',()=>{
  assert.match(queryFor('sp',5).source,/sp-c0005-e006259-u.json$/);
  for(const [uf,cargo] of [['br',3],['df',7],['sp',8],['http://evil',1],['sp',99]] as const) assert.throws(()=>queryFor(uf,cargo));
  assert.equal(numeric('30,567'),30.567);assert.equal(numeric(undefined),null);
});
test('EA14 covers all states in one response and region percentages use weighted section counts',()=>{
  const value=normalizeOverview(overview,'6257');
  assert.equal(value.scopes.length,29);
  assert.equal(value.scopes.find(s=>s.uf==='df')?.percent,97.68);
  const regions=regionProgress(value);
  const north=regions.find(r=>r.name==='Norte')!;
  const northScopes=value.scopes.filter(s=>north.ufs.includes(s.uf));
  assert.equal(north.percent,northScopes.reduce((n,s)=>n+s.counted,0)/northScopes.reduce((n,s)=>n+s.total,0)*100);
  assert.equal(regionProgress({...value,scopes:value.scopes.filter(s=>s.uf!=='ac')})[0].percent,null);
  assert.throws(()=>normalizeOverview({...overview,f:'s'},'6257'));
  assert.throws(()=>normalizeOverview(overview,'9999'));
  assert.throws(()=>queryFor('zz',3));
  assert.match(queryFor('zz',1).source,/zz-c0001-e006257-u.json$/);
});
test('Brazil section totals include the 27 UFs and exterior exactly once',()=>{
  const value=normalizeOverview(overview,'6257');
  const brazil=value.scopes.find(s=>s.uf==='br')!;
  const abroad=value.scopes.find(s=>s.uf==='zz')!;
  const domestic=value.scopes.filter(s=>!['br','zz'].includes(s.uf));
  assert.equal(domestic.length,27);
  assert.ok(abroad.total>0);
  for(const field of ['total','counted','registered'] as const) {
    assert.equal(brazil[field],domestic.reduce((sum,s)=>sum+(s[field]??0),0)+(abroad[field]??0));
  }
  const regions=regionProgress(value);
  assert.equal(regions.reduce((sum,r)=>sum+r.total,0)+abroad.total,brazil.total);
});
test('national votes and percentages stay official when the exterior is queried separately',async()=>{
  const calls:string[]=[];
  const client=new TseClient((async(url)=>{
    calls.push(String(url));
    return Response.json(String(url).includes('/zz/')?exterior:president);
  }) as typeof fetch);
  const brazil=await client.get('br',1);
  const abroad=await client.get('zz',1);
  assert.equal(abroad.votes.total,Number(exterior.v.tv));
  assert.equal(abroad.sections.total,Number(exterior.s.ts));
  const after=await client.get('br',1);
  assert.deepEqual(after,brazil);
  assert.equal(after.votes.total,Number(president.v.tv));
  assert.equal(after.sections.total,Number(president.s.ts));
  const official=president.carg[0].agr.flatMap(group=>group.par.flatMap(party=>party.cand));
  assert.deepEqual(after.candidates.map(c=>[c.votes,c.percent]),official.map(c=>[Number(c.vap),numeric(c.pvap)]));
  assert.equal(calls.length,2);
});
test('EA14 and EA20 use one shared queue and map requests from eight people are deduplicated',async()=>{
  let calls=0,active=0,maxActive=0;
  const client=new TseClient((async(url)=>{
    calls++;active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,10));active--;
    return Response.json(String(url).endsWith('-ab.json')?overview:president);
  }) as typeof fetch);
  await Promise.all([...Array.from({length:8},()=>client.getOverview('6257')),client.get('br',1)]);
  assert.equal(calls,2);assert.equal(maxActive,1);
});
test('eight viewers share one upstream query; successful responses remain available after a failure',async()=>{
  let calls=0,now=Date.now();
  const request=(async()=>{calls++;return calls===1?Response.json(president):new Response('unavailable',{status:503});}) as typeof fetch;
  const client=new TseClient(request,()=>now);
  const values=await Promise.all(Array.from({length:8},()=>client.get('br',1)));
  assert.equal(calls,1);assert.ok(values.every(v=>v.sections.percent===36.6));
  await client.get('br',1);assert.equal(calls,1);
  now+=CACHE_MS+1;const stale=await client.get('br',1);assert.equal(calls,2);assert.equal(stale.stale,true);assert.equal(stale.candidates[0].votes,values[0].candidates[0].votes);
});
test('15-second refreshes from eight viewers reuse the cache until the 30-second expiry',async()=>{
  let now=Date.now(),calls=0;
  const client=new TseClient((async()=>{calls++;return Response.json(president);}) as typeof fetch,()=>now);
  const initial=await client.get('br',1);assert.equal(CACHE_MS,30_000);
  now+=15_000;
  const cached=await Promise.all(Array.from({length:8},()=>client.get('br',1)));
  assert.equal(calls,1);assert.ok(cached.every(value=>value.fetchedAt===initial.fetchedAt));
  now+=14_999;await client.get('br',1);assert.equal(calls,1);
  now+=1;
  const updated=await Promise.all(Array.from({length:8},()=>client.get('br',1)));
  assert.equal(calls,2);assert.ok(updated.every(value=>value.fetchedAt===updated[0].fetchedAt));
  assert.notEqual(updated[0].fetchedAt,initial.fetchedAt);
});
test('404 cooldown and global ten-minute block prevent repeated upstream failures',async()=>{
  let now=Date.now(),calls=0;
  const client=new TseClient((async()=>{calls++;return new Response('',{status:404});}) as typeof fetch,()=>now);
  await assert.rejects(client.get('br',1));now+=61_000;await assert.rejects(client.get('br',1));assert.equal(calls,1);
  const blocked=new TseClient((async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'900'}});}) as typeof fetch,()=>now);
  await assert.rejects(blocked.get('br',1));now+=620_000;await assert.rejects(blocked.get('sp',3));assert.equal(calls,2);
});
