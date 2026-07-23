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

const channelLabels: Record<string, string> = {
  PHONE: "טלפון",
  WHATSAPP: "WhatsApp",
  EMAIL: "אימייל",
  OTHER: "אחר",
};

const stageLabels: Record<string, string> = {
  NEW: "חדש",
  PREPARING: "הכנה לשיחה",
  CONTACTING: "יצירת קשר",
  QUALIFIED: "ליד כשיר",
  AGREEMENT_DRAFT: "טיוטת חוזה",
  AGREEMENT_SENT: "חוזה שנשלח",
  AGREEMENT_SIGNED: "חוזה חתום",
  WON: "עסקה שנסגרה",
  LOST: "ליד אבוד",
  SPAM: "ספאם",
};

const intentLabels: Record<string, string> = {
  OUTBOUND: "פנייה קרה",
  AD_RESPONSE: "תגובה למודעה",
  INBOUND: "פנייה יזומה",
};

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  meta_lead_ads: "Meta Lead Ads",
  website: "אתר Fuzion",
  google_search_ads: "Google Search Ads",
  manual_outbound: "הזנה ידנית",
  direct_contact: "פנייה ישירה",
};

const lossReasonLabels: Record<string, string> = {
  NO_INTEREST: "אין עניין",
  NO_BUDGET: "אין תקציב",
  BAD_TIMING: "תזמון לא מתאים",
  EXISTING_PROVIDER: "כבר יש ספק",
  DECISION_MAKER_UNREACHABLE: "לא ניתן להגיע למקבל/ת ההחלטות",
  NOT_FIT: "לא מתאים",
  BAD_CONTACT: "פרטי קשר שגויים",
  DUPLICATE: "כפילות",
  BATCH_SUPERSEDED: "הוחלף במחזור חדש",
  DO_NOT_CONTACT: "בקשה לא ליצור קשר",
  OTHER: "אחר",
};

const changedFieldLabels: Record<string, string> = {
  name: "שם",
  company: "חברה",
  email: "אימייל",
  phone: "טלפון",
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function knownLabel(
  value: unknown,
  labels: Record<string, string>,
): string | null {
  return typeof value === "string" ? labels[value] ?? null : null;
}

function stageSummary(item: LeadTimelineItem): string | null {
  const fromStage = knownLabel(item.data.fromStage, stageLabels);
  const toStage = knownLabel(item.data.toStage, stageLabels);
  if (fromStage && toStage && fromStage !== toStage) {
    return `מעבר שלב: מ${fromStage} ל${toStage}`;
  }
  const current = toStage ?? fromStage;
  return current ? `שלב: ${current}` : null;
}

function auditChangeLines(metadata: Record<string, unknown>): string[] {
  const before = recordValue(metadata.before);
  const after = recordValue(metadata.after);
  if (!before || !after) return [];

  const fields = [
    {
      key: "intentLevel",
      label: "סוג פנייה",
      labels: intentLabels,
    },
    {
      key: "sourceKey",
      label: "מקור",
      labels: sourceLabels,
    },
    {
      key: "stage",
      label: "שלב",
      labels: stageLabels,
    },
  ] as const;

  const lines = fields.flatMap(({ key, label, labels }) => {
    const beforeLabel = knownLabel(before[key], labels);
    const afterLabel = knownLabel(after[key], labels);
    return beforeLabel && afterLabel && beforeLabel !== afterLabel
      ? [`${label}: לפני ${beforeLabel} · אחרי ${afterLabel}`]
      : [];
  });

  for (const [key, label] of [
    ["ownerId", "בעלות"],
    ["eligibleSellerId", "מוכר מתאים"],
  ] as const) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const validBefore =
      beforeValue === null ||
      (typeof beforeValue === "string" && beforeValue.length > 0);
    const validAfter =
      afterValue === null ||
      (typeof afterValue === "string" && afterValue.length > 0);
    if (!validBefore || !validAfter || beforeValue === afterValue) continue;
    if (beforeValue === null || afterValue === null) {
      lines.push(
        `${label}: לפני ${beforeValue === null ? "לא משויך" : "משויך"} · אחרי ${
          afterValue === null ? "לא משויך" : "משויך"
        }`,
      );
    } else {
      lines.push(`${label}: השיוך הוחלף`);
    }
  }

  return lines;
}

function eventBody(item: LeadTimelineItem): string {
  const lines: string[] = [];
  const stage = stageSummary(item);
  if (stage) lines.push(stage);

  const metadata = recordValue(item.data.metadata);
  if (!metadata) return lines.join("\n");

  const reason =
    typeof metadata.reason === "string" ? metadata.reason.trim() : "";
  if (reason) lines.push(`סיבה: ${reason.slice(0, 300)}`);

  const lossReason = knownLabel(metadata.lossReason, lossReasonLabels);
  if (lossReason) lines.push(`סיבת סגירה: ${lossReason}`);

  lines.push(...auditChangeLines(metadata));

  if (Array.isArray(metadata.changedFields)) {
    const fields = metadata.changedFields.flatMap((value) =>
      typeof value === "string" && changedFieldLabels[value]
        ? [changedFieldLabels[value]]
        : [],
    );
    if (fields.length > 0) {
      lines.push(`שדות שעודכנו: ${Array.from(new Set(fields)).join(", ")}`);
    }
  }

  return lines.join("\n");
}

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
  if (item.kind === "INTERACTION") {
    const channel =
      knownLabel(item.data.channel, channelLabels) ?? channelLabels.OTHER;
    const outcome =
      knownLabel(item.data.outcome, outcomeLabels) ?? "תוצאה לא מסווגת";
    const note =
      typeof item.data.note === "string" ? item.data.note.trim() : "";
    return [
      `ערוץ: ${channel} · תוצאה: ${outcome}`,
      item.data.decisionMakerReached === true
        ? "נוצר קשר עם מקבל/ת ההחלטות"
        : "",
      note,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (item.kind === "FOLLOW_UP") return String(item.data.reason ?? "");
  if (item.kind === "AGREEMENT") {
    const status = item.data.status ? `סטטוס ${String(item.data.status)}` : "";
    const price =
      typeof item.data.monthlyPrice === "number"
        ? ` · ₪${item.data.monthlyPrice.toLocaleString("he-IL")} לחודש`
        : "";
    return `${status}${price}`;
  }
  return eventBody(item);
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
