import { test, expect } from '@playwright/test';
import president from './fixtures/tse-president.json' with { type: 'json' };
import governor from './fixtures/tse-governor.json' with { type: 'json' };
import overview from './fixtures/tse-overview.json' with { type: 'json' };
import { normalize, normalizeOverview } from '../server/tse';

test.beforeEach(async({page})=>{
  await page.route('**/api/overview?**',async route=>{
    const election=new URL(route.request().url()).searchParams.get('election')??'6257';
    await route.fulfill({json:{...normalizeOverview({...overview,ele:election},election),sourceTime:new Date().toISOString()}});
  });
  await page.route('**/api/results?**',async route=>{
    const url=new URL(route.request().url());const uf=url.searchParams.get('uf')??'br';const office=Number(url.searchParams.get('office')??1);
    const value=office===1?normalize(president,'br',1):normalize(governor,'sp',3);
    await route.fulfill({json:{...value,uf,office,sourceTime:new Date().toISOString(),fetchedAt:new Date().toISOString()}});
  });
});
test('dark mode, interactive map, state search, map zoom, exterior and invalid shared link',async({page},testInfo)=>{
  await page.goto('/?uf=invalid&office=3');
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('br');
  await expect(page.getByLabel('Cargo',{exact:true})).toHaveValue('1');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
  await expect(page.getByRole('button',{name:'Selecionar São Paulo no mapa',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Selecionar São Paulo no mapa',exact:true}).click();
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('sp');
  await expect(page.getByRole('button',{name:'Selecionar São Paulo no mapa',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Selecionar Distrito Federal no mapa',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('df');
  await page.getByLabel('Cargo',{exact:true}).selectOption('8');
  await page.getByRole('button',{name:'Selecionar São Paulo no mapa',exact:true}).click();
  await expect(page.getByLabel('Cargo',{exact:true})).toHaveValue('7');
  const svg=page.getByRole('group',{name:'Mapa interativo dos estados do Brasil'});
  const original=await svg.getAttribute('viewBox');
  await page.getByRole('button',{name:'Aproximar mapa',exact:true}).click();
  await expect(svg).not.toHaveAttribute('viewBox',original!);
  await page.getByRole('button',{name:'Afastar mapa',exact:true}).click();
  await expect(svg).toHaveAttribute('viewBox',original!);
  await page.getByRole('button',{name:'Estados',exact:true}).click();
  await page.getByLabel('Buscar estado',{exact:true}).fill('ceara');
  await expect(page.getByRole('button',{name:'Ver Ceará',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver Ceará',exact:true}).click();
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('ce');
  await page.getByLabel('Cargo',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Exterior',exact:true}).click();
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('zz');
  await page.getByRole('button',{name:'Mapa',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:`test-results/${testInfo.project.name}-dark-map.png`,fullPage:true});
});
test('observed history deduplicates source generations and sharing preserves filters',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__shared=text;}}});
  });
  let generation=0;
  await page.route('**/api/results?**',async route=>{
    const value=normalize(president,'br',1);
    await route.fulfill({json:{...value,sourceTime:new Date(Date.now()+generation*60_000).toISOString(),sections:{...value.sections,percent:36.6+generation}}});
  });
  await page.goto('/');
  await expect(page.getByText('Primeira consulta registrada.',{exact:true})).toBeVisible();
  generation++;
  await page.getByRole('button',{name:'Atualizar agora',exact:true}).click();
  await expect(page.getByRole('img',{name:'Histórico observado de urnas apuradas'})).toBeVisible();
  await page.getByRole('button',{name:'Compartilhar visão',exact:true}).click();
  await expect(page.getByText('Link copiado!',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__shared)).toMatch(/uf=br&office=1/);
});
test('fullscreen opens and exits without losing the selected state',async({page})=>{
  await page.goto('/?uf=sp&office=3');
  await page.getByRole('button',{name:'Tela cheia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sair da tela cheia',exact:true})).toBeVisible();
  await expect(page.getByLabel('Localidade',{exact:true})).toHaveValue('sp');
  await page.getByRole('button',{name:'Sair da tela cheia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Tela cheia',exact:true})).toBeVisible();
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
