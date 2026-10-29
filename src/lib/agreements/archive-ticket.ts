import {createHmac,timingSafeEqual} from 'node:crypto';
import type {ArchiveAction} from './archive-policy';
interface TicketScope {actorId:string; action:ArchiveAction; policyVersion:string}
interface TicketPayload extends TicketScope {id:string;fingerprint:string;issuedAt:number;expiresAt:number}
export function createArchiveTicket(input:TicketScope & {id:string;fingerprint:string},secret:string,now=Date.now()):string {
 if(secret.length<32) throw new Error('Archive preview signing is not configured');
 const payload=Buffer.from(JSON.stringify({...input,issuedAt:now,expiresAt:now+300000})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyArchiveTicket(ticket:string,secret:string,scope:TicketScope,now=Date.now()):TicketPayload|null {
 try {
  if(secret.length<32||ticket.length>4096)return null;
  const parts=ticket.split('.'); if(parts.length!==2)return null;
  const expected=createHmac('sha256',secret).update(parts[0]).digest();
  const actual=Buffer.from(parts[1],'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const p=JSON.parse(Buffer.from(parts[0],'base64url').toString()) as TicketPayload;
  if(p.actorId!==scope.actorId||p.action!==scope.action||p.policyVersion!==scope.policyVersion||typeof p.id!=='string'||typeof p.fingerprint!=='string'||!Number.isFinite(p.issuedAt)||!Number.isFinite(p.expiresAt)||p.expiresAt-p.issuedAt!==300000||now<p.issuedAt||now>=p.expiresAt)return null;
  return p;
 }catch{return null;}
}
