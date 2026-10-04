import { test, expect } from '@playwright/test';
import president from './fixtures/tse-president.json' with { type: 'json' };
import governor from './fixtures/tse-governor.json' with { type: 'json' };
import { normalize } from '../server/tse';

test.beforeEach(async({page})=>{
  await page.route('**/api/results?**',async route=>{
    const url=new URL(route.request().url());const uf=url.searchParams.get('uf')??'br';const office=Number(url.searchParams.get('office')??1);
    const value=office===1?normalize(president,'br',1):normalize(governor,'sp',3);
    await route.fulfill({json:{...value,uf,office,sourceTime:new Date().toISOString(),fetchedAt:new Date().toISOString()}});
  });
});
test('mobile and desktop: readable results, correct values, filter transitions and no horizontal overflow',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByTestId('progress')).toHaveText('36,60%');
  await expect(page.getByRole('heading',{name:'FLAVIO BOLSONARO',exact:true})).toBeVisible();
  await expect(page.getByText('50,63%',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:`test-results/${testInfo.project.name}-president.png`,fullPage:true});
  await page.getByLabel('Localidade',{exact:true}).selectOption('sp');
  await page.getByLabel('Cargo',{exact:true}).selectOption('3');
  await expect(page.getByRole('heading',{name:'Governador',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/uf=sp&office=3/);
  await page.getByLabel('Cargo',{exact:true}).selectOption('5');
  await expect(page.getByText('Senado: duas vagas')).toBeVisible();
  await page.getByLabel('Localidade',{exact:true}).selectOption('df');
  await page.getByLabel('Cargo',{exact:true}).selectOption('8');
  await expect(page.getByLabel('Buscar candidato')).toBeVisible();
  await page.getByLabel('Buscar candidato').fill('zz-not-a-candidate');
  await expect(page.getByText('Nenhum candidato encontrado.')).toBeVisible();
  await page.getByRole('button',{name:'Limpar busca'}).click();
  await page.getByLabel('Localidade',{exact:true}).selectOption('br');
  await expect(page.getByLabel('Cargo',{exact:true})).toHaveValue('1');
  await page.getByText('Como ler os números',{exact:true}).click();
  await expect(page.getByRole('link',{name:'Arquivo oficial'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Conferir no site do TSE'})).toHaveAttribute('href',/eleicao\/6257\/uf\/br\/cargo\/1/);
  expect(errors).toEqual([]);
});
test('small screen, loading, errors, stale values and offline behavior remain honest',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/');await expect(page.getByTestId('progress')).toHaveText('36,60%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.route('**/api/results?**',route=>route.fulfill({status:503,json:{error:'Dados do TSE temporariamente indisponíveis (HTTP 503).'}}));
  await page.getByRole('button',{name:'Atualizar agora'}).click();
  await expect(page.getByRole('status')).toContainText('HTTP 503');
  await expect(page.getByTestId('progress')).toHaveText('36,60%');
  await page.reload();await expect(page.getByText('Aguardando dados oficiais',{exact:true})).toBeVisible();
  await expect(page.getByTestId('progress')).toHaveText('—');
  await page.context().setOffline(true);await expect(page.getByText('Sem conexão',{exact:true})).toBeVisible();
});
test('hidden tab stops scheduled polling and automatic refresh works',async({page})=>{
  let requests=0;page.on('request',r=>{if(r.url().includes('/api/results'))requests++;});
  await page.clock.install();await page.goto('/');await expect(page.getByTestId('progress')).toHaveText('36,60%');
  const before=requests;await page.clock.fastForward(61_000);await expect.poll(()=>requests).toBeGreaterThan(before);
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
  const hiddenCount=requests;await page.clock.fastForward(61_000);expect(requests).toBe(hiddenCount);
});
