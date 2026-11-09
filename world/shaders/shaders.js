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
  float att = uLanternIntensity / (1.0 + d * d * 0.55);
  att *= 1.0 - smoothstep(5.0, 11.0, d);
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

// Textura de roca pintada: taques grans, plaques amb esquerdes i pigues de liquen.
export const ROCK = /* glsl */ `
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distància a la vora de la cel·la de Voronoi (0 = sobre l'esquerda).
float voronoiEdge(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.85 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

// Granit: gra fi, taques de liquen (grogues i grises), esquerdes fines i fosques.
float fissures(vec2 p) {
  float e = voronoiEdge(p * 0.9 + vnoise(p * 0.7) * 1.2);
  float mask = smoothstep(0.45, 0.65, vnoise(p * 0.45 + 3.0));
  return 1.0 - (1.0 - smoothstep(0.0, 0.025, e)) * mask;
}

vec3 graniteAt(vec3 base, vec2 p) {
  float mottle = fbm3(p * 1.3);
  float grain = vnoise(p * 38.0) * 0.6 + vnoise(p * 90.0) * 0.4;
  vec3 c = base * (0.82 + 0.3 * mottle) * (0.86 + 0.28 * grain);
  // Liquen: taques irregulars amb vores retallades.
  float lichenField = fbm3(p * 3.6 + 11.0) + (vnoise(p * 22.0) - 0.5) * 0.3;
  float yellow = smoothstep(0.64, 0.67, lichenField);
  float grey = smoothstep(0.6, 0.64, vnoise(p * 1.7 - 5.0) + (grain - 0.5) * 0.25);
  c = mix(c, vec3(0.38, 0.4, 0.22), yellow * 0.45);
  c = mix(c, vec3(0.38, 0.38, 0.36), grey * 0.3);
  return c * mix(0.6, 1.0, fissures(p));
}

vec3 rockAlbedo(vec3 base, vec3 p, vec3 n) {
#ifdef ROCK_GROUND
  // Terra: sòl fosc amb grava i alguna taca de molsa.
  float g = vnoise(p.xz * 18.0);
  float pebbles = smoothstep(0.72, 0.8, g);
  float moss = smoothstep(0.45, 0.7, fbm3(p.xz * 0.9 + 4.0));
  vec3 soil = base * (0.8 + 0.35 * fbm3(p.xz * 2.5));
  soil = mix(soil, base * vec3(0.85, 1.2, 0.7), moss * 0.6);
  return mix(soil, vec3(0.2, 0.2, 0.21), pebbles * 0.5);
#else
  // Una sola projecció (la de la cara dominant): molt més barat que barrejar-ne tres.
  vec3 an = abs(n);
  if (an.y >= an.x && an.y >= an.z) return graniteAt(base, p.xz);
  if (an.x >= an.z) return graniteAt(base, p.yz);
  return graniteAt(base, p.xy);
#endif
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
#ifdef USE_TINT
attribute vec3 aTint;
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
#ifdef USE_TINT
  vColor *= aTint;
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
#if defined(ROCK) || defined(ROCK_GROUND) || defined(MOSS)
${NOISE}
#endif
#if defined(ROCK) || defined(ROCK_GROUND)
${ROCK}
#endif

void main() {
#ifdef FLAT
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
#else
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
#endif
  vec3 albedo = uColor * vColor;
#if defined(ROCK) || defined(ROCK_GROUND)
  albedo = rockAlbedo(albedo, vWorld, n);
#endif
#ifdef MOSS
  // Coixins de molsa i bruc: milers de fulletes (punts de dos tons).
  float dots = vnoise(vWorld.xz * 70.0 + vWorld.y * 45.0);
  float dots2 = vnoise(vWorld.xz * 31.0 - vWorld.y * 20.0 + 7.0);
  albedo *= 0.55 + 0.75 * smoothstep(0.35, 0.75, dots);
  albedo = mix(albedo, albedo * vec3(1.4, 1.05, 0.6), smoothstep(0.6, 0.8, dots2) * 0.6);
#endif
  vec3 col = shadeStylized(albedo, n, vWorld);
#if defined(FABRIC) || defined(MOSS)
  // Lluentor suau de la tela de niló a les vores.
  float ndv = max(dot(n, normalize(cameraPosition - vWorld)), 0.0);
  vec3 toLampF = uLanternPos - vWorld;
  float lampF = uLanternIntensity / (1.0 + dot(toLampF, toLampF) * 0.55);
  col += albedo * pow(1.0 - ndv, 2.2) * (uSkyAmbient * 3.0 + uLanternColor * lampF * 0.6);
#endif
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
attribute float aPhase;
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

  // Cada tija té la seva fase: es mouen juntes amb la ràfega però no iguals.
  float phase = uTime * (1.5 + aPhase * 0.6) + root.x * 0.55 + root.z * 0.35 + aPhase * 6.2831;
  float gust = 0.5 + 0.5 * sin(uTime * 0.41 + root.x * 0.09 - root.z * 0.06);
  float sway = (sin(phase) * 0.55 + sin(phase * 2.31 + 1.7) * 0.22 + 0.4) * (0.4 + gust * 0.9) * uWind;
  float flutter = sin(uTime * 7.0 + aPhase * 40.0) * 0.04 * gust;
  float k = aHeight * aHeight;

  wp.x += (sway + flutter) * k * plantH * 0.5;
  wp.z += sin(phase * 0.7 + 2.0 + aPhase * 3.0) * k * plantH * 0.14 * uWind;
  wp.y -= abs(sway) * k * plantH * 0.1;

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

  vec3 rockShadow = vec3(0.015, 0.018, 0.03);
  vec3 rockLit = vec3(0.035, 0.041, 0.062);
  vec3 snowShadow = vec3(0.05, 0.062, 0.098);
  vec3 snowLit = vec3(0.14, 0.165, 0.23);

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
  vec2 q = p * 0.0042 + vec2(uTime * 0.0016, uTime * 0.0007);
  vec2 warp = vec2(fbm3(q * 1.3 + 3.1), fbm3(q * 1.3 - 1.7));
  return fbm5(q + warp * 0.95 + vec2(uTime * 0.0008, 0.0));
}
`;

export const CLOUD_SEA = {
  // El camp de núvols es calcula als vèrtexs (barat) i el fragment només hi
  // afegeix una mica de detall: abans era la part més cara de l'escena.
  vertex: /* glsl */ `
${CLOUD_FIELD}
uniform float uCloudAmp;
uniform vec3 uMoonDir;
varying vec3 vWorld;
varying float vShade;
varying float vPuff;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  float h = cloudField(wp.xz);
  float h2 = cloudField(wp.xz + normalize(uMoonDir.xz) * 10.0);
  vShade = smoothstep(0.25, 0.85, 0.55 + (h - h2) * 11.0);
  vPuff = smoothstep(0.35, 0.68, h);
  wp.y += (h - 0.45) * uCloudAmp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  fragment: /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uHazeColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;
varying vec3 vWorld;
varying float vShade;
varying float vPuff;

void main() {
  float detail = vnoise(vWorld.xz * 0.05 + vec2(uTime * 0.01, 0.0)) - 0.5;
  float k = clamp(vShade * 0.65 + vPuff * 0.35 + detail * 0.18, 0.0, 1.0);
  vec3 col = mix(uCloudShadow, uCloudLit, k);

  float dist = length(vWorld - cameraPosition);
  float f = 1.0 - exp(-dist / 650.0);
  col = mix(col, uHazeColor, f * 0.7);
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
uniform float uBoost;
void main() {
  vec3 col = uLanternColor * (0.75 + 0.35 * uLanternIntensity) * uBoost + vec3(0.25) * max(uBoost - 1.0, 0.0);
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
