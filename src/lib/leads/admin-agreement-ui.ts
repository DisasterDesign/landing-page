interface QueryReader {
  get(name: string): string | null;
}

export function parseAgreementPageQuery(query: QueryReader): {
  leadId: string | null;
  focusAgreementId: string | null;
} {
  const createRequested = query.get("new") === "1";
  return {
    leadId: createRequested ? query.get("leadId") : null,
    focusAgreementId: query.get("focus"),
  };
}

export function agreementLeadPrefill(lead: {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneSource: "CRM" | "GOOGLE" | "NONE";
}): {
  customerName: string;
  businessName: string;
  email: string;
  phone: string;
} {
  return {
    customerName: lead.name ?? "",
    businessName: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phoneSource === "CRM" ? lead.phone ?? "" : "",
  };
}
