"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Scroll-driven hero scene: a single realistic chrome ball that rolls down a
 * half-pipe from the top of the page to the bottom. The camera is FIXED; scroll
 * progress (0..1) moves the ball from the top of the frame to the bottom along a
 * gently snaking half-pipe, so it weaves out beside the content cards as it
 * descends — leading the reader down to the signature.
 *
 * Realism: PBR chrome ball + procedural studio environment (RoomEnvironment via
 * PMREM) for reflections, ACES tone mapping, soft shadow, and pink/cyan accent
 * lights that tint the chrome. Tuned for LIGHT mode (transparent canvas over the
 * page's light background). Static frame under reduced-motion; nothing when
 * WebGL is unavailable.
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

    const test = document.createElement("canvas");
    if (!test.getContext("webgl2") && !test.getContext("webgl")) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    if (width < 10 || height < 10) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const isSmall = width < 768;

    // ---- tunables --------------------------------------------------------
    const BALL_R = 0.8;
    const RC = 1.0; // trough inner radius
    const WALL = 0.18; // trough wall thickness
    const TOP = 3.4; // ball y at progress 0
    const BOT = -3.4; // ball y at progress 1
    const SPAN = 2.6; // pipe extends beyond TOP/BOT so it fills the frame
    const WAVES = 1.6; // gentle single-S snake
    const AMP = isSmall ? 2.0 : 4.0; // how far the ball weaves sideways
    const CAM_Z = isSmall ? 13 : 11;

    // ---- renderer --------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(0, 0.6, CAM_Z);
    camera.lookAt(0, -0.2, 0);

    // ---- studio environment (reflections) --------------------------------
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;

    // ---- lights ----------------------------------------------------------
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdde3ea, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3.5, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 5;
    scene.add(key, key.target);
    const pink = new THREE.PointLight(0xe503a2, 45, 26);
    pink.position.set(-5.5, 3, 4.5);
    scene.add(pink);
    const cyan = new THREE.PointLight(0x01ffff, 40, 26);
    cyan.position.set(5.5, -3, 4.5);
    scene.add(cyan);

    // ---- the descent curve (planar XY, spans the frame) ------------------
    const yAt = (t: number) => TOP + SPAN - (TOP - BOT + 2 * SPAN) * t;
    const xAt = (t: number) => Math.sin(t * Math.PI * WAVES) * AMP;
    const pts: THREE.Vector3[] = [];
    const N = 100;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(new THREE.Vector3(xAt(t), yAt(t), 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const curveLen = curve.getLength();
    const BINORMAL = new THREE.Vector3(0, 0, 1); // planar XY curve → constant +Z

    // ball progress maps into the [0..1] sub-range where y ∈ [TOP..BOT]
    const tForProgress = (p: number) => {
      const a = SPAN / (TOP - BOT + 2 * SPAN);
      return a + (1 - 2 * a) * Math.max(0, Math.min(1, p));
    };

    // ---- half-pipe (swept U profile) -------------------------------------
    const shape = new THREE.Shape();
    shape.absarc(0, RC, RC + WALL, Math.PI, 2 * Math.PI, false);
    shape.absarc(0, RC, RC, 2 * Math.PI, Math.PI, true);
    const pipeGeo = new THREE.ExtrudeGeometry(shape, {
      extrudePath: curve,
      steps: 400,
      bevelEnabled: false,
    });
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x8b94a6,
      metalness: 0.7,
      roughness: 0.3,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
    });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    scene.add(pipe);

    // ---- the chrome ball -------------------------------------------------
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 64, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xf4f5f7,
        metalness: 1.0,
        roughness: 0.06,
        envMapIntensity: 1.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    );
    ball.castShadow = true;
    scene.add(ball);

    // ---- soft shadow catcher behind the pipe -----------------------------
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 40),
      new THREE.ShadowMaterial({ opacity: 0.11 })
    );
    shadowPlane.position.z = -1.5;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // ---- interaction / animation ----------------------------------------
    const mouse = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    const tmpP = new THREE.Vector3();
    const tmpT = new THREE.Vector3();
    const rollAxis = new THREE.Vector3();
    let renderProg = 0;
    let prevT = tForProgress(0);
    let t0 = performance.now();

    function placeBall(progress: number) {
      const t = tForProgress(progress);
      curve.getPointAt(t, tmpP);
      ball.position.copy(tmpP).addScaledVector(BINORMAL, BALL_R);
      // roll by arc length travelled
      const dArc = (t - prevT) * curveLen;
      if (Math.abs(dArc) > 1e-5) {
        curve.getTangentAt(t, tmpT);
        rollAxis.copy(tmpT).cross(BINORMAL).normalize();
        ball.rotateOnWorldAxis(rollAxis, -dArc / BALL_R);
      }
      prevT = t;
    }

    if (prefersReduced) {
      placeBall(progressRef.current);
      renderer.render(scene, camera);
    } else {
      const frame = (now: number) => {
        rafRef.current = requestAnimationFrame(frame);
        const dt = Math.min((now - t0) / 1000, 0.05);
        t0 = now;
        smooth.x += (mouse.x - smooth.x) * 0.05;
        smooth.y += (mouse.y - smooth.y) * 0.05;
        const target = Math.max(0, Math.min(1, progressRef.current));
        renderProg += (target - renderProg) * Math.min(1, dt * 3.4);
        placeBall(renderProg);
        // subtle camera parallax
        camera.position.x = smooth.x * 0.5;
        camera.position.y = 0.6 - smooth.y * 0.3;
        camera.lookAt(0, -0.2, 0);
        renderer.render(scene, camera);
      };
      rafRef.current = requestAnimationFrame(frame);
    }

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
      pmrem.dispose();
      envMap.dispose();
      scene.traverse((o) => {
        const any = o as unknown as {
          isMesh?: boolean;
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        if (any.isMesh && any.geometry) any.geometry.dispose();
        if (any.material) {
          Array.isArray(any.material)
            ? any.material.forEach((m) => m.dispose())
            : any.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.remove();
    };
  }, [progressRef]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden="true" />;
}
