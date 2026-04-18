// Stub for Phase 1. Full Search Console API integration arrives in Phase 2,
// where it will pull queries, pages, and backlinks via fetch + Bearer token.

export async function listSites(_accessToken: string): Promise<string[]> {
  // TODO(phase-2): GET https://www.googleapis.com/webmasters/v3/sites
  return [];
}
