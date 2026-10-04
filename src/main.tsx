import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Check, CheckCheck, ChevronDown, CircleHelp, Clock3, ExternalLink, Globe2, MapPin, Maximize2, Minimize2, Moon, Radio, RefreshCw, Search, Share2, ShieldCheck, Vote, WifiOff, X } from 'lucide-react';
import type { Result } from './types';
import { BrazilMap } from './BrazilMap';
import { History } from './History';
import { integer, offices, pct, regionProgress, states, time, validFilters } from './domain';
import { useHistory, useOverview, usePoll } from './useResults';
import './style.css';

function initialFilters() {
  const params=new URLSearchParams(location.search);
  return validFilters((params.get('uf')??'br').toLowerCase(),Number(params.get('office')??'1'));
}
function App() {
  const [filters,setFilters]=useState(initialFilters);
  const result=usePoll<Result>(`/api/results?uf=${filters.uf}&office=${filters.office}`);
  const panorama=useOverview(filters.office);
  const {data,error,loading}=result;
  const history=useHistory(data);
  const [offline,setOffline]=useState(!navigator.onLine),[tick,setTick]=useState(Date.now());
  const [search,setSearch]=useState(''),[limit,setLimit]=useState(20);
  const [shareMessage,setShareMessage]=useState(''),[shareFallback,setShareFallback]=useState(false),[expanded,setExpanded]=useState(false);
  const shareTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    const params=new URLSearchParams({uf:filters.uf,office:String(filters.office)});
    window.history.replaceState(null,'',`?${params}`);setSearch('');setLimit(20);
  },[filters]);
  useEffect(()=>{
    const timer=setInterval(()=>setTick(Date.now()),1000);
    const online=()=>setOffline(!navigator.onLine);
    const full=()=>setExpanded(!!document.fullscreenElement);
    window.addEventListener('online',online);window.addEventListener('offline',online);document.addEventListener('fullscreenchange',full);
    return()=>{clearInterval(timer);if(shareTimer.current)clearTimeout(shareTimer.current);window.removeEventListener('online',online);window.removeEventListener('offline',online);document.removeEventListener('fullscreenchange',full);};
  },[]);
  const chooseState=(uf:string)=>setFilters(validFilters(uf,filters.office));
  const share=async()=>{
    setShareMessage('');const url=location.href;
    try {
      if(navigator.share)await navigator.share({title:'Apuração 2026 · Grupo B',url});
      else {await navigator.clipboard.writeText(url);setShareMessage('Link copiado!');}
    } catch(e) {if(!(e instanceof Error&&e.name==='AbortError'))setShareFallback(true);}
    if(shareTimer.current)clearTimeout(shareTimer.current);shareTimer.current=setTimeout(()=>setShareMessage(''),4000);
  };
  const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setExpanded(!expanded);}catch{setExpanded(!expanded);}};
  const age=data?.sourceTime?(tick-Date.parse(data.sourceTime))/60_000:0;
  const old=!!data&&(data.stale||!!error||offline||age>5);
  const mapOld=!!panorama.data&&(panorama.data.stale||(panorama.data.sourceTime&&(tick-Date.parse(panorama.data.sourceTime))/60_000>5));
  const progress=data?.sections.percent??0;
  const query=search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const candidates=data?.candidates.filter(c=>`${c.name} ${c.party} ${c.number}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))??[];
  const next=data?Math.min(60,Math.max(0,60-Math.floor((tick-Date.parse(data.fetchedAt))/1000))):60;
  const proportional=[6,7,8].includes(filters.office);
  const broad=['br','zz'].includes(filters.uf);
  const availableOffices=Object.entries(offices).filter(([id])=>broad?id==='1':filters.uf==='df'?id!=='7':id!=='8');
  const tabs=[1,3,5,6,filters.uf==='df'?8:7];
  const officialUrl=`https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/${filters.office===1?'6257':'6259'}/uf/${filters.uf}/cargo/${filters.office}/vis/nominal/resultados`;
  const regional=regionProgress(panorama.data);
  return <div className={`app-shell ${expanded?'expanded':''}`}>
    <header className="site-header"><div className="header-inner"><a href="/" className="brand" aria-label="Apuração 2026, início"><span className="brand-icon"><Vote size={22}/></span><span>apuração <b>2026</b><small>GRUPO B</small></span></a><div className="header-status"><span className={`live-dot ${old?'warning':''}`}/><span>{offline?'Sem conexão':loading?'Consultando TSE':old?'Últimos dados disponíveis':data?.final?'Totalização finalizada':'Atualização automática'}</span><span className="header-time mono">{time(data?.sourceTime)}</span></div><div className="header-actions"><span className="dark-label"><Moon size={15}/>Modo escuro</span><button className="icon-button" aria-label="Compartilhar visão" title="Compartilhar visão" onClick={()=>void share()}><Share2 size={17}/></button><button className="icon-button" aria-label={expanded?'Sair da tela cheia':'Tela cheia'} title="Tela cheia" onClick={()=>void fullscreen()}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button></div></div></header>
    <main className="dashboard">
      <div className="page-toolbar"><div className="page-identity"><p className="eyebrow">4 DE OUTUBRO · 1º TURNO</p><h1>Apuração Eleitoral 2026</h1></div><nav className="office-tabs" aria-label="Atalhos de cargos">{tabs.map(office=><button key={office} aria-pressed={filters.office===office} disabled={broad&&office!==1} title={broad&&office!==1?'Selecione um estado no mapa para ver este cargo':offices[office]} className={filters.office===office?'active':''} onClick={()=>setFilters({...filters,office})}>{office===6?'Dep. federal':office===7?'Dep. estadual':office===8?'Dep. distrital':offices[office]}</button>)}</nav></div>
      <section className="filters-row" aria-label="Filtros da apuração"><label className="filter-box"><MapPin size={16}/><span><span className="filter-label">Localidade</span><select aria-label="Localidade" value={filters.uf} onChange={e=>chooseState(e.target.value)}>{Object.entries(states).filter(([uf])=>filters.office===1||uf!=='zz').map(([uf,name])=><option key={uf} value={uf}>{name}{uf==='br'?' · nacional':uf==='zz'?' · votos no exterior':` · ${uf.toUpperCase()}`}</option>)}</select></span><ChevronDown size={15}/></label><label className="filter-box"><Vote size={16}/><span><span className="filter-label">Cargo</span><select aria-label="Cargo" value={filters.office} onChange={e=>setFilters({...filters,office:Number(e.target.value)})}>{availableOffices.map(([id,name])=><option key={id} value={id}>{name}{id==='5'?' · 2 vagas':''}</option>)}</select></span><ChevronDown size={15}/></label><span className="filters-tip">{broad?'Toque em um estado para acessar os demais cargos.':'O mapa e os resultados seguem sua seleção.'}</span><a href={officialUrl} target="_blank" rel="noopener noreferrer" className="source-link"><ShieldCheck size={14}/>Fonte: TSE<ArrowUpRight size={14}/></a></section>
      {(error||offline||data?.warning||old)&&<div role="status" className="notice">{offline?<WifiOff size={17}/>:<Clock3 size={17}/>}<p>{error||data?.warning||(offline?'Você está sem conexão. Mostrando a última consulta.':'O arquivo do TSE foi gerado há mais de 5 minutos. Mostrando a última atualização disponível.')} {data&&'Os números abaixo são da última consulta bem-sucedida.'}</p></div>}
      <div className="dashboard-grid">
        <section className="summary-panel panel" aria-label="Progresso da apuração"><div className="summary-context"><span>{offices[filters.office]} · {states[filters.uf]}</span><span className="partial-tag">{data?.final?'FINALIZADA':'PARCIAL'}</span></div><h2>Urnas apuradas</h2><div className="summary-percentage"><p className="mono" data-testid="progress">{data?pct(data.sections.percent):'—'}</p><span className="small muted">{data?`${integer.format(data.sections.counted)} de ${integer.format(data.sections.total)} seções`:'Aguardando os dados do TSE'}</span></div><div role="progressbar" aria-label="Urnas apuradas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data?.sections.percent??undefined} className="progress-track"><div style={{width:`${Math.min(100,progress)}%`}}/></div><div className="summary-timestamp"><span><Clock3 size={12}/>TSE: {time(data?.sourceTime)} · Brasília</span><span>{data?.final?'Concluída':data?`${pct(Math.max(0,100-progress))} pendentes`:'Aguardando dados'}</span></div><div className="summary-metrics"><div><span>Votos registrados</span><b className="mono">{data?.released?integer.format(data.votes.total):'—'}</b></div><div><span>Comparecimento</span><b className="mono">{data?pct(data.voters.turnoutPercent):'—'}</b></div><div><span>Abstenção</span><b className="mono">{data?pct(data.voters.abstentionPercent):'—'}</b></div></div></section>
        <BrazilMap overview={panorama.data} loading={panorama.loading} error={panorama.error||(mapOld?'O mapa usa a última geração disponível do TSE.':'')} selected={filters.uf} office={filters.office} onSelect={chooseState}/>
        <section className="results-panel panel" aria-label="Resultados dos candidatos"><div className="panel-heading"><div><p className="eyebrow">{states[filters.uf].toUpperCase()}</p><h2>{offices[filters.office]}</h2></div><span className="source-tag"><ShieldCheck size={12}/>TSE</span></div><label className="search-field"><Search size={15}/><input aria-label="Buscar candidato" placeholder="Nome, partido ou número" value={search} onChange={e=>{setSearch(e.target.value);setLimit(20);}}/>{search&&<button className="clear-search" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
          {!data&&loading?<div className="candidate-loading" aria-label="Carregando resultados"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div>:!data?<div className="empty-state"><Radio size={25}/><h3>Aguardando dados oficiais</h3><p>A consulta será refeita automaticamente. Você também pode abrir o TSE abaixo.</p></div>:!data.released?<div className="empty-state"><Clock3 size={25}/><h3>Divulgação ainda não liberada</h3><p>O TSE ainda não liberou os votos para este resultado.</p></div>:candidates.length===0?<p className="empty-message muted">{search?'Nenhum candidato encontrado.':'Nenhum candidato publicado pelo TSE até agora.'}</p>:<ul className="candidate-list">{candidates.slice(0,limit).map(candidate=><li key={candidate.id}><span className="candidate-number">{candidate.number}</span><div className="candidate-info"><h3>{candidate.name}</h3><p>{candidate.party} · {integer.format(candidate.votes)} votos</p><div className="candidate-status"><span>{candidate.voteStatus}</span>{candidate.status&&<span className="official-status">{candidate.status.startsWith('Eleito')&&<Check size={10}/>} {candidate.status}</span>}</div></div><p className="candidate-percent mono">{pct(candidate.percent)}</p></li>)}</ul>}
          {candidates.length>limit&&<button className="secondary-button more-candidates" onClick={()=>setLimit(limit+40)}>Mostrar mais candidatos<ChevronDown size={14}/></button>}
          <p className="candidate-footnote">Votos e percentuais reproduzidos do TSE.{filters.office===1&&!broad?' Este recorte é estadual; a eleição presidencial é decidida pelo resultado nacional.':''}{proportional?' A distribuição de vagas de deputados depende das regras proporcionais.':''}</p>
          <a className="official-link" href={officialUrl} target="_blank" rel="noopener noreferrer">Conferir no site do TSE<ArrowUpRight size={16}/></a>
        </section>
        <aside className="side-panel"><section className="panel regions-panel"><div className="panel-heading"><div><p className="eyebrow">SEÇÕES TOTALIZADAS</p><h2>Por região</h2></div><Globe2 size={17} className="muted"/></div><div className="region-list">{regional.map(region=><div className="region-item" key={region.name}><div className="region-title"><span>{region.name}</span><b className="mono">{pct(region.percent)}</b></div><div className="region-track"><span style={{width:`${region.percent??0}%`}}/></div><div className="region-details"><span>{integer.format(region.counted)} seções</span><span>{region.pending===null?'—':integer.format(region.pending)} eleitores em seções pendentes</span></div></div>)}</div><p className="region-note">Percentual ponderado pelo número de seções de cada estado; o exterior aparece separado.</p>{panorama.data?.scopes.find(s=>s.uf==='zz')&&<button className="exterior-summary" onClick={()=>chooseState('zz')}><span><Globe2 size={14}/>Exterior</span><b className="mono">{pct(panorama.data.scopes.find(s=>s.uf==='zz')?.percent)}</b></button>}</section><History history={history}/></aside>
      </div>
      <section className="bottom-panels"><div className="panel votes-panel"><div className="panel-heading"><h2>Retrato da votação</h2><span className="small muted">{states[filters.uf]}</span></div><dl className="votes-grid">{[{label:'Válidos',value:data?.votes.valid,percent:data?.votes.validPercent},{label:'Brancos',value:data?.votes.blank,percent:data?.votes.blankPercent},{label:'Nulos',value:data?.votes.null,percent:data?.votes.nullPercent}].map(row=><div key={row.label}><dt>{row.label}</dt><dd><b className="mono">{data?.released?pct(row.percent):'—'}</b><span>{data?.released?integer.format(row.value??0):'—'} votos</span></dd></div>)}</dl><p className="small muted">Percentuais deste quadro sobre os votos registrados. Votos anulados ou sub judice podem compor outras categorias. Comparecimento e abstenção consideram as seções já apuradas.</p></div><div className="panel refresh-panel"><div><h2>Sempre atualizado</h2><p className="small muted">Consulta a cada 60 segundos com a página visível.</p><span className="small muted">{data?`Consulta: ${time(data.fetchedAt)} · ${next>0?`cache por ${next}s`:'atualização em breve'}`:'Aguardando consulta ao TSE'}</span></div><button onClick={()=>{void result.refresh();void panorama.refresh();}} disabled={loading||offline} className="refresh-button"><RefreshCw size={15} className={loading?'animate-spin':''}/>{loading?'Consultando…':'Atualizar agora'}</button></div></section>
      {filters.office===5&&<section className="senate-notice"><CheckCheck size={17}/><div><h2>Senado: duas vagas</h2><p>Cada eleitor pode votar em dois candidatos. O percentual do TSE representa a participação nos votos a candidatos, não a parcela dos eleitores.</p></div></section>}
      <details className="reading-guide"><summary><span><CircleHelp size={16}/>Como ler os números</span><ChevronDown size={15}/></summary><div><p>“Urnas apuradas” usa a porcentagem de seções totalizadas do TSE. Seções e eleitores têm tamanhos diferentes; 50% das urnas não significa 50% dos votos.</p><p>O resultado é parcial até a conclusão da totalização. Os rótulos de situação são reproduzidos dos arquivos oficiais do TSE.</p><p>O mapa e os resumos regionais usam o arquivo EA14, e os votos do cargo selecionado usam o EA20. Os arquivos podem ser gerados em horários diferentes; cada painel informa sua fonte e atualização.</p><p>O histórico registra somente as gerações vistas neste dispositivo. Nenhum dado histórico é inventado. A malha geográfica é do IBGE e fica incluída no aplicativo.</p><p>Este painel independente do Grupo B consulta arquivos do domínio oficial do TSE via HTTPS e não verifica a assinatura JWS. Confira os números diretamente na fonte.</p><div className="guide-links"><a href={data?.source??officialUrl} target="_blank" rel="noopener noreferrer">Arquivo oficial<ExternalLink size={12}/></a><a href={panorama.data?.source??'https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados'} target="_blank" rel="noopener noreferrer">Dados do mapa<ExternalLink size={12}/></a><a href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noopener noreferrer">Documentação do TSE<ExternalLink size={12}/></a></div></div></details>
      <footer><span>Grupo B · Eleições 2026</span><span><ShieldCheck size={12}/>Dados oficiais. Painel independente.</span></footer>
    </main>
    {shareMessage&&<div className="toast" role="status"><Check size={15}/>{shareMessage}</div>}
    {shareFallback&&<div className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="panel"><button className="icon-button" aria-label="Fechar compartilhamento" onClick={()=>setShareFallback(false)}><X size={17}/></button><h2 id="share-title">Compartilhar esta visão</h2><p className="small muted">Copie o link com o estado e cargo selecionados.</p><input aria-label="Link desta visão" value={location.href} readOnly onFocus={e=>e.target.select()}/></div></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
