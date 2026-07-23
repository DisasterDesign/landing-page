import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  leadId?: string;
  dedupeKey?: string;
  /** Override the URL the notification opens. Default: based on type. */
  url?: string;
}

interface PersistedNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl: string;
  taskId?: string;
  leadId?: string;
  dedupeKey?: string;
}

export interface NotificationPersistence {
  createMany(args: {
    data: PersistedNotificationInput;
    skipDuplicates: true;
  }): Promise<{ count: number }>;
  findUnique(args: {
    where: { dedupeKey: string };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: PersistedNotificationInput;
    select: { id: true };
  }): Promise<{ id: string }>;
}

export interface NotificationTransactionRunner {
  transaction<T>(
    callback: (transaction: NotificationPersistence) => Promise<T>,
  ): Promise<T>;
}

function defaultUrl(
  type: NotificationType,
  ids: { taskId?: string; leadId?: string },
): string {
  switch (type) {
    case "TASK_ASSIGNED":
    case "TASK_UPDATED":
    case "TASK_COMMENTED":
      return ids.taskId ? `/admin/tasks/${ids.taskId}` : "/admin/tasks";
    case "CONTACT_RECEIVED":
      return ids.leadId ? `/admin/leads?focus=${ids.leadId}` : "/admin/leads";
    case "AGREEMENT_SIGNED":
      return "/admin/agreements";
    case "LEAD_FOLLOWUP":
      return ids.leadId ? `/admin/leads?focus=${ids.leadId}` : "/admin/leads";
    default:
      return "/admin";
  }
}

function persistedNotificationInput(
  input: CreateNotificationInput,
): PersistedNotificationInput {
  return {
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl:
      input.url ??
      defaultUrl(input.type, { taskId: input.taskId, leadId: input.leadId }),
    taskId: input.taskId,
    leadId: input.leadId,
    dedupeKey: input.dedupeKey,
  };
}

export async function sendNotificationPush(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await sendPushToUser(input.recipientId, {
      title: input.title,
      body: input.body,
      url:
        input.url ??
        defaultUrl(input.type, {
          taskId: input.taskId,
          leadId: input.leadId,
        }),
      tag: `fw-${input.type.toLowerCase()}`,
    });
  } catch (error) {
    console.error("Failed to send push:", error);
  }
}

export async function createNotificationOnceInTransaction(
  transaction: NotificationPersistence,
  input: CreateNotificationInput,
): Promise<{ created: boolean; notificationId: string }> {
  const data = persistedNotificationInput(input);
  if (!input.dedupeKey) {
    const notification = await transaction.create({
      data,
      select: { id: true },
    });
    return { created: true, notificationId: notification.id };
  }

  const result = await transaction.createMany({
    data,
    skipDuplicates: true,
  });
  const notification = await transaction.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { id: true },
  });
  if (!notification) {
    throw new Error("Notification dedupe row is missing after persistence");
  }
  return {
    created: result.count === 1,
    notificationId: notification.id,
  };
}

const prismaNotificationStore: NotificationTransactionRunner = {
  transaction: (callback) =>
    prisma.$transaction((transaction) =>
      callback(transaction.notification as unknown as NotificationPersistence),
    ),
};

export async function createNotificationOnce(
  input: CreateNotificationInput,
  dependencies: {
    store?: NotificationTransactionRunner;
  } = {},
): Promise<{ created: boolean; notificationId: string }> {
  const store = dependencies.store ?? prismaNotificationStore;
  return store.transaction((transaction) =>
    createNotificationOnceInTransaction(transaction, input),
  );
}

/**
 * Create a notification row for a user and fire a web push to all of their
 * registered devices. Silently no-ops if recipientId equals the actor.
 */
export async function createNotification(
  input: CreateNotificationInput,
  actorId?: string
): Promise<void> {
  if (actorId && input.recipientId === actorId) return;

  let created = false;
  try {
    ({ created } = await createNotificationOnce(input));
  } catch (err) {
    console.error("Failed to create notification:", err);
    return;
  }
  if (!created) return;

  await sendNotificationPush(input);
}

/**
 * Helper: notify every admin (excluding the actor if specified).
 */
export async function notifyAllAdmins(
  input: Omit<CreateNotificationInput, "recipientId">,
  actorId?: string,
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((a) =>
      createNotification({ ...input, recipientId: a.id }, actorId),
    ),
  );
}

/**
 * Helper: notify every seller (new-lead pings to their mobile). Pass a
 * seller-scoped `url` (e.g. /seller/leads) — the default admin URLs are
 * unreachable for the SELLER role.
 */
export async function notifyAllSellers(
  input: Omit<CreateNotificationInput, "recipientId">,
  actorId?: string,
): Promise<void> {
  const sellers = await prisma.user.findMany({
    where: { role: "SELLER" },
    select: { id: true },
  });

  await Promise.all(
    sellers.map((s) =>
      createNotification({ ...input, recipientId: s.id }, actorId),
    ),
  );
}
