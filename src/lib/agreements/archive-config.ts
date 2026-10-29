import {createHash} from 'node:crypto';
import type {ArchivePolicy} from './archive-policy';
export interface ArchiveConfig extends ArchivePolicy {secret:string;version:string}
export function archiveConfig(env:Record<string,string|undefined>=process.env):ArchiveConfig {
 const protectedIds=(env.AGREEMENT_ARCHIVE_PROTECTED_IDS??'').split(',').map(s=>s.trim()).filter(Boolean).sort();
 const before=new Date(env.AGREEMENT_ARCHIVE_BEFORE??'');
 const secret=env.AGREEMENT_ARCHIVE_PREVIEW_SECRET??'';
 const ready=env.AGREEMENT_ARCHIVE_ENABLED==='true'&&protectedIds.length>0&&Number.isFinite(before.getTime())&&secret.length>=32;
 const version=createHash('sha256').update(JSON.stringify({enabled:env.AGREEMENT_ARCHIVE_ENABLED,protectedIds,before:Number.isFinite(before.getTime())?before.toISOString():null})).digest('hex');
 return {protectedIds,before,secret,ready,version};
}
