import { auth } from "@/lib/auth";

export async function requireProspectingAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "ADMIN") return null;
  return { id: session.user.id };
}
