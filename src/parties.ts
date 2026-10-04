export type PoliticalGroup = 'right' | 'left' | 'center' | 'unknown';
export const politicalColors={right:'#397ddd',left:'#d85057',center:'#808995',unknown:'#26292f'};
export const politicalLabels={right:'Direita',left:'Esquerda',center:'Centro',unknown:'Sem classificação'};
// Reference classification, not an ideological field published by TSE.
// Silva (2026), table 5 (2021 reference); supplementary parties: Bolognesi et al. (2023).
export const classificationSource='https://scielo.br/j/ea/a/tZ9W76RrnJx5rH6nTtMRNZz/?lang=pt';
const groups:Record<string,PoliticalGroup>={
  PT:'left',PCDOB:'left',PDT:'left',PSB:'left',PSOL:'left',REDE:'left',PCB:'left',PCO:'left',PSTU:'left',
  CIDADANIA:'center',CID:'center',MDB:'center',PSD:'center',PSDB:'center',SOLIDARIEDADE:'center',SD:'center',
  PL:'right',NOVO:'right',PODE:'right',PODEMOS:'right',PP:'right',PROGRESSISTAS:'right',REPUBLICANOS:'right',REP:'right',REPUBLIC:'right',
  UNIAO:'right',DEM:'right',PSL:'right',PTB:'right',PSC:'right',AVANTE:'right',DC:'right',
};
export function partyGroup(party:string):PoliticalGroup {
  return groups[party.normalize('NFD').replace(/[\u0300-\u036f\s]/g,'').toUpperCase()]??'unknown';
}
