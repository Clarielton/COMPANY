import * as THREE from 'three';
import { clamp } from '../core/math.js';
import { ARMY_FACTIONS, ARMY_SKIN_BY_ID } from '../data/rtsData.js';
import { getTerrainHeight } from '../world/terrainHeight.js';
import {
  createOrganicBattlefieldTextures,
  createGroundDetailTexture,
  createRoadSurfaceTexture,
} from './terrainTexture.js';
import { VFXManager } from './VFXManager.js';

function createRuralBattlefieldTexture(map) {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const scale = size / map.size;

  const isDesert = map.theme === 'desert';
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  if (isDesert) {
    baseGrad.addColorStop(0, '#bfa06b');
    baseGrad.addColorStop(0.5, '#b29058');
    baseGrad.addColorStop(1, '#c4a672');
  } else {
    baseGrad.addColorStop(0, '#475c32');
    baseGrad.addColorStop(0.5, '#3f522b');
    baseGrad.addColorStop(1, '#4a6035');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i++) {
    const x = (i * 197) % size;
    const y = (i * 353) % size;
    const r = 8 + (i % 28);
    if (isDesert) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(218, 190, 136, 0.18)' : 'rgba(146, 114, 68, 0.14)';
    } else {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(84, 108, 48, 0.16)' : 'rgba(46, 62, 30, 0.15)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const f of map.fields) {
    ctx.save();
    const cx = (f.x + f.w * 0.5) * scale;
    const cy = (f.y + f.h * 0.5) * scale;
    const fw = f.w * scale;
    const fh = f.h * scale;
    ctx.translate(cx, cy);
    ctx.rotate(f.angle || 0);

    if (f.type === 'wheat') {
      ctx.fillStyle = '#a88c3a';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(125, 100, 32, 0.45)';
      ctx.lineWidth = 3;
      for (let sy = -fh / 2 + 8; sy < fh / 2; sy += 10) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.lineTo(fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'pasture') {
      ctx.fillStyle = '#536e37';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(66, 88, 40, 0.4)';
      ctx.lineWidth = 2;
      for (let sx = -fw / 2 + 12; sx < fw / 2; sx += 16) {
        ctx.beginPath();
        ctx.moveTo(sx, -fh / 2);
        ctx.lineTo(sx, fh / 2);
        ctx.stroke();
      }
    } else if (f.type === 'plowed') {
      ctx.fillStyle = '#56422e';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(62, 44, 28, 0.65)';
      ctx.lineWidth = 4;
      for (let sy = -fh / 2 + 8; sy < fh / 2; sy += 11) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.lineTo(fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'mud') {
      ctx.fillStyle = '#474031';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'dune') {
      ctx.fillStyle = '#cba86e';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(168, 132, 74, 0.42)';
      ctx.lineWidth = 4;
      for (let sy = -fh / 2 + 14; sy < fh / 2; sy += 20) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.quadraticCurveTo(0, sy - 8, fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'rock') {
      ctx.fillStyle = '#8b7659';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(92, 76, 54, 0.48)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-fw / 2 + 6, -fh / 2 + 6, fw - 12, fh - 12);
    } else if (f.type === 'oasis') {
      ctx.fillStyle = '#978e57';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      const og = ctx.createRadialGradient(0, 0, 12, 0, 0, Math.min(fw, fh) * 0.44);
      og.addColorStop(0, '#2d7a78');
      og.addColorStop(0.55, '#4b7b44');
      og.addColorStop(1, 'rgba(151, 142, 87, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fh) * 0.44, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'wadi') {
      ctx.fillStyle = '#987c54';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    }

    ctx.strokeStyle = isDesert ? 'rgba(128, 102, 66, 0.42)' : 'rgba(38, 48, 24, 0.75)';
    ctx.lineWidth = 5;
    ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
    ctx.restore();
  }

  for (const cr of map.craters) {
    const x = cr.x * scale;
    const y = cr.y * scale;
    const r = cr.radius * scale;
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, '#241e17');
    g.addColorStop(0.6, '#403426');
    g.addColorStop(1, 'rgba(64, 52, 38, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const rd of map.roads) {
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = (rd.width + 24) * scale;
    ctx.beginPath();
    rd.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x * scale, pt.y * scale);
      else ctx.lineTo(pt.x * scale, pt.y * scale);
    });
    ctx.stroke();

    ctx.strokeStyle = '#735c40';
    ctx.lineWidth = rd.width * scale;
    ctx.beginPath();
    rd.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x * scale, pt.y * scale);
      else ctx.lineTo(pt.x * scale, pt.y * scale);
    });
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Renderer3D {
  constructor(canvas, overlayCanvas) {
    this.canvas = canvas;
    this.overlayCanvas = overlayCanvas;
    this.ctx2d = overlayCanvas ? overlayCanvas.getContext('2d') : null;
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x98b0c4);
    this.scene.fog = new THREE.FogExp2(0xa3b8c9, 0.00012);

    this.camera = new THREE.PerspectiveCamera(46, this.width / this.height, 8, 9500);
    this.camTarget = new THREE.Vector3(2400, 0, 4800);
    this.camZoom = 860;
    this.shakeMag = 0;
    this.shakeTime = 0;

    this._setupDaylight();

    this.worldGroup = new THREE.Group();
    this.dynamicGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.scene.add(this.dynamicGroup);

    this.squadMeshes = new Map();
    this.trenchMeshes = new Map();
    this.barricadeMeshes = new Map();
    this.wallMeshes = new Map();
    this.wireMeshes = new Map();
    this.mineMeshes = new Map();
    this.sectorMeshes = new Map();
    this.structureMeshes = new Map();
    this.baseBuildingMeshes = new Map();
    this.aircraftMeshes = new Map();
    this.windmillBlades = [];
    this.bulletPool = [];
    this.particlePool = [];

    // Camada 3D de Névoa de Guerra Real sobre o terreno (512x512 com gradiente radial suave + nuvens animadas)
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = 512;
    this.fogCanvas.height = 512;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTexture.minFilter = THREE.LinearFilter;
    this.fogTexture.magFilter = THREE.LinearFilter;
    this.fogMesh = null;
    this.fogSyncTimer = 0;
    this.smoothFogGrid = null;
    this.fogCloudTime = 0;
    this.snowSystem = null;
    this.lastPlayerSkinId = 'olive_classic';

    this._initSharedAssets();
    this._initPools();

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.vfx = new VFXManager(this.scene);
  }

  _setupDaylight() {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x4f622c, 1.32);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.sunLight.position.set(2200, 1550, 2200);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 200;
    this.sunLight.shadow.camera.far = 4200;
    const d = 1750;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  _initSharedAssets() {
    this.geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      sphere: new THREE.SphereGeometry(0.5, 12, 10),
      cone: new THREE.ConeGeometry(0.6, 1.3, 10),
      pyramid: new THREE.ConeGeometry(6.5, 11, 4),
      ring: new THREE.RingGeometry(0.84, 1.0, 28),
      sandbag: new THREE.SphereGeometry(1, 8, 6),
      torusWire: new THREE.TorusGeometry(4.2, 0.42, 6, 14),
      mineBody: new THREE.CylinderGeometry(5.5, 6.2, 2.6, 14),
      mineCap: new THREE.CylinderGeometry(2.2, 2.2, 1.4, 10),
    };
    this.geometries.ring.rotateX(-Math.PI / 2);

    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: 0xd9a17c, roughness: 0.75 }),
      bootLeather: new THREE.MeshStandardMaterial({ color: 0x1c1916, roughness: 0.82 }),
      vestOlive: new THREE.MeshStandardMaterial({ color: 0x2f3b26, roughness: 0.85 }),
      vestEnemy: new THREE.MeshStandardMaterial({ color: 0x423529, roughness: 0.85 }),
      packCanvas: new THREE.MeshStandardMaterial({ color: 0x5c533e, roughness: 0.9 }),
      gunMetal: new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.4, metalness: 0.65 }),
      razorSteel: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.75 }),
      woodStock: new THREE.MeshStandardMaterial({ color: 0x613f22, roughness: 0.85 }),
      trenchPitBottom: new THREE.MeshStandardMaterial({
        color: 0x17110b,
        roughness: 1.0,
        metalness: 0.0,
      }),
      trenchMudBerm: new THREE.MeshStandardMaterial({
        color: 0x423120,
        roughness: 0.96,
      }),
      trenchDarkTimber: new THREE.MeshStandardMaterial({
        color: 0x362415,
        roughness: 0.92,
      }),
      sandbagOlive: new THREE.MeshStandardMaterial({
        color: 0x8f8260,
        roughness: 0.92,
      }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x6e736b, roughness: 0.88 }),
      concreteDark: new THREE.MeshStandardMaterial({ color: 0x484d46, roughness: 0.92 }),
      masonryStone: new THREE.MeshStandardMaterial({ color: 0x9c9282, roughness: 0.88 }),
      plasterWarm: new THREE.MeshStandardMaterial({ color: 0xb8ad99, roughness: 0.86 }),
      brickBarn: new THREE.MeshStandardMaterial({ color: 0x7d382c, roughness: 0.86 }),
      roofSlate: new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.82 }),
      roofTile: new THREE.MeshStandardMaterial({ color: 0x6e3b28, roughness: 0.85 }),
      windowDark: new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.5 }),
      rustMetal: new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.85, metalness: 0.35 }),
      charredMetal: new THREE.MeshStandardMaterial({ color: 0x262422, roughness: 0.9, metalness: 0.25 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.85 }),
      wheelHub: new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.6, metalness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.6 }),
      headlightGlow: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      whiteFlag: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xdddddd,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      }),
      mineMetal: new THREE.MeshStandardMaterial({ color: 0x3b4938, roughness: 0.6, metalness: 0.4 }),
      mineWarnAlly: new THREE.MeshBasicMaterial({ color: 0x6b9bd2 }),
      mineWarnEnemy: new THREE.MeshBasicMaterial({ color: 0xc94a38 }),
      selectRing: new THREE.MeshBasicMaterial({
        color: 0xd4a338,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
      buildingSelectRing: new THREE.MeshBasicMaterial({
        color: 0xa3be8c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
      muzzle: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    };
  }

  _initPools() {
    const bMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(this.geometries.box, bMat);
      m.visible = false;
      this.dynamicGroup.add(m);
      this.bulletPool.push(m);
    }

    for (let i = 0; i < 280; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(this.geometries.sphere, mat);
      m.visible = false;
      this.dynamicGroup.add(m);
      this.particlePool.push(m);
    }

    // Linha 3D de Trajetória Inteligente (1 linha única por esquadrão + preview cinza semitransparente)
    this.droneMeshes = new Map();
    this.squadPathLines = new Map();
    this.pathLineMat = new THREE.LineDashedMaterial({
      color: 0xb0b8b0, // Cinza claro tático
      transparent: true,
      opacity: 0.45, // Meio transparente (45%)
      dashSize: 10,
      gapSize: 6,
      depthWrite: false,
    });
    const pathGeo = new THREE.BufferGeometry();
    this.pathLine = new THREE.Line(pathGeo, this.pathLineMat);
    this.pathLine.visible = false;
    this.dynamicGroup.add(this.pathLine);

    this.waypointDots = [];
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 16; i++) {
      const dot = new THREE.Mesh(this.geometries.sphere, dotMat);
      dot.scale.set(2.4, 0.8, 2.4);
      dot.visible = false;
      this.dynamicGroup.add(dot);
      this.waypointDots.push(dot);
    }
  }

  applySettings(settings) {
    if (!settings) return;
    if (typeof settings.highQuality === 'boolean') {
      this.renderer.shadowMap.enabled = settings.highQuality;
    }
    if (typeof settings.vegDensity === 'number' && settings.vegDensity !== this.vegDensity) {
      this.vegDensity = settings.vegDensity;
      if (this.currentMap) {
        this.buildWorld(this.currentMap);
      }
    }
  }

  shake(mag, time = 0.25) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  resize(w, h) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.overlayCanvas) {
      this.overlayCanvas.width = this.width;
      this.overlayCanvas.height = this.height;
    }
  }

  screenToWorld(sx, sy) {
    const ndc = new THREE.Vector2(
      (sx / this.width) * 2 - 1,
      -(sy / this.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    if (hit) {
      return { x: target.x, y: target.z };
    }
    return { x: this.camTarget.x, y: this.camTarget.z };
  }

  worldToScreen(wx, wy, wz = 0) {
    const v = new THREE.Vector3(wx, wz, wy);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: v.z >= -1 && v.z <= 1,
    };
  }

  buildWorld(map) {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.squadMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.squadMeshes.clear();
    this.trenchMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.trenchMeshes.clear();
    this.barricadeMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.barricadeMeshes.clear();
    this.wallMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.wallMeshes.clear();
    this.wireMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.wireMeshes.clear();
    this.mineMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.mineMeshes.clear();
    this.baseBuildingMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.baseBuildingMeshes.clear();
    this.aircraftMeshes.forEach((m) => this.dynamicGroup.remove(m));
    this.aircraftMeshes.clear();
    if (this.droneMeshes) {
      this.droneMeshes.forEach((m) => this.dynamicGroup.remove(m));
      this.droneMeshes.clear();
    }
    this.sectorMeshes.clear();
    this.structureMeshes.clear();
    this.windmillBlades = [];
    this.vfx?.clear();

    // 1. Terreno 3D com Relevo Real (256x256) + Textura Orgânica + Detail Tiling 64x64 + Anisotropic Máximo
    this.currentMap = map;
    const isDesert = map.theme === 'desert';
    const isWinter = map.theme === 'winter';
    const maxAniso = this.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
    this.scene.fog = new THREE.FogExp2(
      isDesert ? 0xcab28b : isWinter ? 0xbcd4e6 : 0x95a593,
      isWinter ? 0.00026 : 0.00022
    );
    this.scene.background = new THREE.Color(isDesert ? 0xcab28b : isWinter ? 0xbcd4e6 : 0x95a593);
    const { colorMap: groundTex, bumpMap: groundBump } = createOrganicBattlefieldTextures(map);
    groundTex.anisotropy = maxAniso;
    groundBump.anisotropy = maxAniso;

    const groundGeo = new THREE.PlaneGeometry(map.size, map.size, 256, 256);
    groundGeo.rotateX(-Math.PI / 2);
    const gPos = groundGeo.attributes.position;
    const halfMap = map.size * 0.5;
    for (let i = 0; i < gPos.count; i++) {
      const wx = gPos.getX(i) + halfMap;
      const wz = gPos.getZ(i) + halfMap;
      gPos.setY(i, getTerrainHeight(wx, wz, map));
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      bumpMap: groundBump,
      bumpScale: 3.4,
      roughness: 0.94,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(halfMap, 0, halfMap);
    ground.receiveShadow = true;
    this.terrainGeo = groundGeo;
    this.terrainHalfMap = halfMap;
    this.carvedTrenchIds = new Set();
    this.worldGroup.add(ground);

    // 1b. Camada de Micro-Detalhe (RepeatWrapping 64x64) para nitidez total ao aproximar a câmera
    const detailTex = createGroundDetailTexture(map.theme || 'rural');
    detailTex.anisotropy = maxAniso;
    const detailMat = new THREE.MeshStandardMaterial({
      map: detailTex,
      transparent: true,
      opacity: 0.36,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const detailMesh = new THREE.Mesh(groundGeo, detailMat);
    detailMesh.position.set(halfMap, 0.12, halfMap);
    detailMesh.receiveShadow = true;
    this.worldGroup.add(detailMesh);

    // 1c. Malha Dedicada de Estradas Nítidas (Repeat 1x40 ao longo do comprimento)
    this._buildRoadMeshes(map, maxAniso);
    this._buildRailways(map);

    // 2. Malha 3D de Névoa de Guerra (128x128 acompanhando o relevo + depthTest:false para nunca cortar crateras/estradas)
    const fogGeo = new THREE.PlaneGeometry(map.size, map.size, 128, 128);
    fogGeo.rotateX(-Math.PI / 2);
    const fPos = fogGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const wx = fPos.getX(i) + halfMap;
      const wz = fPos.getZ(i) + halfMap;
      fPos.setY(i, getTerrainHeight(wx, wz, map) + 0.35);
    }
    const fogMat = new THREE.MeshBasicMaterial({
      map: this.fogTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.fogMesh = new THREE.Mesh(fogGeo, fogMat);
    this.fogMesh.position.set(halfMap, 0, halfMap);
    this.fogMesh.renderOrder = 999;
    this.worldGroup.add(this.fogMesh);

    // 3. Árvores Realistas Compostas + Vegetação Rasteira & Micro-Detalhes (InstancedMesh)
    this._buildTreelines(map);
    this._buildUndergrowthAndDetails(map);

    // 4. Construções Rurais/Urbanas, Vilarejos e Ruínas apoiadas no relevo
    for (const st of map.structures) {
      const stMesh = this._createRuralStructureMesh(st);
      stMesh.position.set(st.x, getTerrainHeight(st.x, st.y, map), st.y);
      stMesh.rotation.y = st.angle || 0;
      this.worldGroup.add(stMesh);
      this.structureMeshes.set(st.id, stMesh);
    }

    // 5. Muros Baixos de Pedra/Tijolo (Cobertura Pesada Direcional)
    for (const w of map.stoneWalls || []) {
      const wm = this._createStoneWallMesh(w);
      const midX = (w.x1 + w.x2) * 0.5;
      const midY = (w.y1 + w.y2) * 0.5;
      wm.position.y += getTerrainHeight(midX, midY, map);
      this.worldGroup.add(wm);
    }

    // 6. Carros Abandonados, Caminhões Queimados e Tanques Destruídos
    for (const wrk of map.wrecks) {
      const wrkMesh = this._createWreckMesh(wrk);
      wrkMesh.position.set(wrk.x, getTerrainHeight(wrk.x, wrk.y, map), wrk.y);
      wrkMesh.rotation.y = wrk.angle || 0;
      this.worldGroup.add(wrkMesh);
    }

    // 7. 12 Pontos Estratégicos de Conquista (Bandeira 3D que sobe/desce + Tendas & Barris)
    for (const sec of map.sectors) {
      const secGroup = this._createSectorPoint(sec);
      secGroup.position.set(sec.x, getTerrainHeight(sec.x, sec.y, map), sec.y);
      this.worldGroup.add(secGroup);
      this.sectorMeshes.set(sec.id, secGroup);
    }

    // 8. Linha de Frente Dinâmica
    this._initFrontlineMesh(map);

    // 9. Nevasca 3D em Partículas (quando mapa for Bastogne Inverno)
    this.snowSystem = null;
    if (isWinter) {
      const snowCount = 1600;
      const snowPos = new Float32Array(snowCount * 3);
      for (let i = 0; i < snowCount; i++) {
        snowPos[i * 3] = Math.random() * map.size;
        snowPos[i * 3 + 1] = 20 + Math.random() * 520;
        snowPos[i * 3 + 2] = Math.random() * map.size;
      }
      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
      const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 5.5,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      this.snowSystem = new THREE.Points(snowGeo, snowMat);
      this.worldGroup.add(this.snowSystem);
    }
  }

  _updateFogTexture3D(map, dt = 0.05) {
    const ctx = this.fogCtx;
    const size = this.fogCanvas.width;
    const fg = map.fogSize;

    if (!this.smoothFogGrid || this.smoothFogGrid.length !== map.fogGrid.length) {
      this.smoothFogGrid = new Float32Array(map.fogGrid.length);
      for (let i = 0; i < map.fogGrid.length; i++) {
        this.smoothFogGrid[i] = map.fogGrid[i];
      }
    }

    const lerpRate = Math.min(1, dt * 7.5);
    for (let i = 0; i < map.fogGrid.length; i++) {
      const target = map.fogGrid[i];
      this.smoothFogGrid[i] += (target - this.smoothFogGrid[i]) * lerpRate;
    }

    // 1. Camada base de Névoa Inexplorada adaptada por bioma (sem verde no deserto/neve!)
    const isDesert = map.theme === 'desert';
    const isWinter = map.theme === 'winter';
    const fogBase = isDesert
      ? 'rgba(28, 22, 14, 0.78)'
      : isWinter
      ? 'rgba(15, 20, 28, 0.78)'
      : 'rgba(12, 16, 12, 0.78)';
    const fogCloud0 = isDesert
      ? 'rgba(48, 36, 24, 0.28)'
      : isWinter
      ? 'rgba(28, 36, 48, 0.28)'
      : 'rgba(28, 36, 28, 0.28)';
    const fogCloud1 = isDesert
      ? 'rgba(28, 22, 14, 0)'
      : isWinter
      ? 'rgba(15, 20, 28, 0)'
      : 'rgba(12, 16, 12, 0)';

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = fogBase;
    ctx.fillRect(0, 0, size, size);

    this.fogCloudTime += dt * 10;
    for (let c = 0; c < 18; c++) {
      const cx = ((c * 137 + this.fogCloudTime * (1 + (c % 3) * 0.4)) % (size + 120)) - 60;
      const cy = ((c * 211 + Math.sin(this.fogCloudTime * 0.03 + c) * 24) % (size + 120)) - 60;
      const cr = 42 + (c % 4) * 18;
      const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, cr);
      cg.addColorStop(0, fogCloud0);
      cg.addColorStop(1, fogCloud1);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Recorte suave com createRadialGradient nas áreas exploradas e de visão ativa (sem quadrados serrilhados)
    ctx.globalCompositeOperation = 'destination-out';
    const cellPx = size / fg;
    for (let gy = 0; gy < fg; gy += 2) {
      const rowOffset = gy * fg;
      for (let gx = 0; gx < fg; gx += 2) {
        const val = this.smoothFogGrid[rowOffset + gx];
        if (val <= 0.04) continue;
        const cx = (gx + 1) * cellPx;
        const cy = (gy + 1) * cellPx;
        const rad = cellPx * 3.1;
        const alpha = Math.min(1, val * 0.5);
        const grad = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
        grad.addColorStop(0, `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    this.fogTexture.needsUpdate = true;
  }

  _createStoneWallMesh(w) {
    const g = new THREE.Group();
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    const cx = (w.x1 + w.x2) * 0.5;
    const cy = (w.y1 + w.y2) * 0.5;
    const ang = Math.atan2(dx, dy);

    g.position.set(cx, 0, cy);
    g.rotation.y = ang;

    const wallH = w.height || 11;
    const mat = w.type === 'brick' ? this.materials.brickBarn : this.materials.masonryStone;
    const wall = new THREE.Mesh(this.geometries.box, mat);
    wall.scale.set(w.thickness || 16, wallH, len);
    wall.position.y = wallH * 0.5;
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);

    for (const t of [-0.5, 0, 0.5]) {
      const pillar = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      pillar.scale.set((w.thickness || 16) + 3, wallH + 2.5, 8);
      pillar.position.set(0, (wallH + 2.5) * 0.5, t * len);
      pillar.castShadow = true;
      g.add(pillar);
    }
    return g;
  }

  // Muros de Bloqueio Militar Realistas (Checkpoints com Concreto Desgastado, Sacos de Areia, Ouriços Checos, Placas e Cancela)
  _createFortifiedWallMesh(wall) {
    const g = new THREE.Group();
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.max(40, Math.hypot(dx, dy));
    const cx = (wall.x1 + wall.x2) * 0.5;
    const cy = (wall.y1 + wall.y2) * 0.5;
    const ang = Math.atan2(dx, dy);

    g.position.set(cx, 0, cy);
    g.rotation.y = ang;

    // Deixa brecha central para passagem se o muro for longo, com cancela militar
    const gapHalf = len > 90 ? 18 : 0;
    const wingLen = (len - gapHalf * 2) * 0.5;

    for (const sideDir of [-1, 1]) {
      const wingCenter = sideDir * (gapHalf + wingLen * 0.5);
      const count = Math.max(2, Math.floor(wingLen / 24));
      for (let i = 0; i < count; i++) {
        const zPos = wingCenter - wingLen * 0.5 + (i + 0.5) * (wingLen / count);
        // Barreira Jersey de concreto desgastado
        const jersey = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
        jersey.scale.set(12, 11, wingLen / count - 1.5);
        jersey.position.set(0, 5.5, zPos);
        jersey.castShadow = true;
        jersey.receiveShadow = true;
        g.add(jersey);

        // Sacos de areia densos nas duas faces
        for (const face of [-8.5, 8.5]) {
          for (let row = 0; row < 2; row++) {
            const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
            sb.scale.set(4.5, 2.6, 6.4);
            sb.position.set(face, 2.2 + row * 3.0, zPos);
            sb.castShadow = true;
            g.add(sb);
          }
        }
      }
      // Ouriço Checo (vigas de aço cruzadas) na ponta próxima à brecha
      const hhZ = sideDir * (gapHalf + 6);
      for (const tilt of [-0.65, 0.65]) {
        const beam = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
        beam.scale.set(1.8, 16, 1.8);
        beam.position.set(11, 6.5, hhZ);
        beam.rotation.set(tilt, 0.4, tilt * 0.7);
        beam.castShadow = true;
        g.add(beam);
      }
    }

    // Placa "PARE / ZONA MILITAR" + Cancela na brecha central
    const signPost = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    signPost.scale.set(1.0, 18, 1.0);
    signPost.position.set(9, 9, -gapHalf - 4);
    g.add(signPost);
    const signBoard = new THREE.Mesh(
      this.geometries.box,
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
    );
    signBoard.scale.set(1.2, 6, 8);
    signBoard.position.set(9, 15, -gapHalf - 4);
    g.add(signBoard);

    if (gapHalf > 0) {
      const gateArm = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
      );
      gateArm.scale.set(1.6, 1.8, gapHalf * 1.9);
      gateArm.position.set(0, 9.5, 0);
      gateArm.rotation.x = 0.25;
      g.add(gateArm);
    }

    return g;
  }

  // Arame Farpado Militar (Concertina / Razor Wire em Cavaletes X)
  _createBarbedWireMesh(wire) {
    const g = new THREE.Group();
    const dx = wire.x2 - wire.x1;
    const dy = wire.y2 - wire.y1;
    const len = Math.max(30, Math.hypot(dx, dy));
    const cx = (wire.x1 + wire.x2) * 0.5;
    const cy = (wire.y1 + wire.y2) * 0.5;
    const ang = Math.atan2(dx, dy);

    g.position.set(cx, 0, cy);
    g.rotation.y = ang;

    const postCount = Math.max(3, Math.floor(len / 26));
    for (let i = 0; i <= postCount; i++) {
      const zPos = -len * 0.5 + (i / postCount) * len;
      const p1 = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      p1.scale.set(1.6, 11, 1.6);
      p1.position.set(0, 4.8, zPos);
      p1.rotation.z = 0.55;
      const p2 = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      p2.scale.set(1.6, 11, 1.6);
      p2.position.set(0, 4.8, zPos);
      p2.rotation.z = -0.55;
      g.add(p1, p2);
    }

    const coilCount = Math.max(6, Math.floor(len / 9));
    for (let i = 0; i < coilCount; i++) {
      const zPos = -len * 0.5 + (i + 0.5) * (len / coilCount);
      const coil = new THREE.Mesh(this.geometries.torusWire, this.materials.razorSteel);
      coil.position.set(0, 4.8, zPos);
      coil.rotation.y = (i % 2) * 0.35;
      g.add(coil);
    }

    return g;
  }

  // Prédios da Base Militar Maiores, Detalhados, Selecionáveis e Destrutíveis (QG Central, Quartel Op. Especiais, Fábrica, Radar)
  _createBaseBuildingMesh(bld) {
    const g = new THREE.Group();
    const isAlly = bld.team === 'allies';
    const roofCol = isAlly ? 0x3f5636 : 0x5c3e32;
    const bannerColor = isAlly ? 0x6b9bd2 : 0xc94a38;

    // Anel de seleção iluminado no chão quando o jogador clica no prédio
    const selRing = new THREE.Mesh(this.geometries.ring, this.materials.buildingSelectRing);
    const ringRadius = (bld.radius || 95) * 1.25;
    selRing.scale.set(ringRadius, 1, ringRadius);
    selRing.position.y = 1.1;
    selRing.visible = false;
    g.add(selRing);
    g.userData.selRing = selRing;

    if (bld.buildingType === 'hq_command') {
      // Quartel-General (QG): Complexo Fortificado em "U" com Parapeito, Sacos de Areia, Antena Treliçada, Bandeira Animada e Heliponto (H) Lateral
      const pad = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      pad.scale.set(228, 3.6, 206);
      pad.position.y = 1.8;
      pad.receiveShadow = true;
      g.add(pad);

      // Corpo principal em formato de "U" (Ala Traseira + Ala Esquerda + Ala Direita)
      const backWing = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      backWing.scale.set(118, 30, 42);
      backWing.position.set(-14, 15, -36);
      backWing.castShadow = true;
      backWing.receiveShadow = true;
      g.add(backWing);

      for (const side of [-1, 1]) {
        const sideWing = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
        sideWing.scale.set(34, 24, 54);
        sideWing.position.set(-14 + side * 42, 12, 10);
        sideWing.castShadow = true;
        sideWing.receiveShadow = true;
        g.add(sideWing);

        // Parapeito no teto das alas
        const para = new THREE.Mesh(this.geometries.box, this.materials.concrete);
        para.scale.set(36, 3.2, 56);
        para.position.set(-14 + side * 42, 25.5, 10);
        g.add(para);
      }

      // Parapeito no teto principal + Unidade de Comando Superior
      const roofRim = new THREE.Mesh(this.geometries.box, this.materials.concrete);
      roofRim.scale.set(122, 3.6, 46);
      roofRim.position.set(-14, 31.8, -36);
      g.add(roofRim);

      const roofCommand = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.85 })
      );
      roofCommand.scale.set(56, 10, 26);
      roofCommand.position.set(-14, 38, -36);
      roofCommand.castShadow = true;
      g.add(roofCommand);

      // Antena de Rádio Treliçada Alta
      const latticeGroup = new THREE.Group();
      latticeGroup.position.set(28, 34, -38);
      for (const lx of [-4, 4]) {
        for (const lz of [-4, 4]) {
          const strut = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
          strut.scale.set(0.9, 52, 0.9);
          strut.position.set(lx * 0.7, 26, lz * 0.7);
          latticeGroup.add(strut);
        }
      }
      for (let h = 10; h <= 46; h += 12) {
        const ringBar = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
        ringBar.scale.set(8, 1.2, 8);
        ringBar.position.set(0, h, 0);
        latticeGroup.add(ringBar);
      }
      const tipLight = new THREE.Mesh(
        this.geometries.sphere,
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })
      );
      tipLight.scale.set(2.5, 2.5, 2.5);
      tipLight.position.set(0, 54, 0);
      latticeGroup.add(tipLight);
      g.add(latticeGroup);

      // Heliponto (H) Iluminado ao Lado (fora da estrada)
      const helipad = new THREE.Mesh(this.geometries.cyl, this.materials.concreteDark);
      helipad.scale.set(50, 1.4, 50);
      helipad.position.set(74, 2.0, -32);
      g.add(helipad);
      for (const hx of [-7, 7]) {
        const hBar = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
        hBar.scale.set(3.5, 0.6, 20);
        hBar.position.set(74 + hx, 2.9, -32);
        g.add(hBar);
      }
      const hMid = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
      hMid.scale.set(14, 0.6, 3.5);
      hMid.position.set(74, 2.9, -32);
      g.add(hMid);
      for (let li = 0; li < 6; li++) {
        const la = (li / 6) * Math.PI * 2;
        const padLight = new THREE.Mesh(
          this.geometries.sphere,
          new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.2 })
        );
        padLight.scale.set(2.0, 2.0, 2.0);
        padLight.position.set(74 + Math.cos(la) * 23, 3.2, -32 + Math.sin(la) * 23);
        g.add(padLight);
      }

      // Mastro com Bandeira Animada + Caixas de Suprimento Empilhadas no Pátio
      const pole = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      pole.scale.set(2.4, 68, 2.4);
      pole.position.set(-72, 34, 42);
      g.add(pole);

      const flag = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({
          color: bannerColor,
          emissive: bannerColor,
          emissiveIntensity: 0.25,
        })
      );
      flag.scale.set(26, 14, 1.4);
      flag.position.set(-59, 60, 42);
      g.add(flag);
      g.userData.flagMesh = flag;

      for (let c = 0; c < 4; c++) {
        const crate = new THREE.Mesh(this.geometries.box, this.materials.wood);
        crate.scale.set(9, 7, 9);
        crate.position.set(-14 + (c % 2) * 11, 5.5 + Math.floor(c / 2) * 7, 16);
        crate.castShadow = true;
        g.add(crate);
      }

      // Perímetro de Sacos de Areia
      for (let i = 0; i < 16; i++) {
        if (i === 3 || i === 4 || i === 12) continue;
        const a = (i / 16) * Math.PI * 2;
        const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sb.position.set(-10 + Math.cos(a) * 96, 4.0, Math.sin(a) * 86);
        sb.rotation.y = -a + Math.PI / 2;
        sb.scale.set(9.5, 4.2, 5.2);
        sb.castShadow = true;
        g.add(sb);
      }

      // Nível 2: Radar Giratório + Bunkers Laterais
      const lvl2Group = new THREE.Group();
      for (const bx of [-86, 86]) {
        const bnk = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
        bnk.scale.set(26, 16, 26);
        bnk.position.set(bx, 8, 38);
        bnk.castShadow = true;
        lvl2Group.add(bnk);
      }
      const radarMast = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      radarMast.scale.set(2.4, 20, 2.4);
      radarMast.position.set(-42, 42, -36);
      lvl2Group.add(radarMast);
      const radarDish = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
      radarDish.scale.set(16, 10, 2);
      radarDish.position.set(-42, 53, -36);
      lvl2Group.add(radarDish);
      lvl2Group.visible = (bld.level || 1) >= 2;
      g.add(lvl2Group);
      g.userData.lvl2Group = lvl2Group;

      // Nível 3: Torre de Comando Supremo
      const lvl3Group = new THREE.Group();
      const supTower = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      supTower.scale.set(3.0, 44, 3.0);
      supTower.position.set(-14, 62, -36);
      lvl3Group.add(supTower);
      const supBeacon = new THREE.Mesh(
        this.geometries.sphere,
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.9 })
      );
      supBeacon.scale.set(4.5, 4.5, 4.5);
      supBeacon.position.set(-14, 85, -36);
      lvl3Group.add(supBeacon);
      lvl3Group.visible = (bld.level || 1) >= 3;
      g.add(lvl3Group);
      g.userData.lvl3Group = lvl3Group;

      return g;
    }

    if (bld.buildingType === 'spec_ops_center') {
      // Operações Especiais: Quonset Hut Arqueado Nervurado + Torre de Treinamento + Estande de Tiro + Rede de Camuflagem
      const pad = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      pad.scale.set(154, 3.6, 122);
      pad.position.y = 1.8;
      pad.receiveShadow = true;
      g.add(pad);

      // Barracão Quonset Hut (cilindro arqueado de metal verde-oliva com nervuras)
      const hutMat = new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.72, metalness: 0.25 });
      const hutArch = new THREE.Mesh(this.geometries.cyl, hutMat);
      hutArch.rotation.z = Math.PI / 2;
      hutArch.scale.set(28, 74, 46);
      hutArch.position.set(-22, 10, -14);
      hutArch.castShadow = true;
      hutArch.receiveShadow = true;
      g.add(hutArch);

      for (let rx = -52; rx <= 8; rx += 15) {
        const rib = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
        rib.rotation.z = Math.PI / 2;
        rib.scale.set(29.2, 2.2, 47.2);
        rib.position.set(rx, 10, -14);
        g.add(rib);
      }

      // Torre de Treinamento de Madeira/Aço
      for (const tx of [36, 54]) {
        for (const tz of [-34, -16]) {
          const leg = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
          leg.scale.set(2.5, 48, 2.5);
          leg.position.set(tx, 24, tz);
          leg.castShadow = true;
          g.add(leg);
        }
      }
      const platform = new THREE.Mesh(this.geometries.box, this.materials.wood);
      platform.scale.set(24, 3, 24);
      platform.position.set(45, 46, -25);
      platform.castShadow = true;
      g.add(platform);

      // Rede de Camuflagem Suspensa sobre caixas de armamento
      const camoNet = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0x4d5d36, roughness: 0.95 })
      );
      camoNet.scale.set(48, 1.4, 30);
      camoNet.position.set(-24, 18, 32);
      camoNet.rotation.x = 0.08;
      camoNet.castShadow = true;
      g.add(camoNet);
      for (const px of [-46, -2]) {
        for (const pz of [18, 46]) {
          const post = new THREE.Mesh(this.geometries.cyl, this.materials.wood);
          post.scale.set(1.2, 19, 1.2);
          post.position.set(px, 9.5, pz);
          g.add(post);
        }
      }
      for (let c = 0; c < 3; c++) {
        const crate = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
        crate.scale.set(10, 6, 7);
        crate.position.set(-34 + c * 12, 4.5, 32);
        g.add(crate);
      }

      // Estande de Tiro com 3 Alvos
      for (let t = 0; t < 3; t++) {
        const target = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
        target.scale.set(6, 11, 1.5);
        target.position.set(24 + t * 14, 7.5, 38);
        g.add(target);
      }
    } else if (bld.buildingType === 'motor_pool') {
      // Fábrica de Blindados: Hangar Industrial Tijolo/Aço + 2 Portões + Guindaste Amarelo + Chaminés + Tanques + Esteiras
      const pad = new THREE.Mesh(this.geometries.box, this.materials.concrete);
      pad.scale.set(174, 2.2, 134);
      pad.position.y = 1.1;
      pad.receiveShadow = true;
      g.add(pad);

      const depot = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
      depot.scale.set(120, 36, 82);
      depot.position.set(6, 18, -10);
      depot.castShadow = true;
      depot.receiveShadow = true;
      g.add(depot);

      // Estrutura de vigas de aço e telhado inclinado industrial
      const roof = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      roof.scale.set(126, 5, 88);
      roof.position.set(6, 38.5, -10);
      roof.castShadow = true;
      g.add(roof);

      // 2 Portões Largos de Garagem (Semi-abertos com vão escuro)
      for (const gx of [-22, 34]) {
        const bayDark = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
        bayDark.scale.set(38, 26, 2.5);
        bayDark.position.set(gx, 13, 30.8);
        g.add(bayDark);
        const shutter = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
        shutter.scale.set(38, 9, 3.2);
        shutter.position.set(gx, 22, 31.2);
        g.add(shutter);
      }

      // Guindaste / Ponte Rolante Amarela na Entrada
      const craneMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.55, metalness: 0.35 });
      for (const cx of [-46, 58]) {
        const leg = new THREE.Mesh(this.geometries.box, craneMat);
        leg.scale.set(4, 34, 4);
        leg.position.set(cx, 17, 46);
        leg.castShadow = true;
        g.add(leg);
      }
      const girder = new THREE.Mesh(this.geometries.box, craneMat);
      girder.scale.set(112, 4.5, 5);
      girder.position.set(6, 34, 46);
      girder.castShadow = true;
      g.add(girder);

      // Chaminés Industriais
      for (const sx of [-36, -12]) {
        const stack = new THREE.Mesh(this.geometries.cyl, this.materials.charredMetal);
        stack.scale.set(6, 28, 6);
        stack.position.set(sx, 50, -32);
        stack.castShadow = true;
        g.add(stack);
      }

      // Tanques Cilíndricos de Diesel na Lateral + Esteiras Sobressalentes no Pátio
      for (const zOff of [-22, 10]) {
        const fuelTank = new THREE.Mesh(this.geometries.cyl, this.materials.rustMetal);
        fuelTank.scale.set(16, 24, 16);
        fuelTank.position.set(-68, 12, zOff);
        fuelTank.castShadow = true;
        g.add(fuelTank);
      }
      for (let t = 0; t < 2; t++) {
        const trackPile = new THREE.Mesh(this.geometries.box, this.materials.charredMetal);
        trackPile.scale.set(14, 4.5, 8);
        trackPile.position.set(-66, 3.2 + t * 4.5, 42);
        g.add(trackPile);
      }
    } else if (bld.buildingType === 'pow_camp') {
      // Campo de Detenção & Inteligência: Arame Farpado nos 4 Lados, Cancela, Guarita na Quina (sem tampar rótulo), Barracas Caqui e Holofote
      const pad = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      pad.scale.set(146, 3.6, 126);
      pad.position.y = 1.8;
      pad.receiveShadow = true;
      g.add(pad);

      // Barracas de Lona Militar Caqui no Centro
      const khakiMat = new THREE.MeshStandardMaterial({ color: 0x8c7b56, roughness: 0.92 });
      for (const tx of [-18, 22]) {
        const tentBody = new THREE.Mesh(this.geometries.box, khakiMat);
        tentBody.scale.set(32, 16, 44);
        tentBody.position.set(tx, 9, 4);
        tentBody.castShadow = true;
        g.add(tentBody);

        const tentTop = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
        tentTop.scale.set(34, 4, 46);
        tentTop.position.set(tx, 18.5, 4);
        g.add(tentTop);
      }

      // Guarita de Madeira Alta na Quina Traseira Esquerda (longe do rótulo central)
      const tower = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      tower.scale.set(14, 42, 14);
      tower.position.set(-54, 21, -44);
      tower.castShadow = true;
      g.add(tower);

      const cabin = new THREE.Mesh(this.geometries.box, this.materials.wood);
      cabin.scale.set(22, 13, 22);
      cabin.position.set(-54, 46, -44);
      cabin.castShadow = true;
      g.add(cabin);

      const searchlight = new THREE.Mesh(
        this.geometries.sphere,
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.0 })
      );
      searchlight.scale.set(4.5, 4.5, 4.5);
      searchlight.position.set(-46, 53, -36);
      g.add(searchlight);

      // Muros de Arame Farpado em todos os 4 lados (deixando vão do portão na frente)
      const addFenceLine = (x1, z1, x2, z2, count) => {
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const fx = x1 + (x2 - x1) * t;
          const fz = z1 + (z2 - z1) * t;
          const post = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
          post.scale.set(1.3, 14, 1.3);
          post.position.set(fx, 7, fz);
          g.add(post);
          const coil = new THREE.Mesh(this.geometries.torusWire, this.materials.razorSteel);
          coil.position.set(fx, 9, fz);
          g.add(coil);
        }
      };
      addFenceLine(-66, -56, 66, -56, 8); // Norte
      addFenceLine(-66, -56, -66, 56, 7); // Oeste
      addFenceLine(66, -56, 66, 56, 7);   // Leste
      addFenceLine(-66, 56, -16, 56, 3);  // Sul Esq
      addFenceLine(16, 56, 66, 56, 3);    // Sul Dir

      // Portão com Cancela
      const gateArm = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
      );
      gateArm.scale.set(28, 2.2, 2.2);
      gateArm.position.set(0, 10, 56);
      g.add(gateArm);
    } else {
      // Comando Aéreo / Radar: Edifício Técnico + Torre de Controle Envidraçada + Parabólica Rotativa + Geradores + Luzes Piscantes
      const pad = new THREE.Mesh(this.geometries.box, this.materials.concrete);
      pad.scale.set(148, 2, 124);
      pad.position.y = 1;
      pad.receiveShadow = true;
      g.add(pad);

      const base = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      base.scale.set(84, 24, 66);
      base.position.set(-18, 12, 4);
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      // Geradores Externos
      for (const gz of [-14, 14]) {
        const gen = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
        gen.scale.set(16, 12, 18);
        gen.position.set(-64, 6, gz);
        gen.castShadow = true;
        g.add(gen);
      }

      // Torre de Controle Envidraçada (Vidros Azulados Reflexivos)
      const tower = new THREE.Mesh(this.geometries.cyl, this.materials.concrete);
      tower.scale.set(20, 52, 20);
      tower.position.set(34, 26, -10);
      tower.castShadow = true;
      g.add(tower);

      const controlGlass = new THREE.Mesh(this.geometries.cyl, this.materials.glass);
      controlGlass.scale.set(26, 13, 26);
      controlGlass.position.set(34, 58, -10);
      g.add(controlGlass);

      const towerCap = new THREE.Mesh(this.geometries.cyl, this.materials.concreteDark);
      towerCap.scale.set(28, 4, 28);
      towerCap.position.set(34, 66, -10);
      g.add(towerCap);

      // Parabólica de Radar Rotativa Gigante no Topo
      const dishGroup = new THREE.Group();
      dishGroup.position.set(34, 78, -10);
      const dishPedestal = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      dishPedestal.scale.set(3, 12, 3);
      dishPedestal.position.y = -6;
      dishGroup.add(dishPedestal);
      const dish = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
      dish.scale.set(44, 18, 4);
      dish.rotation.x = -0.25;
      dishGroup.add(dish);
      const feedHorn = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      feedHorn.rotation.x = Math.PI / 2;
      feedHorn.scale.set(1.5, 12, 1.5);
      feedHorn.position.set(0, 0, 8);
      dishGroup.add(feedHorn);
      g.add(dishGroup);
      g.userData.dishGroup = dishGroup;

      // Luzes Vermelhas Piscantes de Aviação
      const aviationLights = [];
      for (const lx of [-46, 34]) {
        const avMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 1.5,
        });
        const avLight = new THREE.Mesh(this.geometries.sphere, avMat);
        avLight.scale.set(2.8, 2.8, 2.8);
        avLight.position.set(lx, lx > 0 ? 70 : 27, lx > 0 ? 4 : -24);
        g.add(avLight);
        aviationLights.push(avMat);
      }
      g.userData.aviationLights = aviationLights;
    }

    return g;
  }

  _createAircraftMesh(air) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3b444b, roughness: 0.5, metalness: 0.5 });

    const fuselage = new THREE.Mesh(this.geometries.cyl, mat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scale.set(9, 68, 9);
    g.add(fuselage);

    const wings = new THREE.Mesh(this.geometries.box, mat);
    wings.scale.set(84, 2.2, 16);
    wings.position.set(0, 1, 2);
    g.add(wings);

    const tail = new THREE.Mesh(this.geometries.box, mat);
    tail.scale.set(28, 2, 10);
    tail.position.set(0, 2, -28);
    g.add(tail);

    if (air.type === 'a10_strafe') {
      for (const s of [-10, 10]) {
        const eng = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
        eng.rotation.x = Math.PI / 2;
        eng.scale.set(6, 16, 6);
        eng.position.set(s, 6, -14);
        g.add(eng);
      }
    }

    return g;
  }

  _buildRoadMeshes(map, maxAniso = 8) {
    const roadTex = createRoadSurfaceTexture(map.theme || 'rural');
    roadTex.anisotropy = maxAniso;

    // AlphaMap para misturar suavemente as bordas irregulares da estrada na grama
    const aCanvas = document.createElement('canvas');
    aCanvas.width = 64;
    aCanvas.height = 16;
    const actx = aCanvas.getContext('2d');
    const aGrad = actx.createLinearGradient(0, 0, 64, 0);
    aGrad.addColorStop(0, '#000000');
    aGrad.addColorStop(0.16, '#ffffff');
    aGrad.addColorStop(0.84, '#ffffff');
    aGrad.addColorStop(1, '#000000');
    actx.fillStyle = aGrad;
    actx.fillRect(0, 0, 64, 16);
    const alphaTex = new THREE.CanvasTexture(aCanvas);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      alphaMap: alphaTex,
      transparent: true,
      roughness: 0.78,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    for (const rd of map.roads || []) {
      if (!rd.points || rd.points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(
        rd.points.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );
      const segs = 220;
      const widthSegs = 4;
      const baseHw = Math.max(34, Math.min(44, (rd.width || 80) * 0.45));
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const pt = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const nx = -tan.z;
        const nz = tan.x;
        const nLen = Math.hypot(nx, nz) || 1;
        const ux = nx / nLen;
        const uz = nz / nLen;

        // Largura orgânica variando entre 6.5m e 8.5m + bordas irregulares com ruído
        const noiseW = Math.sin(t * 42 + pt.x * 0.004) * 5.5 + Math.cos(t * 95 + pt.z * 0.005) * 3.5;
        const hw = baseHw + noiseW;

        for (let j = 0; j <= widthSegs; j++) {
          const u = j / widthSegs;
          const edgeJitter =
            j === 0 || j === widthSegs
              ? Math.sin(t * 130 + j * 3.1 + pt.x * 0.01) * 4.5
              : 0;
          const off = (u * 2 - 1) * hw + edgeJitter;
          const vx = pt.x + ux * off;
          const vz = pt.z + uz * off;
          const vy = getTerrainHeight(vx, vz, map) + 1.2;
          positions.push(vx, vy, vz);
          uvs.push(u, t);
        }

        if (i < segs) {
          const rowStride = widthSegs + 1;
          for (let j = 0; j < widthSegs; j++) {
            const a = i * rowStride + j;
            const b = a + 1;
            const c = (i + 1) * rowStride + j;
            const d = c + 1;
            indices.push(a, b, c, b, d, c);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
    }
  }

  // Linha de Trem & Pátio Ferroviário (Dormentes, Trilhos, Vagões, Guindaste Treliçado e Muros Pré-Moldados)
  _buildRailways(map) {
    for (const rw of map.railways || []) {
      const yPos = rw.y;
      const len = rw.xEnd - rw.xStart;
      const midX = (rw.xStart + rw.xEnd) * 0.5;

      // Lastro de brita
      const ballast = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      ballast.scale.set(len, 1.4, 34);
      ballast.position.set(midX, getTerrainHeight(midX, yPos, map) + 0.7, yPos);
      ballast.receiveShadow = true;
      this.worldGroup.add(ballast);

      // Trilhos de aço paralelos
      for (const rz of [-8, 8]) {
        const rail = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
        rail.scale.set(len, 1.6, 1.8);
        rail.position.set(midX, getTerrainHeight(midX, yPos + rz, map) + 2.2, yPos + rz);
        this.worldGroup.add(rail);
      }

      // Dormentes de madeira (InstancedMesh)
      const sleeperCount = Math.floor(len / 22);
      const sleepers = new THREE.InstancedMesh(
        this.geometries.box,
        this.materials.trenchDarkTimber,
        sleeperCount
      );
      const dummy = new THREE.Object3D();
      for (let i = 0; i < sleeperCount; i++) {
        const sx = rw.xStart + i * 22;
        dummy.position.set(sx, getTerrainHeight(sx, yPos, map) + 1.5, yPos);
        dummy.scale.set(5.5, 1.4, 24);
        dummy.updateMatrix();
        sleepers.setMatrixAt(i, dummy.matrix);
      }
      this.worldGroup.add(sleepers);

      // Pátio Ferroviário: Vagões de carga vermelhos/enferrujados, guindaste treliçado, caixas com lona e muros pré-moldados
      const yardX = rw.yardX || 4800;
      const yardY = getTerrainHeight(yardX, yPos, map);
      const carPositions = [yardX - 180, yardX - 55, yardX + 95];
      carPositions.forEach((cx, idx) => {
        const car = new THREE.Mesh(
          this.geometries.box,
          idx % 2 === 0 ? this.materials.brickBarn : this.materials.rustMetal
        );
        car.scale.set(84, 24, 22);
        car.position.set(cx, yardY + 15, yPos);
        car.castShadow = true;
        car.receiveShadow = true;
        this.worldGroup.add(car);
      });

      // Torre/Pórtico Treliçado do Guindaste Ferroviário
      for (const lx of [yardX - 30, yardX + 30]) {
        const leg = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
        leg.scale.set(4.5, 58, 4.5);
        leg.position.set(lx, yardY + 29, yPos + 38);
        leg.castShadow = true;
        this.worldGroup.add(leg);
      }
      const craneBeam = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
      craneBeam.scale.set(76, 5, 8);
      craneBeam.position.set(yardX, yardY + 58, yPos + 38);
      craneBeam.castShadow = true;
      this.worldGroup.add(craneBeam);

      // Pilhas de caixas com lona + Muros de concreto pré-moldado cercando o pátio
      const tarpStack = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
      tarpStack.scale.set(34, 14, 20);
      tarpStack.position.set(yardX - 120, yardY + 7, yPos + 52);
      tarpStack.castShadow = true;
      this.worldGroup.add(tarpStack);

      for (let w = -2; w <= 2; w++) {
        if (w === 0) continue;
        const wall = new THREE.Mesh(this.geometries.box, this.materials.concrete);
        wall.scale.set(52, 14, 4);
        wall.position.set(yardX + w * 65, yardY + 7, yPos + 76);
        wall.castShadow = true;
        this.worldGroup.add(wall);
      }
    }
  }

  _buildTreelines(map) {
    const count = map.trees.length;
    if (count === 0) return;

    const isDesert = map.theme === 'desert';
    const isWinter = map.theme === 'winter';
    const trunkMat = new THREE.MeshStandardMaterial({
      color: isDesert ? 0x6b5338 : 0x4a3520,
      roughness: 0.96,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: false,
    });

    // Três variações: Pinheiros Altos (7.0m a 10.5m), Palmeiras de Oásis & Árvores de Campo
    const pineTrees = [];
    const palmTrees = [];
    const oakTrees = [];
    map.trees.forEach((t, idx) => {
      if (t.isPalm) palmTrees.push(t);
      else if (t.isPine || isWinter || (idx % 2 === 0 && !isDesert)) pineTrees.push(t);
      else oakTrees.push(t);
    });

    // Zonas de Floresta Fechada (chão de musgo/folhagem + troncos caídos para identificação visual imediata)
    for (const fz of map.forestZones || []) {
      const fDisc = new THREE.Mesh(
        new THREE.CircleGeometry(fz.radius, 24),
        new THREE.MeshStandardMaterial({
          color: isDesert ? 0x6b7c3e : isWinter ? 0x3b4d3e : 0x2a421e,
          roughness: 0.98,
          transparent: true,
          opacity: 0.52,
        })
      );
      fDisc.rotation.x = -Math.PI / 2;
      fDisc.position.set(fz.x, getTerrainHeight(fz.x, fz.y, map) + 0.55, fz.y);
      fDisc.receiveShadow = true;
      this.worldGroup.add(fDisc);

      for (let li = 0; li < 4; li++) {
        const ang = li * 1.6;
        const lx = fz.x + Math.cos(ang) * (fz.radius * 0.45);
        const lz = fz.y + Math.sin(ang) * (fz.radius * 0.45);
        const log = new THREE.Mesh(this.geometries.cyl, trunkMat);
        log.scale.set(2.4, 24, 2.4);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = ang + 0.5;
        log.position.set(lx, getTerrainHeight(lx, lz, map) + 2.2, lz);
        log.castShadow = true;
        this.worldGroup.add(log);
      }
    }

    // Cemitérios Rurais & Postos de Controle Abandonados
    for (const cem of map.cemeteryProps || []) {
      const cg = new THREE.Group();
      cg.position.set(cem.x, getTerrainHeight(cem.x, cem.y, map), cem.y);
      for (let r = -1; r <= 1; r++) {
        for (let c = -2; c <= 2; c++) {
          const stone = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
          stone.scale.set(3.5, 8.5, 1.8);
          stone.position.set(c * 18, 4.2, r * 22);
          stone.castShadow = true;
          cg.add(stone);
        }
      }
      this.worldGroup.add(cg);
    }
    for (const cp of map.checkpointProps || []) {
      const cpg = new THREE.Group();
      cpg.position.set(cp.x, getTerrainHeight(cp.x, cp.y, map), cp.y);
      const booth = new THREE.Mesh(this.geometries.box, this.materials.wood);
      booth.scale.set(16, 22, 16);
      booth.position.set(0, 11, 0);
      booth.castShadow = true;
      const bar = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
      );
      bar.scale.set(26, 2, 2);
      bar.position.set(18, 8, 0);
      bar.rotation.z = 0.28;
      cpg.add(booth, bar);
      this.worldGroup.add(cpg);
    }

    // Palmeiras de Oásis
    if (palmTrees.length > 0) {
      const palmMat = new THREE.MeshStandardMaterial({ color: 0x4b752c, roughness: 0.85 });
      const pTrunks = new THREE.InstancedMesh(this.geometries.cyl, trunkMat, palmTrees.length);
      const pCrowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 0.35, 7), palmMat, palmTrees.length);
      palmTrees.forEach((t, i) => {
        const sc = 0.9 + ((t.scale || 1) - 0.9) * 0.4;
        const gy = getTerrainHeight(t.x, t.y, map);
        dummy.position.set(t.x, gy + 32 * sc, t.y);
        dummy.rotation.set(0.06, (t.foliageTone || 0.5) * 6.28, 0.04);
        dummy.scale.set(2.5 * sc, 64 * sc, 2.5 * sc);
        dummy.updateMatrix();
        pTrunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, gy + 64 * sc, t.y);
        dummy.rotation.set(0, (t.foliageTone || 0.5) * 6.28, 0);
        dummy.scale.set(24 * sc, 18 * sc, 24 * sc);
        dummy.updateMatrix();
        pCrowns.setMatrixAt(i, dummy.matrix);
      });
      pTrunks.castShadow = true;
      pCrowns.castShadow = true;
      this.worldGroup.add(pTrunks, pCrowns);
    }

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const palettePine = [0x1e3f20, 0x264d26, 0x2f5a2b, 0x3a6330];
    const paletteDesert = [0x516831, 0x65783a, 0x475e2b];
    const paletteWinter = [0x213d2b, 0x2b4a36, 0x1b3324];
    const pal = isDesert ? paletteDesert : isWinter ? paletteWinter : palettePine;

    // 1. Pinheiros Militares Altos (7.0m–10.5m de altura, copa base 3.0m–4.5m, 5 camadas de cones de 8 lados)
    if (pineTrees.length > 0) {
      const pineCone = new THREE.ConeGeometry(1, 1, 8);
      const pTrunks = new THREE.InstancedMesh(this.geometries.cyl, trunkMat, pineTrees.length);
      const pLayers = [
        new THREE.InstancedMesh(pineCone, leafMat, pineTrees.length),
        new THREE.InstancedMesh(pineCone, leafMat, pineTrees.length),
        new THREE.InstancedMesh(pineCone, leafMat, pineTrees.length),
        new THREE.InstancedMesh(pineCone, leafMat, pineTrees.length),
        new THREE.InstancedMesh(pineCone, leafMat, pineTrees.length),
      ];

      [pTrunks, ...pLayers].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });

      const layerSpecs = [
        { y: 31, r: 19.5, h: 25 },
        { y: 45, r: 16.2, h: 23 },
        { y: 59, r: 12.8, h: 21 },
        { y: 72, r: 9.4, h: 19 },
        { y: 84, r: 6.0, h: 16 },
      ];

      pineTrees.forEach((t, i) => {
        // Escala total entre 7.0m (70u) e 10.5m (105u) de altura; base da copa 3.0m–4.5m (15u–22.5u raio)
        const hScale = 0.78 + ((t.scale || 1.0) - 0.85) * 0.45;
        const wScale = 0.82 + (t.foliageTone || 0.5) * 0.34;
        const gy = getTerrainHeight(t.x, t.y, map);
        const yaw = (t.foliageTone || 0.5) * Math.PI * 2;

        dummy.position.set(t.x, gy + 16 * hScale, t.y);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(3.2 * wScale, 32 * hScale, 3.2 * wScale);
        dummy.updateMatrix();
        pTrunks.setMatrixAt(i, dummy.matrix);

        layerSpecs.forEach((spec, li) => {
          dummy.position.set(t.x, gy + spec.y * hScale, t.y);
          dummy.rotation.set(0, yaw + li * 0.45, 0);
          dummy.scale.set(spec.r * wScale, spec.h * hScale, spec.r * wScale);
          dummy.updateMatrix();
          pLayers[li].setMatrixAt(i, dummy.matrix);

          col.setHex(pal[(i + li) % pal.length]);
          col.offsetHSL(0, 0, li * 0.015);
          pLayers[li].setColorAt(i, col);
        });
      });

      pLayers.forEach((m) => {
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
      this.worldGroup.add(pTrunks, ...pLayers);
    }

    // 2. Árvores de Campo (Carvalhos/Bétulas com esferas suaves em verde-oliva militar)
    if (oakTrees.length > 0) {
      const smoothSphere = new THREE.SphereGeometry(1, 12, 10);
      const oTrunks = new THREE.InstancedMesh(this.geometries.cyl, trunkMat, oakTrees.length);
      const oCrownA = new THREE.InstancedMesh(smoothSphere, leafMat, oakTrees.length);
      const oCrownB = new THREE.InstancedMesh(smoothSphere, leafMat, oakTrees.length);

      [oTrunks, oCrownA, oCrownB].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });

      oakTrees.forEach((t, i) => {
        const hScale = 0.82 + ((t.scale || 1) - 0.9) * 0.42; // 3.5m a 5.0m total
        const gy = getTerrainHeight(t.x, t.y, map);
        const yaw = (t.foliageTone || 0.5) * Math.PI * 2;

        dummy.position.set(t.x, gy + 10 * hScale, t.y);
        dummy.rotation.set(0, yaw, (t.foliageTone - 0.5) * 0.06);
        dummy.scale.set(2.8 * hScale, 20 * hScale, 2.8 * hScale);
        dummy.updateMatrix();
        oTrunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, gy + 26 * hScale, t.y);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(12.5 * hScale, 9.5 * hScale, 12.5 * hScale);
        dummy.updateMatrix();
        oCrownA.setMatrixAt(i, dummy.matrix);

        dummy.position.set(
          t.x + Math.cos(yaw) * 4.5 * hScale,
          gy + 31 * hScale,
          t.y + Math.sin(yaw) * 4.5 * hScale
        );
        dummy.scale.set(9.2 * hScale, 7.5 * hScale, 9.2 * hScale);
        dummy.updateMatrix();
        oCrownB.setMatrixAt(i, dummy.matrix);

        col.setHex(pal[(i + 1) % pal.length]);
        oCrownA.setColorAt(i, col);
        col.offsetHSL(0.015, 0, 0.04);
        oCrownB.setColorAt(i, col);
      });

      [oCrownA, oCrownB].forEach((m) => {
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
      this.worldGroup.add(oTrunks, oCrownA, oCrownB);
    }
  }

  _buildUndergrowthAndDetails(map) {
    const isDesert = map.theme === 'desert';
    const isWinter = map.theme === 'winter';
    const density = this.vegDensity || 1.0;
    const dummy = new THREE.Object3D();

    // 1. Vegetação Rasteira Orgânica (Moitas baixas e tufos arredondados — sem placas verticais retangulares)
    const grassCount = Math.floor((isDesert ? 1600 : 3800) * density);
    if (grassCount > 0) {
      const clumpGeo = new THREE.SphereGeometry(1, 7, 5);
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.94,
      });
      const grassMesh = new THREE.InstancedMesh(clumpGeo, grassMat, grassCount);
      grassMesh.receiveShadow = true;

      const grassCol = new THREE.Color();
      const grassPal = isDesert
        ? [0x9b8d50, 0xb09e58, 0x827842]
        : [0x426128, 0x365221, 0x556e2d, 0x747c38];

      for (let i = 0; i < grassCount; i++) {
        let gx, gz;
        if (i < map.trees.length && i % 2 === 0) {
          const tr = map.trees[i % map.trees.length];
          gx = tr.x + Math.sin(i * 17.3) * 58;
          gz = tr.y + Math.cos(i * 23.1) * 58;
        } else {
          gx = 380 + ((i * 1973) % (map.size - 760));
          gz = 380 + ((i * 3517) % (map.size - 760));
        }
        const onPad = (map.flattenedPads || []).some(
          (p) => Math.hypot(gx - p.x, gz - p.y) < p.radius + 18
        );
        const onRoad = map.isOnRoad ? map.isOnRoad(gx, gz, 12) : false;
        const gy = getTerrainHeight(gx, gz, map);
        const rx = onPad || onRoad ? 0.001 : 3.8 + (i % 5) * 0.95;
        const ry = onPad || onRoad ? 0.001 : 2.0 + (i % 4) * 0.55;
        const rz = onPad || onRoad ? 0.001 : 3.6 + ((i * 3) % 5) * 0.9;
        dummy.position.set(gx, gy + ry * 0.42, gz);
        dummy.rotation.set(0, (i * 1.7) % Math.PI, 0);
        dummy.scale.set(rx, ry, rz);
        dummy.updateMatrix();
        grassMesh.setMatrixAt(i, dummy.matrix);
        grassCol.setHex(grassPal[i % grassPal.length]);
        grassMesh.setColorAt(i, grassCol);
      }
      if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
      this.worldGroup.add(grassMesh);
    }

    // 1b. Arbustos Densos Volumétricos & Sebes Táticas (map.bushes — 3 esferas achatadas por moita, 1.2–2.2m)
    const bushes = map.bushes || [];
    if (bushes.length > 0) {
      const bushGeo = new THREE.SphereGeometry(1, 10, 8);
      const bushMat = new THREE.MeshStandardMaterial({
        color: isDesert ? 0x6c743a : isWinter ? 0xcad6df : 0x3c5b25,
        roughness: 0.92,
      });
      const bLobeA = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      const bLobeB = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      const bLobeC = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      [bLobeA, bLobeB, bLobeC].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });
      bushes.forEach((b, i) => {
        const sc = b.scale || 1;
        const by = getTerrainHeight(b.x, b.y, map);
        dummy.position.set(b.x, by + 5.5 * sc, b.y);
        dummy.rotation.set(0, i * 0.9, 0);
        dummy.scale.set(9.5 * sc, 6.8 * sc, 9.5 * sc);
        dummy.updateMatrix();
        bLobeA.setMatrixAt(i, dummy.matrix);

        dummy.position.set(b.x + 6.5 * sc, by + 4.5 * sc, b.y + 3.5 * sc);
        dummy.scale.set(7.5 * sc, 5.4 * sc, 7.5 * sc);
        dummy.updateMatrix();
        bLobeB.setMatrixAt(i, dummy.matrix);

        dummy.position.set(b.x - 5.5 * sc, by + 4.8 * sc, b.y - 4.0 * sc);
        dummy.scale.set(7.2 * sc, 5.8 * sc, 7.2 * sc);
        dummy.updateMatrix();
        bLobeC.setMatrixAt(i, dummy.matrix);
      });
      this.worldGroup.add(bLobeA, bLobeB, bLobeC);
    }

    // 2. Rochas & Pedras nas Colinas e Margens das Estradas
    const rockCount = Math.floor(260 * density);
    if (rockCount > 0) {
      const rockGeo = new THREE.DodecahedronGeometry(6.5, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: isDesert ? 0x8b7355 : 0x6b6d67,
        roughness: 0.94,
      });
      const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      for (let i = 0; i < rockCount; i++) {
        const rx = 500 + ((i * 2909) % (map.size - 1000));
        const rz = 500 + ((i * 4127) % (map.size - 1000));
        const ry = getTerrainHeight(rx, rz, map);
        const sx = 0.7 + (i % 5) * 0.35;
        const sy = 0.5 + (i % 3) * 0.25;
        dummy.position.set(rx, ry + 2.2 * sy, rz);
        dummy.rotation.set(i * 0.4, i * 1.1, i * 0.3);
        dummy.scale.set(sx, sy, sx * 0.85);
        dummy.updateMatrix();
        rockMesh.setMatrixAt(i, dummy.matrix);
      }
      this.worldGroup.add(rockMesh);
    }

    // 3. Troncos Caídos nos Bosques
    const logCount = Math.min(130, Math.floor(map.trees.length * 0.12));
    if (logCount > 0) {
      const logMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1d, roughness: 0.96 });
      const logMesh = new THREE.InstancedMesh(this.geometries.cyl, logMat, logCount);
      logMesh.castShadow = true;
      logMesh.receiveShadow = true;
      for (let i = 0; i < logCount; i++) {
        const tr = map.trees[(i * 7) % map.trees.length];
        const lx = tr.x + Math.cos(i) * 28;
        const lz = tr.y + Math.sin(i) * 28;
        const ly = getTerrainHeight(lx, lz, map);
        dummy.position.set(lx, ly + 2.2, lz);
        dummy.rotation.set(Math.PI * 0.5, i * 0.9, 0.08);
        dummy.scale.set(2.4, 24, 2.4);
        dummy.updateMatrix();
        logMesh.setMatrixAt(i, dummy.matrix);
      }
      this.worldGroup.add(logMesh);
    }

    // 4. Fardos de Feno Cilíndricos nos Campos Agrícolas (Normandia)
    if (!isDesert) {
      const hayFields = map.fields.filter((f) => f.type === 'wheat' || f.type === 'pasture');
      const bales = [];
      for (const f of hayFields) {
        for (let b = 0; b < 16; b++) {
          const bx = f.x + 120 + ((b * 431) % Math.max(200, f.w - 240));
          const bz = f.y + 120 + ((b * 293) % Math.max(200, f.h - 240));
          bales.push({ x: bx, z: bz, a: b * 0.7 });
        }
      }
      if (bales.length > 0) {
        const hayMat = new THREE.MeshStandardMaterial({ color: 0xc2a24a, roughness: 0.95 });
        const hayMesh = new THREE.InstancedMesh(this.geometries.cyl, hayMat, bales.length);
        hayMesh.castShadow = true;
        hayMesh.receiveShadow = true;
        bales.forEach((b, idx) => {
          const by = getTerrainHeight(b.x, b.z, map);
          dummy.position.set(b.x, by + 5.2, b.z);
          dummy.rotation.set(Math.PI * 0.5, b.a, 0);
          dummy.scale.set(5.2, 11, 5.2);
          dummy.updateMatrix();
          hayMesh.setMatrixAt(idx, dummy.matrix);
        });
        this.worldGroup.add(hayMesh);
      }
    }

    // 5. Cercas Rurais de Madeira ao Redor dos Campos
    const fenceSegs = [];
    for (const f of map.fields) {
      for (let k = 0; k < 10; k++) {
        const fx = f.x + (k / 10) * f.w;
        fenceSegs.push({ x: fx, z: f.y, rot: f.angle || 0 });
        fenceSegs.push({ x: fx, z: f.y + f.h, rot: f.angle || 0 });
      }
    }
    if (fenceSegs.length > 0) {
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x5c4329, roughness: 0.95 });
      const fenceMesh = new THREE.InstancedMesh(this.geometries.box, fenceMat, fenceSegs.length);
      fenceMesh.castShadow = true;
      fenceSegs.forEach((fs, idx) => {
        const fy = getTerrainHeight(fs.x, fs.z, map);
        dummy.position.set(fs.x, fy + 4.5, fs.z);
        dummy.rotation.set((idx % 3 === 0 ? 0.14 : 0), fs.rot, 0);
        dummy.scale.set(36, 9, 2.2);
        dummy.updateMatrix();
        fenceMesh.setMatrixAt(idx, dummy.matrix);
      });
      this.worldGroup.add(fenceMesh);
    }

    // 6. Postes de Madeira ao Longo da Estrada Principal
    const mainRoad = map.roads[0];
    if (mainRoad && mainRoad.points.length >= 2) {
      const poles = [];
      for (let i = 0; i < mainRoad.points.length - 1; i++) {
        const a = mainRoad.points[i];
        const b = mainRoad.points[i + 1];
        for (let s = 0; s < 10; s++) {
          const t = s / 10;
          const px = a.x + (b.x - a.x) * t;
          const pz = a.y + (b.y - a.y) * t + (mainRoad.width * 0.65 + 22);
          poles.push({ x: px, z: pz });
        }
      }
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b3826, roughness: 0.95 });
      const poleMesh = new THREE.InstancedMesh(this.geometries.cyl, poleMat, poles.length);
      poleMesh.castShadow = true;
      poles.forEach((p, idx) => {
        const py = getTerrainHeight(p.x, p.z, map);
        dummy.position.set(p.x, py + 20, p.z);
        dummy.rotation.set(0, 0, idx % 5 === 0 ? 0.07 : 0);
        dummy.scale.set(1.8, 40, 1.8);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(idx, dummy.matrix);
      });
      this.worldGroup.add(poleMesh);
    }
  }

  _createRuralStructureMesh(st) {
    const g = new THREE.Group();
    const { w, d, h, type } = st;

    // Fundação Sólida Elevada de Pedra/Concreto (0.35m = 3.5u de altura — elimina Z-fighting)
    if (type !== 'ruin') {
      const plinth = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      plinth.scale.set(w + 10, 3.5, d + 10);
      plinth.position.y = 1.75;
      plinth.receiveShadow = true;
      g.add(plinth);
    }

    if (type === 'windmill') {
      const base = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      base.scale.set(w * 0.75, h * 0.6, d);
      base.position.set(-w * 0.15, h * 0.3, 0);
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      const tower = new THREE.Mesh(this.geometries.cyl, this.materials.masonryStone);
      tower.scale.set(34, h * 1.25, 34);
      tower.position.set(w * 0.25, h * 0.62, 0);
      tower.castShadow = true;
      g.add(tower);

      const dome = new THREE.Mesh(this.geometries.cone, this.materials.roofSlate);
      dome.scale.set(32, 18, 32);
      dome.position.set(w * 0.25, h * 1.25 + 9, 0);
      g.add(dome);

      const hub = new THREE.Group();
      hub.position.set(w * 0.25, h * 1.05, 18);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
        blade.scale.set(4.5, 42, 1.2);
        blade.rotation.z = (i * Math.PI) / 2;
        hub.add(blade);
      }
      g.add(hub);
      this.windmillBlades.push(hub);
    } else if (type === 'church') {
      // Igreja de Vilarejo com Nave Principal e Torre do Sino Alta (Excelente para Snipers)
      const nave = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      nave.scale.set(w, h * 0.55, d);
      nave.position.set(0, h * 0.275, -d * 0.08);
      nave.castShadow = true;
      nave.receiveShadow = true;
      g.add(nave);

      const naveRoof = new THREE.Mesh(this.geometries.cone, this.materials.roofSlate);
      naveRoof.scale.set(w * 0.85, 18, d * 0.85);
      naveRoof.position.set(0, h * 0.55 + 9, -d * 0.08);
      naveRoof.rotation.y = Math.PI / 4;
      g.add(naveRoof);

      const bellTower = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      bellTower.scale.set(w * 0.42, h, d * 0.36);
      bellTower.position.set(0, h * 0.5, d * 0.32);
      bellTower.castShadow = true;
      g.add(bellTower);

      const spire = new THREE.Mesh(this.geometries.cone, this.materials.roofSlate);
      spire.scale.set(w * 0.38, 26, d * 0.38);
      spire.position.set(0, h + 13, d * 0.32);
      spire.rotation.y = Math.PI / 4;
      g.add(spire);
    } else if (type === 'two_story') {
      // Sobrado Urbano de 2 Andares nos Vilarejos
      const floor1 = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      floor1.scale.set(w, h * 0.5, d);
      floor1.position.y = h * 0.25;
      floor1.castShadow = true;
      floor1.receiveShadow = true;
      g.add(floor1);

      const floor2 = new THREE.Mesh(this.geometries.box, this.materials.plasterWarm);
      floor2.scale.set(w * 1.02, h * 0.5, d * 1.02);
      floor2.position.y = h * 0.75;
      floor2.castShadow = true;
      g.add(floor2);

      const addGableRoof = (rw, rd, baseY, mat) => {
        const slopeH = 14;
        const halfD = rd * 0.54;
        const slopeLen = Math.hypot(halfD, slopeH);
        const tilt = Math.atan2(slopeH, halfD);
        for (const side of [-1, 1]) {
          const panel = new THREE.Mesh(this.geometries.box, mat);
          panel.scale.set(rw + 8, 2.6, slopeLen);
          panel.position.set(0, baseY + slopeH * 0.5, side * halfD * 0.5);
          panel.rotation.x = side * tilt;
          panel.castShadow = true;
          panel.receiveShadow = true;
          g.add(panel);
        }
        const ridge = new THREE.Mesh(this.geometries.box, this.materials.wood);
        ridge.scale.set(rw + 9, 3, 3);
        ridge.position.set(0, baseY + slopeH, 0);
        g.add(ridge);
        const chimney = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
        chimney.scale.set(8, 16, 8);
        chimney.position.set(rw * 0.28, baseY + slopeH * 0.65, -rd * 0.16);
        chimney.castShadow = true;
        g.add(chimney);
      };

      addGableRoof(w * 1.02, d * 1.02, h, this.materials.roofTile);

      for (const side of [-1, 1]) {
        const winTop = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
        winTop.scale.set(10, 8, 1.6);
        winTop.position.set(side * (w * 0.25), h * 0.78, d * 0.51 + 0.5);
        g.add(winTop);
      }
    } else if (type === 'warehouse') {
      // Galpão Industrial Grande: alvenaria/concreto, telhado de zinco escuro em duas águas com claraboias, janelas e portas de correr
      const body = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      body.scale.set(w, h, d);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const slopeH = 16;
      const halfD = d * 0.54;
      const slopeLen = Math.hypot(halfD, slopeH);
      const tilt = Math.atan2(slopeH, halfD);
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(this.geometries.box, this.materials.roofSlate);
        panel.scale.set(w + 10, 3.0, slopeLen);
        panel.position.set(0, h + slopeH * 0.5, side * halfD * 0.5);
        panel.rotation.x = side * tilt;
        panel.castShadow = true;
        g.add(panel);

        // Claraboias retangulares no teto
        const skylight = new THREE.Mesh(this.geometries.box, this.materials.glass);
        skylight.scale.set(w * 0.55, 2.2, slopeLen * 0.35);
        skylight.position.set(0, h + slopeH * 0.56 + 1.5, side * halfD * 0.48);
        skylight.rotation.x = side * tilt;
        g.add(skylight);
      }

      // Portas de correr industriais + grandes janelas
      const slideDoor = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      slideDoor.scale.set(28, h * 0.68, 2.5);
      slideDoor.position.set(0, h * 0.34, d * 0.5 + 0.8);
      g.add(slideDoor);
      for (const side of [-1, 1]) {
        const indWin = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
        indWin.scale.set(22, 12, 1.8);
        indWin.position.set(side * (w * 0.32), h * 0.68, d * 0.5 + 0.6);
        g.add(indWin);
      }
    } else if (type === 'brick_ruin') {
      // Prédio Semi-Destruído em Tijolo Vermelho: metade do telhado desabado, treliça de madeira exposta e escombros
      const leftWall = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
      leftWall.scale.set(w * 0.55, h, d);
      leftWall.position.set(-w * 0.22, h * 0.5, 0);
      leftWall.castShadow = true;
      g.add(leftWall);

      const intactRoof = new THREE.Mesh(this.geometries.box, this.materials.roofSlate);
      intactRoof.scale.set(w * 0.58, 3.2, d + 6);
      intactRoof.position.set(-w * 0.22, h + 2, 0);
      intactRoof.rotation.z = -0.18;
      intactRoof.castShadow = true;
      g.add(intactRoof);

      // Paredes quebradas em degraus no lado direito
      for (let step = 0; step < 3; step++) {
        const stepH = h * (0.75 - step * 0.22);
        const brk = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
        brk.scale.set(w * 0.16, stepH, 6);
        brk.position.set(w * (0.12 + step * 0.14), stepH * 0.5, -d * 0.44);
        brk.castShadow = true;
        g.add(brk);
      }
      // Treliça de vigas de madeira expostas do telhado
      for (let t = 0; t < 4; t++) {
        const truss = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
        truss.scale.set(w * 0.48, 2.2, 2.4);
        truss.position.set(w * 0.18, h * 0.85, -d * 0.35 + t * (d * 0.22));
        truss.rotation.z = -0.24;
        g.add(truss);
      }
      // Montes de tijolos/escombros no chão
      for (let r = 0; r < 6; r++) {
        const rub = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
        rub.scale.set(10 + (r % 3) * 4, 4 + (r % 2) * 3, 9);
        rub.position.set(w * 0.18 + (r - 2.5) * 9, 2.5, (r % 3 - 1) * 18);
        rub.rotation.y = r * 0.8;
        g.add(rub);
      }
    } else if (type === 'gas_station') {
      // Posto de Combustível Abandonado com Cobertura e Bombas
      const office = new THREE.Mesh(this.geometries.box, this.materials.plasterWarm);
      office.scale.set(w * 0.65, h, d * 0.6);
      office.position.set(0, h * 0.5, -d * 0.2);
      office.castShadow = true;
      g.add(office);

      const canopy = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
      canopy.scale.set(w, 4, d * 0.55);
      canopy.position.set(0, h + 2, d * 0.25);
      canopy.castShadow = true;
      g.add(canopy);

      for (const px of [-w * 0.32, w * 0.32]) {
        const pillar = new THREE.Mesh(this.geometries.cyl, this.materials.concrete);
        pillar.scale.set(4, h + 2, 4);
        pillar.position.set(px, (h + 2) * 0.5, d * 0.38);
        g.add(pillar);

        const pump = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
        pump.scale.set(5, 9, 4);
        pump.position.set(px * 0.5, 4.5, d * 0.25);
        g.add(pump);
      }
    } else if (type === 'barn') {
      const body = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
      body.scale.set(w, h, d);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const slopeH = 15;
      const halfD = d * 0.54;
      const slopeLen = Math.hypot(halfD, slopeH);
      const tilt = Math.atan2(slopeH, halfD);
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(this.geometries.box, this.materials.roofSlate);
        panel.scale.set(w + 8, 2.8, slopeLen);
        panel.position.set(0, h + slopeH * 0.5, side * halfD * 0.5);
        panel.rotation.x = side * tilt;
        panel.castShadow = true;
        g.add(panel);
      }

      // Silo metálico e fardos de feno da Fazenda
      const silo = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      silo.scale.set(14, h * 1.35, 14);
      silo.position.set(w * 0.5 + 18, h * 0.675, -d * 0.15);
      silo.castShadow = true;
      g.add(silo);
      for (let hb = 0; hb < 3; hb++) {
        const hay = new THREE.Mesh(
          this.geometries.cyl,
          new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.95 })
        );
        hay.rotation.z = Math.PI / 2;
        hay.scale.set(5.5, 9, 5.5);
        hay.position.set(-w * 0.5 - 14, 5.5, -12 + hb * 13);
        g.add(hay);
      }
    } else if (type === 'adobe_house') {
      // Complexo Árabe Estilo CoH3: Casa em "L" de 1/2 Andares (Areia/Branco-Sujo/Azul-Desbotado) com Parapeito, Alçapão, Toldo e Contrafortes
      const palette = [0xd6bfa0, 0xe5dfd3, 0x8ea4b5];
      const wallHex = palette[Math.abs(Math.round(st.x + st.y)) % palette.length];
      const adobeMat = new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.92 });
      const body = new THREE.Mesh(this.geometries.box, adobeMat);
      body.scale.set(w * 0.82, h, d * 0.72);
      body.position.set(-w * 0.08, h * 0.5, -d * 0.1);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // Ala lateral em "L"
      const wing = new THREE.Mesh(this.geometries.box, adobeMat);
      wing.scale.set(w * 0.42, h * 0.65, d * 0.48);
      wing.position.set(w * 0.28, h * 0.325, d * 0.22);
      wing.castShadow = true;
      g.add(wing);

      // Mureta/parapeito do teto plano + Alçapão com escada
      const terraceRim = new THREE.Mesh(this.geometries.box, adobeMat);
      terraceRim.scale.set(w * 0.86, 4.8, d * 0.76);
      terraceRim.position.set(-w * 0.08, h + 2.4, -d * 0.1);
      g.add(terraceRim);
      const hatch = new THREE.Mesh(this.geometries.box, this.materials.wood);
      hatch.scale.set(12, 2.5, 12);
      hatch.position.set(-w * 0.16, h + 4.8, -d * 0.12);
      g.add(hatch);

      // Contrafortes nas paredes + Toldo de pano listrado
      for (const bx of [-w * 0.46, w * 0.32]) {
        const buttress = new THREE.Mesh(this.geometries.box, adobeMat);
        buttress.scale.set(6, h * 0.65, 10);
        buttress.position.set(bx, h * 0.325, d * 0.26);
        g.add(buttress);
      }
      const awning = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })
      );
      awning.scale.set(24, 1.5, 12);
      awning.position.set(-w * 0.12, h * 0.46, d * 0.28);
      awning.rotation.x = 0.28;
      g.add(awning);

      // Escada externa
      const stairs = new THREE.Mesh(this.geometries.box, adobeMat);
      stairs.scale.set(10, h * 0.72, 16);
      stairs.position.set(w * 0.42, h * 0.36, -d * 0.1);
      stairs.rotation.x = 0.35;
      g.add(stairs);
    } else if (type === 'oil_refinery') {
      // Complexo de Refinaria de Petróleo (Tanques cilíndricos enferrujados + tubulações + galpão)
      const shed = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      shed.scale.set(w * 0.45, h * 0.7, d * 0.65);
      shed.position.set(-w * 0.25, h * 0.35, 0);
      shed.castShadow = true;
      g.add(shed);

      for (const tz of [-d * 0.24, d * 0.24]) {
        const tank = new THREE.Mesh(this.geometries.cyl, this.materials.rustMetal);
        tank.scale.set(22, h * 0.85, 22);
        tank.position.set(w * 0.22, h * 0.425, tz);
        tank.castShadow = true;
        g.add(tank);
      }
      const pipe = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      pipe.rotation.z = Math.PI / 2;
      pipe.scale.set(2.8, w * 0.5, 2.8);
      pipe.position.set(0, h * 0.65, 0);
      g.add(pipe);
    } else if (type === 'column_ruins') {
      // Ruínas Antigas de Colunas de Pedra
      for (const cx of [-w * 0.32, 0, w * 0.32]) {
        for (const cz of [-d * 0.3, d * 0.3]) {
          const colH = cx === 0 && cz > 0 ? h * 0.45 : h * 0.92;
          const col = new THREE.Mesh(this.geometries.cyl, this.materials.masonryStone);
          col.scale.set(6.5, colH, 6.5);
          col.position.set(cx, colH * 0.5, cz);
          col.castShadow = true;
          g.add(col);
        }
      }
      const lintel = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      lintel.scale.set(w * 0.72, 5, 10);
      lintel.position.set(0, h * 0.94, -d * 0.3);
      g.add(lintel);
    } else if (type === 'sawmill') {
      // Serraria Abandonada com grandes pilhas de toras de madeira (cobertura pesada)
      const mill = new THREE.Mesh(this.geometries.box, this.materials.wood);
      mill.scale.set(w * 0.62, h * 0.8, d * 0.72);
      mill.position.set(-w * 0.18, h * 0.4, 0);
      mill.castShadow = true;
      g.add(mill);

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3 - row; col++) {
          const log = new THREE.Mesh(this.geometries.cyl, this.materials.trenchDarkTimber);
          log.rotation.x = Math.PI / 2;
          log.scale.set(4.5, d * 0.65, 4.5);
          log.position.set(w * 0.25 + col * 9 + row * 4.5, 5 + row * 7.5, 0);
          log.castShadow = true;
          g.add(log);
        }
      }
    } else if (type === 'bunker') {
      // Bunker de Concreto Congelado (Linha Siegfried) com fenda de tiro
      const body = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      body.scale.set(w, h, d);
      body.position.y = h * 0.5;
      body.castShadow = true;
      g.add(body);
      const slit = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
      slit.scale.set(w * 0.65, 4, 2);
      slit.position.set(0, h * 0.62, d * 0.5 + 0.5);
      g.add(slit);
      const snowCap = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
      snowCap.scale.set(w + 4, 3.2, d + 4);
      snowCap.position.y = h + 1.6;
      g.add(snowCap);
    } else if (type === 'ruin') {
      // Prédio Explodido: Paredes quebradas em formato irregular/denteado + vigas queimadas + escombros
      const segs = 5;
      for (let s = 0; s < segs; s++) {
        const segW = w / segs;
        const segH = h * (0.45 + ((s * 3) % 4) * 0.16);
        const bw = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
        bw.scale.set(segW + 1, segH, 6);
        bw.position.set(-w * 0.5 + segW * (s + 0.5), segH * 0.5, -d * 0.45);
        bw.castShadow = true;
        g.add(bw);
      }

      const wall2 = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      wall2.scale.set(6, h * 0.72, d * 0.82);
      wall2.position.set(-w * 0.45, h * 0.36, -d * 0.08);
      wall2.castShadow = true;
      g.add(wall2);

      const wall3 = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      wall3.scale.set(w * 0.48, h * 0.48, 6);
      wall3.position.set(-w * 0.22, h * 0.24, d * 0.45);
      wall3.castShadow = true;
      g.add(wall3);

      // Vigas de madeira queimadas aparentes do telhado desabado
      for (let b = 0; b < 4; b++) {
        const beam = new THREE.Mesh(this.geometries.box, this.materials.burnedMetal);
        beam.scale.set(w * 0.75, 2.8, 3.2);
        beam.position.set((b - 1.5) * 8, h * 0.45 - b * 2, (b - 1.5) * 10);
        beam.rotation.set(0.18, b * 0.35, -0.22);
        beam.castShadow = true;
        g.add(beam);
      }

      // Montes de escombros e tijolos no chão
      for (let i = 0; i < 10; i++) {
        const rub = new THREE.Mesh(
          this.geometries.box,
          i % 2 === 0 ? this.materials.concreteDark : this.materials.brickBarn
        );
        rub.scale.set(10 + (i % 3) * 4, 4 + (i % 4) * 2.5, 9 + (i % 2) * 4);
        rub.position.set((i - 4.5) * 9, 2.5, (i % 3 - 1) * 16);
        rub.rotation.set(0.15 * (i % 3), i * 0.7, 0.1);
        g.add(rub);
      }
    } else {
      // Casa Europeia/Rural Intacta com Telhado de Duas Águas, Chaminé, Porta de Madeira e Molduras
      const body = new THREE.Mesh(this.geometries.box, this.materials.plasterWarm);
      body.scale.set(w, h, d);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const slopeH = 14;
      const halfD = d * 0.54;
      const slopeLen = Math.hypot(halfD, slopeH);
      const tilt = Math.atan2(slopeH, halfD);
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(this.geometries.box, this.materials.roofTile);
        panel.scale.set(w + 8, 2.6, slopeLen);
        panel.position.set(0, h + slopeH * 0.5, side * halfD * 0.5);
        panel.rotation.x = side * tilt;
        panel.castShadow = true;
        panel.receiveShadow = true;
        g.add(panel);
      }
      const chimney = new THREE.Mesh(this.geometries.box, this.materials.brickBarn);
      chimney.scale.set(7, 15, 7);
      chimney.position.set(w * 0.28, h + slopeH * 0.65, -d * 0.16);
      chimney.castShadow = true;
      g.add(chimney);

      const door = new THREE.Mesh(this.geometries.box, this.materials.wood);
      door.scale.set(9, 14, 2);
      door.position.set(0, 7, d * 0.5 + 0.6);
      g.add(door);

      // Detalhes enxaimel (vigas de madeira nas quinas, faixas horizontais, alpendre e muretas de pedra)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const cornerBeam = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
          cornerBeam.scale.set(2.6, h, 2.6);
          cornerBeam.position.set(sx * (w * 0.48), h * 0.5, sz * (d * 0.48));
          g.add(cornerBeam);
        }
      }
      const tieBeam = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      tieBeam.scale.set(w + 1.2, 2.0, d + 1.2);
      tieBeam.position.set(0, h * 0.68, 0);
      g.add(tieBeam);

      const porchRoof = new THREE.Mesh(this.geometries.box, this.materials.roofSlate);
      porchRoof.scale.set(18, 2, 10);
      porchRoof.position.set(0, 15, d * 0.5 + 4);
      porchRoof.rotation.x = 0.22;
      g.add(porchRoof);

      for (const wx of [-w * 0.3, w * 0.3]) {
        const yardWall = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
        yardWall.scale.set(w * 0.36, 6.5, 3.2);
        yardWall.position.set(wx, 3.2, d * 0.5 + 14);
        g.add(yardWall);
      }
    }

    for (const side of [-1, 1]) {
      const winFrame = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      winFrame.scale.set(12.6, 10.2, 1.4);
      winFrame.position.set(side * (w * 0.24), h * 0.42, d * 0.5 + 0.2);
      g.add(winFrame);

      const win = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
      win.scale.set(9.6, 7.6, 1.8);
      win.position.set(side * (w * 0.24), h * 0.42, d * 0.5 + 0.5);
      g.add(win);

      // Venezianas laterais e peitoril
      for (const sh of [-1, 1]) {
        const shutter = new THREE.Mesh(this.geometries.box, this.materials.wood);
        shutter.scale.set(2.4, 8.6, 1.2);
        shutter.position.set(side * (w * 0.24) + sh * 6.5, h * 0.42, d * 0.5 + 0.6);
        g.add(shutter);
      }
      const sill = new THREE.Mesh(this.geometries.box, this.materials.masonryStone);
      sill.scale.set(13.5, 1.6, 2.8);
      sill.position.set(side * (w * 0.24), h * 0.42 - 5.2, d * 0.5 + 0.8);
      g.add(sill);
    }

    for (let i = -2; i <= 2; i++) {
      const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
      sb.scale.set(5.5, 2.6, 3.4);
      sb.position.set(i * 9, 2.4, d * 0.5 + 7);
      g.add(sb);
    }

    const muzzle = new THREE.Mesh(this.geometries.sphere, this.materials.muzzle);
    muzzle.scale.set(6, 6, 6);
    muzzle.position.set(0, h * 0.6, d * 0.5 + 6);
    muzzle.visible = false;
    g.add(muzzle);

    g.userData = { muzzle };
    return g;
  }

  _createWreckMesh(wrk) {
    const g = new THREE.Group();
    if (wrk.type === 'tank' || wrk.type === 'DestroyedTank') {
      const hull = new THREE.Mesh(this.geometries.box, this.materials.charredMetal);
      hull.scale.set(28, 11, 46);
      hull.position.y = 5.5;
      hull.rotation.z = 0.08;
      hull.castShadow = true;
      g.add(hull);

      const turret = new THREE.Mesh(this.geometries.cyl, this.materials.rustMetal);
      turret.scale.set(20, 8, 22);
      turret.position.set(2, 13, -3);
      turret.rotation.z = -0.12;
      turret.castShadow = true;
      g.add(turret);

      const barrel = new THREE.Mesh(this.geometries.cyl, this.materials.charredMetal);
      barrel.rotation.x = Math.PI / 2 - 0.15;
      barrel.scale.set(2.5, 28, 2.5);
      barrel.position.set(2, 13, 14);
      g.add(barrel);
    } else if (wrk.type === 'truck' || wrk.type === 'BurnedTruck') {
      const cab = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
      cab.scale.set(22, 14, 18);
      cab.position.set(0, 8, 14);
      cab.castShadow = true;
      g.add(cab);

      const bed = new THREE.Mesh(this.geometries.box, this.materials.charredMetal);
      bed.scale.set(24, 10, 32);
      bed.position.set(0, 7, -12);
      bed.castShadow = true;
      g.add(bed);
    } else {
      const body = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
      body.scale.set(19, 7.5, 36);
      body.position.y = 4.5;
      body.rotation.z = 0.06;
      body.castShadow = true;
      g.add(body);

      const roof = new THREE.Mesh(this.geometries.box, this.materials.charredMetal);
      roof.scale.set(16, 6, 18);
      roof.position.set(0, 10.5, -2);
      g.add(roof);
    }
    return g;
  }

  _createSectorPoint(sec) {
    return this.buildCapturePointCompound(sec);
  }

  // Complexo Fortificado Completo ao Redor de Cada Ponto de Captura (Strongpoint)
  buildCapturePointCompound(sec) {
    const g = new THREE.Group();

    const ring = new THREE.Mesh(
      this.geometries.ring,
      new THREE.MeshBasicMaterial({
        color: 0xe7e2cf,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      })
    );
    ring.scale.set(sec.radius, 1, sec.radius);
    ring.position.y = 1.4;
    g.add(ring);

    // Piso de tábuas de madeira no centro do ponto
    const woodDeck = new THREE.Mesh(this.geometries.cyl, this.materials.wood);
    woodDeck.scale.set(34, 1.2, 34);
    woodDeck.position.y = 0.6;
    woodDeck.receiveShadow = true;
    g.add(woodDeck);

    // Ninho Circular de Sacos de Areia em 3 Camadas ao redor do Mastro (com aberturas de entrada)
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 12; i++) {
        if (i === 0 || i === 6) continue; // Duas entradas opostas
        const a = (i / 12) * Math.PI * 2 + layer * 0.12;
        const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sb.position.set(Math.cos(a) * 32, 2.0 + layer * 2.8, Math.sin(a) * 32);
        sb.rotation.y = -a + Math.PI / 2;
        sb.scale.set(7.5, 2.8, 4.2);
        sb.castShadow = true;
        g.add(sb);
      }
    }

    // Rede de Camuflagem Suspensa + Mesa Tática + Antena de Rádio de Campanha
    const camoNet = new THREE.Mesh(
      this.geometries.box,
      new THREE.MeshStandardMaterial({ color: 0x4b5d34, roughness: 0.95, transparent: true, opacity: 0.9 })
    );
    camoNet.scale.set(40, 1.2, 32);
    camoNet.position.set(-28, 18, -22);
    camoNet.castShadow = true;
    g.add(camoNet);
    for (const px of [-46, -10]) {
      for (const pz of [-36, -8]) {
        const post = new THREE.Mesh(this.geometries.cyl, this.materials.trenchDarkTimber);
        post.scale.set(1.1, 18, 1.1);
        post.position.set(px, 9, pz);
        g.add(post);
      }
    }
    const table = new THREE.Mesh(this.geometries.box, this.materials.wood);
    table.scale.set(16, 6, 10);
    table.position.set(-28, 3, -22);
    g.add(table);

    const radioAntenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    radioAntenna.scale.set(0.7, 36, 0.7);
    radioAntenna.position.set(-34, 18, -24);
    g.add(radioAntenna);

    // Pilhas de Caixas de Munição + Barris de Combustível
    const barrelMat = new THREE.MeshStandardMaterial({
      color: sec.resourceType === 'fuel' ? 0xb91c1c : 0x3f5636,
      roughness: 0.65,
    });
    for (const [bx, bz] of [[28, 18], [36, 12], [24, 28]]) {
      const barrel = new THREE.Mesh(this.geometries.cyl, barrelMat);
      barrel.scale.set(3.5, 8.5, 3.5);
      barrel.position.set(bx, 4.2, bz);
      barrel.castShadow = true;
      g.add(barrel);
    }
    for (let c = 0; c < 3; c++) {
      const crate = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
      crate.scale.set(9, 6, 7);
      crate.position.set(-22 + c * 10, 3 + (c === 2 ? 6 : 0), 26);
      crate.castShadow = true;
      g.add(crate);
    }

    // Construções/Props específicos por tipo de recurso nas margens do círculo
    if (sec.resourceType === 'fuel') {
      // 2 Tanques Cilíndricos Grandes + Bombas de Abastecimento
      for (const tx of [-72, -46]) {
        const fTank = new THREE.Mesh(this.geometries.cyl, this.materials.rustMetal);
        fTank.scale.set(12, 24, 12);
        fTank.position.set(tx, 12, 52);
        fTank.castShadow = true;
        g.add(fTank);
      }
      const pump = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
      );
      pump.scale.set(6, 11, 5);
      pump.position.set(-28, 5.5, 52);
      g.add(pump);
    } else if (sec.resourceType === 'ammo') {
      // Guarita de Vigia + Rolos de Arame Farpado nas laterais
      const tower = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      tower.scale.set(12, 34, 12);
      tower.position.set(58, 17, -46);
      tower.castShadow = true;
      g.add(tower);
      for (let w = -2; w <= 2; w++) {
        const coil = new THREE.Mesh(this.geometries.torusWire, this.materials.razorSteel);
        coil.position.set(54 + w * 8, 5, 42);
        g.add(coil);
      }
    } else {
      // Poço de Pedra Rural no Ponto de Suprimento
      const well = new THREE.Mesh(this.geometries.cyl, this.materials.masonryStone);
      well.scale.set(10, 9, 10);
      well.position.set(52, 4.5, -36);
      well.castShadow = true;
      g.add(well);
    }

    // Mastro Alto (5m = 50u+) e Bandeira Grande Subdividida Ondulante
    const pole = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    pole.scale.set(2.4, 58, 2.4);
    pole.position.set(0, 29, 0);
    g.add(pole);

    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3c4,
      emissive: 0x8a795d,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(26, 14, 6, 3), flagMat);
    flag.position.set(13, 22, 0);
    g.add(flag);

    g.userData = { ring, flag, flagMat };
    return g;
  }

  _initFrontlineMesh(map) {
    const n = map.frontlineSamples;
    this.allyLinePoints = [];
    this.enemyLinePoints = [];
    for (let i = 0; i < n; i++) {
      const z = ((i + 0.5) / n) * map.size;
      this.allyLinePoints.push(new THREE.Vector3(map.size * 0.5 - 18, 2.8, z));
      this.enemyLinePoints.push(new THREE.Vector3(map.size * 0.5 + 18, 2.8, z));
    }

    const allyGeo = new THREE.BufferGeometry().setFromPoints(this.allyLinePoints);
    const enemyGeo = new THREE.BufferGeometry().setFromPoints(this.enemyLinePoints);

    this.allyFrontLine = new THREE.Line(
      allyGeo,
      new THREE.LineBasicMaterial({ color: 0x6b9bd2, linewidth: 3 })
    );
    this.enemyFrontLine = new THREE.Line(
      enemyGeo,
      new THREE.LineBasicMaterial({ color: 0xc94a38, linewidth: 3 })
    );

    this.worldGroup.add(this.allyFrontLine);
    this.worldGroup.add(this.enemyFrontLine);
  }

  _updateFrontlineVisuals(map) {
    if (!this.allyFrontLine || !this.enemyFrontLine) return;
    const n = map.frontlineSamples;
    const allyPos = this.allyFrontLine.geometry.attributes.position;
    const enemyPos = this.enemyFrontLine.geometry.attributes.position;

    for (let i = 0; i < n; i++) {
      const z = ((i + 0.5) / n) * map.size;
      const fx = map.frontlineX[i];
      allyPos.setXYZ(i, fx - 18, 3.0, z);
      enemyPos.setXYZ(i, fx + 18, 3.0, z);
    }
    allyPos.needsUpdate = true;
    enemyPos.needsUpdate = true;
  }

  // Soldado 3D Altamente Detalhado por Classe e Facção (Rosto/Mãos, Correia, Cantil, Colete, Mochila e Armas)
  _createSoldierSubMesh(facMeta, weaponModel) {
    const g = new THREE.Group();
    const isEnemy = facMeta.team === 'enemies';
    const uniColor = isEnemy
      ? 0x454d52 // Feldgrau / Grafite escuro inimigo
      : weaponModel === 'smg'
      ? 0x7c6543 // Assalto: caqui / marrom-terra
      : weaponModel === 'sniper'
      ? 0x3b4d2b // Sniper: verde camuflado escuro
      : facMeta.uniformColor;
    const helmColor = isEnemy ? 0x32383d : facMeta.helmetColor;
    const uniMat = new THREE.MeshStandardMaterial({ color: uniColor, roughness: 0.84 });
    const helmMat = new THREE.MeshStandardMaterial({ color: helmColor, roughness: 0.65 });
    const vestMat = isEnemy
      ? new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.8 })
      : weaponModel === 'smg'
      ? new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.78 }) // Colete pesado preto/grafite
      : this.materials.vestOlive;

    // Pernas articuladas + Botas de combate
    const legL = new THREE.Group();
    legL.position.set(-1.35, 6.2, 0);
    const thighL = new THREE.Mesh(this.geometries.box, uniMat);
    thighL.scale.set(2.1, 4.6, 2.2);
    thighL.position.set(0, -2.1, 0);
    const bootL = new THREE.Mesh(this.geometries.box, this.materials.bootLeather);
    bootL.scale.set(2.2, 2.2, 2.8);
    bootL.position.set(0, -5.1, 0.35);
    legL.add(thighL, bootL);

    const legR = new THREE.Group();
    legR.position.set(1.35, 6.2, 0);
    const thighR = new THREE.Mesh(this.geometries.box, uniMat);
    thighR.scale.set(2.1, 4.6, 2.2);
    thighR.position.set(0, -2.1, 0);
    const bootR = new THREE.Mesh(this.geometries.box, this.materials.bootLeather);
    bootR.scale.set(2.2, 2.2, 2.8);
    bootR.position.set(0, -5.1, 0.35);
    legR.add(thighR, bootR);

    // Subgrupo superior do corpo (permite inclinar/agachar ao atirar ou entrar em cobertura)
    const upperBody = new THREE.Group();
    upperBody.position.set(0, 6.2, 0);

    const torso = new THREE.Mesh(this.geometries.box, uniMat);
    torso.scale.set(5.4, 7.2, 3.3);
    torso.position.set(0, 3.8, 0);
    torso.castShadow = true;
    upperBody.add(torso);

    // Colete Balístico Tático (Plate Carrier + Bolsas de Munição)
    const vest = new THREE.Mesh(this.geometries.box, vestMat);
    vest.scale.set(5.8, 5.4, 3.9);
    vest.position.set(0, 4.0, 0.1);
    vest.castShadow = true;
    upperBody.add(vest);

    for (const px of [-1.5, 0, 1.5]) {
      const pouch = new THREE.Mesh(this.geometries.box, this.materials.packCanvas);
      pouch.scale.set(1.1, 1.7, 0.9);
      pouch.position.set(px, 2.8, 2.15);
      upperBody.add(pouch);
    }

    // Tropas de Assalto (SMG): Ombreiras reforçadas + Granadas presas no cinto
    if (weaponModel === 'smg') {
      for (const sx of [-3.3, 3.3]) {
        const pad = new THREE.Mesh(this.geometries.box, vestMat);
        pad.scale.set(1.9, 2.1, 3.6);
        pad.position.set(sx, 6.2, 0);
        pad.castShadow = true;
        upperBody.add(pad);
      }
      for (const gx of [-1.6, 1.6]) {
        const gran = new THREE.Mesh(this.geometries.sphere, this.materials.oliveArmor);
        gran.scale.set(1.3, 1.6, 1.3);
        gran.position.set(gx, 1.8, 2.4);
        upperBody.add(gran);
      }
    }

    // Cantil militar no cinto + insígnia vermelha nos inimigos
    const canteen = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    canteen.scale.set(1.2, 2.0, 1.0);
    canteen.position.set(-3.1, 1.8, -0.6);
    upperBody.add(canteen);

    if (isEnemy) {
      const redBand = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xc94a38, roughness: 0.6 })
      );
      redBand.scale.set(1.2, 1.4, 3.6);
      redBand.position.set(-2.9, 5.4, 0);
      upperBody.add(redBand);
    }

    // Mochila Tática Militar nas Costas (ou Foguetes para Bazuca / Cilindros para Lança-Chamas)
    if (weaponModel === 'flamer') {
      for (const tx of [-1.4, 1.4]) {
        const tank = new THREE.Mesh(this.geometries.cyl, this.materials.rustMetal);
        tank.scale.set(2.1, 6.2, 2.1);
        tank.position.set(tx, 4.4, -2.5);
        upperBody.add(tank);
      }
    } else if (weaponModel === 'bazooka') {
      const pack = new THREE.Mesh(this.geometries.box, this.materials.packCanvas);
      pack.scale.set(4.6, 5.6, 2.6);
      pack.position.set(0, 4.2, -2.6);
      upperBody.add(pack);
      for (const rx of [-1.1, 1.1]) {
        const rkt = new THREE.Mesh(this.geometries.cyl, this.materials.oliveArmor);
        rkt.scale.set(1.1, 6.8, 1.1);
        rkt.position.set(rx, 5.2, -3.5);
        upperBody.add(rkt);
      }
    } else {
      const backpack = new THREE.Mesh(this.geometries.box, this.materials.packCanvas);
      backpack.scale.set(4.4, 5.4, 2.5);
      backpack.position.set(0, 4.2, -2.6);
      backpack.castShadow = true;
      upperBody.add(backpack);

      const bedroll = new THREE.Mesh(this.geometries.cyl, helmMat);
      bedroll.rotation.z = Math.PI / 2;
      bedroll.scale.set(1.5, 4.6, 1.5);
      bedroll.position.set(0, 7.2, -2.5);
      upperBody.add(bedroll);
    }

    // Cabeça com tom de pele + correia no queixo + Capacete/Boina/Ghillie por classe
    const head = new THREE.Mesh(this.geometries.sphere, this.materials.skin);
    head.scale.set(3.8, 3.8, 3.8);
    head.position.set(0, 9.2, 0);
    upperBody.add(head);

    const chinStrap = new THREE.Mesh(this.geometries.box, this.materials.bootLeather);
    chinStrap.scale.set(3.6, 0.5, 0.8);
    chinStrap.position.set(0, 7.7, 1.4);
    upperBody.add(chinStrap);

    if (weaponModel === 'smg') {
      // Boina Militar de Choque + Óculos de proteção claros
      const beret = new THREE.Mesh(
        this.geometries.sphere,
        new THREE.MeshStandardMaterial({ color: isEnemy ? 0x26292e : 0x7f1d1d, roughness: 0.75 })
      );
      beret.scale.set(4.5, 2.4, 4.7);
      beret.position.set(0.3, 10.6, -0.1);
      beret.rotation.z = -0.22;
      beret.castShadow = true;
      upperBody.add(beret);

      const goggles = new THREE.Mesh(
        this.geometries.box,
        new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.3, metalness: 0.4 })
      );
      goggles.scale.set(4.3, 1.3, 1.4);
      goggles.position.set(0, 9.5, 2.2);
      upperBody.add(goggles);
    } else if (weaponModel === 'sniper') {
      // Capuz/Capa Ghillie folhosa
      const ghillieMat = new THREE.MeshStandardMaterial({ color: 0x3b5926, roughness: 0.96 });
      const hood = new THREE.Mesh(this.geometries.sphere, ghillieMat);
      hood.scale.set(5.2, 4.2, 5.4);
      hood.position.set(0, 10.1, -0.3);
      hood.castShadow = true;
      upperBody.add(hood);

      const cape = new THREE.Mesh(this.geometries.box, ghillieMat);
      cape.scale.set(6.4, 6.2, 2.0);
      cape.position.set(0, 5.2, -2.1);
      upperBody.add(cape);
    } else {
      const helmet = new THREE.Mesh(this.geometries.sphere, helmMat);
      helmet.scale.set(4.7, 3.4, 5.0);
      helmet.position.set(0, 10.2, -0.1);
      helmet.castShadow = true;
      upperBody.add(helmet);

      if (weaponModel === 'bazooka') {
        // Faixa de insígnia amarela/branca no capacete AT
        const insignia = new THREE.Mesh(
          this.geometries.box,
          new THREE.MeshStandardMaterial({ color: isEnemy ? 0xef4444 : 0xfacc15, roughness: 0.5 })
        );
        insignia.scale.set(1.6, 1.1, 1.2);
        insignia.position.set(0, 10.6, 2.3);
        upperBody.add(insignia);
      } else {
        // Faixa camuflada no capacete M1
        const band = new THREE.Mesh(this.geometries.cyl, this.materials.packCanvas);
        band.scale.set(4.6, 0.7, 4.9);
        band.position.set(0, 9.8, -0.1);
        upperBody.add(band);
      }
    }

    // Braços de apoio e disparo
    const armL = new THREE.Mesh(this.geometries.box, uniMat);
    armL.scale.set(1.75, 5.2, 1.75);
    armL.position.set(-3.1, 4.5, 1.8);
    armL.rotation.x = -1.25;
    armL.rotation.z = -0.28;
    upperBody.add(armL);

    const armR = new THREE.Mesh(this.geometries.box, uniMat);
    armR.scale.set(1.8, 5.2, 1.8);
    armR.position.set(3.1, 4.5, 1.6);
    armR.rotation.x = -1.15;
    upperBody.add(armR);

    const gun = new THREE.Group();
    if (weaponModel === 'bazooka') {
      // Lança-Mísseis Antitanque no Ombro (Javelin / Bazooka)
      const tube = new THREE.Mesh(this.geometries.cyl, this.materials.vestOlive);
      tube.rotation.x = Math.PI / 2;
      tube.scale.set(2.4, 14.5, 2.4);
      tube.position.set(2.8, 6.8, 2.5);
      gun.add(tube);

      const frontBell = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      frontBell.rotation.x = Math.PI / 2;
      frontBell.scale.set(3.1, 2.4, 3.1);
      frontBell.position.set(2.8, 6.8, 9.6);
      gun.add(frontBell);
    } else if (weaponModel === 'sniper') {
      // Rifle Sniper de Precisão com Cano Longo, Luneta Telescópica e Coronha
      const body = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      body.scale.set(1.0, 1.5, 12.8);
      body.position.set(2.2, 4.7, 5.4);
      gun.add(body);

      const scope = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      scope.rotation.x = Math.PI / 2;
      scope.scale.set(0.9, 4.6, 0.9);
      scope.position.set(2.2, 5.9, 4.2);
      gun.add(scope);

      const stock = new THREE.Mesh(this.geometries.box, this.materials.woodStock);
      stock.scale.set(1.0, 1.5, 3.2);
      stock.position.set(2.2, 4.2, -0.2);
      gun.add(stock);
    } else if (weaponModel === 'flamer') {
      // Lança-Chamas Militar com Bico Ignitor
      const body = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      body.rotation.x = Math.PI / 2;
      body.scale.set(1.6, 9.5, 1.6);
      body.position.set(2.4, 4.4, 4.5);
      gun.add(body);
    } else if (weaponModel === 'smg') {
      // Submetralhadora Compacta (SMG) com Carregador Tambor/Curvo
      const body = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      body.scale.set(1.1, 1.5, 5.6);
      body.position.set(2.3, 4.6, 3.6);
      gun.add(body);

      const drum = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      drum.rotation.z = Math.PI / 2;
      drum.scale.set(2.2, 1.2, 2.2);
      drum.position.set(2.3, 3.3, 4.2);
      gun.add(drum);
    } else {
      // Fuzil de Assalto / Carabina Tática com Carregador Curvo, Mira e Coronha
      const barrelLen = weaponModel === 'm4' ? 9.2 : 7.0;
      const receiver = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      receiver.scale.set(1.1, 1.6, barrelLen);
      receiver.position.set(2.3, 4.6, 4.2);
      gun.add(receiver);

      const mag = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      mag.scale.set(0.85, 2.4, 1.2);
      mag.position.set(2.3, 3.2, 4.4);
      mag.rotation.x = 0.25;
      gun.add(mag);

      const optic = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      optic.scale.set(0.9, 0.9, 1.8);
      optic.position.set(2.3, 5.7, 3.6);
      gun.add(optic);

      const stock = new THREE.Mesh(this.geometries.box, this.materials.woodStock);
      stock.scale.set(1.0, 1.4, 2.8);
      stock.position.set(2.3, 4.2, 0.6);
      gun.add(stock);
    }

    // Clarão de disparo visível na boca do cano
    const sMuzzle = new THREE.Mesh(this.geometries.sphere, this.materials.muzzle);
    sMuzzle.scale.set(2.8, 2.8, 3.8);
    sMuzzle.position.set(2.3, 4.8, 10.5);
    sMuzzle.visible = false;
    gun.add(sMuzzle);

    upperBody.add(gun);

    // Anel de destaque individual para quando o jogador seleciona este soldado específico (Shift+Clique ou Card)
    const indivRing = new THREE.Mesh(
      this.geometries.ring,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    indivRing.scale.set(5.4, 1, 5.4);
    indivRing.position.set(0, 0.5, 0);
    indivRing.visible = false;

    g.add(indivRing, legL, legR, upperBody);
    g.userData = { legL, legR, armL, armR, gun, sMuzzle, upperBody, indivRing, deathTimer: 0 };
    return g;
  }

  // Veículos 3D Detalhados: Chassi Blindado Angular, Faróis Acesos, Rodas que Giram ao Andar e Torre Giratória
  _createVehicleMeshBySubType(facMeta, subType) {
    const g = new THREE.Group();
    const wheels = [];
    const bodyMat = new THREE.MeshStandardMaterial({
      color: facMeta.vehicleColor,
      roughness: 0.65,
      metalness: 0.25,
    });

    const addHeadlights = (zFront, yHeight, spreadX) => {
      for (const sx of [-spreadX, spreadX]) {
        const hl = new THREE.Mesh(this.geometries.sphere, this.materials.headlightGlow);
        hl.scale.set(2.4, 2.4, 1.4);
        hl.position.set(sx, yHeight, zFront);
        g.add(hl);
      }
    };

    const createWheelWithHub = (wx, wy, wz, radiusScale = 10.5, widthScale = 5.0) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wy, wz);
      const tire = new THREE.Mesh(this.geometries.cyl, this.materials.tire);
      tire.rotation.z = Math.PI / 2;
      tire.scale.set(radiusScale, widthScale, radiusScale);
      tire.castShadow = true;
      wGroup.add(tire);

      const hub = new THREE.Mesh(this.geometries.box, this.materials.wheelHub);
      hub.scale.set(widthScale + 0.6, radiusScale * 0.55, 2.0);
      wGroup.add(hub);

      g.add(wGroup);
      wheels.push(wGroup);
    };

    if (subType === 'mbt_tank') {
      // Tanque de Batalha Principal (MBT 120mm com blindagem frontal inclinada, saias laterais, rodas de lagarta e torre pesada)
      const hull = new THREE.Mesh(this.geometries.box, bodyMat);
      hull.scale.set(38, 12, 60);
      hull.position.y = 8.5;
      hull.castShadow = true;
      hull.receiveShadow = true;
      g.add(hull);

      const glacis = new THREE.Mesh(this.geometries.box, bodyMat);
      glacis.scale.set(36, 8, 16);
      glacis.position.set(0, 9.5, 27);
      glacis.rotation.x = 0.42;
      g.add(glacis);

      addHeadlights(31, 11.5, 13);

      for (const s of [-19, 19]) {
        const track = new THREE.Mesh(this.geometries.box, this.materials.tire);
        track.scale.set(6.5, 10, 62);
        track.position.set(s, 5.5, 0);
        g.add(track);

        for (const wz of [-22, -11, 0, 11, 22]) {
          createWheelWithHub(s + (s > 0 ? 1.2 : -1.2), 5.0, wz, 8.2, 4.5);
        }
      }

      const turret = new THREE.Group();
      turret.position.set(0, 17.5, -2);
      const tHead = new THREE.Mesh(this.geometries.box, bodyMat);
      tHead.scale.set(28, 9.5, 34);
      tHead.castShadow = true;
      turret.add(tHead);

      const cupola = new THREE.Mesh(this.geometries.cyl, this.materials.concreteDark);
      cupola.scale.set(8, 4, 8);
      cupola.position.set(-6, 6, -6);
      turret.add(cupola);

      const cannon = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      cannon.rotation.x = Math.PI / 2;
      cannon.scale.set(3.4, 40, 3.4);
      cannon.position.set(0, 1, 28);
      turret.add(cannon);

      const antenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      antenna.scale.set(0.45, 24, 0.45);
      antenna.position.set(10, 14, -12);
      turret.add(antenna);

      g.add(turret);
      g.userData = { turret, barrel: cannon, barrelBaseZ: 28, antenna, wheels };
      return g;
    }

    if (subType === 'troop_transport') {
      // Caminhão Tático / Half-Track de Transporte de Tropas c/ Rampa Traseira Articulada
      const cab = new THREE.Mesh(this.geometries.box, bodyMat);
      cab.scale.set(26, 14, 20);
      cab.position.set(0, 11.5, 16);
      cab.castShadow = true;
      g.add(cab);

      const windshield = new THREE.Mesh(this.geometries.box, this.materials.glass);
      windshield.scale.set(22, 5.5, 1.4);
      windshield.position.set(0, 14, 26.2);
      g.add(windshield);

      const bed = new THREE.Mesh(this.geometries.box, bodyMat);
      bed.scale.set(28, 13, 34);
      bed.position.set(0, 11, -11);
      bed.castShadow = true;
      g.add(bed);

      const canopy = new THREE.Mesh(this.geometries.box, this.materials.woodDark);
      canopy.scale.set(26.5, 5.5, 32);
      canopy.position.set(0, 19.5, -11);
      g.add(canopy);

      // Rampa Traseira Articulada (abre quando tropas embarcam/desembarcam)
      const rampPivot = new THREE.Group();
      rampPivot.position.set(0, 5.2, -28);
      const rampMesh = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      rampMesh.scale.set(22, 11, 2.2);
      rampMesh.position.set(0, 5.5, 0);
      rampPivot.add(rampMesh);
      g.add(rampPivot);

      addHeadlights(26.5, 10, 9.5);

      // Rodas dianteiras + Esteiras traseiras de Half-Track
      createWheelWithHub(-14.5, 5.5, 17, 10.5, 5.0);
      createWheelWithHub(14.5, 5.5, 17, 10.5, 5.0);
      for (const sx of [-14.5, 14.5]) {
        const track = new THREE.Mesh(this.geometries.box, this.materials.tire);
        track.scale.set(5.8, 9.0, 26);
        track.position.set(sx, 5.0, -12);
        g.add(track);
        createWheelWithHub(sx, 4.8, -4, 7.6, 4.2);
        createWheelWithHub(sx, 4.8, -19, 7.6, 4.2);
      }

      const turret = new THREE.Group();
      turret.position.set(0, 20.5, 14);
      const hmg = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      hmg.rotation.x = Math.PI / 2;
      hmg.scale.set(1.6, 15, 1.6);
      hmg.position.set(0, 2, 7.5);
      turret.add(hmg);
      g.add(turret);

      const antenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      antenna.scale.set(0.4, 22, 0.4);
      antenna.position.set(-11, 22, 10);
      g.add(antenna);

      g.userData = { turret, barrel: hmg, barrelBaseZ: 7.5, antenna, rearRamp: rampPivot, wheels };
      return g;
    }

    if (subType === 'apc_stryker') {
      // APC Blindado 8x8 BTR / Stryker com 8 rodas giratórias, quebra-ondas frontal, faróis e canhão 30mm
      const hull = new THREE.Mesh(this.geometries.box, bodyMat);
      hull.scale.set(31, 14, 56);
      hull.position.y = 10.5;
      hull.castShadow = true;
      g.add(hull);

      const nose = new THREE.Mesh(this.geometries.box, bodyMat);
      nose.scale.set(29, 9, 14);
      nose.position.set(0, 10, 26);
      nose.rotation.x = 0.45;
      g.add(nose);

      addHeadlights(30, 12, 11);

      for (const z of [-19, -6.5, 6.5, 19]) {
        for (const x of [-16, 16]) {
          createWheelWithHub(x, 5.2, z, 10.2, 4.8);
        }
      }

      const turret = new THREE.Group();
      turret.position.set(0, 19.5, 4);
      const tBox = new THREE.Mesh(this.geometries.cyl, bodyMat);
      tBox.scale.set(15, 6.5, 15);
      turret.add(tBox);
      const barrel = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.scale.set(2.1, 22, 2.1);
      barrel.position.set(0, 1, 15);
      turret.add(barrel);

      g.add(turret);
      const antenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      antenna.scale.set(0.4, 20, 0.4);
      antenna.position.set(-12, 22, -18);
      g.add(antenna);
      g.userData = { turret, barrel, barrelBaseZ: 15, antenna, wheels };
      return g;
    }

    if (subType === 'rocket_artillery') {
      const cab = new THREE.Mesh(this.geometries.box, bodyMat);
      cab.scale.set(26, 15, 20);
      cab.position.set(0, 10, 16);
      cab.castShadow = true;
      g.add(cab);

      const chassis = new THREE.Mesh(this.geometries.box, this.materials.charredMetal);
      chassis.scale.set(26, 6, 52);
      chassis.position.set(0, 6, 0);
      g.add(chassis);

      addHeadlights(26.5, 9.5, 9.5);

      for (const z of [-18, -4, 16]) {
        for (const x of [-14, 14]) {
          createWheelWithHub(x, 5.2, z, 10.0, 4.6);
        }
      }

      const turret = new THREE.Group();
      turret.position.set(0, 15, -10);
      const pod = new THREE.Mesh(this.geometries.box, bodyMat);
      pod.scale.set(22, 10, 24);
      pod.rotation.x = -0.38;
      turret.add(pod);
      g.add(turret);
      const antenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      antenna.scale.set(0.4, 20, 0.4);
      antenna.position.set(-12, 22, -18);
      g.add(antenna);
      g.userData = { turret, barrel: pod, barrelBaseZ: 0, antenna, wheels };
      return g;
    }

    // Humvee Blindado Tático com Capô Inclinado, Para-choque, Faróis Acesos, 4 Rodas Giratórias e Torre .50
    const hull = new THREE.Mesh(this.geometries.box, bodyMat);
    hull.scale.set(28, 12, 48);
    hull.position.y = 9;
    hull.castShadow = true;
    hull.receiveShadow = true;
    g.add(hull);

    const cab = new THREE.Mesh(this.geometries.box, bodyMat);
    cab.scale.set(26, 9.5, 25);
    cab.position.set(0, 18.5, -2);
    cab.castShadow = true;
    g.add(cab);

    const windshield = new THREE.Mesh(this.geometries.box, this.materials.glass);
    windshield.scale.set(23, 6.2, 1.4);
    windshield.position.set(0, 18.5, 10.6);
    g.add(windshield);

    const bumper = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
    bumper.scale.set(28, 4, 3);
    bumper.position.set(0, 6.5, 25);
    g.add(bumper);

    addHeadlights(24.5, 10.5, 10);

    const wheelOffsets = [
      [-14.8, 5.5, 15.5],
      [14.8, 5.5, 15.5],
      [-14.8, 5.5, -15.5],
      [14.8, 5.5, -15.5],
    ];
    for (const [wx, wy, wz] of wheelOffsets) {
      createWheelWithHub(wx, wy, wz, 11.0, 5.2);
    }

    const turret = new THREE.Group();
    turret.position.set(0, 23.5, -2);

    const shield = new THREE.Mesh(this.geometries.box, bodyMat);
    shield.scale.set(11, 7.5, 1.8);
    shield.position.set(0, 3, 4.8);
    turret.add(shield);

    const hmg = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    hmg.rotation.x = Math.PI / 2;
    hmg.scale.set(1.9, 17, 1.9);
    hmg.position.set(0, 3, 9.5);
    turret.add(hmg);

    g.add(turret);
    const antenna = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    antenna.scale.set(0.35, 18, 0.35);
    antenna.position.set(-11, 21, -12);
    g.add(antenna);
    g.userData = { turret, barrel: hmg, barrelBaseZ: 9.5, antenna, wheels };
    return g;
  }

  _createEmplacementMesh(facMeta, subType) {
    const g = new THREE.Group();

    if (subType === 'watchtower') {
      // Torre de Defesa / Guarita Blindada Alta com 4 Pilares, Cabine Blindada Superior, Holofote e Metralhadora Giratória
      for (const lx of [-13, 13]) {
        for (const lz of [-13, 13]) {
          const leg = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
          leg.scale.set(3.6, 36, 3.6);
          leg.position.set(lx, 18, lz);
          leg.castShadow = true;
          g.add(leg);
        }
      }

      const platform = new THREE.Mesh(this.geometries.box, this.materials.concrete);
      platform.scale.set(36, 3.5, 36);
      platform.position.set(0, 36, 0);
      platform.castShadow = true;
      g.add(platform);

      const cabin = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      cabin.scale.set(30, 14, 30);
      cabin.position.set(0, 44, 0);
      cabin.castShadow = true;
      g.add(cabin);

      const roof = new THREE.Mesh(this.geometries.cone, this.materials.roofSlate);
      roof.scale.set(32, 12, 32);
      roof.position.set(0, 56, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);

      // Base protegida por sacos de areia
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sb.position.set(Math.cos(a) * 20, 3.0, Math.sin(a) * 20);
        sb.rotation.y = -a + Math.PI / 2;
        sb.scale.set(6.5, 3.2, 4.0);
        g.add(sb);
      }

      const turret = new THREE.Group();
      turret.position.set(0, 45, 0);
      const barrel = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.scale.set(2.4, 22, 2.4);
      barrel.position.set(0, 0, 16);
      turret.add(barrel);

      const spotlight = new THREE.Mesh(this.geometries.sphere, this.materials.headlightGlow);
      spotlight.scale.set(3.5, 3.5, 2.0);
      spotlight.position.set(6, 2, 15);
      turret.add(spotlight);

      g.add(turret);
      g.userData = { turret };
      return g;
    }

    if (subType === 'concrete_bunker') {
      const baseWall = new THREE.Mesh(this.geometries.box, this.materials.concrete);
      baseWall.scale.set(52, 14, 46);
      baseWall.position.y = 7;
      baseWall.castShadow = true;
      baseWall.receiveShadow = true;
      g.add(baseWall);

      const slit = new THREE.Mesh(this.geometries.box, this.materials.windowDark);
      slit.scale.set(36, 4.5, 2.2);
      slit.position.set(0, 10.5, 22.5);
      g.add(slit);

      const roofSlab = new THREE.Mesh(this.geometries.box, this.materials.concreteDark);
      roofSlab.scale.set(58, 5, 52);
      roofSlab.position.y = 16.5;
      roofSlab.castShadow = true;
      g.add(roofSlab);

      for (let i = -2; i <= 2; i++) {
        const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sb.scale.set(6, 2.8, 4);
        sb.position.set(i * 10, 20.2, 18);
        g.add(sb);
      }

      const turret = new THREE.Group();
      turret.position.set(0, 10.5, 18);
      const barrel = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.scale.set(2.2, 16, 2.2);
      barrel.position.set(0, 0, 8);
      turret.add(barrel);
      g.add(turret);
      g.userData = { turret };
      return g;
    }

    if (subType === 'supply_outpost') {
      const crate1 = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      crate1.scale.set(18, 10, 14);
      crate1.position.set(-12, 5, 6);
      crate1.castShadow = true;
      g.add(crate1);

      const crate2 = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
      crate2.scale.set(16, 9, 16);
      crate2.position.set(12, 4.5, -6);
      crate2.castShadow = true;
      g.add(crate2);

      const mast = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
      mast.scale.set(2.4, 48, 2.4);
      mast.position.set(0, 24, 0);
      mast.castShadow = true;
      g.add(mast);

      const cross = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      cross.scale.set(18, 1.5, 1.5);
      cross.position.set(0, 44, 0);
      g.add(cross);

      const turret = new THREE.Group();
      g.add(turret);
      g.userData = { turret };
      return g;
    }

    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * (Math.PI * 0.45);
      const sb = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
      sb.position.set(Math.sin(a) * 20, 3.6, Math.cos(a) * 20);
      sb.rotation.y = a;
      sb.scale.set(6.5, 3.8, 4.0);
      sb.castShadow = true;
      g.add(sb);
    }

    const turret = new THREE.Group();
    turret.position.set(0, 8, 0);

    const gunShield = new THREE.Mesh(
      this.geometries.box,
      new THREE.MeshStandardMaterial({ color: facMeta.vehicleColor, roughness: 0.7 })
    );
    gunShield.scale.set(14, 9, 1.8);
    gunShield.position.set(0, 2, 5);
    turret.add(gunShield);

    const barrel = new THREE.Mesh(this.geometries.cyl, this.materials.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(2.6, 22, 2.6);
    barrel.position.set(0, 2.5, 12);
    turret.add(barrel);

    const crew1 = this._createSoldierSubMesh(facMeta, 'smg');
    crew1.position.set(-7, -3.5, -6);
    const crew2 = this._createSoldierSubMesh(facMeta, 'smg');
    crew2.position.set(7, -3.5, -6);
    turret.add(crew1, crew2);

    g.add(turret);
    g.userData = { turret };
    return g;
  }

  _createSquadMesh(unit, skinId = 'olive_classic') {
    const root = new THREE.Group();
    const baseMeta = unit.factionMeta || ARMY_FACTIONS.player;
    const skin = unit.faction === 'player' ? ARMY_SKIN_BY_ID[skinId] : null;
    const facMeta = skin
      ? {
          ...baseMeta,
          uniform: skin.uniform,
          helmet: skin.helmet,
          vehicle: skin.vehicle,
          color: skin.accent || baseMeta.color,
        }
      : baseMeta;

    const selRing = new THREE.Mesh(this.geometries.ring, this.materials.selectRing);
    selRing.scale.set(unit.radius * 1.25, 1, unit.radius * 1.25);
    selRing.position.y = 0.8;
    selRing.visible = false;
    root.add(selRing);

    const muzzle = new THREE.Mesh(this.geometries.sphere, this.materials.muzzle);
    muzzle.scale.set(5, 5, 5);
    muzzle.position.set(0, 12, 16);
    muzzle.visible = false;
    root.add(muzzle);

    const surrenderGroup = new THREE.Group();
    const sPole = new THREE.Mesh(this.geometries.cyl, this.materials.woodStock);
    sPole.scale.set(1.2, 34, 1.2);
    sPole.position.y = 17;
    const sCloth = new THREE.Mesh(this.geometries.box, this.materials.whiteFlag);
    sCloth.scale.set(16, 10, 0.8);
    sCloth.position.set(8, 29, 0);
    surrenderGroup.add(sPole, sCloth);
    surrenderGroup.visible = false;
    root.add(surrenderGroup);

    if (unit.isCommanderSquad || unit.unitType === 'command_officer') {
      const starBadge = new THREE.Mesh(
        this.geometries.sphere,
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xfacc15,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        })
      );
      starBadge.scale.set(4.2, 4.2, 4.2);
      starBadge.position.set(0, 28, 0);
      root.add(starBadge);
    }

    const soldiersMeshes = [];
    let vehicleMesh = null;

    const sub = unit.spec.subType || unit.unitType || '';
    const isVehicleUnit =
      unit.spec.type === 'vehicle' ||
      /humvee|truck|transport|apc|btr|stryker|tank|mbt|artillery|rocket/.test(sub);

    if (isVehicleUnit) {
      vehicleMesh = this._createVehicleMeshBySubType(facMeta, sub || 'humvee');
      vehicleMesh.visible = true;
      root.add(vehicleMesh);
    } else if (unit.spec.type === 'emplacement') {
      vehicleMesh = this._createEmplacementMesh(facMeta, unit.spec.subType);
      root.add(vehicleMesh);
    } else {
      for (let i = 0; i < unit.maxSoldiers; i++) {
        const sm = this._createSoldierSubMesh(facMeta, unit.spec.weaponModel);
        const off = unit.memberOffsets[i] || { ox: 0, oy: 0 };
        sm.position.set(off.ox, 0, off.oy);
        root.add(sm);
        soldiersMeshes.push(sm);
      }
    }

    root.userData = {
      selRing,
      muzzle,
      surrenderGroup,
      soldiersMeshes,
      vehicleMesh,
    };
    return root;
  }

  carveTrenchInTerrain(trench) {
    if (!this.terrainGeo || !trench?.points || trench.points.length < 2) return;
    if (this.carvedTrenchIds?.has(trench.id)) return;
    this.carvedTrenchIds?.add(trench.id);

    const pos = this.terrainGeo.attributes.position;
    const half = this.terrainHalfMap || 4800;
    const pts = trench.points;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minZ) minZ = p.y;
      if (p.y > maxZ) maxZ = p.y;
    }
    minX -= 45; maxX += 45; minZ -= 45; maxZ += 45;

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + half;
      const wz = pos.getZ(i) + half;
      if (wx < minX || wx > maxX || wz < minZ || wz > maxZ) continue;
      let minD = Infinity;
      for (let s = 0; s < pts.length - 1; s++) {
        const ax = pts[s].x, az = pts[s].y, bx = pts[s + 1].x, bz = pts[s + 1].y;
        const dx = bx - ax, dz = bz - az;
        const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wz - az) * dz) / l2));
        const d = Math.hypot(wx - (ax + t * dx), wz - (az + t * dz));
        if (d < minD) minD = d;
      }
      if (minD <= 16) {
        pos.setY(i, pos.getY(i) - 12);
      } else if (minD <= 32) {
        pos.setY(i, pos.getY(i) + 3.5);
      }
    }
    pos.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();
  }

  _createTrenchMesh(trench) {
    this.carveTrenchInTerrain(trench);
    const g = new THREE.Group();
    const pts = trench.points;
    const deepFloorMat = new THREE.MeshStandardMaterial({ color: 0x110d09, roughness: 0.99 });
    const aoWallMat = new THREE.MeshStandardMaterial({ color: 0x1b140e, roughness: 0.96 });

    for (let segIdx = 0; segIdx < pts.length - 1; segIdx++) {
      const a = pts[segIdx];
      const b = pts[segIdx + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(24, Math.hypot(dx, dy));
      const cx = (a.x + b.x) * 0.5;
      const cy = (a.y + b.y) * 0.5;
      const ang = Math.atan2(dx, dy);

      const segGroup = new THREE.Group();
      segGroup.position.set(cx, 0, cy);
      segGroup.rotation.y = ang;

      // Fundo escuro de lama/sombra profunda (#110d09) + Estrados de tábuas pisoteadas (duckboards)
      const pitFloor = new THREE.Mesh(this.geometries.box, deepFloorMat);
      pitFloor.scale.set(24, 1.0, len + 4);
      pitFloor.position.y = -9.5;
      segGroup.add(pitFloor);

      // Faixas de oclusão ambiental (AO) nas bordas internas para ilusão de profundidade máxima
      for (const side of [-9.5, 9.5]) {
        const aoStrip = new THREE.Mesh(this.geometries.box, aoWallMat);
        aoStrip.scale.set(4.5, 11.5, len + 2);
        aoStrip.position.set(side, -3.8, 0);
        segGroup.add(aoStrip);
      }

      const plankCount = Math.max(4, Math.floor(len / 12));
      for (let p = 0; p < plankCount; p++) {
        const zP = -len * 0.5 + (p + 0.5) * (len / plankCount);
        const duckboard = new THREE.Mesh(this.geometries.box, this.materials.wood);
        duckboard.scale.set(16, 0.8, 7.2);
        duckboard.position.set(((p % 3) - 1) * 0.6, -8.6, zP);
        duckboard.rotation.y = ((p % 2) - 0.5) * 0.06;
        segGroup.add(duckboard);
      }

      // Paredes internas com tábuas de madeira verticais e chapas de zinco corrugado
      const timberWallL = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      timberWallL.scale.set(2.2, 9.2, len + 2);
      timberWallL.position.set(-11.5, -0.8, 0);
      const timberWallR = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      timberWallR.scale.set(2.2, 9.2, len + 2);
      timberWallR.position.set(11.5, -0.8, 0);
      segGroup.add(timberWallL, timberWallR);

      const zincPlate = new THREE.Mesh(this.geometries.box, this.materials.gunMetal);
      zincPlate.scale.set(0.8, 6.5, len * 0.45);
      zincPlate.position.set(-10.1, -0.5, 0);
      segGroup.add(zincPlate);

      // Degrau de tiro (firing step) + Caixa de munição aberta + Escada curta na saída
      const firingStep = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
      firingStep.scale.set(5.5, 2.2, len * 0.7);
      firingStep.position.set(8.2, -3.2, 0);
      segGroup.add(firingStep);

      const ammoBox = new THREE.Mesh(this.geometries.box, this.materials.sandbagOlive);
      ammoBox.scale.set(5, 3.2, 7);
      ammoBox.position.set(-6.5, -3.0, len * 0.25);
      segGroup.add(ammoBox);

      const ladder = new THREE.Mesh(this.geometries.box, this.materials.wood);
      ladder.scale.set(7.5, 11, 1.5);
      ladder.position.set(0, -0.5, len * 0.46);
      ladder.rotation.x = 0.35;
      segGroup.add(ladder);

      const postCount = Math.max(3, Math.floor(len / 28));
      for (let i = 0; i <= postCount; i++) {
        const zPos = -len * 0.5 + (i / postCount) * len;
        const postL = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
        postL.scale.set(2.8, 6.2, 2.4);
        postL.position.set(-10.8, 3.1, zPos);
        const postR = new THREE.Mesh(this.geometries.box, this.materials.trenchDarkTimber);
        postR.scale.set(2.8, 6.2, 2.4);
        postR.position.set(10.8, 3.1, zPos);
        segGroup.add(postL, postR);
      }

      const earthBermL = new THREE.Mesh(this.geometries.cyl, this.materials.trenchMudBerm);
      earthBermL.rotation.x = Math.PI / 2;
      earthBermL.scale.set(12, len + 8, 5.5);
      earthBermL.position.set(-16.5, 1.5, 0);
      earthBermL.receiveShadow = true;

      const earthBermR = new THREE.Mesh(this.geometries.cyl, this.materials.trenchMudBerm);
      earthBermR.rotation.x = Math.PI / 2;
      earthBermR.scale.set(12, len + 8, 5.5);
      earthBermR.position.set(16.5, 1.5, 0);
      earthBermR.receiveShadow = true;
      segGroup.add(earthBermL, earthBermR);

      const bagStep = 11;
      const bagCount = Math.max(3, Math.floor(len / bagStep));
      for (let i = 0; i < bagCount; i++) {
        const zPos = -len * 0.5 + (i + 0.5) * (len / bagCount);
        const jitter = ((i * 7) % 3 - 1) * 0.6;

        const sbL1 = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sbL1.scale.set(3.4, 2.1, 5.6);
        sbL1.position.set(-14.8 + jitter, 3.4, zPos);
        sbL1.castShadow = true;

        const sbR1 = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
        sbR1.scale.set(3.4, 2.1, 5.6);
        sbR1.position.set(14.8 - jitter, 3.4, zPos);
        sbR1.castShadow = true;
        segGroup.add(sbL1, sbR1);

        if (i % 2 === 0) {
          const sbL2 = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
          sbL2.scale.set(3.1, 1.9, 5.2);
          sbL2.position.set(-14.5, 5.3, zPos + 2);
          sbL2.castShadow = true;

          const sbR2 = new THREE.Mesh(this.geometries.sandbag, this.materials.sandbagOlive);
          sbR2.scale.set(3.1, 1.9, 5.2);
          sbR2.position.set(14.5, 5.3, zPos - 2);
          sbR2.castShadow = true;
          segGroup.add(sbL2, sbR2);
        }
      }

      for (const endSign of [-1, 1]) {
        const endBerm = new THREE.Mesh(this.geometries.box, this.materials.trenchMudBerm);
        endBerm.scale.set(28, 4.2, 6);
        endBerm.position.set(0, 2.1, endSign * (len * 0.5 + 2));
        segGroup.add(endBerm);
      }

      g.add(segGroup);
    }

    return g;
  }

  _createBarricadeMesh(bar) {
    const g = new THREE.Group();
    const dx = bar.x2 - bar.x1;
    const dy = bar.y2 - bar.y1;
    const len = Math.max(30, Math.hypot(dx, dy));
    const cx = (bar.x1 + bar.x2) * 0.5;
    const cy = (bar.y1 + bar.y2) * 0.5;
    const ang = Math.atan2(dx, dy);

    g.position.set(cx, 0, cy);
    g.rotation.y = ang;

    const count = Math.max(3, Math.floor(len / 22));
    for (let i = 0; i < count; i++) {
      const zPos = -len * 0.5 + (i + 0.5) * (len / count);

      // Fileira dupla empilhada de sacos de areia bege/caqui
      for (let row = 0; row < 2; row++) {
        const sb = new THREE.Mesh(
          this.geometries.sandbag,
          row === 0 ? this.materials.sandbagTan : this.materials.sandbagOlive
        );
        sb.scale.set(6.2, 2.5, 4.2);
        sb.position.set(-4 + row * 2, 2.2 + row * 3.2, zPos);
        sb.castShadow = true;
        g.add(sb);
      }

      // Ouriço Checo (Vigas de ferro em "X" anti-tanque)
      for (const tilt of [-0.65, 0.65]) {
        const beam = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
        beam.scale.set(1.8, 16, 1.8);
        beam.position.set(5, 6.5, zPos);
        beam.rotation.set(tilt, 0.4, tilt * 0.7);
        beam.castShadow = true;
        g.add(beam);
      }

      // Chapa de aço enferrujada inclinada ou caixa militar verde
      if (i % 2 === 0) {
        const plate = new THREE.Mesh(this.geometries.box, this.materials.rustMetal);
        plate.scale.set(1.5, 11, 14);
        plate.position.set(1.5, 5.5, zPos + 4);
        plate.rotation.z = -0.25;
        plate.castShadow = true;
        g.add(plate);
      } else {
        const crate = new THREE.Mesh(this.geometries.box, this.materials.oliveArmor);
        crate.scale.set(6.5, 5.5, 8.5);
        crate.position.set(-8, 2.8, zPos);
        crate.castShadow = true;
        g.add(crate);
      }

      // Rolo de arame farpado metálico no topo
      const wire = new THREE.Mesh(this.geometries.torusWire, this.materials.wireMetal);
      wire.position.set(5, 8.5, zPos);
      wire.rotation.y = Math.PI * 0.5;
      g.add(wire);
    }

    return g;
  }

  _createMineMesh(mine) {
    const g = new THREE.Group();
    const disk = new THREE.Mesh(this.geometries.mineBody, this.materials.mineMetal);
    disk.position.y = 1.4;
    disk.castShadow = true;
    g.add(disk);

    const cap = new THREE.Mesh(
      this.geometries.mineCap,
      mine.team === 'allies' ? this.materials.mineWarnAlly : this.materials.mineWarnEnemy
    );
    cap.position.y = 2.8;
    g.add(cap);

    const ring = new THREE.Mesh(
      this.geometries.ring,
      mine.team === 'allies' ? this.materials.mineWarnAlly : this.materials.mineWarnEnemy
    );
    ring.scale.set(11, 1, 11);
    ring.position.y = 0.5;
    g.add(ring);

    return g;
  }

  _updateRTSCamera(game, dt) {
    const camX = game.camera.x;
    const camY = game.camera.y;
    this.camZoom = game.camera.zoom;

    if (game.menuActive) {
      const t = performance.now() * 0.00014;
      const cx = game.map.size * 0.5 + Math.cos(t) * 680;
      const cz = game.map.size * 0.5 + Math.sin(t * 1.2) * 640;
      this.camera.position.set(cx - 460, 620, cz + 580);
      this.camera.lookAt(cx, 0, cz);
      return;
    }

    let jx = 0;
    let jy = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      jx = (Math.random() - 0.5) * this.shakeMag;
      jy = (Math.random() - 0.5) * this.shakeMag;
      if (this.shakeTime <= 0) this.shakeMag = 0;
    }

    this.camTarget.set(camX + jx, 0, camY + jy);

    const height = this.camZoom;
    const backOffset = this.camZoom * 0.74;
    this.camera.position.set(this.camTarget.x, height, this.camTarget.z + backOffset);
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z - 40);

    this.sunLight.position.set(this.camTarget.x + 700, 1300, this.camTarget.z - 600);
    this.sunLight.target.position.copy(this.camTarget);
  }

  render(game, dt = 0.016) {
    this._updateRTSCamera(game, dt);
    this._updateFrontlineVisuals(game.map);

    if (this.fogMesh) {
      this.fogMesh.visible = !game.menuActive;
    }
    this.fogSyncTimer -= dt;
    if (this.fogSyncTimer <= 0) {
      this.fogSyncTimer = 0.05;
      this._updateFogTexture3D(game.map, 0.05);
    }

    // Nevasca 3D animada (quando mapa Bastogne Inverno estiver ativo)
    if (this.snowSystem && dt > 0) {
      const posAttr = this.snowSystem.geometry.attributes.position;
      const arr = posAttr.array;
      const mSize = game.map.size || 9600;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += 28 * dt;
        arr[i + 1] -= 95 * dt;
        arr[i + 2] += 18 * dt;
        if (arr[i + 1] < 0) {
          arr[i + 1] = 480 + Math.random() * 60;
          arr[i] = Math.random() * mSize;
          arr[i + 2] = Math.random() * mSize;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Atualiza meshes do jogador caso a Skin do Exército tenha sido trocada no Arsenal
    const curSkinId = game.playerSkinId || 'olive_classic';
    if (curSkinId !== this.lastPlayerSkinId) {
      this.lastPlayerSkinId = curSkinId;
      for (const u of game.units) {
        if (u.faction === 'player' && this.squadMeshes.has(u.id)) {
          this.dynamicGroup.remove(this.squadMeshes.get(u.id));
          this.squadMeshes.delete(u.id);
        }
      }
    }

    for (const bladeHub of this.windmillBlades) {
      bladeHub.rotation.z += dt * 0.45;
    }

    // 1. Pontos de Conquista Estratégicos (Bandeira 3D que sobe e desce conforme progresso!)
    for (const sec of game.map.sectors) {
      const sg = this.sectorMeshes.get(sec.id);
      if (!sg) continue;
      const { ring, flag, flagMat } = sg.userData;
      const col =
        sec.owner === 'allies' ? 0x6b9bd2 : sec.owner === 'enemies' ? 0xc94a38 : 0xd6d3c4;
      ring.material.color.setHex(col);
      flagMat.color.setHex(col);
      flagMat.emissive.setHex(col);
      const norm = Math.abs(sec.captureProgress || 0) / 100;
      flag.position.y = 16 + norm * 34;
      flag.rotation.y = Math.sin((this._animTime || 0) * 3.8 + sec.x * 0.01) * 0.24;
    }

    // 2. Prédios da Base Militar (QG Central, Quartel de Op. Especiais, Fábrica de Blindados, Radar)
    const activeBaseIds = new Set();
    for (const bld of game.baseBuildings || []) {
      if (bld.alive === false) continue;
      activeBaseIds.add(bld.id);
      let bm = this.baseBuildingMeshes.get(bld.id);
      if (!bm) {
        bm = this._createBaseBuildingMesh(bld);
        bm.position.set(bld.x, getTerrainHeight(bld.x, bld.y, game.map), bld.y);
        this.dynamicGroup.add(bm);
        this.baseBuildingMeshes.set(bld.id, bm);
      }
      if (bm.userData.dishGroup) {
        bm.userData.dishGroup.rotation.y += dt * 1.25;
      }
      if (bm.userData.flagMesh) {
        bm.userData.flagMesh.rotation.y = Math.sin((this._animTime || 0) * 4.2) * 0.22;
      }
      if (bm.userData.aviationLights) {
        const blink = Math.sin((this._animTime || 0) * 5.5) > 0 ? 1.8 : 0.15;
        for (const lm of bm.userData.aviationLights) lm.emissiveIntensity = blink;
      }
      if (bm.userData.selRing) {
        bm.userData.selRing.visible = game.selectedBuildingId === bld.id;
      }
      if (bm.userData.lvl2Group) {
        bm.userData.lvl2Group.visible = (bld.level || 1) >= 2;
      }
      if (bm.userData.lvl3Group) {
        bm.userData.lvl3Group.visible = (bld.level || 1) >= 3;
      }
      bm.visible =
        bld.team === 'allies' ||
        game.intelRevealed ||
        game.map.isPositionVisibleToAllies(bld.x, bld.y);
    }
    for (const [id, mesh] of this.baseBuildingMeshes.entries()) {
      if (!activeBaseIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.baseBuildingMeshes.delete(id);
      }
    }

    // 3. Aeronaves de Apoio Aéreo
    const activeAirIds = new Set();
    for (const air of game.aircrafts || []) {
      activeAirIds.add(air.id);
      let am = this.aircraftMeshes.get(air.id);
      if (!am) {
        am = this._createAircraftMesh(air);
        this.dynamicGroup.add(am);
        this.aircraftMeshes.set(air.id, am);
      }
      am.position.set(air.x, air.altitude || 220, air.y);
      am.rotation.y = Math.PI / 2 - air.angle;
    }
    for (const [id, mesh] of this.aircraftMeshes.entries()) {
      if (!activeAirIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.aircraftMeshes.delete(id);
      }
    }

    // Clarão nas janelas das construções ocupadas
    for (const st of game.map.structures) {
      const sm = this.structureMeshes.get(st.id);
      if (!sm || !sm.userData.muzzle) continue;
      const garUnit = st.garrisonUnitId ? game.units.find((u) => u.id === st.garrisonUnitId) : null;
      const vis =
        garUnit &&
        (garUnit.team === 'allies' || game.map.isPositionVisibleToAllies(st.x, st.y));
      sm.userData.muzzle.visible = Boolean(vis && garUnit.alive && garUnit.muzzleFlashTimer > 0);
    }

    // 4. Trincheiras 3D
    const activeTrenchIds = new Set();
    for (const tr of game.trenches) {
      activeTrenchIds.add(tr.id);
      let tm = this.trenchMeshes.get(tr.id);
      if (!tm) {
        tm = this._createTrenchMesh(tr);
        this.dynamicGroup.add(tm);
        this.trenchMeshes.set(tr.id, tm);
      }
      const c = tr.getCenter();
      tm.visible =
        tr.team === 'allies' ||
        tr.revealed ||
        game.map.isPositionVisibleToAllies(c.x, c.y);
    }
    for (const [id, mesh] of this.trenchMeshes.entries()) {
      if (!activeTrenchIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.trenchMeshes.delete(id);
      }
    }

    // 5. Barricadas & Dentes de Dragão 3D
    const activeBarIds = new Set();
    for (const bar of game.barricades || []) {
      activeBarIds.add(bar.id);
      let bm = this.barricadeMeshes.get(bar.id);
      if (!bm) {
        bm = this._createBarricadeMesh(bar);
        this.dynamicGroup.add(bm);
        this.barricadeMeshes.set(bar.id, bm);
      }
      bm.visible =
        bar.team === 'allies' ||
        game.map.isPositionVisibleToAllies((bar.x1 + bar.x2) * 0.5, (bar.y1 + bar.y2) * 0.5);
    }
    for (const [id, mesh] of this.barricadeMeshes.entries()) {
      if (!activeBarIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.barricadeMeshes.delete(id);
      }
    }

    // 5b. Muros Fortificados de Concreto/Sacos de Areia 3D
    const activeWallIds = new Set();
    for (const wall of game.fortifiedWalls || []) {
      activeWallIds.add(wall.id);
      let wm = this.wallMeshes.get(wall.id);
      if (!wm) {
        wm = this._createFortifiedWallMesh(wall);
        this.dynamicGroup.add(wm);
        this.wallMeshes.set(wall.id, wm);
      }
      wm.visible =
        wall.team === 'allies' ||
        game.map.isPositionVisibleToAllies((wall.x1 + wall.x2) * 0.5, (wall.y1 + wall.y2) * 0.5);
    }
    for (const [id, mesh] of this.wallMeshes.entries()) {
      if (!activeWallIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.wallMeshes.delete(id);
      }
    }

    // 5c. Arame Farpado 3D
    const activeWireIds = new Set();
    for (const wire of game.barbedWires || []) {
      if (!wire.active) continue;
      activeWireIds.add(wire.id);
      let wrm = this.wireMeshes.get(wire.id);
      if (!wrm) {
        wrm = this._createBarbedWireMesh(wire);
        this.dynamicGroup.add(wrm);
        this.wireMeshes.set(wire.id, wrm);
      }
      wrm.visible =
        wire.team === 'allies' ||
        game.map.isPositionVisibleToAllies((wire.x1 + wire.x2) * 0.5, (wire.y1 + wire.y2) * 0.5);
    }
    for (const [id, mesh] of this.wireMeshes.entries()) {
      if (!activeWireIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.wireMeshes.delete(id);
      }
    }

    // 6. Campos Minados 3D
    const activeMineIds = new Set();
    for (const mn of game.mines) {
      if (!mn.active) continue;
      activeMineIds.add(mn.id);
      let mm = this.mineMeshes.get(mn.id);
      if (!mm) {
        mm = this._createMineMesh(mn);
        this.dynamicGroup.add(mm);
        this.mineMeshes.set(mn.id, mm);
      }
      mm.position.set(mn.x, 0, mn.y);
      mm.visible = mn.team === 'allies' || mn.revealed;
    }
    for (const [id, mesh] of this.mineMeshes.entries()) {
      if (!activeMineIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.mineMeshes.delete(id);
      }
    }

    // 7. Esquadrões e Veículos 3D Detalhados e Animados
    const activeUnitIds = new Set();
    const now = performance.now() * 0.006;

    for (const u of game.units) {
      if (!u.alive || u.captured || u.embarkedInId) continue;
      activeUnitIds.add(u.id);

      let mesh = this.squadMeshes.get(u.id);
      if (!mesh) {
        mesh = this._createSquadMesh(u, game.playerSkinId || 'olive_classic');
        this.dynamicGroup.add(mesh);
        this.squadMeshes.set(u.id, mesh);
      }

      const visibleToPlayer =
        u.team === 'allies' ||
        game.intelRevealed ||
        game.map.isPositionVisibleToAllies(u.x, u.y);
      mesh.visible = visibleToPlayer;
      if (!visibleToPlayer) continue;

      const isGarrisoned = Boolean(u.garrisonedBuildingId);

      const groundY = getTerrainHeight(u.x, u.y, game.map);
      const baseY = u.inTrench && u.spec.type === 'infantry' ? -6.5 : 0;
      mesh.position.set(u.x, groundY + baseY, u.y);
      mesh.rotation.y = u.spec.type === 'infantry' ? 0 : Math.PI / 2 - u.angle;

      const { selRing, muzzle, surrenderGroup, soldiersMeshes, vehicleMesh } = mesh.userData;
      selRing.visible = u.selected;
      selRing.position.y = -baseY + 0.8;
      muzzle.visible = !isGarrisoned && u.muzzleFlashTimer > 0;
      surrenderGroup.visible = u.surrendered;
      if (u.surrendered) {
        surrenderGroup.position.y = -baseY;
        surrenderGroup.rotation.z = Math.sin(now * 2 + u.id) * 0.18;
      }

      const speed = Math.hypot(u.vx, u.vy);

      // Rotação da Torre + Recuo do Canhão + Antena Balançando + Rampa Traseira + Rodas Giratórias
      if (vehicleMesh) {
        if (vehicleMesh.userData.turret) {
          vehicleMesh.userData.turret.rotation.y = u.angle - u.turretAngle;
        }
        if (vehicleMesh.userData.barrel && typeof vehicleMesh.userData.barrelBaseZ === 'number') {
          const kick = u.recoilTimer > 0 ? Math.sin((u.recoilTimer / 0.32) * Math.PI) * 7.5 : 0;
          vehicleMesh.userData.barrel.position.z = vehicleMesh.userData.barrelBaseZ - kick;
        }
        if (vehicleMesh.userData.antenna) {
          vehicleMesh.userData.antenna.rotation.x =
            Math.sin(now * 2.2 + u.id) * (0.06 + Math.min(0.24, speed * 0.003));
          vehicleMesh.userData.antenna.rotation.z = Math.cos(now * 1.7 + u.id) * 0.05;
        }
        if (vehicleMesh.userData.rearRamp) {
          vehicleMesh.userData.rearRamp.rotation.x = u.rampOpenTimer > 0 ? -1.15 : 0;
        }
        if (vehicleMesh.userData.wheels && speed > 2) {
          const wheelRot = dt * speed * 0.14;
          for (const wGroup of vehicleMesh.userData.wheels) {
            wGroup.rotation.x += wheelRot;
          }
        }
        // Recuo sutil do chassi ao disparar canhão principal
        vehicleMesh.rotation.x = u.recoilTimer > 0 && u.spec.weaponModel === 'tank_cannon' ? -0.05 : 0;
      }

      if (u.spec.type === 'infantry' && u.soldiers && soldiersMeshes.length < u.soldiers.length) {
        while (soldiersMeshes.length < u.soldiers.length) {
          const sIdx = soldiersMeshes.length;
          const sData = u.soldiers[sIdx];
          const sm = this._createSoldierSubMesh(
            u.factionMeta || ARMY_FACTIONS.player,
            sData?.weaponModel || u.spec.weaponModel
          );
          const off = u.memberOffsets[sIdx] || { ox: 0, oy: 0 };
          sm.position.set(off.ox, 0, off.oy);
          mesh.add(sm);
          soldiersMeshes.push(sm);
        }
      }

      if (soldiersMeshes.length > 0) {
        const isFiringOrCrouched = u.crouchedInCover || u.inTrench || u.muzzleFlashTimer > 0;
        const allSoldiers = u.soldiers && u.soldiers.length > 0 ? u.soldiers : null;
        soldiersMeshes.forEach((sm, idx) => {
          const soldierData = allSoldiers ? allSoldiers[idx] : null;
          const isAlive = allSoldiers ? Boolean(soldierData?.alive) : idx < u.soldiersAlive;
          if (!isAlive && !isGarrisoned) {
            if (sm.userData.deathTimer === undefined) sm.userData.deathTimer = 0;
            if (sm.userData.deathTimer < 0.7) {
              sm.userData.deathTimer += dt;
              const fallT = Math.min(1, sm.userData.deathTimer / 0.35);
              sm.visible = true;
              sm.rotation.x = -Math.PI * 0.48 * fallT;
              sm.position.y = -1.5 * fallT;
              if (sm.userData.sMuzzle) sm.userData.sMuzzle.visible = false;
              return;
            }
            sm.visible = false;
            return;
          }
          sm.userData.deathTimer = 0;
          sm.visible = !isGarrisoned && isAlive;
          if (!sm.visible) return;

          if (sm.userData.indivRing) {
            sm.userData.indivRing.visible = Boolean(soldierData?.selected && u.selected);
          }

          if (soldierData && Number.isFinite(soldierData.worldX) && Number.isFinite(soldierData.worldY)) {
            const targetLocalX = soldierData.worldX - u.x;
            const targetLocalZ = soldierData.worldY - u.y;
            const sGroundY = getTerrainHeight(soldierData.worldX, soldierData.worldY, game.map) - groundY;
            sm.position.x += (targetLocalX - sm.position.x) * 0.28;
            sm.position.z += (targetLocalZ - sm.position.z) * 0.28;
            sm.position.y = sGroundY;
            if (Number.isFinite(soldierData.currentYaw)) {
              sm.rotation.y = soldierData.currentYaw;
            }
          } else {
            const off = u.memberOffsets[idx] || { ox: 0, oy: 0 };
            sm.position.x += (off.ox - sm.position.x) * 0.18;
            sm.position.z += (off.oy - sm.position.z) * 0.18;
            sm.position.y = 0;
          }
          sm.rotation.x = 0;
          sm.rotation.z = 0;
          sm.scale.set(1, 1, 1);

          // Translucidez sutil quando o esquadrão está camuflado na floresta
          const stealthAlpha = u.camouflagedInForest ? 0.58 : 1.0;
          if (sm.userData._lastAlpha !== stealthAlpha) {
            sm.userData._lastAlpha = stealthAlpha;
            sm.traverse((child) => {
              if (child.isMesh && child.material && child !== sm.userData.indivRing) {
                child.material.transparent = stealthAlpha < 1.0;
                child.material.opacity = stealthAlpha;
              }
            });
          }

          // Recuo da arma e clarão de disparo por soldado
          if (sm.userData.gun) {
            sm.userData.gun.position.z = u.muzzleFlashTimer > 0 ? -1.6 : 0;
          }
          if (sm.userData.sMuzzle) {
            sm.userData.sMuzzle.visible = u.muzzleFlashTimer > 0;
          }

          const { legL, legR, armL, armR, upperBody } = sm.userData;
          const sSpeed = soldierData ? Math.hypot(soldierData.vx || 0, soldierData.vy || 0) : speed;
          const sPhase = soldierData
            ? (soldierData.walkPhase || 0) + (soldierData.animPhaseOffset || 0)
            : u.walkPhase + idx * 1.1;
          const idlePhase = (soldierData?.animPhaseOffset || idx * 1.3) + now;
          if (u.surrendered) {
            armR.rotation.x = -2.85;
            if (armL) armL.rotation.x = -2.85;
            legL.rotation.x = 0;
            legR.rotation.x = 0;
            if (upperBody) {
              upperBody.rotation.x = 0;
              upperBody.rotation.y = 0;
            }
          } else if (sSpeed > 4) {
            // Animação de marcha individualizada (nunca sincronizada com o soldado ao lado)
            const sw = Math.sin(sPhase) * 0.62;
            legL.rotation.x = sw;
            legR.rotation.x = -sw;
            armR.rotation.x = -1.1 + sw * 0.22;
            if (armL) armL.rotation.x = -1.2 - sw * 0.22;
            if (upperBody) {
              upperBody.rotation.x = 0.12;
              upperBody.rotation.y = 0;
            }
          } else if (u.crouchedInCover || u.inTrench) {
            // Postura de tiro protegido com micro-movimentos individuais
            legL.rotation.x = -0.78;
            legR.rotation.x = 0.85;
            armR.rotation.x = -1.48 + (u.muzzleFlashTimer > 0 ? -0.16 : 0);
            if (armL) armL.rotation.x = -1.52;
            if (upperBody) {
              upperBody.rotation.x = 0.34;
              upperBody.rotation.y = Math.sin(idlePhase * 0.9) * 0.08;
            }
          } else if (isFiringOrCrouched) {
            legL.rotation.x = -0.35;
            legR.rotation.x = 0.42;
            armR.rotation.x = -1.32 + (u.muzzleFlashTimer > 0 ? -0.14 : 0);
            if (armL) armL.rotation.x = -1.38;
            if (upperBody) {
              upperBody.rotation.x = 0.24;
              upperBody.rotation.y = Math.sin(idlePhase * 1.1) * 0.06;
            }
          } else {
            // Respiração e observação lateral individualizada em repouso
            legL.rotation.x = 0;
            legR.rotation.x = 0;
            armR.rotation.x = -1.15 + Math.sin(idlePhase * 2.1) * 0.03;
            if (armL) armL.rotation.x = -1.25;
            if (upperBody) {
              upperBody.rotation.x = 0.05 + Math.sin(idlePhase * 2.4) * 0.025;
              upperBody.rotation.y = Math.sin(idlePhase * 0.75) * 0.14;
            }
          }
        });
      }
    }

    for (const [id, mesh] of this.squadMeshes.entries()) {
      if (!activeUnitIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.squadMeshes.delete(id);
      }
    }

    // 8. Projéteis Traçantes 3D
    let bIdx = 0;
    for (const b of game.bullets) {
      if (bIdx >= this.bulletPool.length) break;
      if (b.team === 'enemies' && !game.map.isPositionVisibleToAllies(b.x, b.y)) continue;
      const bm = this.bulletPool[bIdx++];
      bm.visible = true;
      bm.position.set(b.x, 8.5, b.y);
      bm.rotation.y = Math.PI / 2 - b.angle;
      bm.scale.set(b.explosive ? 2.4 : 1.2, b.explosive ? 2.4 : 1.2, b.explosive ? 18 : 11);
    }
    for (let i = bIdx; i < this.bulletPool.length; i++) {
      this.bulletPool[i].visible = false;
    }

    // 9. Partículas
    let pIdx = 0;
    for (const pt of game.particles) {
      if (pIdx >= this.particlePool.length) break;
      if (!game.map.isPositionVisibleToAllies(pt.x, pt.y)) continue;
      const pm = this.particlePool[pIdx++];
      pm.visible = true;
      pm.position.set(pt.x, pt.z || 6, pt.y);
      const s = Math.max(1.5, pt.radius * 2);
      pm.scale.set(s, s, s);
      pm.material.color.set(pt.color || '#d97706');
      pm.material.opacity = clamp(pt.life / (pt.maxLife || 0.6), 0.08, 0.88);
    }
    for (let i = pIdx; i < this.particlePool.length; i++) {
      this.particlePool[i].visible = false;
    }

    // 10. Drones Quadricópteros 3D (UAV Recon & Drone Kamikaze FPV)
    const activeDroneIds = new Set();
    for (const dr of game.activeDrones || []) {
      if (!dr.alive) continue;
      activeDroneIds.add(dr.id);
      let dm = this.droneMeshes.get(dr.id);
      if (!dm) {
        dm = this._createDroneQuadcopterMesh(dr.type);
        this.dynamicGroup.add(dm);
        this.droneMeshes.set(dr.id, dm);
      }
      dm.position.set(dr.x, dr.z || 95, dr.y);
      dm.rotation.y = Math.PI / 2 - dr.angle;
      dm.rotation.x = 0.14;
      for (const rot of dm.userData.rotors || []) {
        rot.rotation.y += dt * 36;
      }
    }
    for (const [id, mesh] of this.droneMeshes.entries()) {
      if (!activeDroneIds.has(id)) {
        this.dynamicGroup.remove(mesh);
        this.droneMeshes.delete(id);
      }
    }

    // 11. Linha Única Limpa de Trajetória Tática por Esquadrão (1 THREE.Line por esquadrão, cinza semitransparente)
    const buildTerrainLineVecs = (pts) => {
      const vecs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.min(18, Math.ceil(segLen / 55)));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          vecs.push(new THREE.Vector3(px, getTerrainHeight(px, py, game.map) + 3.2, py));
        }
      }
      const last = pts[pts.length - 1];
      vecs.push(new THREE.Vector3(last.x, getTerrainHeight(last.x, last.y, game.map) + 3.2, last.y));
      return vecs;
    };

    if (game.hoverPathPreview && game.hoverPathPreview.length >= 2) {
      const vecs = buildTerrainLineVecs(game.hoverPathPreview);
      this.pathLine.geometry.dispose();
      this.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(vecs);
      if (this.pathLine.computeLineDistances) this.pathLine.computeLineDistances();
      this.pathLine.visible = true;
    } else {
      this.pathLine.visible = false;
    }

    const activePathUnitIds = new Set();
    for (const u of game.units) {
      if (!u.alive || !u.selected || u.faction !== 'player' || u.order.type === 'hold') continue;
      const raw = [{ x: u.x, y: u.y }];
      if (Array.isArray(u.waypoints) && u.waypoints.length > 0) {
        const wp0 = u.waypoints[0];
        if (wp0 && Number.isFinite(wp0.x) && Number.isFinite(wp0.y)) raw.push(wp0);
      }
      const endPt = u.finalDestination || { x: u.order.targetX, y: u.order.targetY };
      if (endPt && Number.isFinite(endPt.x) && Number.isFinite(endPt.y)) raw.push(endPt);

      const cleanPts = [];
      for (const p of raw) {
        const prev = cleanPts[cleanPts.length - 1];
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 4) cleanPts.push(p);
      }
      if (cleanPts.length < 2) continue;

      activePathUnitIds.add(u.id);
      if (u.pathLine) {
        this.dynamicGroup.remove(u.pathLine);
        u.pathLine.geometry.dispose();
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(buildTerrainLineVecs(cleanPts));
      const line = new THREE.Line(lineGeo, this.pathLineMat);
      if (line.computeLineDistances) line.computeLineDistances();
      this.dynamicGroup.add(line);
      u.pathLine = line;
      this.squadPathLines.set(u.id, line);
    }

    for (const [id, line] of this.squadPathLines.entries()) {
      if (!activePathUnitIds.has(id)) {
        this.dynamicGroup.remove(line);
        line.geometry.dispose();
        this.squadPathLines.delete(id);
        const unitObj = game.units.find((u) => u.id === id);
        if (unitObj) unitObj.pathLine = null;
      }
    }
    for (let i = 0; i < this.waypointDots.length; i++) {
      this.waypointDots[i].visible = false;
    }

    this.renderer.render(this.scene, this.camera);
    this.vfx?.update(dt);
    this._renderTacticalOverlay2D(game);
  }

  _createDroneQuadcopterMesh(droneType) {
    const g = new THREE.Group();
    const isFpv = droneType === 'fpv_kamikaze';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isFpv ? 0x3b2f2f : 0x263238,
      roughness: 0.45,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(this.geometries.box, bodyMat);
    body.scale.set(8, 3.2, 11);
    g.add(body);

    if (isFpv) {
      const warhead = new THREE.Mesh(
        this.geometries.cyl,
        new THREE.MeshStandardMaterial({ color: 0xc94a38, roughness: 0.5 })
      );
      warhead.rotation.x = Math.PI / 2;
      warhead.scale.set(2.4, 7, 2.4);
      warhead.position.set(0, -1.8, 3);
      g.add(warhead);
    }

    const rotors = [];
    const armMat = this.materials.gunMetal;
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.85 });
    for (const [ax, az] of [
      [-8.5, -8.5],
      [8.5, -8.5],
      [-8.5, 8.5],
      [8.5, 8.5],
    ]) {
      const arm = new THREE.Mesh(this.geometries.box, armMat);
      arm.scale.set(1.6, 1.2, 12);
      arm.position.set(ax * 0.5, 0.5, az * 0.5);
      arm.rotation.y = Math.atan2(ax, az);
      g.add(arm);

      const blade = new THREE.Mesh(this.geometries.box, bladeMat);
      blade.scale.set(8.5, 0.35, 1.4);
      blade.position.set(ax, 2.0, az);
      g.add(blade);
      rotors.push(blade);
    }

    const led = new THREE.Mesh(
      this.geometries.sphere,
      new THREE.MeshBasicMaterial({ color: isFpv ? 0xf97316 : 0x38bdf8 })
    );
    led.scale.set(1.8, 1.8, 1.8);
    led.position.set(0, 2.5, -3);
    g.add(led);

    g.userData = { rotors };
    return g;
  }

  _renderTacticalOverlay2D(game) {
    const ctx = this.ctx2d;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);

    if (game.menuActive) return;

    // 0. Prévia Visual de Encaixe em Muros e Trincheiras (Bolinhas Verdes Brilhantes de Cobertura estilo Company of Heroes)
    if (game.coverSnapPreview && Array.isArray(game.coverSnapPreview.slots)) {
      const snap = game.coverSnapPreview;
      ctx.save();

      if (snap.wallSegment) {
        const w1 = this.worldToScreen(snap.wallSegment.x1, snap.wallSegment.y1, 4);
        const w2 = this.worldToScreen(snap.wallSegment.x2, snap.wallSegment.y2, 4);
        if (w1.visible && w2.visible) {
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.72)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(w1.x, w1.y);
          ctx.lineTo(w2.x, w2.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      for (const slot of snap.slots) {
        const sSc = this.worldToScreen(slot.x, slot.y, 1.5);
        if (!sSc.visible) continue;

        // Halo verde brilhante externo
        ctx.fillStyle = 'rgba(34, 197, 94, 0.32)';
        ctx.beginPath();
        ctx.arc(sSc.x, sSc.y, 9.5, 0, Math.PI * 2);
        ctx.fill();

        // Bolinha verde brilhante do Slot de Cobertura (sem linhas em leque)
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(sSc.x, sSc.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      const cSc = this.worldToScreen(snap.cx, snap.cy, 22);
      if (cSc.visible && snap.label) {
        ctx.font = "800 11px 'Inter', 'Segoe UI', sans-serif";
        ctx.textAlign = 'center';
        const txt = `🛡 ${snap.label}`;
        const tw = ctx.measureText(txt).width + 14;
        ctx.fillStyle = 'rgba(6, 36, 18, 0.9)';
        ctx.fillRect(cSc.x - tw * 0.5, cSc.y - 16, tw, 18);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(cSc.x - tw * 0.5, cSc.y - 16, tw, 18);
        ctx.fillStyle = '#86efac';
        ctx.fillText(txt, cSc.x, cSc.y - 3);
      }

      ctx.restore();
    }

    // 1. Pré-visualização de Orientação Direcional (Clique Direito + Arrastar ou Toque Longo 0.4s)
    if (game.orientationPreview) {
      const { center, facingAngle, points } = game.orientationPreview;
      const cSc = this.worldToScreen(center.x, center.y, 3);
      const arrowWorldX = center.x + Math.cos(facingAngle) * 65;
      const arrowWorldY = center.y + Math.sin(facingAngle) * 65;
      const aSc = this.worldToScreen(arrowWorldX, arrowWorldY, 3);

      ctx.save();
      ctx.strokeStyle = '#d4a338';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cSc.x, cSc.y);
      ctx.lineTo(aSc.x, aSc.y);
      ctx.stroke();

      for (const pt of points) {
        const pSc = this.worldToScreen(pt.x, pt.y, 2);
        if (!pSc.visible) continue;
        ctx.fillStyle = 'rgba(212, 163, 56, 0.9)';
        ctx.beginPath();
        ctx.arc(pSc.x, pSc.y, 5.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#141712';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Pré-visualização de Construção ou Apoio Aéreo
    if (
      (game.activeCommandMode === 'build_trench' ||
        game.activeCommandMode === 'build_barricade' ||
        game.activeCommandMode === 'build_wall' ||
        game.activeCommandMode === 'build_wire') &&
      game.trenchPreview
    ) {
      const pts = game.trenchPreview.points;
      ctx.save();
      ctx.strokeStyle =
        game.activeCommandMode === 'build_wall'
          ? 'rgba(163, 190, 140, 0.92)'
          : 'rgba(200, 125, 40, 0.92)';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        const sc = this.worldToScreen(pt.x, pt.y, 2);
        if (idx === 0) ctx.moveTo(sc.x, sc.y);
        else ctx.lineTo(sc.x, sc.y);
      });
      ctx.stroke();
      ctx.restore();
    } else if ((game.activeCommandMode || game.activeAirStrikeMode) && game.worldMouse) {
      const sc = this.worldToScreen(game.worldMouse.x, game.worldMouse.y, 2);
      ctx.save();
      ctx.strokeStyle = game.activeAirStrikeMode ? '#ef4444' : '#c87d28';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, game.activeAirStrikeMode ? 54 : 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Ponto de Encontro (Rally Point) do Prédio da Base Selecionado
    if (game.selectedBuildingId) {
      const selBld = (game.baseBuildings || []).find(
        (b) => b.id === game.selectedBuildingId && b.alive !== false
      );
      if (selBld && selBld.rallyX !== undefined && selBld.rallyY !== undefined) {
        const from = this.worldToScreen(selBld.x, selBld.y, 8);
        const to = this.worldToScreen(selBld.rallyX, selBld.rallyY, 4);
        if (from.visible && to.visible) {
          ctx.save();
          ctx.strokeStyle = 'rgba(163, 190, 140, 0.9)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([8, 5]);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#a3be8c';
          ctx.beginPath();
          ctx.arc(to.x, to.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "700 11px 'Inter', 'Segoe UI', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText('🚩 PONTO DE ENCONTRO', to.x, to.y - 10);
          ctx.restore();
        }
      }
    }

    // 4. Linhas de Ordem de Ataque das Tropas Selecionadas (movimento usa apenas a linha 3D cinza limpa)
    for (const u of game.units) {
      if (!u.alive || !u.selected || (u.order.type !== 'attack_unit' && u.order.type !== 'attack_building')) continue;
      const from = this.worldToScreen(u.x, u.y, 4);
      const to = this.worldToScreen(u.order.targetX, u.order.targetY, 4);
      if (!from.visible || !to.visible) continue;

      ctx.save();
      ctx.strokeStyle = 'rgba(201, 74, 56, 0.82)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(to.x, to.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Rótulos Compactos dos 8 Setores Estratégicos (45% mais discretos, com bônus claro)
    for (const sec of game.map.sectors) {
      if (game.map.getFogStateAt(sec.x, sec.y) === 0) continue;
      const sc = this.worldToScreen(sec.x, sec.y, 56);
      if (!sc.visible) continue;
      ctx.save();
      ctx.font = "700 11px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      const col =
        sec.owner === 'allies' ? '#7faed9' : sec.owner === 'enemies' ? '#d9534f' : '#d6d3c4';
      const labelText = `${sec.shortName || sec.name} (${sec.shortLabel || `+${sec.supplyBonus} SUP`})`;
      const tw = Math.max(108, ctx.measureText(labelText).width + 14);
      ctx.fillStyle = 'rgba(20, 24, 18, 0.86)';
      ctx.fillRect(sc.x - tw * 0.5, sc.y - 11, tw, 17);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(sc.x - tw * 0.5, sc.y - 11, tw, 17);
      ctx.fillStyle = col;
      ctx.fillText(labelText, sc.x, sc.y + 1);
      ctx.restore();
    }

    // 6. Barras de HP e Produção dos Prédios de Base Militar 3D
    for (const bld of game.baseBuildings || []) {
      if (bld.alive === false) continue;
      const vis =
        bld.team === 'allies' ||
        game.intelRevealed ||
        game.map.isPositionVisibleToAllies(bld.x, bld.y);
      if (!vis) continue;

      const sc = this.worldToScreen(bld.x, bld.y, 58);
      if (!sc.visible) continue;

      const isSelected = game.selectedBuildingId === bld.id;
      const hpRatio = clamp((bld.hp || 1500) / (bld.maxHp || 1500), 0, 1);

      ctx.save();
      ctx.font = "700 11px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      const title = `${bld.team === 'allies' ? '🏭' : '🎯'} ${(bld.short || bld.name || 'BASE').toUpperCase()}`;
      const bw = 96;
      ctx.fillStyle = 'rgba(18, 22, 16, 0.88)';
      ctx.fillRect(sc.x - bw * 0.5 - 4, sc.y - 16, bw + 8, 25);
      ctx.strokeStyle = isSelected
        ? '#a3be8c'
        : bld.team === 'allies'
        ? '#7faed9'
        : '#d9534f';
      ctx.lineWidth = isSelected ? 1.8 : 1.1;
      ctx.strokeRect(sc.x - bw * 0.5 - 4, sc.y - 16, bw + 8, 25);

      ctx.fillStyle = bld.team === 'allies' ? '#e5e0d0' : '#fca5a5';
      ctx.fillText(title, sc.x, sc.y - 4);

      // Barra de HP do Prédio
      ctx.fillStyle = 'rgba(10, 12, 9, 0.95)';
      ctx.fillRect(sc.x - bw * 0.5, sc.y + 2, bw, 4.5);
      ctx.fillStyle =
        bld.team === 'allies'
          ? hpRatio > 0.4
            ? '#689d6a'
            : '#d4a338'
          : '#d9534f';
      ctx.fillRect(sc.x - bw * 0.5, sc.y + 2, bw * hpRatio, 4.5);

      // Barra de Progresso de Produção ativa
      if (bld.productionQueue && bld.productionQueue.length > 0) {
        const prog = clamp((bld.productionProgress || 0) / 100, 0, 1);
        ctx.fillStyle = 'rgba(14, 17, 12, 0.92)';
        ctx.fillRect(sc.x - bw * 0.5, sc.y + 10, bw, 13);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sc.x - bw * 0.5, sc.y + 10, bw * prog, 13);
        ctx.fillStyle = '#0f172a';
        ctx.font = "800 9.5px 'Inter', 'Segoe UI', sans-serif";
        ctx.fillText(
          `⚙ ${bld.productionQueue[0].short.toUpperCase()} (${Math.round(prog * 100)}%)`,
          sc.x,
          sc.y + 20
        );
      }
      ctx.restore();
    }

    // 7. Indicadores Discretos de Construções Ocupáveis (Guarnição)
    for (const st of game.map.structures) {
      if (!st.garrisonable || game.map.getFogStateAt(st.x, st.y) === 0) continue;
      const vis = game.map.isPositionVisibleToAllies(st.x, st.y);
      const occupiedBy = st.garrisonTeam === 'allies' || vis ? st.garrisonTeam : null;
      if (!occupiedBy) continue; // Mostra badge apenas quando ocupada para não poluir o mapa!

      const sc = this.worldToScreen(st.x, st.y, st.h + 14);
      if (!sc.visible) continue;
      ctx.save();
      ctx.font = "700 10.5px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20, 24, 18, 0.88)';
      ctx.fillRect(sc.x - 56, sc.y - 9, 112, 16);
      ctx.strokeStyle = occupiedBy === 'allies' ? '#7faed9' : '#d9534f';
      ctx.strokeRect(sc.x - 56, sc.y - 9, 112, 16);
      ctx.fillStyle = '#f5f2eb';
      ctx.fillText('🏠 GUARNIÇÃO (+75%)', sc.x, sc.y + 2.5);
      ctx.restore();
    }

    // 8. Marcadores de Alerta Tático (Pings colocados no Quadro de Planejamento)
    for (const ping of game.tacticalPings || []) {
      const sc = this.worldToScreen(ping.x, ping.y, 12);
      if (!sc.visible) continue;
      const pulse = 12 + Math.sin(performance.now() * 0.008) * 5;
      ctx.save();
      ctx.strokeStyle = ping.color || '#ef4444';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "700 11px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = ping.color || '#ef4444';
      ctx.fillText(`📍 ${ping.label}`, sc.x, sc.y - 16);
      ctx.restore();
    }

    // 9. Ícones Táticos Circulares Compactos (Reduzidos em ~48% para não tampar os soldados 3D)
    for (const u of game.units) {
      if (!u.alive || u.captured || u.embarkedInId) continue;
      if (
        u.team === 'enemies' &&
        !game.intelRevealed &&
        !game.map.isPositionVisibleToAllies(u.x, u.y)
      ) {
        continue;
      }

      const heightOffset =
        u.garrisonedBuildingId
          ? 44
          : u.spec.subType === 'watchtower'
          ? 64
          : u.spec.type === 'vehicle'
          ? 36
          : 28;
      const sc = this.worldToScreen(u.x, u.y, heightOffset);
      if (!sc.visible) continue;

      this._drawTacticalUnitBadge(ctx, u, sc.x, sc.y, game.units);
    }

    // 10. Textos Flutuantes
    for (const t of game.texts) {
      if (!game.map.isPositionVisibleToAllies(t.x, t.y)) continue;
      const sc = this.worldToScreen(t.x, t.y, 28);
      if (!sc.visible) continue;
      ctx.save();
      ctx.font = "700 13px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(t.text, sc.x + 1, sc.y + 1);
      ctx.fillStyle = t.color || '#e5e0d0';
      ctx.fillText(t.text, sc.x, sc.y);
      ctx.restore();
    }

    // 11. Caixa de Seleção RTS
    if (game.selectionBox) {
      const { x1, y1, x2, y2 } = game.selectionBox;
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);

      ctx.save();
      ctx.fillStyle = 'rgba(200, 125, 40, 0.15)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#c87d28';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }

  // Ícone Tático Flutuante 48% Menor (r = 9.5 selecionado / 8.0 normal) — Elegante, Discreto e Sem Tampar a Tropa
  _drawTacticalUnitBadge(ctx, u, x, y, allUnits = []) {
    ctx.save();
    const r = u.selected ? 9.5 : 8.0;
    const borderCol = u.surrendered
      ? '#ffffff'
      : u.faction === 'player'
      ? '#7faed9'
      : u.faction === 'ally_ai'
      ? '#d4a338'
      : '#d9534f';
    const fillCol = u.surrendered
      ? 'rgba(255, 255, 255, 0.94)'
      : u.factionMeta?.badgeFill || 'rgba(22, 25, 19, 0.9)';

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fillCol;
    ctx.fill();
    ctx.lineWidth = u.selected ? 2.2 : 1.5;
    ctx.strokeStyle = u.selected ? '#c87d28' : borderCol;
    ctx.stroke();

    if (u.surrendered) {
      ctx.fillStyle = '#1a1d17';
      ctx.font = '900 10px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏳', x, y);

      ctx.fillStyle = '#f5f2eb';
      ctx.fillRect(x - 52, y - r - 18, 104, 14);
      ctx.strokeStyle = '#1a1d17';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 52, y - r - 18, 104, 14);
      ctx.fillStyle = '#1a1d17';
      ctx.font = "700 9.5px 'Inter', sans-serif";
      ctx.fillText('🏳 RENDIDO (CLIQUE)', x, y - r - 11);
    } else if (u.spec.iconType === 'tank') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x - 4.5, y - 2.6, 9, 5.2);
    } else if (u.spec.iconType === 'artillery') {
      ctx.fillStyle = borderCol;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.spec.iconType === 'armor') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5, 2.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (u.spec.iconType === 'assault') {
      // Ícone de Tropa de Assalto (Duas Submetralhadoras Cruzadas / Choque)
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(x - 4.2, y + 3.2);
      ctx.lineTo(x + 4.2, y - 3.2);
      ctx.moveTo(x - 4.2, y - 3.2);
      ctx.lineTo(x + 4.2, y + 3.2);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.spec.iconType === 'sniper') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    } else if (u.spec.iconType === 'officer') {
      ctx.fillStyle = '#d4a338';
      ctx.font = '700 9px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y + 0.5);
    } else if (u.spec.iconType === 'bunker') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x - 3.6, y - 3, 7.2, 6);
    } else if (u.spec.iconType === 'outpost') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (u.spec.iconType === 'emplacement' || u.spec.iconType === 'antitank') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 3.6, y + 2.5);
      ctx.lineTo(x, y - 3.2);
      ctx.lineTo(x + 3.6, y + 2.5);
      ctx.stroke();
    } else {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 3.4, y - 2.8);
      ctx.lineTo(x + 3.4, y + 2.8);
      ctx.moveTo(x + 3.4, y - 2.8);
      ctx.lineTo(x - 3.4, y + 2.8);
      ctx.stroke();
    }

    // Escudo de Cobertura Compacto na lateral do círculo
    if (u.garrisonedBuildingId || u.inTrench || u.inHeavyCover) {
      this._drawCoverShieldIcon(ctx, x + r + 5, y - 2, '#22c55e');
    } else if (u.inLightCover || u.inTreelineCover) {
      this._drawCoverShieldIcon(ctx, x + r + 5, y - 2, '#eab308');
    }

    if (u.garrisonedBuildingId) {
      ctx.fillStyle = 'rgba(18, 22, 16, 0.92)';
      ctx.fillRect(x - 72, y - r - 24, 144, 15);
      ctx.strokeStyle = '#d4a338';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 72, y - r - 24, 144, 15);
      ctx.font = '800 8.5px Inter, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText('🏠 GUARNECIDO (+70% DEFESA)', x, y - r - 13.5);
      const pct = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
      ctx.fillStyle = 'rgba(15, 20, 15, 0.9)';
      ctx.fillRect(x - 26, y - r - 7, 52, 4);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x - 25, y - r - 6, 50 * pct, 2);
    } else if (u.isBrokenDown) {
      const blink = Math.sin(Date.now() * 0.01) > -0.25;
      if (blink) {
        ctx.fillStyle = 'rgba(20, 22, 18, 0.92)';
        ctx.fillRect(x - 68, y - r - 22, 136, 14);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 68, y - r - 22, 136, 14);
        ctx.font = '800 8.5px Inter, sans-serif';
        ctx.fillStyle = '#fb923c';
        ctx.textAlign = 'center';
        ctx.fillText('🔧 AVARIADO (PRECISA ENG.)', x, y - r - 12);
      }
    } else if ((u.suppressedTimer || 0) > 0) {
      ctx.font = '800 9px Inter, sans-serif';
      ctx.fillStyle = '#f97316';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ PINNED', x, y - r - 6);
    }

    if (u.beingRepaired) {
      const pct = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(x - 24, y + r + 10, 48, 5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x - 23, y + r + 11, 46 * pct, 3);
    }

    // Ícone de carga para Veículo de Transporte de Tropas (mostra quantas tropas estão a bordo)
    if (u.spec.isTransport && u.cargoSquadIds) {
      const cargoCount = u.cargoSquadIds.length;
      const totalSoldiers = u.cargoSquadIds.reduce((acc, sid) => {
        const cu = allUnits.find((c) => c.id === sid && c.alive);
        return acc + (cu ? cu.soldiersAlive : 0);
      }, 0);
      ctx.font = "800 10px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = cargoCount > 0 ? '#4ade80' : '#cbd5e1';
      ctx.fillText(`🪖 ${cargoCount}/${u.maxCargoSquads || 2} (${totalSoldiers})`, x, y - r - 8);
    }

    // Rótulo de status apenas quando selecionado ou recarregando
    if (u.reloadTimer > 0 && u.selected) {
      ctx.fillStyle = '#fde047';
      ctx.font = "700 9.5px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('⟳ RECARGA', x, y - r - 5);
    } else if (u.holdPosition && u.selected) {
      ctx.fillStyle = '#fde047';
      ctx.font = "700 9.5px 'Inter', 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('🔒 FIXO', x, y - r - 5);
    }

    // Barra de Integridade Militar Compacta (22x3px)
    const bw = u.spec.type === 'emplacement' ? 28 : 20;
    const bh = 3.0;
    const bx = x - bw * 0.5;
    const by = y + r + 2.5;
    ctx.fillStyle = 'rgba(18, 21, 16, 0.92)';
    ctx.fillRect(bx - 0.8, by - 0.8, bw + 1.6, bh + 1.6);
    const ratio = clamp(u.hp / u.maxHp, 0, 1);
    ctx.fillStyle = ratio > 0.5 ? '#689d6a' : ratio > 0.25 ? '#d4a338' : '#c94a38';
    ctx.fillRect(bx, by, bw * ratio, bh);

    ctx.restore();
  }

  _drawCoverShieldIcon(ctx, sx, sy, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#141712';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx + 3.8, sy - 2.4);
    ctx.lineTo(sx + 3.0, sy + 2.2);
    ctx.lineTo(sx, sy + 4.6);
    ctx.lineTo(sx - 3.0, sy + 2.2);
    ctx.lineTo(sx - 3.8, sy - 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  destroy() {
    this.renderer.dispose();
  }
}
