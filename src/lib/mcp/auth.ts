import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose';
import type { Viewer } from '@/lib/auth/viewer';

export const MCP_SCOPES = ['finance:read', 'clients:read', 'debtors:read'] as const;
export interface McpConfig { issuer: string; audience: string; jwksUri: string }
export interface McpPrincipal { viewer: Viewer; scopes: string[] }
export interface McpGrant {
 userId: string; issuer: string; subject: string; clientId: string; scopes: string[];
 expiresAt: Date; notBefore: Date; revokedAt: Date | null;
 user: { id: string; isOwner: boolean; role: Viewer['role']; revenueSharePct: number | null; mustChangePassword: boolean };
}
export class McpAuthError extends Error {
 constructor(readonly status: 401 | 403 = 401) { super(status === 401 ? 'Unauthorized' : 'Forbidden'); }
}
export function mcpConfig(env: NodeJS.ProcessEnv = process.env): McpConfig | null {
 if (env.MCP_ENABLED !== 'true') return null;
 const { MCP_OAUTH_ISSUER: issuer, MCP_RESOURCE_URL: audience, MCP_OAUTH_JWKS_URI: jwksUri } = env;
 if (!issuer || !audience || !jwksUri) return null;
 for (const value of [issuer, audience, jwksUri]) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('Invalid MCP configuration');
 }
 if (new URL(issuer).origin !== new URL(jwksUri).origin) throw new Error('Invalid MCP issuer key endpoint');
 return {issuer,audience,jwksUri};
}
// Public signing keys may be cached. Principals and permissions NEVER are.
let keySet: { uri: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;
export async function verifyMcpToken(token: string, config: McpConfig): Promise<JWTVerifyResult> {
 if (!keySet || keySet.uri !== config.jwksUri) keySet = {uri:config.jwksUri,keys:createRemoteJWKSet(new URL(config.jwksUri),{timeoutDuration:5000})};
 return jwtVerify(token,keySet.keys,{issuer:config.issuer,audience:config.audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub'],maxTokenAge:'1h'});
}
export interface McpAuthDependencies {
 verify(token: string): Promise<JWTVerifyResult>;
 loadGrant(issuer: string, subject: string, clientId: string): Promise<McpGrant | null>;
}
export async function authenticateMcp(request: Request, config: McpConfig, deps: McpAuthDependencies): Promise<McpPrincipal> {
 const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.get('authorization') ?? '');
 if (!match || match[1].length > 16384) throw new McpAuthError();
 let claims: JWTVerifyResult['payload'];
 try { claims = (await deps.verify(match[1])).payload; } catch { throw new McpAuthError(); }
 // Auth0 supports its standard azp and the RFC 9068 client_id dialect.
 // Both are signed OAuth client identities, never app-user/role claims.
 const clientId = typeof claims.client_id === 'string' ? claims.client_id : claims.azp;
 if (claims.client_id && claims.azp && claims.client_id !== claims.azp) throw new McpAuthError();
 if (!claims.sub || typeof clientId !== 'string' || !claims.exp || !claims.iat || typeof claims.scope !== 'string') throw new McpAuthError();
 const grant = await deps.loadGrant(config.issuer,claims.sub,clientId);
 const now=Date.now();
 if (!grant || grant.issuer !== config.issuer || grant.subject !== claims.sub || grant.clientId !== clientId || grant.userId !== grant.user.id || grant.revokedAt || grant.expiresAt.getTime() <= now || grant.notBefore.getTime() > now || claims.iat*1000 < grant.notBefore.getTime()) throw new McpAuthError();
 if (grant.user.role !== 'ADMIN' || grant.user.mustChangePassword) throw new McpAuthError(403);
 const scopes = claims.scope.split(' ').filter(scope=>MCP_SCOPES.some(s=>s===scope) && grant.scopes.includes(scope));
 if (!scopes.length) throw new McpAuthError(403);
 return {viewer:{userId:grant.user.id,isOwner:grant.user.isOwner,role:grant.user.role,revenueSharePct:grant.user.revenueSharePct},scopes};
}
