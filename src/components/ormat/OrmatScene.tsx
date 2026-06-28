"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Scroll-driven 3D scene for the Ormat proposal: a closed-loop "machine" (the
 * binary geothermal cycle) with a glowing energy droplet that travels the loop
 * as the reader scrolls — leading them from the hook down to the signature.
 *
 * Raw three.js (no R3F), mirroring HeroGlass: unlit neon materials + additive
 * glow sprites, so it needs no lights and stays cheap. Reads scroll progress
 * (0..1) from a ref each frame to avoid re-rendering React on scroll. Renders
 * nothing when WebGL is unavailable or the user prefers reduced motion — the
 * page's CSS backdrop carries the look in that case.
 */
export default function OrmatScene({
  progressRef,
}: {
  progressRef: React.MutableRefObject<number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const test = document.createElement("canvas");
    if (!test.getContext("webgl2") && !test.getContext("webgl")) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    if (width < 10 || height < 10) return;

    const isSmall = width < 768;

    // ---- renderer / scene / camera ---------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05030a, 0.03);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.4, isSmall ? 17 : 13);
    camera.lookAt(0, 0, 0);

    const world = new THREE.Group();
    scene.add(world);

    // ---- brand colors ----------------------------------------------------
    const PINK = new THREE.Color("#E503A2");
    const CYAN = new THREE.Color("#01FFFF");
    const HEAT = new THREE.Color("#ff7a2c"); // geothermal heat (start of loop)

    // radial-gradient sprite for additive glows
    function glowTexture(): THREE.Texture {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d")!;
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const glowTex = glowTexture();

    function makeGlow(color: THREE.Color, size: number, opacity = 1): THREE.Sprite {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color: color.clone(),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(size);
      return s;
    }

    // ---- the closed loop curve ------------------------------------------
    const RX = isSmall ? 4.1 : 5.6;
    const RY = isSmall ? 2.6 : 3.0;
    const RZ = 1.4;
    const loopPts: THREE.Vector3[] = [];
    const SEG = 16;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      loopPts.push(
        new THREE.Vector3(
          Math.cos(a) * RX,
          Math.sin(a) * RY,
          Math.sin(a * 2) * RZ
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(loopPts, true, "catmullrom", 0.5);

    // the pipe (neon, semi-transparent)
    const tubeGeo = new THREE.TubeGeometry(curve, 240, 0.07, 12, true);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: CYAN.clone().multiplyScalar(0.5),
      transparent: true,
      opacity: 0.22,
    });
    world.add(new THREE.Mesh(tubeGeo, tubeMat));

    // ---- stations along the loop ----------------------------------------
    // t-position for each narrative station (well → turbine → condenser …)
    const STATIONS = 8;
    type Station = {
      t: number;
      core: THREE.Mesh;
      glow: THREE.Sprite;
      baseGlow: number;
      turbine?: THREE.Group;
    };
    const stations: Station[] = [];
    const octa = new THREE.OctahedronGeometry(0.34, 0);

    for (let i = 0; i < STATIONS; i++) {
      const t = i / STATIONS;
      const pos = curve.getPointAt(t);
      const col = i === 3 ? PINK : i % 2 === 0 ? CYAN : PINK;

      const core = new THREE.Mesh(
        i === 3 ? new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12) : octa,
        new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.85 })
      );
      core.position.copy(pos);
      world.add(core);

      const glow = makeGlow(col, 1.5, 0.5);
      glow.position.copy(pos);
      world.add(glow);

      let turbine: THREE.Group | undefined;
      if (i === 3) {
        // The turbine station — spinning blades.
        turbine = new THREE.Group();
        turbine.position.copy(pos);
        const bladeGeo = new THREE.BoxGeometry(0.9, 0.16, 0.02);
        for (let b = 0; b < 6; b++) {
          const blade = new THREE.Mesh(
            bladeGeo,
            new THREE.MeshBasicMaterial({ color: PINK.clone(), transparent: true, opacity: 0.7 })
          );
          blade.rotation.z = (b / 6) * Math.PI * 2;
          turbine.add(blade);
        }
        world.add(turbine);
      }

      stations.push({ t, core, glow, baseGlow: 0.5, turbine });
    }

    // ---- the energy droplet (+ trailing sparks) -------------------------
    const dropletCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    world.add(dropletCore);
    const dropletGlow = makeGlow(HEAT, 2.6, 0.95);
    world.add(dropletGlow);

    const TRAIL = 6;
    const trail: THREE.Sprite[] = [];
    for (let i = 0; i < TRAIL; i++) {
      const s = makeGlow(HEAT, 1.6 * (1 - i / TRAIL), 0.5 * (1 - i / TRAIL));
      world.add(s);
      trail.push(s);
    }

    // ---- background particle field --------------------------------------
    const PCOUNT = isSmall ? 220 : 420;
    const pPos = new Float32Array(PCOUNT * 3);
    for (let i = 0; i < PCOUNT; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 26;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 3;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: CYAN.clone(),
        size: 0.045,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(particles);

    // ---- interaction / animation ----------------------------------------
    const mouse = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    let renderProgress = 0;
    const tmp = new THREE.Vector3();
    let t0 = performance.now();

    function frame(now: number) {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min((now - t0) / 1000, 0.05);
      t0 = now;
      const time = now / 1000;

      // ease the droplet toward the scroll target so it glides, never jumps
      const target = Math.max(0, Math.min(1, progressRef.current));
      renderProgress += (target - renderProgress) * Math.min(1, dt * 3.2);
      // tiny continuous drift so the loop feels alive at rest
      const tDrop = (renderProgress * 0.999 + time * 0.012) % 1;

      const head = curve.getPointAt(tDrop);
      dropletCore.position.copy(head);
      dropletGlow.position.copy(head);
      // heat → cool as it rounds the loop
      (dropletGlow.material as THREE.SpriteMaterial).color
        .copy(HEAT)
        .lerp(CYAN, Math.sin(tDrop * Math.PI));

      for (let i = 0; i < TRAIL; i++) {
        const tt = (tDrop - (i + 1) * 0.012 + 1) % 1;
        curve.getPointAt(tt, tmp);
        trail[i].position.copy(tmp);
      }

      // stations brighten when the droplet is near
      for (const st of stations) {
        let d = Math.abs(tDrop - st.t);
        d = Math.min(d, 1 - d);
        const near = Math.max(0, 1 - d * 7);
        const op = st.baseGlow + near * 1.4;
        st.glow.scale.setScalar(1.5 + near * 1.6);
        (st.glow.material as THREE.SpriteMaterial).opacity = op;
        (st.core.material as THREE.MeshBasicMaterial).opacity = 0.7 + near * 0.3;
        st.core.rotation.y += dt * (0.4 + near);
        if (st.turbine) st.turbine.rotation.z -= dt * (1.5 + near * 9);
      }

      // gentle world drift + mouse parallax
      smooth.x += (mouse.x - smooth.x) * 0.05;
      smooth.y += (mouse.y - smooth.y) * 0.05;
      world.rotation.y = Math.sin(time * 0.15) * 0.18 + smooth.x * 0.25;
      world.rotation.x = -0.12 + smooth.y * 0.12;
      particles.rotation.y += dt * 0.02;

      renderer.render(scene, camera);
    }
    rafRef.current = requestAnimationFrame(frame);

    // ---- resize ----------------------------------------------------------
    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      glowTex.dispose();
      // Dispose every Mesh/Points geometry (tube, stations, blades, droplet,
      // particles) + all materials. Skip Sprite geometry — three.js shares a
      // single sprite-geometry singleton across the whole app.
      scene.traverse((o) => {
        const any = o as unknown as {
          isMesh?: boolean;
          isPoints?: boolean;
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        if ((any.isMesh || any.isPoints) && any.geometry) any.geometry.dispose();
        if (any.material) {
          Array.isArray(any.material)
            ? any.material.forEach((x) => x.dispose())
            : any.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.remove();
    };
  }, [progressRef]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden="true" />;
}
