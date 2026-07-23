"use client";

import LeadOutcomeSheet, {
  type LeadOutcomeInput,
  type LeadOutcomeLead,
} from "./leads/LeadOutcomeSheet";
import type {
  SellerColdLead,
  SellerLeadInteractionInput,
} from "./cold-lead-types";

export default function CallOutcomeSheet({
  lead,
  busy,
  onClose,
  onSubmit,
}: {
  lead: SellerColdLead;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: SellerLeadInteractionInput) => void;
}) {
  const callAngles = lead.callAngles.flatMap((text, index) => {
    const id = lead.callAngleIds?.[index];
    return id ? [{ id, text, version: 1 }] : [];
  });
  const adaptedLead: LeadOutcomeLead = {
    displayName: lead.business.displayName,
    name: lead.business.displayName,
    company: lead.business.displayName,
    preparation: { callAngles },
  };

  return (
    <LeadOutcomeSheet
      lead={adaptedLead}
      isOpen
      busy={busy}
      onClose={onClose}
      onSubmit={(input: LeadOutcomeInput) =>
        onSubmit(input as SellerLeadInteractionInput)
      }
    />
  );
}
