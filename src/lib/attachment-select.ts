/**
 * Shared Prisma select for TaskAttachment metadata. Never select `data`
 * outside the binary-serving route — attachment bytes can be hundreds of KB
 * each and would bloat every task fetch.
 */
export const attachmentMetaSelect = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  createdAt: true,
} as const;
