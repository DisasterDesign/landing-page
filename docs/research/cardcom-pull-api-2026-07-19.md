# דוח מחקר: משיכת נתונים ודוח חייבים מקארדקום דרך API

## 1. תשובה בשורה אחת

כן, אפשר, ובשתי דרכים משלימות: קארדקום מפעילה webhook ייעודי להוראות קבע שמדווח גם על חיובים שנכשלו (הגדרה בדשבורד, לא בקוד), ובמקביל קיימים REST endpoints רשמיים ב-v11 למשיכת היסטוריית חיובים כולל סטטוסי חוב (DEBTAUTOBILLING וכו'), רשימת עסקאות, ומסמכים. שניהם אומתו מול ה-swagger הרשמי ומאמרי התמיכה של קארדקום.

## 2. מה כבר יש לנו היום (מהקוד)

**אותות כשל שכבר מגיעים:**
- ה-webhook הקיים ב-`/api/payments/webhook` מזהה חיוב recurring לפי `RecurringId`, מחשב `success = (DealResponse ?? ResponseCode) === 0`, ושומר שורת `AgreementCharge` **גם כשהחיוב נכשל**, כולל push notification לאדמין ("חיוב חודשי נכשל").
- כשל בחיוב ראשון (LowProfile) מסומן רק כ-`Agreement.paymentStatus='FAILED'`, בלי שורת charge, בלי notification, בלי סיבה.

**מה נשמר ב-`AgreementCharge`:** amount, cardcomDealId (משמש ל-dedup), invoiceNumber, cardcomRecurringId, success (boolean), chargedAt (זמן הגעת ה-webhook, לא זמן החיוב), rawPayload (JSON מלא).

**הפערים המרכזיים:**
1. **אין שום read-back מקארדקום.** כל הנתונים push-only. webhook שלא הגיע = חיוב (או כשל) שפשוט לא קיים ב-DB, ואין מול מה לעשות reconciliation.
2. **אין עמודת failure reason** — הסיבה קבורה ב-rawPayload.
3. **חיובים ראשונים לא נכנסים ל-ledger** של AgreementCharge.
4. **אין next-bill-date שמור** (מחושב פעם אחת ב-setup ונשכח).
5. **אין retry לחיובים שנכשלו** — `chargeToken()` מומש אבל אין לו callers (dead code), וגם `createRecurringOrder()` (BillGold SOAP) ללא callers. המסלול החי היחיד הוא ה-NTV (`RecurringPayment.aspx`).
6. **ל-AgreementCharge אין אף קורא ב-UI** — כשלים מופיעים רק כ-push חולף.
7. **ה-webhook לא מאומת** — סומכים על payload לא חתום, בלי re-verification מול GetLpResult (בניגוד ל-primitive הקנוני).
8. webhook עם RecurringId לא מוכר נזרק עם console.warn בלבד.

**תשתית cron קיימת:** Vercel Cron עם 3 jobs יומיים (`/api/cron/*`), auth לפי user-agent או `CRON_SECRET` bearer. job חדש = שורה ב-`vercel.json` + route אחד. **הערת אבטחה:** בתבנית הקיימת, אם `CRON_SECRET` לא מוגדר ה-route פתוח לכולם (ה-fallback `!expected` מאשר כל בקשה), והוא לא נמצא ב-`.env.example`.

## 3. יכולות ה-API של קארדקום למשיכת נתונים

כל השורות למטה אומתו ישירות מול ה-swagger הרשמי (`secure.cardcom.solutions/swagger/v11/swagger.json`) ו/או מאמרי KB רשמיים.

| Endpoint / Feature | Method | מה נותן | אימות | רלוונטיות לדוח חייבים |
|---|---|---|---|---|
| `/api/v11/RecuringPayments/GetRecurringPaymentHistory` | GET (עם JSON body) | היסטוריית חיובים פר הוראת קבע או טווח תאריכים; כל שורה: Status (SUCCESSFUL / DEBTAUTOBILLING / LOSTDEBT / PAYBYOTHERE / ONHOLD / PENDINGFORPROCESSING), ResposeCode (קוד דחייה מחברת האשראי), BillingAttempts, TranzactionId, SumToBill, DocumentNumber. `FilterBy=LastUpdateDate` מאפשר polling לשינויים אחרונים | מאומת (swagger + KB) | **הליבה.** זה "דוח החייבים" ה-API-י. סינון לפי Status נעשה client-side (אין פרמטר Status בבקשה) |
| `/api/v11/RecuringPayments/GetRecurringPayment` | GET (עם JSON body) | מצב הוראת קבע: IsActive, NextDateToBill, NumOfPaymentsAlreadyCharged, FlexItem.Price, ReturnValue | מאומת | גבוהה — סוגר את פער ה-next-bill-date וה-IsActive |
| Webhook הוראות קבע (הגדרה בדשבורד: הגדרות → 6 → 1 → "למפתחים") | POST אלינו | MasterRecurring: יצירה, שינוי פעיל/לא פעיל, **וניסיון חיוב שנכשל**. DetailRecurring: כל חיוב בפועל / שינוי סטטוס חיוב, עם Status, ResposeCode, BillingAttempts, InternalDealNumber (dedup key), ReturnValue, Sum, UID. שדה Secret אופציונלי לאימות | מאומת (KB) | **גבוהה מאוד** — push רשמי על כשל, כולל אימות Secret שחסר לנו היום |
| `/api/v11/Transactions/ListTransactions` | POST | כל העסקאות בטווח תאריכים, כולל כושלות (`TranStatus=All/Failure`); DealType מבחין Recurring/Debit/Refund; DocumentNumber+DocumentUrl לקישור לחשבונית. עמוד 10-2000 | מאומת | גבוהה ל-reconciliation כללי |
| `/api/v11/Transactions/GetTransactionInfoById` | POST | עסקה בודדת לפי InternalDealNumber | מאומת | בינונית — drill-down |
| `/api/v11/LowProfile/GetLpResult` | POST | תוצאת עסקת LowProfile לפי LowProfileId (בלי ApiPassword); כולל ReturnValue, TranzactionInfo מלא | מאומת | גבוהה — סוגר את פער אימות ה-webhook של החיוב הראשון |
| `/api/v11/Documents/GetReport` | POST | רשימת חשבוניות/מסמכים בטווח תאריכים, כולל open/closed | מאומת | בינונית — reconciliation חשבונאי |
| `/api/v11/RecuringPayments/ChangeStatusForHistoryRecurringToIrrevocable` | POST | סימון שורת חוב כ-BadDebt / DebtForTracking / NoOtherPaymentMethod | מאומת | בינונית — ניהול חוב מהאפליקציה שלנו |
| `/api/v11/Financial/*` + `/Transactions/SpecialTransactions` | POST | הפקדות בנק, פירוט חיובים/זיכויים, הכחשות עסקה (chargebacks), ביטולי מנוי | מאומת | נמוכה כרגע — רלוונטי כשקארדקום היא הסולק |
| דוח חייבים מתוזמן (דשבורד: הגדרות → 7 → 7) | UI | Excel אוטומטי במייל: כל ראשון / 2 בחודש / 25 בחודש ב-06:00, skip-if-empty | מאומת | פתרון no-code מיידי, אפשר להפעיל היום |
| דף מעקב חייבים (הוראת קבע → 4) | UI | סיבת דחייה, מספר ניסיונות, חיוב ידני, קישור עדכון כרטיס ללקוח, העברה לגבייה אוטומטית | מאומת | ה-baseline הידני הקיים |

הערות טכניות: ה-path הוא באמת `RecuringPayments` (שגיאת כתיב רשמית, r אחת), `ResposeCode` גם הוא typo רשמי, וה-endpoints של recurring מוגדרים כ-GET עם JSON body — צריך לוודא שה-HTTP client שלנו תומך בזה.

**אין endpoint בשם "דוח חייבים" ב-API.** המקבילה התכנותית היא GetRecurringPaymentHistory עם סינון Status בצד שלנו.

## 4. שלוש ארכיטקטורות אפשריות

### א. Push-based: הרחבת ה-webhook הקיים + webhook הוראות קבע הרשמי

מפעילים בדשבורד את "דיווח למערכת חיצונית" עם Secret, מוסיפים route שקולט MasterRecurring/DetailRecurring, שומר סטטוס+ResposeCode+BillingAttempts ל-AgreementCharge (dedup לפי InternalDealNumber).

- **יתרונות:** real-time, כמעט אפס קוד polling, Secret נותן אימות שאין לנו היום, קארדקום דוחפת גם את סטטוסי החוב המאוחרים (DEBTAUTOBILLING, LOSTDEBT).
- **חסרונות:** לא פותר את הבעיה הבסיסית — webhook שאבד נשאר אבוד. אין מקור אמת לסגירת פערים. דיווחים כפולים מתועדים כאפשריים (חובה dedup).
- **התאמה לסטאק:** מצוינת, זה בדיוק ה-pattern הקיים ב-`/api/payments/webhook`.

### ב. Pull-based: reconciliation יומי בלבד

cron יומי (Vercel Cron, בתבנית הקיימת) שרץ על כל Agreement עם cardcomRecurringId, מושך GetRecurringPaymentHistory עם FilterBy=LastUpdateDate, מסנכרן ל-AgreementCharge, ומתריע על כל שורה שאינה SUCCESSFUL.

- **יתרונות:** מקור אמת אחד, עמיד לאובדן webhooks, סוגר רטרואקטיבית חיובים שהוחמצו, פשוט לבדיקה.
- **חסרונות:** latency של עד יום, יותר קריאות API (אם כי בסדר גודל של 18-100 לקוחות זה זניח), תלוי בהתנהגות GET-with-body שטרם נבדקה חי.
- **התאמה לסטאק:** מצוינת, entry אחד ב-vercel.json + route אחד.

### ג. היברידי: webhook להתראה מיידית + cron יומי לאמת

Push לזיהוי מהיר, Pull כרשת ביטחון וכמקור אמת. ה-cron גם משלים failure reason, next-bill-date ו-IsActive, ומסמן discrepancies (שורה בקארדקום שאין לנו, ולהפך).

- **יתרונות:** מכסה את שני מצבי הכשל (חיוב נכשל + webhook נכשל). זה בדיוק ה-gap שהמיפוי מצא: היום push-only בלי שום read-back.
- **חסרונות:** שני מסלולי כתיבה לאותה טבלה — צריך idempotency קפדני (InternalDealNumber/cardcomDealId כמפתח) וכללי "מי מנצח" ברורים.
- **התאמה לסטאק:** שני החלקים ממחזרים תשתית קיימת.

## 5. המלצה

**היברידי (ג), בשלושה שלבים, פלוס פעולה אחת בדשבורד עכשיו:**

**שלב 0 (5 דקות, בלי קוד):** להפעיל בדשבורד את הדוח החייבים המתוזמן (Excel במייל כל ראשון) + לוודא שהגבייה האוטומטית והקפצת התוקף פעילות. זה נותן ניראות מיידית עוד לפני שנכתבה שורת קוד.

**שלב 1 — Pull (הליבה, יום עד יום וחצי):** cron יומי `/api/cron/cardcom-reconcile` על תבנית ה-cron הקיימת: GetRecurringPaymentHistory לכל recurring פעיל, sync ל-AgreementCharge, migration שמוסיפה `status`, `responseCode`, `billingAttempts`, `cardcomChargeDate` לסכמה, push notification על כל שורה חדשה שאינה SUCCESSFUL, ותיקון ה-fallback הפתוח של CRON_SECRET אגב כך.

**שלב 2 — Push (חצי יום):** הפעלת ה-webhook הרשמי של הוראות קבע עם Secret, route חדש שכותב לאותה טבלה עם אותו dedup.

**שלב 3 — UI (חצי יום עד יום):** מסך "דוח חייבים" באדמין שקורא מ-AgreementCharge (שהיום אין לו אף קורא): חיובים כושלים פתוחים, סיבת דחייה, מספר ניסיונות, קישור ללקוח/הסכם.

סה"כ הערכה גסה: **2-3 ימי עבודה** לכל השלבים. שלב 1 לבדו כבר סוגר את הפער הקריטי (אין מקור אמת) ונותן התראות אמינות.

מה שנשאר מחוץ ל-scope בכוונה: dunning אוטומטי (retry דרך chargeToken), ledger לחיובים ראשונים, ואימות GetLpResult ל-webhook הקיים. שלושתם שדרוגים טבעיים אחרי שהבסיס עובד, והשלישי מומלץ בהמשך מטעמי אבטחה.

## 6. שאלות פתוחות לאימות מול קארדקום (support / קריאה חיה אחת) לפני מימוש

1. **GET עם JSON body** ב-`GetRecurringPaymentHistory` / `GetRecurringPayment`: האם השרת מקבל בפועל GET עם body, או שצריך POST / query string? (ה-swagger מצהיר GET+body, הרבה clients לא תומכים.) קריאת בדיקה אחת עם ה-credentials הקיימים תסגור את זה.
2. **אילו credentials:** ה-recurring endpoints מבקשים `apiUserName`/`apiPassword`. האם זה זוג ה-API v11 (`CARDCOM_API_NAME`/`CARDCOM_API_PASSWORD`) או זוג ה-BillGold? לא ברור מהתיעוד.
3. **`AccountId` בשאילתות recurring:** ה-query דורש AccountId או RowId. יש לנו `cardcomAccountId` על Agreement, אבל צריך לוודא שהוא מאוכלס בכל ההסכמים הפעילים ושזה אותו AccountId שה-API מצפה לו.
4. **תזמון סטטוסים:** כמה זמן אחרי כשל חיוב השורה מופיעה ב-History כ-DEBTAUTOBILLING? האם ניסיון שנכשל לפני שנכנס לגבייה אוטומטית מופיע בכלל? (המאמר מציין שהוראה שלא ניתן היה לחייב עשויה להחזיר מערך ריק.)
5. **מחזור הגבייה האוטומטית:** מתועד retry בימים קבועים (2/10/15/24 לחודש במצב רגיל). לאשר שזה חל על הטרמינל שלנו ומה קורה בסוף החודש לחוב פתוח (מתי הופך LOSTDEBT).
6. **ה-webhook החדש מול ה-webhook הקיים:** האם ה"דיווח למערכת חיצונית" של הוראות קבע מחליף או מתווסף לדיווח שכבר מגיע היום ל-`/api/payments/webhook` על חיובי recurring? צריך לוודא שלא ניצור כפילות או נשבור את הזרימה הקיימת.
7. **ReturnValue בהוראות NTV קיימות:** אנחנו שולחים ReturnValue=agreementId ב-setup. לוודא שהוא באמת חוזר ב-DetailRecurring וב-History לכל ההוראות הישנות (כולל אלה שתוקנו דרך fix-lowprofile), אחרת המיפוי חזרה ל-Agreement יתבסס על RecurringId בלבד.
8. **Rate limits ו-pagination** על GetRecurringPaymentHistory בהיקף של עשרות עד מאות הוראות: לא מתועד. לשאול או למדוד.
