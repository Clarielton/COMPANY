// =============================================================================
// NavGrid — Pathfinding A* em grade (8 direções) + suavização por linha de visão
// -----------------------------------------------------------------------------
// - Rasteriza as caixas sólidas (casas, prédios da base, muros, barricadas,
//   carcaças) já infladas pela folga (clearance) da unidade.
// - Executa A* com heurística octile, sem cortar quinas de obstáculos.
// - Aplica "string pulling" (linha de visão) para gerar poucos waypoints suaves.
// =============================================================================

const SQRT2 = Math.SQRT2;

export class NavGrid {
  constructor(size, cellSize = 32) {
    this.size = size;
    this.cell = cellSize;
    this.cols = Math.ceil(size / cellSize);
    this.rows = Math.ceil(size / cellSize);
    this.n = this.cols * this.rows;
    this.blocked = new Uint8Array(this.n);
    this.nearCost = new Float32Array(this.n);
    this.signature = '';

    // Buffers reutilizáveis do A* (sem alocação por busca)
    this.g = new Float32Array(this.n);
    this.parent = new Int32Array(this.n);
    this.openStamp = new Uint32Array(this.n);
    this.closedStamp = new Uint32Array(this.n);
    this.stamp = 0;
    this.heapIdx = [];
    this.heapF = [];
  }

  rebuild(boxes, clearance, borderMargin = 80) {
    const { cols, rows, cell, blocked } = this;
    blocked.fill(0);

    for (const b of boxes) {
      const minX = b.minX - clearance;
      const maxX = b.maxX + clearance;
      const minZ = b.minZ - clearance;
      const maxZ = b.maxZ + clearance;
      const c0 = Math.max(0, Math.floor(minX / cell));
      const c1 = Math.min(cols - 1, Math.floor(maxX / cell));
      const r0 = Math.max(0, Math.floor(minZ / cell));
      const r1 = Math.min(rows - 1, Math.floor(maxZ / cell));
      for (let r = r0; r <= r1; r++) {
        const cz = (r + 0.5) * cell;
        if (cz < minZ || cz > maxZ) continue;
        const rowOff = r * cols;
        for (let c = c0; c <= c1; c++) {
          const cx = (c + 0.5) * cell;
          if (cx >= minX && cx <= maxX) blocked[rowOff + c] = 1;
        }
      }
    }

    // Bordas do mapa
    const bm = Math.ceil(borderMargin / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r < bm || c < bm || r >= rows - bm || c >= cols - bm) blocked[r * cols + c] = 1;
      }
    }

    // Penalidade suave de proximidade (1 a 2 células ao redor de prédios/muros) para o A* preferir rotas folgadas
    const nearCost = this.nearCost;
    nearCost.fill(0);
    for (let r = 1; r < rows - 1; r++) {
      const rowOff = r * cols;
      for (let c = 1; c < cols - 1; c++) {
        const idx = rowOff + c;
        if (blocked[idx]) continue;
        let adj = 0;
        if (blocked[idx - 1] || blocked[idx + 1] || blocked[idx - cols] || blocked[idx + cols]) {
          adj = 2;
        } else if (
          blocked[idx - cols - 1] ||
          blocked[idx - cols + 1] ||
          blocked[idx + cols - 1] ||
          blocked[idx + cols + 1]
        ) {
          adj = 1;
        }
        if (adj > 0) nearCost[idx] = adj === 2 ? 0.65 : 0.35;
      }
    }
  }

  toCell(x, y) {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return r * this.cols + c;
  }

  cellCenter(idx) {
    const c = idx % this.cols;
    const r = (idx / this.cols) | 0;
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
  }

  isBlockedAt(x, y) {
    return this.blocked[this.toCell(x, y)] === 1;
  }

  nearestFree(idx, maxRing = 14) {
    if (!this.blocked[idx]) return idx;
    const c0 = idx % this.cols;
    const r0 = (idx / this.cols) | 0;
    for (let ring = 1; ring <= maxRing; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
          const j = r * this.cols + c;
          if (this.blocked[j]) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // Linha de visão: amostra o segmento a cada ~1/3 de célula
  lineOfSight(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.33)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.blocked[this.toCell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false;
    }
    return true;
  }

  _heapPush(idx, f) {
    const hi = this.heapIdx;
    const hf = this.heapF;
    let i = hi.length;
    hi.push(idx);
    hf.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hi[i] = hi[p];
      hf[i] = hf[p];
      i = p;
    }
    hi[i] = idx;
    hf[i] = f;
  }

  _heapPop() {
    const hi = this.heapIdx;
    const hf = this.heapF;
    const top = hi[0];
    const lastI = hi.pop();
    const lastF = hf.pop();
    const n = hi.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && hf[r] < hf[l] ? r : l;
        if (hf[m] >= lastF) break;
        hi[i] = hi[m];
        hf[i] = hf[m];
        i = m;
      }
      hi[i] = lastI;
      hf[i] = lastF;
    }
    return top;
  }

  /**
   * Retorna lista de waypoints [{x,y}] (incluindo início e destino) ou null se não houver rota.
   */
  findPath(sx, sy, ex, ey, maxExpansions = 140000) {
    const startRaw = this.toCell(sx, sy);
    const goalRaw = this.toCell(ex, ey);
    const start = this.nearestFree(startRaw);
    const goal = this.nearestFree(goalRaw);
    if (start < 0 || goal < 0) return null;

    const startFree = start === startRaw;
    const goalFree = goal === goalRaw;
    if (startFree && goalFree && this.lineOfSight(sx, sy, ex, ey)) {
      return [
        { x: sx, y: sy },
        { x: ex, y: ey },
      ];
    }

    const { cols, rows, blocked, g, parent, openStamp, closedStamp } = this;
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      openStamp.fill(0);
      closedStamp.fill(0);
      this.stamp = 1;
    }
    const st = this.stamp;
    this.heapIdx.length = 0;
    this.heapF.length = 0;

    const gc = goal % cols;
    const gr = (goal / cols) | 0;
    const h = (idx) => {
      const dc = Math.abs((idx % cols) - gc);
      const dr = Math.abs(((idx / cols) | 0) - gr);
      return dc + dr + (SQRT2 - 2) * Math.min(dc, dr);
    };

    g[start] = 0;
    parent[start] = -1;
    openStamp[start] = st;
    this._heapPush(start, h(start));

    let found = false;
    let expansions = 0;
    while (this.heapIdx.length > 0) {
      const cur = this._heapPop();
      if (closedStamp[cur] === st) continue;
      closedStamp[cur] = st;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expansions > maxExpansions) break;

      const cc = cur % cols;
      const cr = (cur / cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const ni = nr * cols + nc;
          if (blocked[ni] || closedStamp[ni] === st) continue;
          const diag = dr !== 0 && dc !== 0;
          // Proíbe cortar quinas de construções na diagonal
          if (diag && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
          const stepCost = (diag ? SQRT2 : 1) + this.nearCost[ni];
          const ng = g[cur] + stepCost;
          if (openStamp[ni] !== st || ng < g[ni]) {
            openStamp[ni] = st;
            g[ni] = ng;
            parent[ni] = cur;
            this._heapPush(ni, ng + h(ni));
          }
        }
      }
    }

    if (!found) return null;

    // Reconstrói células -> pontos do mundo
    const cellsRev = [];
    for (let i = goal; i !== -1; i = parent[i]) cellsRev.push(i);
    const pts = [{ x: sx, y: sy }];
    for (let k = cellsRev.length - 1; k >= 0; k--) pts.push(this.cellCenter(cellsRev[k]));
    if (goalFree) pts.push({ x: ex, y: ey });

    // Suavização por linha de visão (string pulling)
    const out = [pts[0]];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      const a = pts[anchor];
      const b = pts[i];
      if (!this.lineOfSight(a.x, a.y, b.x, b.y)) {
        out.push(pts[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(pts[pts.length - 1]);

    // Se o destino real está dentro de um obstáculo (ex.: guarnição em casa), adiciona a aproximação final
    if (!goalFree) out.push({ x: ex, y: ey });
    return out;
  }
}
