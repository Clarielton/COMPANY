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

  const seedBase = (map.seed || 1944) | 0;

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

  function fbm2D(x, y, seed = 1944, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      val += amp * valueNoise2D(x * freq, y * freq, seed + o * 97);
      freq *= 2.03;
      amp *= 0.5;
    }
    return val;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  // 1. Síntese Contínua por Pixel (ImageData 512x512 com Domain Warping + Interpolação Bicúbica/Bilinear)
  // Elimina 100% qualquer efeito de blocos quadrados (checkerboard) e cria transições suaves de bioma
  const synthSize = 512;
  const synthCanvas = document.createElement('canvas');
  synthCanvas.width = synthSize;
  synthCanvas.height = synthSize;
  const sctx = synthCanvas.getContext('2d');
  const imgData = sctx.createImageData(synthSize, synthSize);
  const data = imgData.data;

  const bumpSynthCanvas = document.createElement('canvas');
  bumpSynthCanvas.width = synthSize;
  bumpSynthCanvas.height = synthSize;
  const bsctx = bumpSynthCanvas.getContext('2d');
  const bumpImgData = bsctx.createImageData(synthSize, synthSize);
  const bData = bumpImgData.data;

  for (let py = 0; py < synthSize; py++) {
    const ny = py / synthSize;
    for (let px = 0; px < synthSize; px++) {
      const nx = px / synthSize;

      // Domain Warping para formas naturais sinuosas de vegetação e solo
      const warpX = fbm2D(nx * 6.5, ny * 6.5, seedBase + 13, 3) - 0.5;
      const warpY = fbm2D(nx * 6.5 + 5.2, ny * 6.5 + 1.3, seedBase + 29, 3) - 0.5;
      const wx = nx * 11.5 + warpX * 1.45;
      const wy = ny * 11.5 + warpY * 1.45;

      const macro = fbm2D(wx, wy, seedBase, 4);
      const meso = fbm2D(nx * 28.0 + warpY * 2.0, ny * 28.0 - warpX * 2.0, seedBase + 71, 3);
      const micro = valueNoise2D(nx * 110.0, ny * 110.0, seedBase + 199);

      let r, g, b;
      if (isDesert) {
        // Areia dourada, ocre quente, calcário seco e cascalho do deserto
        r = 182;
        g = 150;
        b = 98;
        const duneT = smoothstep(0.32, 0.72, macro);
        r = lerp(154, 212, duneT);
        g = lerp(122, 178, duneT);
        b = lerp(78, 120, duneT);
        const rockT = smoothstep(0.58, 0.82, meso);
        r = lerp(r, 136, rockT * 0.45);
        g = lerp(g, 112, rockT * 0.45);
        b = lerp(b, 80, rockT * 0.45);
      } else if (isWinter) {
        // Neve fresca, geada azulada, terra congelada e musgo boreal
        const snowT = smoothstep(0.28, 0.68, macro);
        r = lerp(164, 236, snowT);
        g = lerp(176, 243, snowT);
        b = lerp(184, 250, snowT);
        const mudT = smoothstep(0.62, 0.85, 1.0 - meso);
        r = lerp(r, 112, mudT * 0.5);
        g = lerp(g, 108, mudT * 0.5);
        b = lerp(b, 98, mudT * 0.5);
      } else {
        // Normandia / Rural: 5 camadas contínuas (grama oliva, musgo úmido, capim dourado seco e húmus/terra)
        const lushT = smoothstep(0.26, 0.72, macro);
        // Base entre verde-musgo profundo (#364924) e verde-prado vivo (#586f36)
        r = lerp(54, 88, lushT);
        g = lerp(73, 111, lushT);
        b = lerp(36, 54, lushT);

        // Manchas naturais de capim queimado pelo sol / feno silvestre (#7c7840)
        const dryGrassT = smoothstep(0.54, 0.78, meso) * smoothstep(0.38, 0.75, macro);
        r = lerp(r, 124, dryGrassT * 0.58);
        g = lerp(g, 120, dryGrassT * 0.58);
        b = lerp(b, 62, dryGrassT * 0.58);

        // Veios sutis de terra úmida / húmus orgânico (#4a3c2a)
        const loamT = smoothstep(0.62, 0.84, 1.0 - macro) * smoothstep(0.42, 0.76, 1.0 - meso);
        r = lerp(r, 76, loamT * 0.65);
        g = lerp(g, 62, loamT * 0.65);
        b = lerp(b, 43, loamT * 0.65);

        // Sombreamento rico de trevo/folhagem rasteira escura (#2c3d1e)
        const cloverT = smoothstep(0.58, 0.82, 1.0 - meso) * lushT;
        r = lerp(r, 44, cloverT * 0.45);
        g = lerp(g, 61, cloverT * 0.45);
        b = lerp(b, 30, cloverT * 0.45);
      }

      // Micro-variação de grão orgânico por pixel
      const grain = (micro - 0.5) * 18;
      const idx = (py * synthSize + px) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r + grain)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g + grain)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b + grain * 0.8)));
      data[idx + 3] = 255;

      // Relevo contínuo para o BumpMap (sem degraus quadrados)
      const bumpVal = Math.max(
        0,
        Math.min(255, Math.round(128 + (macro - 0.5) * 52 + (meso - 0.5) * 44 + (micro - 0.5) * 34))
      );
      bData[idx] = bumpVal;
      bData[idx + 1] = bumpVal;
      bData[idx + 2] = bumpVal;
      bData[idx + 3] = 255;
    }
  }

  sctx.putImageData(imgData, 0, 0);
  bsctx.putImageData(bumpImgData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(synthCanvas, 0, 0, size, size);

  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(bumpSynthCanvas, 0, 0, bumpSize, bumpSize);

  // Micro-tufos orgânicos, raízes e pequenas pedras naturais espalhadas com transição suave
  for (let i = 0; i < 4800; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2.5 + rng() * 9;
    const ry = 1.5 + rng() * 5.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle =
      i % 5 === 0
        ? isDesert
          ? 'rgba(122, 98, 66, 0.24)'
          : isWinter
          ? 'rgba(138, 148, 156, 0.22)'
          : 'rgba(72, 66, 54, 0.22)'
        : i % 3 === 0
        ? isDesert
          ? 'rgba(220, 194, 144, 0.18)'
          : isWinter
          ? 'rgba(248, 252, 255, 0.25)'
          : 'rgba(42, 58, 25, 0.20)'
        : isDesert
        ? 'rgba(156, 124, 82, 0.18)'
        : 'rgba(94, 108, 48, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (i % 2 === 0) {
      bctx.fillStyle = i % 4 === 0 ? 'rgba(200,200,200,0.10)' : 'rgba(68,68,68,0.10)';
      bctx.beginPath();
      bctx.arc((x / size) * bumpSize, (y / size) * bumpSize, 2 + rng() * 6, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  // 1b. Margens Úmidas de Rios e Poeira Natural ao Longo de Estradas/Ferrovias
  if (Array.isArray(map.roads)) {
    for (const road of map.roads) {
      if (!road.points || road.points.length < 2) continue;
      ctx.save();
      drawSmoothRoadPath(ctx, road.points, scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = ((road.width || 65) + 46) * scale;
      ctx.strokeStyle = isDesert
        ? 'rgba(148, 118, 76, 0.26)'
        : isWinter
        ? 'rgba(118, 112, 104, 0.28)'
        : 'rgba(78, 64, 44, 0.28)';
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. Campos Agrícolas / Regiões Naturais com Bordas Esfumadas Orgânicas (Sem aparência de adesivo colado)
  for (let fi = 0; fi < map.fields.length; fi++) {
    const f = map.fields[fi];
    ctx.save();
    const cx = (f.x + f.w * 0.5) * scale;
    const cy = (f.y + f.h * 0.5) * scale;
    const fw = f.w * scale;
    const fh = f.h * scale;
    ctx.translate(cx, cy);
    ctx.rotate(f.angle || 0);

    // Perímetro orgânico perturbado por ruído
    const buildOrganicFieldPath = (targetCtx, wScale = 1) => {
      const hw = (fw * 0.5) * wScale;
      const hh = (fh * 0.5) * wScale;
      const stepsPerSide = 14;
      const pts = [];
      const jitter = (idx) =>
        (Math.sin(idx * 2.3 + fi * 5.7) * 0.5 + Math.cos(idx * 4.1 + fi * 1.9) * 0.5) *
        Math.min(hw, hh) *
        0.12;
      for (let i = 0; i < stepsPerSide; i++) {
        const t = -1 + (2 * i) / stepsPerSide;
        pts.push({ x: t * hw, y: -hh + jitter(i) });
      }
      for (let i = 0; i < stepsPerSide; i++) {
        const t = -1 + (2 * i) / stepsPerSide;
        pts.push({ x: hw + jitter(i + 20), y: t * hh });
      }
      for (let i = 0; i < stepsPerSide; i++) {
        const t = 1 - (2 * i) / stepsPerSide;
        pts.push({ x: t * hw, y: hh + jitter(i + 40) });
      }
      for (let i = 0; i < stepsPerSide; i++) {
        const t = 1 - (2 * i) / stepsPerSide;
        pts.push({ x: -hw + jitter(i + 60), y: t * hh });
      }
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const cur = pts[i];
        targetCtx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) * 0.5, (prev.y + cur.y) * 0.5);
      }
      targetCtx.closePath();
    };

    // Transição suave de terra nas bordas do campo
    if (f.type === 'wheat' || f.type === 'pasture' || f.type === 'plowed') {
      buildOrganicFieldPath(ctx, 1.05);
      ctx.strokeStyle = isDesert ? 'rgba(138, 108, 66, 0.24)' : 'rgba(64, 52, 36, 0.26)';
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    buildOrganicFieldPath(ctx, 1.0);
    ctx.clip();

    // Gradiente radial suave do centro para as bordas para fundir o campo com o terreno ao redor
    const maxR = Math.max(fw, fh) * 0.62;
    const drawSoftFieldBase = (innerCol, outerCol) => {
      const fg = ctx.createRadialGradient(0, 0, maxR * 0.15, 0, 0, maxR);
      fg.addColorStop(0, innerCol);
      fg.addColorStop(0.75, outerCol);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(-fw * 0.6, -fh * 0.6, fw * 1.2, fh * 1.2);
    };

    if (f.type === 'wheat') {
      drawSoftFieldBase('rgba(148, 124, 54, 0.64)', 'rgba(118, 102, 46, 0.34)');
      ctx.strokeStyle = 'rgba(102, 82, 30, 0.28)';
      ctx.lineWidth = 2.0;
      for (let sy = -fh / 2 + 6; sy < fh / 2; sy += 8) {
        ctx.beginPath();
        ctx.moveTo(-fw * 0.46, sy);
        ctx.bezierCurveTo(-fw * 0.15, sy + 1.5, fw * 0.15, sy - 1.5, fw * 0.46, sy);
        ctx.stroke();
      }
    } else if (f.type === 'pasture') {
      drawSoftFieldBase('rgba(78, 102, 48, 0.55)', 'rgba(66, 88, 42, 0.24)');
      for (let p = 0; p < 90; p++) {
        ctx.fillStyle = p % 2 === 0 ? 'rgba(98, 122, 58, 0.18)' : 'rgba(52, 72, 32, 0.18)';
        ctx.beginPath();
        ctx.ellipse((rng() - 0.5) * fw * 0.85, (rng() - 0.5) * fh * 0.85, 12 + rng() * 22, 8 + rng() * 16, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.type === 'plowed') {
      drawSoftFieldBase('rgba(78, 58, 40, 0.68)', 'rgba(68, 52, 36, 0.35)');
      ctx.strokeStyle = 'rgba(48, 34, 22, 0.38)';
      ctx.lineWidth = 2.6;
      for (let sy = -fh / 2 + 6; sy < fh / 2; sy += 9) {
        ctx.beginPath();
        ctx.moveTo(-fw * 0.46, sy);
        ctx.bezierCurveTo(-fw * 0.15, sy - 1.5, fw * 0.15, sy + 1.5, fw * 0.46, sy);
        ctx.stroke();
      }
    } else if (f.type === 'mud') {
      drawSoftFieldBase('rgba(70, 60, 44, 0.62)', 'rgba(62, 54, 40, 0.28)');
    } else if (f.type === 'dune') {
      drawSoftFieldBase('rgba(202, 168, 110, 0.62)', 'rgba(184, 150, 96, 0.28)');
      ctx.strokeStyle = 'rgba(156, 122, 68, 0.26)';
      ctx.lineWidth = 3.5;
      for (let sy = -fh / 2 + 12; sy < fh / 2; sy += 20) {
        ctx.beginPath();
        ctx.moveTo(-fw * 0.45, sy);
        ctx.quadraticCurveTo(0, sy - 9, fw * 0.45, sy);
        ctx.stroke();
      }
    } else if (f.type === 'rock') {
      drawSoftFieldBase('rgba(136, 116, 88, 0.58)', 'rgba(124, 104, 78, 0.26)');
    } else if (f.type === 'oasis') {
      drawSoftFieldBase('rgba(116, 126, 72, 0.58)', 'rgba(136, 128, 82, 0.24)');
      const og = ctx.createRadialGradient(0, 0, 8, 0, 0, Math.min(fw, fh) * 0.44);
      og.addColorStop(0, '#2d7a78');
      og.addColorStop(0.55, '#4b7b44');
      og.addColorStop(1, 'rgba(145, 138, 86, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fh) * 0.44, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'wadi') {
      drawSoftFieldBase('rgba(146, 118, 78, 0.60)', 'rgba(136, 108, 72, 0.26)');
    } else if (f.type === 'snow_field') {
      drawSoftFieldBase('rgba(234, 242, 248, 0.68)', 'rgba(218, 228, 238, 0.30)');
    } else if (f.type === 'frozen_mud') {
      drawSoftFieldBase('rgba(124, 120, 112, 0.58)', 'rgba(114, 110, 102, 0.26)');
    } else if (f.type === 'ice_lake') {
      drawSoftFieldBase('rgba(165, 206, 232, 0.72)', 'rgba(150, 190, 218, 0.32)');
    }
    ctx.restore();

    // Sulcos suaves no BumpMap para terra arada / trigo
    if (f.type === 'plowed' || f.type === 'wheat') {
      bctx.save();
      bctx.translate((f.x + f.w * 0.5) * bScale, (f.y + f.h * 0.5) * bScale);
      bctx.rotate(f.angle || 0);
      bctx.strokeStyle = 'rgba(195, 195, 195, 0.24)';
      bctx.lineWidth = 1.6;
      const bfw = f.w * bScale * 0.86;
      const bfh = f.h * bScale * 0.86;
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

  // 3b. Solo de Floresta (Forest Floor: terra escura de húmus, folhas secas, raízes e samambaias sob bosques)
  for (const fz of map.forestZones || []) {
    const fx = fz.x * scale;
    const fy = fz.y * scale;
    const fr = (fz.radius || 180) * scale;
    const fg = ctx.createRadialGradient(fx, fy, fr * 0.18, fx, fy, fr * 1.08);
    fg.addColorStop(0, isDesert ? 'rgba(92, 82, 46, 0.58)' : 'rgba(34, 42, 20, 0.72)');
    fg.addColorStop(0.65, isDesert ? 'rgba(104, 90, 52, 0.36)' : 'rgba(46, 48, 24, 0.48)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 1.08, 0, Math.PI * 2);
    ctx.fill();

    // Folhas secas e raízes espalhadas na base da floresta
    for (let li = 0; li < 42; li++) {
      const ang = rng() * Math.PI * 2;
      const distR = rng() * fr * 0.88;
      ctx.fillStyle = li % 3 === 0 ? 'rgba(94, 70, 36, 0.48)' : 'rgba(40, 54, 22, 0.45)';
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(ang) * distR, fy + Math.sin(ang) * distR, 2.5 + rng() * 4, 1.5 + rng() * 2.5, ang, 0, Math.PI * 2);
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

  // Base neutra clara para MultiplyBlending sem escurecer artificialmente a grama
  ctx.fillStyle = isDesert ? '#e4d8c0' : isWinter ? '#f3f7fa' : '#c8d6b6';
  ctx.fillRect(0, 0, size, size);

  // 1. Poros e micro-grãos orgânicos do solo (seamlessly wrapped nas bordas 512x512)
  for (let i = 0; i < 8500; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.7 + rng() * 1.8;
    ctx.fillStyle =
      i % 3 === 0
        ? isDesert
          ? 'rgba(138, 108, 68, 0.34)'
          : isWinter
          ? 'rgba(155, 178, 200, 0.30)'
          : 'rgba(52, 72, 30, 0.32)'
        : i % 2 === 0
        ? isDesert
          ? 'rgba(250, 236, 204, 0.34)'
          : isWinter
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(218, 232, 184, 0.34)'
        : 'rgba(92, 76, 52, 0.24)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Micro-tufos de lâminas curvas de grama / trevos / ondulações de areia
  ctx.lineCap = 'round';
  for (let i = 0; i < 2800; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const blades = isDesert ? 1 : 2 + (i % 3);
    for (let b = 0; b < blades; b++) {
      const len = isDesert ? 4 + rng() * 7 : 3.5 + rng() * 6.5;
      const ang = isDesert
        ? (rng() - 0.5) * 0.35
        : -Math.PI * 0.5 + (rng() - 0.5) * 1.25;
      const ex = cx + Math.cos(ang) * len;
      const ey = cy + Math.sin(ang) * len;
      const mx = (cx + ex) * 0.5 + (rng() - 0.5) * 2.5;
      const my = (cy + ey) * 0.5 + (rng() - 0.5) * 2.5;
      ctx.lineWidth = 0.9 + rng() * 0.8;
      ctx.strokeStyle = isDesert
        ? 'rgba(164, 134, 88, 0.30)'
        : isWinter
        ? 'rgba(176, 196, 214, 0.30)'
        : b % 2 === 0
        ? 'rgba(58, 84, 30, 0.38)'
        : 'rgba(148, 168, 96, 0.32)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(84, 84);
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

  // Bordas escuras de cascalho / meio-fio para destacar claramente a estrada do gramado
  const leftBorder = ctx.createLinearGradient(0, 0, 28, 0);
  leftBorder.addColorStop(0, isDesert ? 'rgba(98, 74, 44, 0.82)' : 'rgba(28, 24, 18, 0.85)');
  leftBorder.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftBorder;
  ctx.fillRect(0, 0, 28, h);

  const rightBorder = ctx.createLinearGradient(w - 28, 0, w, 0);
  rightBorder.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rightBorder.addColorStop(1, isDesert ? 'rgba(98, 74, 44, 0.82)' : 'rgba(28, 24, 18, 0.85)');
  ctx.fillStyle = rightBorder;
  ctx.fillRect(w - 28, 0, 28, h);

  // Marcas centrais sutis (faixa desgastada / eixo central)
  ctx.fillStyle = isDesert ? 'rgba(235, 212, 168, 0.24)' : isWinter ? 'rgba(210, 222, 232, 0.28)' : 'rgba(204, 192, 158, 0.22)';
  for (let dashY = 12; dashY < h; dashY += 64) {
    ctx.fillRect(w * 0.5 - 2.5, dashY, 5, 30);
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

/**
 * Gera textura procedural de alta frequência 512x512 (RepeatWrapping 32x32)
 * com grãos de terra, grama escura (#2d4222), grama seca (#4a5328) e pedregulhos,
 * retornando map, bumpMap e roughnessMap sincronizados.
 */
export function createHighFreqGroundTextures(theme = 'rural') {
  const isDesert = theme === 'desert';
  const isWinter = theme === 'winter';
  const size = 512;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  const bctx = bc.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = size;
  rc.height = size;
  const rctx = rc.getContext('2d');

  const rng = mulberry32(isDesert ? 5511 : isWinter ? 8844 : 2044);

  // Base rica (sem aspecto lavado)
  ctx.fillStyle = isDesert ? '#9c7c4a' : isWinter ? '#b6c4cf' : '#2d4222';
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#787878';
  bctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#e6e6e6';
  rctx.fillRect(0, 0, size, size);

  // Manchas de grama seca (#4a5328) e terra batida
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 8 + rng() * 24;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, rad);
    if (isDesert) {
      grad.addColorStop(0, i % 2 === 0 ? 'rgba(182, 148, 92, 0.35)' : 'rgba(116, 86, 52, 0.32)');
    } else if (isWinter) {
      grad.addColorStop(0, i % 2 === 0 ? 'rgba(218, 228, 236, 0.38)' : 'rgba(118, 126, 132, 0.30)');
    } else {
      grad.addColorStop(
        0,
        i % 3 === 0
          ? 'rgba(74, 83, 40, 0.52)'
          : i % 2 === 0
          ? 'rgba(58, 46, 30, 0.42)'
          : 'rgba(34, 52, 24, 0.48)'
      );
    }
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grãos de terra, tufos de grama e pedregulhos (com bump e roughness correspondentes)
  for (let i = 0; i < 14000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const sz = 1 + rng() * 2.4;
    const kind = i % 6;

    if (kind === 0) {
      // Pedregulho claro/ardósia
      ctx.fillStyle = isDesert ? 'rgba(196, 170, 126, 0.55)' : 'rgba(104, 108, 102, 0.52)';
      bctx.fillStyle = 'rgba(235, 235, 235, 0.55)';
      rctx.fillStyle = 'rgba(175, 175, 175, 0.5)';
    } else if (kind === 1 || kind === 2) {
      // Tufo de grama escura (#2d4222)
      ctx.fillStyle = isDesert
        ? 'rgba(132, 102, 62, 0.48)'
        : isWinter
        ? 'rgba(148, 166, 182, 0.42)'
        : 'rgba(45, 66, 34, 0.65)';
      bctx.fillStyle = 'rgba(185, 185, 185, 0.45)';
      rctx.fillStyle = 'rgba(240, 240, 240, 0.55)';
    } else if (kind === 3) {
      // Grama seca (#4a5328)
      ctx.fillStyle = isDesert
        ? 'rgba(208, 174, 114, 0.45)'
        : isWinter
        ? 'rgba(236, 244, 250, 0.48)'
        : 'rgba(74, 83, 40, 0.60)';
      bctx.fillStyle = 'rgba(165, 165, 165, 0.4)';
      rctx.fillStyle = 'rgba(228, 228, 228, 0.5)';
    } else {
      // Grão de terra escura
      ctx.fillStyle = isDesert ? 'rgba(96, 72, 42, 0.42)' : 'rgba(42, 34, 22, 0.48)';
      bctx.fillStyle = 'rgba(58, 58, 58, 0.45)';
      rctx.fillStyle = 'rgba(250, 250, 250, 0.55)';
    }

    ctx.fillRect(x, y, sz, sz);
    bctx.fillRect(x, y, sz, sz);
    rctx.fillRect(x, y, sz, sz);
  }

  const setupTex = (canvas, isColor) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(32, 32);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    return tex;
  };

  return {
    map: setupTex(c, true),
    bumpMap: setupTex(bc, false),
    roughnessMap: setupTex(rc, false),
  };
}
