# Facebook Lead Ads — Runbook להפעלה

הקוד מוכן בקומיט הקרוב. זה מה שצריך לעשות בצד שלך כדי שלידים יזרמו אוטומטית.

## דרישות מקדימות (וידוא)

- [ ] Facebook Page פעיל עם Lead Ads רצים (כן — אמרת שכבר יש)
- [ ] אתה Admin של ה-Page
- [ ] חשבון Meta Business Manager (אם יש לך מודעות פעילות, יש)

## שלב א׳ — יצירת Meta App (~10 דקות)

1. עבור ל-https://developers.facebook.com/apps
2. **Create App** → בחר type **"Business"** → Next
3. **App display name**: `Fuzion Webz Admin` (או כל שם)
4. **App contact email**: שלך
5. **Business Account**: בחר את ה-Business Manager שלך
6. **Create App** → ייתכן שיבקש סיסמה לאימות
7. תועבר ל-App Dashboard

## שלב ב׳ — הוסף Roy כ-Admin של ה-App

1. ב-App Dashboard → **App Roles** (תפריט שמאל) → **Roles**
2. **Add People** → הוסף `roy@fuzionwebz.com` כ-**Administrator**
3. Roy יקבל מייל לאישור — חייב לאשר תוך 14 יום

> בלי השלב הזה, Roy לא יוכל להשתמש באינטגרציה (כי App ב-Dev Mode פתוח רק לאדמינים/בודקים).

## שלב ג׳ — הוסף Products: Webhooks + Permissions

1. בעמודה השמאלית של ה-App Dashboard → **Add Product**
2. הוסף:
   - **Webhooks**
   - **Facebook Login** (לאימות OAuth)
3. תחת **App Review → Permissions and Features** — וודא שה-permissions הבאים הופיעו (יקבלו "Standard Access" אוטומטית כי האפליקציה ב-Dev Mode):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `leads_retrieval`
   - `business_management`

## שלב ד׳ — קבל את ה-credentials

ב-App Dashboard → **App Settings → Basic**:

- **App ID**: 16 ספרות. העתק.
- **App Secret**: לחץ **Show** → הזן סיסמת פייסבוק → העתק. **שמור בצד — לעולם לא לשתף בצ'אט פתוח.**

## שלב ה׳ — הוסף 4 משתני סביבה ל-Vercel

ב-Vercel Dashboard → Settings → Environment Variables → הוסף עבור Production + Preview + Development:

```
META_APP_ID = <מהשלב הקודם>
META_APP_SECRET = <מהשלב הקודם>
META_REDIRECT_URI = https://www.fuzionwebz.com/api/integrations/facebook/callback
META_WEBHOOK_VERIFY_TOKEN = f3a0ac807a7ef890660df600f6b354c07fb8c9ccdf9aaaa9

# סינון — ה-Page שלנו + הטופס הפנימי של Fuzion
META_PAGE_ID = 482956251578120
FACEBOOK_LEAD_FORM_ID = 1505628047948105
```

(ה-VERIFY_TOKEN שיצרתי — אפשר להשתמש זהה גם בלוקאלי וגם בפרודקשן.)

**על `META_PAGE_ID` ו-`FACEBOOK_LEAD_FORM_ID`** — אלו אופציונליים אבל מומלצים חד-משמעית. כל-זמן שהם מוגדרים, ה-webhook מתעלם אוטומטית מלידים של טפסים/דפים אחרים (החזרת 200 OK בלי שמירה). זה קריטי כשה-Page אחד מארח כמה טפסים (למשל לקוחות שונים). אם משאירים ריק — ה-webhook יקבל כל ליד מכל טופס שחיבור ה-Page קיים עבורו.

לאחר ההוספה: trigger redeploy או דחיפת commit ריק.

## שלב ו׳ — Configure Webhook ב-Meta Dashboard

1. ב-App Dashboard → **Webhooks** (Products) → **Subscribe to this object → Page**
2. **Callback URL**: `https://www.fuzionwebz.com/api/webhooks/facebook`
3. **Verify Token**: `f3a0ac807a7ef890660df600f6b354c07fb8c9ccdf9aaaa9`
4. **Verify and Save** — Meta יקרא ל-GET שלנו ויחפש את ה-token. אם זה תואם → ✓ Verified.
5. אחרי Verified: בלשונית `Page` → **Subscribe to fields** → סמן **`leadgen`** ✓

## שלב ז׳ — חבר Page באדמין שלנו

1. נכנס ל-https://www.fuzionwebz.com/admin/integrations/facebook
2. לחץ **"חבר Facebook"**
3. תועבר ל-Facebook → תאשר 5 הרשאות (חשוב: אל תוריד סימון מאף אחת)
4. תחזור למערכת → רואה רשימת Pages שאתה Admin שלהם
5. בחר את ה-Page → לחץ "חבר ←"
6. אישור: "✓ פעיל" מופיע ליד ה-Page

## שלב ח׳ — בדיקה End-to-End

### דרך 1 — Test Lead מ-Lead Ads Manager (מהיר)
1. https://business.facebook.com/leadcenter → בחר את ה-Page → Forms Library
2. בחר טופס פעיל → **Preview** → **Submit Test Lead**
3. תוך 5-10 שניות: ה-לליד צריך להופיע ב-`/admin/leads` עם תג 📘 Facebook
4. אתה ו-Roy תקבלו push notification

### דרך 2 — מודעה בפועל
המתן עד שמישהו אמיתי יממלא טופס. יופיע אוטומטית.

## דברים שעלולים להשתבש + פתרונות

| תופעה | סיבה אפשרית | פתרון |
|---|---|---|
| Webhook verification נכשל | `META_WEBHOOK_VERIFY_TOKEN` ב-Vercel ≠ מה שהזנת ב-Meta | ודא שה-token זהה לחלוטין (כולל אותיות קטנות) |
| כפתור "חבר Facebook" אפור | משתני סביבה לא הוגדרו ב-Vercel | בדוק עם `vercel env ls` |
| OAuth מחזיר `scope_missing` | פיספסת checkbox במסך הקונסנט | בטל גישה ב-https://www.facebook.com/settings/?tab=business_tools → חבר שוב |
| לידים לא מגיעים | Webhook לא subscribed ל-`leadgen` field | בדוק ב-Meta App Dashboard → Webhooks → Page subscriptions |
| ליד נכפל | לא אמור — יש `@unique` על `externalLeadId` | אם קורה, פתח issue |
| ליד מגיע בלי שדות | מיפוי שדות מותאם אישית לא תפס | שלח לי דוגמת ליד מ-Lead Center → אעדכן את `mapLeadFieldsToContact` |

## זרימת הנתונים (לתיעוד)

```
משתמש לוחץ על מודעה בפיד
   ↓
ממלא טופס (פתוח בתוך אפליקציית פייסבוק)
   ↓
ה-לליד נשמר אצל Meta + Meta שולחת POST → /api/webhooks/facebook
   ↓
אנחנו מאמתים HMAC-SHA256 → POST שמכיל leadgen_id + page_id
   ↓
שולפים את ה-page access token המוצפן מ-DB → decrypt
   ↓
GET /{leadgen_id}?fields=... → Graph API מחזיר את כל הפרטים
   ↓
upsert ContactSubmission עם source="facebook_lead_ads"
   ↓
notifyAllAdmins → push notification + Notification row
   ↓
מופיע ב-/admin/leads (גם בעמוד /admin/contacts)
```

זמן סך הכל: 1-3 שניות מקליק על המודעה ועד הודעה במכשיר שלך.
