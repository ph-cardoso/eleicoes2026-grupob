import { useState } from 'react';
import { ArrowLeft, Globe2, Layers, Map, MapPin, Minus, Plus } from 'lucide-react';
import { brazilShapes } from './brazil-shapes';
import { highestPercentage, integer, offices, pct, states, time } from './domain';
import { classificationSource, partyGroup, politicalColors, politicalLabels } from './parties';
import type { Overview, PartyMap, PartyScope, Result } from './types';

const callouts:Record<string,{x:number,y:number}>={rn:{x:651,y:150},pb:{x:651,y:187},pe:{x:651,y:224},al:{x:651,y:261},se:{x:651,y:298},es:{x:651,y:357},rj:{x:651,y:397},df:{x:253,y:323}};
const shades=['#243c38','#30594e','#3c7b67','#5ca587','#9ad9b5'];
export function mapColor(percent:number|null|undefined) {return percent==null?'#26292f':shades[Math.min(4,Math.floor(Math.max(0,percent)/25))];}
interface Props {
  overview:Overview|null; loading:boolean; error:string; selected:string; office:number; onSelect:(uf:string)=>void;
  partyMap:PartyMap|null; partyError:string; result:Result|null;
}
export function BrazilMap({overview,loading,error,selected,office,onSelect,partyMap,partyError,result}:Props) {
  const [view,setView]=useState<'map'|'states'>('map'),[metric,setMetric]=useState<'party'|'progress'>('party');
  const [preview,setPreview]=useState<string|null>(null),[zoom,setZoom]=useState(1),[search,setSearch]=useState('');
  const scopes=overview?.scopes??[];
  const location=preview??selected;
  const inspected=scopes.find(s=>s.uf===location);
  const standing=(uf:string):PartyScope|undefined=>{
    const value=partyMap?.office===office?partyMap.scopes.find(s=>s.uf===uf):undefined;
    if(result?.uf===uf&&result.office===(uf==='df'&&office===7?8:office)&&(!value||Date.parse(result.sourceTime??'')>=Date.parse(value.sourceTime??''))) {
      return {...result,candidates:highestPercentage(result)};
    }
    return value;
  };
  const partyStanding=standing(location);
  const color=(uf:string)=>{
    if(metric==='progress')return mapColor(scopes.find(s=>s.uf===uf)?.percent);
    const candidates=standing(uf)?.candidates??[];
    if(!candidates.length)return '#26292f';
    if(candidates.length>1)return 'url(#map-tie)';
    const group=partyGroup(candidates[0].party);
    return group==='unknown'?'url(#map-unknown)':politicalColors[group];
  };
  const description=(uf:string)=>{
    const candidates=standing(uf)?.candidates??[];
    return metric==='progress'?`${pct(scopes.find(s=>s.uf===uf)?.percent)} de urnas apuradas`:candidates.length?
      candidates.map(c=>`${c.party} · ${c.name} · ${pct(c.percent)} · ${politicalLabels[partyGroup(c.party)]}`).join('; '):office===8&&uf!=='df'?'Cargo disponível apenas no DF':'Aguardando resultado oficial';
  };
  const selectedShape=brazilShapes.find(s=>s.uf===selected);
  const width=720/zoom,height=590/zoom;
  const cx=zoom>1?(selectedShape?.x??320):360,cy=zoom>1?(selectedShape?.y??285):295;
  const bx=Math.max(0,Math.min(720-width,cx-width/2)),by=Math.max(0,Math.min(590-height,cy-height/2));
  const keyAction=(event:React.KeyboardEvent,uf:string)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(uf);}};
  const label=(uf:string)=>`Selecionar ${states[uf]} no mapa`;
  return <section className="map-panel panel" aria-label="Mapa da apuração">
    <div className="panel-heading"><div><p className="eyebrow">PANORAMA DO BRASIL</p><h2>Um país. 27 unidades.</h2></div><Map size={19} className="muted"/></div>
    <div className="map-toolbar"><div className="segmented" aria-label="Visualização do panorama"><button className={view==='map'?'active':''} aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={14}/>Mapa</button><button className={view==='states'?'active':''} aria-pressed={view==='states'} onClick={()=>setView('states')}><Layers size={14}/>Estados</button></div><span className="map-subtitle">{offices[office]}</span></div>
    <div className="map-metric segmented" aria-label="Cores do mapa"><button className={metric==='party'?'active':''} aria-pressed={metric==='party'} onClick={()=>setMetric('party')}>Partidos</button><button className={metric==='progress'?'active':''} aria-pressed={metric==='progress'} onClick={()=>setMetric('progress')}>Urnas apuradas</button></div>
    <div className="map-context"><button className="text-button" disabled={selected==='br'} onClick={()=>onSelect('br')}><ArrowLeft size={13}/>Brasil</button><span className="muted">/</span><span>{selected==='br'?'Visão nacional':states[selected]}</span><button className={`exterior-button ${selected==='zz'?'active':''}`} title="Exterior · eleição para Presidente" onClick={()=>onSelect('zz')}><Globe2 size={13}/>Exterior</button></div>
    {view==='map'?<div className="map-canvas">
      <svg className="brazil-map" viewBox={`${bx} ${by} ${width} ${height}`} aria-label="Mapa interativo dos estados do Brasil" role="group">
        <defs>
          <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#3c4240" opacity=".5"/></pattern>
          <pattern id="map-unknown" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#343d46"/><path d="M0 8L8 0" stroke="#b5bbc3" strokeWidth="2"/></pattern>
          <pattern id="map-tie" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#6f6033"/><path d="M0 8L8 0" stroke="#e5c773" strokeWidth="2"/></pattern>
        </defs><rect width="720" height="590" fill="url(#map-grid)"/>
        {brazilShapes.map(shape=>{const small=!!callouts[shape.uf];return <g key={shape.uf}><path d={shape.path} data-testid={`state-${shape.uf}`} fill={color(shape.uf)} className={`state-shape ${selected===shape.uf?'selected':''}`} stroke={selected===shape.uf?'#eefcd3':'#0e1215'} strokeWidth={selected===shape.uf?2.4:1.15} vectorEffect="non-scaling-stroke" role={small?undefined:'button'} aria-label={small?undefined:label(shape.uf)} aria-pressed={small?undefined:selected===shape.uf} tabIndex={small?undefined:0} onClick={()=>onSelect(shape.uf)} onKeyDown={e=>keyAction(e,shape.uf)} onMouseEnter={()=>setPreview(shape.uf)} onMouseLeave={()=>setPreview(null)} onFocus={()=>setPreview(shape.uf)} onBlur={()=>setPreview(null)}><title>{states[shape.uf]} · {description(shape.uf)}</title></path>{!small&&<text x={shape.x} y={shape.y} className="state-label" textAnchor="middle" pointerEvents="none">{shape.uf.toUpperCase()}</text>}</g>;})}
        {Object.entries(callouts).map(([uf,point])=>{const shape=brazilShapes.find(s=>s.uf===uf)!;return <g key={uf} role="button" aria-label={label(uf)} aria-pressed={selected===uf} tabIndex={0} className={`state-callout ${selected===uf?'selected':''}`} onClick={()=>onSelect(uf)} onKeyDown={e=>keyAction(e,uf)} onMouseEnter={()=>setPreview(uf)} onMouseLeave={()=>setPreview(null)} onFocus={()=>setPreview(uf)} onBlur={()=>setPreview(null)}><title>{states[uf]} · {description(uf)}</title><line x1={shape.x} y1={shape.y} x2={point.x-30} y2={point.y} stroke="#75837b" strokeWidth=".8"/><rect x={point.x-29} y={point.y-13} width="58" height="26" rx="6" fill={color(uf)} stroke={selected===uf?'#eefcd3':'#5a7068'} strokeWidth="1"/><text x={point.x} y={point.y+4} textAnchor="middle" className="state-label">{uf.toUpperCase()}</text></g>;})}
      </svg><div className="zoom-controls"><button aria-label="Aproximar mapa" disabled={zoom>=2.5} onClick={()=>setZoom(Math.min(2.5,zoom+.5))}><Plus size={17}/></button><button aria-label="Afastar mapa" disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}><Minus size={17}/></button></div>
    </div>:<div className="states-view"><label className="search-field"><MapPin size={16}/><input aria-label="Buscar estado" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busque um estado ou sigla"/></label><div className="states-grid">{brazilShapes.filter(shape=>`${shape.uf} ${states[shape.uf]}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).sort((a,b)=>states[a.uf].localeCompare(states[b.uf],'pt-BR')).map(shape=><button key={shape.uf} aria-label={`Ver ${states[shape.uf]}`} title={description(shape.uf)} className={selected===shape.uf?'selected':''} onClick={()=>onSelect(shape.uf)}><span className={`state-dot ${metric==='party'&&standing(shape.uf)?.candidates.length?standing(shape.uf)!.candidates.length>1?'tie-swatch':partyGroup(standing(shape.uf)!.candidates[0].party)==='unknown'?'unclassified-swatch':'':''}`} style={{backgroundColor:metric==='progress'?color(shape.uf):politicalColors[partyGroup(standing(shape.uf)?.candidates[0]?.party??'')]}}/><span>{shape.uf.toUpperCase()}</span><span className="mono">{metric==='progress'?pct(scopes.find(s=>s.uf===shape.uf)?.percent):standing(shape.uf)?.candidates.map(c=>c.party).join('/')||'—'}</span></button>)}</div></div>}
    <div className="map-inspector" aria-live="polite"><div><p className="eyebrow">{preview?'ESTADO NO MAPA':'LOCALIDADE SELECIONADA'}</p><p className="map-location">{states[location]}</p></div><div className="text-right"><p className="small muted">Urnas apuradas</p><p className="mono map-percent">{pct(inspected?.percent)}</p><p className="small muted">{inspected?`${integer.format(inspected.counted)} de ${integer.format(inspected.total)} seções`:'Aguardando dados do mapa'}</p></div></div>
    {metric==='party'&&<div className="party-inspector" data-testid="party-inspector"><p className="eyebrow">MAIOR PERCENTUAL PUBLICADO · {offices[partyStanding?.office??office]}</p>{partyStanding?.candidates.length?partyStanding.candidates.map(candidate=><div className="party-candidate" key={candidate.id}><span className={`party-swatch ${partyGroup(candidate.party)==='unknown'?'unclassified-swatch':''}`} style={{backgroundColor:politicalColors[partyGroup(candidate.party)]}}/><div><b>{candidate.party} · {candidate.name}</b><p>{politicalLabels[partyGroup(candidate.party)]}{partyStanding.candidates.length>1?' · empate em votos':''}</p></div><strong className="mono">{pct(candidate.percent)}</strong></div>):<p className="small muted">{partyStanding?'Nenhuma votação divulgada para este recorte.':'Aguardando resultado oficial desta localidade.'}</p>}{partyStanding&&<a href={partyStanding.source} target="_blank" rel="noopener noreferrer" className="party-source">Arquivo TSE · {time(partyStanding.sourceTime)} · Brasília{partyStanding.stale?' · última consulta disponível':''}</a>}</div>}
    {metric==='progress'?<div className="map-legend"><span className="small muted">0%</span><div className="legend-scale">{shades.map(shade=><span key={shade} style={{background:shade}}/>)}</div><span className="small muted">100%</span><span className="legend-empty"><i/>Sem dados</span></div>:<div className="party-legend" aria-label="Legenda de partidos">{(['right','left','center'] as const).map(group=><span key={group}><i style={{background:politicalColors[group]}}/>{politicalLabels[group]}</span>)}<span><i className="unclassified-swatch"/>Sem classificação</span><span><i className="tie-swatch"/>Empate</span><span><i style={{background:'#26292f'}}/>Sem dados</span></div>}
    <p className="map-help">{metric==='party'?'Cor do partido da candidatura com maior percentual neste cargo e estado. Toque para conferir os dados; a cor não indica eleição confirmada.':'Toque em um estado para abrir seus resultados. As cores representam o avanço das urnas.'}</p>
    {metric==='party'&&<details className="classification-guide"><summary>Critério das cores</summary><p>Azul: direita e centro-direita. Vermelho: esquerda e centro-esquerda. Cinza: centro. Classificação de referência de estudos de ciência política, independente dos dados de votação do TSE; não descreve todas as posições de uma candidatura ou coligação.</p><p>Base principal: estudo publicado em 2026, com referência a 2021; partidos adicionais usam estudo de 2023. Siglas sem classificação confirmada recebem hachuras.</p><a href={classificationSource} target="_blank" rel="noopener noreferrer">Fonte principal · tabela 5</a><a href="https://www.scielo.br/j/dados/a/zzyM3gzHD4P45WWdytXjZWg/?lang=pt" target="_blank" rel="noopener noreferrer">Fonte complementar</a></details>}
    <div className="map-footnote"><a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noopener noreferrer">Malha: IBGE</a><span>{metric==='party'?partyMap?`${partyMap.loading?'Carregando':'TSE'}: ${partyMap.completed}/${partyMap.total} localidades`:'Carregando resultados estaduais…':loading?'Atualizando mapa…':overview?`TSE: ${time(overview.sourceTime)}`:'Mapa sem dados oficiais'}</span></div>
    {Boolean(metric==='party'?(partyError||partyMap?.errors.length):error||overview?.stale)&&<p className="map-warning" role="status">{metric==='party'?partyError||`${partyMap?.errors.length} localidade(s) com consulta indisponível. A cor usa a última consulta quando disponível.`:error||overview?.warning||'O mapa mostra a última consulta disponível.'}</p>}
  </section>;
}
