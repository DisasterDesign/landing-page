"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import AssigneePicker from "@/components/admin/AssigneePicker";
import {
  attachmentUrl,
  ImageDropArea,
  imageSkipMessage,
  Lightbox,
  localId,
  prepareImages,
  ThumbGrid,
  uploadTaskImage,
  useImagePaste,
  type AttachmentMeta,
} from "@/components/admin/TaskImages";
import { copyTaskBrief } from "@/lib/task-brief";

interface Comment {
  id: string;
  content: string;
  author: { id: string; name: string };
  createdAt: string;
}

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  tags: string[];
  assignees: { id: string; name: string }[];
  comments: Comment[];
  attachments: AttachmentMeta[];
}

interface SelectOption {
  id: string;
  name: string;
}

interface UploadingImage {
  key: string;
  url: string;
  filename: string;
}

const toastStyle = {
  background: "#1A1A1A",
  color: "#fff",
  border: "1px solid #3A3A3A",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(
    null
  );

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");

  // Images state
  const [uploading, setUploading] = useState<UploadingImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      const [taskRes, usersRes] = await Promise.all([
        fetch(`/api/tasks/${id}`),
        fetch("/api/users"),
      ]);

      if (taskRes.ok) {
        const t = await taskRes.json();
        // Merge attachments instead of replacing: an upload that finished
        // while this fetch was in flight may not be in the server snapshot
        // yet, and a wholesale replace would silently drop it from the gallery.
        setTask((prev) => {
          const server: AttachmentMeta[] = t.attachments ?? [];
          const serverIds = new Set(server.map((a) => a.id));
          const localOnly = (prev?.attachments ?? []).filter(
            (a) => !serverIds.has(a.id)
          );
          return { ...t, attachments: [...server, ...localOnly] };
        });
        setTitle(t.title);
        setDescription(t.description || "");
        setAssigneeIds((t.assignees ?? []).map((a: { id: string }) => a.id));
        setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : "");
        setTags(t.tags?.join(", ") || "");
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch task:", err);
      toast.error("שגיאה בטעינת המשימה", { style: toastStyle });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          assigneeIds,
          dueDate: dueDate || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      if (res.ok) {
        toast.success("המשימה עודכנה בהצלחה", { style: toastStyle });
        fetchTask();
      } else {
        toast.error("שגיאה בעדכון המשימה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בעדכון המשימה", { style: toastStyle });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("המשימה נמחקה", { style: toastStyle });
        router.push("/admin/tasks");
      } else {
        toast.error("שגיאה במחיקת המשימה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה במחיקת המשימה", { style: toastStyle });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (res.ok) {
        setNewComment("");
        fetchTask();
        toast.success("תגובה נוספה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בהוספת תגובה", { style: toastStyle });
    }
  };

  // ---------- Images ----------

  const handleNewImages = useCallback(
    async (files: File[]) => {
      const prepared = await prepareImages(files, (name, reason) =>
        toast.error(imageSkipMessage(name, reason), { style: toastStyle })
      );

      let succeeded = 0;
      for (const img of prepared) {
        const key = localId();
        const previewUrl = URL.createObjectURL(img.blob);
        setUploading((prev) => [
          ...prev,
          { key, url: previewUrl, filename: img.filename },
        ]);
        try {
          const meta = await uploadTaskImage(id, img);
          succeeded++;
          setTask((prev) =>
            prev ? { ...prev, attachments: [...prev.attachments, meta] } : prev
          );
        } catch (err) {
          console.error("Upload failed:", err);
          toast.error("שגיאה בהעלאת התמונה", { style: toastStyle });
        } finally {
          setUploading((prev) => prev.filter((u) => u.key !== key));
          URL.revokeObjectURL(previewUrl);
        }
      }

      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? "התמונה הועלתה" : `${succeeded} תמונות הועלו`,
          { style: toastStyle }
        );
      }
    },
    [id]
  );

  useImagePaste(handleNewImages);

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setTask((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.filter((a) => a.id !== attachmentId),
            }
          : prev
      );
      toast.success("התמונה נמחקה", { style: toastStyle });
    } catch {
      toast.error("שגיאה במחיקת התמונה", { style: toastStyle });
    }
  };

  // ---------- Copy everything ----------

  const handleCopyAll = async () => {
    if (!task) return;
    setCopying(true);
    try {
      // Everything is sourced from the live form state ("copy what I see"),
      // not the last-saved snapshot — otherwise unsaved edits produce an
      // internally inconsistent brief.
      const assigneesFromForm =
        users.length > 0
          ? users.filter((u) => assigneeIds.includes(u.id))
          : task.assignees;
      const flavor = await copyTaskBrief({
        title,
        description: description || null,
        dueDate: dueDate || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        assignees: assigneesFromForm,
        comments: task.comments,
        attachments: task.attachments,
      });
      const imageCount = task.attachments.length;
      const imagesLabel =
        imageCount === 1 ? "תמונה אחת" : `${imageCount} תמונות`;
      if (imageCount === 0) {
        toast.success("הברייף הועתק ללוח", { style: toastStyle });
      } else if (flavor === "rich") {
        toast.success(`הועתק ללוח: טקסט + ${imagesLabel}`, {
          style: toastStyle,
        });
      } else {
        toast.success(
          imageCount === 1
            ? "הועתק כטקסט עם קישור לתמונה"
            : `הועתק כטקסט עם ${imageCount} קישורי תמונות`,
          { style: toastStyle }
        );
      }
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("שגיאה בהעתקה ללוח", { style: toastStyle });
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">המשימה לא נמצאה</p>
        <button
          onClick={() => router.push("/admin/tasks")}
          className="mt-4 text-pink hover:underline"
        >
          חזרה למשימות
        </button>
      </div>
    );
  }

  const selectClasses =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink transition-colors";
  const labelClasses = "block text-sm text-gray-400 mb-1.5";

  const galleryItems = [
    ...task.attachments.map((a) => ({
      key: a.id,
      url: attachmentUrl(a.id),
      filename: a.filename,
    })),
    ...uploading.map((u) => ({
      key: u.key,
      url: u.url,
      filename: u.filename,
      uploading: true,
    })),
  ];

  const lightboxImages = task.attachments.map((a) => ({
    url: attachmentUrl(a.id),
    filename: a.filename,
  }));

  return (
    <div className="tasks-area max-w-3xl mx-auto space-y-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => router.push("/admin/tasks")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          חזרה למשימות
        </button>

        <button
          onClick={handleCopyAll}
          disabled={copying}
          title="מעתיק ללוח את כל המשימה — טקסט, תגובות ותמונות — להדבקה אחת במייל / מסמך / צ'אט"
          className="flex items-center gap-2 px-4 py-2 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3"
            />
          </svg>
          {copying ? "מעתיק..." : "העתק הכל"}
        </button>
      </div>

      {/* Task Form */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        <div>
          <label className={labelClasses}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={selectClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${selectClasses} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>משויך ל</label>
            <AssigneePicker
              users={users}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
            />
          </div>

          <div>
            <label className={labelClasses}>תאריך יעד</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={selectClasses}
              dir="ltr"
            />
          </div>

          <div>
            <label className={labelClasses}>תגיות (מופרדות בפסיק)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={selectClasses}
              placeholder="עיצוב, פרונט, באג"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2.5 bg-red-900/40 hover:bg-red-900/70 text-red-300 font-bold rounded-xl transition-colors text-sm"
          >
            מחק משימה
          </button>
        </div>
      </div>

      {/* Images */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">תמונות</h3>
          {task.attachments.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {task.attachments.length}
            </span>
          )}
        </div>

        <ImageDropArea onFiles={handleNewImages} busy={uploading.length > 0}>
          <ThumbGrid
            items={galleryItems}
            onOpen={(i) => {
              if (i < task.attachments.length) setLightboxIndex(i);
            }}
            onRemove={(key) => setAttachmentToDelete(key)}
          />
          {galleryItems.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              אין תמונות עדיין — הדבק צילום מסך מהלקוח ישירות לכאן (Ctrl+V / ⌘V)
            </p>
          )}
        </ImageDropArea>
      </div>

      {/* Attachment Delete Confirmation */}
      {attachmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold">מחיקת תמונה</h3>
            <p className="text-gray-400 text-sm">
              למחוק את התמונה? פעולה זו בלתי הפיכה.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const target = attachmentToDelete;
                  setAttachmentToDelete(null);
                  handleRemoveAttachment(target);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                מחק
              </button>
              <button
                onClick={() => setAttachmentToDelete(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold">מחיקת משימה</h3>
            <p className="text-gray-400 text-sm">
              האם אתה בטוח שברצונך למחוק את המשימה &quot;{task.title}&quot;?
              פעולה זו בלתי הפיכה.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                מחק
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-bold">תגובות</h3>

        {task.comments && task.comments.length > 0 ? (
          <div className="space-y-4">
            {task.comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[10px] font-bold">
                      {comment.author.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium">
                      {comment.author.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString("he-IL")}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{comment.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">אין תגובות עדיין</p>
        )}

        <form onSubmit={handleAddComment} className="flex gap-3">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="הוסף תגובה..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-pink transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-xl transition-colors text-sm"
          >
            שלח
          </button>
        </form>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
