# ארכיטקטורה — אינטגרציית לידים מפייסבוק

> **למה זה קריטי**: פייסבוק הוא המקור העיקרי של לידים. ידני ב-Excel = פניות שאנחנו מאחרים אליהן. צריך זרימה אוטומטית מהמודעה למסך המעקב.

---

## איך פייסבוק Lead Ads עובדת (הבסיס)

1. משתמש פוגש מודעה בפיד שלו → לוחץ "Sign up" / "Learn more"
2. נפתח טופס מובנה של פייסבוק (נטען בתוך האפליקציה — חוויה חלקה)
3. הטופס מתמלא אוטומטית מהפרופיל (שם, אימייל, טלפון), המשתמש משלים שאלות ספציפיות
4. הליד נשמר אצל פייסבוק ב-**Lead Center** של ה-Page
5. **מי שלא משך את הליד תוך 24 שעות — מאבד 50%+ מהקונברסיה.** זה הסטטיסטיקה הסטנדרטית של מודעות.

---

## המצב היום אצלנו

```
טופס באתר fuzionwebz.com
        ↓ POST /api/contacts
        ↓ create ContactSubmission { source: null }
        ↓
   /admin/leads  /admin/contacts
```

המודל קיים. צריך **רק** להוסיף מקור שני (פייסבוק) שיוצר רשומות באותה דרך.

## המצב הרצוי

```
פייסבוק Lead Ads ──┐
                    ├→ /api/leads/inbound ──→ ContactSubmission { source: "facebook" }
טופס באתר ──────────┘                                ↓
                                                /admin/leads
                                            (badge "📘 פייסבוק")
```

---

## 3 מסלולי implementation — מהמהיר למקיף

### מסלול A — Zapier / Make (פותח השבוע, $30/חודש)

**איך**:
1. נרשמים ל-Zapier (יש free trial, אבל צריך plan בתשלום ~$30/חודש כי Lead Ads זה "Premium app")
2. ב-Zapier: New Zap → Trigger: "Facebook Lead Ads — New Lead" → מחבר חשבון פייסבוק שלך → בוחר Page + Form
3. Action: "Webhooks by Zapier — POST" → URL: `https://www.fuzionwebz.com/api/leads/inbound` → headers + body מהליד
4. אצלנו צריך לבנות endpoint שמקבל את ה-POST הזה (חצי שעה עבודה) — מאומת עם API key בכותרת

**יתרונות**:
- ✅ עובד **תוך שעה** — בלי שום אישור Meta, בלי App Review
- ✅ Zapier מטפל ב-OAuth, מטפל באמינות (retries, error queue), מטפל בכל הפרטים
- ✅ אם פייסבוק משנה API — Zapier מתעדכן בלי שתעשה כלום

**חסרונות**:
- 💰 ~$30/חודש (Starter plan עם premium apps)
- ⏱ עיכוב 2-15 דקות (תלוי בתוכנית — Free=15 min, Starter=2 min)
- 🔒 הליד עובר דרך Zapier — אם אתה רגיש לפרטיות, זה נקודת חתך

**קוד שצריך לבנות**:
```
POST /api/leads/inbound
  Headers: Authorization: Bearer <FB_INBOUND_API_KEY>
  Body: { fullName, email, phone, formName, fbLeadId, customFields }
  → upsert ContactSubmission (dedupe על fbLeadId)
  → notifyAllAdmins("ליד חדש מפייסבוק", lead.fullName)
```

**זמן ביצוע**: יום עבודה (חצי על endpoint, חצי על Zapier setup ו-mapping).

---

### מסלול B — Webhooks ישירות מ-Meta (לטווח ארוך, חינמי)

**איך**:
1. יוצרים Meta App ב-developers.facebook.com
2. מבקשים הרשאת `leads_retrieval` + `pages_show_list` + `pages_manage_metadata`
3. **App Review של 2-4 שבועות** — Meta בודקת שאתה לא מנצל את ה-API. צריך:
   - וידאו של 2-3 דקות שמראה את הזרימה אצלנו במערכת
   - תיאור use case
   - מסמכי business verification (תעודת עוסק, חשבון בנק)
4. אחרי אישור: Subscribe את ה-Page לאירוע `leadgen`
5. כשליד מגיע → Meta שולחת **POST** ל-`https://www.fuzionwebz.com/api/webhooks/facebook` עם lead ID
6. אצלנו: מקבלים את ה-ID → קוראים ל-Graph API עם Page Access Token → מקבלים את כל הפרטים → upsert ContactSubmission

**יתרונות**:
- 💰 **חינם לחלוטין** (Meta API חינמי בכל היקף סביר)
- ⚡ **real-time** — הליד מופיע אצלנו תוך שניות
- 🔒 ישיר Meta → אנחנו, אין צד שלישי
- 📊 גישה ל-metadata עשיר (form name, ad ID, campaign ID — לטרקינג ROI)

**חסרונות**:
- ⏳ App Review של 2-4 שבועות (לפעמים יותר אם דוחים)
- 🛠 setup הרבה יותר מורכב — מטפלים ב-OAuth long-lived tokens, signature verification, retry logic
- 📋 דורש Meta Business Verification (אם עוד לא קיים — תהליך נוסף של 1-3 ימים)

**קוד שצריך לבנות** (גדול):
- `prisma/schema.prisma`: מודל `FacebookIntegration { pageId, pageAccessToken (encrypted), pageName, subscribedAt }`
- `src/lib/facebook.ts`: Meta Graph API client (fetch + bearer token + retry)
- `src/lib/crypto.ts`: כבר קיים (משתמשים בו ל-Google) — נשתמש לאותו דבר
- API routes:
  - `GET /api/integrations/facebook/connect` — OAuth init
  - `GET /api/integrations/facebook/callback` — exchange code → long-lived token
  - `GET /api/integrations/facebook/pages` — רשימת pages שהמשתמש מנהל
  - `POST /api/integrations/facebook/subscribe` — subscribe page נבחר ל-leadgen
  - `POST /api/integrations/facebook/disconnect`
  - `GET /api/integrations/facebook/status`
  - `GET /api/webhooks/facebook` — verification challenge (Meta דורשת)
  - `POST /api/webhooks/facebook` — קבלת leads (signature verification!)
- `/admin/integrations/facebook` — UI לחיבור + ניהול

**זמן ביצוע**: 2-3 ימי עבודה + 2-4 שבועות המתנה לאישור Meta.

---

### מסלול C — CSV ידני (תיק חיים ל-emergency)

**איך**:
1. אדמין נכנס ל-Lead Center בפייסבוק → Download CSV
2. ב-`/admin/leads/import` → drag-and-drop את ה-CSV
3. אנחנו מפענחים ויוצרים ContactSubmissions

**יתרונות**: ללא תלות בכלום. כשפייסבוק/Zapier נופלים — תמיד יש לך את זה.

**חסרונות**: ידני. לא יישתמש בו אף אחד שיודע ש-Zapier קיים.

**שימוש מומלץ**: לבנות לאחור (לאחר A או B) כ-fallback. לא ל-day 1.

**זמן ביצוע**: 2-3 שעות.

---

## ההמלצה שלי — Hybrid

**שלב 1 (השבוע)**: Zapier (מסלול A)
- מתחילים לקבל לידים תוך שעה
- $30/חודש זה זול לעומת ערך של ליד אחד שאיחרת אליו
- בונה את ה-endpoint `/api/leads/inbound` שגם יקבל webhooks אמיתיים בעתיד

**שלב 2 (מקביל)**: רישום באישור Meta (מסלול B)
- מתחילים את התהליך — App Review לוקח שבועות בלי תלות במה שאתה עושה
- כשמגיע אישור — מחליפים את ה-Zapier ב-webhook ישיר, חוסכים $30/חודש לתמיד

**שלב 3 (אם יש זמן)**: CSV import (מסלול C)
- "כפתור ניצולים" ל-eventual emergency

---

## מבנה הנתונים — אותו דבר בלי קשר למסלול

```prisma
model ContactSubmission {
  // ... קיים
  source            String?    // "website" | "facebook_lead_ads" | "csv_import"
  externalLeadId    String?    @unique  // FB lead ID — למניעת כפילויות
  externalFormId    String?    // איזה טופס פייסבוק
  externalFormName  String?    // שם הטופס לתצוגה
  externalCampaign  String?    // שם הקמפיין — לדוחות ROI
  receivedAt        DateTime   @default(now())
  // השדות הקיימים: name, email, phone, message, status, notes...
}
```

`@unique` על `externalLeadId` — אם פייסבוק/Zapier שולחים אותו ליד פעמיים בטעות, ה-upsert יבטל את הכפילות.

---

## ה-API endpoint המשותף לשני המסלולים

זהו ה-**מפתח** של הארכיטקטורה — endpoint אחד שמתאים גם ל-Zapier וגם לwebhook ישיר:

```
POST /api/leads/inbound

Headers:
  Authorization: Bearer <FB_INBOUND_API_KEY>   ← Zapier (סוד שאנחנו נותנים ל-Zapier)
  X-Hub-Signature-256: sha256=...               ← Meta direct (HMAC עם App Secret)

Body (Zapier):
  {
    "source": "facebook_lead_ads",
    "fbLeadId": "1234567890",
    "formId": "987654321",
    "formName": "אתר עסקי — לקוחות חדשים",
    "campaignId": "555555",
    "campaignName": "Spring 2026",
    "fullName": "ישראל ישראלי",
    "email": "...",
    "phone": "+972501234567",
    "createdAt": "2026-04-19T10:30:00Z",
    "customFields": { "company_size": "1-5", "budget": "5K-15K" }
  }

Body (Meta direct webhook): payload format שונה — אנחנו ממירים פנימית לפורמט הנ"ל

Logic:
  1. אמת את ה-Authorization (שני הצדדים — accept either)
  2. upsert ContactSubmission לפי externalLeadId
  3. אם חדש: notifyAllAdmins("ליד חדש מפייסבוק") + push notification
  4. החזר 200 (מהר! Meta דוחה אם 5+ שניות)
```

---

## אבטחה — חובה

| איום | פתרון |
|---|---|
| מישהו זר שולח POST מזויפים ל-`/api/leads/inbound` | אימות Bearer token (Zapier) או HMAC signature (Meta) |
| מישהו פותח את ה-endpoint וגונב נתוני לידים | זה POST בלבד — אין read. ה-DB מוגן ע"י admin auth |
| פייסבוק שולחת אותו ליד פעמיים | `@unique` על `externalLeadId` + upsert |
| ה-Page Access Token דולף | מוצפן ב-DB עם `lib/crypto.ts` הקיים |
| webhook נופל ואנחנו מאבדים ליד | Meta retries 5 פעמים תוך 24 שעות. אבל גם זה כולל גיבוי: cron יומי שמושך leads מ-Graph API לפי `since=last_synced` |

---

## דרישות מקדימות אצלך

**לפני שמתחילים מסלול A (Zapier)**:
- [ ] חשבון Zapier (free trial OK, עם plan לתשלום אח"כ)
- [ ] Page admin permissions בפייסבוק (אתה צריך להיות אדמין של ה-Page שמריצה את המודעות)
- [ ] רשימת Lead Ad forms פעילים (כדי לדעת איזה לחבר)

**לפני שמתחילים מסלול B (Meta direct)**:
- כל הנ"ל +
- [ ] Meta Business Verification (תהליך 1-3 ימים — דורש מסמכים)
- [ ] Privacy policy URL ✅ (יש לך — `/privacy`)
- [ ] Terms of service URL ✅ (יש לך — `/terms`)
- [ ] חשבון Facebook אישי שיגיש את הבקשה ל-App Review
- [ ] וידאו של 2-3 דקות (אצור אותו לאחר שהקוד מוכן — מקליט מסך של זרימת use case)

---

## סדר ביצוע מומלץ (אם תאשר)

| שלב | מה | זמן |
|---|---|---|
| 1 | מודלים: `source`, `externalLeadId`, וכו׳ ב-`ContactSubmission` | 30 דקות |
| 2 | API: `POST /api/leads/inbound` (קבלת Zapier OR Meta) | 2 שעות |
| 3 | UI: badge "📘 פייסבוק" בליד card + פילטר לפי source | 30 דקות |
| 4 | מדריך: צילומי מסך + step-by-step להגדרת Zap | 1 שעה |
| 5 | אתה מגדיר Zap → לידים מתחילים לזרום | 30 דקות |
| **סוף שלב 1** | **לידים אוטומטיים מתחילים להגיע** | **~יום** |
| 6 (מקביל) | פותחים תהליך Meta Business Verification | אתה — 1-3 ימים |
| 7 | בונים את ה-OAuth + UI חיבור Meta + webhook handler | 1.5-2 ימים |
| 8 | מגישים App Review | 30 דק׳ אחרי שהקוד מוכן |
| 9 | המתנה לאישור Meta | 2-4 שבועות |
| 10 | מאשרים → מחברים את ה-Page → מחליפים מ-Zapier ל-direct | 1 שעה |
| **סוף שלב 2** | **ליד אמיתי בזמן אמת + 0 עלות חודשית** | **~5-6 שבועות מהיום** |

---

## עלויות חודשיות

| מסלול | עלות |
|---|---|
| Zapier בלבד | ~$30/חודש |
| Direct webhook (אחרי App Review) | $0 |
| היברידי (Zapier בזמן ההמתנה) | $30 × ~6 שבועות = ~$45 חד פעמי |

---

## נקודות החלטה לפני שמתחילים

**שאלה 1**: לפתוח עם Zapier מיד (תוך יום, $30/חודש זמני), או לחכות 5-6 שבועות לפתרון חינמי?
- **המלצה**: Zapier. הערך של ליד אחד שאתה מקבל אחרי 5 דקות במקום 5 ימים גדול בהרבה מ-$30.

**שאלה 2**: יש לך Meta Business Account פעיל?
- אם כן: נמשיך מהר ל-App Review.
- אם לא: צריך להקים אותו (חינם, 30 דקות).

**שאלה 3**: כמה Lead Ad forms פעילים יש לך?
- אם 1-2: פשוט. כל form אוטומטית ייתפס.
- אם הרבה: נצטרך UI לבחירה איזה forms לסנכרן.

**שאלה 4**: יש מקרה שאתה רוצה לסנן לידים לפני שהם מגיעים? (למשל, רק לידים מקמפיין מסוים?)
- ברירת מחדל: כל ליד מכל form יוצר ContactSubmission.
- אם רוצים סינון: נוסיף שדה `formIdsAllowlist` ב-FacebookIntegration.

---

## מה לעשות עכשיו

תבחר מסלול (A / B / Hybrid) ותענה על 4 השאלות למעלה — אתחיל לבנות.
