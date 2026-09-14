import * as THREE from "three";
import type { OrbState } from "./orbScene";

export type ChibiTheme = "cyber_neon" | "anime_girl" | "mecha_robot" | "cat_neko" | "stealth_ninja";
export type ChibiAction = "none" | "dance" | "spin" | "cheer" | "rage" | "sleep";

export interface ChibiCustomization {
  theme?: ChibiTheme;
  hairColor?: string | number;
  eyeColor?: string | number;
  outfitColor?: string | number;
  accentColor?: string | number;
}

export const CHIBI_THEMES: Record<
  ChibiTheme,
  {
    name: string;
    description: string;
    hairColor: number;
    eyeColor: number;
    outfitColor: number;
    accentColor: number;
    skinColor: number;
  }
> = {
  cyber_neon: {
    name: "Cyber Ashura",
    description: "Futuristic cyber assistant with neon visor and circuit hoodie",
    hairColor: 0x00e5ff,
    eyeColor: 0x00f0ff,
    outfitColor: 0x0f172a,
    accentColor: 0x00f0ff,
    skinColor: 0xffdfc4,
  },
  anime_girl: {
    name: "Anime Sakura",
    description: "Cute anime chibi with pastel twintails and cat headphones",
    hairColor: 0xf472b6,
    eyeColor: 0xec4899,
    outfitColor: 0x2e1065,
    accentColor: 0xf43f5e,
    skinColor: 0xffe4d6,
  },
  mecha_robot: {
    name: "Mecha Unit-01",
    description: "Advanced metallic robotic android with LED visor and arc chest",
    hairColor: 0x94a3b8,
    eyeColor: 0xfacc15,
    outfitColor: 0x1e293b,
    accentColor: 0xfacc15,
    skinColor: 0xcfd8dc,
  },
  cat_neko: {
    name: "Neko Chibi",
    description: "Playful feline chibi with animated cat ears and paw gloves",
    hairColor: 0xfb923c,
    eyeColor: 0x22c55e,
    outfitColor: 0x18181b,
    accentColor: 0xfbbf24,
    skinColor: 0xffdfc4,
  },
  stealth_ninja: {
    name: "Shadow Ninja",
    description: "Cybernetic shadow operative with crimson aura and scarf",
    hairColor: 0x1e1b4b,
    eyeColor: 0xef4444,
    outfitColor: 0x09090b,
    accentColor: 0xef4444,
    skinColor: 0xf5d0b5,
  },
};

export class ChibiAvatar {
  public group: THREE.Group = new THREE.Group();

  // Rig components
  private rootGroup: THREE.Group = new THREE.Group();
  private bodyGroup: THREE.Group = new THREE.Group();
  private headGroup: THREE.Group = new THREE.Group();
  private faceGroup: THREE.Group = new THREE.Group();
  private hairGroup: THREE.Group = new THREE.Group();
  private accessoriesGroup: THREE.Group = new THREE.Group();

  // Limbs
  private leftArmGroup: THREE.Group = new THREE.Group();
  private rightArmGroup: THREE.Group = new THREE.Group();
  private leftLegGroup: THREE.Group = new THREE.Group();
  private rightLegGroup: THREE.Group = new THREE.Group();

  // Animated facial features
  private leftEyelid!: THREE.Mesh;
  private rightEyelid!: THREE.Mesh;
  private mouthMesh!: THREE.Mesh;
  private leftEyePupil!: THREE.Mesh;
  private rightEyePupil!: THREE.Mesh;

  // Floating transformation particles
  private burstParticles!: THREE.Points;
  private burstActive = false;
  private burstProgress = 1;

  // Materials
  private skinMaterial!: THREE.MeshStandardMaterial;
  private hairMaterial!: THREE.MeshStandardMaterial;
  private eyeMaterial!: THREE.MeshStandardMaterial;
  private outfitMaterial!: THREE.MeshStandardMaterial;
  private accentMaterial!: THREE.MeshStandardMaterial;
  private metalMaterial!: THREE.MeshStandardMaterial;

  // State & animation variables
  private currentState: OrbState = "IDLE";
  private currentTheme: ChibiTheme = "cyber_neon";
  private amplitude = 0;
  private blinkTimer = 0;
  private isBlinking = false;
  private blinkDuration = 0.14;
  private nextBlinkInterval = 3;
  private currentAction: ChibiAction = "none";
  private actionTimer = 0;
  private actionDuration = 0;

  constructor() {
    this.initMaterials();
    this.buildRig();
    this.buildCharacter();
    this.buildBurstSystem();
    this.applyTheme("cyber_neon");
  }

  private initMaterials() {
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdfc4,
      roughness: 0.55,
      metalness: 0.05,
    });

    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.35,
      metalness: 0.15,
      emissive: 0x003344,
      emissiveIntensity: 0.3,
    });

    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a2ff,
      emissiveIntensity: 0.7,
      roughness: 0.1,
    });

    this.outfitMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.3,
    });

    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    this.metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.85,
    });
  }

  private buildRig() {
    this.group.add(this.rootGroup);
    this.rootGroup.position.set(0, 0, 0);

    this.rootGroup.add(this.bodyGroup);
    this.bodyGroup.position.set(0, -0.2, 0);

    this.bodyGroup.add(this.headGroup);
    this.headGroup.position.set(0, 0.75, 0);

    this.headGroup.add(this.faceGroup);
    this.headGroup.add(this.hairGroup);
    this.headGroup.add(this.accessoriesGroup);

    // Arms
    this.leftArmGroup.position.set(-0.45, 0.55, 0);
    this.rightArmGroup.position.set(0.45, 0.55, 0);
    this.bodyGroup.add(this.leftArmGroup);
    this.bodyGroup.add(this.rightArmGroup);

    // Legs
    this.leftLegGroup.position.set(-0.2, 0, 0);
    this.rightLegGroup.position.set(0.2, 0, 0);
    this.bodyGroup.add(this.leftLegGroup);
    this.bodyGroup.add(this.rightLegGroup);
  }

  private buildCharacter() {
    // 1. Chibi Head (Cute chubby cheeks, slightly flattened sphere)
    const headGeo = new THREE.SphereGeometry(0.58, 32, 28);
    headGeo.scale(1.05, 0.95, 1.0);
    const headMesh = new THREE.Mesh(headGeo, this.skinMaterial);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Cute chubby cheek highlights
    for (const side of [-1, 1]) {
      const blushGeo = new THREE.CircleGeometry(0.09, 16);
      const blushMat = new THREE.MeshBasicMaterial({
        color: 0xff6b8b,
        transparent: true,
        opacity: 0.55,
      });
      const blush = new THREE.Mesh(blushGeo, blushMat);
      blush.position.set(side * 0.32, -0.1, 0.51);
      blush.rotation.y = side * 0.3;
      this.faceGroup.add(blush);
    }

    // 2. Big Expressive Anime Eyes
    for (const side of [-1, 1]) {
      const eyeWhiteGeo = new THREE.SphereGeometry(0.13, 24, 24);
      eyeWhiteGeo.scale(0.85, 1.25, 0.4);
      const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
      eyeWhite.position.set(side * 0.22, 0.05, 0.49);
      eyeWhite.rotation.y = side * 0.15;
      this.faceGroup.add(eyeWhite);

      // Pupil / Iris
      const pupilGeo = new THREE.SphereGeometry(0.09, 20, 20);
      pupilGeo.scale(0.8, 1.1, 0.3);
      const pupil = new THREE.Mesh(pupilGeo, this.eyeMaterial);
      pupil.position.set(side * 0.22, 0.03, 0.53);
      pupil.rotation.y = side * 0.15;
      this.faceGroup.add(pupil);
      if (side === -1) this.leftEyePupil = pupil;
      else this.rightEyePupil = pupil;

      // Eye glimmer highlight (top shiny dot)
      const shineGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(side * 0.22 + 0.02, 0.08, 0.56);
      this.faceGroup.add(shine);

      // Eyelid for blinking
      const lidGeo = new THREE.SphereGeometry(0.14, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
      lidGeo.scale(0.9, 1.3, 0.45);
      const lid = new THREE.Mesh(lidGeo, this.skinMaterial);
      lid.position.set(side * 0.22, 0.05, 0.49);
      lid.rotation.x = -Math.PI * 0.5; // Starts open
      this.faceGroup.add(lid);
      if (side === -1) this.leftEyelid = lid;
      else this.rightEyelid = lid;
    }

    // 3. Animated Mouth (Lip sync & expressions)
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.06, 0);
    mouthShape.quadraticCurveTo(0, -0.05, 0.06, 0);
    mouthShape.quadraticCurveTo(0, -0.01, -0.06, 0);
    const mouthGeo = new THREE.ShapeGeometry(mouthShape);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x991b1b, side: THREE.DoubleSide });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.position.set(0, -0.18, 0.56);
    this.mouthMesh.scale.set(1, 1, 1);
    this.faceGroup.add(this.mouthMesh);

    // 4. Body (Cute stylized hoodie / cyber armor)
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.6, 24);
    const torso = new THREE.Mesh(torsoGeo, this.outfitMaterial);
    torso.position.set(0, 0.3, 0);
    this.bodyGroup.add(torso);

    // Glowing chest emblem / Arc reactor
    const emblemGeo = new THREE.CircleGeometry(0.08, 20);
    const emblem = new THREE.Mesh(emblemGeo, this.accentMaterial);
    emblem.position.set(0, 0.38, 0.28);
    this.bodyGroup.add(emblem);

    // Hoodie collar / neck trim
    const collarGeo = new THREE.TorusGeometry(0.26, 0.06, 12, 32);
    collarGeo.scale(1, 0.6, 1);
    const collar = new THREE.Mesh(collarGeo, this.accentMaterial);
    collar.position.set(0, 0.58, 0);
    collar.rotation.x = Math.PI * 0.5;
    this.bodyGroup.add(collar);

    // 5. Arms & Hands
    this.buildArm(this.leftArmGroup, -1);
    this.buildArm(this.rightArmGroup, 1);

    // 6. Legs & Hover Boots
    this.buildLeg(this.leftLegGroup);
    this.buildLeg(this.rightLegGroup);

    // 7. Hair & Accessories (built modularly by theme)
    this.rebuildHairAndAccessories();
  }

  private buildArm(armGroup: THREE.Group, side: number) {
    // Upper arm
    const upperGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.28, 16);
    const upper = new THREE.Mesh(upperGeo, this.outfitMaterial);
    upper.position.set(side * 0.06, -0.14, 0);
    armGroup.add(upper);

    // Forearm & sleeve cuff
    const cuffGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 16);
    const cuff = new THREE.Mesh(cuffGeo, this.accentMaterial);
    cuff.position.set(side * 0.06, -0.26, 0);
    armGroup.add(cuff);

    // Cute hand / mitten glove
    const handGeo = new THREE.SphereGeometry(0.08, 16, 16);
    handGeo.scale(1, 1.1, 0.9);
    const hand = new THREE.Mesh(handGeo, this.skinMaterial);
    hand.position.set(side * 0.06, -0.34, 0);
    armGroup.add(hand);
  }

  private buildLeg(legGroup: THREE.Group) {
    // Thigh
    const legGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.35, 16);
    const leg = new THREE.Mesh(legGeo, this.outfitMaterial);
    leg.position.set(0, -0.18, 0);
    legGroup.add(leg);

    // Cute hover boot
    const bootGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 16);
    bootGeo.scale(1, 1, 1.2);
    const boot = new THREE.Mesh(bootGeo, this.metalMaterial);
    boot.position.set(0, -0.4, 0.03);
    legGroup.add(boot);

    // Thruster ring at bottom of boot
    const thrusterGeo = new THREE.TorusGeometry(0.09, 0.025, 8, 20);
    thrusterGeo.scale(1, 1, 0.7);
    const thruster = new THREE.Mesh(thrusterGeo, this.accentMaterial);
    thruster.position.set(0, -0.5, 0.03);
    thruster.rotation.x = Math.PI * 0.5;
    legGroup.add(thruster);
  }

  private rebuildHairAndAccessories() {
    // Clear existing hair & accessories
    while (this.hairGroup.children.length > 0) {
      const child = this.hairGroup.children.pop()!;
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    while (this.accessoriesGroup.children.length > 0) {
      const child = this.accessoriesGroup.children.pop()!;
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }

    if (this.currentTheme === "cyber_neon") {
      // Cyber spiky bangs + rear hair
      this.buildSpikyHair();

      // Cyber Visor / Headset
      const visorGeo = new THREE.TorusGeometry(0.57, 0.05, 8, 32, Math.PI * 0.85);
      const visor = new THREE.Mesh(visorGeo, this.accentMaterial);
      visor.position.set(0, 0.1, 0.15);
      visor.rotation.x = 0.25;
      visor.rotation.z = Math.PI * 0.08;
      this.accessoriesGroup.add(visor);

      // Ear comms node
      for (const side of [-1, 1]) {
        const commGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
        const comm = new THREE.Mesh(commGeo, this.metalMaterial);
        comm.position.set(side * 0.56, 0.05, 0.1);
        comm.rotation.z = Math.PI * 0.5;
        this.accessoriesGroup.add(comm);
      }
    } else if (this.currentTheme === "anime_girl") {
      // Twintails + bangs
      this.buildAnimeTwintails();

      // Neko / Cat-ear headphones
      const bandGeo = new THREE.TorusGeometry(0.6, 0.04, 8, 32, Math.PI);
      const band = new THREE.Mesh(bandGeo, this.accentMaterial);
      band.position.set(0, 0.05, 0);
      band.rotation.x = Math.PI * 0.5;
      this.accessoriesGroup.add(band);

      for (const side of [-1, 1]) {
        const earCupGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
        const earCup = new THREE.Mesh(earCupGeo, this.outfitMaterial);
        earCup.position.set(side * 0.58, 0.05, 0);
        earCup.rotation.z = Math.PI * 0.5;
        this.accessoriesGroup.add(earCup);

        // Cat ear tip on headphone
        const catTipGeo = new THREE.ConeGeometry(0.12, 0.22, 4);
        const catTip = new THREE.Mesh(catTipGeo, this.accentMaterial);
        catTip.position.set(side * 0.35, 0.65, 0);
        catTip.rotation.z = -side * 0.2;
        this.accessoriesGroup.add(catTip);
      }
    } else if (this.currentTheme === "mecha_robot") {
      // Android helm with antenna
      this.buildMechaHelm();

      // Holographic glowing forehead badge
      const badgeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.04);
      const badge = new THREE.Mesh(badgeGeo, this.accentMaterial);
      badge.position.set(0, 0.42, 0.54);
      this.accessoriesGroup.add(badge);
    } else if (this.currentTheme === "cat_neko") {
      // Fluffy bob hair with real cat ears
      this.buildBobHair();

      // Fluffy 3D cat ears
      for (const side of [-1, 1]) {
        const earGeo = new THREE.ConeGeometry(0.16, 0.32, 4);
        const ear = new THREE.Mesh(earGeo, this.hairMaterial);
        ear.position.set(side * 0.38, 0.62, 0.05);
        ear.rotation.z = -side * 0.3;
        ear.rotation.y = side * 0.2;
        this.accessoriesGroup.add(ear);

        // Inner pink ear
        const innerEarGeo = new THREE.ConeGeometry(0.1, 0.22, 4);
        const innerEarMat = new THREE.MeshBasicMaterial({ color: 0xffa0b8 });
        const innerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
        innerEar.position.set(side * 0.38, 0.61, 0.08);
        innerEar.rotation.z = -side * 0.3;
        innerEar.rotation.y = side * 0.2;
        this.accessoriesGroup.add(innerEar);
      }

      // Playful tail
      const tailCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0.1, -0.2),
        new THREE.Vector3(0, 0.2, -0.5),
        new THREE.Vector3(0.15, 0.4, -0.6),
        new THREE.Vector3(0.2, 0.6, -0.45)
      );
      const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.045, 8, false);
      const tail = new THREE.Mesh(tailGeo, this.hairMaterial);
      this.bodyGroup.add(tail);
    } else if (this.currentTheme === "stealth_ninja") {
      // Slick ponytail + glowing ninja scarf
      this.buildNinjaHair();

      // Holographic cyber scarf
      const scarfGeo = new THREE.TorusGeometry(0.3, 0.08, 12, 24);
      const scarf = new THREE.Mesh(scarfGeo, this.accentMaterial);
      scarf.position.set(0, 0.6, 0.05);
      scarf.rotation.x = Math.PI * 0.45;
      this.accessoriesGroup.add(scarf);
    }
  }

  private buildSpikyHair() {
    // Hair base cap
    const capGeo = new THREE.SphereGeometry(0.61, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const cap = new THREE.Mesh(capGeo, this.hairMaterial);
    cap.position.set(0, 0.04, -0.02);
    this.hairGroup.add(cap);

    // Front spiky locks
    const locks = [
      { x: 0, y: 0.45, z: 0.54, rotZ: 0, scale: 1.1 },
      { x: -0.22, y: 0.42, z: 0.5, rotZ: 0.25, scale: 0.95 },
      { x: 0.22, y: 0.42, z: 0.5, rotZ: -0.25, scale: 0.95 },
      { x: -0.4, y: 0.35, z: 0.38, rotZ: 0.5, scale: 0.8 },
      { x: 0.4, y: 0.35, z: 0.38, rotZ: -0.5, scale: 0.8 },
    ];
    for (const lock of locks) {
      const coneGeo = new THREE.ConeGeometry(0.12 * lock.scale, 0.35 * lock.scale, 5);
      coneGeo.rotateX(Math.PI);
      const cone = new THREE.Mesh(coneGeo, this.hairMaterial);
      cone.position.set(lock.x, lock.y, lock.z);
      cone.rotation.z = lock.rotZ;
      this.hairGroup.add(cone);
    }
  }

  private buildAnimeTwintails() {
    // Hair cap with fringe
    const capGeo = new THREE.SphereGeometry(0.61, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const cap = new THREE.Mesh(capGeo, this.hairMaterial);
    cap.position.set(0, 0.03, -0.02);
    this.hairGroup.add(cap);

    // Bangs
    for (let i = -3; i <= 3; i++) {
      const bangGeo = new THREE.ConeGeometry(0.09, 0.28, 4);
      bangGeo.rotateX(Math.PI);
      const bang = new THREE.Mesh(bangGeo, this.hairMaterial);
      bang.position.set(i * 0.11, 0.44 - Math.abs(i) * 0.03, 0.52 - Math.abs(i) * 0.02);
      bang.rotation.z = -i * 0.08;
      this.hairGroup.add(bang);
    }

    // Huge cute twintails
    for (const side of [-1, 1]) {
      const tailCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(side * 0.5, 0.35, 0),
        new THREE.Vector3(side * 0.85, 0.2, 0.1),
        new THREE.Vector3(side * 0.75, -0.4, 0.15),
        new THREE.Vector3(side * 0.65, -0.9, 0.05)
      );
      const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.1, 8, false);
      const tail = new THREE.Mesh(tailGeo, this.hairMaterial);
      this.hairGroup.add(tail);

      // Ribbon / Hair tie
      const tieGeo = new THREE.TorusGeometry(0.12, 0.035, 8, 16);
      const tie = new THREE.Mesh(tieGeo, this.accentMaterial);
      tie.position.set(side * 0.52, 0.35, 0);
      this.hairGroup.add(tie);
    }
  }

  private buildMechaHelm() {
    // Armored skull plates
    const helmGeo = new THREE.SphereGeometry(0.62, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const helm = new THREE.Mesh(helmGeo, this.metalMaterial);
    helm.position.set(0, 0.04, -0.01);
    this.hairGroup.add(helm);

    // Top crest
    const crestGeo = new THREE.BoxGeometry(0.08, 0.22, 0.7);
    const crest = new THREE.Mesh(crestGeo, this.accentMaterial);
    crest.position.set(0, 0.6, 0.05);
    this.hairGroup.add(crest);

    // Twin side antennae
    for (const side of [-1, 1]) {
      const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
      const ant = new THREE.Mesh(antGeo, this.metalMaterial);
      ant.position.set(side * 0.48, 0.45, 0);
      ant.rotation.z = -side * 0.4;
      this.accessoriesGroup.add(ant);

      const tipGeo = new THREE.SphereGeometry(0.04, 12, 12);
      const tip = new THREE.Mesh(tipGeo, this.accentMaterial);
      tip.position.set(side * 0.56, 0.62, 0);
      this.accessoriesGroup.add(tip);
    }
  }

  private buildBobHair() {
    const capGeo = new THREE.SphereGeometry(0.62, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.75);
    const cap = new THREE.Mesh(capGeo, this.hairMaterial);
    cap.position.set(0, 0.03, -0.03);
    this.hairGroup.add(cap);

    // Front fringe
    for (let i = -2; i <= 2; i++) {
      const bangGeo = new THREE.ConeGeometry(0.12, 0.24, 4);
      bangGeo.rotateX(Math.PI);
      const bang = new THREE.Mesh(bangGeo, this.hairMaterial);
      bang.position.set(i * 0.14, 0.42, 0.53);
      this.hairGroup.add(bang);
    }
  }

  private buildNinjaHair() {
    const capGeo = new THREE.SphereGeometry(0.61, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const cap = new THREE.Mesh(capGeo, this.hairMaterial);
    cap.position.set(0, 0.02, -0.02);
    this.hairGroup.add(cap);

    // High ponytail
    const ponyGeo = new THREE.ConeGeometry(0.16, 0.7, 8);
    ponyGeo.rotateX(-Math.PI * 0.35);
    const pony = new THREE.Mesh(ponyGeo, this.hairMaterial);
    pony.position.set(0, 0.45, -0.55);
    this.hairGroup.add(pony);
  }

  private buildBurstSystem() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.2 + Math.random() * 2.5;

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      velocities[i * 3 + 2] = Math.cos(phi) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.06,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    this.burstParticles = new THREE.Points(geo, mat);
    this.group.add(this.burstParticles);
  }

  public triggerTransformationBurst(color: number) {
    this.burstActive = true;
    this.burstProgress = 0;
    (this.burstParticles.material as THREE.PointsMaterial).color.setHex(color);
    (this.burstParticles.material as THREE.PointsMaterial).opacity = 1;

    // Reset positions
    const pos = this.burstParticles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) {
      pos[i] = 0;
    }
    this.burstParticles.geometry.attributes.position.needsUpdate = true;
  }

  public applyTheme(themeName: ChibiTheme) {
    if (!CHIBI_THEMES[themeName]) return;
    this.currentTheme = themeName;
    const theme = CHIBI_THEMES[themeName];

    this.hairMaterial.color.setHex(theme.hairColor);
    this.eyeMaterial.color.setHex(theme.eyeColor);
    this.eyeMaterial.emissive.setHex(theme.eyeColor);
    this.outfitMaterial.color.setHex(theme.outfitColor);
    this.accentMaterial.color.setHex(theme.accentColor);
    this.accentMaterial.emissive.setHex(theme.accentColor);
    this.skinMaterial.color.setHex(theme.skinColor);

    this.rebuildHairAndAccessories();
    this.triggerTransformationBurst(theme.accentColor);
  }

  public customize(options: ChibiCustomization) {
    if (options.theme && options.theme !== this.currentTheme) {
      this.applyTheme(options.theme);
    }
    if (options.hairColor !== undefined) {
      this.hairMaterial.color.set(options.hairColor);
    }
    if (options.eyeColor !== undefined) {
      this.eyeMaterial.color.set(options.eyeColor);
      this.eyeMaterial.emissive.set(options.eyeColor);
    }
    if (options.outfitColor !== undefined) {
      this.outfitMaterial.color.set(options.outfitColor);
    }
    if (options.accentColor !== undefined) {
      this.accentMaterial.color.set(options.accentColor);
      this.accentMaterial.emissive.set(options.accentColor);
    }
    this.triggerTransformationBurst(0x00f0ff);
  }

  public triggerAction(action: ChibiAction, durationSec = 4) {
    this.currentAction = action;
    this.actionTimer = 0;
    this.actionDuration = durationSec;
    if (action === "spin" || action === "cheer" || action === "dance") {
      const themeConfig = CHIBI_THEMES[this.currentTheme];
      this.triggerTransformationBurst(themeConfig ? themeConfig.accentColor : 0x00f0ff);
    }
  }

  public getAction(): ChibiAction {
    return this.currentAction;
  }

  public getTheme(): ChibiTheme {
    return this.currentTheme;
  }

  public setState(state: OrbState) {
    this.currentState = state;
  }

  public setAmplitude(amp: number) {
    this.amplitude = amp;
  }

  public update(dt: number, t: number) {
    // 1. Zero-G floating hovering bob & subtle tilt
    const hoverY = Math.sin(t * 2.2) * 0.08;
    const swayX = Math.sin(t * 1.4) * 0.03;
    const tiltZ = Math.sin(t * 1.8) * 0.025;

    this.rootGroup.position.y = hoverY;
    this.rootGroup.position.x = swayX;
    this.rootGroup.rotation.z = tiltZ;

    // 2. Natural Breathing animation on torso
    const breath = Math.sin(t * 3.5) * 0.02;
    this.bodyGroup.scale.set(1 + breath, 1 + breath * 0.6, 1 + breath);

    // 3. Eye Blinking Logic
    this.blinkTimer += dt;
    if (this.isBlinking) {
      if (this.blinkTimer >= this.blinkDuration) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2.5 + Math.random() * 3.5;
        this.leftEyelid.rotation.x = -Math.PI * 0.5;
        this.rightEyelid.rotation.x = -Math.PI * 0.5;
      } else {
        // Closed
        this.leftEyelid.rotation.x = 0;
        this.rightEyelid.rotation.x = 0;
      }
    } else if (this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    // 4. Lip Sync / Mouth Animation
    if (this.currentState === "SPEAKING") {
      const openAmount = Math.max(0.1, Math.min(1.4, this.amplitude * 4.5 + Math.sin(t * 14) * 0.35));
      this.mouthMesh.scale.set(1.1, openAmount, 1);
    } else if (this.currentState === "LISTENING") {
      this.mouthMesh.scale.set(0.9, 0.4, 1); // Focused slight "O"
    } else if (this.currentState === "ERROR") {
      this.mouthMesh.scale.set(1.2, 0.2, 1); // Flat worried line
    } else {
      this.mouthMesh.scale.set(1, 0.35, 1); // Subtle cute smile
    }

    // 5. Action or State-Based Poses & Gestures
    if (this.currentAction !== "none") {
      this.actionTimer += dt;
      if (this.actionTimer >= this.actionDuration) {
        this.currentAction = "none";
        this.rootGroup.rotation.y = 0;
      } else {
        this.animateActionPoses(dt, t, hoverY);
      }
    } else {
      this.animateStatePoses(dt, t);
    }

    // 6. Transformation burst update
    if (this.burstActive) {
      this.burstProgress += dt * 1.8;
      const pos = this.burstParticles.geometry.attributes.position.array as Float32Array;
      const vel = this.burstParticles.geometry.attributes.velocity.array as Float32Array;

      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      this.burstParticles.geometry.attributes.position.needsUpdate = true;
      const mat = this.burstParticles.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - this.burstProgress);

      if (this.burstProgress >= 1) {
        this.burstActive = false;
        mat.opacity = 0;
      }
    }
  }

  private animateActionPoses(dt: number, t: number, hoverY: number) {
    const lerpSpeed = dt * 8.0;
    switch (this.currentAction) {
      case "dance": {
        // Rhythmic side-to-side torso groove
        this.rootGroup.position.x = THREE.MathUtils.lerp(this.rootGroup.position.x, Math.sin(t * 7) * 0.2, lerpSpeed);
        this.rootGroup.rotation.z = THREE.MathUtils.lerp(this.rootGroup.rotation.z, Math.sin(t * 7) * 0.15, lerpSpeed);

        // Head bounce with rhythm
        this.headGroup.rotation.z = -Math.sin(t * 7) * 0.18;
        this.headGroup.rotation.x = Math.abs(Math.sin(t * 7)) * 0.14;

        // Alternating arm pump
        const armL = Math.sin(t * 7) * 0.7 + 1.2;
        const armR = -Math.sin(t * 7) * 0.7 + 1.2;
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, armL, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, armR, lerpSpeed);
        this.leftArmGroup.rotation.z = 0.55;
        this.rightArmGroup.rotation.z = -0.55;

        // Bouncing legs
        this.leftLegGroup.rotation.x = Math.sin(t * 7) * 0.3;
        this.rightLegGroup.rotation.x = -Math.sin(t * 7) * 0.3;
        this.mouthMesh.scale.set(1.2, 0.7, 1);
        break;
      }
      case "spin": {
        const progress = Math.min(1, this.actionTimer / Math.max(0.1, this.actionDuration));
        this.rootGroup.rotation.y = progress * Math.PI * 4;
        this.rootGroup.position.y = hoverY + Math.sin(progress * Math.PI) * 0.5;

        // Pirouette outstretched arms
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 1.2, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -1.2, lerpSpeed);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0, lerpSpeed);
        break;
      }
      case "cheer": {
        const jumpY = Math.abs(Math.sin(t * 11)) * 0.38;
        this.rootGroup.position.y = hoverY + jumpY;

        // Both arms raised high in triumph
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 2.4, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 2.4, lerpSpeed);
        this.leftArmGroup.rotation.z = 0.5 + Math.sin(t * 11) * 0.15;
        this.rightArmGroup.rotation.z = -0.5 - Math.sin(t * 11) * 0.15;

        this.headGroup.rotation.x = -0.18;
        this.mouthMesh.scale.set(1.3, 1.1, 1);
        break;
      }
      case "rage": {
        // High frequency vibration
        this.rootGroup.position.x = (Math.random() - 0.5) * 0.08;
        this.rootGroup.position.y = hoverY + (Math.random() - 0.5) * 0.08;

        // Clenched combat arms
        this.leftArmGroup.rotation.x = 1.4 + Math.sin(t * 22) * 0.1;
        this.rightArmGroup.rotation.x = 1.4 + Math.cos(t * 22) * 0.1;
        this.headGroup.rotation.x = 0.2;
        this.mouthMesh.scale.set(1.4, 0.2, 1);
        break;
      }
      case "sleep": {
        this.rootGroup.position.y = hoverY - 0.15;
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.35, lerpSpeed);
        this.leftEyelid.rotation.x = 0;
        this.rightEyelid.rotation.x = 0;
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.1, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0.1, lerpSpeed);
        this.mouthMesh.scale.set(0.7, 0.2, 1);
        break;
      }
    }
  }

  private animateStatePoses(dt: number, t: number) {
    const lerpSpeed = dt * 6.5;

    switch (this.currentState) {
      case "LISTENING":
        // Curious attentive lean forward, head tilted sideways
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.16, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0.14, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0.1, lerpSpeed);

        // Arms perked up slightly
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.35, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0.35, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.15, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.15, lerpSpeed);
        break;

      case "THINKING":
        // Pondering pose: head tilted up, right hand touching chin
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.18, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, -0.22, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, -0.08, lerpSpeed);

        // Right arm raised to chin
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 1.8, lerpSpeed);
        this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, -0.4, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.5, lerpSpeed);

        // Left arm tucked relaxed
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.2, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.2, lerpSpeed);
        break;

      case "SPEAKING":
        // Expressive talking head nod
        const headNod = Math.sin(t * 6) * 0.08;
        const headSway = Math.sin(t * 3) * 0.06;
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, headNod, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, headSway, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0, lerpSpeed);

        // Expressive conversational arm gestures
        const leftArmWave = 0.4 + Math.sin(t * 4.5) * 0.25;
        const rightArmWave = 0.5 + Math.cos(t * 4.2) * 0.25;
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, leftArmWave, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, rightArmWave, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.35, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.35, lerpSpeed);
        break;

      case "TOOL_EXECUTION":
        // High-tech holographic typing in air with both hands
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.1, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0, lerpSpeed);

        const typeL = 1.1 + Math.sin(t * 16) * 0.12;
        const typeR = 1.1 + Math.cos(t * 16) * 0.12;
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, typeL, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, typeR, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.2, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.2, lerpSpeed);
        break;

      case "ERROR":
        // Dizzy / worried head shake
        const dizzy = Math.sin(t * 18) * 0.12;
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.12, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, dizzy, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, -0.1, lerpSpeed);

        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.8, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0.8, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.5, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.5, lerpSpeed);
        break;

      case "IDLE":
      default:
        // Relaxed idle floating pose
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, lerpSpeed);
        this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0, lerpSpeed);

        const idleArmSway = Math.sin(t * 1.8) * 0.08;
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, idleArmSway, lerpSpeed);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, -idleArmSway, lerpSpeed);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0.18, lerpSpeed);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, -0.18, lerpSpeed);
        break;
    }

    // Legs gentle float sway
    const legSwayL = Math.sin(t * 2.0) * 0.08;
    const legSwayR = -legSwayL;
    this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, legSwayL, lerpSpeed);
    this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, legSwayR, lerpSpeed);
  }
}
