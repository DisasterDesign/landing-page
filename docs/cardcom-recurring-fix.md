# תיקון הקמת הוראת קבע — מעבר מ-SOAP ל-Name to Value API

## רקע

הקוד הנוכחי משתמש ב-BillGold SOAP endpoint (`BillGoldService.asmx`) עם `Token` כדי להקים הוראת קבע. זה לא עובד.

לפי תיעוד קארדקום, הדרך הנכונה: **Name to Value API** עם **LowProfileDealGuid**.

Endpoint: `POST https://secure.cardcom.solutions/interface/RecurringPayment.aspx`
Content-Type: `application/x-www-form-urlencoded`
Response format: `Name=Value&Name2=Value2&...`

## זרימה נכונה

1. לקוח משלם דרך LowProfile → webhook מגיע עם `LowProfileId`, `Token`, `DealResponse`
2. שומרים `LowProfileId` ב-DB (שדה חדש `cardcomLowProfileId`)
3. קריאת POST ל-`RecurringPayment.aspx` עם `LowProfileDealGuid` = ה-`LowProfileId` → יוצרת לקוח + הוראת קבע בקריאה אחת

## פרמטרים נדרשים ל-RecurringPayment.aspx

### חובה:
| פרמטר | דוגמה | תיאור |
|--------|--------|--------|
| TerminalNumber | 149683 | מספר טרמינל פנימי |
| UserName | {CARDCOM_BILLGOLD_USERNAME} | שם משתמש ממשקים |
| codepage | 65001 | קידוד unicode |
| Operation | NewAndUpdate | הוסף חדש / עדכן קיים |
| LowProfileDealGuid | 72183f28-75fa-... | מזהה LowProfile מה-webhook |
| Account.CompanyName | שם הלקוח | שם לקוח / חברה |
| RecurringPayments.InternalDecription | חבילה חודשית | תיאור ההוראה |
| RecurringPayments.NextDateToBill | dd/MM/yyyy | תאריך חיוב ראשון (30 יום) |
| RecurringPayments.TotalNumOfBills | 999999 | מספר חיובים (999999 = אינסוף) |
| RecurringPayments.FinalDebitCoinId | 1 | מטבע (1 = שקל) |
| RecurringPayments.FlexItem.Price | 130.00 | מחיר חודשי |
| RecurringPayments.ReturnValue | {agreementId} | ערך החזרה |

### מומלץ:
| פרמטר | תיאור |
|--------|--------|
| Account.Email | אימייל לקוח |
| Account.PhMobile | טלפון נייד |
| RecurringPayments.FlexItem.IsPriceIncludeVat | true = מחיר כולל מע"מ |
| RecurringPayments.DocTypeToCreate | 3 = קבלה |
| RecurringPayments.FlexItem.InvoiceDescription | תיאור לחשבונית |

### הערות:
- **Password לא נדרש** ב-Name to Value — רק TerminalNumber + UserName
- פורמט תאריך: **dd/MM/yyyy** (לא ISO!)
- ב-Production חובה POST (לא GET)
- `LowProfileDealGuid` מחליף את `CreditCard.Token` — דרכו קארדקום שולף את פרטי האשראי

## תשובה צפויה (הצלחה)

```
ResponseCode=0
Description=OK
TotalRecurring=1
IsNewAccount=True
AccountId=9917
Recurring0.RecurringId=33244
Recurring0.ReturnValue={agreementId}
Recurring0.IsNewRecurring=true
```

## תשובה בכישלון

```
ResponseCode=<קוד שגיאה>
Description=<תיאור השגיאה>
```
