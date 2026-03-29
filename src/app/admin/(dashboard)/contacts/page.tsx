"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  service: string | null;
  isRead: boolean;
  createdAt: string;
}

const toastStyle = {
  background: "#1A1A1A",
  color: "#fff",
  border: "1px solid #3A3A3A",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : data.contacts || []);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (res.ok) {
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isRead: true } : c))
        );
        toast.success("סומן כנקרא", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בעדכון", { style: toastStyle });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-2xl border border-gray-700 h-20 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />

      <h2 className="text-2xl font-bold">הודעות</h2>

      {contacts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">אין הודעות עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => {
            const isExpanded = expandedId === contact.id;

            return (
              <div
                key={contact.id}
                className={`bg-gray-900 rounded-2xl border transition-colors ${
                  contact.isRead
                    ? "border-gray-700"
                    : "border-pink/30"
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : contact.id)
                  }
                  className="w-full flex items-center justify-between p-5 text-right"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {!contact.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-pink flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm truncate ${
                          contact.isRead
                            ? "text-gray-300 font-normal"
                            : "text-white font-bold"
                        }`}
                      >
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {contact.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {new Date(contact.createdAt).toLocaleDateString("he-IL")}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-5 space-y-4">
                    {contact.service && (
                      <div>
                        <span className="text-xs text-gray-500">שירות:</span>
                        <span className="text-sm text-gray-300 mr-2">
                          {contact.service}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs text-gray-500 block mb-1">
                        הודעה:
                      </span>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {contact.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      {!contact.isRead && (
                        <button
                          onClick={() => markAsRead(contact.id)}
                          className="px-4 py-2 bg-pink/20 hover:bg-pink/30 text-pink font-bold rounded-xl transition-colors text-xs"
                        >
                          סמן כנקרא
                        </button>
                      )}

                      {contact.phone && (
                        <a
                          href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-900/40 hover:bg-green-900/60 text-green-300 font-bold rounded-xl transition-colors text-xs"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          שלח בוואטסאפ
                        </a>
                      )}

                      <a
                        href={`mailto:${contact.email}`}
                        className="px-4 py-2 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-xl transition-colors text-xs"
                      >
                        שלח אימייל
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
