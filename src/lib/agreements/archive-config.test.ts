import assert from 'node:assert/strict';
import test from 'node:test';
import {archiveConfig} from './archive-config';
const env={AGREEMENT_ARCHIVE_ENABLED:'true',AGREEMENT_ARCHIVE_PROTECTED_IDS:'synthetic-protected',AGREEMENT_ARCHIVE_BEFORE:'2026-10-01T00:00:00Z',AGREEMENT_ARCHIVE_PREVIEW_SECRET:'synthetic-secret-with-thirty-two-characters'};
test('archive requires a complete private configuration and policy changes invalidate existing previews',()=>{
 assert.equal(archiveConfig(env).ready,true);
 for(const key of Object.keys(env))assert.equal(archiveConfig({...env,[key]:''}).ready,false,key);
 assert.equal(archiveConfig({...env,AGREEMENT_ARCHIVE_BEFORE:'invalid'}).ready,false);
 assert.notEqual(archiveConfig(env).version,archiveConfig({...env,AGREEMENT_ARCHIVE_PROTECTED_IDS:'another-synthetic'}).version);
});
