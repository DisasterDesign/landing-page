import type { LeadTimelineItem } from "@/lib/leads/projection";

const eventLabels: Record<string, string> = {
  CREATED: "הליד נוצר",
  PUBLISHED: "הליד פורסם לאיש המכירות",
  CLAIMED: "הליד נלקח",
  RELEASED: "הבעלות שוחררה",
  REASSIGNED: "הבעלות הועברה",
  PREPARATION_STARTED: "החלה הכנה לשיחה",
  CONTACT_ATTEMPTED: "בוצע ניסיון קשר",
  DECISION_MAKER_REACHED: "נוצר קשר עם מקבל/ת ההחלטות",
  CONTACT_DETAILS_UPDATED: "פרטי הקשר עודכנו",
  NOTE_ADDED: "נוספה הערה",
  FOLLOW_UP_SCHEDULED: "נקבע פולואפ",
  FOLLOW_UP_RESCHEDULED: "הפולואפ נדחה",
  FOLLOW_UP_COMPLETED: "הפולואפ הושלם",
  QUALIFIED: "הליד הוכשר",
  AGREEMENT_CREATED: "נוצר חוזה",
  AGREEMENT_SENT: "החוזה סומן כנשלח",
  AGREEMENT_SIGNED: "החוזה נחתם",
  AGREEMENT_CANCELLED: "החוזה בוטל",
  PAYMENT_SUCCEEDED: "התשלום הראשון התקבל",
  PAYMENT_FAILED: "התשלום נכשל",
  WON: "העסקה נסגרה",
  LOST: "הליד נסגר כאבוד",
  REOPENED: "הליד נפתח מחדש",
  SPAM_MARKED: "הליד סומן כספאם",
  DO_NOT_CALL: "נרשמה בקשה לא ליצור קשר",
  COMMISSION_CREDIT_CHANGED: "קרדיט המכירה תוקן",
  SOURCE_CORRECTED: "מקור הליד תוקן",
  MIGRATED: "המידע הועבר למערכת המאוחדת",
};

const outcomeLabels: Record<string, string> = {
  NO_ANSWER: "לא ענו",
  CALLBACK: "ביקשו לחזור",
  NON_DECISION_MAKER: "לא מקבל/ת ההחלטות",
  INTERESTED: "יש עניין",
  NOT_INTERESTED: "אין עניין",
  WRONG_NUMBER: "מספר שגוי",
  DO_NOT_CALL: "לא ליצור קשר",
};

function itemTitle(item: LeadTimelineItem) {
  if (item.kind === "NOTE") return "הערה";
  if (item.kind === "FOLLOW_UP") {
    return item.data.status === "COMPLETED" ? "פולואפ הושלם" : "פולואפ";
  }
  if (item.kind === "INTERACTION") {
    return outcomeLabels[String(item.data.outcome)] ?? "אינטראקציה";
  }
  if (item.kind === "AGREEMENT") return "חוזה";
  return eventLabels[String(item.data.type)] ?? "עדכון בליד";
}

function itemBody(item: LeadTimelineItem) {
  if (item.kind === "NOTE") return String(item.data.body ?? "");
  if (item.kind === "INTERACTION") return String(item.data.note ?? "");
  if (item.kind === "FOLLOW_UP") return String(item.data.reason ?? "");
  if (item.kind === "AGREEMENT") {
    const status = item.data.status ? `סטטוס ${String(item.data.status)}` : "";
    const price =
      typeof item.data.monthlyPrice === "number"
        ? ` · ₪${item.data.monthlyPrice.toLocaleString("he-IL")} לחודש`
        : "";
    return `${status}${price}`;
  }
  return "";
}

export default function LeadActivityTimeline({
  items,
}: {
  items: LeadTimelineItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
        עדיין אין פעילות מתועדת.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const body = itemBody(item);
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="relative rounded-xl border border-gray-700 bg-gray-800 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-bold text-white">{itemTitle(item)}</p>
              <time
                dateTime={item.occurredAt}
                className="text-xs text-gray-500"
              >
                {new Date(item.occurredAt).toLocaleString("he-IL")}
              </time>
            </div>
            {body && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                {body}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              {item.actor?.name ?? "מערכת"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

