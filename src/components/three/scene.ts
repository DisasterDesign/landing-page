import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

const F_PATH = "M382.837 794.39C378.356 793.122 373.865 791.911 369.404 790.584C302.269 770.644 277.894 693.034 321.548 638.267C322.135 637.527 322.654 636.748 323.452 635.653C311.962 622.055 303.962 606.698 301.029 589.025C291.904 533.826 328.163 488.39 376.029 478.809C382.933 477.425 390.163 477.194 397.24 477.185C487.529 477.079 577.817 477.118 668.106 477.118C670.942 477.118 673.788 477.118 677.76 477.118C676.577 473.994 675.846 471.38 674.635 468.997C656.433 433.248 627.394 414.249 587.019 414.038C525.01 413.711 462.99 413.923 400.971 413.971C382.683 413.99 365.01 411.347 348.971 401.977C318.75 384.314 301.673 358.31 299.981 323.06C299.413 311.259 299.894 299.41 299.894 287.033C302.24 286.889 304.298 286.648 306.356 286.648C433.24 286.629 560.115 286.562 687 286.668C732 286.706 773.087 324.291 779.462 368.794C787.308 423.561 744.221 477.579 684.548 477.194C682.913 477.185 681.279 477.406 680.394 477.464C681.5 488.899 683.452 500.105 683.519 511.319C683.798 559.869 642.558 602.941 593.788 603.623C528.462 604.536 463.115 604.017 397.779 604.132C369.038 604.18 344.558 614.146 324.452 635.72C340.913 653.383 360.731 665.107 384.798 666.184C417.529 667.644 450.346 667.02 483.125 667.279C485.942 667.298 488.75 667.279 491.404 667.279C501.99 713.964 483.173 761.255 445.058 782.281C435.106 787.769 423.587 790.431 412.788 794.38H382.846L382.837 794.39Z";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let meshGroup: THREE.Group | null = null;
let glassMesh: THREE.Mesh | null = null;
let animationId: number | null = null;
let raycaster: THREE.Raycaster | null = null;
const pointer = new THREE.Vector2();
let isHovered = false;
let hoverScale = 1;

const mousePos = { x: 0, y: 0 };
const parallaxIntensity = 0.004;
const parallaxEase = 0.025;
let initCameraZ = 15;

function createEnvMap(r: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(r);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x080808);

  const pink = new THREE.PointLight(0xe503a2, 3, 50);
  pink.position.set(-8, 4, -8);
  envScene.add(pink);

  const cyan = new THREE.PointLight(0x01ffff, 3, 50);
  cyan.position.set(8, -4, -8);
  envScene.add(cyan);

  const white = new THREE.PointLight(0xffffff, 2, 50);
  white.position.set(0, 8, 8);
  envScene.add(white);

  const warm = new THREE.PointLight(0xffeedd, 1.5, 40);
  warm.position.set(4, 6, 4);
  envScene.add(warm);

  const tex = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  return tex;
}

function createGeometry(): THREE.BufferGeometry | null {
  const loader = new SVGLoader();
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><path d="${F_PATH}"/></svg>`;
  const result = loader.parse(svgMarkup);

  const shapes: THREE.Shape[] = [];
  console.log("[3D] SVG paths parsed:", result.paths.length);
  for (const path of result.paths) {
    const s = SVGLoader.createShapes(path);
    console.log("[3D] path shapes:", s.length);
    shapes.push(...s);
  }
  console.log("[3D] total shapes:", shapes.length);
  if (shapes.length === 0) {
    console.error("[3D] No shapes from SVG — geometry failed");
    return null;
  }

  const isMobile = window.innerWidth < 768;
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 60,
    bevelEnabled: true,
    bevelThickness: 3,
    bevelSize: 2,
    bevelSegments: isMobile ? 2 : 4,
    curveSegments: isMobile ? 8 : 16,
  });

  geometry.center();
  geometry.computeVertexNormals();

  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as THREE.BufferAttribute
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = (5 / maxDim) * 0.6;
  geometry.scale(scale, -scale, scale);

  return geometry;
}

export function initScene(container: HTMLElement) {
  const testCanvas = document.createElement("canvas");
  if (!testCanvas.getContext("webgl2") && !testCanvas.getContext("webgl")) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const isMobile = width < 768;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  initCameraZ = isMobile ? 28 : 15;
  camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
  camera.position.z = initCameraZ;

  // Environment map for glass reflections/refractions
  const envMap = createEnvMap(renderer);

  // Geometry
  const geometry = createGeometry();
  if (!geometry) {
    console.error("[3D] geometry creation failed — aborting");
    return;
  }
  console.log("[3D] geometry OK, vertices:", geometry.getAttribute("position").count);

  // Glass material
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.0,
    transmission: 0.7,
    thickness: 2.5,
    ior: 1.45,
    envMap,
    envMapIntensity: 3.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    attenuationColor: new THREE.Color(0xd0c8ff),
    attenuationDistance: 0.5,
  });

  // Mesh
  meshGroup = new THREE.Group();
  glassMesh = new THREE.Mesh(geometry, material);
  glassMesh.name = "GlassF";
  meshGroup.add(glassMesh);
  meshGroup.position.x = isMobile ? 0 : -3;
  scene.add(meshGroup);

  // Lights — bright enough for glass to be visible on black bg
  scene.add(new THREE.AmbientLight(0x666666, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(5, 5, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-3, -2, 4);
  scene.add(fill);
  const pinkL = new THREE.PointLight(0xe503a2, 1.5, 30);
  pinkL.position.set(-5, 2, 3);
  scene.add(pinkL);
  const cyanL = new THREE.PointLight(0x01ffff, 1.5, 30);
  cyanL.position.set(5, -2, 3);
  scene.add(cyanL);

  // Raycaster for hover interaction
  raycaster = new THREE.Raycaster();

  // Mouse
  const onMouseMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mousePos.x = (e.clientX - window.innerWidth / 2) * parallaxIntensity;
    mousePos.y = (e.clientY - window.innerHeight / 2) * parallaxIntensity;
  };
  container.addEventListener("mousemove", onMouseMove);

  // Resize
  const onResize = () => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Animation loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!meshGroup || !camera || !renderer || !scene || !glassMesh) return;

    // Raycaster hover detection
    if (raycaster) {
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(glassMesh);
      isHovered = intersects.length > 0;
    }

    // Hover: smooth scale pulse
    const targetScale = isHovered ? 1.08 : 1.0;
    hoverScale += (targetScale - hoverScale) * 0.08;
    glassMesh.scale.setScalar(hoverScale);

    // Hover: subtle rotation following mouse
    if (isHovered && !prefersReducedMotion) {
      const targetRotX = pointer.y * 0.15;
      const targetRotY = pointer.x * 0.15;
      glassMesh.rotation.x += (targetRotX - glassMesh.rotation.x) * 0.05;
      glassMesh.rotation.y += (targetRotY - glassMesh.rotation.y) * 0.05;
    } else if (!prefersReducedMotion) {
      glassMesh.rotation.x += (0 - glassMesh.rotation.x) * 0.03;
      glassMesh.rotation.y += (0 - glassMesh.rotation.y) * 0.03;
    }

    // Camera parallax
    if (!prefersReducedMotion) {
      camera.position.x += (mousePos.x - camera.position.x) * parallaxEase;
      camera.position.y += (mousePos.y - camera.position.y) * parallaxEase;
      camera.position.z += (initCameraZ - camera.position.z) * parallaxEase;
      camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
  }

  animate();

  (container as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    container.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
  };
}

export function destroyScene() {
  if (animationId) cancelAnimationFrame(animationId);
  if (meshGroup) {
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  renderer = null;
  scene = null;
  camera = null;
  meshGroup = null;
  glassMesh = null;
  animationId = null;
  raycaster = null;
}
