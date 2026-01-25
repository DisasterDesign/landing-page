precision mediump float;

uniform float uProgress;
uniform float uTime;
uniform vec2 uResolution;
uniform float uNoiseScale;

varying vec2 vUv;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion for organic edges
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Easing function for smooth animation
float easeInOutCubic(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

void main() {
  vec2 uv = vUv;
  vec2 center = vec2(0.5);

  // Aspect ratio correction
  float aspect = uResolution.x / uResolution.y;
  vec2 pos = (uv - center) * vec2(aspect, 1.0);

  // Distance from center
  float dist = length(pos);

  // Angle for noise variation around the tear
  float angle = atan(pos.y, pos.x);

  // Animated noise for organic, irregular edges
  float noiseVal = fbm(vec2(angle * 2.0 + uTime * 0.3, dist * 3.0), 4);

  // Apply easing to progress for smooth animation
  float easedProgress = easeInOutCubic(uProgress);

  // Base radius expands with progress (1.5 covers full screen diagonal)
  float baseRadius = easedProgress * 1.5;

  // Add noise displacement to radius
  float tearEdge = baseRadius + noiseVal * uNoiseScale;

  // Soft edge for anti-aliasing (wider edge for more visible tear effect)
  float edgeWidth = 0.03;
  float alpha = smoothstep(tearEdge - edgeWidth, tearEdge + edgeWidth, dist);

  // Add subtle edge glow/highlight
  float edgeGlow = smoothstep(tearEdge - 0.08, tearEdge, dist) *
                   smoothstep(tearEdge + 0.08, tearEdge, dist);

  // Output: alpha = 1 shows Hero (mask), alpha = 0 reveals HowItWorks
  // Add slight darkening at the edge for depth
  vec3 edgeColor = vec3(0.0);
  float edgeDarkness = edgeGlow * 0.3;

  gl_FragColor = vec4(edgeColor, alpha + edgeDarkness);
}
