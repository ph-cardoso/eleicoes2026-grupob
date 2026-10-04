import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { TseClient } from './tse';
import { PartyMapClient } from './party-map';

const client = new TseClient();
const partyMap=new PartyMapClient(client);
const publicDir = resolve('dist');
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Robots-Tag','noindex, nofollow, nosnippet, noimageindex');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const json = (status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(!['GET','HEAD'].includes(req.method??'')) {json(405,{error:'Método não permitido.'});return;}
  try {
    const url = new URL(req.url??'/','http://localhost');
    if(url.pathname==='/api/health'){json(200,{status:'ok'});return;}
    if(url.pathname==='/api/party-map') {
      try {
        if(url.searchParams.size>1)throw new Error('Filtro inválido.');
        json(200,partyMap.get(Number(url.searchParams.get('office')??'1')));
      } catch(e) {const error=e instanceof Error?e.message:'Mapa indisponível.';json(error==='Filtro inválido.'?400:503,{error});}
      return;
    }
    if(url.pathname==='/api/overview') {
      try {
        if(url.searchParams.size>1)throw new Error('Filtro inválido.');
        json(200,await client.getOverview(url.searchParams.get('election')??'6257'));
      } catch(e) {const error=e instanceof Error?e.message:'Mapa indisponível.';json(error==='Filtro inválido.'?400:503,{error});}
      return;
    }
    if(url.pathname==='/api/results') {
      const uf=(url.searchParams.get('uf')??'br').toLowerCase();
      const office=Number(url.searchParams.get('office')??'1');
      if(url.searchParams.size>2){json(400,{error:'Filtro inválido.'});return;}
      try { const value=await client.get(uf,office);json(200,value); } catch(e) {
        const error=e instanceof Error?e.message:'Dados indisponíveis.';
        json(error==='Filtro inválido.'?400:503,{error});
      }
      return;
    }
    if(url.pathname.startsWith('/api/')){json(404,{error:'Não encontrado.'});return;}
    // Crawlers must read the noindex response/header; Disallow would hide those instructions.
    if(url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'});res.end('# Indexing is disabled by the X-Robots-Tag header and HTML noindex directives.\nUser-agent: *\nAllow: /\n');return;}
    const path=resolve(publicDir,'.'+decodeURIComponent(url.pathname));
    if (!path.startsWith(publicDir+sep) && path!==publicDir){json(404,{error:'Não encontrado.'});return;}
    if(path.endsWith('.mjs') || (path!==publicDir && !['.html','.js','.css','.svg','.png','.woff2'].includes(extname(path)))){json(404,{error:'Não encontrado.'});return;}
    const file=path===publicDir ? resolve(publicDir,'index.html'):path;
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'});
    res.end(req.method==='HEAD'?undefined:body);
  } catch {json(404,{error:'Não encontrado.'});}
}).listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1',()=>console.log('Apuração server ready'));
