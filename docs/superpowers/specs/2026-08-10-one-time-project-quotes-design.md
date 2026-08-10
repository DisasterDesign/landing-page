# הצעות מחיר לפרויקטים חד-פעמיים

**10.8.2026 · אושר על ידי אלעד**

## הבעיה

אין דרך להוציא הצעת מחיר לעבודה חד-פעמית. שני המנגנונים הקיימים לא מתאימים:

- **`Agreement`** יודע לחתום ולגבות, אבל `ensureClientForAgreement` יוצר
  `Client` קבוע בחתימה. לקוח שקנה לוגו פעם אחת היה מזהם את רשימת הלקוחות,
  את מניין הלקוחות ואת ה-MRR.
- **`ClientJob`** הוא סקשן "עבודות חד-פעמיות" הקיים, אבל `clientId` שלו
  חובה ומוחק בקסקייד — הוא מתאר עבודה נוספת ל**לקוח קיים**, לא לקוח
  שקיים רק בשביל עבודה אחת. וגם אין לו שום מכונת חתימה או תשלום.

## ההחלטה

מבחין `kind` על `Agreement`, לא מודל חדש.

```prisma
enum AgreementKind { SUBSCRIPTION, ONE_TIME }

model Agreement {
  kind         AgreementKind @default(SUBSCRIPTION)
  projectTitle String?
}
```

להצעה חד-פעמית: `monthlyPrice = 0`, `oneTimeFee` = הסכום נטו, `tier = null`,
`clientId` נשאר `null` לתמיד.

### למה לא מודל נפרד

מודל נפרד היה משכפל את מסלול הכסף — אימות קארדקום, אידמפוטנטיות,
webhook, `AgreementCharge`. ב-9.8 תוקן שם באג שהחזיר 503 לקארדקום על חיוב
שכן עבר; עותק שני של הקוד הזה הוא הסיכון הגדול ביותר שאפשר להכניס.
`Agreement.clientId` כבר `nullable` — המודל תוכנן לתמוך בהסכם בלי לקוח.

### מה כבר עובד נכון בלי שינוי

שתי הנקודות המסוכנות כבר מכוסות על ידי הקוד הקיים:

| | מנגנון קיים |
|---|---|
| סכום החיוב | `webhook:180` — `monthlyPrice + (oneTimeFee ?? 0)`. עם 0 חודשי הסכום הוא בדיוק ה-`oneTimeFee`. |
| הוראת קבע | `webhook:287` — הגייט הוא `monthlyPrice > 0`. הסכם חד-פעמי לעולם לא ייצור BillGold. |
| דוח שותפים | `partnerId = null` = עסקת בית. `viewer.ts` מסנן לשותפים. |
| MRR | `syncClientMonthly` נקרא רק דרך לקוח. אין לקוח — אין MRR. |

**השינוי היחיד בקוד הכסף: דילוג על `ensureClientForAgreement`.**

## מחזור חיים

`DRAFT → SENT → SIGNED → PAID`, ו-`CANCELLED` בכל שלב.
`AgreementStatus` ו-`PaymentStatus` הקיימים מכסים את זה. אין סטטוסים חדשים.

## איפה זה חי

הכל ב-`/admin/jobs` ("עבודות חד-פעמיות"), שהופך מספר-חשבונות לספר-חשבונות
וצנרת. `/admin/agreements` נשאר מנויים בלבד.

`/api/jobs` ממזג שני מקורות לשורה אחת עם מבחין:

```ts
source: "job"   // ClientJob של לקוח קיים — clientId מלא
source: "quote" // Agreement חד-פעמי — clientId null, שם מ-businessName ?? customerName
```

חישוב הכסף עובר דרך `jobFinance()` הקיים לשני המקורות. להצעה:
`cardcomFee = true` (שולם בקארדקום), `paymentTermsDays = 0` (מיידי).

## הרשאות

`isOwner` — לא `role`. שלוש נקודות אכיפה: הכפתור, ה-POST ליצירה,
וסינון ההצעות ב-GET. שותפים לא רואים את הסקשן ממילא דרך `viewer.ts`.

## בדיקות שומר

הסיכון כולו במסלול הכסף, ולכן הלוגיקה חולצה ל-`src/lib/agreements/one-time.ts`
כפונקציות טהורות:

1. הסכם `ONE_TIME` — **לא מקצה `Client`**
2. הסכם `ONE_TIME` — **לא יוצר `cardcomRecurringId`**. אם הבדיקה הזו
   תישבר, לקוח חד-פעמי יחויב כל חודש.
3. הסכם `ONE_TIME` — לא נכנס ל-MRR ולא לדוח השותפים
4. `projectTitle` חובה כש-`kind = ONE_TIME`

## מחוץ לתחום

אין הפיכה אוטומטית ללקוח מנוי · אין תזכורות על הצעות שלא נענו ·
אין PDF (דף החתימה הוא המסמך) · אין עריכה אחרי חתימה.
