"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { parseUrlPaste, type ParsedRow } from "@/lib/import-urls";
import { confirmDanger } from "@/lib/confirm";
import { tapMedium } from "@/lib/haptic";

interface Client {
  id: string;
  number: number;
  name: string;
  status: string;
  notes: string | null;
  partner: string;
  amount: number | null;
  expense: number | null;
  cardcomFee: number | null;
  websiteUrl: string | null;
  source: string | null;
  startDate: string | null;
  paymentDate: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  agreement_signed: "מהסכם חתום",
  manual: "ידני",
  lead_converted: "מליד",
  import: "ייבוא",
};

type EditableField = "name" | "status" | "notes" | "partner" | "amount" | "expense" | "websiteUrl" | "startDate" | "paymentDate";

const PARTNER_OPTIONS = ["fuzion", "אחר"] as const;

// Israeli VAT rate as of January 2025 (raised from 17%); still 18% in 2026.
const VAT_RATE = 18;
// CardCom merchant fee on every charged transaction.
const CARDCOM_FEE_RATE = 0.02;

const computeVat = (amount: number | null) => ((amount ?? 0) * VAT_RATE) / (100 + VAT_RATE);
const computeCardcomFee = (amount: number | null) => (amount ?? 0) * CARDCOM_FEE_RATE;
const computeNetProfit = (c: Pick<Client, "amount" | "expense">) =>
  ((c.amount ?? 0) * 100) / (100 + VAT_RATE) - (c.expense ?? 0) - computeCardcomFee(c.amount);

interface EditingCell {
  id: string;
  field: EditableField;
}

interface ImportRow {
  parsed: ParsedRow;
  matchedClientId: string | null;
  apply: boolean;
}

function matchClient(name: string, clients: Client[]): Client | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const exact = clients.find((c) => c.name.trim().toLowerCase() === target);
  if (exact) return exact;
  const loose = clients.filter((c) => {
    const n = c.name.trim().toLowerCase();
    if (!n) return false;
    return n.includes(target) || target.includes(n);
  });
  return loose.length === 1 ? loose[0] : null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // URL bulk import
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"paste" | "preview">("paste");
  const [importText, setImportText] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [applying, setApplying] = useState(false);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [clients]
  );

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setClients(data.data);
    } catch {
      toast.error("שגיאה בטעינת לקוחות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (editingCell) {
      if (editingCell.field === "status") {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [editingCell]);

  const startEditing = (client: Client, field: EditableField) => {
    let value: string;
    if (field === "amount" || field === "expense") {
      value = client[field] != null ? String(client[field]) : "";
    } else if (field === "startDate" || field === "paymentDate") {
      value = client[field] ? new Date(client[field]!).toISOString().split("T")[0] : "";
    } else if (field === "partner") {
      value = client.partner || "fuzion";
    } else {
      value = (client[field] as string) ?? "";
    }
    setEditValue(value);
    setEditingCell({ id: client.id, field });
  };

  const saveCell = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    // Check if value actually changed
    let oldValue: string;
    if (field === "amount" || field === "expense") {
      oldValue = client[field] != null ? String(client[field]) : "";
    } else if (field === "startDate" || field === "paymentDate") {
      oldValue = client[field] ? new Date(client[field]!).toISOString().split("T")[0] : "";
    } else if (field === "partner") {
      oldValue = client.partner || "fuzion";
    } else {
      oldValue = (client[field] as string) ?? "";
    }

    if (editValue === oldValue) {
      setEditingCell(null);
      return;
    }

    let patchValue: unknown = editValue;
    if (field === "amount" || field === "expense") {
      patchValue = editValue === "" ? null : parseFloat(editValue);
      if (editValue !== "" && isNaN(patchValue as number)) {
        toast.error("ערך לא תקין");
        setEditingCell(null);
        return;
      }
    }
    if (field === "startDate" || field === "paymentDate") {
      patchValue = editValue || null;
    }

    // Optimistic update
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "amount" || field === "expense") {
          return { ...c, [field]: patchValue as number | null };
        }
        if (field === "startDate" || field === "paymentDate") {
          return { ...c, [field]: patchValue ? new Date(patchValue as string).toISOString() : null };
        }
        if (field === "partner") {
          return { ...c, partner: editValue || "fuzion" };
        }
        return { ...c, [field]: editValue };
      })
    );
    setEditingCell(null);

    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: patchValue }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("נשמר", { duration: 1500, style: { fontSize: "13px" } });
    } catch {
      toast.error("שגיאה בשמירה");
      fetchClients(); // Revert on error
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveCell();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const addClient = async () => {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const newClient = await res.json();
      setClients((prev) => [...prev, newClient]);
      toast.success("לקוח חדש נוסף");
      // Auto-start editing the name
      setTimeout(() => startEditing(newClient, "name"), 100);
    } catch {
      toast.error("שגיאה ביצירת לקוח");
    }
  };

  const deleteClient = async (id: string) => {
    const client = clients.find((c) => c.id === id);
    const ok = await confirmDanger({
      title: `מחיקת לקוח`,
      message: `הלקוח "${client?.name || "לקוח"}" יימחק לצמיתות. הפעולה אינה הפיכה.`,
      confirmLabel: "מחק",
      dangerous: true,
    });
    if (!ok) return;

    tapMedium();
    setClients((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("נמחק");
    } catch {
      toast.error("שגיאה במחיקה");
      fetchClients();
    }
  };

  const openImport = () => {
    setImportText("");
    setImportRows([]);
    setImportStep("paste");
    setImportOpen(true);
  };

  const runParse = () => {
    const parsed = parseUrlPaste(importText);
    if (parsed.length === 0) {
      toast.error("לא זוהו שורות תקינות");
      return;
    }
    const rows: ImportRow[] = parsed.map((row) => {
      const matched = matchClient(row.name, clients);
      return {
        parsed: row,
        matchedClientId: matched?.id ?? null,
        apply: !!matched,
      };
    });
    setImportRows(rows);
    setImportStep("preview");
  };

  const applyImport = async () => {
    const updates = importRows
      .filter((r) => r.apply && r.matchedClientId)
      .map((r) => ({ clientId: r.matchedClientId as string, websiteUrl: r.parsed.url }));

    if (updates.length === 0) {
      toast.error("אין שורות לעדכון");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/clients/bulk-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "שגיאה");
      }
      const json = (await res.json()) as { updated: number };
      toast.success(`עודכנו ${json.updated} לקוחות`);
      setImportOpen(false);
      fetchClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setApplying(false);
    }
  };

  const totalAmount = clients.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const totalVat = clients.reduce((sum, c) => sum + computeVat(c.amount), 0);
  const totalCardcom = clients.reduce((sum, c) => sum + computeCardcomFee(c.amount), 0);
  const totalExpense = clients.reduce((sum, c) => sum + (c.expense ?? 0), 0);
  const totalNetProfit = clients.reduce((sum, c) => sum + computeNetProfit(c), 0);

  const formatNum = (n: number | null) =>
    n != null ? n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : "";

  const statusDisplay = (status: string) => {
    if (status === "בוצע") return "✅ בוצע";
    if (status === "חצי") return "חצי";
    return "";
  };

  const renderCell = (client: Client, field: EditableField) => {
    const isEditing =
      editingCell?.id === client.id && editingCell?.field === field;

    if (isEditing && field === "status") {
      return (
        <select
          ref={selectRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Save immediately on selection
            const val = e.target.value;
            setClients((prev) =>
              prev.map((c) =>
                c.id === client.id ? { ...c, status: val } : c
              )
            );
            setEditingCell(null);
            setSavingIds((prev) => new Set(prev).add(client.id));
            fetch(`/api/clients/${client.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: val }),
            })
              .then((res) => {
                if (!res.ok) throw new Error();
                toast.success("נשמר", { duration: 1500, style: { fontSize: "13px" } });
              })
              .catch(() => {
                toast.error("שגיאה בשמירה");
                fetchClients();
              })
              .finally(() => {
                setSavingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(client.id);
                  return next;
                });
              });
          }}
          onBlur={() => setEditingCell(null)}
          className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-pink/50 outline-none"
        >
          <option value="">ריק</option>
          <option value="בוצע">✅ בוצע</option>
          <option value="חצי">חצי</option>
        </select>
      );
    }

    if (isEditing && field === "partner") {
      return (
        <select
          ref={selectRef}
          value={editValue}
          onChange={(e) => {
            const val = e.target.value;
            setEditValue(val);
            setClients((prev) =>
              prev.map((c) => (c.id === client.id ? { ...c, partner: val } : c))
            );
            setEditingCell(null);
            setSavingIds((prev) => new Set(prev).add(client.id));
            fetch(`/api/clients/${client.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ partner: val }),
            })
              .then((res) => {
                if (!res.ok) throw new Error();
                toast.success("נשמר", { duration: 1500, style: { fontSize: "13px" } });
              })
              .catch(() => {
                toast.error("שגיאה בשמירה");
                fetchClients();
              })
              .finally(() => {
                setSavingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(client.id);
                  return next;
                });
              });
          }}
          onBlur={() => setEditingCell(null)}
          className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-pink/50 outline-none"
        >
          {PARTNER_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      );
    }

    if (isEditing && (field === "startDate" || field === "paymentDate")) {
      return (
        <input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
          }}
          onBlur={saveCell}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-pink/50 outline-none"
        />
      );
    }

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={field === "amount" || field === "expense" ? "number" : "text"}
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveCell}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-pink/50 outline-none"
        />
      );
    }

    // Special render: website URL → globe icon link
    if (field === "websiteUrl") {
      const url = client.websiteUrl;
      return (
        <div className="flex items-center gap-1.5 min-h-[32px]">
          {url ? (
            <a
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:underline text-xs flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-700/30"
              title={url}
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-9v18m-9-9h18" />
              </svg>
              פתח
            </a>
          ) : null}
          <button
            onClick={() => startEditing(client, "websiteUrl")}
            className="cursor-pointer text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-700/50 transition-colors"
            title="ערוך כתובת"
          >
            {url ? "✎" : "+ הוסף"}
          </button>
        </div>
      );
    }

    if (field === "partner") {
      const p = client.partner || "fuzion";
      const isFuzion = p === "fuzion";
      return (
        <div
          onClick={() => startEditing(client, field)}
          className="cursor-pointer px-2 py-1.5 min-h-[32px] hover:bg-gray-700/50 rounded transition-colors"
        >
          <span
            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isFuzion
                ? "bg-pink/15 text-pink"
                : "bg-gray-700/40 text-gray-400"
            }`}
          >
            {p}
          </span>
        </div>
      );
    }

    let display: string;
    if (field === "status") {
      display = statusDisplay(client.status);
    } else if (field === "amount" || field === "expense") {
      display = formatNum(client[field]);
    } else if (field === "startDate" || field === "paymentDate") {
      display = client[field] ? new Date(client[field]!).toLocaleDateString("he-IL") : "";
    } else {
      display = (client[field] as string) ?? "";
    }

    return (
      <div
        onClick={() => startEditing(client, field)}
        className="cursor-pointer px-2 py-1.5 min-h-[32px] hover:bg-gray-700/50 rounded transition-colors"
      >
        {display || <span className="text-gray-600">-</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchClients}>
    <div dir="rtl" className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">לקוחות</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openImport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-700 hover:border-cyan text-gray-300 hover:text-cyan rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3M12 4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            ייבא URLs
          </button>
          <button
            onClick={addClient}
            className="flex items-center gap-2 px-4 py-2 bg-pink text-white rounded-lg hover:bg-pink/80 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            הוסף לקוח
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-12">#</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[160px]">שם הלקוח</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">אתר</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">סטטוס</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">שותפים</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">סכום (כולל מע״מ ₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-gray-700/40">מע״מ 18% (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-gray-700/40">עמלת CardCom 2% (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">הוצאה נוספת (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-gray-700/40">רווח נקי (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך התחלה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך תשלום</th>
              <th className="w-12 sticky left-0 bg-gray-800 z-10 border-l border-gray-700 md:static md:border-l-0"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const vat = client.amount != null ? computeVat(client.amount) : null;
              const cardcomFee = client.amount != null ? computeCardcomFee(client.amount) : null;
              const netProfit = client.amount != null ? computeNetProfit(client) : null;
              const isSaving = savingIds.has(client.id);

              return (
                <tr
                  key={client.id}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 group transition-colors ${
                    isSaving ? "opacity-70" : ""
                  }`}
                >
                  <td className="px-3 py-1 text-gray-500 font-mono text-xs">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="hover:text-pink"
                      title="פתח כרטיס לקוח"
                    >
                      #{client.number}
                    </Link>
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">{renderCell(client, "name")}</div>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="shrink-0 text-gray-500 hover:text-pink p-1.5 rounded hover:bg-gray-700/50"
                        title="פתח כרטיס לקוח"
                        aria-label="פתח כרטיס לקוח"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                    {client.source && SOURCE_LABEL[client.source] ? (
                      <div className="px-2 mt-0.5">
                        <span className="inline-block text-[10px] text-gray-500">
                          {SOURCE_LABEL[client.source]}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-1 py-0.5">{renderCell(client, "websiteUrl")}</td>
                  <td className="px-1 py-0.5">{renderCell(client, "status")}</td>
                  <td className="px-1 py-0.5">{renderCell(client, "partner")}</td>
                  <td className="px-1 py-0.5 font-mono">{renderCell(client, "amount")}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-300 bg-gray-700/20">
                    {vat != null ? formatNum(vat) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-gray-300 bg-gray-700/20">
                    {cardcomFee != null ? formatNum(cardcomFee) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-1 py-0.5 font-mono">{renderCell(client, "expense")}</td>
                  <td className="px-3 py-1.5 font-mono bg-gray-700/20">
                    {netProfit != null ? (
                      <span
                        className={
                          netProfit >= 0 ? "text-green-400" : "text-red-400"
                        }
                      >
                        {formatNum(netProfit)}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-1 py-0.5">{renderCell(client, "startDate")}</td>
                  <td className="px-1 py-0.5">{renderCell(client, "paymentDate")}</td>
                  <td className="px-1 py-0.5 sticky left-0 bg-gray-950 group-hover:bg-gray-800/50 z-10 border-l border-gray-800 md:static md:border-l-0 md:bg-transparent">
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="text-gray-500 hover:text-red-400 active:text-red-400 transition-colors p-2 -m-1"
                      title="מחק"
                      aria-label={`מחק את ${client.name || "לקוח"}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800/80 border-t border-gray-600 font-medium">
              <td className="px-3 py-2.5" colSpan={5}>
                <span className="text-gray-400">סה&quot;כ ({clients.length} לקוחות)</span>
              </td>
              <td className="px-3 py-2.5 font-mono text-white">
                {formatNum(totalAmount)}
              </td>
              <td className="px-3 py-2.5 font-mono text-gray-300 bg-gray-700/20">
                {formatNum(totalVat)}
              </td>
              <td className="px-3 py-2.5 font-mono text-gray-300 bg-gray-700/20">
                {formatNum(totalCardcom)}
              </td>
              <td className="px-3 py-2.5 font-mono text-white">
                {formatNum(totalExpense)}
              </td>
              <td className="px-3 py-2.5 font-mono bg-gray-700/20">
                <span
                  className={
                    totalNetProfit >= 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {formatNum(totalNetProfit)}
                </span>
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title={importStep === "paste" ? "ייבוא URLs ללקוחות" : "תצוגה מקדימה"}
      >
        {importStep === "paste" ? (
          <div dir="rtl" className="space-y-3">
            <p className="text-xs text-gray-400">
              הדבק כל לקוח בשורה משלו. הפורמט גמיש: שם<span className="font-mono mx-1">TAB</span>URL,
              או שם <span className="font-mono">|</span> URL, או שם, URL.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              dir="ltr"
              placeholder="Acme Bakery&#9;https://acme.co.il&#10;Foo Cafe | foo.example&#10;Bar Restaurant, www.bar.co.il"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink font-mono"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={runParse}
                disabled={!importText.trim()}
                className="flex-1 bg-cyan/20 hover:bg-cyan/30 disabled:opacity-50 text-cyan font-bold py-2.5 rounded-xl transition-colors"
              >
                פרסר ובדוק התאמות
              </button>
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <div dir="rtl" className="space-y-3">
            <div className="text-xs text-gray-400">
              {importRows.filter((r) => r.apply && r.matchedClientId).length} שורות יעודכנו מתוך{" "}
              {importRows.length} שזוהו
            </div>
            <div className="overflow-y-auto max-h-[50vh] border border-gray-700 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="text-right px-2 py-2 text-gray-400">שם בקלט</th>
                    <th className="text-right px-2 py-2 text-gray-400">לקוח שזוהה</th>
                    <th className="text-right px-2 py-2 text-gray-400">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => {
                    const matched = row.matchedClientId
                      ? clients.find((c) => c.id === row.matchedClientId)
                      : null;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-800 ${
                          !row.matchedClientId ? "bg-yellow-500/5" : ""
                        }`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={row.apply && !!row.matchedClientId}
                            disabled={!row.matchedClientId}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((r, j) => (j === i ? { ...r, apply: e.target.checked } : r))
                              )
                            }
                            className="accent-pink"
                          />
                        </td>
                        <td className="px-2 py-2 text-white">{row.parsed.name}</td>
                        <td className="px-2 py-2">
                          <select
                            value={row.matchedClientId ?? ""}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((r, j) =>
                                  j === i
                                    ? {
                                        ...r,
                                        matchedClientId: e.target.value || null,
                                        apply: !!e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-pink"
                          >
                            <option value="">— לא נמצא —</option>
                            {sortedClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                #{c.number} {c.name}
                              </option>
                            ))}
                          </select>
                          {matched && row.matchedClientId === matched.id && row.parsed.name.trim().toLowerCase() !== matched.name.trim().toLowerCase() && (
                            <div className="text-[10px] text-yellow-400 mt-0.5">
                              התאמה משוערת
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-cyan font-mono text-[11px] break-all" dir="ltr">
                          {row.parsed.url}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={applyImport}
                disabled={
                  applying || importRows.filter((r) => r.apply && r.matchedClientId).length === 0
                }
                className="flex-1 bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                {applying
                  ? "מעדכן..."
                  : `החל ${importRows.filter((r) => r.apply && r.matchedClientId).length} עדכונים`}
              </button>
              <button
                onClick={() => setImportStep("paste")}
                disabled={applying}
                className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
              >
                חזרה
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </PullToRefresh>
  );
}
