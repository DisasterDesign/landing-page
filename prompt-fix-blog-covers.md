# פרומפט: תיקון תמונות כיסוי שבורות בכרטיסי בלוג

## הבעיה
בדף `/blog`, כל כרטיסי הבלוג מציגים אייקון תמונה שבורה (broken image).

### שורש הבעיה
ב-`src/app/(public)/blog/BlogPageClient.tsx` שורה 157:
```tsx
src={post.coverImage || `/blog/${post.slug}/opengraph-image`}
```

ה-fallback ל-`/blog/${slug}/opengraph-image` **לא עובד** כי:
1. הקובץ `src/app/(public)/blog/[slug]/opengraph-image.tsx` הוא **Next.js metadata convention** — הוא מייצר תמונות OG אוטומטית עבור metadata בלבד
2. כשניגשים ישירות ל-URL `/blog/some-slug/opengraph-image`, Next.js מפרש את "opengraph-image" כ-`[slug]` parameter ב-`page.tsx`, לא מוצא פוסט עם slug כזה, ומחזיר 404
3. שדה `coverImage` הוא null בכל הפוסטים (נוצרו אוטומטית בלי תמונות)

## הפתרון המומלץ

### אפשרות א': יצירת API route ייעודי לתמונות בלוג (מומלץ)

צור `src/app/api/blog/og/[slug]/route.tsx`:
```tsx
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderBlogPostOgImage, renderOgImage } from "@/lib/og-image";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug: decodeURIComponent(slug), published: true },
    select: { title: true, category: true },
  });

  if (!post) {
    return renderOgImage("Blog");
  }

  return renderBlogPostOgImage(post.title, post.category);
}
```

ואז עדכן את ה-fallback ב-`BlogPageClient.tsx`:
```tsx
src={post.coverImage || `/api/blog/og/${post.slug}`}
```

### אפשרות ב': גישה חלופית — placeholder סטטי
אם אפשרות א' לא עובדת (למשל בעיית תלות של `og-image` בסביבת edge), פשוט השתמש ב-placeholder:
```tsx
src={post.coverImage || `/images/blog-placeholder.png`}
```
ותיצור תמונת placeholder גנרית ב-`public/images/blog-placeholder.png`.

## הנחיות
- בדוק שה-API route עובד ע"י גישה ל-`/api/blog/og/SLUG` בדפדפן — אמור להחזיר תמונה PNG
- ודא שגם ב-`BlogPostClient.tsx` (עמוד הפוסט עצמו) אין שימוש באותו fallback שבור
- אחרי התיקון: `npm run build` + push
