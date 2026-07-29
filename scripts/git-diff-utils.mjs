import {execFileSync} from 'node:child_process';

export function git(args,options={}){return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options});}
export function diffRange(){
  const base=process.env.PR_BASE_SHA,head=process.env.PR_HEAD_SHA||'HEAD';
  if(base&&base!==/^0+$/.exec(base)?.[0])return `${base}...${head}`;
  try{git(['rev-parse','HEAD^']);return 'HEAD^...HEAD';}catch{return null;}
}
export function changedFiles(){const range=diffRange();return range?git(['diff','--name-status',range]).trim().split(/\r?\n/).filter(Boolean):[];}
export function addedDiff(){const range=diffRange();return range?git(['diff','--unified=0','--no-color',range]):'';}
