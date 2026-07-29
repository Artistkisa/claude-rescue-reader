import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist','offline');
const vendor=path.join(out,'vendor');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(vendor,{recursive:true});

let viewer=await fs.readFile(path.join(root,'viewer.html'),'utf8');
const replacements=new Map([
  ["['https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js','https://unpkg.com/marked@15.0.12/marked.min.js']","['vendor/marked.umd.js']"],
  ["['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://unpkg.com/jszip@3.10.1/dist/jszip.min.js']","['vendor/jszip.min.js']"],
  ["['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js','https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js']","['vendor/highlight.min.js']"],
  ["['https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js','https://unpkg.com/mermaid@11.16.0/dist/mermaid.min.js']","['vendor/mermaid.min.js']"],
  ["link.href='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/'+(dark?'github-dark':'github')+'.min.css'","link.href='vendor/'+(dark?'github-dark':'github')+'.min.css'"]
]);
for(const [from,to] of replacements){if(!viewer.includes(from))throw new Error(`Offline replacement target missing: ${from}`);viewer=viewer.replace(from,to);}
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
await fs.writeFile(path.join(out,'README.txt'),`Claude Rescue Reader Offline Bundle\n\nOpen viewer.html directly. Keep the vendor folder beside it.\n直接打开 viewer.html，并保持 vendor 文件夹与它位于同一目录。\n\nAll analysis stays in your browser. Artifact pages may still reference their own unavailable external resources.\n所有分析都在浏览器本地完成；历史 Artifact 自己引用的外部资源仍可能不可用。\n`);
await fs.writeFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),`Bundled browser dependencies:\n- marked 15.0.12 (MIT)\n- JSZip 3.10.1 (MIT/GPLv3)\n- highlight.js CDN assets 11.11.1 (BSD-3-Clause)\n- Mermaid 11.16.0 (MIT)\n\nSee each package in node_modules for its complete license text.\n`);
console.log(`Offline bundle built at ${out}`);
