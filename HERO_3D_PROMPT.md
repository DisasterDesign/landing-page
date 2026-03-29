# Hero 3D Glass Symbol — Three.js Component

Build a Three.js WebGL component that renders the Fuzion Webz "F" symbol as an extruded 3D glass object floating in the hero background — identical in behavior and positioning to the "honey ball" on https://buzzworthystudio.com.

---

## WHAT IT LOOKS LIKE

A transparent/glass 3D version of the Fuzion Webz symbol, floating centered in the viewport behind the hero text content. It:
- Refracts/distorts whatever is behind it (the dark background, grid lines)
- Slowly rotates on Y axis
- Follows the mouse with subtle parallax (camera moves slightly)
- Has a glassy/crystal material with subtle reflections
- Sits behind the content but in front of the frame background

---

## POSITIONING (match Buzzworthy exactly)

The reference site's 3D element:
- `position: fixed` covering the full viewport
- `z-index: 2` (behind content at z:5, in front of frame background at z:0)
- `pointer-events: none`
- Canvas fills full viewport `width: 100vw, height: 100vh`
- The 3D object is centered in the canvas
- Camera: `PerspectiveCamera(30, aspect, 0.1, 1000)` at `z=15` (mobile: `z=28`)

### In our layout:
The component should render as a `<section>` or `<div>` with:
```
position: fixed
inset: 10px (matching our frame inset)
border-radius: 20px (matching our frame)
overflow: hidden
z-index: 2 (between frame bg at z:0 and content at z:1)
pointer-events: none
```

Place it in `src/app/(public)/layout.tsx` AFTER the frame background div and BEFORE the content container div.

---

## THE 3D GEOMETRY

### Option A — SVG Extrude (preferred, no external files needed):
The user will provide the SVG path data for the symbol. Use `THREE.SVGLoader` to parse the paths, create `THREE.Shape` objects, then use `THREE.ExtrudeGeometry` with:
```js
{
  depth: 1.5,          // extrusion depth
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.05,
  bevelSegments: 3,
  curveSegments: 12
}
```

The icon SVG (`public/icon-white.svg`) has 3 overlapping paths (pink, cyan, white layers forming the chromatic F). For the 3D version, use ONLY the white (front) path — it's the base shape. The pink and cyan offsets are a 2D effect, not needed in 3D.

The white path's `d` attribute from `public/icon-white.svg`:
```
M376.55 804.39C371.89 803.07... (the 3rd path in the SVG)
```

Parse this path with SVGLoader, create the extruded geometry, center it, and scale to fit nicely in the viewport.

### Option B — GLB file (if SVG extrude fails):
If SVGLoader struggles with the complex paths, the user will provide a `.glb` file later. In that case use `GLTFLoader` to load it. But TRY Option A first.

---

## THE MATERIAL — Glass/Refraction Effect

Use `THREE.MeshPhysicalMaterial` for the glass effect:
```js
new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0.0,
  roughness: 0.05,
  transmission: 0.95,      // glass transparency
  thickness: 2.0,          // refraction thickness
  ior: 1.45,               // index of refraction (glass)
  envMapIntensity: 1.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
})
```

### Environment map:
For reflections/refractions to work, the material needs an environment map. Options:
1. Use `THREE.PMREMGenerator` with a simple gradient or dark environment
2. OR use `RGBELoader` to load an HDR (but this adds a file dependency)
3. **Recommended:** Create a procedural environment using `THREE.CubeTextureLoader` or a simple equirectangular from a canvas gradient — dark with subtle pink/cyan color accents

### Lighting:
Add subtle lights to enhance the glass effect:
```js
// Ambient for base visibility
new THREE.AmbientLight(0x404040, 0.5)

// Key light - slightly warm
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
keyLight.position.set(5, 5, 5)

// Accent light - pink tint from one side
const pinkLight = new THREE.PointLight(0xE503A2, 0.3, 20)
pinkLight.position.set(-5, 2, 3)

// Accent light - cyan tint from other side
const cyanLight = new THREE.PointLight(0x01FFFF, 0.3, 20)
cyanLight.position.set(5, -2, 3)
```

---

## ANIMATION & INTERACTION

### 1. Slow rotation
```js
// In animation loop
mesh.rotation.y += 0.003  // slow Y rotation
mesh.rotation.x = Math.sin(Date.now() * 0.0005) * 0.05  // subtle breathing tilt
```

### 2. Mouse parallax (camera follows mouse)
```js
// Track mouse position normalized to -1..1
const targetX = mouseX * 0.5
const targetY = mouseY * 0.3

// Lerp camera position
camera.position.x += (targetX - camera.position.x) * 0.05
camera.position.y += (targetY - camera.position.y) * 0.05
camera.lookAt(0, 0, 0)
```

### 3. Scroll behavior
As the user scrolls past the hero section, the 3D object should:
- Slightly scale down
- Increase rotation speed
- OR fade out

Listen to scroll on `#smooth-content` (our scroll container), not window:
```js
const scrollContainer = document.getElementById('smooth-content')
scrollContainer.addEventListener('scroll', () => {
  const progress = scrollContainer.scrollTop / window.innerHeight
  mesh.scale.setScalar(1 - progress * 0.3)  // shrink as scrolling
  mesh.material.opacity = Math.max(0, 1 - progress * 1.5)  // fade out
})
```

---

## IMPLEMENTATION

### File structure:
```
src/components/three/
  HeroGlass.tsx        — Main React component (client-only, dynamic import)
  scene.ts             — Three.js scene setup, animation loop
  materials.ts         — Glass material + environment setup
  geometry.ts          — SVG path parsing + extrude geometry
```

### HeroGlass.tsx (React wrapper):
```tsx
"use client";
import { useEffect, useRef } from "react";

export default function HeroGlass() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import Three.js to avoid SSR issues
    import("./scene").then(({ initScene, destroyScene }) => {
      initScene(containerRef.current!);
      return () => destroyScene();
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-[5px] md:inset-[10px] rounded-[12px] md:rounded-[20px] overflow-hidden z-[2] pointer-events-none"
      aria-hidden="true"
    />
  );
}
```

### Dynamic import in layout:
In `src/app/(public)/layout.tsx`, use `next/dynamic` to avoid SSR:
```tsx
import dynamic from "next/dynamic";
const HeroGlass = dynamic(() => import("@/components/three/HeroGlass"), { ssr: false });
```

Then in the JSX, place it between the frame bg and content container:
```tsx
{/* Frame background */}
<div className="fixed inset-0 z-0 bg-white" />

{/* 3D Glass Symbol */}
<HeroGlass />

{/* Content container */}
<div className="fixed inset-[5px] md:inset-[10px] z-[1] ...">
```

Wait — the content is z-[1] and glass is z-[2]. The glass needs to be BEHIND the text content but above the frame. Since our content container has `overflow: hidden` and sits at z-[1], the glass at z-[2] will be ABOVE it.

**Fix:** Set the content container to `z-[5]` and the glass to `z-[2]`. The glass canvas will show through because the content bg sections are black but the hero section has a transparent/no background.

Make the hero section (`src/components/sections/Hero.tsx`) have `bg-transparent` so the glass is visible behind the hero text. Other sections keep `bg-black` so the glass disappears behind them.

---

## THREE.JS DEPENDENCY

Three.js r128 is listed as available via CDN, but for Next.js it's better to install via npm:
```bash
npm install three @types/three
```

Also install SVGLoader (included in three/examples):
```js
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
```

---

## PERFORMANCE

- Use `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — cap at 2x
- Dispose geometry, materials, and renderer on unmount
- On mobile (< 768px): reduce geometry detail (`curveSegments: 6`, `bevelSegments: 1`)
- `prefers-reduced-motion`: disable rotation and mouse parallax, show static glass
- Add `will-change: transform` to the container
- Use `requestAnimationFrame` and cancel on unmount

---

## FALLBACK

If WebGL is not supported (rare but possible), show nothing — the hero text works fine without the 3D element. Check with:
```js
const canvas = document.createElement('canvas');
const hasWebGL = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
if (!hasWebGL) return; // don't init
```

---

## AFTER BUILDING

1. Verify the glass symbol renders and is visible behind hero text
2. Verify mouse parallax works
3. Verify it fades/scales on scroll
4. `npm run build` — must pass
5. `git add -A && git commit -m "feat: 3D glass symbol hero background with Three.js refraction" && git push origin main`
