import QualityScoreBadge from "@/components/seller/QualityScoreBadge";
import type { LeadDetail } from "@/lib/leads/projection";

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

function evidenceItems(value: Record<string, unknown> | null) {
  if (!value) return [];
  return Object.entries(value)
    .filter(([, entry]) =>
      ["string", "number", "boolean"].includes(typeof entry),
    )
    .slice(0, 8);
}

export default function LeadPreparationPanel({
  lead,
}: {
  lead: LeadDetail;
}) {
  const preparation = lead.preparation;

  if (!preparation) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
        לליד הזה אין אבחון אתר מוקדם. פרטי המקור והקשר נשארים זמינים בראש
        העמוד.
      </div>
    );
  }

  const technicalEvidence = evidenceItems(preparation.technicalEvidence);
  const visualEvidence = evidenceItems(preparation.visualEvidence);

  return (
    <div className="space-y-4">
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
        {lead.website ? (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-bold text-cyan hover:underline"
          >
            <bdi dir="ltr">{lead.website}</bdi> ↗
          </a>
        ) : preparation.auditedDomain ? (
          <a
            href={`https://${preparation.auditedDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-bold text-cyan hover:underline"
          >
            <bdi dir="ltr">{preparation.auditedDomain}</bdi> ↗
          </a>
        ) : (
          <p className="mt-3 text-sm font-bold text-amber-300">אין אתר</p>
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
            {[...technicalEvidence, ...visualEvidence].map(([key, value]) => (
              <div key={key} className="rounded-xl bg-gray-900 p-3">
                <dt className="text-xs text-gray-500">{key}</dt>
                <dd className="mt-1 break-words text-gray-200">
                  {String(value)}
                </dd>
              </div>
            ))}
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
