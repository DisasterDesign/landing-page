-- Additive only. Creates no grant and stores no access/refresh token or secret.
CREATE TABLE "McpAccessGrant" (
 "id" TEXT NOT NULL,
 "issuer" TEXT NOT NULL,
 "subject" TEXT NOT NULL,
 "clientId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "scopes" TEXT[] NOT NULL,
 "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "McpAccessGrant_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "McpAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "McpAccessGrant_expiry_check" CHECK ("expiresAt" > "notBefore")
);
CREATE UNIQUE INDEX "McpAccessGrant_issuer_subject_clientId_key" ON "McpAccessGrant"("issuer", "subject", "clientId");
CREATE INDEX "McpAccessGrant_userId_idx" ON "McpAccessGrant"("userId");
