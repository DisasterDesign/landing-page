import type {
  AgreementStatus,
  ContactStatus,
  LeadActorType,
  LeadEventType,
  LeadFollowUpStatus,
  LeadIntentLevel,
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadLossReason,
  LeadPhoneProvenance,
  LeadStage,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import {
  auditedDomainWebsite,
  safePublicWebsite,
} from "@/lib/prospecting/seller-view";
import type { LivePlaceDetails } from "@/lib/prospecting/types";

import { sellerLeadScope } from "./authorization";
import { LeadDomainError } from "./errors";
import {
  projectLeadResponseSla,
  type LeadResponseSla,
} from "./lead-sla";

type DateValue = Date | string;
type UserSummary = { id: string; name: string };

export interface LeadCapabilities {
  canClaim: boolean;
  canPrepare: boolean;
  canContact: boolean;
  canRecordInteraction: boolean;
  canAddNote: boolean;
  canUpdateContact: boolean;
  canScheduleFollowUp: boolean;
  canCompleteFollowUp: boolean;
  canCreateAgreement: boolean;
  canReassign: boolean;
  canCorrectSource: boolean;
  canChangeCommissionCredit: boolean;
  canMarkLost: boolean;
  canMarkSpam: boolean;
  canReopen: boolean;
}

export type LeadNextAction =
  | { kind: "RECOVER_FIRST_PAYMENT"; agreementId: string }
  | { kind: "COMPLETE_FOLLOW_UP"; followUpId: string; dueAt: string }
  | { kind: "VIEW_AGREEMENT"; agreementId: string; status: AgreementStatus }
  | { kind: "CREATE_AGREEMENT" }
  | { kind: "CLAIM" }
  | { kind: "PREPARE" }
  | { kind: "CONTACT" }
  | { kind: "NONE" };

export interface LeadTimelineItem {
  id: string;
  kind: "LEAD_EVENT" | "INTERACTION" | "NOTE" | "FOLLOW_UP" | "AGREEMENT";
  occurredAt: string;
  recordedAt: string;
  actor: UserSummary | null;
  data: Record<string, unknown>;
}

export interface LeadPreparationContext {
  prospectId: string | null;
  placeId: string | null;
  batchId: string | null;
  websiteStatus: string | null;
  auditedDomain: string | null;
  internalBusinessCategory: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: Array<{ id: string; text: string; version: number }>;
  scoreBreakdown: {
    availability: number | null;
    performance: number | null;
    seo: number | null;
    maintenance: number | null;
    visual: number | null;
    commercial: number | null;
  } | null;
  technicalEvidence: Record<string, unknown> | null;
  visualEvidence: Record<string, unknown> | null;
  salesFit: {
    classification: string | null;
    confidence: number | null;
    ownerReachabilityScore: number | null;
    reason: string | null;
    evidence: string[];
  };
  liveStatus: "READY" | "NO_PHONE" | "UNAVAILABLE" | "NOT_APPLICABLE";
  rating: number | null;
  reviewCount: number | null;
  weekdayDescriptions: string[];
  businessStatus: string | null;
}

export interface LeadListItem {
  id: string;
  displayName: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneSource: "CRM" | "GOOGLE" | "NONE";
  phoneProvenance: LeadPhoneProvenance | null;
  message: string | null;
  service: string | null;
  isRead: boolean;
  legacyStatus: ContactStatus;
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  sourceLabel: string;
  sourceContext: Record<string, string | number | null>;
  stage: LeadStage | null;
  owner: UserSummary | null;
  eligibleSeller: UserSummary | null;
  createdAt: string;
  lastActivityAt: string;
  nextFollowUpAt: string | null;
  responseSla: LeadResponseSla | null;
  lastContactedAt: string | null;
  closedAt: string | null;
  doNotContactAt: string | null;
  website: string | null;
  websiteSource: "GOOGLE" | "AUDITED_DOMAIN" | "NONE";
  mapUrl: string | null;
  address: string | null;
  category: string | null;
  noteCount: number;
  preparation: LeadPreparationContext | null;
  nextAction: LeadNextAction;
  capabilities: LeadCapabilities;
  migrationReviewRequired: boolean;
  migrationReviewReason: string | null;
}

export interface LeadDetail extends LeadListItem {
  sourceSnapshot: Record<string, unknown> | null;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: UserSummary;
  }>;
  interactions: Array<{
    id: string;
    channel: LeadInteractionChannel;
    outcome: LeadInteractionOutcome;
    decisionMakerReached: boolean;
    note: string | null;
    nextFollowUpAt: string | null;
    lossReason: LeadLossReason | null;
    lossReasonDetails: string | null;
    usedCallAngleIds: string[];
    occurredAt: string;
    recordedAt: string;
    author: UserSummary;
  }>;
  followUps: Array<{
    id: string;
    owner: UserSummary;
    createdBy: UserSummary;
    dueAt: string;
    reason: string;
    status: LeadFollowUpStatus;
    reminderSentAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{
    id: string;
    type: LeadEventType;
    actorType: LeadActorType;
    actor: UserSummary | null;
    fromStage: LeadStage | null;
    toStage: LeadStage | null;
    metadata: Record<string, unknown> | null;
    occurredAt: string;
    recordedAt: string;
  }>;
  agreements: Array<{
    id: string;
    status: AgreementStatus;
    paymentStatus: PaymentStatus;
    customerName: string;
    monthlyPrice: number;
    creditedSellerId: string | null;
    createdAt: string;
    updatedAt: string;
    signedAt: string | null;
    paidAt: string | null;
  }>;
  timeline: LeadTimelineItem[];
}

export type SellerLeadListItem = LeadListItem & {
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  stage: LeadStage;
};

export type SellerLeadDetail = LeadDetail & {
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  stage: LeadStage;
};

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SellerLeadListInput {
  sellerId: string;
  intents: readonly LeadIntentLevel[];
  cursor?: string;
  limit?: number;
  search?: string;
  order?: "NEWEST" | "INCOMING_PRIORITY";
}

interface LeadNoteRecord {
  id: string;
  body: string;
  createdAt: DateValue;
  author: UserSummary;
}

interface LeadEventRecord {
  id: string;
  type: LeadEventType;
  actorType: LeadActorType;
  actorUserId: string | null;
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  metadata: unknown;
  occurredAt: DateValue;
  recordedAt: DateValue;
  actorUser: UserSummary | null;
}

interface LeadInteractionRecord {
  id: string;
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome;
  decisionMakerReached: boolean;
  note: string | null;
  nextFollowUpAt: DateValue | null;
  lossReason: LeadLossReason | null;
  lossReasonDetails: string | null;
  usedCallAngleIds: string[];
  occurredAt: DateValue;
  recordedAt: DateValue;
  author: UserSummary;
}

interface LeadFollowUpRecord {
  id: string;
  owner: UserSummary;
  createdBy: UserSummary;
  dueAt: DateValue;
  reason: string;
  status: LeadFollowUpStatus;
  reminderSentAt: DateValue | null;
  completedAt: DateValue | null;
  cancelledAt: DateValue | null;
  createdAt: DateValue;
  updatedAt: DateValue;
}

interface AgreementRecord {
  id: string;
  status: AgreementStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  monthlyPrice: number;
  creditedSellerId: string | null;
  createdAt: DateValue;
  updatedAt: DateValue;
  signedAt: DateValue | null;
  paidAt: DateValue | null;
}

interface ProspectRecord {
  id: string;
  placeId: string;
  batchId: string | null;
  websiteStatus: string;
  auditedDomain: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: string[];
  salesFitClassification: string | null;
  salesFitConfidence: number | null;
  ownerReachabilityScore: number | null;
  salesFitReason: string | null;
  salesFitEvidence: string[];
  audits: Array<{
    id: string;
    availabilityScore: number | null;
    performanceScore: number | null;
    seoScore: number | null;
    maintenanceScore: number | null;
    visualScore: number | null;
    commercialScore: number | null;
    technicalEvidence: unknown;
    visualEvidence: unknown;
    auditedAt: DateValue;
  }>;
}

export interface LeadProjectionRecord {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneProvenance: LeadPhoneProvenance | null;
  message: string | null;
  service: string | null;
  isRead: boolean;
  status: ContactStatus;
  source: string | null;
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  sourceSnapshot: unknown;
  stage: LeadStage | null;
  ownerId: string | null;
  owner: UserSummary | null;
  eligibleSellerId: string | null;
  eligibleSeller: UserSummary | null;
  firstClaimedAt: DateValue | null;
  firstContactedAt: DateValue | null;
  decisionMakerReachedAt: DateValue | null;
  qualifiedAt: DateValue | null;
  wonAt: DateValue | null;
  lostAt: DateValue | null;
  lossReason: LeadLossReason | null;
  lossReasonDetails: string | null;
  doNotContactAt: DateValue | null;
  migrationReviewRequired: boolean;
  migrationReviewReason: string | null;
  nextFollowUpAt: DateValue | null;
  lastContactedAt: DateValue | null;
  closedAt: DateValue | null;
  createdAt: DateValue;
  notes: LeadNoteRecord[];
  events: LeadEventRecord[];
  interactions: LeadInteractionRecord[];
  followUps: LeadFollowUpRecord[];
  agreements: AgreementRecord[];
  prospect: ProspectRecord | null;
}

export const leadProjectionInclude = {
  owner: { select: { id: true, name: true } },
  eligibleSeller: { select: { id: true, name: true } },
  notes: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  events: {
    include: { actorUser: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }],
  },
  interactions: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }],
  },
  followUps: {
    include: {
      owner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  agreements: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      monthlyPrice: true,
      creditedSellerId: true,
      createdAt: true,
      updatedAt: true,
      signedAt: true,
      paidAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  prospect: {
    include: {
      audits: { orderBy: { auditedAt: "desc" }, take: 1 },
    },
  },
} satisfies Prisma.ContactSubmissionInclude;

export type ProjectionDatabase = Pick<typeof prisma, "contactSubmission">;

export interface ProjectionDependencies {
  db?: ProjectionDatabase;
  loadLiveDetails?: (
    placeIds: string[],
  ) => Promise<Map<string, LivePlaceDetails>>;
  now?: Date;
}

interface ProjectionOptions {
  audience: "SELLER" | "ADMIN";
  viewerId: string;
  now: Date;
  live?: LivePlaceDetails;
}

const noCapabilities: LeadCapabilities = Object.freeze({
  canClaim: false,
  canPrepare: false,
  canContact: false,
  canRecordInteraction: false,
  canAddNote: false,
  canUpdateContact: false,
  canScheduleFollowUp: false,
  canCompleteFollowUp: false,
  canCreateAgreement: false,
  canReassign: false,
  canCorrectSource: false,
  canChangeCommissionCredit: false,
  canMarkLost: false,
  canMarkSpam: false,
  canReopen: false,
});

function iso(value: DateValue): string;
function iso(value: DateValue | null): string | null;
function iso(value: DateValue | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(
  object: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = object?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(
  object: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = object?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function channelLabel(sourceKey: string | null): string {
  const labels: Record<string, string> = {
    google_maps: "Google Maps",
    meta_lead_ads: "Meta Lead Ads",
    website: "אתר Fuzion",
    google_search_ads: "Google Search Ads",
    manual_outbound: "הזנה ידנית",
    direct_contact: "פנייה ישירה",
  };
  return sourceKey ? labels[sourceKey] ?? sourceKey : "מקור לא מסווג";
}

function buildSourceContext(
  sourceKey: string | null,
  snapshot: Record<string, unknown> | null,
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {
    channel: channelLabel(sourceKey),
  };
  const keys = [
    "territory",
    "weekStart",
    "campaignName",
    "adSetName",
    "adName",
    "formName",
    "landingPage",
    "utmCampaign",
    "searchTerm",
    "channel",
    "context",
  ];
  for (const key of keys) {
    const value = snapshot?.[key];
    if (typeof value === "string" || typeof value === "number") {
      result[key] = value;
    }
  }
  return result;
}

function placeIdFor(
  lead: LeadProjectionRecord,
  snapshot: Record<string, unknown> | null,
): string | null {
  return lead.prospect?.placeId ?? stringValue(snapshot, "placeId");
}

function googleMapsUrl(placeId: string, displayName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}&query_place_id=${encodeURIComponent(placeId)}`;
}

function callAnglesFromSnapshot(
  snapshot: Record<string, unknown> | null,
  prospect: ProspectRecord | null,
): Array<{ id: string; text: string; version: number }> {
  const values = snapshot?.callAngles;
  if (Array.isArray(values)) {
    const parsed = values.flatMap((value) => {
      const item = objectValue(value);
      const id = stringValue(item, "id");
      const text = stringValue(item, "text");
      const version = numberValue(item, "version");
      return id && text && version !== null ? [{ id, text, version }] : [];
    });
    if (parsed.length > 0) return parsed.slice(0, 3);
  }
  return (prospect?.callAngles ?? []).slice(0, 3).map((text, index) => ({
    id: `legacy:${index + 1}`,
    text,
    version: 1,
  }));
}

function buildPreparation(
  lead: LeadProjectionRecord,
  snapshot: Record<string, unknown> | null,
  live: LivePlaceDetails | undefined,
): LeadPreparationContext | null {
  if (lead.intentLevel !== "OUTBOUND" && !lead.prospect) return null;
  const prospect = lead.prospect;
  const audit = prospect?.audits[0];
  const placeId = placeIdFor(lead, snapshot);
  return {
    prospectId: prospect?.id ?? null,
    placeId,
    batchId: prospect?.batchId ?? stringValue(snapshot, "batchId"),
    websiteStatus:
      stringValue(snapshot, "websiteStatus") ?? prospect?.websiteStatus ?? null,
    auditedDomain:
      stringValue(snapshot, "auditedDomain") ?? prospect?.auditedDomain ?? null,
    internalBusinessCategory:
      stringValue(snapshot, "internalBusinessCategory") ?? null,
    qualityScore:
      numberValue(snapshot, "qualityScore") ?? prospect?.qualityScore ?? null,
    rawQualityScore: prospect?.rawQualityScore ?? null,
    auditConfidence: prospect?.auditConfidence ?? null,
    opportunitySummary:
      stringValue(snapshot, "opportunitySummary") ??
      prospect?.opportunitySummary ??
      null,
    callAngles: callAnglesFromSnapshot(snapshot, prospect),
    scoreBreakdown: audit
      ? {
          availability: audit.availabilityScore,
          performance: audit.performanceScore,
          seo: audit.seoScore,
          maintenance: audit.maintenanceScore,
          visual: audit.visualScore,
          commercial: audit.commercialScore,
        }
      : null,
    technicalEvidence: objectValue(audit?.technicalEvidence ?? null),
    visualEvidence: objectValue(audit?.visualEvidence ?? null),
    salesFit: {
      classification: prospect?.salesFitClassification ?? null,
      confidence: prospect?.salesFitConfidence ?? null,
      ownerReachabilityScore: prospect?.ownerReachabilityScore ?? null,
      reason: prospect?.salesFitReason ?? null,
      evidence: prospect?.salesFitEvidence ?? [],
    },
    liveStatus: !placeId
      ? "NOT_APPLICABLE"
      : !live
        ? "UNAVAILABLE"
        : live.nationalPhoneNumber
          ? "READY"
          : "NO_PHONE",
    rating: live?.rating ?? null,
    reviewCount: live?.reviewCount ?? null,
    weekdayDescriptions: live?.weekdayDescriptions ?? [],
    businessStatus: live?.businessStatus ?? null,
  };
}

function computeCapabilities(
  lead: LeadProjectionRecord,
  audience: "SELLER" | "ADMIN",
  viewerId: string,
): LeadCapabilities {
  const ready =
    !lead.migrationReviewRequired &&
    lead.intentLevel !== null &&
    lead.sourceKey !== null &&
    lead.stage !== null;
  if (!ready) return { ...noCapabilities };

  const stage = lead.stage;
  const terminal = stage === "WON" || stage === "LOST" || stage === "SPAM";
  const ownedByViewer = lead.ownerId === viewerId;
  const sellerEligible =
    audience === "SELLER" &&
    lead.ownerId === null &&
    lead.eligibleSellerId === viewerId;
  const canOperate =
    audience === "ADMIN" ? true : ownedByViewer;
  const contactBlocked = lead.doNotContactAt !== null || terminal;
  const activeFollowUp = lead.followUps.some(
    (followUp) => followUp.status === "SCHEDULED",
  );
  const activeAgreement = lead.agreements.some((agreement) =>
    ["DRAFT", "SENT", "SIGNED"].includes(agreement.status),
  );
  const mayContact = canOperate && !contactBlocked;

  return {
    canClaim: sellerEligible && !contactBlocked,
    canPrepare:
      lead.intentLevel === "OUTBOUND" &&
      !terminal &&
      (stage === "NEW" || stage === "PREPARING") &&
      canOperate,
    canContact: mayContact,
    canRecordInteraction: mayContact,
    canAddNote: canOperate,
    canUpdateContact: mayContact,
    canScheduleFollowUp: mayContact && !activeFollowUp,
    canCompleteFollowUp: canOperate && activeFollowUp,
    canCreateAgreement:
      canOperate &&
      stage === "QUALIFIED" &&
      lead.ownerId !== null &&
      !activeAgreement,
    canReassign: audience === "ADMIN" && !terminal,
    canCorrectSource: audience === "ADMIN",
    canChangeCommissionCredit:
      audience === "ADMIN" && lead.agreements.length > 0,
    canMarkLost: canOperate && !terminal,
    canMarkSpam:
      audience === "ADMIN" &&
      lead.intentLevel !== "OUTBOUND" &&
      !terminal,
    canReopen: audience === "ADMIN" && stage === "LOST",
  };
}

function buildNextAction(
  lead: LeadProjectionRecord,
  capabilities: LeadCapabilities,
): LeadNextAction {
  const failed = [...lead.agreements]
    .reverse()
    .find(
      (agreement) =>
        agreement.paymentStatus === "FAILED" &&
        agreement.status !== "CANCELLED",
    );
  if (failed) {
    return { kind: "RECOVER_FIRST_PAYMENT", agreementId: failed.id };
  }
  const scheduled = lead.followUps
    .filter((followUp) => followUp.status === "SCHEDULED")
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0];
  if (scheduled) {
    return {
      kind: "COMPLETE_FOLLOW_UP",
      followUpId: scheduled.id,
      dueAt: iso(scheduled.dueAt),
    };
  }
  const activeAgreement = [...lead.agreements]
    .reverse()
    .find((agreement) =>
      ["DRAFT", "SENT", "SIGNED"].includes(agreement.status),
    );
  if (activeAgreement) {
    return {
      kind: "VIEW_AGREEMENT",
      agreementId: activeAgreement.id,
      status: activeAgreement.status,
    };
  }
  if (capabilities.canCreateAgreement) return { kind: "CREATE_AGREEMENT" };
  if (capabilities.canClaim) return { kind: "CLAIM" };
  if (capabilities.canPrepare) return { kind: "PREPARE" };
  if (capabilities.canContact) return { kind: "CONTACT" };
  return { kind: "NONE" };
}

function buildTimeline(lead: LeadProjectionRecord): LeadTimelineItem[] {
  const timeline: LeadTimelineItem[] = [];
  for (const event of lead.events) {
    timeline.push({
      id: event.id,
      kind: "LEAD_EVENT",
      occurredAt: iso(event.occurredAt),
      recordedAt: iso(event.recordedAt),
      actor: event.actorUser,
      data: {
        type: event.type,
        actorType: event.actorType,
        fromStage: event.fromStage,
        toStage: event.toStage,
        metadata: objectValue(event.metadata),
      },
    });
  }
  for (const interaction of lead.interactions) {
    timeline.push({
      id: interaction.id,
      kind: "INTERACTION",
      occurredAt: iso(interaction.occurredAt),
      recordedAt: iso(interaction.recordedAt),
      actor: interaction.author,
      data: {
        channel: interaction.channel,
        outcome: interaction.outcome,
        decisionMakerReached: interaction.decisionMakerReached,
        note: interaction.note,
        nextFollowUpAt: iso(interaction.nextFollowUpAt),
        usedCallAngleIds: interaction.usedCallAngleIds,
      },
    });
  }
  for (const note of lead.notes) {
    timeline.push({
      id: note.id,
      kind: "NOTE",
      occurredAt: iso(note.createdAt),
      recordedAt: iso(note.createdAt),
      actor: note.author,
      data: { body: note.body },
    });
  }
  for (const followUp of lead.followUps) {
    timeline.push({
      id: followUp.id,
      kind: "FOLLOW_UP",
      occurredAt: iso(followUp.createdAt),
      recordedAt: iso(followUp.updatedAt),
      actor: followUp.createdBy,
      data: {
        dueAt: iso(followUp.dueAt),
        reason: followUp.reason,
        status: followUp.status,
        owner: followUp.owner,
      },
    });
  }
  for (const agreement of lead.agreements) {
    timeline.push({
      id: agreement.id,
      kind: "AGREEMENT",
      occurredAt: iso(agreement.createdAt),
      recordedAt: iso(agreement.updatedAt),
      actor: null,
      data: {
        status: agreement.status,
        paymentStatus: agreement.paymentStatus,
        customerName: agreement.customerName,
        monthlyPrice: agreement.monthlyPrice,
        signedAt: iso(agreement.signedAt),
        paidAt: iso(agreement.paidAt),
      },
    });
  }
  return timeline.sort((left, right) => {
    const occurred = +new Date(right.occurredAt) - +new Date(left.occurredAt);
    if (occurred !== 0) return occurred;
    const recorded = +new Date(right.recordedAt) - +new Date(left.recordedAt);
    return recorded !== 0 ? recorded : right.id.localeCompare(left.id);
  });
}

function lastActivityAt(lead: LeadProjectionRecord): string {
  const values = [
    iso(lead.createdAt),
    ...lead.events.map((event) => iso(event.recordedAt)),
    ...lead.interactions.map((interaction) => iso(interaction.recordedAt)),
    ...lead.notes.map((note) => iso(note.createdAt)),
    ...lead.followUps.map((followUp) => iso(followUp.updatedAt)),
    ...lead.agreements.map((agreement) => iso(agreement.updatedAt)),
  ];
  return values.reduce((latest, value) =>
    +new Date(value) > +new Date(latest) ? value : latest,
  );
}

export function projectLeadRecord(
  lead: LeadProjectionRecord,
  options: ProjectionOptions,
): LeadDetail {
  const snapshot = objectValue(lead.sourceSnapshot);
  const placeId = placeIdFor(lead, snapshot);
  const displayName =
    lead.company ??
    lead.name ??
    options.live?.displayName ??
    lead.prospect?.auditedDomain ??
    "עסק ללא שם";
  const websiteStatus =
    stringValue(snapshot, "websiteStatus") ??
    lead.prospect?.websiteStatus ??
    "UNKNOWN";
  const auditedDomain =
    stringValue(snapshot, "auditedDomain") ??
    lead.prospect?.auditedDomain ??
    null;
  const auditedWebsite = auditedDomainWebsite(auditedDomain, websiteStatus);
  const liveWebsite = safePublicWebsite(options.live?.websiteUri);
  const website = liveWebsite ?? auditedWebsite;
  const crmPhone = lead.phone?.trim() || null;
  const googlePhone = options.live?.nationalPhoneNumber?.trim() || null;
  const phone = crmPhone ?? googlePhone;
  const capabilities = computeCapabilities(
    lead,
    options.audience,
    options.viewerId,
  );

  return {
    id: lead.id,
    displayName,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone,
    phoneSource: crmPhone ? "CRM" : googlePhone ? "GOOGLE" : "NONE",
    phoneProvenance: lead.phoneProvenance,
    message: lead.message,
    service: lead.service,
    isRead: lead.isRead,
    legacyStatus: lead.status,
    intentLevel: lead.intentLevel,
    sourceKey: lead.sourceKey,
    sourceLabel: channelLabel(lead.sourceKey),
    sourceContext: buildSourceContext(lead.sourceKey, snapshot),
    sourceSnapshot: snapshot,
    stage: lead.stage,
    owner: lead.owner,
    eligibleSeller: lead.eligibleSeller,
    createdAt: iso(lead.createdAt),
    lastActivityAt: lastActivityAt(lead),
    nextFollowUpAt: iso(
      lead.followUps.find((followUp) => followUp.status === "SCHEDULED")
        ?.dueAt ??
        lead.nextFollowUpAt,
    ),
    responseSla: projectLeadResponseSla(
      {
        intentLevel: lead.intentLevel,
        createdAt: lead.createdAt,
        firstClaimedAt: lead.firstClaimedAt,
      },
      options.now,
    ),
    lastContactedAt: iso(lead.lastContactedAt),
    closedAt: iso(lead.closedAt),
    doNotContactAt: iso(lead.doNotContactAt),
    website,
    websiteSource: liveWebsite
      ? "GOOGLE"
      : auditedWebsite
        ? "AUDITED_DOMAIN"
        : "NONE",
    mapUrl: placeId ? googleMapsUrl(placeId, displayName) : null,
    address: options.live?.formattedAddress ?? null,
    category: options.live?.category ?? null,
    noteCount: lead.notes.length,
    preparation: buildPreparation(lead, snapshot, options.live),
    nextAction: buildNextAction(lead, capabilities),
    capabilities,
    migrationReviewRequired: lead.migrationReviewRequired,
    migrationReviewReason: lead.migrationReviewReason,
    notes: lead.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: iso(note.createdAt),
      author: note.author,
    })),
    interactions: lead.interactions.map((interaction) => ({
      id: interaction.id,
      channel: interaction.channel,
      outcome: interaction.outcome,
      decisionMakerReached: interaction.decisionMakerReached,
      note: interaction.note,
      nextFollowUpAt: iso(interaction.nextFollowUpAt),
      lossReason: interaction.lossReason,
      lossReasonDetails: interaction.lossReasonDetails,
      usedCallAngleIds: interaction.usedCallAngleIds,
      occurredAt: iso(interaction.occurredAt),
      recordedAt: iso(interaction.recordedAt),
      author: interaction.author,
    })),
    followUps: lead.followUps.map((followUp) => ({
      id: followUp.id,
      owner: followUp.owner,
      createdBy: followUp.createdBy,
      dueAt: iso(followUp.dueAt),
      reason: followUp.reason,
      status: followUp.status,
      reminderSentAt: iso(followUp.reminderSentAt),
      completedAt: iso(followUp.completedAt),
      cancelledAt: iso(followUp.cancelledAt),
      createdAt: iso(followUp.createdAt),
      updatedAt: iso(followUp.updatedAt),
    })),
    events: lead.events.map((event) => ({
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      actor: event.actorUser,
      fromStage: event.fromStage,
      toStage: event.toStage,
      metadata: objectValue(event.metadata),
      occurredAt: iso(event.occurredAt),
      recordedAt: iso(event.recordedAt),
    })),
    agreements: lead.agreements.map((agreement) => ({
      id: agreement.id,
      status: agreement.status,
      paymentStatus: agreement.paymentStatus,
      customerName: agreement.customerName,
      monthlyPrice: agreement.monthlyPrice,
      creditedSellerId: agreement.creditedSellerId,
      createdAt: iso(agreement.createdAt),
      updatedAt: iso(agreement.updatedAt),
      signedAt: iso(agreement.signedAt),
      paidAt: iso(agreement.paidAt),
    })),
    timeline: buildTimeline(lead),
  };
}

export interface LeadCursor {
  createdAt: string;
  id: string;
}

export function encodeLeadCursor(cursor: LeadCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeLeadCursor(value: string): LeadCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      typeof parsed.createdAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.createdAt))
    ) {
      throw new Error("invalid");
    }
    return { id: parsed.id, createdAt: new Date(parsed.createdAt).toISOString() };
  } catch {
    throw new LeadDomainError("VALIDATION", "Invalid lead cursor");
  }
}

export async function loadProjectionLiveDetails(
  placeIds: string[],
): Promise<Map<string, LivePlaceDetails>> {
  const unique = Array.from(new Set(placeIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const config = getProspectingConfig();
  if (!config.placesApiKey) return new Map();
  try {
    return await new GooglePlacesProspectingProvider({
      apiKey: config.placesApiKey,
      maxDiscoveredPerCycle: unique.length,
      maxPlacesCallsPerCycle: unique.length,
    }).getLiveDetails(unique);
  } catch {
    return new Map();
  }
}

function sellerIntentWhere(
  sellerId: string,
  intents: readonly LeadIntentLevel[],
): Prisma.ContactSubmissionWhereInput {
  const nonOutbound = intents.filter((intent) => intent !== "OUTBOUND");
  const choices: Prisma.ContactSubmissionWhereInput[] = [];
  if (nonOutbound.length > 0) {
    choices.push({
      intentLevel: { in: nonOutbound },
      stage: { notIn: ["WON", "LOST", "SPAM"] },
    });
  }
  if (intents.includes("OUTBOUND")) {
    choices.push({
      intentLevel: "OUTBOUND",
      OR: [
        {
          ownerId: sellerId,
          stage: { notIn: ["WON", "LOST", "SPAM"] },
        },
        {
          ownerId: null,
          eligibleSellerId: sellerId,
          stage: "NEW",
          prospect: {
            is: {
              batch: {
                is: { sellerId, supersededAt: null },
              },
            },
          },
        },
      ],
    });
  }
  return choices.length === 1 ? choices[0]! : { OR: choices };
}

function cursorWhere(cursor: LeadCursor): Prisma.ContactSubmissionWhereInput {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

export async function getSellerLeadList(
  input: SellerLeadListInput,
  dependencies: ProjectionDependencies = {},
): Promise<CursorPage<SellerLeadDetail>> {
  const db = dependencies.db ?? prisma;
  const requestedLimit = input.limit ?? 50;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100))
    : 50;
  const cursor = input.cursor ? decodeLeadCursor(input.cursor) : null;
  const incomingPriority = input.order === "INCOMING_PRIORITY";
  const orderBy: Prisma.ContactSubmissionOrderByWithRelationInput[] =
    incomingPriority
      ? [
          { intentLevel: "desc" },
          { ownerId: { sort: "asc", nulls: "first" } },
          { createdAt: "asc" },
          { id: "asc" },
        ]
      : [{ createdAt: "desc" }, { id: "desc" }];
  const rows = (await db.contactSubmission.findMany({
    where: {
      AND: [
        sellerLeadScope(input.sellerId),
        sellerIntentWhere(input.sellerId, input.intents),
        ...(input.search?.trim()
          ? [
              {
                OR: [
                  {
                    name: {
                      contains: input.search.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    company: {
                      contains: input.search.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    email: {
                      contains: input.search.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                  { phone: { contains: input.search.trim() } },
                ],
              },
            ]
          : []),
        ...(cursor && !incomingPriority ? [cursorWhere(cursor)] : []),
      ],
    },
    include: leadProjectionInclude,
    orderBy,
    ...(cursor && incomingPriority
      ? { cursor: { id: cursor.id }, skip: 1 }
      : {}),
    take: limit + 1,
  })) as unknown as LeadProjectionRecord[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const placeIds = pageRows.flatMap((row) => {
    const snapshot = objectValue(row.sourceSnapshot);
    const placeId = placeIdFor(row, snapshot);
    return placeId ? [placeId] : [];
  });
  const loadLive = dependencies.loadLiveDetails ?? loadProjectionLiveDetails;
  const live = await loadLive(placeIds);
  const now = dependencies.now ?? new Date();
  const items = pageRows.map((row) => {
    const snapshot = objectValue(row.sourceSnapshot);
    const projected = projectLeadRecord(row, {
      audience: "SELLER",
      viewerId: input.sellerId,
      now,
      live: live.get(placeIdFor(row, snapshot) ?? ""),
    });
    if (
      projected.intentLevel === null ||
      projected.sourceKey === null ||
      projected.stage === null ||
      projected.migrationReviewRequired
    ) {
      throw new Error("Seller projection received an unsafe canonical lead");
    }
    return projected as SellerLeadDetail;
  });
  const last = pageRows.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeLeadCursor({ createdAt: iso(last.createdAt), id: last.id })
        : null,
  };
}

export async function getSellerLeadDetail(
  input: { id: string; sellerId: string },
  dependencies: ProjectionDependencies = {},
): Promise<SellerLeadDetail> {
  const db = dependencies.db ?? prisma;
  const row = (await db.contactSubmission.findFirst({
    where: {
      AND: [{ id: input.id }, sellerLeadScope(input.sellerId)],
    },
    include: leadProjectionInclude,
  })) as unknown as LeadProjectionRecord | null;
  if (!row) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  const snapshot = objectValue(row.sourceSnapshot);
  const placeId = placeIdFor(row, snapshot);
  const loadLive = dependencies.loadLiveDetails ?? loadProjectionLiveDetails;
  const live = placeId ? await loadLive([placeId]) : new Map();
  const projected = projectLeadRecord(row, {
    audience: "SELLER",
    viewerId: input.sellerId,
    now: dependencies.now ?? new Date(),
    live: placeId ? live.get(placeId) : undefined,
  });
  if (
    projected.intentLevel === null ||
    projected.sourceKey === null ||
    projected.stage === null ||
    projected.migrationReviewRequired
  ) {
    throw new LeadDomainError("NOT_FOUND", "Lead not found");
  }
  return projected as SellerLeadDetail;
}

export async function getSellerLeadDetailsByIds(
  input: { ids: readonly string[]; sellerId: string },
  dependencies: ProjectionDependencies = {},
): Promise<SellerLeadDetail[]> {
  const ids = Array.from(new Set(input.ids.filter(Boolean)));
  if (ids.length === 0) return [];
  const db = dependencies.db ?? prisma;
  const rows = (await db.contactSubmission.findMany({
    where: {
      AND: [{ id: { in: ids } }, sellerLeadScope(input.sellerId)],
    },
    include: leadProjectionInclude,
  })) as unknown as LeadProjectionRecord[];
  const placeIds = rows.flatMap((row) => {
    const placeId = placeIdFor(row, objectValue(row.sourceSnapshot));
    return placeId ? [placeId] : [];
  });
  const loadLive = dependencies.loadLiveDetails ?? loadProjectionLiveDetails;
  const live = await loadLive(placeIds);
  const byId = new Map(
    rows.map((row) => {
      const placeId = placeIdFor(row, objectValue(row.sourceSnapshot));
      const projected = projectLeadRecord(row, {
        audience: "SELLER",
        viewerId: input.sellerId,
        now: dependencies.now ?? new Date(),
        live: placeId ? live.get(placeId) : undefined,
      });
      if (
        projected.intentLevel === null ||
        projected.sourceKey === null ||
        projected.stage === null ||
        projected.migrationReviewRequired
      ) {
        throw new Error("Seller projection received an unsafe canonical lead");
      }
      return [row.id, projected as SellerLeadDetail] as const;
    }),
  );
  return ids.flatMap((id) => {
    const lead = byId.get(id);
    return lead ? [lead] : [];
  });
}

export async function getLeadIntentForSeller(
  id: string,
  sellerId: string,
  dependencies: Pick<ProjectionDependencies, "db"> = {},
): Promise<LeadIntentLevel> {
  const db = dependencies.db ?? prisma;
  const row = await db.contactSubmission.findFirst({
    where: { AND: [{ id }, sellerLeadScope(sellerId)] },
    select: { intentLevel: true },
  });
  if (!row?.intentLevel) {
    throw new LeadDomainError("NOT_FOUND", "Lead not found");
  }
  return row.intentLevel;
}

export async function getAdminLeadDetail(
  id: string,
  dependencies: ProjectionDependencies = {},
): Promise<LeadDetail> {
  const db = dependencies.db ?? prisma;
  const row = (await db.contactSubmission.findUnique({
    where: { id },
    include: leadProjectionInclude,
  })) as unknown as LeadProjectionRecord | null;
  if (!row) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  const snapshot = objectValue(row.sourceSnapshot);
  const placeId = placeIdFor(row, snapshot);
  const loadLive = dependencies.loadLiveDetails ?? loadProjectionLiveDetails;
  const live = placeId ? await loadLive([placeId]) : new Map();
  return projectLeadRecord(row, {
    audience: "ADMIN",
    viewerId: "ADMIN",
    now: dependencies.now ?? new Date(),
    live: placeId ? live.get(placeId) : undefined,
  });
}
