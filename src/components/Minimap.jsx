import React, { useEffect, useRef, useState } from 'react';
import { BATTLEFIELD_SIZE, FOG_GRID_SIZE } from '../game/world/BattlefieldMap.js';

export default function Minimap({ gameRef, expanded = false }) {
  const canvasRef = useRef(null);
  const [toolMode, setToolMode] = useState('order'); // 'order' | 'ping_attack'
  const [orderMode, setOrderMode] = useState('ASSAULT'); // 'ASSAULT' | 'DEFEND' | 'MARCH'
  const [hoverInfo, setHoverInfo] = useState(null);
  const [rosterTick, setRosterTick] = useState(0);
  const dragStartRef = useRef(null);
  const dragCurrRef = useRef(null);
  const selectBoxRef = useRef(null);

  const canvasSize = expanded ? 1080 : 238;

  useEffect(() => {
    let rafId = 0;
    let lastDraw = 0;
    const renderMap = (now) => {
      rafId = requestAnimationFrame(renderMap);
      const minInterval = expanded ? 16 : 60; // 60 FPS no Mapa Tático [TAB]
      if (now - lastDraw < minInterval) return;
      lastDraw = now;

      const game = gameRef.current;
      const canvas = canvasRef.current;
      if (!game || !canvas) return;
      if (expanded && !game.tacticalMapOpen) return;
      if (!expanded && game.tacticalMapOpen) return;
      const ctx = canvas.getContext('2d');
      const size = canvas.width;
      const { map } = game;
      const scale = size / BATTLEFIELD_SIZE;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#111612';
      ctx.fillRect(0, 0, size, size);

      // Grade topográfica sutil (60 FPS radar)
      ctx.strokeStyle = 'rgba(140, 148, 140, 0.1)';
      ctx.lineWidth = 1;
      const gridStep = size / 8;
      ctx.beginPath();
      for (let gIdx = 1; gIdx < 8; gIdx++) {
        const p = gIdx * gridStep;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
      }
      ctx.stroke();

      // 1. Zonas de Floresta / Oásis (Camuflagem)
      for (const fz of map.forestZones || []) {
        ctx.fillStyle = 'rgba(45, 78, 42, 0.42)';
        ctx.beginPath();
        ctx.arc(fz.x * scale, fz.y * scale, fz.radius * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Estradas Rurais
      ctx.strokeStyle = 'rgba(145, 118, 84, 0.8)';
      ctx.lineWidth = expanded ? 4.2 : 2.4;
      for (const rd of map.roads) {
        ctx.beginPath();
        rd.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * scale, pt.y * scale);
          else ctx.lineTo(pt.x * scale, pt.y * scale);
        });
        ctx.stroke();
      }

      // 3. Construções Rurais / Vilarejos / Casas / Igrejas
      for (const st of map.structures || []) {
        const fogState = map.getFogStateAtWorld(st.x, st.y);
        ctx.fillStyle =
          st.garrisonTeam === 'allies'
            ? '#7faed9'
            : st.garrisonTeam === 'enemies' && fogState === 2
            ? '#d9534f'
            : '#8a795d';
        const sw = Math.max(expanded ? 6 : 3.5, st.w * scale);
        const sd = Math.max(expanded ? 6 : 3.5, st.d * scale);
        ctx.fillRect((st.x - st.w * 0.5) * scale, (st.y - st.d * 0.5) * scale, sw, sd);
      }

      // 4. Linha de Frente Dinâmica (Azul Militar Aliada vs Vermelho-Ferrugem Inimiga)
      const n = map.frontlineSamples;
      ctx.strokeStyle = 'rgba(127, 174, 217, 0.78)';
      ctx.lineWidth = expanded ? 2.8 : 1.8;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = ((i + 0.5) / n) * size;
        const x = (map.frontlineX[i] - 30) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(201, 74, 56, 0.78)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = ((i + 0.5) / n) * size;
        const x = (map.frontlineX[i] + 30) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 5. Camada de Névoa de Guerra Real (passo 2x2 para rodar a 60 FPS fluidos)
      const cellPx = size / FOG_GRID_SIZE;
      const g = map.fogGrid;
      for (let gy = 0; gy < FOG_GRID_SIZE; gy += 2) {
        const rowOff = gy * FOG_GRID_SIZE;
        for (let gx = 0; gx < FOG_GRID_SIZE; gx += 2) {
          const st = g[rowOff + gx];
          if (st === 0) {
            ctx.fillStyle = 'rgba(10, 14, 10, 0.56)';
            ctx.fillRect(gx * cellPx, gy * cellPx, cellPx * 2 + 0.6, cellPx * 2 + 0.6);
          } else if (st === 1) {
            ctx.fillStyle = 'rgba(16, 20, 14, 0.28)';
            ctx.fillRect(gx * cellPx, gy * cellPx, cellPx * 2 + 0.6, cellPx * 2 + 0.6);
          }
        }
      }

      // 6. Trincheiras e Muros Fortificados
      for (const tr of game.trenches) {
        const c = tr.getCenter();
        const isVis =
          tr.team === 'allies' ||
          tr.revealed ||
          game.intelRevealed ||
          map.isPositionVisibleToAllies(c.x, c.y);
        if (!isVis) continue;
        ctx.strokeStyle = tr.team === 'allies' ? '#a5c4d4' : '#e08276';
        ctx.lineWidth = expanded ? 3.2 : 2.2;
        ctx.beginPath();
        tr.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * scale, pt.y * scale);
          else ctx.lineTo(pt.x * scale, pt.y * scale);
        });
        ctx.stroke();
      }

      for (const wall of game.fortifiedWalls || []) {
        ctx.strokeStyle = '#a3be8c';
        ctx.lineWidth = expanded ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(wall.x1 * scale, wall.y1 * scale);
        ctx.lineTo(wall.x2 * scale, wall.y2 * scale);
        ctx.stroke();
      }

      // 7. Prédios de Base Militar 3D (QGs, Quartel, Fábrica, Radar)
      for (const bld of game.baseBuildings || []) {
        if (bld.alive === false) continue;
        const isVis =
          bld.team === 'allies' ||
          game.intelRevealed ||
          map.isPositionVisibleToAllies(bld.x, bld.y);
        if (!isVis) continue;
        const bx = bld.x * scale;
        const by = bld.y * scale;
        const bs = bld.isMainHQ ? (expanded ? 11 : 7) : expanded ? 8 : 5;
        ctx.fillStyle = bld.team === 'allies' ? '#38bdf8' : '#ef4444';
        ctx.fillRect(bx - bs * 0.5, by - bs * 0.5, bs, bs);
        ctx.strokeStyle = game.selectedBuildingId === bld.id ? '#a3be8c' : '#141712';
        ctx.lineWidth = game.selectedBuildingId === bld.id ? 2 : 1;
        ctx.strokeRect(bx - bs * 0.5, by - bs * 0.5, bs, bs);

        if (expanded) {
          ctx.font = "700 9.5px 'Inter', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillStyle = bld.team === 'allies' ? '#bae6fd' : '#fecaca';
          ctx.fillText(bld.short || 'BASE', bx, by - bs * 0.5 - 3);
        }
      }

      // 8. Todos os 12 Pontos de Suprimento sem sobreposição de texto (offset inteligente)
      const placedBoxes = [];
      for (const sec of map.sectors) {
        const sx = sec.x * scale;
        const sy = sec.y * scale;
        const col =
          sec.owner === 'allies' ? '#7faed9' : sec.owner === 'enemies' ? '#d9534f' : '#d6d3c4';
        const r = expanded ? 7.0 : 4.2;

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = '#141712';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const resText =
          sec.shortLabel ||
          (sec.type === 'fuel'
            ? `+${sec.fuelBonus} COMB`
            : sec.type === 'ammo'
            ? `+${sec.ammoBonus} MUN`
            : `+${sec.supplyBonus} SUP`);

        ctx.font = expanded
          ? "800 9.5px 'Inter', 'Segoe UI', sans-serif"
          : "800 8px 'Inter', 'Segoe UI', sans-serif";
        ctx.textAlign = 'center';
        const label = expanded ? `${sec.shortName || sec.name} (${resText})` : resText;
        const tw = ctx.measureText(label).width + (expanded ? 7 : 4);
        const th = expanded ? 13 : 10;

        let lx = Math.max(tw * 0.5 + 2, Math.min(size - tw * 0.5 - 2, sx));
        let ly = sy - r - (expanded ? 10 : 7);
        const offsets = [0, 22, -16, 36, -30];
        for (const off of offsets) {
          const candY = Math.max(th * 0.5 + 2, Math.min(size - th * 0.5 - 2, ly + off));
          const x1 = lx - tw * 0.5;
          const y1 = candY - th * 0.5;
          const x2 = lx + tw * 0.5;
          const y2 = candY + th * 0.5;
          const overlaps = placedBoxes.some(
            (b) => !(x2 < b.x1 - 2 || x1 > b.x2 + 2 || y2 < b.y1 - 2 || y1 > b.y2 + 2)
          );
          if (!overlaps) {
            ly = candY;
            placedBoxes.push({ x1, y1, x2, y2 });
            break;
          }
        }

        ctx.fillStyle = 'rgba(14, 17, 12, 0.9)';
        ctx.fillRect(lx - tw * 0.5, ly - th * 0.5, tw, th);
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.85;
        ctx.strokeRect(lx - tw * 0.5, ly - th * 0.5, tw, th);
        ctx.fillStyle = col;
        ctx.fillText(label, lx, ly + (expanded ? 3.2 : 2.8));
      }

      // 8b. Linhas Tracejadas Animadas de Rota das Tropas Aliadas (cor por modo de ordem)
      const dashOffset = -(Date.now() * 0.025);
      for (const u of game.units) {
        if (!u.alive || u.captured || u.team !== 'allies' || u.order.type === 'hold') continue;
        const mode = u.tacticalOrderMode || (u.order.type === 'attack' ? 'ASSAULT' : null);
        const lineCol =
          mode === 'DEFEND'
            ? '#38bdf8'
            : mode === 'MARCH'
            ? '#4ade80'
            : mode === 'ASSAULT' || u.selected
            ? '#ef4444'
            : 'rgba(127, 174, 217, 0.7)';
        const isArrow = Boolean(mode || u.order.type === 'attack' || u.selected);
        const rawPts = [{ x: u.x, y: u.y }];
        if (u.waypoints && u.waypoints.length > 0) {
          for (const wp of u.waypoints) {
            if (wp && Number.isFinite(wp.x) && Number.isFinite(wp.y)) {
              rawPts.push({ x: wp.x, y: wp.y });
            }
          }
        }
        if (Number.isFinite(u.order.targetX) && Number.isFinite(u.order.targetY)) {
          rawPts.push({ x: u.order.targetX, y: u.order.targetY });
        }
        const pts = [];
        for (const p of rawPts) {
          const prev = pts[pts.length - 1];
          if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 5) {
            pts.push(p);
          }
        }
        if (pts.length < 2) continue;

        ctx.save();
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = u.selected ? (expanded ? 2.6 : 1.6) : 1.2;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = dashOffset;
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
        }
        ctx.stroke();

        // Seta na ponta da linha de ataque/movimento
        if (isArrow && pts.length >= 2) {
          const prev = pts[pts.length - 2];
          const last = pts[pts.length - 1];
          const ex = last.x * scale;
          const ey = last.y * scale;
          const ang = Math.atan2(ey - prev.y * scale, ex - prev.x * scale);
          const head = expanded ? 10 : 6;
          ctx.setLineDash([]);
          ctx.fillStyle = lineCol;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - Math.cos(ang - 0.45) * head, ey - Math.sin(ang - 0.45) * head);
          ctx.lineTo(ex - Math.cos(ang + 0.45) * head, ey - Math.sin(ang + 0.45) * head);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 9. Esquadrões e Veículos (com anel branco/dourado pulsante nos selecionados)
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.008);
      for (const u of game.units) {
        if (!u.alive || u.captured) continue;
        const isVisible =
          u.team === 'allies' ||
          u.surrendered ||
          game.intelRevealed ||
          map.isPositionVisibleToAllies(u.x, u.y);
        if (!isVisible) continue;

        const ux = u.x * scale;
        const uy = u.y * scale;
        ctx.fillStyle = u.surrendered
          ? '#ffffff'
          : u.faction === 'player'
          ? '#7faed9'
          : u.faction === 'ally_ai'
          ? '#d4a338'
          : '#d9534f';
        ctx.beginPath();
        const rad = u.spec.type === 'vehicle' ? (expanded ? 8.5 : 3.5) : expanded ? 7.0 : 2.8;
        ctx.arc(ux, uy, rad, 0, Math.PI * 2);
        ctx.fill();
        if (u.selected) {
          ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
          ctx.lineWidth = expanded ? 3.0 : 1.8;
          ctx.beginPath();
          ctx.arc(ux, uy, rad + (expanded ? 4.8 : 2.0), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 9b. Caixa de Seleção Direta dentro do Quadro Tático (somente quando arrastar >= 6px)
      if (selectBoxRef.current && selectBoxRef.current.isDragging) {
        const sb = selectBoxRef.current;
        const x1 = Math.min(sb.x1, sb.x2) * scale;
        const y1 = Math.min(sb.y1, sb.y2) * scale;
        const w = Math.abs(sb.x2 - sb.x1) * scale;
        const h = Math.abs(sb.y2 - sb.y1) * scale;
        ctx.fillStyle = 'rgba(194, 142, 56, 0.16)';
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeStyle = '#c28e38';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(x1, y1, w, h);
      }

      // 10. Setas de Planejamento Tático (Ataque / Flanqueamento)
      const drawTacticalArrow2D = (x1, y1, x2, y2, color, label) => {
        const sx1 = x1 * scale;
        const sy1 = y1 * scale;
        const sx2 = x2 * scale;
        const sy2 = y2 * scale;
        const ang = Math.atan2(sy2 - sy1, sx2 - sx1);
        const headLen = expanded ? 12 : 8;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = expanded ? 3.2 : 2.2;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 - headLen * Math.cos(ang - 0.45), sy2 - headLen * Math.sin(ang - 0.45));
        ctx.lineTo(sx2 - headLen * Math.cos(ang + 0.45), sy2 - headLen * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();

        if (expanded && label) {
          ctx.font = "800 9.5px 'Inter', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(label, (sx1 + sx2) * 0.5, (sy1 + sy2) * 0.5 - 6);
        }
        ctx.restore();
      };

      for (const arr of game.tacticalArrows || []) {
        drawTacticalArrow2D(arr.x1, arr.y1, arr.x2, arr.y2, arr.color, arr.label);
      }

      if (dragStartRef.current && dragCurrRef.current) {
        const previewCol = toolMode === 'arrow_flank' ? '#38bdf8' : '#ef4444';
        drawTacticalArrow2D(
          dragStartRef.current.wx,
          dragStartRef.current.wy,
          dragCurrRef.current.wx,
          dragCurrRef.current.wy,
          previewCol,
          toolMode === 'arrow_flank' ? 'FLANCO' : 'ATAQUE'
        );
      }

      // 11. Marcadores de Alerta (Pings)
      for (const ping of game.tacticalPings || []) {
        const px = ping.x * scale;
        const py = ping.y * scale;
        ctx.strokeStyle = ping.color || '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, expanded ? 9 : 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 12. Retângulo de Visão da Câmera RTS (apenas no mini-radar compacto, evitando caixa branca no Quadro Tático)
      if (!expanded) {
        const span = (game.camera.zoom / 820) * 950;
        const rx = (game.camera.x - span * 0.5) * scale;
        const ry = (game.camera.y - span * 0.4) * scale;
        ctx.strokeStyle = 'rgba(229, 224, 208, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rx, ry, span * scale, span * 0.8 * scale);
      }
      if (Math.floor(now / 320) !== Math.floor((now - minInterval) / 320)) {
        setRosterTick((t) => (t + 1) % 10000);
      }
    };
    rafId = requestAnimationFrame(renderMap);
    return () => cancelAnimationFrame(rafId);
  }, [gameRef, expanded, toolMode]);

  const getCanvasWorldCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: BATTLEFIELD_SIZE * 0.5, wy: BATTLEFIELD_SIZE * 0.5, cx: 0, cy: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const worldX = Math.max(120, Math.min(BATTLEFIELD_SIZE - 120, (cx / canvas.width) * BATTLEFIELD_SIZE));
    const worldZ = Math.max(120, Math.min(BATTLEFIELD_SIZE - 120, (cy / canvas.height) * BATTLEFIELD_SIZE));
    return { wx: worldX, wy: worldZ, cx, cy };
  };

  const findVisibleEnemyNear = (game, wx, wy, maxWorldDist) => {
    let best = null;
    let bestDist = maxWorldDist;
    for (const u of game.units) {
      if (!u.alive || u.team !== 'enemies' || u.surrendered) continue;
      if (!game.intelRevealed && !game.map.isPositionVisibleToAllies(u.x, u.y)) continue;
      const d = Math.hypot(wx - u.x, wy - u.y);
      if (d <= bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  };

  const isMobilePlayerUnit = (u) =>
    u.alive &&
    u.faction === 'player' &&
    !u.embarkedInId &&
    (u.spec?.speed || 0) > 0 &&
    !u.spec?.isStructure &&
    !u.spec?.isEmplacement &&
    !['watchtower_emplacement', 'mg_nest', 'concrete_bunker', 'supply_post', 'build_watchtower', 'build_emplacement', 'build_bunker', 'build_outpost'].includes(u.unitType);

  const findAllyNear = (game, wx, wy, maxWorldDist) => {
    let best = null;
    let bestDist = maxWorldDist;
    for (const u of game.units) {
      if (!isMobilePlayerUnit(u)) continue;
      const d = Math.hypot(wx - u.x, wy - u.y);
      if (d <= bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  };

  const issueAttackOrCaptureAt = (game, wx, wy) => {
    const canvas = canvasRef.current;
    const pxToWorld = canvas ? BATTLEFIELD_SIZE / Math.max(1, canvas.width) : 10;
    const clickedEnemy = findVisibleEnemyNear(game, wx, wy, 24 * pxToWorld);
    if (clickedEnemy) {
      const sel = game.units.filter((u) => isMobilePlayerUnit(u) && u.selected);
      if (sel.length > 0) {
        sel.forEach((u) => {
          u.holdPosition = false;
          u.tacticalOrderMode = orderMode;
          u.tacticalTargetLabel = `⚔️ Em Assalto: ${clickedEnemy.short || clickedEnemy.name || 'Inimigo'}`;
          u.tacticalAttackOrder = true;
          u.setAttackOrder(clickedEnemy);
          u.selected = false; // Auto-desmarcação após enviar
        });
        game._emitHud();
        setRosterTick((t) => (t + 1) % 10000);
        return true;
      }
    }
    const ok = game.issueTacticalMapOrder(wx, wy, orderMode);
    if (ok) setRosterTick((t) => (t + 1) % 10000);
    return ok;
  };

  const handleMouseDown = (e) => {
    const game = gameRef.current;
    if (!game) return;
    const { wx, wy } = getCanvasWorldCoords(e);

    // Forma A: Clique Direito Direto no Mapa Tático -> Atacar Inimigo, Capturar Setor ou Avançar
    if (e.button === 2) {
      e.preventDefault();
      issueAttackOrCaptureAt(game, wx, wy);
      return;
    }

    if (e.button !== 0) return;
    e.preventDefault();

    if (game.activeAirStrikeMode) {
      game._executeAirDoctrineAt(game.activeAirStrikeMode, wx, wy);
      return;
    }

    if (toolMode === 'arrow_attack' || toolMode === 'arrow_flank') {
      dragStartRef.current = { wx, wy, startClientX: e.clientX, startClientY: e.clientY };
      dragCurrRef.current = { wx, wy };
      return;
    }

    if (toolMode === 'ping_attack') {
      game.addTacticalPing(wx, wy, 'attack');
      return;
    }

    if (toolMode === 'ping_defend') {
      game.addTacticalPing(wx, wy, 'defend');
      return;
    }

    // Modo 'order': inicia rastreio de clique simples vs caixa de seleção
    if (expanded) {
      selectBoxRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        x1: wx,
        y1: wy,
        x2: wx,
        y2: wy,
        isDragging: false,
      };
    } else {
      const canvas = canvasRef.current;
      const pxToWorld = canvas ? BATTLEFIELD_SIZE / Math.max(1, canvas.width) : 20;
      const clickedAlly = findAllyNear(game, wx, wy, 18 * pxToWorld);
      if (clickedAlly) {
        clickedAlly.selected = !clickedAlly.selected;
        game._emitHud();
        setRosterTick((t) => (t + 1) % 10000);
        return;
      }
      const hasSelected = game.units.some((u) => u.alive && u.faction === 'player' && u.selected);
      const clickedSector = game.map.sectors.find(
        (s) => Math.hypot(wx - s.x, wy - s.y) <= s.radius + 220
      );
      if (hasSelected && clickedSector) {
        issueAttackOrCaptureAt(game, clickedSector.x, clickedSector.y);
        return;
      }
      game.camera.x = wx;
      game.camera.y = wy;
    }
  };

  const handleMouseMove = (e) => {
    const game = gameRef.current;
    const pos = getCanvasWorldCoords(e);
    if (dragStartRef.current) {
      dragCurrRef.current = pos;
    }
    if (selectBoxRef.current) {
      const sb = selectBoxRef.current;
      sb.x2 = pos.wx;
      sb.y2 = pos.wy;
      if (Math.hypot(e.clientX - sb.startClientX, e.clientY - sb.startClientY) >= 6) {
        sb.isDragging = true;
      }
    }
    if (game && expanded) {
      const sec = game.map.sectors.find(
        (s) => Math.hypot(pos.wx - s.x, pos.wy - s.y) <= s.radius + 240
      );
      setHoverInfo(sec ? `${sec.name} (${sec.shortLabel || `+${sec.supplyBonus} SUP`})` : null);
    }
  };

  const handleMouseUp = (e) => {
    const game = gameRef.current;
    if (!game) {
      selectBoxRef.current = null;
      dragStartRef.current = null;
      dragCurrRef.current = null;
      return;
    }

    if (selectBoxRef.current) {
      const sb = selectBoxRef.current;
      selectBoxRef.current = null;
      const dragPx = Math.hypot(
        (e?.clientX ?? sb.startClientX) - sb.startClientX,
        (e?.clientY ?? sb.startClientY) - sb.startClientY
      );

      if (dragPx < 6) {
        // Clique simples (< 6px): seleciona/alterna tropa (raio 18px) OU Forma B (atacar setor/inimigo se já houver tropa selecionada)
        const canvas = canvasRef.current;
        const pxToWorld = canvas ? BATTLEFIELD_SIZE / Math.max(1, canvas.width) : 10;
        const clickedAlly = findAllyNear(game, sb.x1, sb.y1, 18 * pxToWorld);
        if (clickedAlly) {
          clickedAlly.selected = !clickedAlly.selected;
          game._emitHud();
          setRosterTick((t) => (t + 1) % 10000);
          return;
        }

        const hasSelected = game.units.some((u) => isMobilePlayerUnit(u) && u.selected);
        if (hasSelected) {
          const clickedSector = game.map.sectors.find(
            (s) => Math.hypot(sb.x1 - s.x, sb.y1 - s.y) <= s.radius + 240
          );
          issueAttackOrCaptureAt(
            game,
            clickedSector ? clickedSector.x : sb.x1,
            clickedSector ? clickedSector.y : sb.y1
          );
          return;
        }

        game.camera.x = sb.x1;
        game.camera.y = sb.y1;
        return;
      }

      // Arrasto >= 6px: seleção em caixa
      const minX = Math.min(sb.x1, sb.x2);
      const maxX = Math.max(sb.x1, sb.x2);
      const minY = Math.min(sb.y1, sb.y2);
      const maxY = Math.max(sb.y1, sb.y2);
      const additive = Boolean(e?.shiftKey);
      game.units.forEach((u) => {
        if (u.faction === 'player' && u.alive && !u.embarkedInId) {
          const inside = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
          u.selected = additive ? u.selected || inside : inside;
        }
      });
      game._emitHud();
      setRosterTick((t) => (t + 1) % 10000);
      return;
    }

    if (!dragStartRef.current) return;
    const end = dragCurrRef.current || dragStartRef.current;
    const start = dragStartRef.current;
    const dragPx = Math.hypot(
      (e?.clientX ?? start.startClientX) - start.startClientX,
      (e?.clientY ?? start.startClientY) - start.startClientY
    );
    dragStartRef.current = null;
    dragCurrRef.current = null;

    // Forma B também quando ↗ Seta Ataque está ativa e usuário dá clique simples em Setor/Inimigo
    if (toolMode === 'arrow_attack' && dragPx < 6) {
      const hasSelected = game.units.some((u) => u.alive && u.faction === 'player' && u.selected);
      if (hasSelected) {
        issueAttackOrCaptureAt(game, start.wx, start.wy);
      }
      return;
    }

    if (toolMode === 'arrow_attack') {
      game.addTacticalArrow(start.wx, start.wy, end.wx, end.wy, '#ef4444', 'ATAQUE');
    } else if (toolMode === 'arrow_flank') {
      game.addTacticalArrow(start.wx, start.wy, end.wx, end.wy, '#38bdf8', 'FLANCO');
    }
  };

  useEffect(() => {
    const onWindowMouseUp = (e) => {
      if (selectBoxRef.current || dragStartRef.current) {
        handleMouseUp(e);
      }
      selectBoxRef.current = null;
      dragStartRef.current = null;
      dragCurrRef.current = null;
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  });

  const game = gameRef.current;
  const playerUnits = game ? game.units.filter(isMobilePlayerUnit) : [];
  const lastArrow = game?.tacticalArrows?.[game.tacticalArrows.length - 1] || null;

  return (
    <div className={`minimap-wrap ${expanded ? 'tactical-board-expanded' : ''}`}>
      <div className="minimap-header">
        <span>{expanded ? '🗺 QUADRO DE OPERAÇÕES TÁTICAS (12 SETORES)' : '🗺 MAPA TÁTICO & 12 SETORES'}</span>
        <button
          type="button"
          className="mini-expand-btn"
          onClick={() => gameRef.current?.toggleTacticalMap()}
          title="Expandir/Recolher Quadro de Planejamento Tático (Tecla TAB)"
        >
          {expanded ? '✕ FECHAR [TAB]' : '⛶ EXPANDIR [TAB]'}
        </button>
      </div>

      {/* 3 Modos Claros de Ordem Tática Militar */}
      <div className="tactical-map-tools">
        <button
          type="button"
          className={`tmap-tool-btn ${toolMode === 'order' && orderMode === 'ASSAULT' ? 'active' : ''}`}
          onClick={() => {
            setToolMode('order');
            setOrderMode('ASSAULT');
          }}
          title="Avança agressivamente até o alvo, parando para destruir inimigos no caminho"
        >
          ⚔️ ASSALTO
        </button>
        <button
          type="button"
          className={`tmap-tool-btn ${toolMode === 'order' && orderMode === 'DEFEND' ? 'active' : ''}`}
          onClick={() => {
            setToolMode('order');
            setOrderMode('DEFEND');
          }}
          title="Vai até o ponto/setor e trava posição defensiva ao chegar"
        >
          🛡️ DEFENDER
        </button>
        <button
          type="button"
          className={`tmap-tool-btn ${toolMode === 'order' && orderMode === 'MARCH' ? 'active' : ''}`}
          onClick={() => {
            setToolMode('order');
            setOrderMode('MARCH');
          }}
          title="Corre em velocidade máxima até o destino ignorando distrações no caminho"
        >
          🏃 EM MARCHA
        </button>
        <button
          type="button"
          className={`tmap-tool-btn ${toolMode === 'ping_attack' ? 'active' : ''}`}
          onClick={() => setToolMode(toolMode === 'ping_attack' ? 'order' : 'ping_attack')}
          title="Marcar Alvo de Artilharia / Alerta no Mapa"
        >
          📍 Ping
        </button>
        <button
          type="button"
          className="tmap-tool-btn clear-btn"
          onClick={() => gameRef.current?.clearTacticalPlan()}
          title="Limpar Setas e Marcadores do Plano Tático"
        >
          🗑
        </button>
      </div>

      <div className={expanded ? 'tmap-expanded-body' : ''}>
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="minimap-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />

        {expanded && (
          <div
            className="tmap-squad-sidebar"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tmap-sidebar-title">
              ESQUADRÕES ({playerUnits.filter((u) => u.selected).length}/{playerUnits.length})
            </div>
            <button
              type="button"
              className="tmap-squad-btn"
              style={{
                borderColor: '#c28e38',
                color: '#c28e38',
                justifyContent: 'center',
                fontWeight: 800,
                marginBottom: 4,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const allSelected =
                  playerUnits.length > 0 && playerUnits.every((u) => u.selected);
                playerUnits.forEach((u) => {
                  u.selected = !allSelected;
                });
                game?._emitHud();
                setRosterTick((t) => (t + 1) % 10000);
              }}
            >
              {playerUnits.length > 0 && playerUnits.every((u) => u.selected)
                ? `✕ DESMARCAR TODAS (${playerUnits.length})`
                : `▸ SELECIONAR TODAS (${playerUnits.length})`}
            </button>
            <div className="tmap-squad-list">
              {playerUnits.map((u) => {
                const isMovingOrAttacking = u.order && u.order.type !== 'hold';
                const targetText = isMovingOrAttacking
                  ? u.tacticalTargetLabel ||
                    (u.order.type === 'attack' ? 'Atacando Inimigo' : 'Em marcha')
                  : null;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`tmap-squad-btn ${u.selected ? 'active' : ''}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      u.selected = !u.selected;
                      game._emitHud();
                      setRosterTick((t) => (t + 1) % 10000);
                    }}
                  >
                    <div className="tmap-squad-row">
                      <span className="tmap-squad-name">
                        <span className="tmap-squad-check">{u.selected ? '✓' : ' '}</span>
                        {u.short}
                      </span>
                      <small>{Math.round((u.hp / Math.max(1, u.maxHp)) * 100)}%</small>
                    </div>
                    {targetText && (
                      <div className="tmap-squad-target">➔ ⚔️ {targetText}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hoverInfo && <div className="tmap-hover-pill">📍 {hoverInfo}</div>}

      <div className="minimap-legend">
        <span><i style={{ background: '#7faed9' }} />Aliado</span>
        <span><i style={{ background: '#d9534f' }} />Inimigo</span>
        <span><i style={{ background: '#d4a338' }} />Setor (+SUP/MUN/COMB)</span>
      </div>
      <div className="tactical-map-hint">
        Clique Esquerdo seleciona tropas (ou arraste caixa) • Clique Direito envia para Setor, Inimigo ou Posição.
      </div>
    </div>
  );
}
