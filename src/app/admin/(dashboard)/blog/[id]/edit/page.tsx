"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BlogEditor from "@/components/admin/BlogEditor";

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

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: string | null;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
  author: { id: string; name: string };
}

export default function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
  const [published, setPublished] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      try {
        // Fetch directly via admin-mode: use the edit endpoint to get the post (we use PATCH for update).
        // For fetching by ID, we'll just use the blog list API with all=true and find the post.
        const res = await fetch(`/api/blog?all=true&limit=100`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const post: BlogPost = data.posts?.find((p: BlogPost) => p.id === id);
        if (!post) {
          toast.error("מאמר לא נמצא");
          router.push("/admin/blog");
          return;
        }
        setTitle(post.title);
        setSlug(post.slug);
        setExcerpt(post.excerpt || "");
        setContent(post.content);
        setCategory(post.category || "");
        setTagsInput(post.tags.join(", "));
        setCoverImage(post.coverImage || "");
        setMetaTitle(post.metaTitle || "");
        setMetaDesc(post.metaDesc || "");
        setPublished(post.published);
      } catch {
        toast.error("שגיאה בטעינת המאמר");
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [id, router]);

  const handleSave = async (publish?: boolean) => {
    if (!title.trim()) {
      toast.error("יש להזין כותרת");
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        title,
        slug,
        excerpt: excerpt || undefined,
        content,
        category: category || undefined,
        tags,
        coverImage: coverImage || undefined,
        metaTitle: metaTitle || undefined,
        metaDesc: metaDesc || undefined,
      };

      if (typeof publish === "boolean") {
        body.published = publish;
        setPublished(publish);
      }

      const res = await fetch(`/api/blog/edit/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאה בשמירה");
      }

      toast.success("נשמר בהצלחה!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את המאמר?")) return;

    try {
      const res = await fetch(`/api/blog/edit/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("המאמר נמחק");
      router.push("/admin/blog");
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-12 bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">עריכת מאמר</h2>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="bg-red-900/50 hover:bg-red-900 text-red-400 hover:text-red-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            מחק
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            שמור
          </button>
          {published ? (
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-yellow-900/50 hover:bg-yellow-900 text-yellow-400 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              בטל פרסום
            </button>
          ) : (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-pink hover:bg-pink-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              פרסם
            </button>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-3">
        {published ? (
          <span className="bg-green-900/50 text-green-400 text-xs px-3 py-1 rounded-full font-medium">
            פורסם
          </span>
        ) : (
          <span className="bg-yellow-900/50 text-yellow-400 text-xs px-3 py-1 rounded-full font-medium">
            טיוטה
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">כותרת</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
        {coverImage && (
          <div className="mt-2 rounded-xl overflow-hidden border border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="כיסוי" className="w-full h-48 object-cover" />
          </div>
        )}
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
