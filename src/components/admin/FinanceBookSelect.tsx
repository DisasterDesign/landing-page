"use client";

import { useEffect, useState } from "react";

export type SelectableFinanceBook = "PRIVATE" | "SHARED";

// Fail closed until the persisted viewer has been loaded from the server.
export function useFinanceOwner() {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/finance", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (response.ok) setIsOwner((await response.json()).viewer?.isOwner === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return isOwner;
}

export default function FinanceBookSelect({ value, onChange, disabled = false }: {
  value: SelectableFinanceBook | "";
  onChange: (value: SelectableFinanceBook) => void;
  disabled?: boolean;
}) {
  return <label className="block text-xs text-gray-400 space-y-1">
    <span>שיוך כספי</span>
    <select aria-label="שיוך כספי" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as SelectableFinanceBook)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60">
      {value === "" && <option value="" disabled>דורש בדיקת שיוך</option>}
      <option value="PRIVATE">שלי בלבד</option>
      <option value="SHARED">משותף עם רועי</option>
    </select>
  </label>;
}

export function FinanceBookBadge({ book }: { book?: string }) {
  return <span className="text-[10px] text-gray-400">{book === "PRIVATE" ? "שלי בלבד" : book === "SHARED" ? "משותף" : "דורש בדיקת שיוך"}</span>;
}
