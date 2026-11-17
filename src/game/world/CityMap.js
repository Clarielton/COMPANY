import {
  TILE,
  BLOCK,
  ROAD_W,
  BLOCKS,
  MAP_TILES,
  WORLD_SIZE,
  DISTRICT_SIZE,
  T,
  SOLID_TILES,
} from '../config.js';
import { mulberry32, clamp } from '../core/math.js';
import { INITIAL_DISTRICTS, FACTIONS } from '../data/factions.js';

const POI_LAYOUT = {
  // 2 Grandes Bancos
  '4,4': { type: 'bank', name: 'Banco Central Metropolitano', rewardMin: 10000, rewardMax: 14500 },
  '7,4': { type: 'bank', name: 'Banco Reserva Leste', rewardMin: 8500, rewardMax: 12500 },
  // 6 Lojas de Conveniência
  '1,1': { type: 'store', name: '24h Docas Express', rewardMin: 900, rewardMax: 1500 },
  '4,1': { type: 'store', name: 'Conveniência Ferro & Aço', rewardMin: 1000, rewardMax: 1700 },
  '7,1': { type: 'store', name: 'Kombini Sakura', rewardMin: 950, rewardMax: 1650 },
  '1,4': { type: 'store', name: 'Mercado Vila 24h', rewardMin: 850, rewardMax: 1450 },
  '1,7': { type: 'store', name: 'Estação Express', rewardMin: 950, rewardMax: 1600 },
  '7,7': { type: 'store', name: 'Mini-Mart Torre Leste', rewardMin: 1100, rewardMax: 1850 },
  // 4 Lojas Ammu-Nation
  '1,2': { type: 'ammunation', name: 'Ammu-Nation Docas' },
  '6,2': { type: 'ammunation', name: 'Ammu-Nation Little Tokyo' },
  '3,5': { type: 'ammunation', name: 'Ammu-Nation Centro' },
  '7,6': { type: 'ammunation', name: 'Ammu-Nation Leste' },
  // 3 Pontos de Suborno Policial
  '2,0': { type: 'bribe', name: 'Despachante Norte' },
  '8,4': { type: 'bribe', name: 'Advocacia Sombria Leste' },
  '0,7': { type: 'bribe', name: 'Oficina Clandestina Sul' },
  // Parques e Praças
  '4,7': { type: 'park', name: 'Parque Central' },
  '5,5': { type: 'park', name: 'Praça da Liberdade' },
  '0,5': { type: 'park', name: 'Jardim Oeste' },
};

const NEON_SIGNS = [
  'CYBER CLUB',
  '24H MOTEL',
  'NOODLE BAR',
  'ARCADE 99',
  'SYNDICATE',
  'HOTEL NOIR',
  'CYBERNET',
  'BAR NEON',
  'PAWN SHOP',
  'LOUNGE X',
  'NIGHT TECH',
  'CASINO 77',
];

export class CityMap {
  constructor(seed = 2077) {
    this.seed = seed;
    this.tiles = new Uint8Array(MAP_TILES * MAP_TILES);
    this.buildings = [];
    this.pois = [];
    this.roadTiles = [];
    this.sidewalkTiles = [];
    this.trees = [];
    this.streetLights = [];
    this.spawnPoint = {
      x: (4 * BLOCK + 9.5) * TILE,
      y: (5 * BLOCK + 3.5) * TILE,
    };

    this._generate();
  }

  _setTile(tx, ty, type) {
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return;
    this.tiles[ty * MAP_TILES + tx] = type;
  }

  _fillRect(tx, ty, tw, th, type) {
    for (let y = ty; y < ty + th; y++) {
      for (let x = tx; x < tx + tw; x++) {
        this._setTile(x, y, type);
      }
    }
  }

  getTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return T.BUILDING;
    return this.tiles[ty * MAP_TILES + tx];
  }

  isSolidTile(tx, ty) {
    return SOLID_TILES[this.getTile(tx, ty)];
  }

  isSolidAt(x, y) {
    return this.isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  getDistrictIndexAt(x, y) {
    const col = clamp(Math.floor(x / DISTRICT_SIZE), 0, 2);
    const row = clamp(Math.floor(y / DISTRICT_SIZE), 0, 2);
    return row * 3 + col;
  }

  getDistrictMetaAt(x, y) {
    return INITIAL_DISTRICTS[this.getDistrictIndexAt(x, y)];
  }

  _generate() {
    const rng = mulberry32(this.seed);

    // 1. Base de ruas e calçadas
    for (let ty = 0; ty < MAP_TILES; ty++) {
      const ly = ty % BLOCK;
      for (let tx = 0; tx < MAP_TILES; tx++) {
        const lx = tx % BLOCK;
        if (lx < ROAD_W || ly < ROAD_W) {
          this._setTile(tx, ty, T.ROAD);
        } else if (lx === ROAD_W || lx === BLOCK - 1 || ly === ROAD_W || ly === BLOCK - 1) {
          this._setTile(tx, ty, T.SIDEWALK);
        } else {
          this._setTile(tx, ty, T.ALLEY);
        }
      }
    }

    // 2. Preencher cada quarteirão 9x9
    for (let by = 0; by < BLOCKS; by++) {
      for (let bx = 0; bx < BLOCKS; bx++) {
        const ox = bx * BLOCK;
        const oy = by * BLOCK;
        const key = `${bx},${by}`;
        const spec = POI_LAYOUT[key];
        const district = INITIAL_DISTRICTS[Math.floor(by / 3) * 3 + Math.floor(bx / 3)];
        const vibeColor = FACTIONS[district.owner]?.neon || '#38bdf8';

        // Postes de luz nas esquinas das calçadas
        this.streetLights.push(
          { x: (ox + 3.4) * TILE, y: (oy + 3.4) * TILE, color: vibeColor },
          { x: (ox + 15.6) * TILE, y: (oy + 15.6) * TILE, color: vibeColor }
        );

        if (spec?.type === 'bank') {
          this._buildBankBlock(ox, oy, bx, by, spec, district);
        } else if (spec?.type === 'store') {
          this._buildStoreBlock(ox, oy, bx, by, spec, district);
        } else if (spec?.type === 'ammunation') {
          this._buildShopBlock(ox, oy, bx, by, spec, district, '#f59e0b', 'AMMU-NATION');
        } else if (spec?.type === 'bribe') {
          this._buildShopBlock(ox, oy, bx, by, spec, district, '#38bdf8', 'DESPACHANTE');
        } else if (spec?.type === 'park') {
          this._buildParkBlock(ox, oy, rng);
        } else {
          this._buildUrbanBlock(ox, oy, district, rng);
        }
      }
    }

    // 3. Indexar tiles trafegáveis para spawn rápido de NPCs e carros
    for (let ty = 0; ty < MAP_TILES; ty++) {
      for (let tx = 0; tx < MAP_TILES; tx++) {
        const t = this.tiles[ty * MAP_TILES + tx];
        if (t === T.ROAD) {
          this.roadTiles.push({ tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
        } else if (t === T.SIDEWALK || t === T.PARK) {
          this.sidewalkTiles.push({ tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
        }
      }
    }
  }

  _buildBankBlock(ox, oy, bx, by, spec, district) {
    // Interior amplo lx: 4..14, ly: 4..14 com paredes e porta sul de 3 tiles
    this._fillRect(ox + 4, oy + 4, 11, 11, T.FLOOR);
    // Paredes externas
    this._fillRect(ox + 4, oy + 4, 11, 1, T.WALL);
    this._fillRect(ox + 4, oy + 14, 11, 1, T.WALL);
    this._fillRect(ox + 4, oy + 4, 1, 11, T.WALL);
    this._fillRect(ox + 14, oy + 4, 1, 11, T.WALL);
    // Porta sul (3 tiles) e porta lateral leste (2 tiles)
    this._fillRect(ox + 8, oy + 14, 3, 1, T.FLOOR);
    this._fillRect(ox + 14, oy + 9, 1, 2, T.FLOOR);
    // Paredes do cofre interno (norte) com abertura central de 3 tiles
    this._fillRect(ox + 6, oy + 7, 2, 1, T.WALL);
    this._fillRect(ox + 11, oy + 7, 2, 1, T.WALL);

    const vaultX = (ox + 9.5) * TILE;
    const vaultY = (oy + 5.8) * TILE;
    const doorX = (ox + 9.5) * TILE;
    const doorY = (oy + 14.5) * TILE;

    this.pois.push({
      id: `bank_${bx}_${by}`,
      type: 'bank',
      name: spec.name,
      bx,
      by,
      x: (ox + 4) * TILE,
      y: (oy + 4) * TILE,
      w: 11 * TILE,
      h: 11 * TILE,
      doorX,
      doorY,
      vaultX,
      vaultY,
      vaultRadius: 62,
      rewardMin: spec.rewardMin,
      rewardMax: spec.rewardMax,
      cooldown: 0,
      progress: 0,
      active: false,
      districtId: district.id,
      accent: '#facc15',
    });

    this.buildings.push({
      x: (ox + 4) * TILE,
      y: (oy + 4) * TILE,
      w: 11 * TILE,
      h: 11 * TILE,
      isInteriorShell: true,
      accent: '#facc15',
      neonSign: 'BANCO CENTRAL',
      roofColor: '#1b2234',
      districtId: district.id,
    });
  }

  _buildStoreBlock(ox, oy, bx, by, spec, district) {
    // Loja ocupando lx: 5..13, ly: 6..14 (com beco livre ao norte e laterais)
    this._fillRect(ox + 5, oy + 6, 9, 9, T.FLOOR);
    this._fillRect(ox + 5, oy + 6, 9, 1, T.WALL);
    this._fillRect(ox + 5, oy + 14, 9, 1, T.WALL);
    this._fillRect(ox + 5, oy + 6, 1, 9, T.WALL);
    this._fillRect(ox + 13, oy + 6, 1, 9, T.WALL);
    // Porta ampla de entrada
    this._fillRect(ox + 8, oy + 14, 3, 1, T.FLOOR);

    const cashierX = (ox + 9.5) * TILE;
    const cashierY = (oy + 7.8) * TILE;
    const doorX = (ox + 9.5) * TILE;
    const doorY = (oy + 14.5) * TILE;

    this.pois.push({
      id: `store_${bx}_${by}`,
      type: 'store',
      name: spec.name,
      bx,
      by,
      x: (ox + 5) * TILE,
      y: (oy + 6) * TILE,
      w: 9 * TILE,
      h: 9 * TILE,
      doorX,
      doorY,
      cashierX,
      cashierY,
      robRadius: 115,
      rewardMin: spec.rewardMin,
      rewardMax: spec.rewardMax,
      cooldown: 0,
      progress: 0,
      active: false,
      districtId: district.id,
      accent: '#22d3ee',
    });

    this.buildings.push({
      x: (ox + 5) * TILE,
      y: (oy + 6) * TILE,
      w: 9 * TILE,
      h: 9 * TILE,
      isInteriorShell: true,
      accent: '#22d3ee',
      neonSign: '24H MART',
      roofColor: '#172030',
      districtId: district.id,
    });
  }

  _buildShopBlock(ox, oy, bx, by, spec, district, accent, signText) {
    this._fillRect(ox + 5, oy + 6, 9, 9, T.FLOOR);
    this._fillRect(ox + 5, oy + 6, 9, 1, T.WALL);
    this._fillRect(ox + 5, oy + 14, 9, 1, T.WALL);
    this._fillRect(ox + 5, oy + 6, 1, 9, T.WALL);
    this._fillRect(ox + 13, oy + 6, 1, 9, T.WALL);
    this._fillRect(ox + 8, oy + 14, 3, 1, T.FLOOR);

    const interactX = (ox + 9.5) * TILE;
    const interactY = (oy + 10.5) * TILE;
    const doorX = (ox + 9.5) * TILE;
    const doorY = (oy + 14.5) * TILE;

    this.pois.push({
      id: `${spec.type}_${bx}_${by}`,
      type: spec.type,
      name: spec.name,
      bx,
      by,
      x: (ox + 5) * TILE,
      y: (oy + 6) * TILE,
      w: 9 * TILE,
      h: 9 * TILE,
      doorX,
      doorY,
      interactX,
      interactY,
      interactRadius: 85,
      districtId: district.id,
      accent,
    });

    this.buildings.push({
      x: (ox + 5) * TILE,
      y: (oy + 6) * TILE,
      w: 9 * TILE,
      h: 9 * TILE,
      isInteriorShell: true,
      accent,
      neonSign: signText,
      roofColor: '#1c1917',
      districtId: district.id,
    });
  }

  _buildParkBlock(ox, oy, rng) {
    this._fillRect(ox + 4, oy + 4, 11, 11, T.PARK);
    // Árvores nas bordas do parque mantendo caminhos livres
    const spots = [
      [5, 5], [13, 5], [5, 13], [13, 13],
      [9, 5], [5, 9], [13, 9], [9, 13],
    ];
    for (const [lx, ly] of spots) {
      if (rng() > 0.15) {
        this.trees.push({
          x: (ox + lx + 0.5) * TILE,
          y: (oy + ly + 0.5) * TILE,
          r: 18 + rng() * 8,
        });
      }
    }
  }

  _buildUrbanBlock(ox, oy, district, rng) {
    const vibe = FACTIONS[district.owner]?.neon || '#38bdf8';
    const layout = rng();

    let rects = [];
    if (layout < 0.35) {
      // Cruzamento de becos internos separando 4 prédios
      rects = [
        [4, 4, 4, 4],
        [10, 4, 5, 4],
        [4, 10, 4, 5],
        [10, 10, 5, 5],
      ];
    } else if (layout < 0.7) {
      // Beco vertical no meio (2 torres)
      rects = [
        [4, 4, 4, 11],
        [10, 4, 5, 11],
      ];
    } else {
      // Beco horizontal no meio (2 edifícios)
      rects = [
        [4, 4, 11, 4],
        [4, 10, 11, 5],
      ];
    }

    const roofShades = ['#111827', '#161b2e', '#1a1625', '#0f172a', '#18181b'];
    for (const [lx, ly, lw, lh] of rects) {
      this._fillRect(ox + lx, oy + ly, lw, lh, T.BUILDING);
      const hasNeon = rng() < 0.55;
      this.buildings.push({
        x: (ox + lx) * TILE,
        y: (oy + ly) * TILE,
        w: lw * TILE,
        h: lh * TILE,
        isInteriorShell: false,
        roofColor: roofShades[Math.floor(rng() * roofShades.length)],
        accent: vibe,
        neonSign: hasNeon ? NEON_SIGNS[Math.floor(rng() * NEON_SIGNS.length)] : null,
        hasHelipad: lw >= 5 && lh >= 5 && rng() < 0.25,
        districtId: district.id,
      });
    }
  }

  resolveCircle(x, y, radius) {
    let rx = clamp(x, radius, WORLD_SIZE - radius);
    let ry = clamp(y, radius, WORLD_SIZE - radius);
    let hit = rx !== x || ry !== y;

    const minTx = Math.floor((rx - radius) / TILE) - 1;
    const maxTx = Math.floor((rx + radius) / TILE) + 1;
    const minTy = Math.floor((ry - radius) / TILE) - 1;
    const maxTy = Math.floor((ry + radius) / TILE) + 1;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const left = tx * TILE;
        const top = ty * TILE;
        const cx = clamp(rx, left, left + TILE);
        const cy = clamp(ry, top, top + TILE);
        const dx = rx - cx;
        const dy = ry - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          hit = true;
          const d = Math.sqrt(d2);
          if (d > 0.0001) {
            const push = radius - d;
            rx += (dx / d) * push;
            ry += (dy / d) * push;
          } else {
            // Centro dentro do tile: empurrar pela menor penetração
            const penL = rx - left;
            const penR = left + TILE - rx;
            const penT = ry - top;
            const penB = top + TILE - ry;
            const m = Math.min(penL, penR, penT, penB);
            if (m === penL) rx = left - radius;
            else if (m === penR) rx = left + TILE + radius;
            else if (m === penT) ry = top - radius;
            else ry = top + TILE + radius;
          }
        }
      }
    }

    return { x: rx, y: ry, hit };
  }

  raycast(x1, y1, x2, y2, step = 8) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const total = Math.hypot(dx, dy);
    if (total < 1) return { hit: false, x: x2, y: y2, dist: 0 };
    const steps = Math.ceil(total / step);
    const sx = dx / steps;
    const sy = dy / steps;
    let cx = x1;
    let cy = y1;
    for (let i = 1; i <= steps; i++) {
      cx += sx;
      cy += sy;
      if (this.isSolidAt(cx, cy)) {
        return { hit: true, x: cx, y: cy, dist: (i / steps) * total };
      }
    }
    return { hit: false, x: x2, y: y2, dist: total };
  }

  randomRoadPoint(nearX = null, nearY = null, minR = 0, maxR = Infinity) {
    if (this.roadTiles.length === 0) return { x: this.spawnPoint.x, y: this.spawnPoint.y, angle: 0 };
    for (let i = 0; i < 40; i++) {
      const p = this.roadTiles[Math.floor(Math.random() * this.roadTiles.length)];
      if (nearX !== null) {
        const d = Math.hypot(p.x - nearX, p.y - nearY);
        if (d < minR || d > maxR) continue;
      }
      const lx = p.tx % BLOCK;
      const ly = p.ty % BLOCK;
      let angle = 0;
      if (lx < ROAD_W && ly >= ROAD_W) {
        angle = lx === 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        angle = ly === 0 ? Math.PI : 0;
      }
      return { x: p.x, y: p.y, angle };
    }
    const p = this.roadTiles[Math.floor(Math.random() * this.roadTiles.length)];
    return { x: p.x, y: p.y, angle: 0 };
  }

  randomSidewalkPoint(nearX = null, nearY = null, minR = 0, maxR = Infinity) {
    if (this.sidewalkTiles.length === 0) return { x: this.spawnPoint.x, y: this.spawnPoint.y };
    for (let i = 0; i < 40; i++) {
      const p = this.sidewalkTiles[Math.floor(Math.random() * this.sidewalkTiles.length)];
      if (nearX !== null) {
        const d = Math.hypot(p.x - nearX, p.y - nearY);
        if (d < minR || d > maxR) continue;
      }
      return { x: p.x, y: p.y };
    }
    const p = this.sidewalkTiles[Math.floor(Math.random() * this.sidewalkTiles.length)];
    return { x: p.x, y: p.y };
  }
}
