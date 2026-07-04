# מחקר הוצאות Fuzion Webz — יולי 2026

נאסף ב-4.7.2026 מסריקה מלאה של: תיבת Gmail (davidalelad@gmail.com), GitHub CLI,
Cloudflare (wrangler), Vercel CLI. כל הסכומים אומתו מול קבלות/חשבוניות במייל אלא אם צוין אחרת.

## סיכום מהיר — run-rate חודשי נוכחי (עסקי בלבד)

| הוצאה | ספק | סוג | סכום | תחילה |
|---|---|---|---|---|
| Claude Max 20x | Anthropic | קבועה | $200/חודש | 11/2025 ($100), שודרג 29.3.26 |
| Claude API credits | Anthropic | משתנה | ~$9/חודש (auto-recharge $10) | 27.2.26 |
| OpenAI API credits | OpenAI | משתנה | ~$2/חודש ($10 חד-פעמי עד כה) | 30.5.26 |
| Vercel Pro | Vercel | קבועה | $20/חודש | 25.3.26 |
| Resend Transactional Pro | Resend | קבועה | $20/חודש (בפועל ₪58–62) | 29.5.26 |
| Magnific Premium+ | Freepik | קבועה | ₪132/חודש (ע"ש FuzionWebz) | 30.6.26 |
| Cardcom — חבילת 500 פעולות | Cardcom | קבועה | ₪100/חודש (מסוף 149683) | 23.4.26 |
| Cardcom — עמלת סליקה | Cardcom | משתנה | ~2% מכל עסקה (מחושב בדוח) | — |
| Hetzner — שרת HIGOLD prod | Hetzner | משתנה | ~$21/חודש | 30.5.26 |
| Hetzner — שרת נתן ארט | Hetzner | משתנה | ~$5–11/חודש | 25.2.26 |
| דומיינים (Cloudflare Registrar) | Cloudflare | משתנה | ~$45/חודש בקצב הנוכחי ($10.46/דומיין/שנה) | 3/2026 |
| הנהלת חשבונות (רובר/ליבנה) | רו"ח | קבועה | **לא ידוע** — ראה פערים | 10/2025 |

**סה"כ ידוע: ~$317/חודש (≈₪980) + ₪232 = ≈₪1,210/חודש**, לפני רו"ח, לפני פרסום, ולפני 2% סליקה.

## מה מאומת — פירוט

### LLM APIs
- **Anthropic Claude Max**: $100/חודש מ-1.11.2025 (חשבוניות IAMABPGS-0001..0005), שדרוג ל-Max 20x
  ב-29.3.2026 ($191.93 פרורייטד), מאז $200 בכל 29 לחודש (0008–0010). קבוע.
- **Anthropic API**: $35.07 מצטבר (27.2–17.6.26), auto-recharge $10 פעיל. ~$9/חודש.
- **OpenAI API**: טעינה בודדת $10 ב-30.5.26 (Usage Tier 1, כרטיס 2727). זניח.
- **ChatGPT**: אפס חיובים ב-2026 — מנויי Pro/Plus מ-2025 בוטלו (אישי, לפני פיוז'ן).

### אחסון ושרתים
- **Cloudflare**: Workers/Pages/R2/D1 — הכל free tier, **$0** (מאומת: wrangler מחזיר "requires
  Workers Paid" + כל החשבוניות החודשיות $0.00). ההוצאה היחידה: רישומי דומיינים —
  jumarie.co $26, ואז $10.46 פר .com (lepluxe, ocdgallery, higold-israel, naotplus, ofjerusalem,
  adamyoga-year2 ועוד). מרץ–יוני: ממוצע $45.7/חודש, גדל עם קצב הלקוחות.
- **Vercel Pro**: $20/חודש מ-25.3.26, team יחיד "Debatable's projects" (מארח את fuzionwebz.com
  + 10 אתרי floor/legacy). חריגה חד-פעמית באפריל: ~$109 on-demand (918 דקות build) — לא חזרה.
- **Hetzner**: חשבון K0285798526 (נפתח 25.2.26, מחויב ב-USD): $0.60 → $10.68 → $10.96 → $31.70
  (יולי, מכסה יוני). שיוך: שרת נתן ארט (~$5–11) מ-25.2.26; שרת HIGOLD prod מ-30.5.26
  (deploy key "higold-prod-hetzner" ב-GitHub) — ההסבר לקפיצה ל-$31.70. **סטייה מהסטאק
  הסטנדרטי — ראוי לתיעוד ב-DECISIONS.md של HIGOLD.**
- **Hostinger**: legacy של disaster-design — חיובים נכשלו, בוטל 6.6.26. לוודא ששום דבר
  בפרודקשן לא מצביע ל-srv1142224.hstgr.cloud.

### SaaS וכלים
- **Resend**: $20/חודש מ-29.5.26 (חיוב בפועל ₪58.57, ₪62.08).
- **Magnific Premium+**: ₪132/חודש מ-30.6.26, חשבונית ע"ש FuzionWebz. החליף את Google AI Pro
  (בוטל באותו יום, מסתיים 24.7.26 — ₪74.90 האחרון כבר שולם).
- **GitHub**: free plan, אין org, 64 repos — **$0** (לא ניתן לאמת סופית בלי scope `user`;
  `gh auth refresh -s user` יפתח את זה).
- **Neon**: free — אבל התראות 80%/100% compute ב-24–29.5.26 → שדרוג בתשלום מתקרב.
- **Figma**: אין חיובים בתיבה.

### דומיינים
- **GoDaddy** (11/2025–3/2026): ~₪42.65 פר .com — dorielk, daphnephysio, lila-yoga, d-one1,
  elialoni.shop (₪3.76 מבצע), fuzionwebz, fertility-collapse, ams-law, dentalcare-clinic,
  moransudry, natansart, aroma-onboarding. מ-3/2026 המעבר ל-Cloudflare Registrar.
- ⚠️ **גל חידושים GoDaddy נוב'–דצמ' 2026**: ~13 דומיינים במחיר חידוש מלא (~₪80/דומיין) —
  כדאי להעביר ל-Cloudflare ($10.46) לפני החידוש.

### אחר
- **רו"ח (רובר פתרונות פיננסיים / livne-cpa)**: חיוב חודשי ב-25 לחודש דרך קארדקום מ-10/2025.
  **הסכום בקבצי PDF בלבד** — לא חולץ. להשלים ידנית (חשבונית אחרונה: 13872 מ-25.6.26).
- **Cardcom**: חבילת 500 פעולות = ₪100/חודש מ-23.4.26 + ~2% עמלת סליקה פר עסקה
  (לא מגיעות חשבוניות למייל — בדשבורד קארדקום בלבד).
- **AWS**: חשבון נסגר 23.5.26, $0.
- **אישי (לא נכנס ל-P&L)**: YouTube Premium ₪31.90, Epoch ₪57, Chess.com, Complete Anatomy,
  Google AI Pro (מבוטל).

## פערים פתוחים (לפי סדר חשיבות)

1. **פרסום Meta/Facebook — הפער הגדול.** כל הלידים מגיעים מ-Facebook Lead Ads אבל אפס
   חיובי Meta בתיבה של אלעד → מחויב כנראה לחשבון של רועי או ל-Business Manager אחר.
   זו כנראה ההוצאה הבודדת הגדולה ביותר שחסרה. להשלים מ-Ads Manager → Billing.
2. **סכום הרו"ח** — לפתוח PDF אחד מהחשבוניות או לבדוק בדף האשראי.
3. **Vercel אפריל** — חשבונית ~$109 (S1CKR24P-0002) חסרה בתיבה; הסכום המדויק בדשבורד Vercel.
4. **Slider Revolution** (17.5.26) — סכום לא ידוע; הקבלה אצל official@disaster-design.com.
5. **Workers Paid** — אם חנויות הלקוחות אמורות לרוץ על Workers Paid ($5/חודש), זה לא מחויב
   לחשבון הזה. לבדוק אם יש חשבון Cloudflare שני (של רועי?).
6. **GitHub plan** — להריץ `gh auth refresh -s user` לאימות סופי של $0.

## מה הוכנס למערכת

מודל `Expense` חדש + כל השורות המאומתות לעיל, כולל שיוך פר לקוח (HIGOLD #41, נתן ארט #15).
שער המרה: $1 = ₪3.1 (אמפירי מחיובי Resend כולל עמלות המרה), €1 = ₪3.65 — קבועים
ב-`src/lib/finance.ts`. הלוח: `/admin/finance`.
