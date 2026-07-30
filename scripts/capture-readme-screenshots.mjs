import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import {demoConversations,demoMemories,demoProjects,demoDesign} from '../tests/fixtures/synthetic-readme-demo-export.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs','images','viewer-overview.png');
await fs.mkdir(path.dirname(output),{recursive:true});
const executablePath=process.env.CHROME_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
  await page.evaluate(payload=>routeDroppedFiles([
    new File([JSON.stringify(payload.conversations)],'conversations.json',{type:'application/json'}),
    new File([JSON.stringify(payload.memories)],'memories.json',{type:'application/json'}),
    new File([JSON.stringify(payload.projects)],'projects.json',{type:'application/json'}),
    new File([JSON.stringify(payload.design)],'design.json',{type:'application/json'})
  ]),{conversations:demoConversations,memories:demoMemories,projects:demoProjects,design:demoDesign});
  await page.waitForFunction(()=>allConvs.length===4);
  await page.locator('.conv-item').first().click();
  await page.waitForFunction(()=>currentConv&&currentConv.name.includes('北辰咖啡')&&document.querySelectorAll('.msg-wrap').length>=5);
  await page.waitForTimeout(500);
  await page.evaluate(()=>{document.getElementById('messages').scrollTo(0,0);});
  await page.waitForTimeout(100);
  await page.screenshot({path:output});
  console.log(`README screenshot written to ${path.relative(root,output)}`);
}finally{await browser.close();}
