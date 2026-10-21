import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBenchmarkReports} from '../scripts/benchmark-reports.mjs';
import {median} from '../scripts/benchmark-utils.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const fixture=()=>({readme:JSON.parse(read('docs/benchmarks/readme-performance.json')),workers:JSON.parse(read('docs/benchmarks/worker-pipelines.json')),analytics:JSON.parse(read('docs/benchmarks/analytics-performance.json')),zh:read('README.md'),en:read('README.en.md'),workerDoc:read('docs/worker-pipelines.md'),analyticsDoc:read('docs/benchmarks/analytics-performance.md')});

test('published benchmark samples, medians, provenance and documentation agree',()=>{
  assert.deepEqual(validateBenchmarkReports(fixture()),[]);
});

test('empty or partially removed README scenarios fail closed',()=>{
  for(const change of [data=>{data.readme.results=[];},data=>{data.readme.results.pop();}]){
    const data=fixture();change(data);assert.ok(validateBenchmarkReports(data).length);
  }
});

test('missing samples, changed metric keys and stale medians are detected',()=>{
  for(const change of [data=>data.workers.samples.before.pop(),data=>{delete data.workers.samples.after[0].openMs;},data=>{data.analytics.medians.after.first++;},data=>{data.readme.results[0].median.searchMs++;}]){
    const data=fixture();change(data);assert.ok(validateBenchmarkReports(data).length);
  }
});

test('documentation and environment provenance cannot drift from historical observations',()=>{
  for(const change of [data=>{data.workers.baseline='short';},data=>{data.workerDoc=data.workerDoc.replace('15,900 messages','15,901 messages');},data=>{data.analyticsDoc=data.analyticsDoc.replace('| After 1 | 206.9','| After 1 | 999');},data=>{data.en=data.en.replace('Playwright `1.62.0`','Playwright `9.9.9`');},data=>{data.readme.playwrightVersionSource='unknown';}]){
    const data=fixture();change(data);assert.ok(validateBenchmarkReports(data).length);
  }
});

test('incomplete report structure returns actionable failures without throwing',()=>{
  for(const change of [data=>{data.workers.fixture=null;},data=>{data.workers.samples.before=[];},data=>{delete data.workers.samples.before[0].mounted;},data=>{data.analytics.samples=null;},data=>{data.readme.results={};},data=>{data.workers=null;}]){
    const data=fixture();change(data);assert.ok(validateBenchmarkReports(data).length);
  }
});

test('analytics retains unrounded even-sample medians including fractional tenths',()=>{
  const data=fixture(),report=data.analytics;report.runs=2;
  for(const side of ['before','after']){
    report.samples[side]=report.samples[side].slice(0,2);
    for(const row of report.samples[side])row.nextPage=row===report.samples[side][0]?0.2:0.3;
    report.medians[side]=Object.fromEntries(Object.keys(report.samples[side][0]).map(key=>[key,median(report.samples[side].map(row=>row[key]))]));
  }
  const metrics=['first','filtered','firstDrill','nextPage','listIds'];
  data.analyticsDoc=[report.baseline,report.browser,report.node,'--runs=2',report.cpuThrottle+'×'];
  for(const [side,label]of [['before','Before'],['after','After']]){
    report.samples[side].forEach((row,i)=>data.analyticsDoc.push('| '+label+' '+(i+1)+' | '+metrics.map(key=>row[key]).join(' | ')+' |'));
    data.analyticsDoc.push('| '+label+' median | '+metrics.map(key=>report.medians[side][key]).join(' | ')+' |');
  }
  data.analyticsDoc=data.analyticsDoc.join('\n');assert.equal(report.medians.after.nextPage,0.25);assert.deepEqual(validateBenchmarkReports(data),[]);
  report.medians.after.nextPage=0.3;assert.ok(validateBenchmarkReports(data).some(message=>message.includes('stale median nextPage')));
});

test('README evidence requires all metrics and unique sequential run identifiers',()=>{
  for(const change of [data=>{for(const row of data.readme.results[0].samples)delete row.heapMiB;delete data.readme.results[0].median.heapMiB;},data=>{delete data.readme.results[0].samples[0].hits;},data=>{data.readme.results[0].samples[1].run=1;},data=>{data.readme.results[0].samples[0].run=0;}]){
    const data=fixture();change(data);assert.ok(validateBenchmarkReports(data).length);
  }
});
