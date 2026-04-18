import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
}

/**
 * Create a notification for a user. Silently no-ops if recipientId equals
 * the current actor (so users don't get notified about their own actions).
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
  }
}
