"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";

interface Client {
  id: string;
  number: number;
  name: string;
  status: string;
  notes: string | null;
  amount: number | null;
  expense: number | null;
}

type EditableField = "name" | "status" | "notes" | "amount" | "expense";

interface EditingCell {
  id: string;
  field: EditableField;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

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
    const value =
      field === "amount" || field === "expense"
        ? client[field] != null
          ? String(client[field])
          : ""
        : (client[field] as string) ?? "";
    setEditValue(value);
    setEditingCell({ id: client.id, field });
  };

  const saveCell = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    // Check if value actually changed
    const oldValue =
      field === "amount" || field === "expense"
        ? client[field] != null
          ? String(client[field])
          : ""
        : (client[field] as string) ?? "";

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

    // Optimistic update
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "amount" || field === "expense") {
          return { ...c, [field]: patchValue as number | null };
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
    if (!confirm(`למחוק את ${client?.name || "לקוח"}?`)) return;

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

  const totalAmount = clients.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const totalExpense = clients.reduce((sum, c) => sum + (c.expense ?? 0), 0);
  const totalProfit = totalAmount - totalExpense;

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

    let display: string;
    if (field === "status") {
      display = statusDisplay(client.status);
    } else if (field === "amount" || field === "expense") {
      display = formatNum(client[field]);
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
    <div dir="rtl" className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">לקוחות</h1>
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

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-12">#</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[160px]">שם הלקוח</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">סטטוס</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">הערות</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">סכום (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">הוצאה (₪)</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">רווח (₪)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const profit =
                client.amount != null
                  ? client.amount - (client.expense ?? 0)
                  : null;
              const isSaving = savingIds.has(client.id);

              return (
                <tr
                  key={client.id}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 group transition-colors ${
                    isSaving ? "opacity-70" : ""
                  }`}
                >
                  <td className="px-3 py-1 text-gray-500 font-mono text-xs">
                    {client.number}
                  </td>
                  <td className="px-1 py-0.5">{renderCell(client, "name")}</td>
                  <td className="px-1 py-0.5">{renderCell(client, "status")}</td>
                  <td className="px-1 py-0.5">{renderCell(client, "notes")}</td>
                  <td className="px-1 py-0.5 font-mono">{renderCell(client, "amount")}</td>
                  <td className="px-1 py-0.5 font-mono">{renderCell(client, "expense")}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {profit != null ? (
                      <span
                        className={
                          profit >= 0 ? "text-green-400" : "text-red-400"
                        }
                      >
                        {formatNum(profit)}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                      title="מחק"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800/80 border-t border-gray-600 font-medium">
              <td className="px-3 py-2.5" colSpan={4}>
                <span className="text-gray-400">סה&quot;כ ({clients.length} לקוחות)</span>
              </td>
              <td className="px-3 py-2.5 font-mono text-white">
                {formatNum(totalAmount)}
              </td>
              <td className="px-3 py-2.5 font-mono text-white">
                {formatNum(totalExpense)}
              </td>
              <td className="px-3 py-2.5 font-mono">
                <span
                  className={
                    totalProfit >= 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {formatNum(totalProfit)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
