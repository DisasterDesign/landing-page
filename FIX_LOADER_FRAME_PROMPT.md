# URGENT FIX: Loader Stuck + Frame Not Visible + Logo Line-Draw Animation

The site at https://www.fuzionwebz.com has critical issues. Fix them in order.

---

## BUG 1 — Loader is STUCK (blocks entire site)

**File:** `src/components/animations/Loader.tsx`

**Root cause:** GSAP is imported with `import gsap from "gsap"` but at runtime `typeof gsap === undefined` — GSAP is not being tree-shaken correctly or there's a bundling issue. The GSAP timeline never executes, so the black overlay (z-[9999], opacity:1) stays forever and blocks the entire site.

**Fix approach — rewrite Loader using Framer Motion instead of GSAP:**

The Loader component must be completely rewritten. Do NOT use GSAP in the Loader. Use Framer Motion (which is already working fine on the site — Navbar and other components use it successfully).

### New Loader behavior:
1. **Full-screen black overlay** (fixed inset-0 z-[9999])
2. **Logo SVG draws on with line animation:**
   - The logo at `public/logo-white.svg` has 23 `<path>` elements with `fill="white"`.
   - For the line-draw effect: create a separate SVG component that converts the filled paths to **stroked outlines**.
   - Since the paths are complex filled shapes (not strokes), the simplest approach that works is:
     - Show the logo with `opacity: 0` initially
     - Animate a **clip-path reveal** (wipe from left to right or center outward) to simulate a "drawing" effect
     - OR use a simpler approach: fade in the logo with a glowing edge sweep effect
   - The KEY visual effect the user wants is: the logo "builds itself" on screen with an animated line/reveal

   **Recommended implementation:**
   ```tsx
   // Use a clip-path animation with framer-motion
   // Start: clip-path: inset(0 100% 0 0)  — fully hidden
   // End: clip-path: inset(0 0% 0 0)  — fully visible
   // This creates a wipe-reveal that looks like the logo is being "drawn"
   // Add a subtle glow/gradient at the reveal edge for the "pen" effect
   ```

3. **After reveal (1.5s): Chromatic split effect**
   - Show two copies of the logo offset: pink copy at (-4px, +2px), cyan copy at (+4px, -2px), both at opacity 0.7
   - Hold for 0.3s, then merge back (both copies go to 0,0 and opacity 0)

4. **After chromatic (2.2s): Logo flies to navbar position**
   - Logo is currently centered and large (~200-280px)
   - Animate: scale down + translate to top-right corner (where the navbar logo sits)
   - The navbar logo is at approximately: top: 16px, right: auto, left: 24px (inside the frame), size: h-8 (32px)
   - BUT since this is an RTL site, the logo is on the RIGHT side of the navbar
   - Calculate target position: `top: 26px, right: 24px` (inside the 10px frame inset)
   - Scale from current size to ~32px height

5. **After fly (2.8s): Fade out overlay**
   - Animate overlay opacity from 1 to 0
   - After complete: set display none or unmount component

6. **Session storage:** Check `sessionStorage.getItem("fuzion-loaded")` — if exists, skip the entire animation and don't render the Loader at all.

7. **Reduced motion:** If `prefers-reduced-motion: reduce`, skip animation, set sessionStorage, don't render.

### Technical notes:
- Use `framer-motion`'s `motion.div` with `animate` and `variants` or a `useAnimate` hook
- Use `onAnimationComplete` callbacks to chain the phases
- The overlay MUST be removed from DOM or set `pointer-events: none` + `opacity: 0` + `display: none` after animation completes
- Do NOT use `setTimeout` as primary timing — use Framer Motion's `transition` with `delay`

---

## BUG 2 — Frame not visible / not working correctly

**Current state:** The frame elements exist in the DOM:
- `<div className="fixed inset-0 z-0 bg-[#0a0a0a]" />` — frame background ✓
- `<div className="fixed inset-[5px] md:inset-[10px] z-[1] rounded-[12px] md:rounded-[20px] overflow-hidden bg-black">` — content container ✓

**Problem:** The frame IS there but it's invisible because:
1. The Loader overlay (z-9999) covers everything — fix Bug 1 first
2. The frame bg `#0a0a0a` vs content bg `#000` is too subtle to see

**Fix:** Change the frame background to be slightly more visible:
- Frame background: `bg-[#111111]` (was `bg-[#0a0a0a]`)
- OR add a subtle border: add `border border-gray-800/30` to the content container

**Also verify:** The Navbar `fixed top-0 left-0 right-0` positioning — it should be relative to the frame container, not the viewport. Since the content is inside `overflow-hidden` with `overflow-y-auto`, the Navbar's `fixed` positioning might break.

**Fix Navbar positioning:**
The Navbar uses `position: fixed` which positions relative to the viewport, not the scroll container. Since content scrolls inside `.overflow-y-auto`, the Navbar should use `sticky top-0` instead of `fixed`:

In `src/components/layout/Navbar.tsx`:
- Change the `<motion.header>` from `fixed top-0 left-0 right-0` to `sticky top-0`
- This way it sticks to the top of the scroll container (inside the frame), not the viewport

---

## BUG 3 — Logo size in Navbar too small

**Current:** `<Image src="/logo-white.svg" ... className="h-8 w-auto" />`  (h-8 = 32px)

**Fix:** Change to `className="h-10 w-auto"` (h-10 = 40px) for better visibility. The reference site uses 72x72 for the logo. Our logo is horizontal (wordmark), so 40px height is appropriate.

Also: remove `width={120} height={40}` hardcoded attributes from the `<Image>` — let CSS handle it with `w-auto`.

---

## BUG 4 — GridBackground not working

**File:** `src/components/animations/GridBackground.tsx`

**Problem:** The `useScroll()` hook from Framer Motion tracks the **document/window** scroll, but content scrolls inside `#smooth-content` (the overflow-y-auto div), NOT the window. So `scrollYProgress` stays at 0 and opacity stays at 0.

**Fix:** Pass the scroll container ref to `useScroll`:

In `src/app/(public)/layout.tsx`:
- Add a ref to the `#smooth-content` div
- Pass it to GridBackground as a prop

In `src/components/animations/GridBackground.tsx`:
```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { RefObject } from "react";

export default function GridBackground({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 0.12, 0.12, 0]);

  return (
    <motion.div
      className="fixed inset-[5px] md:inset-[10px] rounded-[12px] md:rounded-[20px] pointer-events-none z-[2]"
      style={{
        opacity,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}
```

But wait — since GridBackground uses `position: fixed`, it's positioned relative to the viewport, not the scroll container. It should be `absolute` or positioned inside the scroll container.

**Better approach:** Make the GridBackground `absolute` and place it as a sibling inside the scroll container, with `position: sticky` or just `position: fixed` (which works since it's inside `overflow: hidden`). Actually, the simplest fix: just use `position: absolute` with `inset-0` inside the frame container (not the scroll container), and drive opacity from a scroll event listener instead of `useScroll`:

```tsx
"use client";
import { useEffect, useState } from "react";

export default function GridBackground() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

      // Fade in from 0-10% scroll, stay visible, fade out at 90-100%
      let newOpacity = 0;
      if (progress < 0.1) newOpacity = progress / 0.1 * 0.12;
      else if (progress > 0.9) newOpacity = (1 - progress) / 0.1 * 0.12;
      else newOpacity = 0.12;

      setOpacity(newOpacity);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[2]"
      style={{
        opacity,
        transition: "opacity 0.3s ease",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}
```

---

## BUG 5 — Hero GSAP animation also likely broken

**File:** `src/components/sections/Hero.tsx`

Same GSAP issue as the Loader — if GSAP isn't loading properly in the browser, the hero letter-by-letter animation won't work either.

**Diagnosis step:** Check if GSAP actually works. The issue might be a Next.js server/client boundary problem. GSAP should only run on the client.

**If GSAP works in Hero but not Loader:** The issue might be that the Loader mounts before GSAP is loaded (it's the first component). In that case, add a `requestAnimationFrame` or short delay before starting the GSAP timeline.

**If GSAP doesn't work anywhere:** Switch Hero animation to Framer Motion too:
```tsx
// Replace gsap.fromTo with framer-motion variants
// Use staggerChildren on the parent, and each letter has an initial/animate variant
```

---

## EXECUTION ORDER

1. Fix Loader.tsx (rewrite with Framer Motion) — this unblocks the site
2. Fix Navbar positioning (sticky instead of fixed)
3. Fix logo size
4. Fix GridBackground scroll tracking
5. Fix frame contrast (darker frame bg)
6. Test Hero animation — fix if GSAP broken
7. `npm run build` — must pass
8. `git add -A && git commit -m "fix: loader animation, frame visibility, navbar positioning, grid scroll tracking" && git push origin main`

---

## TESTING

After pushing, verify at https://www.fuzionwebz.com:
1. Loader plays and completes (doesn't get stuck)
2. After loader, the frame (10px border with rounded corners) is visible
3. Grid pattern appears when scrolling
4. Navbar logo is readable size
5. Hero text animation works
6. All sections are visible and scrollable
