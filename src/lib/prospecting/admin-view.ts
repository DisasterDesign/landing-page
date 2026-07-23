import {
  auditedDomainWebsite,
  safePublicWebsite,
} from "./seller-view";
import type { LivePlaceDetails } from "./types";

interface AdminProspectRecord {
  id: string;
  placeId: string;
  status: string;
  websiteStatus: string;
  auditedDomain: string | null;
  promotedLeadId: string | null;
}

function googleMapsUrl(placeId: string, displayName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}&query_place_id=${encodeURIComponent(placeId)}`;
}

export function serializeAdminProspect<T extends AdminProspectRecord>(
  prospect: T,
  live?: LivePlaceDetails,
) {
  const phone = live?.nationalPhoneNumber?.trim() || null;
  const displayName =
    live?.displayName?.trim() ||
    prospect.auditedDomain ||
    "פרטי העסק לא זמינים";

  return {
    ...prospect,
    liveStatus: !live
      ? ("UNAVAILABLE" as const)
      : phone
        ? ("READY" as const)
        : ("NO_PHONE" as const),
    business: {
      displayName,
      phone,
      address: live?.formattedAddress?.trim() || null,
      auditedWebsite: auditedDomainWebsite(
        prospect.auditedDomain,
        prospect.websiteStatus,
      ),
      liveWebsite: safePublicWebsite(live?.websiteUri),
      mapUrl: googleMapsUrl(prospect.placeId, displayName),
    },
  };
}

export type AdminProspectView = ReturnType<typeof serializeAdminProspect>;
