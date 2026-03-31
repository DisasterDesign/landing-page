"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BlogEditor from "@/components/admin/BlogEditor";

function generateSlug(title: string): string {
  return (
    title
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0590-\u05FF-]/g, "")
      .toLowerCase() +
    "-" +
    Date.now().toString(36)
  );
}

const CATEGORIES = [
  "מדריכים",
  "עיצוב",
  "פיתוח",
  "SEO",
  "שיווק דיגיטלי",
  "ביצועים",
  "מסחר אלקטרוני",
  "טכנולוגיה",
  "כללי",
];

export default function NewBlogPostPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setSlug(generateSlug(value));
  };

  const handleSubmit = async (publish: boolean) => {
    if (!title.trim()) {
      toast.error("יש להזין כותרת");
      return;
    }
    if (!content.trim() || content === "<p></p>") {
      toast.error("יש להזין תוכן");
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
          excerpt: excerpt || undefined,
          content,
          category: category || undefined,
          tags,
          coverImage: coverImage || undefined,
          metaTitle: metaTitle || undefined,
          metaDesc: metaDesc || undefined,
          published: publish,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאה בשמירה");
      }

      const post = await res.json();
      toast.success(publish ? "המאמר פורסם!" : "הטיוטה נשמרה!");
      router.push(`/admin/blog/${post.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">מאמר חדש</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            שמור טיוטה
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="bg-pink hover:bg-pink-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            פרסם
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">כותרת</label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="כותרת המאמר"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Slug (כתובת URL)</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug-of-the-post"
          dir="ltr"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors text-left"
        />
      </div>

      {/* Excerpt */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">תקציר</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="תיאור קצר של המאמר"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors resize-none"
        />
      </div>

      {/* Category + Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">קטגוריה</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          >
            <option value="">בחר קטגוריה</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">תגיות (מופרדות בפסיק)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="עיצוב, פיתוח, SEO"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          />
        </div>
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">תמונת כיסוי (URL)</label>
        <input
          type="text"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://example.com/image.jpg"
          dir="ltr"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors text-left"
        />
      </div>

      {/* Content Editor */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">תוכן</label>
        <BlogEditor content={content} onChange={setContent} />
      </div>

      {/* SEO */}
      <div className="border border-gray-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-300">SEO</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Meta Title</label>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="כותרת לגוגל"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Meta Description</label>
          <textarea
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            placeholder="תיאור לגוגל"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  );
}
