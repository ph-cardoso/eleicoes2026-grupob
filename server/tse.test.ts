import { test } from 'node:test';
import assert from 'node:assert/strict';
import president from '../tests/fixtures/tse-president.json' with { type: 'json' };
import governor from '../tests/fixtures/tse-governor.json' with { type: 'json' };
import { normalize, numeric, queryFor, TseClient } from './tse';

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
test('eight viewers share one upstream query; successful responses remain available after a failure',async()=>{
  let calls=0,now=Date.now();
  const request=(async()=>{calls++;return calls===1?Response.json(president):new Response('unavailable',{status:503});}) as typeof fetch;
  const client=new TseClient(request,()=>now);
  const values=await Promise.all(Array.from({length:8},()=>client.get('br',1)));
  assert.equal(calls,1);assert.ok(values.every(v=>v.sections.percent===36.6));
  await client.get('br',1);assert.equal(calls,1);
  now+=61_000;const stale=await client.get('br',1);assert.equal(calls,2);assert.equal(stale.stale,true);assert.equal(stale.candidates[0].votes,values[0].candidates[0].votes);
});
test('404 cooldown and global ten-minute block prevent repeated upstream failures',async()=>{
  let now=Date.now(),calls=0;
  const client=new TseClient((async()=>{calls++;return new Response('',{status:404});}) as typeof fetch,()=>now);
  await assert.rejects(client.get('br',1));now+=61_000;await assert.rejects(client.get('br',1));assert.equal(calls,1);
  const blocked=new TseClient((async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'900'}});}) as typeof fetch,()=>now);
  await assert.rejects(blocked.get('br',1));now+=620_000;await assert.rejects(blocked.get('sp',3));assert.equal(calls,2);
});
