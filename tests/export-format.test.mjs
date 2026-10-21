import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const context=vm.createContext({URL});vm.runInContext(fs.readFileSync('src/export-format.js','utf8'),context);const core=vm.runInContext('exportFormatCore()',context);
test('bounded SHA-256 fallback matches standard vectors across block boundaries',()=>{
  for(const text of ['', 'abc', '中文🙂', 'x'.repeat(63),'x'.repeat(64),'x'.repeat(10000)])assert.equal(Buffer.from(core.sha256(Buffer.from(text))).toString('hex'),createHash('sha256').update(text).digest('hex'));
});
test('manifest validates official navigation targets and never interprets instructions',()=>{
  const file={filename:'conversations-000.zip',category:'conversations',batch_index:0,part:0,export_url:'https://claude.ai/export/synthetic/download/example'};
  assert.equal(core.manifest({version:'1.0',total_files:1,instructions:'ignored',data_files:[file]}).files[0].url,file.export_url);
  for(const url of ['https://claude.ai.evil.test/export/x/download/y','https://user@claude.ai/export/x/download/y','https://claude.ai:444/export/x/download/y','https://claude.ai/export/x/download/y?redirect=https://example.com','javascript:alert(1)','https://claude.ai/export/x/download/%2f%2fevil.test'])assert.equal(core.downloadUrl(url),'');
  assert.throws(()=>core.manifest({version:'2.0',data_files:[]}));assert.throws(()=>core.manifest({version:'1.0',total_files:2,data_files:[file,file]}));
});
test('memory keeps Unicode metadata, raw source, logical project scope and malformed headers',()=>{
  const raw='---\nname: "中文主题"\nsources: [chat]\naliases: ["a,b", 中文]\n---\n完整正文';
  const topic=core.memory('/projects/synthetic-project/areas/topic.md',raw,'2026-01-01','synthetic');assert.equal(topic.name,'中文主题');assert.equal(topic.projectKey,'synthetic-project');assert.equal(topic.fields.aliases[0],'a,b');assert.equal(topic.raw,raw);assert.equal(topic.body,'完整正文');
  const malformed='---\nname: !execute dangerous\n---\nbody';assert.equal(core.frontmatter(malformed).body,malformed);assert.equal(core.frontmatter(malformed).warning,true);
  assert.throws(()=>core.memory('../escape.md','body'));assert.equal(core.memory('areas/plain.md','no header').body,'no header');
});
