# מערכת SEO ומעקב מאמרים חיצוניים — ארכיטקטורה ותוכנית עבודה

## סקירה

מודול חדש במערכת הניהול שייתן ל-Fuzion Webz נתונים עסקיים אמיתיים על נוכחות בגוגל ועל תרומת מאמרים חיצוניים — בלי לשלם לאף שירות צד שלישי.

**מקורות מידע**:
1. **Google Search Console** — מילים, מיקומים, קישורים נכנסים
2. **Google Analytics 4** — תנועה ממקורות חיצוניים, התנהגות
3. **DB מקומי** — קישורי UTM שייצרת + היסטוריה למגמות

---

## ארכיטקטורה

### זרימה ברמה גבוהה

```
┌─────────────────────────────────────────────────────────────┐
│  המשתמש (אדמין) → /admin/seo                                │
│       │                                                      │
│       │ קליק "חבר חשבון גוגל"                               │
│       ▼                                                      │
│  OAuth של גוגל (פעם אחת) → אסימון נשמר מוצפן ב-DB           │
│                                                              │
│  Cron יומי (03:00) ──► מושך מ-GSC + GA4 ──► שומר ב-DB      │
│                                                              │
│  המשתמש פותח דף → קורא מ-DB → מציג גרפים וטבלאות           │
└─────────────────────────────────────────────────────────────┘
```

**למה לקאש ב-DB ולא לקרוא ישירות מ-API בכל בקשה?**

- גוגל מגביל את ה-API (כ-1,200 קריאות ביום)
- הדף נטען מהר (אלפיות שנייה במקום שניות)
- אפשר לחשב מגמות (השבוע מול שבוע שעבר)
- עובד גם אם ה-API של גוגל נופל

### רכיבים חדשים שאוסיף

```
src/
├── app/
│   ├── admin/(dashboard)/seo/
│   │   ├── page.tsx              # דף ראשי + סקירה
│   │   ├── keywords/page.tsx     # רשימת מילות חיפוש
│   │   ├── pages/page.tsx        # דפים מובילים
│   │   ├── backlinks/page.tsx    # קישורים נכנסים
│   │   ├── referrals/page.tsx    # תנועה ממקורות חיצוניים
│   │   └── utm/page.tsx          # יצירת קישורי UTM
│   │
│   └── api/
│       ├── seo/
│       │   ├── connect/route.ts        # התחל OAuth
│       │   ├── callback/route.ts       # חזרה מ-OAuth
│       │   ├── disconnect/route.ts     # ניתוק חשבון
│       │   ├── status/route.ts         # האם מחובר?
│       │   ├── queries/route.ts        # מילות חיפוש מובילות
│       │   ├── pages/route.ts          # דפים מובילים
│       │   ├── opportunities/route.ts  # מילים בעמוד 2
│       │   ├── backlinks/route.ts      # קישורים נכנסים
│       │   ├── referrals/route.ts      # תנועה חיצונית
│       │   ├── utm/route.ts            # יצירת UTM
│       │   └── refresh/route.ts        # רענון ידני
│       │
│       └── cron/
│           └── seo-sync/route.ts       # סנכרון יומי (Vercel Cron)
│
└── lib/
    ├── google-oauth.ts          # ניהול OAuth + רענון אסימונים
    ├── search-console.ts        # קריאות ל-GSC API
    ├── analytics.ts             # קריאות ל-GA4 API
    ├── crypto.ts                # הצפנה/פענוח אסימונים
    └── utm-builder.ts           # בניית URL עם UTM
```

### מודלים חדשים ב-Prisma

```prisma
// אסימוני גישה לחשבון גוגל של אדמין
model GoogleIntegration {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken   String   // מוצפן
  refreshToken  String   // מוצפן
  expiresAt     DateTime
  scopes        String[] // ["webmasters.readonly", "analytics.readonly"]
  gscSiteUrl    String?  // למשל "https://www.fuzionwebz.com/"
  ga4PropertyId String?  // למשל "properties/123456789"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// תמונת מצב יומית של GSC + GA4 — לחישוב מגמות
model SeoSnapshot {
  id           String   @id @default(cuid())
  date         DateTime @db.Date  // יום אחד = שורה אחת
  totalClicks  Int      @default(0)
  totalImpressions Int  @default(0)
  avgCtr       Float    @default(0)
  avgPosition  Float    @default(0)
  organicSessions Int   @default(0)
  referralSessions Int  @default(0)
  createdAt    DateTime @default(now())

  @@unique([date])
  @@index([date])
}

// מילת חיפוש מצטברת ל-28 ימים אחרונים
model SeoQuery {
  id          String   @id @default(cuid())
  query       String   // הביטוי שחיפשו
  clicks      Int
  impressions Int
  ctr         Float
  position    Float
  topPage     String?  // הדף שבו הופענו הכי הרבה
  windowStart DateTime @db.Date
  windowEnd   DateTime @db.Date
  createdAt   DateTime @default(now())

  @@unique([query, windowStart])
  @@index([clicks])
  @@index([impressions])
  @@index([position])
}

// קישור נכנס מאתר חיצוני
model Backlink {
  id            String   @id @default(cuid())
  sourceDomain  String   // למשל "walla.co.il"
  targetUrl     String   // הדף שלנו שאליו קישרו
  firstSeen     DateTime
  lastSeen      DateTime @updatedAt

  @@unique([sourceDomain, targetUrl])
  @@index([sourceDomain])
}

// קישור UTM שאתה ייצרת לעצמך
model UtmLink {
  id          String   @id @default(cuid())
  fullUrl     String   // ה-URL המלא עם פרמטרים
  baseUrl     String
  source      String   // utm_source
  medium      String   // utm_medium
  campaign    String   // utm_campaign
  term        String?
  content     String?
  label       String?  // תיאור פנימי שלך ("מאמר וואלה אפריל 26")
  clicks      Int      @default(0)  // אוסף מ-GA4 פעם ביום
  createdAt   DateTime @default(now())
  createdBy   String

  @@index([createdAt])
}
```

---

## חיבור אבטחתי לגוגל

### כיצד ה-OAuth עובד

1. אדמין נכנס ל-`/admin/seo` בפעם הראשונה → רואה כפתור "חבר חשבון גוגל"
2. לחיצה → שליחה ל-`/api/seo/connect` שמחזיר redirect לעמוד הסכמה של גוגל
3. גוגל שואל: "האם לאפשר ל-FW Admin לקרוא נתוני Search Console + Analytics?"
4. אישור → גוגל שולח חזרה ל-`/api/seo/callback` עם קוד
5. השרת מחליף את הקוד ל-`access_token` + `refresh_token`
6. שמירת האסימונים **מוצפנים** ב-DB (במודל `GoogleIntegration`)
7. ה-`access_token` מתחדש אוטומטית כל שעה דרך ה-`refresh_token`

### הרשאות שנבקש

- `https://www.googleapis.com/auth/webmasters.readonly` — קריאה מ-GSC
- `https://www.googleapis.com/auth/analytics.readonly` — קריאה מ-GA4

**שתי הרשאות בלבד, רק קריאה — לא נוכל לשנות שום דבר בחשבון של גוגל.**

### מה צריך פעם אחת בחיים

1. ליצור פרויקט ב-Google Cloud Console (חינם)
2. להפעיל את ה-APIs: Search Console + Analytics Data
3. ליצור OAuth Client ID, להגדיר את ה-redirect URI
4. לשמור את ה-`CLIENT_ID` + `CLIENT_SECRET` במשתני סביבה ב-Vercel

זה תהליך של ~30 דקות שאני אדריך אותך בו צעד אחר צעד כשנגיע לשם.

---

## שמירת אסימונים בבטחה

האסימונים נשמרים ב-DB, אבל **מוצפנים** עם מפתח שיושב ב-`.env`:

- מפתח: `OAUTH_ENCRYPTION_KEY` (32 תווים אקראיים)
- אלגוריתם: AES-256-GCM (סטנדרט תעשייתי)
- מי שיש לו גישה ל-DB בלי המפתח — לא יכול לקרוא אותם

---

## דפי המשתמש

### דף 1 — `/admin/seo` (סקירה)

**הבלוק העליון**: 4 קלפים עם המספרים הגדולים
- סך קליקים מגוגל (28 ימים אחרונים) + שינוי מהחודש שעבר
- סך הופעות (כמה פעמים הופענו בתוצאות חיפוש)
- שיעור הקלקה ממוצע (CTR)
- מיקום ממוצע בתוצאות

**גרף**: קליקים והופעות לאורך 90 ימים אחרונים

**טבלה**: 5 המילים המובילות (קישור לדף המילים)

**טבלה**: 5 הדפים המובילים (קישור לדף הדפים)

### דף 2 — `/admin/seo/keywords`

טבלה מסודרת עם מיון:
- מילה / ביטוי
- קליקים
- הופעות
- CTR
- מיקום ממוצע
- הדף שלנו שאליו הם הגיעו

**פילטר חכם**: "הראה רק מילים בעמוד 2" → מציג מילים במיקום 11-20 (ההזדמנויות הזהב)

### דף 3 — `/admin/seo/pages`

טבלת דפים — איזה דף מקבל הכי הרבה תנועה אורגנית, באיזה מילים זה קורה.

### דף 4 — `/admin/seo/backlinks`

- סך קישורים נכנסים
- 20 הדומיינים שהכי מקשרים אליך
- 10 הדפים שלך שהכי מקושרים מבחוץ
- חדשים השבוע (מה התווסף בימים האחרונים)

### דף 5 — `/admin/seo/referrals`

- מאיפה אנשים מגיעים אליך (לא מגוגל)
- חלוקה: רשתות חברתיות / מאמרים / קישורים ישירים / ניוזלטרים
- לכל מקור: כמה כניסות, ואיזה דף הם ראו, וכמה זמן שהו

### דף 6 — `/admin/seo/utm` (כלי הבנייה)

טופס פשוט:
- כתובת היעד (למשל `fuzionwebz.com/services/website`)
- מקור (`walla`, `mako`, `linkedin`)
- מדיום (`article`, `social`, `email`)
- שם קמפיין (`launch-april-2026`)
- תווית פנימית (`מאמר אצל וואלה על UX`)

לחיצה על "צור" → מקבל URL מוכן להעתקה + נשמר ברשימה

**רשימה למטה**: כל הקישורים שיצרת + כמה קליקים כל אחד מהם קיבל (מתעדכן יומית מ-GA4)

---

## תוכנית עבודה — שלבים

### שלב 0 — הכנות (לא קוד)

**מי**: אתה. **זמן**: 30-45 דקות.

1. וידוא שהאתר מאומת ב-Google Search Console
2. וידוא שיש Google Analytics 4 על האתר
3. יצירת פרויקט ב-Google Cloud Console
4. הפעלת APIs (Search Console + Analytics Data)
5. יצירת OAuth Client + הגדרת redirect URI
6. שמירת CLIENT_ID + SECRET שאצלי

אדריך אותך צעד אחר צעד כשנתחיל.

### שלב 1 — תשתית (יום 1)

- מוסיף 5 מודלים חדשים ל-Prisma
- כותב את `lib/crypto.ts` (הצפנת אסימונים)
- כותב את `lib/google-oauth.ts` (זרימת OAuth + רענון)
- כותב את `lib/search-console.ts` ו-`lib/analytics.ts` (קריאות API)
- API: `/api/seo/connect`, `/callback`, `/disconnect`, `/status`
- דף ה-`/admin/seo` עם כפתור "חבר" / "מחובר"
- בדיקה ידנית של זרימת ה-OAuth מקצה לקצה

**תוצר**: אתה יכול לחבר את חשבון גוגל שלך והאדמין יודע שאתה מחובר.

### שלב 2 — קריאת נתוני SEO (יום 2)

- כותב את `/api/cron/seo-sync` שמושך פעם ביום מ-GSC + GA4 ל-`SeoSnapshot` + `SeoQuery`
- מגדיר את הקרון ב-Vercel (`vercel.json`)
- API: `/api/seo/queries`, `/pages`, `/opportunities`
- דף `/admin/seo` עם 4 קלפי הסקירה + גרף קליקים
- דפי `/keywords` ו-`/pages` עם טבלאות

**תוצר**: אחרי לילה אחד שהקרון רץ — תראה את כל המילים שלך מסודרות בטבלה יפה.

### שלב 3 — מאמרים חיצוניים (יום 3)

- מודל `Backlink` + סנכרון יומי מ-GSC
- API: `/api/seo/backlinks`, `/api/seo/referrals`
- דף `/admin/seo/backlinks` + `/admin/seo/referrals`

**תוצר**: רואה מי מקשר אליך + מאיפה התנועה החיצונית מגיעה.

### שלב 4 — כלי UTM (חצי יום)

- מודל `UtmLink`
- API: `POST /api/seo/utm` (יצירה) + `GET` (רשימה)
- דף `/admin/seo/utm` עם טופס + רשימה
- עדכון cron שיתסנכן clicks לכל קישור UTM

**תוצר**: יוצר קישור UTM ב-30 שניות, מקבל URL מוכן להעתקה.

### שלב 5 — ליטוש (חצי יום)

- ייצוא לאקסל / CSV
- התראות (אופציונלי): "מילה X עברה למיקום 1!" או "מאמר ב-וואלה הביא 200 כניסות"
- הוספת פריט "SEO" לתפריט הצד

**תוצר**: מערכת מוכנה להפצה.

### **סך הכל**: 4-5 ימי עבודה (כולל בדיקות וליטוש).

---

## עלויות ומגבלות

| פריט | עלות | הערה |
|---|---|---|
| Google Search Console API | חינם | מוגבל ~1,200 קריאות/יום (יותר מספיק) |
| Google Analytics Data API | חינם | מוגבל 50,000 קריאות/יום |
| Vercel Cron | חינם | בתוך תוכנית Vercel הקיימת |
| Google Cloud project | חינם | לא משלמים על ה-APIs האלה |
| **סך הכל** | **₪0/חודש** | |

### מגבלות שכדאי לדעת

- נתוני GSC מגיעים בעיכוב של 2-3 ימים (סטנדרט של גוגל)
- GSC לא מציג מילים עם פחות מ-10 חיפושים/חודש (פרטיות)
- קישורים נכנסים — גוגל מציג חלק, לא הכל. ל-100% צריך Ahrefs (₪400/חודש)
- האסימון של גוגל פג כל שעה אבל מתחדש אוטומטית עם ה-refresh token

---

## נקודות החלטה לפני שמתחילים

**1. כפתור הסנכרון הידני** — האם רוצה כפתור "סנכרן עכשיו" ידני בנוסף לקרון היומי? (מומלץ — מועיל בזמן בדיקות).

**2. גישה רב-משתמשית** — האם שני האדמינים (אלעד + רועי) רואים את אותם הנתונים? (כן — נתוני SEO הם של האתר, לא של המשתמש. אבל החיבור עצמו לגוגל יהיה של מי שחיבר ראשון).

**3. שמירת היסטוריה** — לכמה זמן לשמור snapshots יומיים? (מומלץ: 13 חודשים = שנה + חודש למגמה שנתית).

**4. שפה** — כל הממשק בעברית? כן — לפי הקונבנציה הקיימת.

**5. עיצוב** — להיצמד לסגנון הקיים של מערכת הניהול (פינק/ציאן, רקע אפור-שחור, פונט בירזיה לטקסט)? כן.

---

## מה לא נכלל בתוכנית הזאת (שלב הבא)

- **המלצות אוטומטיות** ("המילה X פוטנציאלית — תכתוב עליה מאמר") — דורש הבנת תוכן עומק, אולי GPT/Claude API
- **אופטימיזציה אוטומטית של תיאורי דפים** — דורש ניתוח של ה-HTML של הדפים
- **מעקב מתחרים** — דורש כלי בתשלום
- **דוח חודשי שנשלח ב-WhatsApp** — קל להוסיף בהמשך אם תרצה
- **רשתות חברתיות** — בכוונה לא נכלל לפי ההחלטה הקודמת. נטפל בנפרד.

---

## שאלה אחת לסגירה

לפני שמתחילים את **שלב 0** — האם תרצה שנלך עם התוכנית כמו שהיא, או שיש משהו בארכיטקטורה שתרצה לשנות?
