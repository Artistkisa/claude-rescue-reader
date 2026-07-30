import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import {demoConversations,demoMemories,demoProjects,demoDesign} from '../tests/fixtures/synthetic-readme-demo-export.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const imageDir=path.join(root,'docs','images');
await fs.mkdir(imageDir,{recursive:true});
const systemChrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined;
const executablePath=process.env.CHROME_PATH||systemChrome;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
  await page.evaluate(payload=>{
    const files=[
      new File([JSON.stringify(payload.conversations)],'conversations.json',{type:'application/json'}),
      new File([JSON.stringify(payload.memories)],'memories.json',{type:'application/json'}),
      new File([JSON.stringify(payload.design)],'design.json',{type:'application/json'})
    ];
    for(const project of payload.projects){const file=new File([JSON.stringify(project)],project.uuid+'.json',{type:'application/json'});Object.defineProperty(file,'webkitRelativePath',{value:'claude-export/projects/'+project.uuid+'.json'});files.push(file);}
    routeDroppedFiles(files);
  },{conversations:demoConversations,memories:demoMemories,projects:demoProjects,design:demoDesign});
  await page.waitForFunction(expected=>allConvs.length===expected,demoConversations.length);
  await page.locator('.conv-item').first().click();
  await page.waitForFunction(()=>currentConv&&currentConv.name.includes('北辰咖啡')&&document.querySelectorAll('.msg-wrap').length>=5);
  await page.waitForTimeout(500);
  await page.evaluate(()=>{document.getElementById('messages').scrollTo(0,0);});
  await page.waitForTimeout(100);
  await page.screenshot({path:path.join(imageDir,'viewer-overview.png')});

  await page.setViewportSize({width:1700,height:900});
  await page.locator('#toggle-summary').click();
  await page.waitForFunction(()=>!document.getElementById('summary').classList.contains('hidden'));
  await page.locator('#summary').screenshot({path:path.join(imageDir,'conversation-summary.png')});
  await page.evaluate(()=>{if(!document.getElementById('summary').classList.contains('hidden'))toggleSummary();document.getElementById('summary').style.display='none';});

  await page.setViewportSize({width:1440,height:1600});
  await page.locator('.tab-btn[onclick*="projects"]').click();
  await page.waitForFunction(()=>convProjectMapReady);
  await page.locator('.proj-card').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.match-panel').length>=3);
  const methods=await page.evaluate(()=>[...new Set(Object.values(convProjectEvidence).map(item=>item.method))]);
  for(const method of['file','knowledge','keyword'])if(!methods.includes(method))throw new Error(`README demo is missing ${method} project evidence`);
  await page.evaluate(()=>document.getElementById('messages').scrollTo(0,0));
  await page.screenshot({path:path.join(imageDir,'project-associations.png')});

  await page.setViewportSize({width:1440,height:900});
  await page.locator('.tab-btn[onclick*="memory"]').click();
  await page.waitForFunction(()=>document.getElementById('conv-list').textContent.includes('工作背景')&&document.getElementById('conv-list').textContent.includes('北辰咖啡'));
  await page.screenshot({path:path.join(imageDir,'memory-view.png')});
  console.log(`README screenshots written to ${path.relative(root,imageDir)}`);
}finally{await browser.close();}
