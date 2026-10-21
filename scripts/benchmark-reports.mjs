import {median} from './benchmark-utils.mjs';

// Validate published observations against their own samples, not today's tools.
export function validateBenchmarkReports({readme,workers,analytics,zh,en,workerDoc,analyticsDoc}){
  const failures=[];
  const check=(ok,message)=>{if(!ok)failures.push(message);};
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const runs=value=>Number.isSafeInteger(value)&&value>0;
  const close=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b));
  function samples(label,rows,count,medians,round=false){
    check(Array.isArray(rows)&&rows.length===count&&runs(count),label+': sample count must equal runs');
    if(!Array.isArray(rows)||!rows.length||!medians||typeof medians!=='object'){check(false,label+': samples/medians missing');return;}
    const keys=Object.keys(medians).sort();
    check(keys.length>0,label+': no metrics');
    for(const row of rows)check(row&&keys.every(key=>finite(row[key])),label+': missing/nonfinite sample metric');
    for(const key of keys){const values=rows.map(row=>row?.[key]);if(values.every(finite)){const value=median(values);check(close(medians[key],round?Math.round(value*10)/10:value),label+': stale median '+key);}}
  }
  check(Array.isArray(readme?.results)&&readme.results.length>0,'README benchmark report has no results to check');
  const sizes=new Set();
  for(const result of readme?.results||[]){
    check(Number.isSafeInteger(result.sizeMiB)&&result.sizeMiB>0&&!sizes.has(result.sizeMiB),'README benchmark has invalid/duplicate size');sizes.add(result.sizeMiB);
    check(finite(result.cpuThrottle)&&result.cpuThrottle>0,'README benchmark has invalid CPU rate');
    check(result.runs===readme.method?.runs,'README benchmark run count differs from method');
    samples('README '+result.sizeMiB,result.samples,result.runs,result.median);
  }
  // README promises these three published scenarios; a partial report cannot
  // silently disable verification for the omitted rows.
  check([50,150,300].every(size=>sizes.has(size)),'README benchmark is missing a published scenario');
  for(const text of [zh,en]){
    check(text.includes('Playwright `'+readme.playwright+'`'),'README Playwright version differs from report');
    if(readme.playwrightVersionSource==='legacy-hardcoded-unverified')check(text.includes(text===zh?'实际版本未记录':'actual version was not recorded'),'README must disclose historical version uncertainty');
  }
  check(['legacy-hardcoded-unverified','installed-package'].includes(readme.playwrightVersionSource),'README benchmark version provenance missing');
  for(const [label,report]of [['Workers',workers],['Analytics',analytics]]){
    check(/^[a-f\d]{40}$/.test(report.baseline||''),label+': baseline must be a full SHA');
    for(const side of ['before','after']){
      const rows=report.samples?.[side],metrics=report.medians?.[side];samples(label+' '+side,rows,report.runs,metrics,label==='Workers');
      if(rows?.length&&metrics)for(const row of rows)check(JSON.stringify(Object.keys(row||{}).sort())===JSON.stringify(Object.keys(metrics).sort()),label+': sample/median metric keys differ');
    }
  }
  for(const token of ['--runs='+workers.runs,workers.cpuThrottle+'×',workers.fixture.messages.toLocaleString('en-US')+' messages',workers.samples.before[0].mounted.toLocaleString('en-US')+'-message'])check(workerDoc.includes(token),'Worker documentation is stale: '+token);
  for(const token of [analytics.baseline,analytics.browser,analytics.node,'--runs='+analytics.runs,analytics.cpuThrottle+'×'])check(analyticsDoc.includes(token),'Analytics documentation is stale: '+token);
  const metrics=['first','filtered','firstDrill','nextPage','listIds'];
  for(const [side,label]of [['before','Before'],['after','After']]){
    for(const [i,row]of analytics.samples[side].entries())check(analyticsDoc.includes('| '+label+' '+(i+1)+' | '+metrics.map(key=>row[key]).join(' | ')+' |'),'Analytics table sample is stale: '+label+' '+(i+1));
    check(analyticsDoc.includes('| '+label+' median | '+metrics.map(key=>analytics.medians[side][key]).join(' | ')+' |'),'Analytics table median is stale: '+label);
  }
  return failures;
}
