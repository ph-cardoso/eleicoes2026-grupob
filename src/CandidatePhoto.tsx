import { useEffect, useState } from 'react';
import type { Candidate } from './types';
export function CandidatePhoto({candidate}:{candidate:Candidate}) {
  const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  useEffect(()=>{setFailed(false);setLoaded(false);},[candidate.photoUrl]);
  return <span className="candidate-avatar"><span className="candidate-number">{candidate.number}</span>
    {candidate.photoUrl&&!failed&&<img src={candidate.photoUrl} alt={`Foto de ${candidate.name}, publicada pelo TSE`} loading="lazy" decoding="async" width={48} height={48} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>}
    {loaded&&!failed&&<span className="photo-ballot-number">{candidate.number}</span>}
  </span>;
}
