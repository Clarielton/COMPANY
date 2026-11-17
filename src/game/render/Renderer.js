import { TILE, BLOCK, ROAD_W, MAP_TILES, DISTRICT_SIZE, T } from '../config.js';
import { FACTIONS } from '../data/factions.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp, dist } from '../core/math.js';

export class Renderer {
  constructor() {
    this.time = 0;
  }

  render(ctx, game, dt) {
    this.time += dt;
    const { camera, map, player, territorySystem } = game;
    const vw = camera.w;
    const vh = camera.h;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, vw, vh);

    camera.apply(ctx);

    this._drawTiles(ctx, game);
    this._drawDistrictBorders(ctx, game);
    this._drawPoiMarkers(ctx, game);
    this._drawPickups(ctx, game);
    this._drawDeadPeds(ctx, game);
    this._drawVehicles(ctx, game);
    this._drawAlivePeds(ctx, game);
    if (player.alive && !player.inVehicle) {
      this._drawPedLike(ctx, {
        x: player.x,
        y: player.y,
        angle: player.angle,
        radius: player.radius,
        clothesColor: '#0f766e',
        accentColor: '#00f5d4',
        weaponId: player.equippedId,
        walkPhase: player.walkPhase,
        muzzleFlash: player.muzzleFlash,
        hitFlash: player.hitFlash,
        meleeSwing: player.meleeSwing,
        recoilKick: player.recoilKick,
        isPlayer: true,
      });
    }
    this._drawProjectiles(ctx, game);
    this._drawBuildings(ctx, game);
    this._drawTrees(ctx, game);
    this._drawParticles(ctx, game);
    this._drawStreetLights(ctx, game);
    this._drawFloatingTexts(ctx, game);
    this._drawWorldPrompts(ctx, game);

    // Camada de tela (vinheta noturna + mira dinâmica)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawScreenAtmosphere(ctx, game);
    if (!game.paused && !game.wheelOpen && player.alive && !player.inVehicle) {
      this._drawCrosshair(ctx, game);
    }

    // Marca de referência para linter caso não usado diretamente
    void map;
    void territorySystem;
  }

  _drawTiles(ctx, game) {
    const { camera, map } = game;
    const startTx = Math.max(0, Math.floor(camera.left / TILE) - 1);
    const endTx = Math.min(MAP_TILES - 1, Math.ceil((camera.left + camera.viewW) / TILE) + 1);
    const startTy = Math.max(0, Math.floor(camera.top / TILE) - 1);
    const endTy = Math.min(MAP_TILES - 1, Math.ceil((camera.top + camera.viewH) / TILE) + 1);

    for (let ty = startTy; ty <= endTy; ty++) {
      const ly = ty % BLOCK;
      const y = ty * TILE;
      for (let tx = startTx; tx <= endTx; tx++) {
        const lx = tx % BLOCK;
        const x = tx * TILE;
        const tile = map.getTile(tx, ty);

        if (tile === T.ROAD) {
          ctx.fillStyle = '#121620';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);

          // Faixas viárias
          ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
          if (lx === 1 && ly >= ROAD_W && ty % 2 === 0) {
            ctx.fillRect(x + TILE * 0.45, y + 6, 3, TILE - 12);
          }
          if (ly === 1 && lx >= ROAD_W && tx % 2 === 0) {
            ctx.fillRect(x + 6, y + TILE * 0.45, TILE - 12, 3);
          }
          // Faixas de pedestre nos cruzamentos
          ctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
          if (lx < ROAD_W && ly === ROAD_W) {
            ctx.fillRect(x + 4, y + 2, TILE - 8, 5);
          } else if (ly < ROAD_W && lx === ROAD_W) {
            ctx.fillRect(x + 2, y + 4, 5, TILE - 8);
          }
        } else if (tile === T.SIDEWALK) {
          ctx.fillStyle = '#23293a';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else if (tile === T.ALLEY) {
          ctx.fillStyle = '#0c1018';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
        } else if (tile === T.PARK) {
          ctx.fillStyle = '#0f271c';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          if ((tx + ty) % 3 === 0) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          }
        } else if (tile === T.FLOOR) {
          ctx.fillStyle = '#1b2233';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE, TILE);
        } else if (tile === T.WALL) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        } else {
          // T.BUILDING base
          ctx.fillStyle = '#0a0e17';
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
        }
      }
    }
  }

  _drawDistrictBorders(ctx, game) {
    const { territorySystem, camera } = game;
    for (const d of territorySystem.districts) {
      const rx = d.col * DISTRICT_SIZE;
      const ry = d.row * DISTRICT_SIZE;
      const rect = { x: rx, y: ry, w: DISTRICT_SIZE, h: DISTRICT_SIZE };
      if (!camera.rectInView(rect, 32)) continue;

      const fac = FACTIONS[d.owner];
      const inWar = territorySystem.activeWar?.districtIndex === d.index;
      ctx.save();
      ctx.strokeStyle = fac?.color || '#fff';
      ctx.globalAlpha = inWar ? 0.35 + Math.sin(this.time * 8) * 0.2 : 0.16;
      ctx.lineWidth = inWar ? 5 : 2;
      ctx.setLineDash([18, 12]);
      ctx.strokeRect(rx + 4, ry + 4, DISTRICT_SIZE - 8, DISTRICT_SIZE - 8);
      ctx.restore();
    }
  }

  _drawPoiMarkers(ctx, game) {
    const { map, camera, heistSystem } = game;
    const pulse = 0.65 + Math.sin(this.time * 4) * 0.25;

    for (const poi of map.pois) {
      if (!camera.rectInView(poi, 80)) continue;

      if (poi.type === 'bank') {
        const active = heistSystem.activeHeist?.poi.id === poi.id;
        ctx.save();
        ctx.fillStyle = poi.cooldown > 0 ? 'rgba(100,116,139,0.16)' : `rgba(250, 204, 21, ${0.14 * pulse})`;
        ctx.beginPath();
        ctx.arc(poi.vaultX, poi.vaultY, poi.vaultRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = poi.cooldown > 0 ? '#64748b' : active ? '#ef4444' : '#facc15';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();

        ctx.fillStyle = poi.cooldown > 0 ? '#94a3b8' : '#facc15';
        ctx.font = '700 12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(poi.cooldown > 0 ? 'COFRE VAZIO' : 'COFRE DO BANCO', poi.vaultX, poi.vaultY + 4);
        ctx.restore();
      } else if (poi.type === 'store') {
        // Balcão da loja
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.fillRect(poi.cashierX - 42, poi.cashierY + 14, 84, 12);
        ctx.strokeStyle = poi.cooldown > 0 ? '#475569' : '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(poi.cashierX - 42, poi.cashierY + 14, 84, 12);

        ctx.fillStyle = poi.cooldown > 0 ? '#64748b' : '#22d3ee';
        ctx.font = '700 11px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(poi.cooldown > 0 ? 'ROUBADA' : 'CAIXA', poi.cashierX, poi.cashierY - 22);
        ctx.restore();
      } else if (poi.type === 'ammunation') {
        ctx.save();
        ctx.fillStyle = `rgba(245, 158, 11, ${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(poi.interactX, poi.interactY, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AMMU-NATION [E]', poi.interactX, poi.interactY + 4);
        ctx.restore();
      } else if (poi.type === 'bribe') {
        ctx.save();
        ctx.fillStyle = `rgba(56, 189, 248, ${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(poi.interactX, poi.interactY, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '700 12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SUBORNO [E]', poi.interactX, poi.interactY + 4);
        ctx.restore();
      }
    }
  }

  _drawPickups(ctx, game) {
    const { pickups, camera } = game;
    for (const p of pickups) {
      if (!camera.inView(p.x, p.y, 24)) continue;
      const bob = Math.sin(this.time * 4 + p.phase) * 3;
      const color =
        p.type === 'cash'
          ? '#4ade80'
          : p.type === 'ammo'
          ? '#facc15'
          : p.type === 'armor'
          ? '#38bdf8'
          : '#f43f5e';
      const label = p.type === 'cash' ? '$' : p.type === 'ammo' ? 'A' : p.type === 'armor' ? 'S' : '+';

      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, 4 - bob, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.font = '800 12px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
  }

  _drawDeadPeds(ctx, game) {
    for (const ped of game.peds) {
      if (ped.alive || !game.camera.inView(ped.x, ped.y, 24)) continue;
      ctx.save();
      ctx.globalAlpha = clamp(1 - ped.deadTimer / 6, 0.15, 0.85);
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 14, 10, ped.angle, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ped.clothesColor;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 10, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawVehicles(ctx, game) {
    const { vehicles, camera } = game;
    for (const v of vehicles) {
      if (!camera.inView(v.x, v.y, 70)) continue;

      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.angle);

      const hw = v.w / 2;
      const hh = v.h / 2;

      // Faróis noturnos
      if (!v.dead && (v.driver || v.aiRole === 'traffic' || v.aiRole === 'police')) {
        const grad = ctx.createLinearGradient(hw, 0, hw + 130, 0);
        grad.addColorStop(0, 'rgba(254, 249, 195, 0.28)');
        grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(hw, -hh + 3);
        ctx.lineTo(hw + 130, -hh - 26);
        ctx.lineTo(hw + 130, hh + 26);
        ctx.lineTo(hw, hh - 3);
        ctx.closePath();
        ctx.fill();
      }

      // Sombra no asfalto
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.fillRect(-hw + 3, -hh + 4, v.w, v.h);

      // Chassi
      ctx.fillStyle = v.dead ? '#1f2937' : v.color;
      ctx.fillRect(-hw, -hh, v.w, v.h);

      // Faixa branca lateral de viatura
      if (v.spec.police && !v.dead) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-hw * 0.25, -hh + 2, hw * 0.65, v.h - 4);
      }

      // Vidros / Teto
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-hw * 0.45, -hh + 3, v.w * 0.56, v.h - 6);
      ctx.fillStyle = v.dead ? '#374151' : v.color;
      ctx.fillRect(-hw * 0.32, -hh + 4, v.w * 0.32, v.h - 8);

      // Contorno metálico
      ctx.strokeStyle = v.driver === game.player ? '#00f5d4' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = v.driver === game.player ? 1.8 : 1;
      ctx.strokeRect(-hw, -hh, v.w, v.h);

      // Lanternas traseiras
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-hw, -hh + 2, 3, 5);
      ctx.fillRect(-hw, hh - 7, 3, 5);

      // Faróis dianteiros
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(hw - 3, -hh + 2, 3, 5);
      ctx.fillRect(hw - 3, hh - 7, 3, 5);

      // Giroflex policial
      if (v.sirenOn && !v.dead) {
        const redOn = Math.sin(v.sirenPhase) > 0;
        ctx.fillStyle = redOn ? '#ff2a55' : '#3a86ff';
        ctx.fillRect(-2, -hh + 3, 4, v.h / 2 - 3);
        ctx.fillStyle = redOn ? '#3a86ff' : '#ff2a55';
        ctx.fillRect(-2, 0, 4, v.h / 2 - 3);

        // Halo luminoso da sirene
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = redOn ? 'rgba(255, 42, 85, 0.22)' : 'rgba(58, 134, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();
    }
  }

  _drawAlivePeds(ctx, game) {
    for (const ped of game.peds) {
      if (!ped.alive || !game.camera.inView(ped.x, ped.y, 40)) continue;
      this._drawPedLike(ctx, {
        x: ped.x,
        y: ped.y,
        angle: ped.angle,
        radius: ped.radius,
        clothesColor: ped.clothesColor,
        accentColor: ped.accentColor,
        weaponId: ped.weaponId,
        walkPhase: ped.walkPhase,
        muzzleFlash: ped.muzzleFlash,
        hitFlash: ped.hitFlash,
        meleeSwing: 0,
        recoilKick: 0,
        isWarEnemy: ped.isWarEnemy,
        isPolice: ped.faction === 'police',
        surrender: ped.state === 'surrender',
      });
    }
  }

  _drawPedLike(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Anel identificador de alvo de guerra ou jogador
    if (p.isWarEnemy) {
      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.isPlayer) {
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(p.angle);

    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(2, 3, p.radius, 0, Math.PI * 2);
    ctx.fill();

    const swing = p.meleeSwing > 0 ? Math.sin((p.meleeSwing / 0.22) * Math.PI) * 0.9 : 0;
    const kick = p.recoilKick || 0;
    const stride = Math.sin(p.walkPhase || 0) * 3;

    // Pés animados
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(stride - 3, -8, 6, 4);
    ctx.fillRect(-stride - 3, 4, 6, 4);

    // Ombros / Torso
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : p.clothesColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Colete / Acento de facção
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Braços + arma
    if (p.surrender) {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(6, -12, 3.5, 0, Math.PI * 2);
      ctx.arc(6, 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.weaponId && p.weaponId !== 'fists') {
      const w = WEAPONS[p.weaponId];
      ctx.save();
      ctx.rotate(swing);
      ctx.translate(-kick * 0.4, 4);
      if (w?.type === 'melee') {
        ctx.fillStyle = w.id === 'bat' ? '#d97706' : '#cbd5e1';
        ctx.fillRect(4, -2, w.id === 'bat' ? 18 : 13, 3.5);
      } else if (w?.type === 'throw') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(9, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const len = w?.slot === 4 || w?.slot === 3 ? 19 : w?.slot === 2 ? 14 : 11;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(4, -2, len, 4);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(2, -2, 5, 4);

        if (p.muzzleFlash > 0) {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(len + 6, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Cabeça
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#e2c4a8';
    ctx.beginPath();
    ctx.arc(1, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Capacete policial / Bandana de facção
    ctx.fillStyle = p.isPolice ? '#1d4ed8' : p.accentColor;
    ctx.beginPath();
    ctx.arc(-1, 0, 6.2, Math.PI * 0.65, Math.PI * 1.35);
    ctx.fill();

    ctx.restore();
  }

  _drawProjectiles(ctx, game) {
    ctx.save();
    for (const b of game.bullets) {
      if (!game.camera.inView(b.x, b.y, 40)) continue;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(b.prevX, b.prevY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const g of game.grenades) {
      if (!game.camera.inView(g.x, g.y, 40)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(g.x, g.y + 4, 5, 0, Math.PI * 2);
      ctx.fill();

      const blink = Math.floor(g.fuse * 12) % 2 === 0;
      ctx.fillStyle = blink ? '#ef4444' : '#22c55e';
      ctx.beginPath();
      ctx.arc(g.x, g.y - g.z * 0.4, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBuildings(ctx, game) {
    const { map, camera } = game;
    for (const b of map.buildings) {
      if (!camera.rectInView(b, 48)) continue;
      if (b.isInteriorShell) {
        // Apenas letreiro neon na fachada sul da loja/banco (interior fica visível!)
        if (b.neonSign) {
          ctx.save();
          ctx.fillStyle = '#090d16';
          ctx.fillRect(b.x + b.w * 0.25, b.y + b.h - 24, b.w * 0.5, 18);
          ctx.strokeStyle = b.accent;
          ctx.lineWidth = 1.8;
          ctx.strokeRect(b.x + b.w * 0.25, b.y + b.h - 24, b.w * 0.5, 18);
          ctx.fillStyle = b.accent;
          ctx.font = '800 11px Orbitron, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.neonSign, b.x + b.w * 0.5, b.y + b.h - 11);
          ctx.restore();
        }
        continue;
      }

      // Prédio sólido com sombra projetada e detalhes no telhado
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w, b.h);

      ctx.fillStyle = b.roofColor;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Borda neon sutil de território
      ctx.strokeStyle = b.accent;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.globalAlpha = 1;

      // Recuo interno do telhado
      ctx.fillStyle = '#090d16';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);

      // Unidades de ar-condicionado no telhado
      ctx.fillStyle = '#334155';
      ctx.fillRect(b.x + 18, b.y + 18, 18, 14);
      if (b.w > 130) {
        ctx.fillRect(b.x + b.w - 38, b.y + 20, 16, 16);
      }

      if (b.hasHelipad) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.font = '800 20px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
      }

      if (b.neonSign) {
        ctx.fillStyle = b.accent;
        ctx.font = '700 11px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.neonSign, b.x + b.w / 2, b.y + b.h - 16);
      }
    }
  }

  _drawTrees(ctx, game) {
    for (const t of game.map.trees) {
      if (!game.camera.inView(t.x, t.y, 40)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawParticles(ctx, game) {
    for (const p of game.particles) {
      if (!game.camera.inView(p.x, p.y, 60)) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'ring') {
        const progress = 1 - alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1.5 - alpha * 0.5 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawStreetLights(ctx, game) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of game.map.streetLights) {
      if (!game.camera.inView(l.x, l.y, 90)) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 75);
      g.addColorStop(0, 'rgba(255, 225, 160, 0.22)');
      g.addColorStop(0.5, 'rgba(56, 189, 248, 0.06)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawFloatingTexts(ctx, game) {
    ctx.save();
    ctx.font = '700 14px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    for (const t of game.texts) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.fillStyle = '#000';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  _drawWorldPrompts(ctx, game) {
    const { player, map, vehicles } = game;
    if (!player.alive || player.inVehicle) return;

    // Dica de entrar em veículo próximo
    let nearVeh = null;
    let bestD = 68;
    for (const v of vehicles) {
      if (v.dead) continue;
      const d = dist(player.x, player.y, v.x, v.y);
      if (d < bestD) {
        bestD = d;
        nearVeh = v;
      }
    }
    if (nearVeh) {
      ctx.save();
      ctx.fillStyle = 'rgba(9, 13, 22, 0.86)';
      ctx.fillRect(nearVeh.x - 58, nearVeh.y - 40, 116, 20);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 1;
      ctx.strokeRect(nearVeh.x - 58, nearVeh.y - 40, 116, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 11px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[F] Entrar: ${nearVeh.spec.name}`, nearVeh.x, nearVeh.y - 26);
      ctx.restore();
    }

    // Dica de loja / banco
    for (const poi of map.pois) {
      if (poi.type === 'store' && poi.cooldown <= 0 && dist(player.x, player.y, poi.cashierX, poi.cashierY) < poi.robRadius) {
        ctx.fillStyle = '#22d3ee';
        ctx.font = '700 12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Mire no caixa ou pressione [E] para assaltar', poi.cashierX, poi.cashierY - 38);
      }
    }
  }

  _drawScreenAtmosphere(ctx, game) {
    const { camera, player } = game;
    const w = camera.w;
    const h = camera.h;

    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3, 6, 14, 0.58)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // Flash vermelho quando jogador toma dano
    if (player.hitFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${player.hitFlash * 1.4})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Reflexo sutil de sirene nas bordas quando procurado
    if (game.wantedSystem.stars > 0 && !game.wantedSystem.evading) {
      const pulse = Math.sin(this.time * 10);
      ctx.fillStyle = pulse > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(0, 0, w, 10);
      ctx.fillRect(0, h - 10, w, 10);
    }
  }

  _drawCrosshair(ctx, game) {
    const { input, player } = game;
    const x = input.mouse.x;
    const y = input.mouse.y;
    const gap = 6 + player.recoilBloom * 90 + (player.weapon.spread || 0) * 35;

    ctx.save();
    ctx.strokeStyle = player.reloadTimer > 0 ? '#facc15' : '#00f5d4';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - gap - 7, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + 7, y);
    ctx.moveTo(x, y - gap - 7);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + 7);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();

    if (player.reloadTimer > 0) {
      const total = player.weapon.reloadTime || 1;
      const prog = 1 - player.reloadTimer / total;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
