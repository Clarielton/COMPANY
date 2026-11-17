// =============================================================================
// RELEVO 3D PROCEDURAL (HEIGHTMAP + ESTRADAS + CRATERAS DE ARTILHARIA)
// =============================================================================

function hash2D(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2D(x, z) {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < 4; i++) {
    value += amp * (smoothNoise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

function distToSegmentSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 0.0001) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const cx = ax + dx * t;
  const cz = az + dz * t;
  const ex = px - cx;
  const ez = pz - cz;
  return ex * ex + ez * ez;
}

/**
 * Retorna a altura Y exata do terreno 3D em qualquer coordenada (x, z) do mundo.
 * Inclui colinas táticas suaves, nivelamento de estradas com valas laterais e crateras 3D reais.
 */
export function getTerrainHeight(x, z, map = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

  const size = map?.size || 9600;
  const isDesert = map?.theme === 'desert';

  // 1. Ondulações orgânicas em múltiplas oitavas + colinas nas bordas/laterais
  const nx = x * 0.00042;
  const nz = z * 0.00042;
  let h = fbm2D(nx, nz) * (isDesert ? 26 : 22);

  // Elevações táticas suaves nos flancos norte/sul e bordas do mapa
  const edgeX = Math.max(0, Math.abs(x - size * 0.5) / (size * 0.5) - 0.62) / 0.38;
  const edgeZ = Math.max(0, Math.abs(z - size * 0.5) / (size * 0.5) - 0.62) / 0.38;
  const flankLift = (edgeX * edgeX + edgeZ * edgeZ) * 24;
  h += flankLift;

  // 2. Nivelamento suave nas estradas + valas laterais (ditches) nas margens
  if (map?.roads && map.roads.length > 0) {
    let minRoadDist = 99999;
    let nearestHalfW = 55;
    for (let r = 0; r < map.roads.length; r++) {
      const rd = map.roads[r];
      const pts = rd.points;
      const hw = (rd.width || 95) * 0.5;
      for (let i = 0; i < pts.length - 1; i++) {
        const dSq = distToSegmentSq(x, z, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        if (dSq < minRoadDist * minRoadDist) {
          minRoadDist = Math.sqrt(dSq);
          nearestHalfW = hw;
        }
      }
    }

    if (minRoadDist < nearestHalfW + 130) {
      if (minRoadDist <= nearestHalfW + 60) {
        // Força o terreno a ficar 100% plano (y = 0) sob a estrada e até 6m do eixo
        h = 0;
      } else {
        // Transição suave nas margens da estrada
        const shoulderT = (minRoadDist - (nearestHalfW + 60)) / 70;
        const smoothT = shoulderT * shoulderT * (3 - 2 * shoulderT);
        h *= smoothT;
      }
    }
  }

  // 3. Crateras de Artilharia 3D Reais (centro afundado + borda elevada irregular)
  if (map?.craters && map.craters.length > 0) {
    for (let i = 0; i < map.craters.length; i++) {
      const cr = map.craters[i];
      const dx = x - cr.x;
      const dz = z - cr.y;
      const maxR = cr.radius * 1.42;
      if (Math.abs(dx) > maxR || Math.abs(dz) > maxR) continue;
      const d = Math.hypot(dx, dz);
      if (d < maxR) {
        const t = d / cr.radius;
        if (t < 0.85) {
          // Depressão da cratera
          const bowl = Math.cos((t / 0.85) * Math.PI * 0.5);
          h -= bowl * 11.5;
        } else {
          // Borda irregular de terra queimada ao redor da cratera
          const rimT = (t - 0.85) / 0.57;
          const rim = Math.sin(rimT * Math.PI);
          h += rim * 4.5;
        }
      }
    }
  }

  // Nivelar suavemente ao redor dos QGs e Prédios da Base/Mapa (flattenedPads)
  if (map?.hqs) {
    for (const key of Object.keys(map.hqs)) {
      const hq = map.hqs[key];
      if (!hq) continue;
      const d = Math.hypot(x - hq.x, z - hq.y);
      if (d < 520) {
        const blend = Math.max(0, (d - 320) / 200);
        h *= blend;
      }
    }
  }

  if (map?.flattenedPads) {
    for (let i = 0; i < map.flattenedPads.length; i++) {
      const p = map.flattenedPads[i];
      const d = Math.hypot(x - p.x, z - p.y);
      if (d < p.radius + 70) {
        const blend = Math.max(0, (d - p.radius) / 70);
        h *= blend;
      }
    }
  }

  return h;
}
