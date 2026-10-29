import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {privateArchiveReportPath} from './archive-report';
test('private reports reject Git directories even through symlinked parents',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'archive-report-test-'));
 try{
  await mkdir(path.join(temp,'repo','.git'),{recursive:true});await mkdir(path.join(temp,'repo','nested'));await symlink(path.join(temp,'repo','nested'),path.join(temp,'alias'));
  await assert.rejects(()=>privateArchiveReportPath(path.join(temp,'repo','report.json')));
  await assert.rejects(()=>privateArchiveReportPath(path.join(temp,'alias','report.json')));
  await assert.rejects(()=>privateArchiveReportPath('relative-report.json'));
  assert.equal(path.basename(await privateArchiveReportPath(path.join(temp,'report.json'))),'report.json');
 }finally{await rm(temp,{recursive:true,force:true});}
});
