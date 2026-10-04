import type { Overview } from './types';
export const states:Record<string,string>={br:'Brasil',ac:'Acre',al:'Alagoas',ap:'Amapá',am:'Amazonas',ba:'Bahia',ce:'Ceará',df:'Distrito Federal',es:'Espírito Santo',go:'Goiás',ma:'Maranhão',mt:'Mato Grosso',ms:'Mato Grosso do Sul',mg:'Minas Gerais',pa:'Pará',pb:'Paraíba',pr:'Paraná',pe:'Pernambuco',pi:'Piauí',rj:'Rio de Janeiro',rn:'Rio Grande do Norte',rs:'Rio Grande do Sul',ro:'Rondônia',rr:'Roraima',sc:'Santa Catarina',sp:'São Paulo',se:'Sergipe',to:'Tocantins',zz:'Exterior'};
export const offices:Record<number,string>={1:'Presidente',3:'Governador',5:'Senador',6:'Deputado federal',7:'Deputado estadual',8:'Deputado distrital'};
export const regions=[{name:'Norte',ufs:['ac','am','ap','pa','ro','rr','to']},{name:'Nordeste',ufs:['al','ba','ce','ma','pb','pe','pi','rn','se']},{name:'Centro-Oeste',ufs:['df','go','ms','mt']},{name:'Sudeste',ufs:['es','mg','rj','sp']},{name:'Sul',ufs:['pr','rs','sc']}];
export const integer=new Intl.NumberFormat('pt-BR');
const decimal=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
export const pct=(value:number|null|undefined)=>value==null?'—':`${decimal.format(value)}%`;
export const time=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
export function validFilters(uf:string,office:number) {
  uf=states[uf]?uf:'br';
  if(!offices[office] || (['br','zz'].includes(uf)&&office!==1))office=1;
  if(uf==='df'&&office===7)office=8;
  if(uf!=='df'&&office===8)office=7;
  return {uf,office};
}
export function regionProgress(overview:Overview|null) {
  return regions.map(region=>{
    const rows=region.ufs.map(uf=>overview?.scopes.find(s=>s.uf===uf));
    const complete=rows.every(Boolean);
    const total=rows.reduce((n,s)=>n+(s?.total??0),0),counted=rows.reduce((n,s)=>n+(s?.counted??0),0);
    const pending=complete&&rows.every(s=>s?.pendingVoters!==null)?rows.reduce((n,s)=>n+(s?.pendingVoters??0),0):null;
    return {...region,total,counted,percent:complete&&total>0?counted/total*100:null,pending};
  });
}
