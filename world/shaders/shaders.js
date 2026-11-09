// Tots els shaders de l'escena. Estil il·lustrat: llum de lluna freda per franges suaus,
// una llum càlida al bivac, i boira de distància que es fon amb el cel.
// Els colors que surten d'aquí són els que es veuen a pantalla (sense tone mapping),
// igual que el cel.

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.02 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return s / 0.875;
}

float fbm5(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.02 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return s / 0.96875;
}
`;

export const LIGHTING = /* glsl */ `
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform vec3 uLanternPos;
uniform vec3 uLanternColor;
uniform float uLanternIntensity;
uniform vec3 uHazeColor;

// Llum de lluna per franges (aspecte pintat, com a Cairn) + fanalet càlid.
vec3 shadeStylized(vec3 albedo, vec3 n, vec3 wp) {
  float ndl = dot(n, uMoonDir);
  float moon = smoothstep(-0.04, 0.12, ndl) * 0.55 + smoothstep(0.38, 0.55, ndl) * 0.45;
  vec3 ambient = mix(uGroundAmbient, uSkyAmbient, n.y * 0.5 + 0.5);

  vec3 toLamp = uLanternPos - wp;
  float d = length(toLamp);
  float att = uLanternIntensity / (1.0 + d * d * 1.15);
  att *= 1.0 - smoothstep(3.5, 7.0, d);
  float facing = dot(n, toLamp / max(d, 0.0001));
  float wrap = smoothstep(-0.2, 0.25, facing) * 0.8 + 0.2;
  vec3 lamp = uLanternColor * att * wrap;

  vec3 v = normalize(cameraPosition - wp);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 4.0) * moon;

  return albedo * (ambient + uMoonColor * moon + lamp) + uMoonColor * rim * 0.05;
}

vec3 applyHaze(vec3 col, vec3 wp) {
  float d = length(wp - cameraPosition);
  float f = (1.0 - exp(-d / 520.0)) * 0.95;
  // Una mica de boira fins i tot a prop: suavitza el fons del cim.
  f = max(f, smoothstep(4.0, 40.0, d) * 0.25);
  return mix(col, uHazeColor, f);
}
`;

// ------------------------------------------------------------------
// Material general: roques, terra, sacs, motxilles...
// ------------------------------------------------------------------
export const STYLIZED = {
  vertex: /* glsl */ `
#ifdef USE_ACOLOR
attribute vec3 aColor;
#endif
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vColor;

void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = modelMatrix * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(m) * normal);
#ifdef USE_ACOLOR
  vColor = aColor;
#else
  vColor = vec3(1.0);
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  fragment: /* glsl */ `
uniform vec3 uColor;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vColor;
${LIGHTING}

void main() {
#ifdef FLAT
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
#else
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
#endif
  vec3 albedo = uColor * vColor;
  vec3 col = shadeStylized(albedo, n, vWorld);
  col = applyHaze(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`
};

// ------------------------------------------------------------------
// Herba i flors amb vent (instanciades: milers en una sola crida)
// ------------------------------------------------------------------
export const GRASS = {
  vertex: /* glsl */ `
attribute vec3 aColor;
attribute float aHeight;
attribute vec3 aTint;
uniform float uTime;
uniform float uWind;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vColor;

void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = modelMatrix * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vec3 root = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float plantH = length(m[1].xyz);

  float phase = uTime * 1.7 + root.x * 0.55 + root.z * 0.35;
  float gust = 0.5 + 0.5 * sin(uTime * 0.41 + root.x * 0.09 - root.z * 0.06);
  float sway = (sin(phase) * 0.55 + sin(phase * 2.31 + 1.7) * 0.2 + 0.35) * (0.45 + gust * 0.75) * uWind;
  float k = aHeight * aHeight;

  wp.x += sway * k * plantH * 0.32;
  wp.z += sin(phase * 0.7 + 2.0) * k * plantH * 0.08 * uWind;
  wp.y -= abs(sway) * k * plantH * 0.06;

  vWorld = wp.xyz;
  vNormalW = normalize(vec3(-sway * 0.3, 1.0, 0.25));
  vColor = aColor * aTint;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
};

// ------------------------------------------------------------------
// Serralades: roca i neu segons alçada i pendent, boira per capes
// ------------------------------------------------------------------
export const MOUNTAIN = {
  vertex: /* glsl */ `
attribute float aH;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vH;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vH = aH;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  fragment: /* glsl */ `
uniform vec3 uMoonDir;
uniform vec3 uHazeColor;
uniform vec3 uMistColor;
uniform float uCloudY;
uniform float uSnowLine;
uniform float uFogAmount;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vH;
${NOISE}

void main() {
  // Barreja de normal suau i de faceta: plans amples, com pintats.
  vec3 face = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 n = normalize(mix(normalize(vNormalW), face, 0.3));
  if (n.y < 0.0) n = -n;

  float ndl = dot(n, uMoonDir);
  float light = smoothstep(-0.02, 0.14, ndl) * 0.6 + smoothstep(0.4, 0.58, ndl) * 0.4;

  float nz = vnoise(vWorld.xz * 0.045) * 0.6 + vnoise(vWorld.xz * 0.19) * 0.4;
  float snowMask = vH + (n.y - 0.6) * 0.55 + (nz - 0.5) * 0.3;
  float snow = smoothstep(uSnowLine - 0.03, uSnowLine + 0.03, snowMask);

  vec3 rockShadow = vec3(0.026, 0.032, 0.05);
  vec3 rockLit = vec3(0.075, 0.085, 0.12);
  vec3 snowShadow = vec3(0.1, 0.125, 0.19);
  vec3 snowLit = vec3(0.34, 0.39, 0.52);

  vec3 rock = mix(rockShadow, rockLit, light) * (0.85 + 0.3 * nz);
  vec3 sn = mix(snowShadow, snowLit, light);
  vec3 col = mix(rock, sn, snow);

  // Perspectiva atmosfèrica: com més lluny, més es fon amb la claror de l'horitzó.
  float dist = length(vWorld - cameraPosition);
  float f = (1.0 - exp(-dist / 430.0)) * uFogAmount;
  col = mix(col, uHazeColor, f);

  // Boira baixa a les valls, sobre el mar de núvols.
  float low = smoothstep(uCloudY + 55.0, uCloudY - 2.0, vWorld.y);
  col = mix(col, uMistColor, low * 0.92);

  gl_FragColor = vec4(col, 1.0);
}
`
};

// ------------------------------------------------------------------
// Mar de núvols
// ------------------------------------------------------------------
const CLOUD_FIELD = /* glsl */ `
uniform float uTime;
${NOISE}
float cloudField(vec2 p) {
  vec2 q = p * 0.0062 + vec2(uTime * 0.0021, uTime * 0.0009);
  vec2 warp = vec2(fbm3(q * 1.3 + 3.1), fbm3(q * 1.3 - 1.7));
  return fbm5(q + warp * 0.95 + vec2(uTime * 0.0008, 0.0));
}
`;

export const CLOUD_SEA = {
  vertex: /* glsl */ `
${CLOUD_FIELD}
uniform float uCloudAmp;
varying vec3 vWorld;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  float h = cloudField(wp.xz);
  wp.y += (h - 0.45) * uCloudAmp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  fragment: /* glsl */ `
${CLOUD_FIELD}
uniform vec3 uMoonDir;
uniform vec3 uHazeColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;
varying vec3 vWorld;

void main() {
  vec2 p = vWorld.xz;
  float h = cloudField(p);
  vec2 ld = normalize(uMoonDir.xz);
  float h2 = cloudField(p + ld * 7.0);
  float shade = smoothstep(0.35, 0.75, 0.55 + (h - h2) * 7.5);
  float puff = smoothstep(0.3, 0.72, h);
  vec3 col = mix(uCloudShadow, uCloudLit, shade * 0.65 + puff * 0.35);

  float dist = length(vWorld - cameraPosition);
  float f = 1.0 - exp(-dist / 380.0);
  col = mix(col, uHazeColor, f * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`
};

// ------------------------------------------------------------------
// Núvols alts (plans translúcids)
// ------------------------------------------------------------------
export const HIGH_CLOUD = {
  vertex: /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  fragment: /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * uOpacity;
  if (a < 0.003) discard;
  float glow = smoothstep(0.0, 0.6, t.a);
  vec3 col = uColor * (0.7 + 0.45 * glow);
  gl_FragColor = vec4(col, a);
}
`
};

// ------------------------------------------------------------------
// Llum del fanalet: vidre emissiu i halo
// ------------------------------------------------------------------
export const EMISSIVE = {
  vertex: /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragment: /* glsl */ `
uniform vec3 uLanternColor;
uniform float uLanternIntensity;
void main() {
  vec3 col = uLanternColor * (0.75 + 0.35 * uLanternIntensity);
  gl_FragColor = vec4(col, 1.0);
}
`
};

export const GLOW = {
  vertex: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragment: /* glsl */ `
uniform vec3 uLanternColor;
uniform float uLanternIntensity;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (exp(-r * r * 9.0) * 0.9 + exp(-r * r * 2.2) * 0.3) * (1.0 - smoothstep(0.85, 1.0, r));
  a *= uStrength * (0.8 + 0.25 * uLanternIntensity);
  gl_FragColor = vec4(uLanternColor * a, a);
}
`
};

// ------------------------------------------------------------------
// Estel fugaç
// ------------------------------------------------------------------
export const SHOOTING_STAR = {
  vertex: /* glsl */ `
attribute float aAlpha;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (2.0 + 3.5 * aAlpha) * uPixelRatio;
  gl_Position = projectionMatrix * mv;
}
`,
  fragment: /* glsl */ `
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;
  float a = exp(-r * r * 3.5) * vAlpha;
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * a, a);
}
`
};
