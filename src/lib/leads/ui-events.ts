export const LEAD_CHANGED_EVENT = "lead:changed";

export function isLeadChangedEventFor(
  event: unknown,
  leadId: string,
): boolean {
  if (!event || typeof event !== "object") return false;
  const detail = (event as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object") return false;
  return (detail as { id?: unknown }).id === leadId;
}
