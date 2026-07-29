import {defineConfig} from '@playwright/test';
import fs from 'node:fs';

const systemChrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'';

export default defineConfig({
  testDir:'./tests',
  timeout:45_000,
  expect:{timeout:8_000},
  fullyParallel:false,
  workers:1,
  reporter:[['line'],['json',{outputFile:'test-results/results.json'}]],
  use:{headless:true,viewport:{width:1440,height:960},acceptDownloads:true,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:systemChrome&&fs.existsSync(systemChrome)?{executablePath:systemChrome}:{}},
  outputDir:'test-results/artifacts'
});
