import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const featureSources=['worker-core','worker-runtime','task-worker','reader-worker','import-worker','feature-client'];
const dependencies={zip:['jszip','dist/jszip.min.js','3.10.1'],markdown:['marked','lib/marked.umd.js','18.0.11'],highlight:['@highlightjs/cdn-assets','highlight.min.js','11.11.1']};
export function workerNotices(){
  return [['JSZip 3.10.1 (MIT option)','jszip/LICENSE.markdown'],['Marked 18.0.11 (MIT)','marked/LICENSE'],['highlight.js 11.11.1 (BSD-3-Clause)','@highlightjs/cdn-assets/LICENSE']].map(([name,file])=>name+'\n'+fs.readFileSync(new URL('../node_modules/'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n').split('\nGPL version 3')[0].trim()).join('\n\n');
}
export function featureBundle(){
  const libraries={};
  for(const [key,[name,file,version]] of Object.entries(dependencies)){
    const root=new URL('../node_modules/'+name+'/',import.meta.url);
    const metadata=JSON.parse(fs.readFileSync(new URL('package.json',root),'utf8'));
    if(metadata.version!==version)throw new Error(`Worker dependency ${name} must be ${version}, found ${metadata.version}`);
    const bytes=fs.readFileSync(new URL(file,root));
    libraries[key]={version,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')};
  }
  return '/* Embedded dependency licenses\n'+workerNotices().replace(/\*\//g,'* /')+'\n*/\nconst WORKER_LIBRARIES='+JSON.stringify(libraries)+';\n'+featureSources.map(name=>fs.readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').trim()).join('\n\n');
}
export function embedFeatures(html){
  const section='// BEGIN GENERATED FEATURE WORKERS\n'+featureBundle()+'\n// END GENERATED FEATURE WORKERS';
  const pattern=/\/\/ BEGIN GENERATED FEATURE WORKERS[^\r\n]*\r?\n[\s\S]*?\/\/ END GENERATED FEATURE WORKERS/;
  if(pattern.test(html))return html.replace(pattern,()=>section);
  return html.replace('// ── On-demand analytics:',()=>section+'\n\n// ── On-demand analytics:');
}
