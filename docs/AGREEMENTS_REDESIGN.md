# מערכת הסכמים — אפיון מחדש + ארכיטקטורה

## דרישות מהמשתמש

1. **יצירת הסכם תואם לחוק הישראלי** (חוזה משפטי תקף)
2. **זרימת חתימה**: מערכת → לינק חתימה ללקוח → הלקוח חותם → נשמר אצלנו + הלקוח יכול להוריד PDF חתום
3. **מיתוג של האתר**, לא של מערכת הניהול (לוגו, צבעים, פונטים — כמו fuzionwebz.com)
4. **סכום מותאם** ע"י יוצר ההסכם (לא קבוע מסלול)
5. **חתימה → המרה אוטומטית ללקוח** בטבלת הלקוחות
6. **שיקול: כרטיס לקוח** מובנה לכל לקוח (פרופיל מלא, היסטוריה, מסמכים)

## מה כבר קיים היום

### Schema
- `Agreement` model עם: `tier (BASIC/ADVANCED/PREMIUM)`, `monthlyPrice`, `customerName/businessName/idNumber/phone/email`, `status (DRAFT/SENT/SIGNED/CANCELLED)`, `signatureData (base64 PNG)`, `content (HTML)`, `signToken`, `clientId` (relation to Client, **but לא משויך אוטומטית**)
- `Client` model עם: `name, status, notes, amount, expense, cardcomFee, websiteUrl, dates` — **חסר** email/phone/businessName/idNumber

### קוד
- `src/lib/agreement-templates.ts` — render HTML עם 12 סעיפים
- `/admin/agreements/page.tsx` — list + create modal (בוחר tier → המחיר נקבע אוטומטית)
- `/api/agreements/sign/[token]/route.ts` — POST חתימה
- `/agreement/[token]/page.tsx` + `SignAgreementClient.tsx` — דף ציבורי לחתימה (כרגע **dark theme של אדמין** — לא של האתר)
- חתימה דיגיטלית native canvas

### חסר היום
- ❌ סכום חופשי (תלוי ב-tier)
- ❌ ייצוא PDF
- ❌ מיתוג האתר בדף הציבורי
- ❌ המרה אוטומטית ללקוח אחרי חתימה
- ❌ כרטיס לקוח עם פרופיל מלא
- ❌ שדות חוקיים (IP של חותם, חותמת זמן עם UTC, סעיף ביטול עסקה לפי חוק הצרכן)

---

## ארכיטקטורת הפתרון

### 1. שינויי DB

#### Agreement — עדכונים
```prisma
model Agreement {
  // קיים: tier, customerName, businessName, idNumber, phone, email, status,
  //       signedAt, signatureData, content, signToken, createdBy, clientId

  // שינוי: monthlyPrice → חופשי לחלוטין (tier הופך לאופציונלי, רק כתבנית)
  monthlyPrice  Float       // ימולא ע"י היוצר, ללא קשר ל-tier
  tier          AgreementTier?  // null = "מותאם אישית"

  // חדשים — רישום משפטי
  signedIp        String?     // כתובת IP של החותם
  signedUserAgent String?     // user agent (browser + OS)
  documentVersion Int         @default(1)  // אם נעדכן template, נדע איזו גרסה נחתמה
  pdfHash         String?     // SHA-256 של ה-PDF החתום, לוודא שלא שונה
  contractContent String?     // תוכן ההסכם בעברית כטקסט נקי (במקרה שצריך לבנות PDF מחדש)
}
```

#### Client — הרחבה לכרטיס לקוח
```prisma
model Client {
  // קיים: number, name, status, notes, amount, expense, cardcomFee,
  //       websiteUrl, startDate, paymentDate, agreements

  // חדשים — כרטיס לקוח מלא
  email        String?
  phone        String?
  businessName String?
  idNumber     String?       // ת"ז / ח"פ
  source       String?       // "agreement_signed" / "manual" / "lead_converted"
  archivedAt   DateTime?     // soft delete

  contactNotes ClientNote[]  // מודל חדש (תיעוד שיחות / החלטות)
}

model ClientNote {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())

  @@index([clientId, createdAt])
}
```

> **לא נמחק את Agreement.tier** — נשאיר כ-template hint (לתבניות ההסכם), אבל המחיר נקבע ע"י היוצר.

### 2. מיתוג הדף הציבורי

#### בעיה
ה-SignAgreementClient כרגע ב-dark mode של האדמין. צריך להפוך אותו למיתוג האתר.

#### פתרון
- **לוגו**: לחלץ ל-`<Image src="/logo.svg">` בראש העמוד
- **צבעים**: pink/cyan accents כמו האתר (לא admin-light)
- **פונטים**: Birzia (כבר default ב-body, רק להסיר את ה-`.admin-light` wrapper)
- **רקע**: שחור עם grid pattern (כמו האתר)
- **קוסטום קורסור**: לא נטעין כי זה דף משפטי — קורסור רגיל
- **CTA buttons**: pink filled (לא neutral grays)

הדף נמצא ב-`src/app/agreement/[token]/` שזה **מחוץ** ל-`(public)` ול-`admin`. כרגע זה layout-less. נחבר את ה-marketing layout components הרלוונטיים (Logo, Footer בלי Navbar) או נעצב מחדש.

### 3. סכום חופשי

#### UI
ב-Modal יצירת הסכם ב-`/admin/agreements`:
- ה-tier הופך לאופציונלי — רק "תבנית מילוי" (ימלא מחיר ברירת מחדל)
- שדה חדש **"מחיר חודשי (₪)"** — תמיד גלוי, ניתן לעריכה
- כש-tier נבחר: המחיר מתמלא אוטומטית (99/199/299) אבל המשתמש יכול לשנות
- נוסף: **"סכום חד פעמי (₪)"** עם checkbox "יש סכום הקמה חד פעמי" — לעסקים שגובים setup fee

#### Template
- במקום "מחיר חודשי: 99 ₪ + מע"מ" → "מחיר חודשי: {{monthlyPrice}} ₪ + מע"מ"
- אם יש setup fee: סעיף נוסף "סכום הקמה חד פעמי"

### 4. ייצוא PDF

#### בחירה: Client-side (browser print)
**למה**: Hebrew RTL ב-PDF דורש registration של פונטים. כל ספרייה JS server-side (jsPDF, pdfkit, react-pdf) דורשת embedding של Birzia/Meruba. זה אפשרי אבל מוסיף משקל ל-Vercel functions.

**הפתרון הפרגמטי**: עמוד `/agreement/[token]/pdf` שמציג את ה-content עם CSS מיועד להדפסה (`@media print`). הלקוח לוחץ "הורד PDF" → JS עושה `window.print()` → המשתמש בוחר "Save as PDF" בדיאלוג של הדפדפן.

**יתרונות**:
- אפס תלויות
- תמיכה מלאה ב-Hebrew RTL (הדפדפן יודע)
- כל הפונטים נטענים אוטומטית
- אפס עלות compute

**חסרונות**:
- המשתמש צריך 2 קליקים (לחיצה + Save as PDF)
- שם הקובץ default של הדפדפן (אנחנו נציע באמצעות `document.title`)

#### חלופה (אם המשתמש לא אוהב): server-side
- `puppeteer-core` + `@sparticuz/chromium` ל-Vercel
- function נפרדת ב-Vercel Pro (יותר זיכרון)
- עלות ~$0.0002 per PDF (זניח)
- זמן: ~2-3 שניות

**המלצה לפאז 1**: client-side print. אם תרצה שם קובץ קבוע + הורדה ב-1 קליק → server-side ב-פאז 2.

### 5. המרה אוטומטית ללקוח

#### לוגיקה ב-`/api/agreements/sign/[token]` POST (אחרי הצלחת חתימה):

```ts
// אחרי: status=SIGNED, signedAt set
const existingClient = await prisma.client.findFirst({
  where: {
    OR: [
      { email: agreement.email },
      { phone: agreement.phone },
    ],
  },
});

if (existingClient) {
  // לקוח קיים — לקשר את ההסכם
  await prisma.agreement.update({
    where: { id: agreement.id },
    data: { clientId: existingClient.id },
  });
} else {
  // לקוח חדש — ליצור
  const client = await prisma.client.create({
    data: {
      name: agreement.customerName,
      email: agreement.email,
      phone: agreement.phone,
      businessName: agreement.businessName,
      idNumber: agreement.idNumber,
      amount: agreement.monthlyPrice,  // המחיר החודשי = ה-amount של הלקוח
      cardcomFee: agreement.monthlyPrice * 0.02,
      source: "agreement_signed",
      startDate: new Date(),
      status: "פעיל",
    },
  });
  await prisma.agreement.update({
    where: { id: agreement.id },
    data: { clientId: client.id },
  });
}
```

### 6. כרטיס לקוח

#### דף חדש `/admin/clients/[id]`
- Header: שם + מספר לקוח + סטטוס + 4 כפתורים (וואטסאפ, אימייל, אתר, מחק)
- 4 קלפים בראש:
  - הכנסה חודשית
  - רווח נקי
  - תאריך התחלה
  - חודשים פעילים
- 4 טאבים:
  - **פרטים**: כל השדות הנערכים inline (כמו עכשיו ב-row)
  - **הסכמים**: רשימת agreements של הלקוח עם downloads
  - **תיעוד**: notes timeline (כמו ב-leads)
  - **פעילות**: tasks קשורות (אופציונלי — אם נוסיף Task.clientId בעתיד)

#### שינוי ב-`/admin/clients` (הטבלה הקיימת)
- לחיצה על שם הלקוח → ניווט ל-`/admin/clients/[id]`
- הטבלה נשארת לעריכה מהירה inline

### 7. אבטחה משפטית — שדות חוקיים

ה-IP + User Agent של החותם נרשמים ב-`/api/agreements/sign/[token]` POST:

```ts
const signedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                 req.headers.get("x-real-ip") || "unknown";
const signedUserAgent = req.headers.get("user-agent") || "unknown";
```

נשמר באובייקט הסופי. ב-PDF יופיע סעיף "התחייבויות חתימה דיגיטלית":
> "החתימה בוצעה ב-{date} מכתובת IP {ip} באמצעות {browser}. שמירה דיגיטלית מהווה ראיה משפטית לפי חוק חתימה אלקטרונית, התשס"א-2001."

---

## עדכונים לתבנית ההסכם — חוק ישראלי

הסעיפים הקיימים (12) טובים. נוסיף/נחזק:

### סעיף חדש 13 — תקופת ביטול עסקה (חוק הגנת הצרכן)
> "עסקה זו נחתמת מרחוק. בהתאם לחוק הגנת הצרכן (התשמ"א-1981), אם ההסכם נחתם בעסקה מרחוק והלקוח הוא צרכן פרטי (לא עסק), הלקוח רשאי לבטל את העסקה תוך 14 ימי עסקים מיום החתימה, ללא תשלום. ביטול ייעשה בהודעה כתובה בכתב או בדואר אלקטרוני."

### סעיף 12 (חתימה דיגיטלית) — חיזוק
> "חתימה דיגיטלית זו מהווה הסכמה משפטית מלאה לכל הקבוע במסמך, בהתאם לחוק חתימה אלקטרונית, התשס"א-2001. החתימה נשמרת במערכת המוגנת של נותן השירות עם רישום מלא של מועד החתימה, IP החותם וגרסת הדפדפן."

### סעיף ביטול קיים — שינוי ל-30 יום (במקום 14)
> "...איחור בתשלום של מעל 30 ימים..." (במקום 14, כי 14 כבר התחייבות לביטול עסקה — לא נכפיל)

### חדש: שמירת מסמך
> "עותק חתום של ההסכם יישמר במערכת המוגנת של נותן השירות. הלקוח יכול להוריד עותק PDF מקומי בכל עת מהקישור שנשלח לו."

---

## קבצים — סיכום שינויים

| קובץ | פעולה |
|---|---|
| `prisma/schema.prisma` | edit: Agreement שדות חדשים (signedIp, signedUserAgent, pdfHash, oneTimeFee?), Client שדות חדשים (email/phone/businessName/idNumber/source/archivedAt), ClientNote model |
| `src/lib/agreement-templates.ts` | edit: תמיכה במחיר חופשי, סעיפים 13 + עדכוני 12 + סעיף שמירה, embed לוגו ב-base64 |
| `src/lib/validations.ts` | edit: createAgreementSchema גם מקבל monthlyPrice (במקום נגזר מ-tier), tier אופציונלי |
| `src/app/api/agreements/route.ts` | edit: POST יקבל מחיר חופשי |
| `src/app/api/agreements/[id]/route.ts` | edit: PATCH לעדכון מחיר |
| `src/app/api/agreements/sign/[token]/route.ts` | edit: רושם IP + UA, יוצר/מקשר Client אוטומטית, מחזיר success URL לדף PDF |
| `src/app/api/clients/route.ts` | edit: GET — include count of agreements; POST — קבלת השדות החדשים |
| `src/app/api/clients/[id]/route.ts` | edit: PATCH מקבל את השדות החדשים |
| `src/app/api/clients/[id]/notes/route.ts` | new: POST הערה |
| `src/app/admin/(dashboard)/agreements/page.tsx` | edit: form עם monthlyPrice חופשי + checkbox setup fee |
| `src/app/admin/(dashboard)/clients/[id]/page.tsx` | new: כרטיס לקוח עם 4 טאבים |
| `src/app/admin/(dashboard)/clients/page.tsx` | edit: שם הלקוח הופך ל-Link → `/admin/clients/[id]` |
| `src/app/agreement/[token]/page.tsx` | edit: רינדור חדש עם marketing branding |
| `src/app/agreement/[token]/SignAgreementClient.tsx` | rewrite: עיצוב חדש עם logo, pink accents, light theme, שחור על לבן בלינק לחוזה |
| `src/app/agreement/[token]/pdf/page.tsx` | new: print-ready view — `@media print` CSS, "הורד PDF" → window.print() |
| `src/lib/validations.ts` | edit: clientPatchSchema + שדות חדשים |

---

## תהליך חתימה — sequence diagram

```
1. אדמין → /admin/agreements → "הסכם חדש"
   - בוחר tier (אופציונלי, רק כברירת מחדל למחיר)
   - מזין מחיר חופשי (ניתן לערוך גם אם נבחר tier)
   - מילוי פרטי לקוח
   - יצירת Agreement (status=DRAFT)

2. אדמין → "העתק קישור" → wa.me/email את הקישור ללקוח

3. לקוח לוחץ → דף /agreement/[token]
   - עיצוב מיתוג האתר (לוגו, ורוד/ציאן)
   - רואה את כל סעיפי החוזה
   - ממלא פרטים (פרי-fill מנתוני הלקוח שנשמרו)
   - חותם בקנבס
   - מאשר checkbox

4. שליחה → POST /api/agreements/sign/[token]
   - שמירת signature
   - רישום IP + UA + signedAt + UTC timestamp
   - status=SIGNED
   - הצמדה / יצירת Client אוטומטית
   - יצירת notification לאדמינים ("הסכם נחתם — Y נוסף ללקוחות")

5. הלקוח רואה Success Screen:
   - "ההסכם נחתם בהצלחה ✓"
   - "הורד PDF" כפתור
   - "שלח לאימייל" אופציונלי (פאז 2)

6. PDF: window.print() עם CSS מותאם → המשתמש בוחר Save as PDF

7. אדמין רואה ב-/admin/agreements → status=SIGNED + לינק ל-/admin/clients/[id] של הלקוח החדש
```

---

## עלויות ותזמון

| פיצ'ר | זמן עבודה | תלויות |
|---|---|---|
| DB migrations + Client הרחבה | 30 דק׳ | אין |
| Template עדכון (סעיפים + לוגו + מחיר חופשי) | 1.5 שעות | אין |
| Sign page redesign (marketing branding) | 2 שעות | logo + הצבעים הקיימים |
| API: רישום IP/UA + auto-create Client | 1 שעה | אין |
| PDF print page + button | 1 שעה | אין |
| כרטיס לקוח (`/admin/clients/[id]`) + ClientNote | 3 שעות | אין |
| Tests + cleanup | 1 שעה | |
| **סה"כ** | **~יום וחצי עבודה** | |

עלות חודשית: **0 ₪** (PDF נוצר ב-browser, אין infra חדשה).

---

## נקודות החלטה לפני שאתחיל

1. **PDF approach**: Client-side print (פשוט, 2 קליקים) או server-side puppeteer (יותר חלק, יותר משאבים)?
   - **המלצה**: client-side לפאז 1.

2. **כרטיס לקוח — עכשיו או דחוי?**
   - **המלצה**: עכשיו. כי אחרי המעבר ל-Client אוטומטי, הצורך בעמוד פרטי לקוח יהיה מיידי. אם נדחה, נשרך לחזור ולעשות 2 commits.

3. **חוזה לעוסקים מורשים בלבד או גם פרטיים?**
   - אם רק עסקים → סעיף ביטול 14 יום של חוק הגנת הצרכן לא חל. לא מוסיפים.
   - אם גם פרטיים → חובה להוסיף.
   - **שאלה לך**: האם אי פעם ייחתם חוזה עם אדם פרטי שאינו עוסק? אם כן — נוסיף את הסעיף.

4. **Logo בדף הציבורי**: שם או רק לוגו? Logo בלבד נראה הכי נקי.
   - **המלצה**: רק לוגו עם linkback לאתר.

5. **שם הקובץ של ה-PDF**: `הסכם — {שם לקוח} — {תאריך}.pdf`?

תאשר → אתחיל לבנות.
