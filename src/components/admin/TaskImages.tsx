"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compressImage,
  imagesFromDrop,
  type CompressedImage,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-compress";

// ---------- Types ----------

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface PendingImage {
  localId: string;
  compressed: CompressedImage;
  previewUrl: string;
}

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}

/**
 * Local-only identifier for React keys / in-flight upload tracking.
 * crypto.randomUUID is secure-context-only (missing over LAN http in dev),
 * so fall back to Math.random — no cryptographic requirement here.
 */
export function localId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type ImageSkipReason = "too-big" | "unsupported";

export function imageSkipMessage(name: string, reason: ImageSkipReason): string {
  return reason === "too-big"
    ? `"${name}" גדולה מדי (מקסימום 4MB)`
    : `"${name}" אינה תמונה נתמכת`;
}

// ---------- Upload helper ----------

export async function uploadTaskImage(
  taskId: string,
  img: CompressedImage
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append(
    "file",
    new File([img.blob], img.filename, {
      type: img.blob.type || "image/png",
    })
  );
  formData.append("width", String(img.width));
  formData.append("height", String(img.height));

  const res = await fetch(`/api/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  return res.json();
}

export async function prepareImages(
  files: File[],
  onSkip?: (name: string, reason: ImageSkipReason) => void
): Promise<CompressedImage[]> {
  const out: CompressedImage[] = [];
  for (const file of files) {
    try {
      const compressed = await compressImage(file);
      if (compressed.blob.size > MAX_UPLOAD_BYTES) {
        onSkip?.(file.name || "image", "too-big");
        continue;
      }
      out.push(compressed);
    } catch (err) {
      // Decode/re-encode failure (corrupt file, HEIC on Chrome, etc.) — not a
      // size problem, so report it as an unsupported image.
      console.error("Failed to process image:", err);
      onSkip?.(file.name || "image", "unsupported");
    }
  }
  return out;
}

// ---------- Paste hook ----------

/**
 * Listen for Ctrl/Cmd+V anywhere on the page and hand off pasted image files.
 * Text pastes are untouched (no image items → handler not called).
 */
export function useImagePaste(onFiles: (files: File[]) => void) {
  const handlerRef = useRef(onFiles);
  useEffect(() => {
    handlerRef.current = onFiles;
  });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      // Excel/Word/rich clipboards carry an image rendition NEXT TO the text.
      // When the user pastes into a text field and there is a text flavor,
      // let the text paste through instead of hijacking it as an image upload.
      const target = e.target as HTMLElement | null;
      const isTextTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        !!target?.isContentEditable;
      const hasText = data.types.includes("text/plain");
      if (isTextTarget && hasText) return;

      const files: File[] = [];
      for (const item of Array.from(data.items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handlerRef.current(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}

// ---------- Drop area ----------

export function ImageDropArea({
  onFiles,
  busy,
  children,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = imagesFromDrop(e);
        if (files.length > 0) onFiles(files);
      }}
      className={`rounded-xl border-2 border-dashed transition-colors p-4 space-y-3 ${
        dragOver ? "border-pink bg-pink/5" : "border-gray-700"
      }`}
    >
      {children}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">
          הדבק צילומי מסך (Ctrl+V / ⌘V) או גרור לכאן
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          בחר תמונות
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </div>
    </div>
  );
}

// ---------- Lightbox ----------

export interface LightboxImage {
  url: string;
  filename: string;
}

export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const current = images[index];

  const prev = useCallback(() => {
    onNavigate((index - 1 + images.length) % images.length);
  }, [index, images.length, onNavigate]);
  const next = useCallback(() => {
    onNavigate((index + 1) % images.length);
  }, [index, images.length, onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // RTL layout: the "prev" button sits on the RIGHT, so the right-arrow
      // key goes back and the left-arrow key advances.
      if (e.key === "ArrowRight") prev();
      if (e.key === "ArrowLeft") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="סגור"
        onClick={onClose}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="הקודם"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="הבא"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      )}

      <figure
        className="max-w-[92vw] max-h-[88vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-xl"
        />
        <figcaption className="text-xs text-gray-400" dir="ltr">
          {current.filename}
          {images.length > 1 && (
            <span className="text-gray-600"> · {index + 1}/{images.length}</span>
          )}
        </figcaption>
      </figure>
    </div>
  );
}

// ---------- Thumbnail grid ----------

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function ThumbGrid({
  items,
  onOpen,
  onRemove,
}: {
  items: { key: string; url: string; filename: string; uploading?: boolean }[];
  onOpen: (index: number) => void;
  onRemove?: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {items.map((item, i) => (
        <div
          key={item.key}
          className="relative group aspect-square rounded-xl overflow-hidden border border-gray-700 bg-gray-800"
        >
          <button
            type="button"
            onClick={() => onOpen(i)}
            className="w-full h-full"
            title={item.filename}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.filename}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>

          {item.uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
              <Spinner />
            </div>
          )}

          {onRemove && !item.uploading && (
            <button
              type="button"
              aria-label="הסר תמונה"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.key);
              }}
              className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-gray-300 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
