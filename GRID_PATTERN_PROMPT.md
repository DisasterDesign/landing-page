# Scroll-Reactive Hexagonal Grid Background

Replace the current `GridBackground` component with a Buzzworthy-style scroll-reactive pattern system.

---

## WHAT IT IS

Two layers of a hexagonal/geometric line pattern — one entering from above, one from below — that **slide into view based on scroll speed and direction**. When the user stops scrolling, the patterns slide back out. This creates a dynamic sense of velocity and depth.

**Current file to replace:** `src/components/animations/GridBackground.tsx`

---

## HOW BUZZWORTHY DOES IT

### Structure:
```
div.scrollPattern (absolute, z:-1, behind content)
  div.patternTop (absolute, starts hidden above viewport at top: -100%)
    img (1972x1168 hexagonal line pattern, opacity: 0.5)
  div.patternBottom (absolute, starts hidden below viewport at top: 100%)
    img (1972x1168 hexagonal line pattern, opacity: 0.5)
```

### Animation logic (runs in requestAnimationFrame):
1. Measure scroll speed: `diff = newScrollPosition - previousScrollPosition`
2. Normalize to 0–1: `speed = Math.min(Math.abs(diff * 5) / 100, 1)`
3. **Scrolling DOWN** → `patternBottom` slides UP by `speed * 100%`, `patternTop` resets to 0
4. **Scrolling UP** → `patternTop` slides DOWN by `speed * 100%`, `patternBottom` resets to 0
5. Uses GSAP `gsap.to()` for smooth eased transitions (we'll use CSS transitions or Framer Motion)

### The pattern image:
- Hexagonal grid lines — white/light color (#D4D4FF-ish) on transparent background
- Lines are ~2px wide, very low alpha (~20-90, max 255 at intersections)
- The grid has a repeating hex cell pattern: groups of 3 parallel lines spaced ~25px apart, with ~76px gaps between groups
- Alpha is uniform across the image (~18-19 average) — no radial fade
- Image displayed at opacity: 0.5 and stretched to fill the container
- **Desktop only** — disabled on mobile

---

## IMPLEMENTATION

### Step 1: Generate the hexagonal pattern as SVG (no image file needed)

Instead of using a raster image, create the hex pattern as an **inline SVG pattern** that tiles. This is cleaner, resolution-independent, and doesn't require loading an image file.

Create `src/components/animations/HexPattern.tsx`:

```tsx
"use client";

export default function HexPattern({ id, className }: { id: string; className?: string }) {
  // Hexagonal grid: lines at 0°, 60°, and 120° angles
  // Cell size ~76px, line groups of 3 at ~25px spacing
  const cellSize = 76;
  const lineGap = 25;

  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <pattern
          id={id}
          x="0"
          y="0"
          width={cellSize * 2}
          height={cellSize * Math.sqrt(3)}
          patternUnits="userSpaceOnUse"
        >
          {/* Vertical lines (0°) */}
          {[0, lineGap, lineGap * 2, cellSize, cellSize + lineGap, cellSize + lineGap * 2].map((x, i) => (
            <line
              key={`v${i}`}
              x1={x} y1={0} x2={x} y2={cellSize * Math.sqrt(3)}
              stroke="white"
              strokeWidth="1"
              opacity="0.12"
            />
          ))}

          {/* 60° diagonal lines */}
          {[-2, -1, 0, 1, 2, 3, 4].map((offset, i) => {
            const y0 = offset * lineGap;
            const dx = cellSize * Math.sqrt(3);
            return (
              <line
                key={`d1-${i}`}
                x1={0} y1={y0}
                x2={cellSize * 2} y2={y0 + cellSize * 2 * Math.tan(Math.PI / 3)}
                stroke="white"
                strokeWidth="1"
                opacity="0.08"
              />
            );
          })}

          {/* 120° diagonal lines */}
          {[-2, -1, 0, 1, 2, 3, 4].map((offset, i) => {
            const y0 = offset * lineGap;
            return (
              <line
                key={`d2-${i}`}
                x1={0} y1={y0}
                x2={cellSize * 2} y2={y0 - cellSize * 2 * Math.tan(Math.PI / 3)}
                stroke="white"
                strokeWidth="1"
                opacity="0.08"
              />
            );
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
```

**IMPORTANT:** The above is a starting point. The exact pattern may need tuning to look good. An alternative simpler approach that looks great:

Use **CSS repeating-linear-gradient** to create three sets of lines at 0°, 60°, and -60°:

```css
.hex-pattern {
  background-image:
    /* Vertical lines */
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 74px,
      rgba(255, 255, 255, 0.06) 74px,
      rgba(255, 255, 255, 0.06) 76px
    ),
    /* 60° lines */
    repeating-linear-gradient(
      60deg,
      transparent,
      transparent 74px,
      rgba(255, 255, 255, 0.04) 74px,
      rgba(255, 255, 255, 0.04) 76px
    ),
    /* -60° lines */
    repeating-linear-gradient(
      -60deg,
      transparent,
      transparent 74px,
      rgba(255, 255, 255, 0.04) 74px,
      rgba(255, 255, 255, 0.04) 76px
    );
}
```

**Pick whichever approach (SVG or CSS gradients) produces the better visual. The CSS approach is simpler and more performant. Try CSS first.**

---

### Step 2: Rewrite GridBackground.tsx

Replace the entire file `src/components/animations/GridBackground.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function GridBackground() {
  const [topY, setTopY] = useState(-100); // percentage, starts hidden above
  const [bottomY, setBottomY] = useState(100); // percentage, starts hidden below
  const prevScroll = useRef(0);
  const rafRef = useRef<number>(0);
  const speedRef = useRef(0);
  const directionRef = useRef<"up" | "down">("down");

  useEffect(() => {
    // Desktop only
    if (window.innerWidth < 768) return;

    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    let currentTopY = -100;
    let currentBottomY = 100;
    let targetTopY = -100;
    let targetBottomY = 100;

    const animate = () => {
      const scrollTop = scrollContainer.scrollTop;
      const diff = scrollTop - prevScroll.current;
      const speed = Math.min(Math.abs(diff * 5) / 100, 1);
      prevScroll.current = scrollTop;

      if (Math.abs(diff) > 0.5) {
        if (diff > 0) {
          // Scrolling DOWN → bottom pattern slides up
          targetTopY = -100;
          targetBottomY = 100 - speed * 200; // slides from 100% to negative
        } else {
          // Scrolling UP → top pattern slides down
          targetTopY = -100 + speed * 200; // slides from -100% to positive
          targetBottomY = 100;
        }
      } else {
        // Not scrolling → both slide back to hidden
        targetTopY = -100;
        targetBottomY = 100;
      }

      // Lerp for smooth transitions
      currentTopY += (targetTopY - currentTopY) * 0.08;
      currentBottomY += (targetBottomY - currentBottomY) * 0.08;

      setTopY(currentTopY);
      setBottomY(currentBottomY);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // The hex pattern CSS (three-direction line grid)
  const hexPatternStyle = {
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.06) 74px,
        rgba(255, 255, 255, 0.06) 76px
      ),
      repeating-linear-gradient(
        60deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.04) 74px,
        rgba(255, 255, 255, 0.04) 76px
      ),
      repeating-linear-gradient(
        -60deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.04) 74px,
        rgba(255, 255, 255, 0.04) 76px
      )
    `,
  };

  return (
    <>
      {/* Pattern from top — slides down on scroll up */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] opacity-50"
        style={{
          ...hexPatternStyle,
          transform: `translateY(${topY}%)`,
          willChange: "transform",
        }}
      />

      {/* Pattern from bottom — slides up on scroll down */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] opacity-50"
        style={{
          ...hexPatternStyle,
          transform: `translateY(${bottomY}%)`,
          willChange: "transform",
        }}
      />
    </>
  );
}
```

---

### Step 3: Performance optimization

The above uses `useState` which causes re-renders on every RAF frame. For better performance, use direct DOM manipulation:

```tsx
"use client";

import { useEffect, useRef } from "react";

export default function GridBackground() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) return;

    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    let prevScroll = 0;
    let currentTopY = -100;
    let currentBottomY = 100;
    let targetTopY = -100;
    let targetBottomY = 100;
    let rafId: number;

    const animate = () => {
      const scrollTop = scrollContainer.scrollTop;
      const diff = scrollTop - prevScroll;
      const speed = Math.min(Math.abs(diff * 5) / 100, 1);
      prevScroll = scrollTop;

      if (Math.abs(diff) > 0.5) {
        if (diff > 0) {
          targetTopY = -100;
          targetBottomY = 100 - speed * 200;
        } else {
          targetTopY = -100 + speed * 200;
          targetBottomY = 100;
        }
      } else {
        targetTopY = -100;
        targetBottomY = 100;
      }

      currentTopY += (targetTopY - currentTopY) * 0.08;
      currentBottomY += (targetBottomY - currentBottomY) * 0.08;

      if (topRef.current) {
        topRef.current.style.transform = `translateY(${currentTopY}%)`;
      }
      if (bottomRef.current) {
        bottomRef.current.style.transform = `translateY(${currentBottomY}%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const hexPatternStyle: React.CSSProperties = {
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.06) 74px,
        rgba(255, 255, 255, 0.06) 76px
      ),
      repeating-linear-gradient(
        60deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.04) 74px,
        rgba(255, 255, 255, 0.04) 76px
      ),
      repeating-linear-gradient(
        -60deg,
        transparent,
        transparent 74px,
        rgba(255, 255, 255, 0.04) 74px,
        rgba(255, 255, 255, 0.04) 76px
      )
    `,
    willChange: "transform",
  };

  return (
    <>
      <div
        ref={topRef}
        className="absolute inset-0 pointer-events-none z-[2] opacity-50 hidden md:block"
        style={{ ...hexPatternStyle, transform: "translateY(-100%)" }}
      />
      <div
        ref={bottomRef}
        className="absolute inset-0 pointer-events-none z-[2] opacity-50 hidden md:block"
        style={{ ...hexPatternStyle, transform: "translateY(100%)" }}
      />
    </>
  );
}
```

**Use this performance-optimized version (Step 3).** It manipulates the DOM directly via refs instead of triggering React re-renders 60 times per second.

---

## PLACEMENT IN LAYOUT

The GridBackground is already in `src/app/(public)/layout.tsx` inside the content container. It should stay there:

```tsx
<div className="fixed inset-[5px] md:inset-[10px] z-[1] rounded-[12px] md:rounded-[20px] overflow-hidden bg-black">
  <GridBackground />  {/* ← already here, just replacing the component */}
  <div className="relative z-[1] h-full overflow-y-auto" id="smooth-content">
    ...
  </div>
</div>
```

The `overflow: hidden` on the parent container will clip the pattern layers as they slide in/out, creating the appearance of entering/exiting from the edges.

---

## VISUAL TUNING

After building, you may need to adjust:
- **Line opacity** (0.04–0.08) — should be subtle, barely visible
- **Lerp factor** (0.08) — lower = smoother/slower response, higher = snappier
- **Speed multiplier** (`diff * 5 / 100`) — affects how fast the pattern appears
- **Pattern scale** (74-76px gap) — adjust to match the desired hexagonal cell size
- **Overall opacity** (0.5 on the container) — the Buzzworthy one uses 0.5

On a dark/black background, even very low opacity white lines are visible. Start subtle and increase if needed.

---

## EXECUTION

1. Replace `src/components/animations/GridBackground.tsx` with the performance-optimized version (Step 3)
2. Remove any unused imports in the layout if the old GridBackground had different props
3. `npm run build` — must pass
4. `git add -A && git commit -m "feat: scroll-reactive hexagonal grid background (Buzzworthy-style)" && git push origin main`

---

## TESTING

1. Open the site on desktop
2. Scroll down — hex pattern should slide in from the bottom
3. Scroll up — hex pattern should slide in from the top
4. Stop scrolling — pattern should smoothly slide back out
5. Fast scrolling — pattern should be more visible
6. Slow scrolling — pattern should be barely visible
7. Mobile — pattern should not appear at all
8. The pattern should be visible behind content but not interfere with readability
