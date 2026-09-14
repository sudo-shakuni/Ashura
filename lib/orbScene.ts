import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ChibiAvatar, type ChibiTheme, type ChibiCustomization, CHIBI_THEMES } from "./chibiAvatar";

export { ChibiAvatar, CHIBI_THEMES, type ChibiTheme, type ChibiCustomization };

/**
 * Orb states. Drives the avatar particle system's assembly progress and a
 * couple of global post-processing params (bloom strength, error glitch).
 */
export type OrbState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "TOOL_EXECUTION"
  | "ERROR";

const CHROMATIC_ABERRATION_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0025 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float r = texture2D(tDiffuse, vUv - dir * amount).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + dir * amount).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

interface StateVisualParams {
  coreColor: number;
  coreEmissive: number;
  coreBaseScale: number;
  corePulse: number;
  shellSpeed: number;
  scanSpeed: number;
  spriteSpeed: number;
  bloomStrength: number;
  ringVisible: boolean;
  toolRingVisible: boolean;
  glitch: boolean;
  avatarCool: number;
  avatarWarm: number;
}

const STATE_PARAMS: Record<OrbState, StateVisualParams> = {
  IDLE: {
    coreColor: 0x00f0ff,
    coreEmissive: 0x003355,
    coreBaseScale: 1,
    corePulse: 0.03,
    shellSpeed: 0.15,
    scanSpeed: 0.2,
    spriteSpeed: 0.15,
    bloomStrength: 0.85,
    ringVisible: false,
    toolRingVisible: false,
    glitch: false,
    avatarCool: 0x5ce1e6,
    avatarWarm: 0xff3b30,
  },
  LISTENING: {
    coreColor: 0x00f0ff,
    coreEmissive: 0x0066aa,
    coreBaseScale: 1.05,
    corePulse: 0.1,
    shellSpeed: 0.4,
    scanSpeed: 0.6,
    spriteSpeed: 0.35,
    bloomStrength: 1.15,
    ringVisible: true,
    toolRingVisible: false,
    glitch: false,
    avatarCool: 0x38bdf8,
    avatarWarm: 0x00f0ff,
  },
  THINKING: {
    coreColor: 0xb066ff,
    coreEmissive: 0x4a1c7c,
    coreBaseScale: 1.0,
    corePulse: 0.06,
    shellSpeed: 0.7,
    scanSpeed: 0.9,
    spriteSpeed: 0.8,
    bloomStrength: 1.0,
    ringVisible: false,
    toolRingVisible: false,
    glitch: false,
    avatarCool: 0xa855f7,
    avatarWarm: 0xec4899,
  },
  SPEAKING: {
    coreColor: 0x00ffaa,
    coreEmissive: 0x006644,
    coreBaseScale: 1.1,
    corePulse: 0.15,
    shellSpeed: 0.45,
    scanSpeed: 0.5,
    spriteSpeed: 0.35,
    bloomStrength: 1.45,
    ringVisible: true,
    toolRingVisible: false,
    glitch: false,
    avatarCool: 0x10b981,
    avatarWarm: 0x06b6d4,
  },
  TOOL_EXECUTION: {
    coreColor: 0xffb800,
    coreEmissive: 0x7c4a00,
    coreBaseScale: 1.04,
    corePulse: 0.07,
    shellSpeed: 0.3,
    scanSpeed: 0.35,
    spriteSpeed: 0.25,
    bloomStrength: 1.2,
    ringVisible: false,
    toolRingVisible: true,
    glitch: false,
    avatarCool: 0xf59e0b,
    avatarWarm: 0xef4444,
  },
  ERROR: {
    coreColor: 0xff2a2a,
    coreEmissive: 0x880000,
    coreBaseScale: 1.0,
    corePulse: 0.18,
    shellSpeed: 0.2,
    scanSpeed: 0.3,
    spriteSpeed: 0.2,
    bloomStrength: 1.35,
    ringVisible: false,
    toolRingVisible: false,
    glitch: true,
    avatarCool: 0xef4444,
    avatarWarm: 0xffffff,
  },
};

/** Per-state avatar assembly progress: 0 = fully scattered ambient
 * particles, 1 = fully assembled into the head/neck/shoulders silhouette.
 * Only used before the first LISTENING/SPEAKING — after that, assembly
 * locks permanently at 1 regardless of state (see OrbScene.avatarLocked). */
const AVATAR_ASSEMBLY: Record<OrbState, number> = {
  IDLE: 0.15,
  LISTENING: 0.85,
  THINKING: 0.35,
  SPEAKING: 1,
  TOOL_EXECUTION: 0.7,
  ERROR: 0.2,
};

const AVATAR_PARTICLE_COUNT = 18000;

/** Number of discrete "meridian" bands wrapping the head/neck. Points are
 * quantized onto one of these bands (with a little jitter) instead of
 * being placed at a fully random angle — this is what makes the assembled
 * shape read as flowing contour LINES tracing the silhouette (like the
 * reference), rather than a random speckled cloud of independent dots. */
const MERIDIAN_BANDS = 56;
const BAND_JITTER = 0.045;

/** Procedurally generates a stylized head + neck + shoulders point cloud
 * (no 3D model file needed) — an ellipsoid skull biased toward its surface,
 * with points quantized onto shared vertical meridian bands that continue
 * down through the neck for a connected, flowing-line look, and shoulders
 * that fade in density toward the edges so they trail off into scattered
 * particles rather than ending in a hard line. Also returns a per-point
 * "warmth" factor (0 = cool outer contour, 1 = warm central column) used
 * for the blue-to-amber gradient. */
function generateAvatarTargets(count: number): { positions: Float32Array; warmth: Float32Array } {
  const positions = new Float32Array(count * 3);
  const warmth = new Float32Array(count);

  // Region weights: most particles trace the head (it's the recognizable
  // part), fewer on the neck, remainder thinning out across the shoulders.
  const headShare = 0.42;
  const neckShare = 0.15;

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let x: number, y: number, z: number;
    let isEye = false;
    let isMouth = false;

    // Shared band index/angle so a head meridian visually continues into
    // the matching neck band below it, instead of the two regions looking
    // like independently-scattered point sets.
    const band = Math.floor(Math.random() * MERIDIAN_BANDS);
    const bandTheta =
      ((band + (Math.random() - 0.5) * BAND_JITTER) / MERIDIAN_BANDS) * Math.PI * 2;

    if (r < headShare) {
      // Original mechanical-skull-inspired restyle (explicitly NOT a
      // literal recreation of any copyrighted character design — see
      // conversation) — small fractions of head particles cluster into
      // glowing "eye" and "mouth" features instead of tracing the skull
      // contour, forced to full warmth (red) below regardless of the
      // usual center/forward-facing warmth calculation.
      const featureRoll = Math.random();
      isEye = featureRoll < 0.05;
      isMouth = !isEye && featureRoll < 0.1;
      if (isEye) {
        // Narrow glowing slit, not a blocky square — wide in x, thin in y,
        // matching a menacing "slit eye" look rather than a solid patch.
        const side = Math.random() < 0.5 ? -1 : 1;
        x = side * 0.27 + (Math.random() - 0.5) * 0.22;
        y = 1.14 + (Math.random() - 0.5) * 0.045;
        z = 0.6 + (Math.random() - 0.5) * 0.05;
      } else if (isMouth) {
        // Wide glowing line across the lower jaw, corners curled slightly
        // upward for a menacing grin rather than a flat neutral line.
        const mt = Math.random() * 2 - 1; // -1..1 across mouth width
        const smirk = Math.pow(Math.abs(mt), 2.2) * 0.06;
        x = mt * 0.34 + (Math.random() - 0.5) * 0.02;
        y = 0.26 + smirk + (Math.random() - 0.5) * 0.035;
        z = 0.58 + (Math.random() - 0.5) * 0.05;
      } else {
        // Egg-shaped skull, narrower and taller than before (a wide/round
        // profile read as a "pumpkin" rather than a head — confirmed live).
        // phi sampling is deliberately biased (not uniform-area) to put
        // more points in the lower jaw/chin third specifically, so the
        // taper down to a chin point is visibly dense rather than
        // mathematically present but too sparse near the pole to actually
        // see.
        const rx = 0.72, ry = 0.95, rz = 0.64;
        const phiT = Math.random();
        // Clamped away from the very poles (0.05π..0.95π) so the crown
        // stays rounded instead of tapering to a sharp bullet-like point —
        // a narrower clamp made it read as a light bulb, not a head —
        // while still biasing extra density toward the chin end for a
        // visible taper.
        const phi = 0.05 * Math.PI + Math.pow(phiT, 0.8) * 0.9 * Math.PI;
        const shell = 0.8 + 0.2 * Math.sqrt(Math.random()); // biased outward
        x = rx * shell * Math.sin(phi) * Math.cos(bandTheta);
        y = 0.95 + ry * shell * Math.cos(phi);
        z = rz * shell * Math.sin(phi) * Math.sin(bandTheta) * 0.9;
      }
    } else if (r < headShare + neckShare) {
      // Tapered neck between head base and shoulder line — same band angle
      // as the head so the meridian lines read as continuous strokes
      // flowing from skull to neck, not two disconnected point sets.
      const t = Math.random();
      const radius = 0.26 + 0.18 * t;
      x = Math.cos(bandTheta) * radius;
      y = 0.15 + t * 0.5;
      z = Math.sin(bandTheta) * radius * 0.85;
    } else {
      // Shoulders: widen with a smooth curve, density thins toward the
      // outer edge (t^1.6 bias) so it trails off instead of a hard cutoff.
      // Deliberately NOT quantized onto discrete bands here — an earlier
      // pass rounded t to ~22 steps for a "banded" look, but confirmed
      // live that produced an ugly dashed/segmented arc instead of a
      // smooth flowing curve. Continuous t reads as one clean stroke.
      const t = Math.pow(Math.random(), 1.6);
      const side = Math.random() < 0.5 ? -1 : 1;
      const spread = 0.5 + t * 1.7;
      const droop = -t * t * 0.9;
      x = side * spread;
      y = 0.15 + droop + (Math.random() - 0.5) * 0.12;
      z = (Math.random() - 0.5) * 0.4 * (1 - t * 0.5);
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    if (isEye || isMouth) {
      // Eye/mouth clusters are always full "warmth" (rendered red — see
      // uColorWarm below) regardless of position, so they read as
      // distinct glowing features rather than blending into the skull
      // contour's usual center-glow falloff.
      warmth[i] = 1;
    } else {
      // Narrower/dimmer ambient center glow than before — a wide warm
      // zone made the dedicated mouth feature blend in instead of reading
      // as a distinct line against a cooler face.
      const centerCloseness = Math.max(0, 1 - Math.abs(x) / 0.45);
      const forwardness = Math.max(0, z / 0.6);
      warmth[i] = Math.min(0.75, centerCloseness * 0.5 + forwardness * 0.35);
    }
  }

  return { positions, warmth };
}

const AVATAR_VERTEX_SHADER = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAmplitude;
  attribute vec3 aStart;
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute float aWarmth;
  varying float vWarmth;
  varying float vEased;
  varying vec3 vWorldPos;

  void main() {
    float local = clamp((uProgress - aSeed * 0.35) / max(0.0001, 1.0 - aSeed * 0.35), 0.0, 1.0);
    float eased = local * local * (3.0 - 2.0 * local); // smoothstep

    vec3 pos = mix(aStart, aTarget, eased);

    // Audio-reactive resonance wave when speech/listening amplitude > 0
    if (eased > 0.5 && uAmplitude > 0.01) {
      vec3 norm = normalize(pos);
      pos += norm * (sin(pos.y * 10.0 + uTime * 8.0) * uAmplitude * 0.06);
    }

    // Turbulent wobble that fades out as the particle settles
    float wobbleAmt = (1.0 - eased) * 0.5;
    pos.x += sin(uTime * 1.7 + aSeed * 62.0) * wobbleAmt;
    pos.y += cos(uTime * 1.3 + aSeed * 41.0) * wobbleAmt * 0.8;
    pos.z += sin(uTime * 2.1 + aSeed * 77.0) * wobbleAmt;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float safeDist = max(0.5, -mvPosition.z);
    gl_PointSize = clamp((0.65 + eased * 0.75 + uAmplitude * 0.3) * uPixelRatio * (230.0 / safeDist), 1.0, 18.0);

    vWarmth = aWarmth;
    vEased = eased;
    vWorldPos = pos;
  }
`;

const AVATAR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorCool;
  uniform vec3 uColorWarm;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uAmplitude;
  varying float vWarmth;
  varying float vEased;
  varying vec3 vWorldPos;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d);
    vec3 color = mix(uColorCool, uColorWarm, vWarmth);

    // Cyber scanline modulation and holographic energy shimmer
    float scanline = 0.88 + 0.12 * sin(vWorldPos.y * 22.0 + uTime * 4.0);
    float shimmer = 0.92 + 0.08 * sin(uTime * 6.5 + vWarmth * 6.28);
    float brightness = (0.42 + vEased * 0.22 + uAmplitude * 0.35) * scanline * shimmer;
    
    gl_FragColor = vec4(color * brightness, alpha * uOpacity * (0.03 + vEased * 0.2 + uAmplitude * 0.1));
  }
`;

function makeCodeSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "20px monospace";
  ctx.fillStyle = "#8fd6ff";
  const glyphs = "01{}<>/;=+*#";
  let s = "";
  for (let i = 0; i < 6; i++) s += glyphs[Math.floor(Math.random() * glyphs.length)];
  ctx.fillText(s, 4, 22);
  return new THREE.CanvasTexture(canvas);
}

export class OrbScene {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private chromaticPass!: ShaderPass;
  private bloomPass!: UnrealBloomPass;

  // --- restored original orb elements, coexisting alongside the avatar ---
  private shells: THREE.Mesh[] = [];
  private core!: THREE.Mesh;
  private coreMaterial!: THREE.MeshStandardMaterial;
  private debrisGroup!: THREE.Group;
  private spriteGroup!: THREE.Group;
  private dust!: THREE.Points;
  private scanRings: THREE.Mesh[] = [];
  private waveformRing!: THREE.Mesh;
  private toolRing!: THREE.Mesh;
  private fakeAmplitudeClock = 0;

  /** A distinct slow "breathing" violet ring, independent of both the orb
   * state and the tool-pulse ring — an ambient "something is waiting"
   * signal that stays visible even while IDLE. Deliberately its own
   * ring and color rather than reusing toolRing's amber: conflating
   * "needs your attention now" with "waiting in the background" would
   * make both unreadable at a glance. */
  private notifyRing!: THREE.Mesh;
  private proactivePending = false;

  // --- orbiting graph layer: nodes circling the orb, edges drawn as lines
  // between them. Rebuilt wholesale on each setMemoryGraph() call rather
  // than diffed — simpler, and cheap enough at the expected node count
  // (hundreds of nodes, not thousands) to just re-lay-out and fade in.
  private memoryGraphGroup!: THREE.Group;
  private memoryGraphOpacity = 0;
  private memoryGraphTargetOpacity = 0;
  private memoryGraphMaterials: { material: THREE.Material; targetOpacity: number }[] = [];

  public chibiAvatar!: ChibiAvatar;
  private avatarGroup!: THREE.Group;
  private avatarParticles!: THREE.Points;
  private avatarMaterial!: THREE.ShaderMaterial;
  /** Smoothed toward the current assembly target each frame, not snapped,
   * so transitions stream rather than jump. */
  private avatarProgress = 0.15;
  /** Once the user's first LISTENING/SPEAKING happens, the avatar assembles
   * and then stays assembled permanently — it no longer disperses back to
   * scattered on IDLE/THINKING/etc. Explicit user request: "when i speak
   * first time then animate and make the avatar, after that keep it." */
  private avatarLocked = false;

  private state: OrbState = "IDLE";
  private params: StateVisualParams = STATE_PARAMS.IDLE;
  private amplitude = 0;

  /** A brief (~0.9s) pulse on the tool ring plus chromatic aberration,
   * distinct from the ring's normal steady amber spin — lets an outcome
   * read as success / attention-needed / failure at a glance, with no
   * chat-style panel anywhere. */
  private toolPulseUntil = 0;
  private toolPulseColor = 0xffc24f;

  private gridFloor!: THREE.Mesh;
  private hudRing!: THREE.Mesh;

  private lastTime = 0;
  private elapsedTime = 0;
  private rafId: number | null = null;

  // Rolling FPS readout (updated once/sec) for the debug panel — measuring
  // via a page-hidden-safe screenshot readout instead of an ad-hoc rAF
  // probe, since backgrounding the tab during a manual JS measurement
  // pauses requestAnimationFrame and gives a false reading.
  private fpsFrameCount = 0;
  private fpsWindowStart = 0;
  private fps = 0;

  // orbit state (mouse/touch drag + gesture-driven rotation)
  private rotationX = 0.4;
  private rotationY = 0;
  private targetRotationX = 0.4;
  private targetRotationY = 0;
  private zoom = 6;
  private targetZoom = 6;
  private readonly minZoom = 2.5;
  private readonly maxZoom = 12;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    });

    this.buildScene();
    this.buildComposer();
  }

  private buildScene() {
    this.scene.fog = new THREE.FogExp2(0x05070c, 0.045);

    const ambient = new THREE.AmbientLight(0x334466, 0.7);
    this.scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.85);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(2.5, 4, 3.5);
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.9);
    rimLight.position.set(-3, 2, -2.5);
    this.scene.add(rimLight);

    // --- layered wireframe shells (framing the chibi avatar as an energy aura) ---
    const shellConfigs = [
      { radius: 1.8, detail: 1, speed: 0.8 },
      { radius: 2.2, detail: 2, speed: -0.5 },
      { radius: 2.6, detail: 1, speed: 0.3 },
    ];
    for (const cfg of shellConfigs) {
      const geo = new THREE.IcosahedronGeometry(cfg.radius, cfg.detail);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x2ea6ff,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.speed = cfg.speed;
      this.scene.add(mesh);
      this.shells.push(mesh);
    }

    // --- pulsing floating AI halo drone core ---
    const coreGeo = new THREE.IcosahedronGeometry(0.28, 3);
    this.coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ea6ff,
      emissive: 0x0c3a5c,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.4,
      wireframe: false,
    });
    this.core = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.core.position.set(0, 1.4, -0.35);
    this.scene.add(this.core);

    // --- orbiting debris ring ---
    this.debrisGroup = new THREE.Group();
    const debrisCount = 26;
    for (let i = 0; i < debrisCount; i++) {
      const size = 0.02 + Math.random() * 0.05;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x6fd0ff,
        emissive: 0x1c4a6c,
        emissiveIntensity: 0.8,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / debrisCount) * Math.PI * 2;
      const radius = 2.6 + Math.random() * 0.6;
      mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.6, Math.sin(angle) * radius);
      mesh.userData.angle = angle;
      mesh.userData.radius = radius;
      mesh.userData.yBase = mesh.position.y;
      this.debrisGroup.add(mesh);
    }
    this.scene.add(this.debrisGroup);

    // --- drifting code-fragment sprites ---
    this.spriteGroup = new THREE.Group();
    const spriteCount = 14;
    for (let i = 0; i < spriteCount; i++) {
      const tex = makeCodeSpriteTexture();
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8 });
      const sprite = new THREE.Sprite(mat);
      const radius = 3.2 + Math.random() * 1.2;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 2.4;
      sprite.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      sprite.scale.set(0.5, 0.125, 1);
      sprite.userData.angle = angle;
      sprite.userData.radius = radius;
      sprite.userData.height = height;
      sprite.userData.driftSpeed = 0.05 + Math.random() * 0.1;
      this.spriteGroup.add(sprite);
    }
    this.scene.add(this.spriteGroup);

    // --- dust particle field ---
    const dustCount = 400;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 3.5 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      dustPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x6fb8ff,
      size: 0.015,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dust);

    // --- GPU-driven avatar particle system (head/neck/shoulders) ---
    // All per-particle motion (scatter<->assembly interpolation, wobble)
    // happens in the vertex shader, so CPU cost per frame is just a couple
    // of uniform updates regardless of particle count — this is what keeps
    // it cheap enough to hold 60fps alongside bloom/chromatic
    // postprocessing and, when active, MediaPipe hand tracking. Coexists
    // with the restored orb shells/core/rings above per explicit user
    // request ("bring the orb ui back, when there was both orb and
    // avatar").
    const { positions: avatarTargets, warmth: avatarWarmth } =
      generateAvatarTargets(AVATAR_PARTICLE_COUNT);
    const avatarStarts = new Float32Array(AVATAR_PARTICLE_COUNT * 3);
    const avatarSeeds = new Float32Array(AVATAR_PARTICLE_COUNT);
    for (let i = 0; i < AVATAR_PARTICLE_COUNT; i++) {
      // All particles originate from one small, tight bright point (not a
      // wide random scatter) — matches the reference video, where assembly
      // starts as a single glowing dot that a stream of particles flows
      // out of and up into the silhouette, rather than a nebula condensing
      // in from everywhere on screen.
      const r = 0.35 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      avatarStarts[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      avatarStarts[i * 3 + 1] = -1.6 + r * Math.sin(phi) * Math.sin(theta);
      avatarStarts[i * 3 + 2] = r * Math.cos(phi);
      avatarSeeds[i] = Math.random();
    }

    const avatarGeo = new THREE.BufferGeometry();
    avatarGeo.setAttribute("position", new THREE.BufferAttribute(avatarStarts.slice(), 3));
    avatarGeo.setAttribute("aStart", new THREE.BufferAttribute(avatarStarts, 3));
    avatarGeo.setAttribute("aTarget", new THREE.BufferAttribute(avatarTargets, 3));
    avatarGeo.setAttribute("aSeed", new THREE.BufferAttribute(avatarSeeds, 1));
    avatarGeo.setAttribute("aWarmth", new THREE.BufferAttribute(avatarWarmth, 1));

    this.avatarMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: this.avatarProgress },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uAmplitude: { value: 0 },
        uColorCool: { value: new THREE.Color(this.params.avatarCool) },
        uColorWarm: { value: new THREE.Color(this.params.avatarWarm) },
        uOpacity: { value: 0.55 },
      },
      vertexShader: AVATAR_VERTEX_SHADER,
      fragmentShader: AVATAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.avatarParticles = new THREE.Points(avatarGeo, this.avatarMaterial);

    this.avatarGroup = new THREE.Group();
    this.avatarGroup.add(this.avatarParticles);
    this.avatarGroup.visible = false;
    this.scene.add(this.avatarGroup);

    // --- 3D Chibi Person Character Avatar ---
    this.chibiAvatar = new ChibiAvatar();
    this.chibiAvatar.group.position.set(0, -0.1, 0);
    this.scene.add(this.chibiAvatar.group);

    // --- scan / radar rings ---
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.RingGeometry(1.9 + i * 0.05, 1.95 + i * 0.05, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x4fd6ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2 + i * 0.3;
      mesh.userData.phase = i * Math.PI;
      this.scanRings.push(mesh);
      this.scene.add(mesh);
    }

    // --- LISTENING waveform pulse ring ---
    const waveGeo = new THREE.TorusGeometry(2.2, 0.015, 8, 96);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x4fd6ff,
      transparent: true,
      opacity: 0,
    });
    this.waveformRing = new THREE.Mesh(waveGeo, waveMat);
    this.waveformRing.rotation.x = Math.PI / 2;
    this.scene.add(this.waveformRing);

    // --- TOOL_EXECUTION secondary ring, visually distinct from scan rings ---
    const toolGeo = new THREE.TorusGeometry(1.6, 0.04, 8, 6);
    const toolMat = new THREE.MeshBasicMaterial({
      color: 0xffc24f,
      transparent: true,
      opacity: 0,
    });
    this.toolRing = new THREE.Mesh(toolGeo, toolMat);
    this.scene.add(this.toolRing);

    // --- ambient notification ring: slow breathing violet halo, shown
    // independent of orb state while something is waiting ---
    const notifyGeo = new THREE.TorusGeometry(2.35, 0.018, 8, 96);
    const notifyMat = new THREE.MeshBasicMaterial({
      color: 0xb98aff,
      transparent: true,
      opacity: 0,
    });
    this.notifyRing = new THREE.Mesh(notifyGeo, notifyMat);
    this.notifyRing.rotation.x = Math.PI / 2;
    this.scene.add(this.notifyRing);

    // --- holographic projection grid floor ---
    const gridGeo = new THREE.RingGeometry(0.6, 5.5, 64, 6);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    this.gridFloor = new THREE.Mesh(gridGeo, gridMat);
    this.gridFloor.rotation.x = Math.PI / 2;
    this.gridFloor.position.y = -2.1;
    this.scene.add(this.gridFloor);

    // --- outer rotating HUD telemetry reticle ring ---
    const hudRingGeo = new THREE.RingGeometry(2.36, 2.39, 72);
    const hudRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    this.hudRing = new THREE.Mesh(hudRingGeo, hudRingMat);
    this.hudRing.rotation.x = Math.PI / 2;
    this.scene.add(this.hudRing);

    // --- orbiting graph layer ---
    this.memoryGraphGroup = new THREE.Group();
    this.scene.add(this.memoryGraphGroup);

    this.camera.position.set(0, 0, this.zoom);
    this.camera.lookAt(0, 0, 0);
  }

  private buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight),
      0.9,
      0.6,
      0.15
    );
    this.composer.addPass(this.bloomPass);

    this.chromaticPass = new ShaderPass(CHROMATIC_ABERRATION_SHADER);
    this.composer.addPass(this.chromaticPass);

    this.composer.addPass(new OutputPass());
  }

  setState(state: OrbState) {
    this.state = state;
    this.params = STATE_PARAMS[state];
    this.coreMaterial.color.setHex(this.params.coreColor);
    this.coreMaterial.emissive.setHex(this.params.coreEmissive);
    this.bloomPass.strength = this.params.bloomStrength;

    if (this.chibiAvatar) {
      this.chibiAvatar.setState(state);
    }

    if (this.avatarMaterial) {
      this.avatarMaterial.uniforms.uColorCool.value.setHex(this.params.avatarCool);
      this.avatarMaterial.uniforms.uColorWarm.value.setHex(this.params.avatarWarm);
    }

    // Morph shells color subtly
    for (const shell of this.shells) {
      const mat = shell.material as THREE.MeshBasicMaterial;
      if (mat) mat.color.setHex(this.params.coreColor);
    }

    if (!this.avatarLocked && (state === "LISTENING" || state === "SPEAKING")) {
      this.avatarLocked = true;
    }
  }

  getState(): OrbState {
    return this.state;
  }

  /** Rolling 1s-window FPS, for the debug panel's performance readout. */
  getFps(): number {
    return this.fps;
  }

  /** Real audio amplitude hook (Web Audio AnalyserNode). Value 0..1. */
  setAmplitude(value: number) {
    this.amplitude = value;
    if (this.chibiAvatar) {
      this.chibiAvatar.setAmplitude(value);
    }
  }

  setAvatarTheme(theme: ChibiTheme) {
    this.chibiAvatar?.applyTheme(theme);
  }

  customizeAvatar(options: ChibiCustomization) {
    this.chibiAvatar?.customize(options);
  }

  getAvatarTheme(): ChibiTheme {
    return this.chibiAvatar?.getTheme() || "cyber_neon";
  }

  setRotationDelta(dx: number, dy: number) {
    this.targetRotationY += dx;
    this.targetRotationX += dy;
    this.targetRotationX = Math.max(-1.2, Math.min(1.2, this.targetRotationX));
  }

  setZoomDelta(delta: number) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom + delta));
  }

  resetView() {
    this.targetRotationX = 0.4;
    this.targetRotationY = 0;
    this.targetZoom = 6;
  }

  /** Call when an operation resolves, so the
   * ring flashes a distinct color for ~0.9s — green for a normal success,
   * amber for "needs your confirmation" (confirmation_required), red for
   * a real failure — instead of every tool result looking identical. */
  pulseToolResult(kind: "success" | "confirmation" | "error") {
    this.toolPulseUntil = this.elapsedTime + 0.9;
    this.toolPulseColor =
      kind === "error" ? 0xff4a3b : kind === "confirmation" ? 0xffc24f : 0x4fffb0;
  }

  /** Toggles the ambient "something is waiting"
   * breathing violet ring. Driven by the host app, independent of orb
   * state. */
  setProactivePending(pending: boolean) {
    this.proactivePending = pending;
  }

  /** Rebuilds the orbiting node/edge visualization wholesale from a
   * fresh snapshot (the host app supplies the data
   * periodically). Nodes are laid out on a shell just outside the
   * wireframe orb (radius ~2.7-3.3) using a golden-angle spiral for even
   * spacing, with a small per-node radius jitter (seeded off the node id,
   * so a given node doesn't visibly jump position between rebuilds even
   * though everything else is recomputed from scratch). Edges are drawn as
   * plain line segments between node positions. Rebuild (not diff) is the
   * deliberate simple choice — cheap enough at hundreds of nodes, and the
   * whole-group fade-in on each rebuild is itself the "living" cue rather
   * than tracking exactly which nodes are new. */
  setMemoryGraph(
    nodes: { id: number; label: string }[],
    edges: { from: number; to: number; relation: string }[]
  ) {
    if (!this.memoryGraphGroup) return;
    while (this.memoryGraphGroup.children.length > 0) {
      const child = this.memoryGraphGroup.children.pop()!;
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const mat = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
    this.memoryGraphMaterials = [];

    if (nodes.length === 0) {
      this.memoryGraphTargetOpacity = 0;
      return;
    }

    const positions = new Map<number, THREE.Vector3>();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((n, i) => {
      const t = nodes.length <= 1 ? 0 : i / (nodes.length - 1);
      const y = 1 - t * 2; // -1..1, evenly spread pole to pole
      const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      // seeded jitter off the node id (not the loop index) so a node's
      // shell radius stays stable across rebuilds even as the list shifts
      const jitter = ((n.id * 9301 + 49297) % 233280) / 233280;
      const shellR = 2.7 + jitter * 0.6;
      const pos = new THREE.Vector3(
        Math.cos(theta) * ringRadius * shellR,
        y * shellR * 0.6 + 0.9,
        Math.sin(theta) * ringRadius * shellR
      );
      positions.set(n.id, pos);

      // Small radius + moderate opacity — bloom amplifies even a tiny
      // bright point a lot at this scale, and confirmed live that 0.85
      // opacity blew each node out to a solid white blob, losing the
      // intended "small glowing dot" look.
      const geo = new THREE.IcosahedronGeometry(0.028, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6fa8c8,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.memoryGraphGroup.add(mesh);
      this.memoryGraphMaterials.push({ material: mat, targetOpacity: 0.55 });
    });

    const linePositions: number[] = [];
    for (const e of edges) {
      const a = positions.get(e.from);
      const b = positions.get(e.to);
      if (!a || !b) continue;
      linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    if (linePositions.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x4a6a8a,
        transparent: true,
        opacity: 0,
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      this.memoryGraphGroup.add(lines);
      this.memoryGraphMaterials.push({ material: lineMat, targetOpacity: 0.3 });
    }

    this.memoryGraphOpacity = 0;
    this.memoryGraphTargetOpacity = 1;
  }

  resize(width: number, height: number) {
    if (typeof window !== "undefined") {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  start() {
    this.lastTime = performance.now() * 0.001;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  private tick() {
    const now = performance.now() * 0.001;
    const dt = this.lastTime === 0 ? 0.016 : Math.min(now - this.lastTime, 0.1);
    this.lastTime = now;
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    this.fpsFrameCount++;
    if (t - this.fpsWindowStart >= 1) {
      this.fps = this.fpsFrameCount / (t - this.fpsWindowStart);
      this.fpsFrameCount = 0;
      this.fpsWindowStart = t;
    }

    // smooth camera orbit toward target rotation/zoom
    this.rotationX += (this.targetRotationX - this.rotationX) * 0.12;
    this.rotationY += (this.targetRotationY - this.rotationY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.15;

    this.camera.position.x = this.zoom * Math.sin(this.rotationY) * Math.cos(this.rotationX);
    this.camera.position.y = this.zoom * Math.sin(this.rotationX);
    this.camera.position.z = this.zoom * Math.cos(this.rotationY) * Math.cos(this.rotationX);
    this.camera.lookAt(0, 0, 0);

    // shells: independent rotation speeds, scaled by state
    for (const shell of this.shells) {
      const speed = (shell.userData.speed as number) * this.params.shellSpeed;
      shell.rotation.y += dt * speed;
      shell.rotation.x += dt * speed * 0.4;
    }

    // placeholder oscillation driving LISTENING/SPEAKING pulse until real
    // audio amplitude is wired via setAmplitude().
    this.fakeAmplitudeClock += dt;
    const usingRealAmplitude = this.amplitude > 0;
    const pulseSource = usingRealAmplitude
      ? this.amplitude
      : (Math.sin(this.fakeAmplitudeClock * 6) + 1) / 2;

    let coreScale = this.params.coreBaseScale;
    if (this.state === "LISTENING" || this.state === "SPEAKING") {
      coreScale += pulseSource * this.params.corePulse;
    } else {
      coreScale += Math.sin(t * 2) * this.params.corePulse * 0.3;
    }
    this.core.scale.setScalar(coreScale);
    this.core.rotation.y += dt * 0.3;
    this.core.rotation.x += dt * 0.15;

    // debris orbit
    for (const mesh of this.debrisGroup.children) {
      const speed = 0.3 * this.params.shellSpeed + 0.05;
      mesh.userData.angle += dt * speed;
      const angle = mesh.userData.angle as number;
      const radius = mesh.userData.radius as number;
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      mesh.position.y = (mesh.userData.yBase as number) + Math.sin(t + angle) * 0.08;
      mesh.rotation.x += dt;
      mesh.rotation.y += dt;
    }

    // code-fragment sprites drift, speed scaled by state (THINKING accelerates)
    for (const sprite of this.spriteGroup.children) {
      const driftSpeed = (sprite.userData.driftSpeed as number) * this.params.spriteSpeed;
      sprite.userData.angle += dt * driftSpeed;
      const angle = sprite.userData.angle as number;
      const radius = sprite.userData.radius as number;
      sprite.position.x = Math.cos(angle) * radius;
      sprite.position.z = Math.sin(angle) * radius;
      sprite.position.y = (sprite.userData.height as number) + Math.sin(t * 0.5 + angle) * 0.3;
    }

    // dust drift
    this.dust.rotation.y += dt * 0.02;

    // avatar particle assembly: smoothed toward the current target progress
    // (never snapped), plus slow ambient rotation while scattered so it
    // doesn't look static before assembling.
    const targetProgress = this.avatarLocked ? 1 : AVATAR_ASSEMBLY[this.state];
    this.avatarProgress += (targetProgress - this.avatarProgress) * dt * 1.5;
    this.avatarMaterial.uniforms.uProgress.value = this.avatarProgress;
    this.avatarMaterial.uniforms.uTime.value = t;
    this.avatarMaterial.uniforms.uAmplitude.value = pulseSource;
    this.avatarGroup.rotation.y += dt * 0.015 * (1 - this.avatarProgress);

    // Update 3D Chibi Avatar animations, lip sync, and gestures
    if (this.chibiAvatar) {
      this.chibiAvatar.update(dt, t);
    }

    // rotate holographic floor and telemetry HUD reticle ring
    if (this.gridFloor) this.gridFloor.rotation.z += dt * 0.035;
    if (this.hudRing) this.hudRing.rotation.z -= dt * 0.08;

    // scan rings sweep opacity, speed scaled by state
    for (const ring of this.scanRings) {
      const phase = (ring.userData.phase as number) + t * this.params.scanSpeed;
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, Math.sin(phase)) * 0.5;
      ring.scale.setScalar(1 + (Math.sin(phase * 0.5) + 1) * 0.15);
    }

    // LISTENING waveform ring
    const waveMat = this.waveformRing.material as THREE.MeshBasicMaterial;
    if (this.params.ringVisible) {
      waveMat.opacity = 0.25 + pulseSource * 0.5;
      this.waveformRing.scale.setScalar(1 + pulseSource * 0.08);
    } else {
      waveMat.opacity += (0 - waveMat.opacity) * 0.2;
    }

    // TOOL_EXECUTION distinct secondary ring — spins visibly, unlike scan rings
    const toolMat = this.toolRing.material as THREE.MeshBasicMaterial;
    const toolPulseActive = t < this.toolPulseUntil;
    if (this.params.toolRingVisible || toolPulseActive) {
      toolMat.opacity += (0.85 - toolMat.opacity) * 0.15;
      this.toolRing.rotation.z += dt * (toolPulseActive ? 6 : 2.5);
      this.toolRing.rotation.x += dt * 1.2;
    } else {
      toolMat.opacity += (0 - toolMat.opacity) * 0.15;
    }
    toolMat.color.setHex(toolPulseActive ? this.toolPulseColor : 0xffc24f);
    if (toolPulseActive) {
      const pulseScale = 1 + Math.max(0, this.toolPulseUntil - t) * 0.3;
      this.toolRing.scale.setScalar(pulseScale);
    } else {
      this.toolRing.scale.setScalar(1);
    }

    // ERROR: brief shell wireframe glitch/jitter
    if (this.params.glitch) {
      for (const shell of this.shells) {
        shell.position.set(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        );
      }
    } else {
      for (const shell of this.shells) {
        shell.position.set(0, 0, 0);
      }
    }

    const toolErrorPulse = toolPulseActive && this.toolPulseColor === 0xff4a3b;
    this.chromaticPass.uniforms.amount.value = this.params.glitch || toolErrorPulse ? 0.008 : 0.0025;

    // orbiting graph layer: slow ambient orbit (independent of camera/avatar
    // rotation) plus a smoothed fade whenever setMemoryGraph() rebuilds it
    if (this.memoryGraphGroup) {
      this.memoryGraphGroup.rotation.y += dt * 0.025;
      this.memoryGraphOpacity += (this.memoryGraphTargetOpacity - this.memoryGraphOpacity) * dt * 1.2;
      for (const { material, targetOpacity } of this.memoryGraphMaterials) {
        material.opacity = this.memoryGraphOpacity * targetOpacity;
      }
    }

    // ambient notification ring: slow breathing opacity while
    // pending, smoothed fade to fully invisible once not
    const notifyMat = this.notifyRing.material as THREE.MeshBasicMaterial;
    if (this.proactivePending) {
      notifyMat.opacity = 0.28 + Math.sin(t * 1.6) * 0.18;
      this.notifyRing.scale.setScalar(1 + Math.sin(t * 1.6) * 0.015);
      this.notifyRing.rotation.z += dt * 0.15;
    } else {
      notifyMat.opacity += (0 - notifyMat.opacity) * 0.1;
    }

    this.composer.render();
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Points ||
        obj instanceof THREE.Sprite ||
        obj instanceof THREE.LineSegments
      ) {
        obj.geometry?.dispose?.();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });
  }
}
