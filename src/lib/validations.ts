import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  service: z.string().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["TODO", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  projectId: z.string().optional(),
  assigneeIds: z.array(z.string().min(1)).min(1, "At least one assignee required"),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  projectId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).min(1).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const reorderTasksSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      status: z.enum(["TODO", "DONE"]),
    })
  ),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  client: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  client: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Content is required"),
  taskId: z.string().min(1, "Task ID is required"),
});

// ==================
// AGREEMENTS
// ==================

export const agreementTierEnum = z.enum(["LANDING", "BASIC", "ADVANCED", "PREMIUM"]);
export const agreementStatusEnum = z.enum(["DRAFT", "SENT", "SIGNED", "CANCELLED"]);

export const agreementLocaleEnum = z.enum(["he", "en"]);

export const createAgreementSchema = z.object({
  tier: agreementTierEnum.nullable().optional(),
  additionalServices: z.array(z.string().min(1).max(300)).max(30).optional().default([]),
  monthlyPrice: z.number().positive("מחיר חודשי חייב להיות חיובי"),
  oneTimeFee: z.number().positive().nullable().optional(),
  customerName: z.string().min(1, "שם חובה"),
  businessName: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().min(9, "טלפון לא תקין"),
  email: z.string().email("אימייל לא תקין"),
  clientId: z.string().optional(),
  // Foreign clients: English contract/page + zero-rate VAT. Driven by one
  // "foreign client" toggle in the admin UI; stored as two fields.
  locale: agreementLocaleEnum.optional().default("he"),
  vatExempt: z.boolean().optional().default(false),
});

export const updateAgreementSchema = z.object({
  status: agreementStatusEnum.optional(),
  tier: agreementTierEnum.nullable().optional(),
  additionalServices: z.array(z.string().min(1).max(300)).max(30).optional(),
  monthlyPrice: z.number().positive().optional(),
  oneTimeFee: z.number().positive().nullable().optional(),
  customerName: z.string().min(1).optional(),
  businessName: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  phone: z.string().min(9).optional(),
  email: z.string().email().optional(),
  clientId: z.string().nullable().optional(),
  locale: agreementLocaleEnum.optional(),
  vatExempt: z.boolean().optional(),
});

export const signAgreementSchema = z.object({
  customerName: z.string().min(1),
  businessName: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().min(9),
  email: z.string().email(),
  signatureData: z.string().min(1, "חתימה חובה"),
});

// ==================
// CLIENTS
// ==================

export const clientPatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  expense: z.number().min(0).nullable().optional(),
  cardcomFee: z.number().min(0).nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
});

export const createClientNoteSchema = z.object({
  body: z.string().min(1, "תוכן הפתק חובה").max(5000),
});

// ==================
// EXPENSES
// ==================

export const expenseCategoryEnum = z.enum([
  "LLM_API",
  "SERVERS",
  "HOSTING",
  "DOMAINS",
  "SAAS",
  "PAYMENTS",
  "ADVERTISING",
  "PROFESSIONAL",
  "OTHER",
]);

export const createExpenseSchema = z.object({
  name: z.string().min(1, "שם ההוצאה חובה").max(200),
  vendor: z.string().min(1, "ספק חובה").max(200),
  category: expenseCategoryEnum.default("OTHER"),
  isFixed: z.boolean().default(true),
  amount: z.number().min(0),
  currency: z.enum(["ILS", "USD", "EUR"]).default("ILS"),
  frequency: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
  clientId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().default(true),
  startedAt: z.string().nullable().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// ==================
// ONE-OFF JOBS
// ==================

export const createJobSchema = z.object({
  // Attach to an existing client OR create a lightweight one by name.
  clientId: z.string().nullable().optional(),
  clientName: z.string().max(200).nullable().optional(),
  title: z.string().min(1, "תיאור העבודה חובה").max(200),
  amount: z.number().min(0),
  vatIncluded: z.boolean().default(false),
  cardcomFee: z.boolean().default(false),
  closedAt: z.string().min(1, "תאריך סגירה חובה"),
  paymentTermsDays: z.number().int().min(0).max(365).default(60),
  paidAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine((d) => d.clientId || (d.clientName && d.clientName.trim()), {
  message: "יש לבחור לקוח או להזין שם לקוח חדש",
  path: ["clientId"],
});

export const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  vatIncluded: z.boolean().optional(),
  cardcomFee: z.boolean().optional(),
  closedAt: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  paidAt: z.string().nullable().optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const bulkClientUrlsSchema = z.object({
  updates: z
    .array(
      z.object({
        clientId: z.string().min(1),
        websiteUrl: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(500),
});

// Blog
export const blogPostStatusEnum = z.enum([
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
]);

export const createBlogPostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  targetKeyword: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  status: blogPostStatusEnum.optional(),
});

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  targetKeyword: z.string().nullable().optional(),
  keywords: z.array(z.string()).optional(),
  status: blogPostStatusEnum.optional(),
});

export const scheduleBlogPostSchema = z.object({
  scheduledAt: z.string().datetime().nullable(),
});

export const bulkCreateBlogPostSchema = z.object({
  posts: z.array(createBlogPostSchema).min(1).max(50),
});

export const bulkScheduleBlogPostSchema = z.object({
  startDate: z.string().datetime().optional(),
  intervalDays: z.number().int().min(1).max(90).optional(),
});

export const reviewBlogPostSchema = z.object({
  postId: z.string().min(1),
  contentScore: z.number().int().min(0).max(100),
  reviewNotes: z.string().optional(),
});

// ==================
// FONT STORE
// ==================

export const createFontFamilySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  description: z.string().optional(),
  designer: z.string().optional(),
  previewUrl: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const updateFontFamilySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  designer: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const createFontStyleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  weight: z.number().int().min(100).max(900),
  fontFileUrl: z.string().min(1, "Font file URL is required"),
  pricePersonal: z.number().min(0),
  priceCommercial: z.number().min(0),
});

export const createFontOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().optional(),
  fontFamilyId: z.string().min(1, "Font family ID is required"),
  licenseType: z.enum(["PERSONAL", "COMMERCIAL"]),
});
