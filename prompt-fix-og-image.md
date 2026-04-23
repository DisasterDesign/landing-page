## משימה: הוספת og:image מפורש לכל דפי המשנה

### רקע
בעמוד הראשי (`/`) קיים קובץ `src/app/opengraph-image.tsx` שמייצר תמונת OG דינמית (1200x630 PNG) עם הלוגו והברנדינג של Fuzion Webz. 
הקובץ הזה עובד מצוין עבור העמוד הראשי, אבל **דפי המשנה לא יורשים אותו** — פייסבוק מסיק (infer) את התמונה מתגיות אחרות ומציג את logo.svg במקום, מה שיוצר תצוגה מקדימה גרועה בשיתופים.

### מה צריך לעשות

**אפשרות 1 (מועדפת):** העתק את הקובץ `src/app/opengraph-image.tsx` לתוך כל תיקיית route של דפי המשנה:
- `src/app/(public)/about/opengraph-image.tsx`
- `src/app/(public)/contact/opengraph-image.tsx`
- `src/app/(public)/portfolio/opengraph-image.tsx`
- `src/app/(public)/fonts/opengraph-image.tsx`
- `src/app/(public)/blog/opengraph-image.tsx`
- `src/app/(public)/privacy/opengraph-image.tsx`
- `src/app/(public)/accessibility/opengraph-image.tsx`
- `src/app/(public)/terms/opengraph-image.tsx`

כל קובץ יכול להיות זהה לקובץ המקורי, או אם אפשר — להוסיף את שם הדף בתמונה (למשל "FUZION WEBZ — אודות").

**אפשרות 2 (חלופית):** הוסף שדה `images` בתוך ה-`openGraph` object ב-metadata export של כל דף. לדוגמה:

```typescript
openGraph: {
  title: `אודות | ${SITE_NAME}`,
  description: "...",
  images: [
    {
      url: `${SITE_URL}/opengraph-image`,
      width: 1200,
      height: 630,
      alt: "Fuzion Webz — סטודיו לעיצוב ובניית אתרים",
    },
  ],
},
```

### קבצים רלוונטיים
- `src/app/opengraph-image.tsx` — הקובץ המקורי שמייצר את תמונת ה-OG (עובד בעמוד הראשי)
- `src/lib/constants.ts` — מכיל את `SITE_URL` ו-`SITE_NAME`
- כל קבצי ה-`page.tsx` תחת `src/app/(public)/` שיש בהם `openGraph` ב-metadata

### הדפים שצריך לתקן
1. `/about` — `src/app/(public)/about/page.tsx`
2. `/contact` — `src/app/(public)/contact/page.tsx`
3. `/portfolio` — `src/app/(public)/portfolio/page.tsx`
4. `/fonts` — `src/app/(public)/fonts/page.tsx`
5. `/blog` — `src/app/(public)/blog/page.tsx`
6. `/privacy` — `src/app/(public)/privacy/page.tsx`
7. `/accessibility` — `src/app/(public)/accessibility/page.tsx`
8. `/terms` — `src/app/(public)/terms/page.tsx`
9. `/about/[slug]` — `src/app/(public)/about/[slug]/page.tsx`
10. `/portfolio/[slug]` — `src/app/(public)/portfolio/[slug]/page.tsx`
11. `/fonts/[slug]` — `src/app/(public)/fonts/[slug]/page.tsx`
12. `/blog/[slug]` — `src/app/(public)/blog/[slug]/page.tsx` (כבר יש תמיכה ב-coverImage — לוודא שיש fallback לתמונת ברירת מחדל)

### חשוב
- פייסבוק לא תומך ב-SVG לתמונות OG — חייב להיות PNG או JPG
- מידות מומלצות: 1200x630
- אחרי הדיפלוי, צריך לעשות scrape מחדש ב-Facebook Sharing Debugger
- לוודא שה-build עובר בלי שגיאות
