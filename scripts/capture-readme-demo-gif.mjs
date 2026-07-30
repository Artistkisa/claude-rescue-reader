import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs','images','workflow-demo.gif');
const zipPath=path.join(root,'docs','demo','claude-rescue-reader-synthetic-demo.zip');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'claude-rescue-demo-'));
const systemChrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined;
const executablePath=process.env.CHROME_PATH||systemChrome;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:{dir:temp,size:{width:1280,height:720}}});
  const page=await context.newPage();
  await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
  await page.evaluate(()=>{
    const style=document.createElement('style');
    style.textContent=`#demo-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;border:3px solid #fff;border-radius:50%;background:#d97757;box-shadow:0 2px 8px #0008;pointer-events:none;transform:translate(-50%,-50%);transition:left .55s ease,top .55s ease,transform .16s ease}#demo-caption{position:fixed;z-index:2147483646;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 18px;border-radius:999px;background:#171717e8;color:#fff;font:600 18px/1.25 system-ui;box-shadow:0 8px 30px #0006;pointer-events:none;white-space:nowrap}#demo-file{position:fixed;z-index:2147483645;left:34px;top:126px;padding:14px 18px;border:1px solid #d6d3d1;border-radius:12px;background:#fff;color:#292524;font:600 15px system-ui;box-shadow:0 10px 35px #0003;pointer-events:none;transition:left .7s ease,top .7s ease,transform .7s ease,opacity .25s ease}`;
    document.head.append(style);
    const cursor=document.createElement('div');cursor.id='demo-cursor';cursor.style.left='62px';cursor.style.top='176px';document.body.append(cursor);
    const caption=document.createElement('div');caption.id='demo-caption';document.body.append(caption);
    const file=document.createElement('div');file.id='demo-file';file.textContent='📦 claude-rescue-reader-synthetic-demo.zip';document.body.append(file);
  });
  const caption=text=>page.evaluate(value=>{document.getElementById('demo-caption').textContent=value;},text);
  const point=async(x,y,pressed=false)=>{
    await page.evaluate(({x,y,pressed})=>{const cursor=document.getElementById('demo-cursor');cursor.style.left=x+'px';cursor.style.top=y+'px';cursor.style.transform=pressed?'translate(-50%,-50%) scale(.72)':'translate(-50%,-50%)';},{x,y,pressed});
    await pause(pressed?180:620);
    if(pressed)await page.evaluate(()=>{document.getElementById('demo-cursor').style.transform='translate(-50%,-50%)';});
  };
  const click=async locator=>{const box=await locator.boundingBox();if(!box)throw new Error('Demo target is not visible');await point(box.x+box.width/2,box.y+box.height/2,true);await locator.click();};

  await caption('1 / 5  拖入导出 ZIP · Drop the export ZIP');
  await pause(900);await point(270,168);
  await page.evaluate(()=>{const file=document.getElementById('demo-file');file.style.left='500px';file.style.top='305px';file.style.transform='scale(.94)';});
  await point(665,340);await pause(500);
  const zipBase64=(await fs.readFile(zipPath)).toString('base64');
  await page.evaluate(base64=>{
    const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    routeDroppedFiles([new File([bytes],'claude-rescue-reader-synthetic-demo.zip',{type:'application/zip'})]);
    document.getElementById('demo-file').style.opacity='0';
  },zipBase64);
  await page.waitForFunction(()=>allConvs.length===40&&allProjects.length===4,{timeout:15_000});await pause(700);

  await caption('2 / 5  打开完整对话 · Open a conversation');
  await click(page.locator('.conv-item').first());
  await page.waitForFunction(()=>currentConv&&document.querySelectorAll('.msg-wrap').length>=5);await pause(2100);

  await caption('3 / 5  检查项目证据链 · Inspect the project graph');
  await click(page.locator('.tab-btn[onclick*="projects"]'));
  await page.waitForFunction(()=>convProjectMapReady,{timeout:15_000});
  await click(page.locator('.proj-card').first());
  await page.waitForFunction(()=>document.querySelector('.project-graph'));
  await page.locator('.project-graph').scrollIntoViewIfNeeded();await pause(2800);

  await caption('4 / 5  浏览使用画像 · Explore analytics');
  await click(page.locator('.tab-btn[onclick*="analytics"]'));
  await page.waitForFunction(()=>document.querySelector('.word-cloud'),{timeout:15_000});await pause(3000);

  await caption('5 / 5  预览安全脱敏 · Preview a safe export');
  await click(page.locator('.tab-btn[onclick*="convs"]'));
  await click(page.locator('.conv-item').first());await page.waitForFunction(()=>currentConv);
  await click(page.locator('#export-btn'));await click(page.locator('#export-menu button').nth(1));
  await page.waitForSelector('#redaction-modal .redaction-dialog');await pause(2800);
  await caption('全程本地处理 · Private, offline, complete');await pause(1800);

  const video=await page.video();await context.close();const webm=await video.path();
  await fs.mkdir(path.dirname(output),{recursive:true});
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  const filter='fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle';
  const encoded=spawnSync(ffmpeg,['-y','-i',webm,'-vf',filter,'-loop','0',output],{stdio:'inherit'});
  if(encoded.status!==0)throw new Error(`FFmpeg failed with status ${encoded.status}`);
  const stat=await fs.stat(output);console.log(`README demo GIF written to ${path.relative(root,output)} (${(stat.size/1024/1024).toFixed(2)} MiB)`);
}finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
