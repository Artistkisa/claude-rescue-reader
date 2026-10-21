import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBenchmarkReports} from '../scripts/benchmark-reports.mjs';
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
