"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

const F_PATH = "M382.837 794.39C378.356 793.122 373.865 791.911 369.404 790.584C302.269 770.644 277.894 693.034 321.548 638.267C322.135 637.527 322.654 636.748 323.452 635.653C311.962 622.055 303.962 606.698 301.029 589.025C291.904 533.826 328.163 488.39 376.029 478.809C382.933 477.425 390.163 477.194 397.24 477.185C487.529 477.079 577.817 477.118 668.106 477.118C670.942 477.118 673.788 477.118 677.76 477.118C676.577 473.994 675.846 471.38 674.635 468.997C656.433 433.248 627.394 414.249 587.019 414.038C525.01 413.711 462.99 413.923 400.971 413.971C382.683 413.99 365.01 411.347 348.971 401.977C318.75 384.314 301.673 358.31 299.981 323.06C299.413 311.259 299.894 299.41 299.894 287.033C302.24 286.889 304.298 286.648 306.356 286.648C433.24 286.629 560.115 286.562 687 286.668C732 286.706 773.087 324.291 779.462 368.794C787.308 423.561 744.221 477.579 684.548 477.194C682.913 477.185 681.279 477.406 680.394 477.464C681.5 488.899 683.452 500.105 683.519 511.319C683.798 559.869 642.558 602.941 593.788 603.623C528.462 604.536 463.115 604.017 397.779 604.132C369.038 604.18 344.558 614.146 324.452 635.72C340.913 653.383 360.731 665.107 384.798 666.184C417.529 667.644 450.346 667.02 483.125 667.279C485.942 667.298 488.75 667.279 491.404 667.279C501.99 713.964 483.173 761.255 445.058 782.281C435.106 787.769 423.587 790.431 412.788 794.38H382.846L382.837 794.39Z";

const vertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseInfluence;

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;

  // Mouse proximity displacement — push vertices away from mouse in world space
  vec3 mouseWorld = vec3(u_mouse.x * 3.0, u_mouse.y * 2.0, 2.0);
  float dist = distance(worldPos.xyz, mouseWorld);
  float influence = smoothstep(3.0, 0.0, dist) * u_mouseInfluence;
  vec3 pushDir = normalize(worldPos.xyz - mouseWorld);
  vec3 displaced = position + normal * influence * 0.15;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseInfluence;
uniform vec2 u_resolution;

// Exact honeycomb: Voronoi of triangular lattice = regular hex tiling.
// Returns distance to nearest cell edge.
float honeycomb(vec2 p, float scale) {
  p *= scale;
  // Skewed lattice coords: basis (1,0) and (0.5, sqrt(3)/2)
  float sy = p.y / 0.866025;
  float sx = p.x - sy * 0.5;
  // Nearest lattice point via cube-coordinate rounding
  float rz = -sx - sy;
  float rx = sx;
  float ry = sy;
  float irx = floor(rx + 0.5);
  float iry = floor(ry + 0.5);
  float irz = floor(rz + 0.5);
  float dx = abs(irx - rx);
  float dy = abs(iry - ry);
  float dz = abs(irz - rz);
  if (dx > dy && dx > dz) irx = -iry - irz;
  else if (dy > dz) iry = -irx - irz;
  // Nearest center in cartesian
  vec2 c1 = vec2(irx + iry * 0.5, iry * 0.866025);
  // Find second nearest by checking 6 neighbors
  float d1 = length(p - c1);
  float d2 = 1e10;
  for (int a = -1; a <= 1; a++) {
    for (int b = -1; b <= 1; b++) {
      if (a == 0 && b == 0) continue;
      vec2 cn = vec2((irx+float(a)) + (iry+float(b)) * 0.5, (iry+float(b)) * 0.866025);
      float dn = length(p - cn);
      if (dn > d1 + 0.001) d2 = min(d2, dn);
    }
  }
  return (d2 - d1) * 0.5;
}

float fresnel(vec3 viewDir, vec3 normal, float power) {
  return pow(1.0 - max(dot(viewDir, normal), 0.0), power);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  // Geometric texture: hex grid on the surface
  // Use world position projected onto surface for consistent tiling
  vec2 surfaceUV = vWorldPos.xy * 1.0 + vWorldPos.z * 0.3;

  // Mouse distorts the UV of the geometric pattern
  vec2 mouseWorld = u_mouse * vec2(3.0, 2.0);
  float mouseDist = distance(vWorldPos.xy, mouseWorld);
  float mouseRipple = sin(mouseDist * 8.0 - u_time * 3.0) * exp(-mouseDist * 1.5) * u_mouseInfluence;
  surfaceUV += mouseRipple * 0.15;

  // Honeycomb — exact regular hex tiling, small and dense
  float hex = honeycomb(surfaceUV, 4.0);
  float hexLine = 1.0 - smoothstep(0.005, 0.02, hex);
  float pattern = hexLine;

  // Mouse proximity glow
  float mouseGlow = exp(-mouseDist * 0.8) * u_mouseInfluence;

  // Base colors
  vec3 baseColor = vec3(0.96, 0.96, 0.97);
  vec3 lineColor = vec3(0.0, 0.0, 0.0); // Black lines
  vec3 pinkAccent = vec3(0.90, 0.01, 0.64); // #E503A2
  vec3 cyanAccent = vec3(0.0, 1.0, 1.0);   // #01FFFF

  // Fresnel for edge glow
  float fres = fresnel(viewDir, vNormal, 3.0);

  // Compose surface color
  vec3 color = baseColor;

  // Add geometric pattern lines — bold white
  color = mix(color, lineColor, pattern * 0.7);

  // Mouse interaction: pattern lines glow near cursor
  vec3 mouseColor = mix(pinkAccent, cyanAccent, sin(u_time * 0.5) * 0.5 + 0.5);
  color = mix(color, mouseColor * 0.6, pattern * mouseGlow);

  // Add general mouse proximity glow (diffuse, on the surface)
  color += mouseColor * mouseGlow * 0.08;

  // Fresnel edge highlight — shifts between pink and cyan
  vec3 fresnelColor = mix(pinkAccent, cyanAccent, fres);
  color = mix(color, fresnelColor, fres * 0.4);

  // Subtle light reflection
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float spec = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 32.0);
  color += vec3(1.0) * spec * 0.15;

  // Opacity: more opaque at edges (fresnel), slightly transparent center
  float alpha = mix(0.75, 0.95, fres);
  alpha = mix(alpha, min(alpha + 0.1, 1.0), mouseGlow);

  gl_FragColor = vec4(color, alpha);
}
`;

export default function HeroGlass() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const testCanvas = document.createElement("canvas");
    if (!testCanvas.getContext("webgl2") && !testCanvas.getContext("webgl")) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 10 || height < 10) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Scene + Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
    // Responsive: further on small screens so it fits
    camera.position.z = width < 500 ? 22 : width < 768 ? 18 : 14;

    // Geometry
    const loader = new SVGLoader();
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><path d="${F_PATH}"/></svg>`;
    const result = loader.parse(svgMarkup);
    const shapes: THREE.Shape[] = [];
    for (const path of result.paths) {
      shapes.push(...SVGLoader.createShapes(path));
    }
    if (shapes.length === 0) return;

    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 50,
      bevelEnabled: true,
      bevelThickness: 4,
      bevelSize: 3,
      bevelSegments: 4,
      curveSegments: 16,
    });
    geometry.center();
    geometry.computeVertexNormals();

    const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position") as THREE.BufferAttribute);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 8 / maxDim;
    geometry.scale(s, -s, s);

    // Shader material with geometric texture
    const uniforms = {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0, 0) },
      u_mouseInfluence: { value: 0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Mouse tracking
    const mouseNorm = { x: 0, y: 0 };
    const mouseSmooth = { x: 0, y: 0 };
    let mouseInside = false;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseNorm.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseNorm.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      mouseInside = true;
    };
    const onMouseLeave = () => {
      mouseInside = false;
    };
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    // Animation
    const currentRot = { x: 0, y: 0 };
    let influenceTarget = 0;

    function animate() {
      rafRef.current = requestAnimationFrame(animate);

      uniforms.u_time.value += 0.016;

      // Smooth mouse
      mouseSmooth.x += (mouseNorm.x - mouseSmooth.x) * 0.06;
      mouseSmooth.y += (mouseNorm.y - mouseSmooth.y) * 0.06;
      uniforms.u_mouse.value.set(mouseSmooth.x, mouseSmooth.y);

      // Mouse influence ramp
      influenceTarget = mouseInside ? 1.0 : 0.0;
      uniforms.u_mouseInfluence.value += (influenceTarget - uniforms.u_mouseInfluence.value) * 0.05;

      // Subtle rotation follow
      currentRot.y += (mouseSmooth.x * 0.25 - currentRot.y) * 0.04;
      currentRot.x += (mouseSmooth.y * 0.12 - currentRot.x) * 0.04;
      mesh.rotation.y = currentRot.y;
      mesh.rotation.x = currentRot.x;

      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.u_resolution.value.set(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
