import fs from 'node:fs/promises';
import {viewerPolicy} from './viewer-policy.mjs';
import {embedFeatures} from './build-worker-assets.mjs';
const path=new URL('../viewer.html',import.meta.url),html=await fs.readFile(path,'utf8');
await fs.writeFile(path,viewerPolicy(embedFeatures(html)));
console.log('Viewer content policy synchronized (1 inline script, 1 static Artifact bootstrap).');
