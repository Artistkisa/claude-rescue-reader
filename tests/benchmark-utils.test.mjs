import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseRuns,median} from '../scripts/benchmark-utils.mjs';

test('run counts default to three and require positive safe integers',()=>{
  assert.equal(parseRuns(undefined),3);
  assert.equal(parseRuns('1'),1);
  assert.equal(parseRuns('2'),2);
  for(const input of ['', 'abc', '0', '-1', '1.5', 'Infinity', 'NaN', '9007199254740992', '2=3']){
    assert.throws(()=>parseRuns(input),/positive safe integer/);
  }
});

test('medians handle odd and even sample counts without mutating samples',()=>{
  const values=[7656,6350,9000,6353];
  assert.equal(median([100]),100);
  assert.equal(median([11052,15476,10967]),11052);
  assert.equal(median([100,110]),105);
  assert.equal(median([100,110,120,130]),115);
  assert.equal(median(values),7004.5);
  assert.deepEqual(values,[7656,6350,9000,6353]);
  assert.ok(Math.abs(median([0.2,0.4])-0.3)<1e-12);
  assert.throws(()=>median([]),/finite sample/);
  assert.throws(()=>median([NaN]),/finite sample/);
});

test('invalid CLI run count fails before trying to launch Chromium',()=>{
  const script=new URL('../scripts/benchmark-analytics-performance.mjs',import.meta.url);
  for(const input of ['abc','0','-1','1.5','','Infinity']){
    const result=spawnSync(process.execPath,[fileURLToPath(script),'--runs='+input],{
      encoding:'utf8',env:{...process.env,CHROME_PATH:'invalid-synthetic-browser-path'},timeout:10000
    });
    assert.ifError(result.error);
    assert.equal(result.status,1);
    assert.match(result.stderr,/Invalid --runs/);
    assert.doesNotMatch(result.stderr,/browserType.launch|TypeError|executable doesn't exist/);
  }
});
