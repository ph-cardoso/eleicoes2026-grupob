import { useCallback, useEffect, useRef, useState } from 'react';
import type { Overview, Result } from './types';
export function usePoll<T>(url:string) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const abort=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    abort.current?.abort();const controller=new AbortController();abort.current=controller;setLoading(true);
    try {
      const response=await fetch(url,{signal:controller.signal});const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??'Não foi possível consultar o TSE.');
      if(controller.signal.aborted)return;
      setData(payload);setError('');
    } catch(e) {if(!controller.signal.aborted)setError(!navigator.onLine?'Você está sem conexão. Reconecte para atualizar.':e instanceof Error?e.message:'Não foi possível atualizar.');}
    finally {if(!controller.signal.aborted)setLoading(false);}
  },[url]);
  useEffect(()=>{
    setData(null);setError('');void refresh();
    const interval=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refresh();},60_000);
    const visible=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refresh();};
    const online=()=>void refresh();
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',online);
    return()=>{clearInterval(interval);abort.current?.abort();document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',online);};
  },[refresh]);
  return {data,error,loading,refresh};
}
export interface Snapshot { key:string; at:string; percent:number|null; counted:number; }
export function useHistory(data:Result|null) {
  const [history,setHistory]=useState<Snapshot[]>(()=>{try{const values=JSON.parse(localStorage.getItem('grupob-history')??'[]');return Array.isArray(values)?values.filter(s=>typeof s.key==='string'&&typeof s.at==='string'&&Number.isFinite(Date.parse(s.at))&&typeof s.counted==='number'&&(s.percent===null||typeof s.percent==='number')).slice(-300):[];}catch{return [];}});
  useEffect(()=>{
    if(!data||data.stale||!data.sourceTime)return;
    const value:Snapshot={key:`${data.uf}:${data.office}`,at:data.sourceTime,percent:data.sections.percent,counted:data.sections.counted};
    setHistory(previous=>{
      if(previous.some(s=>s.key===value.key&&s.at===value.at))return previous;
      const next=[...previous,value].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-300);
      try{localStorage.setItem('grupob-history',JSON.stringify(next));}catch{}
      return next;
    });
  },[data]);
  return data?history.filter(s=>s.key===`${data.uf}:${data.office}`).slice(-24):[];
}
export const useOverview=(office:number)=>usePoll<Overview>(`/api/overview?election=${office===1?'6257':'6259'}`);
