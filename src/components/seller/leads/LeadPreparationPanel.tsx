import QualityScoreBadge from "@/components/seller/QualityScoreBadge";
import type { LeadDetail } from "@/lib/leads/projection";
import { auditedDomainWebsite } from "@/lib/prospecting/seller-view";

const websiteStatusLabels: Record<string, string> = {
  NO_WEBSITE: "אין אתר",
  SOCIAL_ONLY: "קיים רק עמוד ברשת חברתית",
  PARKED: "הדומיין אינו אתר פעיל",
  UNREACHABLE: "האתר אינו זמין",
  ACTIVE: "אתר פעיל",
  BLOCKED: "האתר חסם את הבדיקה",
  UNKNOWN: "סטטוס האתר אינו ודאי",
};

const scoreLabels = {
  availability: "אמינות וזמינות",
  performance: "מהירות ומובייל",
  seo: "SEO",
  maintenance: "תחזוקה ותוכן",
  visual: "נראות וחוויה",
  commercial: "יכולת מסחרית",
} as const;

const MAX_EVIDENCE_BRANCH_ITEMS = 8;
const MAX_EVIDENCE_ROOT_BRANCHES = 4;
const MAX_EVIDENCE_ARRAY_ITEMS = 8;
const MAX_EVIDENCE_OBJECT_ENTRIES = 12;
const MAX_EVIDENCE_DEPTH = 5;
const MAX_EVIDENCE_TEXT_LENGTH = 240;

function boundedText(value: string): string {
  const normalized = value.trim();
  return normalized.length <= MAX_EVIDENCE_TEXT_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_EVIDENCE_TEXT_LENGTH - 1)}…`;
}

function collectEvidenceLeaves(
  value: unknown,
  path: string[],
  result: Array<[string, string]>,
  limit: number,
  depth = 0,
): void {
  if (result.length >= limit || depth > MAX_EVIDENCE_DEPTH || value === null) {
    return;
  }

  if (typeof value === "string") {
    const text = boundedText(value);
    if (text) result.push([path.join(" › "), text]);
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    result.push([path.join(" › "), String(value)]);
    return;
  }
  if (typeof value === "boolean") {
    result.push([path.join(" › "), value ? "כן" : "לא"]);
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, MAX_EVIDENCE_ARRAY_ITEMS).forEach((entry, index) => {
      collectEvidenceLeaves(
        entry,
        [...path, `[${index + 1}]`],
        result,
        limit,
        depth + 1,
      );
    });
    return;
  }
  if (typeof value !== "object") return;

  Object.entries(value)
    .slice(0, MAX_EVIDENCE_OBJECT_ENTRIES)
    .forEach(([key, entry]) => {
      collectEvidenceLeaves(
        entry,
        [...path, key],
        result,
        limit,
        depth + 1,
      );
    });
}

function evidenceItems(
  value: Record<string, unknown> | null,
  groupLabel: string,
) {
  if (!value) return [];
  const result: Array<[string, string]> = [];
  Object.entries(value)
    .slice(0, MAX_EVIDENCE_ROOT_BRANCHES)
    .forEach(([key, entry]) => {
      collectEvidenceLeaves(
        entry,
        [groupLabel, key],
        result,
        result.length + MAX_EVIDENCE_BRANCH_ITEMS,
      );
    });
  return result;
}

function metaSourceAnswers(snapshot: Record<string, unknown> | null) {
  const answers = snapshot?.nonContactAnswers;
  if (!Array.isArray(answers)) return [];

  return answers.slice(0, 12).flatMap((answer) => {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
      return [];
    }
    const item = answer as Record<string, unknown>;
    const name =
      typeof item.name === "string" ? boundedText(item.name) : "";
    const values = Array.isArray(item.values)
      ? item.values
          .filter((value): value is string => typeof value === "string")
          .map((value) => boundedText(value))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    return name && values.length > 0 ? [{ name, values }] : [];
  });
}

function MetaAnswers({
  answers,
}: {
  answers: Array<{ name: string; values: string[] }>;
}) {
  if (answers.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <h3 className="font-bold text-white">תשובות מטופס הליד</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {answers.map((answer, index) => (
          <div
            key={`${answer.name}:${index}`}
            className="rounded-xl bg-gray-900 p-3 text-sm"
          >
            <dt className="text-xs text-gray-500">{answer.name}</dt>
            <dd className="mt-1 break-words text-gray-200">
              {answer.values.join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function LeadPreparationPanel({
  lead,
}: {
  lead: LeadDetail;
}) {
  const preparation = lead.preparation;
  const sourceAnswers = metaSourceAnswers(lead.sourceSnapshot);

  if (!preparation) {
    return (
      <div className="space-y-4">
        <MetaAnswers answers={sourceAnswers} />
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
          לליד הזה אין אבחון אתר מוקדם. פרטי המקור והקשר נשארים זמינים בראש
          העמוד.
        </div>
      </div>
    );
  }

  const technicalEvidence = evidenceItems(
    preparation.technicalEvidence,
    "טכני",
  );
  const visualEvidence = evidenceItems(preparation.visualEvidence, "חזותי");
  const displayWebsite =
    lead.website ??
    auditedDomainWebsite(
      preparation.auditedDomain,
      preparation.websiteStatus ?? "UNKNOWN",
    );

  return (
    <div className="space-y-4">
      <MetaAnswers answers={sourceAnswers} />

      {preparation.liveStatus === "UNAVAILABLE" && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          המידע החי מ־Google אינו זמין זמנית. האבחון והאתר שנבדקו נשמרו
          ומוצגים כרגיל.
        </div>
      )}

      {(lead.address ||
        lead.category ||
        preparation.rating !== null ||
        lead.mapUrl) && (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
          <h3 className="font-bold text-white">העסק והאזור</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-300">
            {lead.category && <span>{lead.category}</span>}
            {lead.address && <span>{lead.address}</span>}
            {preparation.rating !== null && (
              <span dir="ltr">
                ★ {preparation.rating.toFixed(1)}
                {preparation.reviewCount !== null
                  ? ` (${preparation.reviewCount})`
                  : ""}
              </span>
            )}
          </div>
          {lead.mapUrl && (
            <a
              href={lead.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-bold text-cyan hover:underline"
            >
              פתח ב־Google Maps ↗
            </a>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">מצב האתר שנבדק</h3>
            <p className="mt-1 text-sm text-gray-400">
              {preparation.websiteStatus
                ? websiteStatusLabels[preparation.websiteStatus] ??
                  preparation.websiteStatus
                : "לא סווג"}
            </p>
          </div>
          <QualityScoreBadge score={preparation.qualityScore} />
        </div>
        {displayWebsite ? (
          <a
            href={displayWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-bold text-cyan hover:underline"
          >
            <bdi dir="ltr">{displayWebsite}</bdi> ↗
          </a>
        ) : (
          <p className="mt-3 text-sm font-bold text-amber-300">
            {preparation.websiteStatus === "NO_WEBSITE"
              ? "אין אתר"
              : preparation.websiteStatus === "SOCIAL_ONLY"
                ? "לא נמצא אתר עצמאי"
                : "כתובת האתר שנבדקה אינה זמינה"}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-cyan/20 bg-cyan/5 p-4">
        <h3 className="font-bold text-cyan">הזדמנות מרכזית</h3>
        <p className="mt-2 text-sm leading-6 text-gray-200">
          {preparation.opportunitySummary ??
            "נמצאה הזדמנות לשיפור הנוכחות הדיגיטלית."}
        </p>
      </section>

      {preparation.scoreBreakdown && (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
          <h3 className="font-bold text-white">פירוט אבחון</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(scoreLabels).map(([key, label]) => {
              const value =
                preparation.scoreBreakdown?.[
                  key as keyof typeof preparation.scoreBreakdown
                ];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-gray-700 px-3 py-2 text-sm"
                >
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white">
                    {value === null || value === undefined ? "—" : value}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(technicalEvidence.length > 0 || visualEvidence.length > 0) && (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
          <h3 className="font-bold text-white">ראיות מהאבחון</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {[...technicalEvidence, ...visualEvidence].map(
              ([key, value], index) => (
                <div
                  key={`${key}:${index}`}
                  className="rounded-xl bg-gray-900 p-3"
                >
                  <dt className="text-xs text-gray-500">{key}</dt>
                  <dd className="mt-1 break-words text-gray-200">
                    {value}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-pink/20 bg-pink/5 p-4">
        <h3 className="font-bold text-pink">זוויות מוכנות לשיחה</h3>
        {preparation.callAngles.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {preparation.callAngles.slice(0, 3).map((angle, index) => (
              <li
                key={angle.id}
                className="flex gap-3 rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200"
              >
                <span className="font-bold text-pink">{index + 1}.</span>
                <span>
                  {angle.text}
                  <small className="mt-1 block text-xs text-gray-500">
                    גרסה {angle.version}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            לא נשמרו זוויות שיחה לאבחון הזה.
          </p>
        )}
      </section>
    </div>
  );
}
