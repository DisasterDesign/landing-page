import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  /** Override the URL the notification opens. Default: based on type. */
  url?: string;
}

function defaultUrl(type: NotificationType, taskId?: string): string {
  switch (type) {
    case "TASK_ASSIGNED":
    case "TASK_UPDATED":
    case "TASK_COMMENTED":
      return taskId ? `/admin/tasks/${taskId}` : "/admin/tasks";
    case "CONTACT_RECEIVED":
      return "/admin/contacts";
    case "AGREEMENT_SIGNED":
      return "/admin/agreements";
    default:
      return "/admin";
  }
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

  try {
    await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        taskId: input.taskId,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
    return;
  }

  try {
    await sendPushToUser(input.recipientId, {
      title: input.title,
      body: input.body,
      url: input.url || defaultUrl(input.type, input.taskId),
      tag: `fw-${input.type.toLowerCase()}`,
    });
  } catch (err) {
    console.error("Failed to send push:", err);
  }
}

/**
 * Helper: notify every admin (excluding the actor if specified).
 */
export async function notifyAllAdmins(
  input: Omit<CreateNotificationInput, "recipientId">,
  actorId?: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((a) =>
      createNotification({ ...input, recipientId: a.id }, actorId)
    )
  );
}
