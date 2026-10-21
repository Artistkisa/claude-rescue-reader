import {createHash} from 'node:crypto';

// This is deliberately a strict extractor for the single-file viewer, not a
// general HTML/JavaScript parser. Fail the build if its source structure changes.
export function viewerPolicySources(html){
  const openings=[...html.matchAll(/<script(?=[\t\n\f\r />])/gi)];
  const closings=[...html.matchAll(/<\/script(?=[\t\n\f\r />])/gi)];
  const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  if(openings.length!==1||closings.length!==1||blocks.length!==1)throw new Error('Viewer policy requires exactly one plain inline script block');
  const main=blocks[0][1].replace(/\r\n?/g,'\n');
  // A literal closing script tag terminates HTML even inside a JS comment or
  // string. Parsing the extracted body also catches prematurely truncated code.
  try{new Function(main);}catch(error){throw new Error('Viewer policy script syntax: '+error.message);}
  const declarations=[...main.matchAll(/\bconst\s+artifactBootstrap\s*=/g)];
  const bootstrap=[...main.matchAll(/^const artifactBootstrap=String\.raw`\n([\s\S]*?)^`;/gm)];
  if(declarations.length!==1||bootstrap.length!==1)throw new Error('Viewer policy requires exactly one static Artifact bootstrap');
  // Keep the raw template literal static and unambiguous. Supporting nested or
  // escaped backticks/substitutions would require a JavaScript parser.
  const raw='\n'+bootstrap[0][1];
  if(/`|\$\{/.test(raw))throw new Error('Artifact bootstrap must not contain backticks or template substitutions');
  if([...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g)].length!==1)throw new Error('Viewer policy requires exactly one CSP meta tag');
  return [main,raw];
}

export function viewerPolicy(html,{offline=false}={}){
  const scripts=viewerPolicySources(html).map(source=>"'sha256-"+createHash('sha256').update(source).digest('base64')+"'");
  const hosts=offline?"'self'":"https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com";
  // Opaque blob/srcdoc Artifact frames inherit this policy in addition to their
  // own restrictive CSP. Their local-script runner uses blob URLs; removing
  // script-src blob: here blocks those scripts even if the child permits them.
  // worker-src/frame-src do not grant permission to execute scripts in frames.
  const policy="default-src 'none'; script-src "+scripts.join(' ')+" "+hosts+" blob:; script-src-attr 'none'; style-src 'unsafe-inline' "+hosts+"; img-src blob: data:; font-src data:; connect-src blob:; worker-src blob:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,(_,before,after)=>before+policy+after);
}
