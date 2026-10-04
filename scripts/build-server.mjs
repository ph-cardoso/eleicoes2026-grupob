import { build } from 'esbuild';
await build({entryPoints:['server/index.ts'],bundle:true,platform:'node',format:'esm',outfile:'dist/server.mjs'});
