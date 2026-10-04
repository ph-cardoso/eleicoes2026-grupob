import { readFile, writeFile } from 'node:fs/promises';
import { geoMercator, geoPath, geoArea } from 'd3-geo';
// IBGE's simplified administrative mesh, retrieved once. No map network requests at runtime.
const data=JSON.parse(await readFile(process.argv[2]??'.runtime/brazil-ibge.geojson','utf8'));
const ufs={'11':'ro','12':'ac','13':'am','14':'rr','15':'pa','16':'ap','17':'to','21':'ma','22':'pi','23':'ce','24':'rn','25':'pb','26':'pe','27':'al','28':'se','29':'ba','31':'mg','32':'es','33':'rj','35':'sp','41':'pr','42':'sc','43':'rs','50':'ms','51':'mt','52':'go','53':'df'};
for(const f of data.features){if(geoArea(f)>2*Math.PI){const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon)ring.reverse();}}
const projection=geoMercator().fitExtent([[16,16],[584,568]],data);
const path=geoPath(projection).digits(1);
const shapes=data.features.map(f=>{const [x,y]=path.centroid(f);return {uf:ufs[f.properties.codarea],path:path(f),x:Math.round(x),y:Math.round(y)};});
if(shapes.length!==27||shapes.some(s=>!s.uf||!s.path))throw new Error('Unexpected IBGE geometry');
await writeFile('src/brazil-shapes.ts','// Source: IBGE simplified UF mesh. See docs/map-and-layout.md. Generated with scripts/generate-map.mjs.\nexport const brazilShapes = '+JSON.stringify(shapes)+';\n');
console.log('Generated 27 UF shapes',shapes.map(s=>({uf:s.uf,x:s.x,y:s.y})));
