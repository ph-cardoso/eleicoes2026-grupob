import { test } from 'node:test';
import assert from 'node:assert/strict';
import president from '../tests/fixtures/tse-president.json' with { type:'json' };
import { normalize, queryFor, UF_CODES } from './tse';
import { PartyMapClient, PARTY_MAP_REFRESH_MS } from './party-map';
import { candidatesByPercentage, highestPercentage } from '../src/domain';
import { partyGroup, politicalColors } from '../src/parties';

const result=normalize(president,'br',1);
const candidate=result.candidates[0];
const idle=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function finish(client:PartyMapClient,office:number) {
  for(let i=0;i<100&&client.get(office).loading;i++)await idle();
  const value=client.get(office);assert.equal(value.loading,false);return value;
}
test('percentages sort numerically descending; rounded ties use votes and absent percentages come last',()=>{
  const input=[{...candidate,id:'low',percent:2,votes:200},{...candidate,id:'missing',percent:null,votes:30000},
    {...candidate,id:'ten',percent:10,votes:100},{...candidate,id:'tie',percent:10,votes:101}];
  assert.deepEqual(candidatesByPercentage(input).map(c=>c.id),['tie','ten','low','missing']);
  assert.equal(input[0].id,'low');
  assert.deepEqual(highestPercentage({...result,candidates:input}).map(c=>c.id),['tie']);
  assert.equal(highestPercentage({...result,released:false}).length,0);
  assert.equal(highestPercentage({...result,candidates:[{...candidate,percent:0,votes:0}]}).length,0);
  const tied=[{...candidate,id:'a',percent:50,votes:50},{...candidate,id:'b',percent:50,votes:50}];
  assert.equal(highestPercentage({...result,candidates:tied}).length,2);
});
test('party colors distinguish source classification, unknown parties and accented abbreviations',()=>{
  assert.equal(partyGroup('PL'),'right');assert.equal(partyGroup('PT'),'left');assert.equal(partyGroup('PSD'),'center');
  assert.equal(partyGroup('UNIÃO'),'right');assert.equal(partyGroup('PC do B'),'left');
  assert.equal(partyGroup('new unknown party'),'unknown');
  assert.equal(new Set(Object.values(politicalColors)).size,4);
});
test('eight visitors share a progressive state batch; exterior is included and no BR votes are aggregated',async()=>{
  let calls=0;let unblock!:()=>void;
  const gate=new Promise<void>(resolve=>{unblock=resolve;});
  const client=new PartyMapClient({get:async(uf,office)=>{calls++;await gate;return {...result,uf,office,source:queryFor(uf,office).source};}});
  const snapshots=Array.from({length:8},()=>client.get(1));
  assert.equal(calls,1);assert.ok(snapshots.every(s=>s.loading&&s.scopes.length===0));
  unblock();const map=await finish(client,1);
  assert.equal(map.total,28);assert.equal(map.completed,28);assert.equal(calls,28);
  assert.equal(map.scopes.filter(s=>UF_CODES.includes(s.uf)).length,27);
  assert.ok(map.scopes.some(s=>s.uf==='zz'));assert.ok(!map.scopes.some(s=>s.uf==='br'));
  for(const scope of map.scopes)assert.equal(scope.candidates[0].percent,candidate.percent);
  client.get(1);assert.equal(calls,28);
});
test('state legislature map adapts DF to district cargo; district map fetches only DF',async()=>{
  const calls:[string,number][]=[];
  const client=new PartyMapClient({get:async(uf,office)=>{calls.push([uf,office]);queryFor(uf,office);return {...result,uf,office};}});
  const state=await finish(client,7);assert.equal(state.scopes.length,27);assert.ok(calls.some(([uf,office])=>uf==='df'&&office===8));
  calls.length=0;const district=await finish(client,8);assert.deepEqual(calls,[['df',8]]);assert.equal(district.total,1);
  assert.throws(()=>client.get(99));
});
test('a restarted party map immediately serves stored scopes while its new query is pending',async()=>{
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const client=new PartyMapClient({cached:(uf,office)=>({...result,uf,office,stale:true}),
    get:async(uf,office)=>{await pending;return {...result,uf,office,stale:false};}});
  const restored=client.get(1);
  assert.equal(restored.loading,true);assert.equal(restored.scopes.length,28);
  assert.ok(restored.scopes.every(scope=>scope.stale));
  assert.ok(restored.scopes.some(scope=>scope.uf==='zz'));
  release();const refreshed=await finish(client,1);
  assert.ok(refreshed.scopes.every(scope=>!scope.stale));
});
test('failed map refresh preserves a stale state, reports failure, and respects its refresh cooldown',async()=>{
  let now=Date.now(),fail=false,calls=0;
  const client=new PartyMapClient({get:async(uf,office)=>{calls++;if(fail)throw new Error('HTTP 503');return {...result,uf,office};}},()=>now);
  await finish(client,8);fail=true;now+=PARTY_MAP_REFRESH_MS+1;
  const next=await finish(client,8);assert.equal(next.scopes[0].stale,true);assert.equal(next.errors[0].message,'HTTP 503');
  assert.equal(next.scopes[0].candidates[0].percent,candidate.percent);client.get(8);assert.equal(calls,2);
});
