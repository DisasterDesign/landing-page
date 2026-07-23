import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface PersistedRoleStore {
  user: {
    findUnique(input: {
      where: { id: string };
      select: { role: true };
    }): Promise<{ role: Role } | null>;
  };
}

export class PersistedRoleAuthorizationError extends Error {
  constructor() {
    super("Current user role is not authorized");
    this.name = "PersistedRoleAuthorizationError";
  }
}

export async function requirePersistedUserRole(
  userId: string,
  allowedRoles: readonly Role[],
  dependencies: { db?: PersistedRoleStore } = {},
): Promise<Role> {
  const db = dependencies.db ?? prisma;
  const persisted = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!persisted || !allowedRoles.includes(persisted.role)) {
    throw new PersistedRoleAuthorizationError();
  }
  return persisted.role;
}
