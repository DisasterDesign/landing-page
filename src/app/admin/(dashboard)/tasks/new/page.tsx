"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import AssigneePicker from "@/components/admin/AssigneePicker";
import {
  ImageDropArea,
  imageSkipMessage,
  Lightbox,
  localId,
  prepareImages,
  ThumbGrid,
  uploadTaskImage,
  useImagePaste,
  type PendingImage,
} from "@/components/admin/TaskImages";

interface User {
  id: string;
  name: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.users || [];
        setUsers(list);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        toast.error("שגיאה בטעינת רשימת המשתמשים");
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  // Revoke preview object URLs on unmount
  useEffect(() => {
    return () => {
      setPendingImages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return prev;
      });
    };
  }, []);

  const handleNewImages = useCallback(async (files: File[]) => {
    setProcessingImages(true);
    try {
      const prepared = await prepareImages(files, (name, reason) =>
        toast.error(imageSkipMessage(name, reason))
      );
      if (prepared.length > 0) {
        setPendingImages((prev) => [
          ...prev,
          ...prepared.map((compressed) => ({
            localId: localId(),
            compressed,
            previewUrl: URL.createObjectURL(compressed.blob),
          })),
        ]);
      }
    } finally {
      setProcessingImages(false);
    }
  }, []);

  useImagePaste(handleNewImages);

  const removePendingImage = (localId: string) => {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("כותרת היא שדה חובה");
      return;
    }

    if (assigneeIds.length === 0) {
      toast.error("יש לבחור לפחות משתמש אחד");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeIds,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שגיאה ביצירת המשימה");
      }

      const task = await res.json();

      // Upload collected screenshots one by one (keeps each request small)
      let failed = 0;
      if (pendingImages.length > 0) {
        const progressToast = toast.loading(
          `מעלה תמונות (0/${pendingImages.length})...`
        );
        for (let i = 0; i < pendingImages.length; i++) {
          toast.loading(`מעלה תמונות (${i + 1}/${pendingImages.length})...`, {
            id: progressToast,
          });
          try {
            await uploadTaskImage(task.id, pendingImages[i].compressed);
          } catch (err) {
            console.error("Upload failed:", err);
            failed++;
          }
        }
        toast.dismiss(progressToast);
      }

      if (failed > 0) {
        toast.error(
          failed === 1
            ? "המשימה נוצרה, אך תמונה אחת לא הועלתה — ניתן להוסיף אותה מעמוד המשימה"
            : `המשימה נוצרה, אך ${failed} תמונות לא הועלו — ניתן להוסיף אותן מעמוד המשימה`
        );
      } else {
        toast.success(
          pendingImages.length === 0
            ? "המשימה נוצרה בהצלחה!"
            : pendingImages.length === 1
              ? "המשימה נוצרה עם תמונה אחת!"
              : `המשימה נוצרה עם ${pendingImages.length} תמונות!`
        );
      }
      router.push(`/admin/tasks/${task.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה ביצירת המשימה";
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="tasks-area max-w-2xl mx-auto space-y-6" dir="rtl">
      <Toaster position="top-center" />

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold">משימה חדשה</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            כותרת <span className="text-pink">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="למשל: עיצוב דף הבית"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור המשימה..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors resize-none"
          />
        </div>

        {/* Images */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            תמונות
            {pendingImages.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full mr-2">
                {pendingImages.length}
              </span>
            )}
          </label>
          <ImageDropArea onFiles={handleNewImages} busy={processingImages}>
            <ThumbGrid
              items={pendingImages.map((p) => ({
                key: p.localId,
                url: p.previewUrl,
                filename: p.compressed.filename,
              }))}
              onOpen={setLightboxIndex}
              onRemove={removePendingImage}
            />
            {pendingImages.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">
                קיבלת צילומי מסך מהלקוח? פשוט הדבק אותם כאן (Ctrl+V / ⌘V) —
                הם יועלו אוטומטית עם יצירת המשימה
              </p>
            )}
          </ImageDropArea>
        </div>

        {/* Assignees */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            משויך ל <span className="text-pink">*</span>
          </label>
          {loadingUsers ? (
            <div className="h-10 bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <AssigneePicker
              users={users}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
            />
          )}
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">תאריך יעד</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "יוצר..." : "צור משימה"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-colors"
          >
            ביטול
          </button>
        </div>
      </form>

      {lightboxIndex !== null && (
        <Lightbox
          images={pendingImages.map((p) => ({
            url: p.previewUrl,
            filename: p.compressed.filename,
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
