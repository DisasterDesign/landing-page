import type {
  ContactSubmission,
  LeadActorType,
  LeadIntentLevel,
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadLossReason,
  LeadStage,
  Role,
} from "@prisma/client";

export type LeadRecord = ContactSubmission;

export interface LeadActor {
  type: LeadActorType;
  userId?: string;
  role?: Role;
  occurredAt?: Date;
}

export interface AuthenticatedLeadActor {
  userId: string;
  role: "ADMIN" | "SELLER";
}

export interface LeadTransitionContext {
  actorType: LeadActorType;
  actorRole: Role | null;
  intentLevel: LeadIntentLevel;
}

export interface CreateLeadFromSourceInput {
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  occurredAt?: Date;
  captureMode?: "LIVE" | "HISTORICAL_SYNC";
  notificationMode?: "ELIGIBLE_SELLER" | "NONE";
  eligibleSellerId?: string | null;
  forcedReviewReason?: "META_SOURCE_TIME_INVALID";
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export interface RecordLeadInteractionInput {
  leadId: string;
  actor: AuthenticatedLeadActor;
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome;
  decisionMakerReached: boolean;
  note?: string;
  followUpAction?: "SCHEDULE" | "END_AS_LOST";
  followUpAt?: Date;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  usedCallAngleIds: string[];
}

export interface CorrectLeadSourceInput {
  leadId: string;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  reason: string;
  actor: AuthenticatedLeadActor;
}

export interface UpdateLeadContactDetailsInput {
  leadId: string;
  details: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  confirmation: "SELLER_CONFIRMED" | "ADMIN_CONFIRMED";
  actor: AuthenticatedLeadActor;
}

export interface ResolveLeadMigrationReviewInput {
  leadId: string;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  stage?: Exclude<LeadStage, "WON">;
  ownerId: string | null;
  eligibleSellerId: string;
  reason: string;
  version: 1;
  actor: AuthenticatedLeadActor;
}

export interface ClaimLeadInput {
  leadId: string;
  sellerId: string;
}

export type OwnershipMutationInput =
  | {
      action: "REASSIGN";
      leadId: string;
      sellerId: string;
      reason: string;
      actor: AuthenticatedLeadActor;
    }
  | {
      action: "RELEASE";
      leadId: string;
      replacementEligibleSellerId?: string;
      cancelFollowUps?: boolean;
      reason: string;
      actor: AuthenticatedLeadActor;
    };

export interface TransitionLeadStageInput {
  leadId: string;
  toStage: LeadStage;
  reason?: string;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  actor: AuthenticatedLeadActor | LeadActor;
}
