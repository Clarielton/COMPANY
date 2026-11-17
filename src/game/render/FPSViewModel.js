import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { clamp, lerp } from '../core/math.js';

export class FPSViewModel {
  constructor() {
    this.root = new THREE.Group();
    // Renderiza sempre à frente sem cortar em paredes próximas
    this.root.renderOrder = 999;

    this.rig = new THREE.Group();
    this.root.add(this.rig);

    this.time = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.adsFactor = 0;
    this.currentWeaponId = null;

    this._initMaterials();
    this._buildArms();
    this._buildWeaponModels();
    this._applyDepthSettings(this.root);
  }

  _initMaterials() {
    this.mat = {
      sleeve: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.7, metalness: 0.1 }),
      sleeveTrim: new THREE.MeshBasicMaterial({ color: '#00f5d4' }),
      glove: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6, metalness: 0.2 }),
      knuckle: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.5 }),
      skin: new THREE.MeshStandardMaterial({ color: '#d6b296', roughness: 0.65 }),
      gunDark: new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.35, metalness: 0.75 }),
      gunSteel: new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.28, metalness: 0.85 }),
      gunChrome: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.18, metalness: 0.92 }),
      wood: new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.65, metalness: 0.1 }),
      olive: new THREE.MeshStandardMaterial({ color: '#365314', roughness: 0.55, metalness: 0.3 }),
      orangeTrim: new THREE.MeshBasicMaterial({ color: '#f97316' }),
      sightDot: new THREE.MeshBasicMaterial({ color: '#22c55e' }),
      holoReticle: new THREE.MeshBasicMaterial({ color: '#ef4444', side: THREE.DoubleSide }),
      holoGlass: new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
      muzzle: new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
      taserArc: new THREE.MeshBasicMaterial({ color: '#38bdf8' }),
    };
  }

  _buildArms() {
    this.rightArm = this._createArm(1);
    this.leftArm = this._createArm(-1);
    this.rig.add(this.rightArm);
    this.rig.add(this.leftArm);
  }

  _createArm(side) {
    // side: 1 = direito, -1 = esquerdo
    const group = new THREE.Group();

    // Antebraço com manga de jaqueta tática
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 4.6), this.mat.sleeve);
    sleeve.position.set(0, 0, 2.6);
    group.add(sleeve);

    // Punho com faixa neon ciano
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.22), this.mat.sleeveTrim);
    cuff.position.set(0, 0, 0.35);
    group.add(cuff);

    // Relógio tático no braço esquerdo
    if (side === -1) {
      const watch = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.14, 0.35), this.mat.gunDark);
      watch.position.set(0, 0, 0.65);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.25), this.mat.sleeveTrim);
      screen.position.set(0, 0.58, 0.65);
      group.add(watch, screen);
    }

    // Mão com luva tática
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.88, 1.25), this.mat.glove);
    palm.position.set(0, -0.02, -0.35);
    group.add(palm);

    // Protetor rígido nos nós dos dedos
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.3, 0.45), this.mat.knuckle);
    knuckle.position.set(0, 0.38, -0.68);
    group.add(knuckle);

    // Dedos dobrados
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.68, 0.55), this.mat.glove);
    fingers.position.set(0, -0.08, -1.05);
    group.add(fingers);

    // Polegar
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.65), this.mat.glove);
    thumb.position.set(-side * 0.52, 0.14, -0.55);
    thumb.rotation.y = side * 0.35;
    group.add(thumb);

    return group;
  }

  _buildWeaponModels() {
    this.weaponPivot = new THREE.Group();
    this.rig.add(this.weaponPivot);
    this.models = {};

    // Clarão de disparo 3D compartilhado
    this.muzzleFlash = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), this.mat.muzzle);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), this.mat.muzzle);
    p2.rotation.z = Math.PI / 4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), this.mat.muzzle);
    this.muzzleFlash.add(p1, p2, core);
    this.muzzleFlash.visible = false;
    this.weaponPivot.add(this.muzzleFlash);

    this.models.fists = this._createFistsModel();
    this.models.bat = this._createBatModel();
    this.models.knife = this._createKnifeModel();
    this.models.pistol = this._createPistolModel();
    this.models.uzi = this._createUziModel();
    this.models.mp5 = this._createMp5Model();
    this.models.shotgun = this._createShotgunModel();
    this.models.ak47 = this._createAk47Model();
    this.models.m4 = this._createM4Model();
    this.models.grenade = this._createGrenadeModel();

    for (const m of Object.values(this.models)) {
      m.visible = false;
      this.weaponPivot.add(m);
    }
  }

  _createFistsModel() {
    const g = new THREE.Group();
    // Módulo Taser compacto na mão direita
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.2), this.mat.gunDark);
    body.position.set(0, 0.1, -0.8);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.8), this.mat.orangeTrim);
    stripe.position.set(0, 0.12, -0.8);
    const prongL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35), this.mat.gunChrome);
    prongL.rotation.x = Math.PI / 2;
    prongL.position.set(-0.14, 0.12, -1.5);
    const prongR = prongL.clone();
    prongR.position.x = 0.14;
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.08), this.mat.taserArc);
    arc.position.set(0, 0.12, -1.65);
    arc.visible = false;
    g.add(body, stripe, prongL, prongR, arc);
    g.userData = { arc, muzzleZ: -1.7 };
    return g;
  }

  _createBatModel() {
    const g = new THREE.Group();
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.16, 6.2, 12), this.mat.wood);
    bat.position.set(0, 2.2, -1.2);
    bat.rotation.x = -0.35;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 10), this.mat.gunDark);
    grip.position.set(0, 0.1, -0.4);
    grip.rotation.x = -0.35;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12), this.mat.gunSteel);
    ring.position.set(0, 3.6, -1.7);
    ring.rotation.x = -0.35;
    g.add(bat, grip, ring);
    g.userData = { muzzleZ: -2.0 };
    return g;
  }

  _createKnifeModel() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 1.35), this.mat.gunDark);
    handle.position.set(0, 0.1, -0.5);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.75, 0.14), this.mat.gunSteel);
    guard.position.set(0, 0.12, -1.2);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 1.85), this.mat.gunChrome);
    blade.position.set(0, 0.14, -2.15);
    g.add(handle, guard, blade);
    g.userData = { muzzleZ: -2.5 };
    return g;
  }

  _createPistolModel() {
    const g = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.25, 0.68), this.mat.gunDark);
    grip.position.set(0, -0.35, -0.2);
    grip.rotation.x = 0.22;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 2.3), this.mat.gunDark);
    frame.position.set(0, 0.28, -0.85);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 2.35), this.mat.gunSteel);
    slide.position.set(0, 0.56, -0.85);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.5, 10), this.mat.gunChrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.52, -0.98);

    const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.12), this.mat.sightDot);
    sightR.position.set(0, 0.82, 0.18);
    const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), this.mat.sightDot);
    sightF.position.set(0, 0.82, -1.9);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.15, 0.52), this.mat.gunSteel);
    mag.position.set(0, -0.45, -0.22);
    mag.rotation.x = 0.22;

    g.add(grip, frame, slide, barrel, sightR, sightF, mag);
    g.userData = { slide, mag, magBasePos: mag.position.clone(), muzzleZ: -2.25 };
    return g;
  }

  _createUziModel() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 2.7), this.mat.gunDark);
    receiver.position.set(0, 0.45, -0.95);

    const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 2.5), this.mat.gunSteel);
    topCover.position.set(0, 0.88, -0.95);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 10), this.mat.gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.48, -2.55);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.25, 0.65), this.mat.gunDark);
    grip.position.set(0, -0.35, -0.75);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.95, 0.46), this.mat.gunSteel);
    mag.position.set(0, -0.85, -0.75);

    g.add(receiver, topCover, barrel, grip, mag);
    g.userData = { slide: topCover, mag, magBasePos: mag.position.clone(), muzzleZ: -3.2 };
    return g;
  }

  _createMp5Model() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 3.6), this.mat.gunDark);
    body.position.set(0, 0.42, -1.35);

    const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.8, 10), this.mat.gunSteel);
    handguard.rotation.x = Math.PI / 2;
    handguard.position.set(0, 0.36, -2.6);

    const railTrim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 1.6), this.mat.orangeTrim);
    railTrim.position.set(0, 0.74, -2.4);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 10), this.mat.gunChrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.42, -3.7);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.15, 0.6), this.mat.gunDark);
    grip.position.set(0, -0.32, -0.35);
    grip.rotation.x = 0.25;

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.65, 0.46), this.mat.gunSteel);
    mag.position.set(0, -0.58, -1.75);
    mag.rotation.x = -0.22;

    const sight = this._createHoloSight();
    sight.position.set(0, 0.92, -0.95);

    g.add(body, handguard, railTrim, barrel, grip, mag, sight);
    g.userData = { mag, magBasePos: mag.position.clone(), muzzleZ: -4.25 };
    return g;
  }

  _createShotgunModel() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 2.4), this.mat.gunSteel);
    receiver.position.set(0, 0.38, -0.9);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 1.8), this.mat.wood);
    stock.position.set(0, 0.12, 0.9);
    stock.rotation.x = 0.14;

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 12), this.mat.gunDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.56, -3.6);

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.8, 12), this.mat.gunSteel);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.28, -3.3);

    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 10), this.mat.wood);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, 0.28, -2.85);

    g.add(receiver, stock, barrel, tube, pump);
    g.userData = { slide: pump, mag: pump, magBasePos: pump.position.clone(), muzzleZ: -5.85 };
    return g;
  }

  _createAk47Model() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 2.8), this.mat.gunDark);
    receiver.position.set(0, 0.38, -1.1);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 1.8), this.mat.wood);
    stock.position.set(0, 0.18, 1.0);
    stock.rotation.x = 0.12;

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 1.85), this.mat.wood);
    handguard.position.set(0, 0.36, -3.2);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), this.mat.gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.44, -4.6);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.55), this.mat.wood);
    grip.position.set(0, -0.35, -0.2);
    grip.rotation.x = 0.24;

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.8, 0.62), this.mat.gunSteel);
    mag.position.set(0, -0.68, -1.75);
    mag.rotation.x = -0.32;

    const sight = this._createHoloSight();
    sight.position.set(0, 0.88, -1.0);

    g.add(receiver, stock, handguard, barrel, grip, mag, sight);
    g.userData = { mag, magBasePos: mag.position.clone(), muzzleZ: -5.9 };
    return g;
  }

  _createM4Model() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.76, 2.7), this.mat.gunDark);
    receiver.position.set(0, 0.4, -1.05);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.64, 2.2), this.mat.gunSteel);
    rail.position.set(0, 0.4, -3.3);

    const orangeAccent = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 1.9), this.mat.orangeTrim);
    orangeAccent.position.set(0, 0.68, -3.2);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 10), this.mat.gunDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.42, -4.8);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.15, 0.56), this.mat.gunDark);
    grip.position.set(0, -0.35, -0.2);
    grip.rotation.x = 0.22;

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.65, 0.58), this.mat.gunSteel);
    mag.position.set(0, -0.62, -1.65);
    mag.rotation.x = -0.15;

    const sight = this._createHoloSight();
    sight.position.set(0, 0.92, -0.95);

    g.add(receiver, rail, orangeAccent, barrel, grip, mag, sight);
    g.userData = { mag, magBasePos: mag.position.clone(), muzzleZ: -5.95 };
    return g;
  }

  _createHoloSight() {
    const s = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.85), this.mat.gunDark);
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.65), this.mat.gunDark);
    frameL.position.set(-0.22, 0.28, 0);
    const frameR = frameL.clone();
    frameR.position.x = 0.22;
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.65), this.mat.gunDark);
    frameTop.position.set(0, 0.52, 0);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), this.mat.holoGlass);
    glass.position.set(0, 0.28, 0);

    const dot = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.07, 16), this.mat.holoReticle);
    dot.position.set(0, 0.28, 0.01);

    s.add(base, frameL, frameR, frameTop, glass, dot);
    return s;
  }

  _createGrenadeModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 12), this.mat.olive);
    body.scale.set(0.9, 1.15, 0.9);
    body.position.set(0, 0.35, -0.6);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 10), this.mat.gunSteel);
    top.position.set(0, 1.1, -0.6);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16), this.mat.gunChrome);
    ring.position.set(-0.22, 1.12, -0.5);

    g.add(body, top, ring);
    g.userData = { muzzleZ: -1.0 };
    return g;
  }

  _applyDepthSettings(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.renderOrder = 999;
        if (child.material) {
          child.material.depthTest = true;
        }
      }
    });
  }

  update(dt, player, input) {
    this.time += dt;
    const wId = player.equippedId;
    const w = WEAPONS[wId] || WEAPONS.pistol;

    if (this.currentWeaponId !== wId) {
      if (this.currentWeaponId && this.models[this.currentWeaponId]) {
        this.models[this.currentWeaponId].visible = false;
      }
      this.currentWeaponId = wId;
      if (this.models[wId]) this.models[wId].visible = true;
    }

    const activeModel = this.models[wId];
    const ud = activeModel?.userData || {};

    // 1. Interpolação de Mira (ADS no Botão Direito)
    const targetAds = player.aiming && w.type === 'bullet' && player.reloadTimer <= 0 ? 1 : 0;
    this.adsFactor = lerp(this.adsFactor, targetAds, 1 - Math.exp(-dt * 14));

    // 2. Weapon Sway pelo movimento do mouse
    const dx = clamp(input.lookDeltaX || 0, -45, 45);
    const dy = clamp(input.lookDeltaY || 0, -45, 45);
    this.swayX = lerp(this.swayX, -dx * 0.012, 1 - Math.exp(-dt * 12));
    this.swayY = lerp(this.swayY, dy * 0.012, 1 - Math.exp(-dt * 12));

    // 3. Weapon Bobbing (respiração parado + balanço ao caminhar/correr)
    const speed = Math.hypot(player.vx, player.vy);
    const moving = speed > 15 ? clamp(speed / 260, 0, 1.2) : 0;
    const bobScale = 1 - this.adsFactor * 0.72;
    const bobX =
      Math.cos(player.walkPhase * 0.5) * 0.24 * moving * bobScale +
      Math.sin(this.time * 1.8) * 0.04 * bobScale;
    const bobY =
      Math.abs(Math.sin(player.walkPhase)) * -0.22 * moving * bobScale +
      Math.cos(this.time * 2.4) * 0.05 * bobScale;

    // Posição base do rig (canto inferior direito -> centro no ADS)
    const baseX = lerp(2.35, 0.0, this.adsFactor);
    const baseY = lerp(-2.25, -1.38, this.adsFactor);
    const baseZ = lerp(-5.2, -3.85, this.adsFactor);

    this.rig.position.set(baseX + bobX + this.swayX, baseY + bobY + this.swayY, baseZ);
    this.rig.rotation.set(this.swayY * 0.12, this.swayX * 0.15, -this.swayX * 0.18);

    // 4. Recuo (Recoil) e Muzzle Flash
    const kick = player.recoilKick || 0;
    this.weaponPivot.position.set(0, 0, kick * 0.24);
    this.weaponPivot.rotation.set(kick * 0.045, 0, 0);

    if (ud.slide) {
      ud.slide.position.z = (ud.slideBaseZ ?? ud.slide.position.z) + (player.muzzleFlash > 0 ? 0.35 : 0);
      if (ud.slideBaseZ === undefined) ud.slideBaseZ = ud.slide.position.z;
    }

    if (player.muzzleFlash > 0 && w.type === 'bullet') {
      this.muzzleFlash.visible = true;
      this.muzzleFlash.position.set(0, 0.48, ud.muzzleZ || -3.0);
      this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    } else {
      this.muzzleFlash.visible = false;
    }

    // 5. Posição padrão dos braços conforme a categoria da arma
    const isLongGun = w.slot === 2 || w.slot === 3 || w.slot === 4;
    let rPos = { x: 0.2, y: -0.55, z: 0.4 };
    let rRot = { x: 0.08, y: 0.05, z: 0 };
    let lPos = isLongGun
      ? { x: -0.95, y: -0.42, z: -1.75 }
      : wId === 'fists'
      ? { x: -2.4, y: -0.35, z: 0.35 }
      : { x: -0.55, y: -0.58, z: 0.15 };
    let lRot = isLongGun
      ? { x: 0.18, y: -0.42, z: -0.15 }
      : wId === 'fists'
      ? { x: 0.25, y: -0.15, z: 0 }
      : { x: 0.12, y: -0.32, z: 0 };

    // 6. Animação de Soco / Corpo a Corpo
    if (player.meleeSwing > 0) {
      const p = Math.sin((1 - player.meleeSwing / 0.25) * Math.PI);
      if (wId === 'fists') {
        if (ud.arc) ud.arc.visible = true;
        if (player.meleeCombo === 0) {
          // Soco direto com a mão direita
          rPos.z -= p * 2.6;
          rPos.y += p * 0.45;
          rRot.z -= p * 0.45;
          this.weaponPivot.position.z -= p * 2.6;
        } else {
          // Gancho potente com a mão esquerda
          lPos.z -= p * 2.8;
          lPos.x += p * 1.4;
          lPos.y += p * 0.55;
          lRot.y -= p * 0.7;
        }
      } else {
        // Taco ou faca: golpe diagonal
        this.weaponPivot.rotation.x -= p * 1.15;
        this.weaponPivot.rotation.y += p * 0.85;
        this.weaponPivot.position.z -= p * 1.4;
        rPos.z -= p * 1.2;
      }
    } else if (ud.arc) {
      ud.arc.visible = false;
    }

    // 7. Animação de Recarga (Tecla R)
    if (player.reloadTimer > 0 && w.reloadTime > 0) {
      const prog = 1 - player.reloadTimer / w.reloadTime;
      const tilt = Math.sin(prog * Math.PI);
      this.weaponPivot.rotation.z = tilt * 0.55;
      this.weaponPivot.rotation.x += tilt * 0.28;
      this.weaponPivot.position.y = -tilt * 0.35;

      if (ud.mag && ud.magBasePos) {
        let magDrop = 0;
        if (prog < 0.45) {
          magDrop = (prog / 0.45) * 1.8;
        } else if (prog < 0.82) {
          magDrop = (1 - (prog - 0.45) / 0.37) * 1.8;
        }
        ud.mag.position.y = ud.magBasePos.y - magDrop;
        // Mão esquerda acompanha o pente durante a troca
        lPos.x = -0.35;
        lPos.y = ud.mag.position.y - 0.35;
        lPos.z = ud.mag.position.z + 0.55;
      }
    } else if (ud.mag && ud.magBasePos) {
      ud.mag.position.copy(ud.magBasePos);
    }

    this.rightArm.position.set(rPos.x, rPos.y, rPos.z);
    this.rightArm.rotation.set(rRot.x, rRot.y, rRot.z);
    this.leftArm.position.set(lPos.x, lPos.y, lPos.z);
    this.leftArm.rotation.set(lRot.x, lRot.y, lRot.z);
  }
}
