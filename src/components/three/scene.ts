import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

// The white "F" path from icon-black.svg (the base shape)
const F_PATH = "M382.837 794.39C378.356 793.122 373.865 791.911 369.404 790.584C302.269 770.644 277.894 693.034 321.548 638.267C322.135 637.527 322.654 636.748 323.452 635.653C311.962 622.055 303.962 606.698 301.029 589.025C291.904 533.826 328.163 488.39 376.029 478.809C382.933 477.425 390.163 477.194 397.24 477.185C487.529 477.079 577.817 477.118 668.106 477.118C670.942 477.118 673.788 477.118 677.76 477.118C676.577 473.994 675.846 471.38 674.635 468.997C656.433 433.248 627.394 414.249 587.019 414.038C525.01 413.711 462.99 413.923 400.971 413.971C382.683 413.99 365.01 411.347 348.971 401.977C318.75 384.314 301.673 358.31 299.981 323.06C299.413 311.259 299.894 299.41 299.894 287.033C302.24 286.889 304.298 286.648 306.356 286.648C433.24 286.629 560.115 286.562 687 286.668C732 286.706 773.087 324.291 779.462 368.794C787.308 423.561 744.221 477.579 684.548 477.194C682.913 477.185 681.279 477.406 680.394 477.464C681.5 488.899 683.452 500.105 683.519 511.319C683.798 559.869 642.558 602.941 593.788 603.623C528.462 604.536 463.115 604.017 397.779 604.132C369.038 604.18 344.558 614.146 324.452 635.72C340.913 653.383 360.731 665.107 384.798 666.184C417.529 667.644 450.346 667.02 483.125 667.279C485.942 667.298 488.75 667.279 491.404 667.279C501.99 713.964 483.173 761.255 445.058 782.281C435.106 787.769 423.587 790.431 412.788 794.38H382.846L382.837 794.39Z";

// 4D Simplex Noise (from Buzzworthy)
const noise4GLSL = `
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
float mod289(float x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
float permute(float x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float taylorInvSqrt(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 grad4(float j,vec4 ip){
  const vec4 ones=vec4(1.0,1.0,1.0,-1.0);
  vec4 p,s;
  p.xyz=floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z-1.0;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0.0)));
  p.xyz=p.xyz+(s.xyz*2.0-1.0)*s.www;
  return p;
}
#define F4 0.309016994374947451
float snoise(vec4 v){
  const vec4 C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);
  vec4 i=floor(v+dot(v,vec4(F4)));
  vec4 x0=v-i+dot(i,C.xxxx);
  vec4 i0;vec3 isX=step(x0.yzw,x0.xxx);vec3 isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;i0.yzw=1.0-isX;
  i0.y+=isYZ.x+isYZ.y;i0.zw+=1.0-isYZ.xy;i0.z+=isYZ.z;i0.w+=1.0-isYZ.z;
  vec4 i3=clamp(i0,0.0,1.0);vec4 i2=clamp(i0-1.0,0.0,1.0);vec4 i1=clamp(i0-2.0,0.0,1.0);
  vec4 x1=x0-i1+C.xxxx;vec4 x2=x0-i2+C.yyyy;vec4 x3=x0-i3+C.zzzz;vec4 x4=x0+C.wwww;
  i=mod289(i);
  float j0=permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1=permute(permute(permute(permute(i.w+vec4(i1.w,i2.w,i3.w,1.0))+i.z+vec4(i1.z,i2.z,i3.z,1.0))+i.y+vec4(i1.y,i2.y,i3.y,1.0))+i.x+vec4(i1.x,i2.x,i3.x,1.0));
  vec4 ip=vec4(1.0/294.0,1.0/49.0,1.0/7.0,0.0);
  vec4 p0=grad4(j0,ip);vec4 p1=grad4(j1.x,ip);vec4 p2=grad4(j1.y,ip);vec4 p3=grad4(j1.z,ip);vec4 p4=grad4(j1.w,ip);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;p4*=taylorInvSqrt(dot(p4,p4));
  vec3 m0=max(0.6-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.0);
  vec2 m1=max(0.6-vec2(dot(x3,x3),dot(x4,x4)),0.0);
  m0=m0*m0;m1=m1*m1;
  return 49.0*(dot(m0*m0,vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2)))+dot(m1*m1,vec2(dot(p3,x3),dot(p4,x4))));
}
`;

// Vertex shader — based on Buzzworthy's approach with noise distortion
const vertexShader = `
${noise4GLSL}

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vN;
varying vec3 eyeVector;
varying vec3 worldNormal;

uniform float u_time;
uniform vec3 u_camPos;
uniform float u_speed1;
uniform float u_freq1;
uniform float u_amp1;

float tangentFactor = 0.005;

vec3 orthogonal(vec3 v) {
  return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));
}

vec3 distorted(vec3 p) {
  return p * (1.0 + snoise(vec4(p * u_freq1, u_time * 0.0001 * u_speed1)) * 0.05 * u_amp1);
}

void main() {
  vUv = uv;
  vNormal = normal;
  vPosition = position;

  vec3 dispPos = distorted(position);
  vec3 tangent1 = orthogonal(normal);
  vec3 tangent2 = normalize(cross(normal, tangent1));
  vec3 nearby1 = position + tangent1 * tangentFactor;
  vec3 nearby2 = position + tangent2 * tangentFactor;
  vec3 distorted1 = distorted(nearby1);
  vec3 distorted2 = distorted(nearby2);
  vNormal = normalize(cross(distorted1 - dispPos, distorted2 - dispPos));

  vec4 p = vec4(position, 1.0);
  vec3 e = normalize(vec3(modelViewMatrix * p));
  vec3 n = normalize(normalMatrix * vNormal);
  vec3 r = reflect(e, n);
  float m = 2.0 * sqrt(pow(r.x, 2.0) + pow(r.y, 2.0) + pow(r.z + 1.0, 2.0));
  vN = r.xy / m + 0.5;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  eyeVector = normalize(worldPosition.xyz - u_camPos);
  worldNormal = normalize(modelViewMatrix * vec4(vNormal, 0.0)).xyz;

  vec4 modelViewPosition = modelViewMatrix * vec4(dispPos, 1.0);
  gl_Position = projectionMatrix * modelViewPosition;
}
`;

// Fragment shader — refraction, fresnel, matcap style lighting
const fragmentShader = `
uniform vec2 u_res;
uniform float u_ior;
uniform float u_blur;
uniform vec3 u_refColor;
uniform float u_lightfac;
uniform float pi;

varying vec2 vN;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 eyeVector;
varying vec3 worldNormal;

float fresnel(vec3 eyeVector, vec3 worldNormal) {
  return pow(1.0 + dot(eyeVector, worldNormal), 3.0);
}

void main() {
  // Matcap-style lighting from normals
  vec3 matCapCol = vec3(0.4 + vN.x * 0.3, 0.4 + vN.y * 0.3, 0.45);

  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 normal = worldNormal;
  vec3 refracted = refract(eyeVector, normal, 1.0 / u_ior);
  uv += refracted.xy;

  // Dark background refraction simulation
  vec3 bgCol = vec3(0.02, 0.02, 0.03);
  vec3 tintedRefr = mix(bgCol, vec3(0.05), 0.1);
  vec3 matCapLayer = tintedRefr * (matCapCol + 0.4);
  vec3 outCol = mix(matCapLayer, u_refColor, fresnel(eyeVector, normal));

  outCol *= u_lightfac;

  gl_FragColor = vec4(outCol, 0.92);
}
`;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let meshGroup: THREE.Group | null = null;
let shaderMat: THREE.ShaderMaterial | null = null;
let animationId: number | null = null;

// Camera parallax (from Buzzworthy — exact values)
const mousePos = { x: 0, y: 0 };
const parallaxIntensity = 0.004;
const parallaxEase = 0.025;
let initCameraZ = 15;

function createGeometry(): THREE.BufferGeometry | null {
  const loader = new SVGLoader();
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><path d="${F_PATH}"/></svg>`;
  const result = loader.parse(svgMarkup);

  const shapes: THREE.Shape[] = [];
  for (const path of result.paths) {
    const pathShapes = SVGLoader.createShapes(path);
    shapes.push(...pathShapes);
  }
  if (shapes.length === 0) return null;

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

  // Scale to fit ~5 units (like Buzzworthy's icosahedron radius of 2.5)
  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as THREE.BufferAttribute
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 5 / maxDim;
  geometry.scale(scale, -scale, scale); // -Y to flip SVG coordinate system

  return geometry;
}

export function initScene(container: HTMLElement) {
  // WebGL check
  const testCanvas = document.createElement("canvas");
  if (!testCanvas.getContext("webgl2") && !testCanvas.getContext("webgl")) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const isMobile = width < 768;

  // Renderer — match Buzzworthy
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Camera — match Buzzworthy (PerspectiveCamera, FOV 30)
  initCameraZ = isMobile ? 28 : 15;
  camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
  camera.position.z = initCameraZ;

  // Geometry
  const geometry = createGeometry();
  if (!geometry) return;

  // Shader material — like Buzzworthy's honey ball
  shaderMat = new THREE.ShaderMaterial({
    uniforms: {
      u_res: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_camPos: { value: camera.position },
      u_speed1: { value: 9.18 },
      u_freq1: { value: 0.55 },
      u_amp1: { value: 2.4 },
      u_ior: { value: 1.45 },
      u_blur: { value: 0.5 },
      u_refColor: { value: new THREE.Color(0x1a1a2e) },
      u_lightfac: { value: 1.0 },
      pi: { value: Math.PI },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Mesh in rotator group (like Buzzworthy)
  meshGroup = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, shaderMat);
  mesh.name = "GlassF";
  meshGroup.add(mesh);
  scene.add(meshGroup);

  // Mouse tracking (Buzzworthy exact approach)
  const onMouseMove = (e: MouseEvent) => {
    mousePos.x = (e.clientX - window.innerWidth / 2) * parallaxIntensity;
    mousePos.y = (e.clientY - window.innerHeight / 2) * parallaxIntensity;
  };
  window.addEventListener("mousemove", onMouseMove);

  // Scroll tracking
  const scrollContainer = document.getElementById("smooth-content");
  let scrollProgress = 0;
  const onScroll = () => {
    if (scrollContainer) {
      scrollProgress = scrollContainer.scrollTop / window.innerHeight;
    }
  };
  scrollContainer?.addEventListener("scroll", onScroll, { passive: true });

  // Resize
  const onResize = () => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (shaderMat) {
      shaderMat.uniforms.u_res.value.set(w, h);
    }
  };
  window.addEventListener("resize", onResize);

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Animation loop
  let lastTime = performance.now();
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!meshGroup || !camera || !renderer || !scene || !shaderMat) return;

    const now = performance.now();
    const dt = (now - lastTime) * 0.001;
    lastTime = now;

    // Update shader time
    shaderMat.uniforms.u_time.value += dt;
    shaderMat.uniforms.u_camPos.value = camera.position;

    if (!prefersReducedMotion) {
      // Slow rotation (like Buzzworthy)
      meshGroup.rotation.y += 0.003;

      // Camera parallax (exact Buzzworthy approach)
      camera.position.x += (mousePos.x - camera.position.x) * parallaxEase;
      camera.position.y += (mousePos.y - camera.position.y) * parallaxEase;
      camera.position.z += (initCameraZ - camera.position.z) * parallaxEase;
      camera.lookAt(0, 0, 0);
    }

    // Scroll: scale down and fade
    const scale = Math.max(0.3, 1 - scrollProgress * 0.3);
    meshGroup.scale.setScalar(scale);
    shaderMat.opacity = Math.max(0, 1 - scrollProgress * 1.5);

    renderer.render(scene, camera);
  }

  animate();

  // Store cleanup
  (container as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    scrollContainer?.removeEventListener("scroll", onScroll);
  };
}

export function destroyScene() {
  if (animationId) cancelAnimationFrame(animationId);
  if (meshGroup) {
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
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
  shaderMat = null;
  animationId = null;
}
