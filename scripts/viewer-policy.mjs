import {createHash} from 'node:crypto';

export function viewerPolicy(html,{offline=false}={}){
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>"'sha256-"+createHash('sha256').update(match[1].replace(/\r\n?/g,'\n')).digest('base64')+"'");
  const bootstrap=html.match(/const artifactBootstrap=String\.raw`([\s\S]*?)`;/);
  if(bootstrap)scripts.push("'sha256-"+createHash('sha256').update(bootstrap[1].replace(/\r\n?/g,'\n')).digest('base64')+"'");
  const hosts=offline?"'self'":"https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com";
  const policy="default-src 'none'; script-src "+scripts.join(' ')+" "+hosts+" blob:; script-src-attr 'none'; style-src 'unsafe-inline' "+hosts+"; img-src blob: data:; font-src data:; connect-src blob:; worker-src blob:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,(_,before,after)=>before+policy+after);
}
