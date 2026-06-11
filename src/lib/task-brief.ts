/**
 * "Copy everything" for a task: builds a self-contained brief (title,
 * description, tags, comments + screenshots) and writes it to the clipboard
 * in two flavors at once:
 *  - text/html  → pasting into a rich target (email, docs, Claude) renders
 *    the text AND the images inline (absolute public attachment URLs)
 *  - text/plain → markdown-ish text with image URLs listed
 */

export interface BriefTask {
  title: string;
  description: string | null;
  dueDate: string | null;
  tags: string[];
  assignees: { name: string }[];
  comments: {
    content: string;
    createdAt: string;
    author: { name: string };
  }[];
  attachments: { id: string; filename: string }[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL");
}

function attachmentAbsoluteUrl(origin: string, id: string): string {
  return `${origin}/api/attachments/${id}`;
}

export function buildTaskBriefText(task: BriefTask, origin: string): string {
  const lines: string[] = [];
  lines.push(`משימה: ${task.title}`);
  if (task.dueDate) lines.push(`תאריך יעד: ${formatDate(task.dueDate)}`);
  if (task.tags.length > 0) lines.push(`תגיות: ${task.tags.join(", ")}`);
  if (task.assignees.length > 0)
    lines.push(`משויך ל: ${task.assignees.map((a) => a.name).join(", ")}`);

  if (task.description?.trim()) {
    lines.push("", "תיאור:", task.description.trim());
  }

  if (task.comments.length > 0) {
    lines.push("", "תגובות:");
    for (const c of task.comments) {
      lines.push(`- ${c.author.name} (${formatDate(c.createdAt)}): ${c.content}`);
    }
  }

  if (task.attachments.length > 0) {
    lines.push("", `תמונות (${task.attachments.length}):`);
    task.attachments.forEach((a, i) => {
      lines.push(`${i + 1}. ${attachmentAbsoluteUrl(origin, a.id)}`);
    });
  }

  return lines.join("\n");
}

export function buildTaskBriefHtml(task: BriefTask, origin: string): string {
  const parts: string[] = [];
  parts.push(`<div dir="rtl">`);
  parts.push(`<h2>${escapeHtml(task.title)}</h2>`);

  const meta: string[] = [];
  if (task.dueDate) meta.push(`תאריך יעד: ${formatDate(task.dueDate)}`);
  if (task.tags.length > 0) meta.push(`תגיות: ${escapeHtml(task.tags.join(", "))}`);
  if (task.assignees.length > 0)
    meta.push(`משויך ל: ${escapeHtml(task.assignees.map((a) => a.name).join(", "))}`);
  if (meta.length > 0) parts.push(`<p>${meta.join(" · ")}</p>`);

  if (task.description?.trim()) {
    parts.push(
      `<h3>תיאור</h3><p>${escapeHtml(task.description.trim()).replace(/\n/g, "<br>")}</p>`
    );
  }

  if (task.comments.length > 0) {
    parts.push(`<h3>תגובות</h3><ul>`);
    for (const c of task.comments) {
      parts.push(
        `<li><b>${escapeHtml(c.author.name)}</b> (${formatDate(c.createdAt)}): ${escapeHtml(c.content)}</li>`
      );
    }
    parts.push(`</ul>`);
  }

  if (task.attachments.length > 0) {
    parts.push(`<h3>תמונות (${task.attachments.length})</h3>`);
    for (const a of task.attachments) {
      const url = attachmentAbsoluteUrl(origin, a.id);
      parts.push(
        `<p><img src="${url}" alt="${escapeHtml(a.filename)}" style="max-width:100%"><br><a href="${url}">${escapeHtml(a.filename)}</a></p>`
      );
    }
  }

  parts.push(`</div>`);
  return parts.join("\n");
}

/**
 * Copy the brief to the clipboard. Returns the flavor that was written so
 * the caller can phrase the toast ("rich" includes inline images).
 */
export async function copyTaskBrief(task: BriefTask): Promise<"rich" | "plain"> {
  const origin = window.location.origin;
  const text = buildTaskBriefText(task, origin);
  const html = buildTaskBriefHtml(task, origin);

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      // fall through to plain text (e.g. permissions / older browsers)
    }
  }

  await navigator.clipboard.writeText(text);
  return "plain";
}
