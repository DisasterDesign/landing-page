"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "serif", label: "סריף" },
  { value: "sans", label: "סאנס" },
  { value: "display", label: "דיספליי" },
  { value: "script", label: "סקריפט" },
  { value: "mono", label: "מונו" },
];

interface FontStyle {
  id: string;
  name: string;
  weight: number;
  fontFileUrl: string;
  pricePersonal: number;
  priceCommercial: number;
}

interface FontFamily {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  designer: string | null;
  previewUrl: string | null;
  category: string | null;
  tags: string[];
  featured: boolean;
  published: boolean;
  styles: FontStyle[];
}

export default function EditFontPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    designer: "",
    category: "",
    previewUrl: "",
    tags: "",
    featured: false,
    published: false,
  });

  const [styles, setStyles] = useState<FontStyle[]>([]);
  const [newStyle, setNewStyle] = useState({
    name: "",
    weight: 400,
    fontFileUrl: "",
    pricePersonal: 0,
    priceCommercial: 0,
  });
  const [addingStyle, setAddingStyle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  useEffect(() => {
    fetch(`/api/fonts/admin/${id}`)
      .then((res) => res.json())
      .then((data: FontFamily) => {
        setForm({
          name: data.name,
          description: data.description || "",
          designer: data.designer || "",
          category: data.category || "",
          previewUrl: data.previewUrl || "",
          tags: data.tags.join(", "),
          featured: data.featured,
          published: data.published,
        });
        setStyles(data.styles);
        setLoading(false);
      })
      .catch(() => {
        setError("שגיאה בטעינת הפונט");
        setLoading(false);
      });
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/fonts/admin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setSuccess("הפונט עודכן בהצלחה");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStyle = async () => {
    setAddingStyle(true);
    setError("");

    try {
      const res = await fetch(`/api/fonts/admin/${id}/styles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStyle),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add style");
      }

      const style = await res.json();
      setStyles([...styles, style]);
      setNewStyle({
        name: "",
        weight: 400,
        fontFileUrl: "",
        pricePersonal: 0,
        priceCommercial: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהוספת סגנון");
    } finally {
      setAddingStyle(false);
    }
  };

  const handleDeleteStyle = async (styleId: string) => {
    if (!confirm("למחוק סגנון זה?")) return;

    try {
      const res = await fetch(`/api/fonts/admin/${id}/styles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      setStyles(styles.filter((s) => s.id !== styleId));
    } catch {
      setError("שגיאה במחיקת הסגנון");
    }
  };

  const handleDelete = async () => {
    if (!confirm("למחוק את הפונט הזה לצמיתות?")) return;

    try {
      const res = await fetch(`/api/fonts/admin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/admin/fonts");
    } catch {
      setError("שגיאה במחיקת הפונט");
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-12">טוען...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">עריכת פונט</h1>
          <p className="text-gray-400 text-sm mt-1">{form.name}</p>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-900/30 hover:bg-red-900/60 border border-red-800 text-red-300 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          מחק פונט
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-800 text-green-300 rounded-lg px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Font Family Form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">פרטי הפונט</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              שם הפונט *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תיאור
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                מעצב
              </label>
              <input
                type="text"
                value={form.designer}
                onChange={(e) =>
                  setForm({ ...form, designer: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                קטגוריה
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              >
                <option value="">בחר קטגוריה</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תמונת תצוגה (URL)
            </label>
            <input
              type="text"
              value={form.previewUrl}
              onChange={(e) =>
                setForm({ ...form, previewUrl: e.target.value })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תגיות (מופרדות בפסיק)
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
                className="accent-pink w-4 h-4"
              />
              <span className="text-sm text-gray-300">מומלץ</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
                className="accent-pink w-4 h-4"
              />
              <span className="text-sm text-gray-300">פרסם</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-pink hover:bg-pink/80 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
      </form>

      {/* Styles Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">סגנונות</h2>

        {/* Existing Styles */}
        {styles.length > 0 ? (
          <div className="space-y-2">
            {styles.map((style) => (
              <div
                key={style.id}
                className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white font-medium">{style.name}</span>
                  <span className="text-gray-400 text-xs">
                    משקל: {style.weight}
                  </span>
                  <span className="text-gray-400 text-xs">
                    אישי: {style.pricePersonal}₪
                  </span>
                  <span className="text-gray-400 text-xs">
                    מסחרי: {style.priceCommercial}₪
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteStyle(style.id)}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  מחק
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">אין סגנונות עדיין</p>
        )}

        {/* Add Style Form */}
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">הוסף סגנון</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="שם (לדוגמה: Regular)"
              value={newStyle.name}
              onChange={(e) =>
                setNewStyle({ ...newStyle, name: e.target.value })
              }
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
            <input
              type="number"
              placeholder="משקל (400)"
              value={newStyle.weight}
              onChange={(e) =>
                setNewStyle({ ...newStyle, weight: Number(e.target.value) })
              }
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">קובץ פונט</label>
              <input
                type="file"
                accept=".otf,.ttf,.woff,.woff2"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadedFileName("");
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("fontSlug", form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                    const res = await fetch("/api/fonts/admin/upload", {
                      method: "POST",
                      body: fd,
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || "Upload failed");
                    }
                    const data = await res.json();
                    setNewStyle({ ...newStyle, fontFileUrl: data.url });
                    setUploadedFileName(file.name);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
                  } finally {
                    setUploading(false);
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors file:mr-3 file:bg-gray-700 file:border-0 file:text-gray-300 file:rounded file:px-3 file:py-1 file:text-xs file:cursor-pointer"
              />
              {uploading && <p className="text-cyan text-xs mt-1">מעלה...</p>}
              {uploadedFileName && !uploading && (
                <p className="text-green-400 text-xs mt-1">{uploadedFileName}</p>
              )}
            </div>
            <input
              type="number"
              placeholder="מחיר אישי (₪)"
              value={newStyle.pricePersonal || ""}
              onChange={(e) =>
                setNewStyle({
                  ...newStyle,
                  pricePersonal: Number(e.target.value),
                })
              }
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
            <input
              type="number"
              placeholder="מחיר מסחרי (₪)"
              value={newStyle.priceCommercial || ""}
              onChange={(e) =>
                setNewStyle({
                  ...newStyle,
                  priceCommercial: Number(e.target.value),
                })
              }
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleAddStyle}
            disabled={addingStyle || uploading || !newStyle.name || !newStyle.fontFileUrl}
            className="bg-cyan hover:bg-cyan/80 disabled:opacity-50 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {addingStyle ? "מוסיף..." : "הוסף סגנון"}
          </button>
        </div>
      </div>
    </div>
  );
}
