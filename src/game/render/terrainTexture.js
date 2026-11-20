import * as THREE from 'three';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSmoothRoadPath(ctx, points, scale) {
  if (!points || points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale, points[0].y * scale);
  for (let i = 1; i < points.length - 1; i++) {
    const xc = ((points[i].x + points[i + 1].x) * 0.5) * scale;
    const yc = ((points[i].y + points[i + 1].y) * 0.5) * scale;
    ctx.quadraticCurveTo(points[i].x * scale, points[i].y * scale, xc, yc);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x * scale, last.y * scale);
}

/**
 * Gera texturas orgânicas multicamadas (Albedo 2048x2048 + BumpMap 1024x1024)
 * sem linhas quadradas/grade artificial, com estradas integradas ao solo e marcas de lagarta.
 */
export function createOrganicBattlefieldTextures(map) {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const scale = size / map.size;

  const bumpSize = 1024;
  const bc = document.createElement('canvas');
  bc.width = bumpSize;
  bc.height = bumpSize;
  const bctx = bc.getContext('2d');
  const bScale = bumpSize / map.size;

  const rng = mulberry32(map.seed || 1944);
  const isDesert = map.theme === 'desert';
  const isWinter = map.theme === 'winter';

  // 1. Base Orgânica (Grama Militar / Areia Desértica / Neve das Ardenas)
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  if (isDesert) {
    baseGrad.addColorStop(0, '#bfa06b');
    baseGrad.addColorStop(0.5, '#b29058');
    baseGrad.addColorStop(1, '#c4a672');
  } else if (isWinter) {
    baseGrad.addColorStop(0, '#dbe4ec');
    baseGrad.addColorStop(0.5, '#cfdbe6');
    baseGrad.addColorStop(1, '#e3ebf2');
  } else {
    baseGrad.addColorStop(0, '#44572d');
    baseGrad.addColorStop(0.5, '#3b4d26');
    baseGrad.addColorStop(1, '#495d31');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, bumpSize, bumpSize);

function valueNoise2D(x, y, seed = 1944) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const hash = (ix, iy) => {
    let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x, y, seed = 1944) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    val += amp * valueNoise2D(x * freq, y * freq, seed + o * 97);
    freq *= 2.05;
    amp *= 0.5;
  }
  return val;
}

  // Manchas orgânicas multicamadas com ruído FBM (3 tons de oliva/musgo, terra batida, raízes e pedras)
  const noiseGrid = 128;
  const cellPx = size / noiseGrid;
  const bumpCellPx = bumpSize / noiseGrid;
  for (let gy = 0; gy < noiseGrid; gy++) {
    for (let gx = 0; gx < noiseGrid; gx++) {
      const n = fbm2D(gx * 0.14, gy * 0.14, map.seed || 1944);
      const n2 = fbm2D(gx * 0.38 + 11, gy * 0.38 + 7, (map.seed || 1944) + 55);
      if (isDesert) {
        ctx.fillStyle =
          n > 0.62
            ? 'rgba(214, 184, 128, 0.28)'
            : n < 0.38
            ? 'rgba(138, 108, 66, 0.28)'
            : 'rgba(176, 144, 92, 0.20)';
      } else if (isWinter) {
        ctx.fillStyle =
          n > 0.58
            ? 'rgba(244, 249, 255, 0.32)'
            : n < 0.38
            ? 'rgba(130, 138, 132, 0.26)'
            : 'rgba(182, 200, 218, 0.22)';
      } else {
        // 3 tons de grama oliva/musgo + manchas de terra batida/lama
        ctx.fillStyle =
          n > 0.63
            ? 'rgba(92, 114, 52, 0.30)'
            : n < 0.34
            ? 'rgba(72, 58, 40, 0.34)'
            : n2 > 0.56
            ? 'rgba(56, 76, 32, 0.26)'
            : 'rgba(104, 112, 58, 0.22)';
      }
      ctx.fillRect(gx * cellPx, gy * cellPx, cellPx + 1, cellPx + 1);

      const bv = Math.round(108 + n * 48 + (n2 - 0.5) * 24);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(gx * bumpCellPx, gy * bumpCellPx, bumpCellPx + 1, bumpCellPx + 1);
    }
  }

  // Pequenas pedras, raízes e micro-variação orgânica no solo
  for (let i = 0; i < 4200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2 + rng() * 8;
    const ry = 1.5 + rng() * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle =
      i % 5 === 0
        ? isDesert
          ? 'rgba(122, 98, 66, 0.34)'
          : 'rgba(76, 72, 62, 0.34)'
        : i % 3 === 0
        ? isDesert
          ? 'rgba(220, 194, 144, 0.22)'
          : 'rgba(46, 62, 28, 0.24)'
        : 'rgba(84, 68, 46, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (i % 3 === 0) {
      bctx.fillStyle = i % 4 === 0 ? 'rgba(205,205,205,0.12)' : 'rgba(65,65,65,0.12)';
      bctx.beginPath();
      bctx.arc((x / size) * bumpSize, (y / size) * bumpSize, 3 + rng() * 8, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  // 2. Campos Agrícolas / Regiões Naturais com Bordas Orgânicas (Sem retângulos duros)
  for (const f of map.fields) {
    ctx.save();
    const cx = (f.x + f.w * 0.5) * scale;
    const cy = (f.y + f.h * 0.5) * scale;
    const fw = f.w * scale;
    const fh = f.h * scale;
    ctx.translate(cx, cy);
    ctx.rotate(f.angle || 0);

    // Máscara suave com cantos arredondados orgânicos
    const r = Math.min(fw, fh) * 0.12;
    ctx.beginPath();
    ctx.roundRect(-fw / 2, -fh / 2, fw, fh, r);
    ctx.clip();

    if (f.type === 'wheat') {
      ctx.fillStyle = 'rgba(168, 138, 56, 0.85)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(118, 92, 28, 0.42)';
      ctx.lineWidth = 2.5;
      for (let sy = -fh / 2 + 6; sy < fh / 2; sy += 9) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.lineTo(fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'pasture') {
      ctx.fillStyle = 'rgba(79, 104, 50, 0.72)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      for (let p = 0; p < 120; p++) {
        ctx.fillStyle = p % 2 === 0 ? 'rgba(98, 122, 58, 0.22)' : 'rgba(56, 76, 36, 0.22)';
        ctx.beginPath();
        ctx.ellipse((rng() - 0.5) * fw, (rng() - 0.5) * fh, 14 + rng() * 24, 9 + rng() * 18, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.type === 'plowed') {
      ctx.fillStyle = 'rgba(84, 62, 42, 0.88)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(52, 36, 22, 0.62)';
      ctx.lineWidth = 3.5;
      for (let sy = -fh / 2 + 6; sy < fh / 2; sy += 10) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.lineTo(fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'mud') {
      ctx.fillStyle = 'rgba(70, 61, 46, 0.85)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'dune') {
      ctx.fillStyle = 'rgba(202, 168, 110, 0.78)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.strokeStyle = 'rgba(164, 128, 72, 0.36)';
      ctx.lineWidth = 4;
      for (let sy = -fh / 2 + 12; sy < fh / 2; sy += 22) {
        ctx.beginPath();
        ctx.moveTo(-fw / 2, sy);
        ctx.quadraticCurveTo(0, sy - 9, fw / 2, sy);
        ctx.stroke();
      }
    } else if (f.type === 'rock') {
      ctx.fillStyle = 'rgba(139, 118, 89, 0.75)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'oasis') {
      ctx.fillStyle = 'rgba(145, 138, 86, 0.7)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      const og = ctx.createRadialGradient(0, 0, 10, 0, 0, Math.min(fw, fh) * 0.44);
      og.addColorStop(0, '#2d7a78');
      og.addColorStop(0.55, '#4b7b44');
      og.addColorStop(1, 'rgba(145, 138, 86, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fh) * 0.44, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'wadi') {
      ctx.fillStyle = 'rgba(150, 122, 82, 0.78)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'snow_field') {
      ctx.fillStyle = 'rgba(232, 240, 247, 0.85)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'frozen_mud') {
      ctx.fillStyle = 'rgba(130, 126, 118, 0.72)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    } else if (f.type === 'ice_lake') {
      ctx.fillStyle = 'rgba(165, 206, 232, 0.82)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    }
    ctx.restore();

    // Sulcos no BumpMap para terra arada / trigo
    if (f.type === 'plowed' || f.type === 'wheat') {
      bctx.save();
      bctx.translate((f.x + f.w * 0.5) * bScale, (f.y + f.h * 0.5) * bScale);
      bctx.rotate(f.angle || 0);
      bctx.strokeStyle = 'rgba(215, 215, 215, 0.35)';
      bctx.lineWidth = 2;
      const bfw = f.w * bScale;
      const bfh = f.h * bScale;
      for (let sy = -bfh / 2 + 4; sy < bfh / 2; sy += 6) {
        bctx.beginPath();
        bctx.moveTo(-bfw / 2, sy);
        bctx.lineTo(bfw / 2, sy);
        bctx.stroke();
      }
      bctx.restore();
    }
  }

  // 3. Manchas nítidas de Terra Batida ao redor de HQs e Setores (sem radialGradient borrado)
  const dirtSpots = [
    ...Object.values(map.hqs || {}).map((h) => ({ x: h.x, y: h.y, r: 220 })),
    ...(map.sectors || []).map((s) => ({ x: s.x, y: s.y, r: s.radius * 0.85 })),
  ];
  for (const sp of dirtSpots) {
    const sx = sp.x * scale;
    const sy = sp.y * scale;
    const sr = sp.r * scale;
    ctx.fillStyle = isDesert ? 'rgba(138, 108, 68, 0.35)' : 'rgba(82, 68, 48, 0.38)';
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      const distR = sr * (0.2 + (k % 4) * 0.18);
      ctx.beginPath();
      ctx.ellipse(
        sx + Math.cos(ang) * distR,
        sy + Math.sin(ang) * distR,
        sr * 0.25,
        sr * 0.18,
        ang,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 4. Estradas são renderizadas exclusivamente pela malha dedicada (_buildRoadMeshes) para nitidez total sem duplicação

  // 5. Crateras de Artilharia (Areia/Rocha no Deserto; Terra Queimada nos demais mapas)
  for (const cr of map.craters) {
    const x = cr.x * scale;
    const y = cr.y * scale;
    const r = cr.radius * scale;
    const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    if (isDesert) {
      g.addColorStop(0, '#8f744c');
      g.addColorStop(0.55, '#b29468');
      g.addColorStop(1, 'rgba(178, 148, 104, 0)');
    } else {
      g.addColorStop(0, '#1e1913');
      g.addColorStop(0.55, '#3b3022');
      g.addColorStop(1, 'rgba(59, 48, 34, 0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const bx = cr.x * bScale;
    const by = cr.y * bScale;
    const br = cr.radius * bScale;
    const bg = bctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
    bg.addColorStop(0, '#222222');
    bg.addColorStop(0.75, '#b8b8b8');
    bg.addColorStop(1, 'rgba(128,128,128,0)');
    bctx.fillStyle = bg;
    bctx.beginPath();
    bctx.arc(bx, by, br, 0, Math.PI * 2);
    bctx.fill();
  }

  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.minFilter = THREE.LinearMipmapLinearFilter;
  colorMap.magFilter = THREE.LinearFilter;
  colorMap.anisotropy = 16;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  bumpMap.magFilter = THREE.LinearFilter;
  bumpMap.anisotropy = 8;

  return { colorMap, bumpMap };
}

/**
 * Textura de micro-detalhe de alta frequência (64x64 repeat) com fios de grama,
 * grãos de terra, pedrinhas e folhas secas para nitidez total de perto.
 */
export function createGroundDetailTexture(theme = 'rural') {
  const isDesert = theme === 'desert' || theme === true;
  const isWinter = theme === 'winter';
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = mulberry32(isDesert ? 7711 : isWinter ? 9933 : 4499);

  ctx.fillStyle = isDesert ? '#d7c8ab' : isWinter ? '#eef4f8' : '#96a882';
  ctx.fillRect(0, 0, size, size);

  // Grãos de terra / areia / cristais de neve nítidos
  for (let i = 0; i < 6000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const s = 1 + rng() * 2.2;
    ctx.fillStyle =
      i % 3 === 0
        ? isDesert
          ? 'rgba(138, 108, 68, 0.42)'
          : isWinter
          ? 'rgba(150, 174, 198, 0.36)'
          : 'rgba(42, 58, 24, 0.42)'
        : isDesert
        ? 'rgba(242, 224, 186, 0.35)'
        : isWinter
        ? 'rgba(255, 255, 255, 0.48)'
        : 'rgba(176, 194, 128, 0.32)';
    ctx.fillRect(x, y, s, s);
  }

  // Fios de grama fina ou pedrinhas
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 3 + rng() * 6;
    const ang = (rng() - 0.5) * 0.9 - Math.PI * 0.5;
    ctx.strokeStyle = isDesert ? 'rgba(165, 138, 92, 0.38)' : 'rgba(54, 78, 28, 0.48)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(64, 64);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Textura nítida para malha dedicada de estrada (RepeatWrapping ao longo do comprimento)
 * com marcas de pneu/lagarta definidas e cascalho nas bordas.
 */
export function createRoadSurfaceTexture(theme = 'rural') {
  const isDesert = theme === 'desert' || theme === true;
  const isWinter = theme === 'winter';
  const w = 256;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rng = mulberry32(isDesert ? 8822 : isWinter ? 6677 : 3344);

  // Base da estrada com manchas orgânicas de terra batida e lama
  ctx.fillStyle = isDesert ? '#bfa171' : isWinter ? '#6c7278' : '#6e5a42';
  ctx.fillRect(0, 0, w, h);

  for (let p = 0; p < 34; p++) {
    const px = rng() * w;
    const py = rng() * h;
    const pr = 16 + rng() * 34;
    const pg = ctx.createRadialGradient(px, py, 2, px, py, pr);
    pg.addColorStop(
      0,
      p % 3 === 0
        ? isDesert
          ? 'rgba(218, 192, 146, 0.35)'
          : 'rgba(136, 114, 86, 0.35)'
        : isDesert
        ? 'rgba(140, 108, 68, 0.32)'
        : 'rgba(44, 34, 24, 0.38)'
    );
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pedregulhos e tufos de mato invadindo as laterais da pista
  for (let i = 0; i < 2400; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const edgeFactor = Math.abs(x - w * 0.5) / (w * 0.5);
    const sz = edgeFactor > 0.7 ? 1.5 + rng() * 3.8 : 1 + rng() * 2.2;
    if (edgeFactor > 0.76 && i % 5 === 0 && !isDesert) {
      ctx.fillStyle = isWinter ? 'rgba(195, 208, 218, 0.55)' : 'rgba(66, 94, 42, 0.65)';
    } else {
      ctx.fillStyle =
        i % 2 === 0
          ? isDesert
            ? 'rgba(136, 106, 66, 0.55)'
            : 'rgba(52, 40, 28, 0.55)'
          : isDesert
          ? 'rgba(218, 192, 146, 0.45)'
          : 'rgba(138, 118, 92, 0.45)';
    }
    ctx.fillRect(x, y, sz, sz);
  }

  // Trilhos contínuos paralelos de pneus e esteiras de tanque + cascalho fino no centro + bumpMap
  const bCanvas = document.createElement('canvas');
  bCanvas.width = w;
  bCanvas.height = h;
  const bctx = bCanvas.getContext('2d');
  bctx.fillStyle = '#848484';
  bctx.fillRect(0, 0, w, h);

  // Cascalho fino e compactado no eixo central
  for (let i = 0; i < 1600; i++) {
    const gx = w * 0.38 + rng() * (w * 0.24);
    const gy = rng() * h;
    const gs = 1 + rng() * 2.1;
    ctx.fillStyle = isDesert ? 'rgba(212, 184, 134, 0.36)' : 'rgba(148, 136, 118, 0.36)';
    ctx.fillRect(gx, gy, gs, gs);
    bctx.fillStyle = 'rgba(210, 210, 210, 0.35)';
    bctx.fillRect(gx, gy, gs, gs);
  }

  // Trilhos contínuos paralelos de pneus e esteiras (sem pontinhos repetidos)
  for (const baseTx of [w * 0.33, w * 0.67]) {
    ctx.strokeStyle = isDesert ? 'rgba(122, 92, 54, 0.44)' : 'rgba(42, 32, 22, 0.46)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y <= h; y += 8) {
      const wave = Math.sin((y / h) * Math.PI * 2) * 4 + Math.cos((y / h) * Math.PI * 4) * 2.5;
      if (y === 0) ctx.moveTo(baseTx + wave, y);
      else ctx.lineTo(baseTx + wave, y);
    }
    ctx.stroke();

    // Sulco rebaixado no bumpMap para os trilhos de tanque/pneu
    bctx.strokeStyle = 'rgba(48, 48, 48, 0.65)';
    bctx.lineWidth = 15;
    bctx.beginPath();
    for (let y = 0; y <= h; y += 8) {
      const wave = Math.sin((y / h) * Math.PI * 2) * 4 + Math.cos((y / h) * Math.PI * 4) * 2.5;
      if (y === 0) bctx.moveTo(baseTx + wave, y);
      else bctx.lineTo(baseTx + wave, y);
    }
    bctx.stroke();
  }

  for (let k = 0; k < 8; k++) {
    const px = w * 0.24 + rng() * w * 0.52;
    const py = rng() * h;
    const pr = 10 + rng() * 14;
    const puddle = ctx.createRadialGradient(px, py, 2, px, py, pr);
    puddle.addColorStop(0, isDesert ? 'rgba(110, 84, 52, 0.35)' : 'rgba(28, 24, 20, 0.42)');
    puddle.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = puddle;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 40);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;

  const bumpTex = new THREE.CanvasTexture(bCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(1, 40);
  bumpTex.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTex.magFilter = THREE.LinearFilter;
  bumpTex.anisotropy = 8;

  tex.userData = { bumpMap: bumpTex };
  return tex;
}
