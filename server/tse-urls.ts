import { states } from '../src/domain';
export const UF_CODES=Object.keys(states).filter(uf=>!['br','zz'].includes(uf));
export const ORIGIN='https://resultados.tse.jus.br';
export function queryFor(uf:string,office:number) {
  if((!UF_CODES.includes(uf)&&!['br','zz'].includes(uf))||![1,3,5,6,7,8].includes(office)||(['br','zz'].includes(uf)&&office!==1)||(office===8&&uf!=='df')||(office===7&&uf==='df'))throw new Error('Filtro inválido.');
  const election=office===1?'6257':'6259';
  return {election,source:`${ORIGIN}/oficial/ele2026/${election}/dados/${uf}/${uf}-c${String(office).padStart(4,'0')}-e${election.padStart(6,'0')}-u.json`};
}
export function overviewQuery(election:string) {
  if(!['6257','6259'].includes(election))throw new Error('Filtro inválido.');
  return `${ORIGIN}/oficial/ele2026/${election}/dados/br/br-e${election.padStart(6,'0')}-ab.json`;
}
export function photoQuery(election:string,uf:string,id:string) {
  if(!/^\d{10,16}$/.test(id)||(election==='6257'?uf!=='br':election==='6259'?!UF_CODES.includes(uf):true))throw new Error('Filtro inválido.');
  return {key:`${election}:${uf}:${id}`,source:`${ORIGIN}/oficial/ele2026/${election}/fotos/${uf}/${id}.jpeg`,url:`/api/photos/${election}/${uf}/${id}.jpeg`};
}
export function candidatePhotoUrl(election:string,uf:string,id:unknown):string|null {
  try{return photoQuery(election,election==='6257'?'br':uf,String(id??'')).url;}catch{return null;}
}
