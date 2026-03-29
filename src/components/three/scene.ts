import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

// The white "F" path from icon-white.svg
const F_PATH = "M376.55 804.39C371.89 803.07 367.22 801.81 362.58 800.43C292.76 779.68 267.41 698.92 312.81 641.93C313.42 641.16 313.96 640.35 314.79 639.21C302.84 625.06 294.52 609.08 291.47 590.69C281.98 533.25 319.69 485.97 369.47 476C376.65 474.56 384.17 474.32 391.53 474.31C485.43 474.2 579.33 474.24 673.23 474.24C676.18 474.24 679.14 474.24 683.27 474.24C682.04 470.99 681.28 468.27 680.02 465.79C661.09 428.59 630.89 408.82 588.9 408.6C524.41 408.26 459.91 408.48 395.41 408.53C376.39 408.55 358.01 405.8 341.33 396.05C309.9 377.67 292.14 350.61 290.38 313.93C289.79 301.65 290.29 289.32 290.29 276.44C292.73 276.29 294.87 276.04 297.01 276.04C428.97 276.02 560.92 275.95 692.88 276.06C739.68 276.1 782.41 315.21 789.04 361.52C797.2 418.51 752.39 474.72 690.33 474.32C688.63 474.31 686.93 474.54 686.01 474.6C687.16 486.5 689.19 498.16 689.26 509.83C689.55 560.35 646.66 605.17 595.94 605.88C528 606.83 460.04 606.29 392.09 606.41C362.2 606.46 336.74 616.83 315.83 639.28C332.95 657.66 353.56 669.86 378.59 670.98C412.63 672.5 446.76 671.85 480.85 672.12C483.78 672.14 486.7 672.12 489.46 672.12C500.47 720.7 480.9 769.91 441.26 791.79C430.91 797.5 418.93 800.27 407.7 804.38H376.56L376.55 804.39Z";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Mesh | null = null;
let animationId: number | null = null;
let mouseX = 0;
let mouseY = 0;
let scrollProgress = 0;

function createEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Create a simple dark environment with subtle color accents
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x050505);

  // Add colored area lights to the environment
  const pinkLight = new THREE.PointLight(0xe503a2, 2, 50);
  pinkLight.position.set(-10, 5, -10);
  envScene.add(pinkLight);

  const cyanLight = new THREE.PointLight(0x01ffff, 2, 50);
  cyanLight.position.set(10, -5, -10);
  envScene.add(cyanLight);

  const whiteLight = new THREE.PointLight(0xffffff, 1, 50);
  whiteLight.position.set(0, 10, 10);
  envScene.add(whiteLight);

  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();
  return envMap;
}

function createGeometry(): THREE.BufferGeometry | null {
  const loader = new SVGLoader();
  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><path d="${F_PATH}"/></svg>`;
  const result = loader.parse(svgData);

  const shapes: THREE.Shape[] = [];
  for (const path of result.paths) {
    const pathShapes = SVGLoader.createShapes(path);
    shapes.push(...pathShapes);
  }

  if (shapes.length === 0) return null;

  const isMobile = window.innerWidth < 768;

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 80,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: 3,
    bevelSegments: isMobile ? 1 : 3,
    curveSegments: isMobile ? 6 : 12,
  });

  geometry.center();

  // Scale down to reasonable Three.js units
  const scale = 0.012;
  geometry.scale(scale, -scale, scale);

  return geometry;
}

export function initScene(container: HTMLElement) {
  // WebGL check
  const testCanvas = document.createElement("canvas");
  if (
    !testCanvas.getContext("webgl2") &&
    !testCanvas.getContext("webgl")
  ) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  const isMobile = width < 768;

  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
  camera.position.z = isMobile ? 28 : 15;

  // Environment map
  const envMap = createEnvMap(renderer);

  // Material — glass/refraction
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.95,
    thickness: 2.0,
    ior: 1.45,
    envMap,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });

  // Geometry
  const geometry = createGeometry();
  if (!geometry) return;

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Lights
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(5, 5, 5);
  scene.add(keyLight);

  const pinkLight = new THREE.PointLight(0xe503a2, 0.3, 20);
  pinkLight.position.set(-5, 2, 3);
  scene.add(pinkLight);

  const cyanLight = new THREE.PointLight(0x01ffff, 0.3, 20);
  cyanLight.position.set(5, -2, 3);
  scene.add(cyanLight);

  // Mouse tracking
  const handleMouseMove = (e: MouseEvent) => {
    mouseX = (e.clientX / width - 0.5) * 2;
    mouseY = (e.clientY / height - 0.5) * 2;
  };
  window.addEventListener("mousemove", handleMouseMove);

  // Scroll tracking on #smooth-content
  const scrollContainer = document.getElementById("smooth-content");
  const handleScroll = () => {
    if (scrollContainer) {
      scrollProgress = scrollContainer.scrollTop / window.innerHeight;
    }
  };
  scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });

  // Resize
  const handleResize = () => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", handleResize);

  // Reduced motion check
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Animation loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!mesh || !camera || !renderer || !scene) return;

    if (!prefersReducedMotion) {
      // Slow rotation
      mesh.rotation.y += 0.003;
      mesh.rotation.x = Math.sin(Date.now() * 0.0005) * 0.05;

      // Mouse parallax
      const targetX = mouseX * 0.5;
      const targetY = -mouseY * 0.3;
      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (targetY - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
    }

    // Scroll fade/scale
    const scale = Math.max(0.3, 1 - scrollProgress * 0.3);
    mesh.scale.setScalar(scale);
    (mesh.material as THREE.MeshPhysicalMaterial).opacity = Math.max(
      0,
      0.95 - scrollProgress * 1.5
    );

    renderer.render(scene, camera);
  }

  animate();

  // Store cleanup refs
  (container as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("resize", handleResize);
    scrollContainer?.removeEventListener("scroll", handleScroll);
  };
}

export function destroyScene() {
  if (animationId) cancelAnimationFrame(animationId);
  if (mesh) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  renderer = null;
  scene = null;
  camera = null;
  mesh = null;
  animationId = null;
}
