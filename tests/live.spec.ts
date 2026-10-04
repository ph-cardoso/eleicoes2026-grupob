import { test, expect } from '@playwright/test';
test('real browser → app API → official TSE; all supported cargos and DF',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile','One live run; reuse server cache for eight viewers.');
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByTestId('progress')).not.toHaveText('—',{timeout:20_000});
  const responses=await Promise.all(Array.from({length:8},()=>request.get('/api/results?uf=br&office=1')));
  const values=await Promise.all(responses.map(r=>r.json()));
  expect(responses.every(r=>r.status()===200)).toBeTruthy();
  expect(new Set(values.map(v=>v.fetchedAt)).size).toBe(1);
  const value=values[0];expect(value.candidates.length).toBeGreaterThan(0);expect(value.source).toContain('resultados.tse.jus.br/oficial/ele2026/6257');expect(value.sections.percent).toBeGreaterThanOrEqual(0);expect(value.sections.percent).toBeLessThanOrEqual(100);
  const mapResponse=await request.get('/api/overview?election=6257');expect(mapResponse.status()).toBe(200);
  const map=await mapResponse.json();expect(map.scopes.filter((s:{uf:string})=>!['br','zz'].includes(s.uf)).length).toBe(27);
  await page.getByRole('button',{name:'Selecionar São Paulo no mapa',exact:true}).click();
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('sp');
  await expect(page.getByRole('heading',{name:value.candidates[0].name,exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/mobile-live.png',fullPage:true});
  for(const [uf,office] of [['sp',3],['sp',5],['sp',6],['sp',7],['df',8]] as const){
    await page.getByLabel('Localidade',{exact:true}).selectOption(uf);
    const result=page.waitForResponse(r=>r.url().includes(`/api/results?uf=${uf}&office=${office}`)&&r.status()===200);
    await page.getByLabel('Cargo',{exact:true}).selectOption(String(office));
    const data=await (await result).json();expect(data.candidates.length).toBeGreaterThan(0);
    await expect(page.getByTestId('progress')).not.toHaveText('—');
    if(office===5)await expect(page.getByText('Senado: duas vagas')).toBeVisible();
  }
  const invalid=await request.get('/api/results?uf=br&office=3');expect(invalid.status()).toBe(400);
  const sourceCode=await request.get('/server.mjs');expect(sourceCode.status()).toBe(404);
  const stateMap=await request.get('/api/overview?election=6259');expect(stateMap.status()).toBe(200);
  const mapInvalid=await request.get('/api/overview?election=9999');expect(mapInvalid.status()).toBe(400);
  await page.getByLabel('Cargo',{exact:true}).selectOption('1');
  const exterior=page.waitForResponse(r=>r.url().includes('/api/results?uf=zz&office=1')&&r.status()===200);
  await page.getByLabel('Localidade',{exact:true}).selectOption('zz');
  expect((await (await exterior).json()).uf).toBe('zz');
});
