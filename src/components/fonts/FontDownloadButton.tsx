"use client";

import { useState } from "react";

interface FontDownloadButtonProps {
  onDownload: (data: { name: string; email: string }) => void;
}

export default function FontDownloadButton({
  onDownload,
}: FontDownloadButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);
    try {
      await onDownload({ name, email });
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="bg-pink hover:bg-pink/80 text-white px-8 py-3.5 rounded-xl text-lg font-bold transition-colors"
      >
        הורדה חינם
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 inline-flex flex-col gap-3 min-w-[280px]"
      dir="rtl"
    >
      <input
        type="text"
        placeholder="שם מלא *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
      />
      <input
        type="email"
        placeholder="אימייל *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !name || !email}
          className="flex-1 bg-pink hover:bg-pink/80 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          {submitting ? "שולח..." : "הורדה חינם"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
