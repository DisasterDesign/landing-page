"use client";

export interface AdminLeadFilterValues {
  search: string;
  intent: string;
  source: string;
  owner: string;
  stage: string;
  from: string;
  to: string;
  territory: string;
  minScore: string;
  maxScore: string;
  businessCategory: string;
  dateField: string;
  overdue: string;
  reviewRequired: string;
}

export const emptyAdminLeadFilters: AdminLeadFilterValues = {
  search: "",
  intent: "",
  source: "",
  owner: "",
  stage: "",
  from: "",
  to: "",
  territory: "",
  minScore: "",
  maxScore: "",
  businessCategory: "",
  dateField: "createdAt",
  overdue: "",
  reviewRequired: "",
};

const inputClass =
  "rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-pink";

export default function LeadFilters({
  values,
  sellers,
  onChange,
  onApply,
  onReset,
}: {
  values: AdminLeadFilterValues;
  sellers: Array<{ id: string; name: string }>;
  onChange: (values: AdminLeadFilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  function set<K extends keyof AdminLeadFilterValues>(
    key: K,
    value: AdminLeadFilterValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={values.search}
          onChange={(event) => set("search", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onApply();
          }}
          placeholder="חיפוש שם, עסק, אימייל או טלפון"
          className={`${inputClass} xl:col-span-2`}
        />
        <select
          value={values.intent}
          onChange={(event) => set("intent", event.target.value)}
          className={inputClass}
        >
          <option value="">כל רמות הליד</option>
          <option value="OUTBOUND">פנייה קרה</option>
          <option value="AD_RESPONSE">תגובה לפרסומת</option>
          <option value="INBOUND">פנייה יזומה</option>
        </select>
        <select
          value={values.source}
          onChange={(event) => set("source", event.target.value)}
          className={inputClass}
        >
          <option value="">כל המקורות</option>
          <option value="google_maps">Google Maps</option>
          <option value="meta_lead_ads">Meta Lead Ads</option>
          <option value="website">אתר</option>
          <option value="google_search_ads">Google Search</option>
        </select>
        <select
          value={values.owner}
          onChange={(event) => set("owner", event.target.value)}
          className={inputClass}
        >
          <option value="">כל הבעלים</option>
          <option value="UNASSIGNED">ללא בעלים</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </select>
        <select
          value={values.stage}
          onChange={(event) => set("stage", event.target.value)}
          className={inputClass}
        >
          <option value="">כל השלבים</option>
          {[
            "NEW",
            "PREPARING",
            "CONTACTING",
            "QUALIFIED",
            "AGREEMENT_DRAFT",
            "AGREEMENT_SENT",
            "AGREEMENT_SIGNED",
            "WON",
            "LOST",
            "SPAM",
          ].map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <input
          value={values.territory}
          onChange={(event) => set("territory", event.target.value)}
          placeholder="רחוב / אזור"
          className={inputClass}
        />
        <select
          value={values.businessCategory}
          onChange={(event) => set("businessCategory", event.target.value)}
          className={inputClass}
        >
          <option value="">כל סוגי העסקים</option>
          <option value="SERVICE">שירות</option>
          <option value="RETAIL">קמעונאות</option>
          <option value="ECOMMERCE">מסחר דיגיטלי</option>
          <option value="UNKNOWN">לא מסווג</option>
        </select>
        <select
          value={values.minScore}
          onChange={(event) => set("minScore", event.target.value)}
          className={inputClass}
        >
          <option value="">ציון מינימום</option>
          {[0, 1, 2, 3, 4, 5].map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
        <select
          value={values.maxScore}
          onChange={(event) => set("maxScore", event.target.value)}
          className={inputClass}
        >
          <option value="">ציון מקסימום</option>
          {[0, 1, 2, 3, 4, 5].map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
        <select
          value={values.overdue}
          onChange={(event) => set("overdue", event.target.value)}
          className={inputClass}
        >
          <option value="">כל הפולואפים</option>
          <option value="true">באיחור</option>
          <option value="false">לא באיחור</option>
        </select>
        <select
          value={values.reviewRequired}
          onChange={(event) => set("reviewRequired", event.target.value)}
          className={inputClass}
        >
          <option value="">כל מצבי ההגירה</option>
          <option value="true">דורש סיווג</option>
          <option value="false">מסווג</option>
        </select>
        <select
          value={values.dateField}
          onChange={(event) => set("dateField", event.target.value)}
          className={inputClass}
        >
          <option value="createdAt">לפי תאריך יצירה</option>
          <option value="lastActivityAt">לפי פעילות אחרונה</option>
        </select>
        <input
          type="date"
          value={values.from}
          onChange={(event) => set("from", event.target.value)}
          className={inputClass}
          aria-label="מתאריך"
        />
        <input
          type="date"
          value={values.to}
          onChange={(event) => set("to", event.target.value)}
          className={inputClass}
          aria-label="עד תאריך"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-dark"
        >
          החל סינון
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-bold text-gray-300"
        >
          נקה
        </button>
      </div>
    </section>
  );
}
