import type { Prisma } from "@prisma/client";

/** Hide routine historical successes without deleting history or masking exceptions. */
export function notificationReadWhere(
  recipientId: string,
  financeWhere: Prisma.NotificationWhereInput,
): Prisma.NotificationWhereInput {
  return {
    AND: [
      { recipientId },
      financeWhere,
      {
        NOT: {
          type: "AGREEMENT_SIGNED",
          OR: [
            { title: { startsWith: "תשלום התקבל — " } },
            { title: { startsWith: "💰 חיוב חודשי התקבל — " } },
            { title: { startsWith: "💰 חיוב חודשי התגלה בסנכרון — " } },
            { title: { startsWith: "העסקה שולמה — " } },
          ],
        },
      },
    ],
  };
}
