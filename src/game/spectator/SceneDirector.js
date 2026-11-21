import { clamp, dist, randInt } from '../core/math.js';
import {
  TrenchSegment,
  BarbedWireLine,
  FortifiedWallLine,
} from '../entities/SquadUnit.js';

export const DIRECTOR_SCENES = [
  {
    id: 'trenches',
    title: 'Guerra de Trincheiras',
    sub: 'Frente a Frente • 35m Terra de Ninguém',
  },
  {
    id: 'armor_clash',
    title: 'Choque de Blindados',
    sub: '5 MBT + 4 APC Stryker + Humvees',
  },
  {
    id: 'drone_swarm',
    title: 'Enxame de Drones',
    sub: 'UAV Recon & Kamikaze FPV vs Coluna',
  },
  {
    id: 'fortress_siege',
    title: 'Cerco à Fortaleza',
    sub: 'Muralha com Portão, Bunkers & Assalto',
  },
  {
    id: 'paradrop_ambush',
    title: 'Desembarque Aéreo',
    sub: '6 Paraquedistas Emboscando Comboio',
  },
  {
    id: 'urban_combat',
    title: 'Combate Urbano',
    sub: 'Vilarejo Sob Fogo Casa a Casa',
  },
  {
    id: 'air_storm',
    title: 'Tempestade Aérea',
    sub: 'Caças A-10, Bombardeio & Artilharia',
  },
  {
    id: 'total_chaos',
    title: 'Batalha Total Noturna',
    sub: 'Todas as Armas + Clima Noturno',
  },
];

function clearCentralStage(game, cx, cy, radius = 1600) {
  game.units = game.units.filter((u) => {
    if (!u.alive) return false;
    return dist(u.x, u.y, cx, cy) > radius;
  });
  game.trenches = game.trenches.filter((t) => {
    const c = t.getCenter ? t.getCenter() : { x: 0, y: 0 };
    return dist(c.x, c.y, cx, cy) > radius;
  });
  game.fortifiedWalls = game.fortifiedWalls.filter((w) => {
    const c = w.getCenter ? w.getCenter() : { x: (w.x1 + w.x2) * 0.5, y: (w.y1 + w.y2) * 0.5 };
    return dist(c.x, c.y, cx, cy) > radius;
  });
  game.barbedWires = game.barbedWires.filter((w) => {
    const mx = (w.x1 + w.x2) * 0.5;
    const my = (w.y1 + w.y2) * 0.5;
    return dist(mx, my, cx, cy) > radius;
  });
  if (game.map?.structures) {
    game.map.structures = game.map.structures.filter((st) => dist(st.x, st.y, cx, cy) > 950);
  }
  game.bullets = [];
  game.aircrafts = [];
  game.activeDrones = [];
  game.pendingGrenades = [];
}

function addDirectorBuilding(game, presetKey, x, y, angle = 0) {
  const presets = {
    farmhouse: { name: 'Casa Rural', type: 'farmhouse', w: 94, d: 72, h: 42 },
    two_story: { name: 'Sobrado Urbano', type: 'two_story', w: 108, d: 86, h: 68 },
    barn: { name: 'Celeiro', type: 'barn', w: 120, d: 82, h: 52 },
    warehouse: { name: 'Galpão Industrial', type: 'warehouse', w: 148, d: 96, h: 48 },
    brick_ruin: { name: 'Ruína de Tijolo', type: 'brick_ruin', w: 88, d: 68, h: 36 },
  };
  const p = presets[presetKey] || presets.farmhouse;
  const st = {
    id: `dir_bld_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    name: p.name,
    type: p.type,
    x,
    y,
    w: p.w,
    d: p.d,
    h: p.h,
    angle,
    garrisonable: true,
    garrisonUnitId: null,
    garrisonTeam: null,
    coverRadius: Math.round(Math.max(p.w, p.d) * 0.92),
  };
  game.map?.structures?.push(st);
  game.renderer?.addEditorStructure?.(st, game.map);
  return st;
}

function spawnDirectorDrone(game, type, x, y, targetX, targetY, team = 'allies') {
  const isFpv = type === 'fpv_kamikaze';
  game.activeDrones.push({
    id: `dir_drn_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    type,
    team,
    x,
    y,
    z: isFpv ? 62 : 120,
    targetX: clamp(targetX, 120, game.map.size - 120),
    targetY: clamp(targetY, 120, game.map.size - 120),
    angle: Math.atan2(targetY - y, targetX - x),
    speed: isFpv ? 340 : 250,
    life: isFpv ? 24 : 45,
    orbitPhase: Math.random() * Math.PI * 2,
    alive: true,
  });
}

function spawnParatrooperUnit(game, faction, x, y, targetX, targetY) {
  const u = game.spawnUnit(faction, 'paratrooper_squad', x, y, Math.atan2(targetY - y, targetX - x));
  if (u) {
    u.paradropAltitude = 360;
    u.paradropTimer = 2.6;
    u.setMoveOrder(targetX, targetY);
  }
  return u;
}

export function runDirectorScene(game, sceneId) {
  if (!game || !game.map || !game.isAdminUser?.()) return false;
  const cx = Math.round(game.map.size * 0.5);
  const cy = Math.round(game.map.size * 0.5);

  clearCentralStage(game, cx, cy);
  game.spectatorMode = true;
  game.directorCamActive = true;
  game.intelRevealed = true;
  game.sandboxFogDisabled = true;
  game.activeDirectorSceneId = sceneId;
  game._directorTarget = { x: cx, y: cy };
  game.camera.x = cx;
  game.camera.y = cy;

  if (sceneId !== 'total_chaos' && game.timeOfDay === 'night') {
    game.setTimeOfDay?.('day', true);
  }

  if (sceneId === 'trenches') {
    // Duas redes paralelas separadas por ~35m (350u) com arame farpado no meio
    game.trenches.push(
      new TrenchSegment({
        points: [
          { x: cx - 185, y: cy - 320 },
          { x: cx - 175, y: cy - 110 },
          { x: cx - 190, y: cy + 110 },
          { x: cx - 175, y: cy + 320 },
        ],
        team: 'allies',
        revealed: true,
      }),
      new TrenchSegment({
        points: [
          { x: cx + 185, y: cy - 320 },
          { x: cx + 175, y: cy - 110 },
          { x: cx + 190, y: cy + 110 },
          { x: cx + 175, y: cy + 320 },
        ],
        team: 'enemies',
        revealed: true,
      })
    );
    game.barbedWires.push(
      new BarbedWireLine({ x1: cx - 40, y1: cy - 260, x2: cx - 40, y2: cy + 260, team: 'allies' }),
      new BarbedWireLine({ x1: cx + 40, y1: cy - 260, x2: cx + 40, y2: cy + 260, team: 'enemies' })
    );
    const ySlots = [-240, -80, 80, 240];
    const allyTypes = ['rifle_squad', 'assault_squad', 'rifle_squad', 'at_javelin_squad'];
    const axisTypes = ['rifle_squad', 'assault_squad', 'rifle_squad', 'shock_flamer'];
    ySlots.forEach((dy, idx) => {
      const au = game.spawnUnit('player', allyTypes[idx], cx - 180, cy + dy, 0);
      if (au) au.inTrench = true;
      const eu = game.spawnUnit('enemy_1', axisTypes[idx], cx + 180, cy + dy, Math.PI);
      if (eu) eu.inTrench = true;
    });
  } else if (sceneId === 'armor_clash') {
    for (let i = 0; i < 5; i++) {
      const y = cy - 240 + i * 120;
      const aTank = game.spawnUnit('player', 'mbt_tank', cx - 640, y, 0);
      aTank?.setMoveOrder(cx - 120, y);
      const eTank = game.spawnUnit('enemy_1', 'mbt_tank', cx + 640, y, Math.PI);
      eTank?.setMoveOrder(cx + 120, y);
    }
    for (let i = 0; i < 4; i++) {
      const y = cy - 180 + i * 120;
      const aApc = game.spawnUnit('player', 'apc_stryker', cx - 800, y, 0);
      aApc?.setMoveOrder(cx - 210, y);
      const eApc = game.spawnUnit('enemy_1', 'apc_stryker', cx + 800, y, Math.PI);
      eApc?.setMoveOrder(cx + 210, y);
    }
    for (const dy of [-260, 260]) {
      game.spawnUnit('player', 'humvee', cx - 540, cy + dy, 0)?.setMoveOrder(cx - 140, cy + dy * 0.7);
      game.spawnUnit('enemy_1', 'humvee', cx + 540, cy + dy, Math.PI)?.setMoveOrder(cx + 140, cy + dy * 0.7);
    }
  } else if (sceneId === 'drone_swarm') {
    for (let i = 0; i < 3; i++) {
      const y = cy - 160 + i * 160;
      game.spawnUnit('player', i === 1 ? 'apc_stryker' : 'humvee', cx - 480, y, 0)?.setMoveOrder(cx - 120, y);
      game.spawnUnit('enemy_1', i === 1 ? 'mbt_tank' : 'apc_stryker', cx + 460, y, Math.PI)?.setMoveOrder(cx + 110, y);
    }
    game.spawnUnit('enemy_1', 'rifle_squad', cx + 300, cy - 80, Math.PI);
    game.spawnUnit('player', 'rifle_squad', cx - 300, cy + 80, 0);
    spawnDirectorDrone(game, 'uav_recon', cx - 420, cy - 180, cx + 180, cy, 'allies');
    spawnDirectorDrone(game, 'uav_recon', cx - 380, cy + 180, cx + 220, cy + 60, 'allies');
    spawnDirectorDrone(game, 'uav_recon', cx + 420, cy, cx - 180, cy, 'enemies');
    for (let i = 0; i < 4; i++) {
      spawnDirectorDrone(
        game,
        'fpv_kamikaze',
        cx - 520,
        cy - 180 + i * 120,
        cx + 340,
        cy - 120 + i * 80,
        'allies'
      );
    }
  } else if (sceneId === 'fortress_siege') {
    game.fortifiedWalls.push(
      new FortifiedWallLine({ x1: cx + 80, y1: cy - 320, x2: cx + 80, y2: cy + 320, team: 'enemies', isGate: true, isElite: true }),
      new FortifiedWallLine({ x1: cx + 80, y1: cy - 320, x2: cx + 420, y2: cy - 320, team: 'enemies', isGate: false }),
      new FortifiedWallLine({ x1: cx + 80, y1: cy + 320, x2: cx + 420, y2: cy + 320, team: 'enemies', isGate: false })
    );
    game.spawnUnit('enemy_1', 'concrete_bunker', cx + 135, cy - 190, Math.PI);
    game.spawnUnit('enemy_1', 'concrete_bunker', cx + 135, cy + 190, Math.PI);
    game.spawnUnit('enemy_1', 'sniper_squad', cx + 180, cy - 80, Math.PI);
    game.spawnUnit('enemy_1', 'rifle_squad', cx + 180, cy + 80, Math.PI);

    for (const dy of [-180, 0, 180]) {
      game.spawnUnit('player', 'mbt_tank', cx - 620, cy + dy, 0)?.setMoveOrder(cx - 110, cy + dy * 0.6);
    }
    for (const dy of [-110, 110]) {
      game.spawnUnit('player', 'assault_squad', cx - 440, cy + dy, 0)?.setMoveOrder(cx + 40, cy + dy * 0.5);
      game.spawnUnit('player', 'engineers', cx - 490, cy + dy * 0.5, 0)?.setMoveOrder(cx + 20, cy + dy * 0.4);
    }
  } else if (sceneId === 'paradrop_ambush') {
    const convoyTypes = ['troop_transport', 'humvee', 'apc_stryker', 'mbt_tank'];
    convoyTypes.forEach((tp, idx) => {
      const eu = game.spawnUnit('enemy_1', tp, cx - 320 + idx * 210, cy, 0);
      eu?.setMoveOrder(cx + 750, cy);
    });
    for (let i = 0; i < 3; i++) {
      spawnParatrooperUnit(game, 'player', cx - 180 + i * 180, cy - 260, cx - 120 + i * 140, cy - 45);
      spawnParatrooperUnit(game, 'player', cx - 180 + i * 180, cy + 260, cx - 120 + i * 140, cy + 45);
    }
  } else if (sceneId === 'urban_combat') {
    const buildings = [
      addDirectorBuilding(game, 'two_story', cx - 140, cy - 150, 0),
      addDirectorBuilding(game, 'farmhouse', cx + 150, cy - 140, Math.PI),
      addDirectorBuilding(game, 'barn', cx - 160, cy + 160, Math.PI * 0.5),
      addDirectorBuilding(game, 'brick_ruin', cx + 160, cy + 160, 0),
      addDirectorBuilding(game, 'warehouse', cx, cy, 0),
    ];
    buildings.forEach((st, idx) => {
      const fac = idx % 2 === 0 ? 'player' : 'enemy_1';
      const u = game.spawnUnit(fac, 'rifle_squad', st.x, st.y, fac === 'player' ? 0 : Math.PI);
      if (u) {
        st.garrisonUnitId = u.id;
        st.garrisonTeam = u.team;
        st.garrisonedSquad = u;
        u.garrisonedBuildingId = st.id;
        u.garrisonedBuilding = st;
      }
    });
    game.spawnUnit('player', 'assault_squad', cx - 440, cy - 40, 0)?.setMoveOrder(cx - 40, cy - 30);
    game.spawnUnit('player', 'apc_stryker', cx - 500, cy + 60, 0)?.setMoveOrder(cx - 80, cy + 50);
    game.spawnUnit('enemy_1', 'assault_squad', cx + 440, cy + 40, Math.PI)?.setMoveOrder(cx + 40, cy + 30);
    game.spawnUnit('enemy_1', 'apc_stryker', cx + 500, cy - 60, Math.PI)?.setMoveOrder(cx + 80, cy - 50);
  } else if (sceneId === 'air_storm') {
    game.fortifiedWalls.push(
      new FortifiedWallLine({ x1: cx - 60, y1: cy - 220, x2: cx - 60, y2: cy + 220, team: 'enemies', isGate: true })
    );
    game.spawnUnit('enemy_1', 'concrete_bunker', cx + 80, cy - 110, Math.PI);
    game.spawnUnit('enemy_1', 'concrete_bunker', cx + 80, cy + 110, Math.PI);
    game.spawnUnit('enemy_1', 'mbt_tank', cx + 210, cy, Math.PI);
    for (const dy of [-180, 180]) {
      game.spawnUnit('player', 'rocket_artillery', cx - 760, cy + dy, 0)?.setMoveOrder(cx - 580, cy + dy);
      game.spawnUnit('enemy_1', 'rocket_artillery', cx + 760, cy + dy, Math.PI)?.setMoveOrder(cx + 580, cy + dy);
    }
    game._executeAirDoctrineAt?.('recon_drone', cx + 60, cy);
    game._executeAirDoctrineAt?.('a10_strafe', cx + 100, cy - 40);
    game._executeAirDoctrineAt?.('tactical_bombing', cx + 120, cy + 50);
  } else if (sceneId === 'total_chaos') {
    game.setTimeOfDay?.('night', true);
    game.trenches.push(
      new TrenchSegment({
        points: [
          { x: cx - 220, y: cy - 220 },
          { x: cx - 220, y: cy + 220 },
        ],
        team: 'allies',
        revealed: true,
      }),
      new TrenchSegment({
        points: [
          { x: cx + 220, y: cy - 220 },
          { x: cx + 220, y: cy + 220 },
        ],
        team: 'enemies',
        revealed: true,
      })
    );
    for (const dy of [-140, 0, 140]) {
      const aInf = game.spawnUnit('player', 'assault_squad', cx - 220, cy + dy, 0);
      if (aInf) aInf.inTrench = true;
      const eInf = game.spawnUnit('enemy_1', 'assault_squad', cx + 220, cy + dy, Math.PI);
      if (eInf) eInf.inTrench = true;
      game.spawnUnit('player', 'mbt_tank', cx - 580, cy + dy, 0)?.setMoveOrder(cx - 120, cy + dy);
      game.spawnUnit('enemy_1', 'mbt_tank', cx + 580, cy + dy, Math.PI)?.setMoveOrder(cx + 120, cy + dy);
    }
    spawnParatrooperUnit(game, 'player', cx, cy - 240, cx + 60, cy - 80);
    spawnParatrooperUnit(game, 'player', cx, cy + 240, cx + 60, cy + 80);
    spawnDirectorDrone(game, 'uav_recon', cx - 320, cy - 120, cx + 120, cy, 'allies');
    spawnDirectorDrone(game, 'fpv_kamikaze', cx - 360, cy + 120, cx + 320, cy, 'allies');
    game._executeAirDoctrineAt?.('a10_strafe', cx + 140, cy);
  }

  game.map?.syncAllColliders?.(game.baseBuildings);
  game.audio?.play?.('radio');
  const meta = DIRECTOR_SCENES.find((s) => s.id === sceneId);
  game.notify(
    `CENA ATIVA: ${(meta?.title || sceneId).toUpperCase()}`,
    meta?.sub || 'Diretor de Cenas posicionou os exércitos no centro do mapa.',
    '#f59e0b'
  );
  game._emitHud();
  return true;
}
