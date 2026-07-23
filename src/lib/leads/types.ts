import type {
  AgreementTier,
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
  reason?: string;
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

export interface ScheduleFollowUpInput {
  leadId: string;
  dueAt: Date;
  reason: string;
  actor: AuthenticatedLeadActor;
}

export interface RescheduleFollowUpInput {
  leadId: string;
  followUpId: string;
  dueAt: Date;
  reason: string;
  actor: AuthenticatedLeadActor;
}

export interface CompleteFollowUpInput {
  leadId: string;
  followUpId: string;
  actor: AuthenticatedLeadActor;
  occurredAt?: Date;
}

export interface AddLeadNoteInput {
  leadId: string;
  body: string;
  actor: AuthenticatedLeadActor;
}

export interface LegacyColdInteractionInput {
  prospectId: string;
  actor: AuthenticatedLeadActor;
  interaction: Omit<RecordLeadInteractionInput, "leadId" | "actor">;
}

export interface ValidatedAgreementDraft {
  tier: AgreementTier | null;
  additionalServices: string[];
  monthlyPrice: number;
  oneTimeFee: number | null;
  customerName: string;
  businessName: string | null;
  idNumber: string | null;
  phone: string;
  email: string;
  content: string;
  locale: "he" | "en";
  vatExempt: boolean;
  documentVersion: number;
  clientId?: string | null;
}

export interface CreateAgreementForLeadInput {
  leadId: string;
  actor: AuthenticatedLeadActor;
  agreement: ValidatedAgreementDraft;
}

export interface ChangeAgreementCreditInput {
  agreementId: string;
  creditedSellerId: string;
  reason: string;
  actor: AuthenticatedLeadActor;
}

export interface ApplyAgreementEventInput {
  agreementId: string;
  type: "SENT" | "SIGNED" | "CANCELLED";
  actor: AuthenticatedLeadActor | LeadActor;
  reason?: string;
}

export interface PaymentSuccessInput {
  agreementId: string;
  providerAttemptId: string;
  providerReturnValue: string;
  providerTransactionId: string;
  paidAt: Date;
  paidAmount: number;
  verifiedAt: Date;
  actor: LeadActor;
}

export interface PaymentFailureInput {
  agreementId: string;
  providerAttemptId: string;
  occurredAt: Date;
  actor: LeadActor;
}
