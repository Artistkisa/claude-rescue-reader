import fs from 'node:fs/promises';
import path from 'node:path';
import {viewerPolicy} from './viewer-policy.mjs';
import {workerNotices} from './build-worker-assets.mjs';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist','offline');
const vendor=path.join(out,'vendor');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(vendor,{recursive:true});

let viewer=await fs.readFile(path.join(root,'viewer.html'),'utf8');
const replacements=new Map([
  ["['https://cdn.jsdelivr.net/npm/marked@18.0.11/lib/marked.umd.js','https://unpkg.com/marked@18.0.11/lib/marked.umd.js']","['vendor/marked.umd.js']"],
  ["['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://unpkg.com/jszip@3.10.1/dist/jszip.min.js']","['vendor/jszip.min.js']"],
  ["['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js','https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js']","['vendor/highlight.min.js']"],
  ["['https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.min.js','https://unpkg.com/mermaid@12.2.0/dist/mermaid.min.js']","['vendor/mermaid.min.js']"],
  ["link.href='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/'+(dark?'github-dark':'github')+'.min.css'","link.href='vendor/'+(dark?'github-dark':'github')+'.min.css'"]
]);
for(const [from,to] of replacements){if(!viewer.includes(from))throw new Error(`Offline replacement target missing: ${from}`);viewer=viewer.replace(from,to);}
viewer=viewerPolicy(viewer,{offline:true});
if(/https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)/.test(viewer))throw new Error('Offline viewer still contains a runtime CDN dependency');

const copies=[
  ['node_modules/marked/lib/marked.umd.js','marked.umd.js'],
  ['node_modules/jszip/dist/jszip.min.js','jszip.min.js'],
  ['node_modules/@highlightjs/cdn-assets/highlight.min.js','highlight.min.js'],
  ['node_modules/@highlightjs/cdn-assets/styles/github.min.css','github.min.css'],
  ['node_modules/@highlightjs/cdn-assets/styles/github-dark.min.css','github-dark.min.css'],
  ['node_modules/mermaid/dist/mermaid.min.js','mermaid.min.js']
];
for(const [source,name] of copies)await fs.copyFile(path.join(root,source),path.join(vendor,name));
await fs.writeFile(path.join(out,'viewer.html'),viewer);
await fs.writeFile(path.join(out,'README.txt'),`Claude Rescue Reader Offline Bundle\n\nOpen viewer.html directly. Keep the vendor folder beside it.\n直接打开 viewer.html，并保持 vendor 文件夹与它位于同一目录。\n\nAll analysis stays in your browser. Artifact previews block network resources. The parse cache contains conversation text and persists until you clear it in the sidebar.\n所有分析都在浏览器本地完成；Artifact 预览禁止加载网络资源。解析缓存包含对话原文，会保留至您通过侧栏清除。\n`);
const versions=await Promise.all(['marked','jszip','@highlightjs/cdn-assets','mermaid'].map(async dependency=>JSON.parse(await fs.readFile(path.join(root,'node_modules',dependency,'package.json'),'utf8')).version));
await fs.writeFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),`Bundled browser dependencies:\n- marked ${versions[0]} (MIT)\n- JSZip ${versions[1]} (MIT/GPLv3)\n- highlight.js CDN assets ${versions[2]} (BSD-3-Clause)\n- Mermaid ${versions[3]} (MIT)\n\n${workerNotices()}\n\nMermaid license\n${await fs.readFile(path.join(root,'node_modules/mermaid/LICENSE'),'utf8')}\n`);
console.log(`Offline bundle built at ${out}`);
