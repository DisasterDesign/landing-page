# Runbook — הקמת מערכת ה-SEO (שלב 1 → שלב 2)

מסמך מבצעי שמשלים את [docs/SEO_PLAN.md](SEO_PLAN.md). הארכיטקטורה הכללית שם, הצעדים בפועל כאן.

## מצב נוכחי (commit `641438e`)

**מה כבר קיים בקוד**:
- מודלי Prisma (GoogleIntegration, SeoSnapshot, SeoQuery, Backlink, UtmLink) פרוסים ב-DB
- ספריית הצפנה ([src/lib/crypto.ts](../src/lib/crypto.ts)) — AES-256-GCM
- זרימת OAuth מלאה ([src/lib/google-oauth.ts](../src/lib/google-oauth.ts))
- Stubs ל-Search Console + Analytics ([src/lib/search-console.ts](../src/lib/search-console.ts), [src/lib/analytics.ts](../src/lib/analytics.ts))
- API: `/api/seo/{status,connect,callback,disconnect}`
- דף UI: [/admin/seo](../src/app/admin/(dashboard)/seo/page.tsx) עם מצב "מחובר/לא מחובר"
- פריט "SEO" ב-sidebar
- `.env.example` מתועד

**מה חסר כדי שזה יעבוד בפרודקשן**: 4 משתני סביבה ב-Vercel + הגדרת OAuth Client ב-Google Cloud Console (לא ניתן אוטומטית מה-CLI — חייב UI).

---

## חלק א׳ — Google Cloud (מעשי, ידני, ~20 דקות)

המשתמש ידני בלבד — Google לא נותנת ליצור OAuth Client דרך gcloud CLI.

### דרישות מקדימות
- [ ] `https://www.fuzionwebz.com` מאומת ב-Google Search Console
- [ ] Property של GA4 קיימת על האתר

### צעד 1 — צור פרויקט
1. https://console.cloud.google.com → תיבת בחירת פרויקט (למעלה) → **NEW PROJECT**
2. שם: `fuzion-webz-admin`
3. **CREATE** → המתן + ודא שהוא נבחר

### צעד 2 — הפעל APIs
ב-**APIs & Services → Library** הפעל:
- Google Search Console API
- Google Analytics Data API
- Google Analytics Admin API (אופציונלי)

### צעד 3 — OAuth Consent Screen
**APIs & Services → OAuth consent screen** → User Type: **External**
- App name: `Fuzion Webz Admin`
- Support email + Developer contact: שלך
- דלג על Scopes
- הוסף את האימייל שלך כ-Test user

### צעד 4 — Create OAuth Client ID
**APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID**
- Application type: **Web application**
- Name: `FW Admin Web`
- **Authorized redirect URIs** (הוסף שתי שורות):
  ```
  https://www.fuzionwebz.com/api/seo/callback
  http://localhost:3000/api/seo/callback
  ```
- **CREATE** → שמור את `Client ID` ו-`Client Secret`

---

## חלק ב׳ — משתני סביבה ב-Vercel

ארבעה משתנים, כולם **Production + Preview + Development**:

| משתנה | ערך |
|---|---|
| `OAUTH_ENCRYPTION_KEY` | `PvECjmGLSDXjuMy+vG3xDP0SjFQ/ymM3SR7jj7shLgU=` (כבר מיוצר — או רענן עם `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | מצעד 4 |
| `GOOGLE_CLIENT_SECRET` | מצעד 4 |
| `GOOGLE_REDIRECT_URI` | `https://www.fuzionwebz.com/api/seo/callback` |

**דרך 1 — Vercel CLI** (אם הסוכן מחובר):
```bash
echo "PvECjmGLSDXjuMy+vG3xDP0SjFQ/ymM3SR7jj7shLgU=" | vercel env add OAUTH_ENCRYPTION_KEY production
echo "<CLIENT_ID>" | vercel env add GOOGLE_CLIENT_ID production
echo "<CLIENT_SECRET>" | vercel env add GOOGLE_CLIENT_SECRET production
echo "https://www.fuzionwebz.com/api/seo/callback" | vercel env add GOOGLE_REDIRECT_URI production
```
חזור על כל אחד גם עבור `preview` ו-`development`.

**דרך 2 — Vercel Dashboard**:
https://vercel.com/[team]/[project]/settings/environment-variables

לאחר ההוספה: `vercel --prod` או דחיפה ריקה כדי להפעיל deploy חדש.

---

## חלק ג׳ — `.env.local` לפיתוח מקומי

הסוכן (או המשתמש) מוסיף ל-`/Users/eladnissim/Desktop/fuzion-webz/.env`:
```
OAUTH_ENCRYPTION_KEY="PvECjmGLSDXjuMy+vG3xDP0SjFQ/ymM3SR7jj7shLgU="
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/seo/callback"
```

לאחר עריכה: הפעלה מחדש של `npm run dev` כדי שהמשתנים ייטענו.

---

## חלק ד׳ — אימות מקצה לקצה

1. המתן שהדפלוי של Vercel יסתיים (~2 דקות)
2. פתח `https://www.fuzionwebz.com/admin/seo` → אמור לראות כפתור **"חבר חשבון Google"** פעיל (לא אפור)
3. לחץ → גוגל שואל הסכמה (לא לפחד מ-"App not verified" — לחץ Advanced → Continue)
4. אישר → חזרה ל-`/admin/seo` עם הודעת toast "חשבון חובר בהצלחה"
5. הדף מציג עכשיו: אימייל מחובר, "מחובר ל-Google"
6. בדוק ב-DB:
   ```bash
   node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.googleIntegration.findFirst({select:{email:true,scopes:true,expiresAt:true}}).then(r=>{console.log(r);return p.\$disconnect();});"
   ```
   צריך להחזיר את ה-email + רשימת scopes + תאריך תפוגה (~ שעה מהחיבור).

אם הכל ✓ — **שלב 1 הושלם**. ממשיכים לשלב 2.

---

## חלק ה׳ — סימני כשל נפוצים

| תופעה | סיבה | פיתרון |
|---|---|---|
| כפתור "חבר" אפור ב-`/admin/seo` | `getGoogleConfig()` מחזיר null | משתנים חסרים ב-Vercel — בדוק `vercel env ls` |
| `redirect_uri_mismatch` בגוגל | URI ב-Cloud Console לא בדיוק תואם | חייב להיות זהה לחלוטין כולל https/trailing slash |
| `no_refresh_token__revoke_app_access...` | המשתמש כבר אישר בעבר וגוגל לא נותנת refresh חדש | https://myaccount.google.com/permissions → הסר את האפליקציה → נסה שוב |
| `state_mismatch` | cookie נחסם או חצה דומיינים | ודא שגלישה דרך `https://www.fuzionwebz.com` (לא דומיין משני) |
| Build נכשל ב-Vercel | `OAUTH_ENCRYPTION_KEY` לא מוגדר אבל הקוד מייצא עם prerender | הקוד מטפל בזה (זורק רק בריצה, לא בבנייה) — בדוק את הלוג |

---

## חלק ו׳ — מה אחרי

ברגע ששלב 1 פעיל, השלב הבא (שלב 2) מוסיף:
- בחירת אתר GSC + נכס GA4 דרך ה-UI (אחרי החיבור)
- API `/api/seo/{queries,pages,opportunities}` — קוראים ל-GSC + שומרים ב-DB
- API `/api/cron/seo-sync` — עם הגדרת cron ב-`vercel.json`
- דשבורד `/admin/seo` עם 4 קלפי סקירה + גרף + טבלאות
- הסרת ה-stubs ([search-console.ts](../src/lib/search-console.ts), [analytics.ts](../src/lib/analytics.ts)) ויישום ה-fetches האמיתיים

זה PR נפרד, ~יום עבודה, אחרי ששלב 1 מאומת.
