# iOS Native-Feel UX Plan — Admin Backend Only

**היקף**: מערכת הניהול (`/admin/*`, route group `(dashboard)`). האתר הציבורי **לא בתוך ההיקף**.

**מטרה**: לקרב את חוויית האדמין (במיוחד דרך הדפדפן ב-iPhone וכ-PWA) להתנהגות הילידית של iOS — בלי לבנות אפליקציה ילידית, בלי React Native, רק שיפורים ב-Web/PWA הקיים.

**מקורות עיקריים**:
- [Apple HIG · Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Apple HIG · Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Apple HIG · Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets)
- [iOS PWA tips · firt.dev](https://firt.dev/pwa-design-tips/)
- [6 Tips PWA on iOS · netguru](https://www.netguru.com/blog/pwa-ios)
- [Pull-to-refresh React (PWA-friendly)](https://github.com/Ramynn/react-use-pull-to-refresh)

---

## מצב נוכחי (מה כבר טוב, מה חסר)

מהאודיט בקוד:

| תחום | קיים | חסר |
|---|---|---|
| **Modal** ([Modal.tsx](src/components/ui/Modal.tsx)) | Esc, focus trap, scroll-lock, backdrop dismiss, aria | Swipe-down handle, bottom-sheet במובייל, drag-to-dismiss |
| **Manifest + PWA** ([layout.tsx](src/app/layout.tsx), [manifest.json](public/manifest.json)) | `apple-mobile-web-app-capable`, status bar style, standalone, maskable icons, SW עם offline | `viewport-fit=cover`, `env(safe-area-inset-*)` בכל מקום עם fixed positioning |
| **Listing pages** (clients/leads/agreements/contacts/tasks) | Loading skeleton, empty states, inline editing | Pull-to-refresh, swipe row actions |
| **Confirms הרסניים** | — | 10+ קריאות `window.confirm()` (מכוערות ולא ממותגות) |
| **Touch targets** | רוב הכפתורים העיקריים תקינים (40-48px) | פעולות inline `text-xs` עם `py-1` ≈ 18-24px (מתחת ל-44pt של HIG) |
| **טפסים** | קלטים סטנדרטיים | אין iOS toggle switch, אין segmented control |
| **Haptic** | — | אפס שימוש ב-Vibration API |
| **Bottom nav / FAB** | FAB ב-tasks ו-hamburger במובייל | אין safe-area-inset-bottom → קונפליקט עם home indicator |
| **Toasts** | react-hot-toast | אין safe-area-inset-top → תיתכן חפיפה עם notch / dynamic island |

---

## עקרונות מנחים (מ-HIG)

1. **Modality is for short, focused tasks** — מסכים צפים קלים לסגירה (HIG: "Dismiss with little effort")
2. **Sheets slide up, partially cover, communicate temporary state** — לא full-screen אלא bottom sheet עם רקע מוצל
3. **Touch targets ≥44pt** — כפתור או פעולת מגע חייב להיות לפחות 44×44 נקודות
4. **Action Sheets for destructive choices** — בחירת מהפעלה הרסנית מוצגת מלמטה עם כפתור **Cancel** ברור וכפתור **אדום** הרסני
5. **Haptic feedback for material actions** — לא בכל לחיצה. רק כשהמשתמש "מסיים משהו" (סיום משימה, אישור, חתימה, מחיקה)
6. **Respect safe areas** — תוכן שיפעל מתחת ל-notch או על ה-home indicator יחתך
7. **Pull-to-refresh as expected pattern** — ב-iOS זו ציפייה בסיסית בכל רשימה ארוכה

---

## תוכנית בעדיפויות

### P0 — תשתית (השפעה גבוהה, קל יחסית)

#### 1. `viewport-fit=cover` + safe-area-inset utilities
- **למה**: בלי זה, ב-iPhone עם notch — תוכן fixed-positioned (FAB, sidebar, sticky headers) ייחתך ע"י notch / dynamic island / home indicator.
- **איפה**:
  - [layout.tsx](src/app/layout.tsx) → להוסיף `viewport: { viewportFit: "cover" }` ל-export `viewport`
  - [globals.css](src/app/globals.css) → להוסיף utility classes `.safe-pt`, `.safe-pb`, `.safe-px`, `.safe-pb-fab` שמיישמים `padding-top: env(safe-area-inset-top)` וכו'
  - להחיל ב-AdminSidebar (drawer, header), ב-FAB ([tasks/page.tsx:563](src/app/admin/(dashboard)/tasks/page.tsx#L563)), ב-mobile hamburger ([AdminSidebar.tsx:231](src/components/admin/AdminSidebar.tsx#L231)), בטוסטר (Toaster offset)
- **עלות**: שעה
- **HIG ref**: [Layout · Safe Areas](https://developer.apple.com/design/human-interface-guidelines/layout)

#### 2. Modal → bottom-sheet במובייל + swipe-down handle
- **למה**: HIG אומר במפורש שמודל קטן צריך להיות sheet שעולה מלמטה, עם drag-affordance ויכולת drag-down לסגירה. כיום המודל שלנו מרכזי במסך, ללא drag.
- **איפה**: [Modal.tsx](src/components/ui/Modal.tsx) — לכתוב מחדש את ה-layout שב-mobile (≤ md):
  - מעוגן לתחתית, רוחב מלא, פינות עליונות מעוגלות (rounded-t-3xl)
  - "pill" אפור 48×6px בראש (drag handle visual)
  - תמיכה ב-touch drag: `useState({ dragY })` + onTouchMove → אם dragY > 100 ו-velocity חיובית → onClose()
  - `transform: translateY(${dragY}px)` בזמן drag
- **עלות**: 2-3 שעות
- **HIG ref**: [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)

#### 3. Touch targets — `min-h-11` על כל פעולה inline
- **למה**: HIG דורש 44pt = 11 ב-tailwind. כיום פעולות כמו "ערוך", "מחק", "פתח" ב-`text-xs py-1` הן 18-24px בלבד.
- **איפה**: scan כל admin pages, להוסיף `min-h-11 inline-flex items-center` (או `min-h-[44px]`) לכל `<button>` ו-`<a>` עם class שכולל `text-xs`. דוגמאות:
  - [clients/page.tsx:404](src/app/admin/(dashboard)/clients/page.tsx#L404) (פתח אתר)
  - [contacts/page.tsx:250](src/app/admin/(dashboard)/contacts/page.tsx#L250) (Bulk actions)
  - [agreements/page.tsx](src/app/admin/(dashboard)/agreements/page.tsx) (העתק קישור / צפה / הורד / מחק)
- **עלות**: 1.5 שעות (גרפיקה לא משתנה — רק padding מתפקד כ-hit area)
- **HIG ref**: [Inputs · Touch and gestures](https://developer.apple.com/design/human-interface-guidelines/inputs/touch-and-gestures)

---

### P1 — שיפורי polish משמעותיים

#### 4. Custom Action Sheet במקום `window.confirm()`
- **למה**: `window.confirm()` יוצר native dialog שמתנגש עם המיתוג. ב-iOS, **action sheet** (גלישה מלמטה) הוא הקונבנציה לפעולות הרסניות.
- **איפה**: 
  - חדש: `src/components/ui/ConfirmSheet.tsx` — bottom sheet עם:
    - כותרת: "האם להמשיך?" + תיאור (תומך multi-line)
    - כפתור ראשי אדום ("מחק", "אישור" — ניתן להתאים)
    - כפתור "Cancel" אפור בתחתית (רחב, מרכזי)
    - backdrop dismiss + esc + swipe-down dismiss
  - חדש: `src/lib/confirm.ts` — wrapper async `confirmDanger({ title, message, confirmLabel, dangerous })` שמחזיר Promise<boolean>
  - להחליף את 10+ ה-`confirm()` הנוכחיים ל-`await confirmDanger(...)`. רשימה:
    - [clients/page.tsx:227](src/app/admin/(dashboard)/clients/page.tsx#L227)
    - [clients/[id]/page.tsx:179](src/app/admin/(dashboard)/clients/[id]/page.tsx#L179)
    - [contacts/page.tsx:141, 158](src/app/admin/(dashboard)/contacts/page.tsx#L141)
    - [agreements/page.tsx:262](src/app/admin/(dashboard)/agreements/page.tsx#L262)
    - [blog/[id]/edit/page.tsx:140](src/app/admin/(dashboard)/blog/[id]/edit/page.tsx#L140)
    - [integrations/facebook/page.tsx:103](src/app/admin/(dashboard)/integrations/facebook/page.tsx#L103)
    - [seo/page.tsx:201](src/app/admin/(dashboard)/seo/page.tsx#L201)
    - [fonts/[id]/edit/page.tsx:160, 178](src/app/admin/(dashboard)/fonts/[id]/edit/page.tsx#L160)
    - [tasks/page.tsx](src/app/admin/(dashboard)/tasks/page.tsx) (אם יש)
- **עלות**: 3-4 שעות (כולל hook utility ו-replacement)
- **HIG ref**: [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets)

#### 5. Pull-to-refresh ברשימות עיקריות
- **למה**: בכל רשימה ארוכה ב-iOS המשתמש מצפה למשוך כדי לרענן. אצלנו צריך לרענן ידנית בכפתור או ע"י reload.
- **איפה**: 
  - חדש: `src/components/ui/PullToRefresh.tsx` — wrapper שמגלגל את ה-children עם:
    - מאזין touch על ה-document/scroll container
    - כשגוללים למעלה מעבר ל-scrollTop=0 ב-distance מסוים (≥80px) → מציג spinner מעליו
    - בשחרור → קורא ל-`onRefresh()` callback (Promise<void>)
    - מחזיר scrollY = 0 אחרי הרענון
  - להחיל על: clients, leads, agreements, contacts, tasks (mobile list view)
- **עלות**: 4-5 שעות (כולל בדיקות ב-iOS Safari, ביטול overscroll-bounce)
- **HIG ref**: לא ב-HIG עצמו, אבל קונבנציה אוניברסלית

#### 6. Haptic feedback (Vibration API)
- **למה**: ב-iOS 18+, `<input type="checkbox" switch>` מספק haptic מובנה. בשאר המקרים, `navigator.vibrate()` עובד ב-Android אבל לא ב-iOS Safari (מגבלה ידועה). עדיין שווה — על Android תקבל פידבק, על iOS לא תזיק.
- **איפה**:
  - חדש: `src/lib/haptic.ts` עם פונקציות `tapLight()`, `tapMedium()`, `tapHeavy()`, `success()`, `error()` (mapping ל-vibration patterns)
  - להחיל על:
    - סימון משימה כבוצעה ([dashboard widget + tasks list](src/app/admin/(dashboard)/tasks/page.tsx)) → `success()`
    - חתימה על הסכם → `success()` (גם בעמוד הציבורי? לא, אמרת admin only)
    - מחיקה (אחרי confirm) → `tapMedium()`
    - שגיאה ב-toast → `error()`
- **עלות**: שעה
- **מקור**: [Haptic feedback in iOS Safari · Medium](https://medium.com/@posaune0423/i-open-sourced-an-oss-library-for-arbitrary-haptic-feedback-in-ios-safari-5b8ca74a5f05)

#### 7. iOS-style toggle switch
- **למה**: checkbox רגיל מרגיש לא טבעי במובייל. iOS משתמש ב-pill-toggle עם slider.
- **איפה**:
  - חדש: `src/components/ui/Toggle.tsx` — visual switch (pill 50×30, knob 26 שזז)
  - להחליף checkboxים ב-bool settings:
    - [contacts/page.tsx](src/app/admin/(dashboard)/contacts/page.tsx) (sticky filters? select multiple?)
    - [leads/page.tsx](src/app/admin/(dashboard)/leads/page.tsx) (selection checkboxes — keep these as checkboxes כי רק bulk select)
    - [tasks/page.tsx](src/app/admin/(dashboard)/tasks/page.tsx) (filter "show done"? — אם יש)
- **עלות**: 1.5 שעות

---

### P2 — refinement (לא קריטי)

#### 8. Swipe-to-delete / swipe-to-archive ברשימות
- **למה**: iOS pattern קלאסי. אבל יקר ליישום נכון (פייתון של drag detection + animation).
- **איפה**: row חדש wrapped בקומפוננטה `SwipeRow` שמגלה כפתורי action כשגוררים שמאלה. מתאים ל:
  - leads/contacts (swipe → "סמן ראיתי" / "ארכב")
  - clients (swipe → "ארכב")
- **עלות**: 6-8 שעות
- **שיקול**: רק 50% מהמשתמשים מצליחים לגלות gesture חדש בלי הדגמה. ההחלטה: **לדחות** עד שיש דרישה אמיתית; inline edit הקיים עובד.

#### 9. Page transitions עם Framer Motion
- **למה**: iOS עובר בין מסכים עם slide-from-right. הוספה תיתן תחושה ילידית.
- **איפה**: layout wrapping ב-`<AnimatePresence>` עם `motion.div` שיש לו initial/animate/exit
- **עלות**: 2 שעות
- **שיקול**: יכול להאט תחושה אם מעבר ארוך מדי. צריך לקצר ל-150-200ms.

#### 10. סטנדרטיזציית skeleton loaders
- **למה**: כיום כל page בונה skeleton משלה. עקביות תיתן תחושה מלוטשת.
- **איפה**: `src/components/ui/Skeleton.tsx` עם variants `<TableSkeleton rows={N}>`, `<CardSkeleton>`, `<ListSkeleton rows={N}>`
- **עלות**: 1.5 שעות

#### 11. System font stack
- **למה**: כיום `Birzia, Meruba, Anomalia` — מותאם לאתר. באדמין יותר תאים בטבלאות, יותר טקסט מערכתי. iOS native = SF Pro.
- **איפה**: [globals.css](src/app/globals.css) — להגדיר `.admin-font { font-family: -apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", "Birzia", system-ui, sans-serif; }`. להחיל ב-`(dashboard)/layout.tsx`.
- **עלות**: 30 דקות
- **שיקול**: סותר את הגישה הנוכחית של "ברנדינג עקבי באדמין". ההחלטה תלויה במשתמש.

---

## סיכום עלויות

| תיוג | מאמץ מצטבר | השפעה |
|---|---|---|
| **P0 (3 משימות)** | ~5 שעות | תיקון בעיות ויזואליות נראות לעין (notch, drag-to-dismiss, hit areas) |
| **P1 (4 משימות)** | ~10-12 שעות | polish משמעותי — confirm ממותג, pull-to-refresh, haptic, toggles |
| **P2 (4 משימות)** | ~10 שעות | refinement — swipe, transitions, system font |

**סך הכל ל-P0+P1**: ~17 שעות (3-4 ימי עבודה ממוקדת).

---

## המלצה לסדר ביצוע

1. **גל ראשון (P0)** — במכה אחת:
   - safe-area utilities + viewport-fit=cover
   - Modal → bottom-sheet
   - Touch targets ≥44pt sweep
   - **שיפור הראשון שמורגש מיד**.

2. **גל שני (חלק מ-P1)**:
   - ConfirmSheet (החלפת `window.confirm`)
   - Haptic helper + שימוש בפעולות עיקריות
   - **תוסיף branding-consistency + תחושה responsive**.

3. **גל שלישי (P1 נוסף)**:
   - Pull-to-refresh
   - iOS toggle component
   - **השלמת חוויה native-feeling**.

4. **P2 לפי דרישה** — לא לתכנן עד שיהיה משתמש שמבקש או קונקרטית מפריע.

---

## מה לא לעשות

- ❌ **לא להשקיע ב-React Native / Capacitor** — overhead עצום, deploy נפרד, ה-PWA הקיים מספק 95% מההרגשה
- ❌ **לא להוסיף gesture חדשים שאינם סטנדרט** (long-press, 3D-touch, edge-swipe-back) — confusion מובטח
- ❌ **לא לחקות פיקסל-בפיקסל** — UX, לא UI. iOS feel = "responsive, predictable, polished", לא "נראה כמו Notes app"
- ❌ **לא לטפל בציבורי** — דרישה מפורשת. כל השינויים מוגבלים ל-`/admin/*` (route group `(dashboard)`)
