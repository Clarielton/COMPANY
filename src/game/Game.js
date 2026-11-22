import { clamp, dist, randInt } from './core/math.js';
import { Input } from './core/Input.js';
import { AudioSystem } from './core/AudioSystem.js';
import { networkManager } from './net/NetworkManager.js';
import {
  COMMAND_ACTIONS,
  COMMAND_BY_ID,
  BOTTOM_BAR_CATEGORIES,
  SPACING_PRESETS,
  HQ_BUILDING_SPEC,
  HQ_UPGRADES,
  BASE_BUILDINGS,
  BASE_BUILDING_BY_ID,
  AIR_DOCTRINES,
  AIR_DOCTRINE_BY_ID,
  SQUAD_FORMATIONS,
  SQUAD_FORMATION_BY_ID,
  saveUserCustomMapEntry,
} from './data/rtsData.js';
import {
  TECH_NODES,
  TECH_NODE_BY_ID,
  computeTechResearchCost,
} from './data/techTreeData.js';
import { BattlefieldMap, BATTLEFIELD_SIZE } from './world/BattlefieldMap.js';
import { getTerrainHeight, getTerrainHeightAt, getTerrainSlopeAt } from './world/terrainHeight.js';
import {
  SquadUnit,
  TrenchSegment,
  BarricadeLine,
  FortifiedWallLine,
  BarbedWireLine,
  Landmine,
} from './entities/SquadUnit.js';
import { FloatingText } from './entities/Particle.js';
import { Renderer3D } from './render/Renderer3D.js';
import { runDirectorScene } from './spectator/SceneDirector.js';

// Exportações compatíveis para testes legados
import { CityMap } from './world/CityMap.js';
import { Player } from './entities/Player.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { TerritorySystem } from './systems/TerritorySystem.js';
import { HeistSystem } from './systems/HeistSystem.js';
import { WantedSystem } from './systems/WantedSystem.js';

export class Game {
  constructor({ canvas, overlayCanvas, onHudUpdate, onInterrogate } = {}) {
    this.canvas = canvas;
    this.onHudUpdate = onHudUpdate;
    this.onInterrogate = onInterrogate;

    this.settings = {
      camSpeed: 1.0,
      volume: 0.35,
      highQuality: true,
    };

    this.gameMode = '1v1'; // '1v1' ou '2v2'
    this.startingResourcesPreset = 600; // 450 (Escasso) | 600 (Padrão) | 1000 (Alto Comando)

    // Controle de Velocidade na HUD: 0 (Pausado [Espaço]), 0.5x (Tático Lento), 1x (Normal), 1.5x
    this.timeScale = 1.0;
    this.lastNonZeroSpeed = 1.0;

    this.input = canvas
      ? new Input(canvas)
      : {
          down: () => false,
          wasPressed: () => false,
          endFrame: () => {},
          destroy: () => {},
          mouse: {
            x: 0,
            y: 0,
            down: false,
            rightDown: false,
            clicked: false,
            rightClicked: false,
            released: false,
            rightReleased: false,
            isDragging: false,
            isRightDragging: false,
            dragStartX: 0,
            dragStartY: 0,
            rightDragStartX: 0,
            rightDragStartY: 0,
          },
          wheel: 0,
        };

    this.audio = new AudioSystem();
    this.mapId = 'normandy_fields';
    this.map = new BattlefieldMap({ seed: 1944, mapId: this.mapId });
    this.renderer = canvas ? new Renderer3D(canvas, overlayCanvas) : null;

    this.camera = {
      x: 2100,
      y: 4800,
      zoom: 660,
      shake: (mag, t) => this.renderer?.shake(mag, t),
    };

    this.units = [];
    if (typeof window !== 'undefined') window.__frontlineGame = this;
    this.trenches = [];
    this.barricades = [];
    this.fortifiedWalls = [];
    this.guidedTrainingActive = false;
    this.guidedTrainingStep = 0;
    this.guidedTrainingTimer = 0;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('frontline_start_guided') === '1') {
        localStorage.removeItem('frontline_start_guided');
        this.guidedTrainingActive = true;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('frontline_assault_drill') === '1') {
        localStorage.removeItem('frontline_assault_drill');
        setTimeout(() => this.startAssaultSandboxDrill(), 220);
      }
    } catch {
      // noop
    }
    this.barbedWires = [];
    this.mines = [];
    this.baseBuildings = [];
    this.aircrafts = [];
    this.bullets = [];
    this.pendingGrenades = [];
    this.repairSparkTimer = 0;
    this.particles = [];
    this.texts = [];
    this.notifications = [];

    this.selectedBuildingId = null;
    this.selectedStructureId = null;
    this.victoryPoints = 0;

    // Quadro de Planejamento Tático Interativo ([TAB] / Mini-Mapa)
    this.tacticalMapOpen = false;
    this.tacticalArrows = [];
    this.tacticalPings = [];

    this.supplies = 600;
    this.ammo = 140;
    this.fuel = 95;
    this.enemySupplies = { enemy_1: 600, enemy_2: 600 };
    this.allyAiSupplies = 600;
    this.supplyIncomeTimer = 6.0;

    // Ondas de IA a cada 38 segundos (ritmo cadenciado estilo Company of Heroes)
    this.aiWaveTimer = 38.0;
    this.aiTacticalOrderTimer = 6.0;
    this.wreckSmokeTimer = 0.25;
    this.vehicleExhaustTimer = 0.14;

    this.activeCommandSlot = 0;
    this.activeBottomCategory = 'infantry'; // 'infantry' | 'vehicles' | 'engineering' | 'defenses' | 'all'
    this.activeCommandMode = null;
    this.activeEngineeringActionId = null;
    this.activeAirStrikeMode = null;
    this.airCooldowns = {
      recon_drone: 0,
      a10_strafe: 0,
      precision_bomb: 0,
    };

    this.trenchShapeL = false;
    this.trenchPreview = null;
    this.orientationPreview = null;
    this.coverSnapPreview = null;
    this.hoverPathPreview = null;
    this.rightOrderStartWorld = null;
    this.selectionBox = null;
    this.worldMouse = { x: 4800, y: 4800 };

    // Árvore de Pesquisa & Drones de Guerra + Progressão do QG (Nv. 1-3) e Pontos de Comando (CP)
    this.hqLevel = 1;
    this.commandPoints = 0;
    this.aiDifficulty = 'medium'; // 'easy' | 'medium' | 'hard'
    this.playerSkinId = 'olive_classic';
    this.aiHqLevels = { ally_ai: 1, enemy_1: 1, enemy_2: 1 };
    this.techModalOpen = false;
    this.selectedBudgetTier = 0.25;
    this.completedTechs = new Set();
    this.activeResearch = null;
    this.activeDrones = [];
    this.activeDroneLaunchMode = null; // 'uav_recon' | 'fpv_kamikaze' | null
    this.droneStock = { uav_recon: 0, fpv_kamikaze: 0 };
    this.droneQueue = [];
    this.maxDroneStock = 3;
    this.maxActiveDrones = 2;
    this.radioInterceptTimer = 0;

    // Estatísticas da Batalha & Fim de Jogo
    this.gameOver = false;
    this.matchStats = {
      elapsedSeconds: 0,
      unitsEliminated: 0,
      prisonersInterrogated: 0,
      trenchesDug: 0,
      researchesCompleted: 0,
    };

    // Modo de Controle Touch: 'select' ([Modo Seleção ▭]) ou 'camera' ([Modo Câmera ✋])
    this.touchControlMode = 'select';

    this.intelRevealed = false;
    this.spectatorMode = false;
    this.directorCamActive = false;
    this.spectatorHudHidden = false;
    this.activeDirectorSceneId = null;
    this.timeOfDay = 'day';
    this.cinematicLowCam = false;
    this._directorTarget = { x: 4800, y: 4800 };
    this._directorSwitchTimer = 0;
    this.sandboxMode = false;
    this.sandboxFogDisabled = false;
    this.sandboxAiPaused = false;
    this.powPrisoners = [];
    this.enemyProductionDebuffTimer = 0;
    this.enemySabotageTimer = 0;
    this.victoryState = null;

    this.menuActive = true;
    this.paused = false;
    this.hudSyncTimer = 0;
    this.rafId = null;
    this.lastTs = 0;
    this.localPlayerFaction = 'player';
    this.localPlayerTeam = 'allies';

    // Armazenamento em memória de fallback (caso localStorage não esteja disponível em testes Node.js)
    this._memorySaves = [];
    this.saveStorageKey = 'cof_rts_saved_battles_v1';
    this.autoSaveTimer = 30;
    if (typeof window !== 'undefined') {
      this._onAutoSavePageHide = () => {
        if (!this.menuActive && !this.gameOver && !this.spectatorMode && !this.isMultiplayer) {
          this.autoSaveBattle();
        }
      };
      window.addEventListener('beforeunload', this._onAutoSavePageHide);
    }

    // Instâncias auxiliares para compatibilidade com smoke-test
    this.cityMap = new CityMap(2077);
    this.player = new Player(this.cityMap.spawnPoint.x, this.cityMap.spawnPoint.y);
    this.weaponSystem = new WeaponSystem();
    this.territorySystem = new TerritorySystem();
    this.heistSystem = new HeistSystem();
    this.wantedSystem = new WantedSystem();

    if (this.renderer) {
      this.renderer.buildWorld(this.map);
      this.renderer.applySettings(this.settings);
    }

    this.setupMatch(this.gameMode, this.startingResourcesPreset);
  }

  get myFaction() {
    return this.localPlayerFaction || 'player';
  }

  get myTeam() {
    return this.localPlayerTeam || 'allies';
  }

  setTouchControlMode(mode) {
    this.touchControlMode = mode === 'camera' ? 'camera' : 'select';
    this.selectionBox = null;
    this.audio.play('switch');
    this.notify(
      this.touchControlMode === 'camera'
        ? '✋ MODO CÂMERA ATIVADO (ARRASTAR 1 DEDO MOVE O MAPA)'
        : '▭ MODO SELEÇÃO ATIVADO (ARRASTAR 1 DEDO SELECIONA TROPAS)',
      'Toque Simples seleciona/ordena • 2 Dedos sempre movem e dão zoom (Pinça)',
      '#38bdf8'
    );
    this._emitHud();
    return this.touchControlMode;
  }

  toggleTouchControlMode() {
    return this.setTouchControlMode(this.touchControlMode === 'select' ? 'camera' : 'select');
  }

  setGameSpeed(mult) {
    if (this.isMultiplayer) {
      this.paused = false;
      this.timeScale = 1.0;
      this.lastNonZeroSpeed = 1.0;
      this._emitHud();
      return;
    }
    if (mult === 0) {
      if (this.timeScale > 0) this.lastNonZeroSpeed = this.timeScale;
      this.timeScale = 0;
      this.notify('PAUSA TÁTICA ATIVADA [ESPAÇO]', 'Você pode inspecionar o campo e emitir ordens.', '#d4a338');
    } else {
      this.paused = false;
      this.timeScale = Number.isFinite(mult) && mult > 0 ? mult : 1.0;
      this.lastNonZeroSpeed = this.timeScale;
      this.notify(`VELOCIDADE DA OPERAÇÃO: ${this.timeScale}x`, '', '#c87d28');
    }
    this._emitHud();
  }

  toggleTacticalPause() {
    if (this.isMultiplayer) {
      this.paused = false;
      this.timeScale = 1.0;
      this.notify('VELOCIDADE TRAVADA EM 1.0x', 'Partidas online mantêm sincronização fixa em 1x.', '#c87d28');
      this._emitHud();
      return;
    }
    if (this.timeScale === 0) {
      this.setGameSpeed(this.lastNonZeroSpeed || 1.0);
    } else {
      this.setGameSpeed(0);
    }
  }

  toggleTacticalMap(forceFlag = null) {
    this.tacticalMapOpen = typeof forceFlag === 'boolean' ? forceFlag : !this.tacticalMapOpen;
    this.selectionBox = null;
    if (this.input?.mouse) {
      this.input.mouse.down = false;
      this.input.mouse.released = false;
      this.input.mouse.clicked = false;
      this.input.mouse.rightDown = false;
      this.input.mouse.rightReleased = false;
      this.input.mouse.rightClicked = false;
      this.input.mouse.isDragging = false;
    }
    this.audio.play('switch');
    this._emitHud();
  }

  addTacticalArrow(x1, y1, x2, y2, color = '#ef4444', label = 'ATAQUE') {
    if (dist(x1, y1, x2, y2) < 120) return null;
    const arrow = {
      id: `arrow_${Date.now()}_${Math.random()}`,
      x1: clamp(x1, 80, BATTLEFIELD_SIZE - 80),
      y1: clamp(y1, 80, BATTLEFIELD_SIZE - 80),
      x2: clamp(x2, 80, BATTLEFIELD_SIZE - 80),
      y2: clamp(y2, 80, BATTLEFIELD_SIZE - 80),
      color,
      label,
      createdAt: Date.now(),
    };
    this.tacticalArrows.push(arrow);
    if (this.tacticalArrows.length > 14) this.tacticalArrows.shift();
    this.audio.play('switch');
    this._emitHud();
    return arrow;
  }

  addTacticalPing(x, y, type = 'attack') {
    const meta =
      type === 'defend'
        ? { label: 'DEFENDER SETOR', color: '#38bdf8' }
        : type === 'rally'
        ? { label: 'PONTO DE REUNIÃO', color: '#a3be8c' }
        : { label: 'ALVO DE ARTILHARIA / ATAQUE', color: '#ef4444' };

    const ping = {
      id: `ping_${Date.now()}_${Math.random()}`,
      x: clamp(x, 80, BATTLEFIELD_SIZE - 80),
      y: clamp(y, 80, BATTLEFIELD_SIZE - 80),
      type,
      label: meta.label,
      color: meta.color,
      life: 18.0,
      maxLife: 18.0,
    };
    this.tacticalPings.push(ping);
    if (this.tacticalPings.length > 8) this.tacticalPings.shift();
    this.audio.play('star');
    this.spawnText(ping.x, ping.y - 24, `📍 ${meta.label}`, meta.color);
    this._emitHud();
    return ping;
  }

  clearTacticalPlan() {
    this.tacticalArrows = [];
    this.tacticalPings = [];
    this.audio.play('switch');
    this._emitHud();
  }

  // Emitir ordens diretas clicando no Mapa Tático / Mini-Mapa (ASSALTO, DEFENDER POSIÇÃO ou EM MARCHA)
  issueTacticalMapOrder(wx, wy, orderMode = 'ASSAULT') {
    const tx = clamp(wx, 100, BATTLEFIELD_SIZE - 100);
    const ty = clamp(wy, 100, BATTLEFIELD_SIZE - 100);

    // Se um prédio da base local estiver selecionado e nenhum esquadrão móvel selecionado, define Ponto de Encontro (Rally Point)
    const selectedUnits = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    if (selectedUnits.length === 0 && this.selectedBuildingId) {
      const bld = this.baseBuildings.find((b) => b.id === this.selectedBuildingId && b.team === this.myTeam && b.alive !== false);
      if (bld) {
        bld.rallyX = tx;
        bld.rallyY = ty;
        this.audio.play('pickup');
        this.spawnText(tx, ty, `🚩 PONTO DE ENCONTRO (${bld.short || 'BASE'})`, '#a3be8c');
        this.notify('PONTO DE ENCONTRO ATUALIZADO', `Tropas de ${bld.name || 'Base'} marcharão para as coordenadas marcadas.`, '#a3be8c');
        this._emitHud();
        return true;
      }
    }

    if (selectedUnits.length === 0) {
      // Se nenhuma unidade estiver selecionada, centraliza a câmera no ponto clicado
      this.camera.x = tx;
      this.camera.y = ty;
      return false;
    }

    // Verifica se clicou próximo a um Ponto de Suprimento
    const nearSector = this.map.sectors.find((s) => dist(tx, ty, s.x, s.y) <= s.radius + 220);
    const destX = nearSector ? nearSector.x : tx;
    const destY = nearSector ? nearSector.y : ty;

    const mode = orderMode === 'DEFEND' || orderMode === 'MARCH' ? orderMode : 'ASSAULT';
    const modePrefix =
      mode === 'DEFEND' ? '🛡️ Defendendo' : mode === 'MARCH' ? '🏃 Em Marcha' : '⚔️ Em Assalto';
    const targetLabel = nearSector ? `${modePrefix}: ${nearSector.shortName || nearSector.name}` : modePrefix;

    const cols = Math.ceil(Math.sqrt(selectedUnits.length));
    const spacing = 68;
    selectedUnits.forEach((u, idx) => {
      if (u.garrisonedBuildingId) this._ungarrisonUnit(u);
      u.holdPosition = false;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const ox = (col - (cols - 1) * 0.5) * spacing;
      const oy = (row - Math.floor((selectedUnits.length - 1) / cols) * 0.5) * spacing;
      const fx = clamp(destX + ox, 90, BATTLEFIELD_SIZE - 90);
      const fy = clamp(destY + oy, 90, BATTLEFIELD_SIZE - 90);
      const path =
        this.map?.buildPathAroundObstacles
          ? this.map.buildPathAroundObstacles(
              { x: u.x, y: u.y },
              { x: fx, y: fy },
              u.spec?.type === 'vehicle' ? 38 : 22,
              this.fortifiedWalls,
              this.barricades
            )
          : null;
      u.tacticalOrderMode = mode;
      u.tacticalTargetLabel = targetLabel;
      u.tacticalAttackOrder = mode === 'ASSAULT';
      u.setMoveOrder(fx, fy, null, null, path);
      // Desmarcação Automática após enviar a tropa para agilizar o comando da próxima unidade
      u.selected = false;
    });

    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendCommand({
        type: 'move',
        orderMode: mode,
        unitIds: selectedUnits.map((u) => u.id),
        targetX: destX,
        targetZ: destY,
      });
    }

    this.audio.play('pickup');
    if (nearSector) {
      this.spawnText(nearSector.x, nearSector.y - 20, `🚩 ${modePrefix.toUpperCase()} — ${nearSector.shortName || nearSector.name}`, '#7faed9');
      this.notify(
        `ORDEM TÁTICA: ${nearSector.name.toUpperCase()}`,
        `${selectedUnits.length} esquadrão(ões) enviados (${modePrefix}).`,
        '#7faed9'
      );
    } else {
      this.spawnText(destX, destY - 16, `▶ ${modePrefix.toUpperCase()}`, '#7faed9');
    }
    this._emitHud();
    return true;
  }

  repairNearestVehicleForSelected() {
    const engineers = this.units.filter(
      (u) => u.alive && u.faction === this.myFaction && u.selected && (u.spec.id === 'engineers' || u.spec.canBuild)
    );
    if (engineers.length === 0) return false;
    const ref = engineers[0];
    let bestVeh = null;
    let bestDist = Infinity;
    for (const v of this.units) {
      if (!v.alive || v.team !== this.myTeam || v.spec.type !== 'vehicle' || v.hp >= v.maxHp) continue;
      const scoreDist = dist(ref.x, ref.y, v.x, v.y) * (v.isBrokenDown ? 0.45 : 1.0);
      if (scoreDist < bestDist) {
        bestDist = scoreDist;
        bestVeh = v;
      }
    }
    if (!bestVeh) {
      this.notify('SEM VEÍCULOS DANIFICADOS', 'Todos os blindados aliados estão com 100% de integridade.', '#a3be8c');
      return false;
    }
    engineers.forEach((eng) => {
      if (eng.garrisonedBuildingId) this._ungarrisonUnit(eng);
      eng.holdPosition = false;
      const fx = clamp(bestVeh.x - 42, 90, BATTLEFIELD_SIZE - 90);
      const fy = clamp(bestVeh.y, 90, BATTLEFIELD_SIZE - 90);
      const path = this.map?.buildPathAroundObstacles
        ? this.map.buildPathAroundObstacles(
            { x: eng.x, y: eng.y },
            { x: fx, y: fy },
            22,
            this.fortifiedWalls,
            this.barricades
          )
        : null;
      eng.setMoveOrder(fx, fy, null, null, path);
    });
    this.audio.play('pickup');
    this.spawnText(bestVeh.x, bestVeh.y - 24, `🔧 ENGENHEIROS A CAMINHO`, '#38bdf8');
    this._emitHud();
    return true;
  }

  startGuidedTraining() {
    this.guidedTrainingActive = true;
    this.guidedTrainingStep = 0;
    this.guidedTrainingTimer = 0;
    this.audio.play('star');
    this._emitHud();
  }

  stopGuidedTraining() {
    this.guidedTrainingActive = false;
    this._emitHud();
  }

  startOnlineMatch({ networkManager, room, localSlot = 1 } = {}) {
    this.isMultiplayer = true;
    this.spectatorMode = false;
    this.intelRevealed = false;
    this.timeScale = 1.0;
    this.lastNonZeroSpeed = 1.0;
    this.campaignTerritory = room?.campaignTerritory || null;
    this.battlefieldScale = room?.battlefieldScale || (room?.isCampaign ? 1.8 : 1.0);
    this.networkManager = networkManager;
    this.localSlot = localSlot;
    const slotMap = {
      1: { faction: 'player', team: 'allies' },
      2: { faction: 'enemy_1', team: 'enemies' },
      3: { faction: 'ally_ai', team: 'allies' },
      4: { faction: 'enemy_2', team: 'enemies' },
    };
    const slotMeta = slotMap[localSlot] || slotMap[1];
    this.localPlayerFaction = slotMeta.faction;
    this.localPlayerTeam = slotMeta.team;
    this.mpHeartbeatTimer = 0.25;

    const mapId = room?.mapId || 'normandy_fields';
    const mapSeed = room?.mapSeed || 1944;
    const startingRes = room?.startingResources || 600;
    const isCampaign = Boolean(room?.isCampaign);
    const rawMode = room?.mode || '1v1';
    const mode = ['1v1', '2v2', '3p', '4p'].includes(rawMode) ? rawMode : '1v1';

    this.mapId = mapId;
    this.map = new BattlefieldMap({ seed: mapSeed, mapId });
    this.map.applyCornerRandomSpawns(mode, mapSeed);
    this.renderer?.buildWorld(this.map);

    this.setupMatch(mode === '2v2' || mode === '3p' || mode === '4p' ? '2v2' : '1v1', startingRes, mapId, 'medium', {
      isOnline: true,
      mapSeed,
    });
    if (mode === '3p') {
      this.baseBuildings = this.baseBuildings.filter((b) => b.faction !== 'enemy_2');
    }
    this.isMultiplayer = true;
    this.spectatorMode = false;
    this.intelRevealed = false;
    this.timeScale = 1.0;
    this.lastNonZeroSpeed = 1.0;
    this.campaignTerritory = room?.campaignTerritory || null;
    this.campaignOwnedTerritoriesCount = Number(room?.campaignOwnedCount ?? 1);
    this.battlefieldScale = room?.battlefieldScale || (room?.isCampaign ? 1.8 : 1.0);
    this.isCampaign = isCampaign;
    this.campaignDay = room?.campaignDay || 1;
    // Em batalhas da Guerra de 15 Dias, reduz para 4 pontos estratégicos (1 central + 3 recursos) para combates ágeis
    if (isCampaign && Array.isArray(this.map?.sectors) && this.map.sectors.length > 4) {
      const centerSec =
        this.map.sectors.find((s) => s.id?.includes('center')) || this.map.sectors[0];
      const supSec = this.map.sectors.find((s) => s !== centerSec && s.type === 'supplies');
      const ammoSec = this.map.sectors.find((s) => s !== centerSec && s.type === 'ammo');
      const fuelSec = this.map.sectors.find((s) => s !== centerSec && s.type === 'fuel');
      const compact = [centerSec, supSec, ammoSec, fuelSec].filter(Boolean);
      this.map.sectors = compact.length >= 3 ? compact : this.map.sectors.slice(0, 4);
    }
    this.networkManager = networkManager;
    this.localSlot = localSlot;
    this.localPlayerFaction = slotMeta.faction;
    this.localPlayerTeam = slotMeta.team;
    this.onlineBotFactions = new Set();
    for (const [sKey, botInfo] of Object.entries(room?.bots || {})) {
      const sNum = Number(sKey);
      if (botInfo && !room?.slots?.[sNum] && slotMap[sNum]) {
        this.onlineBotFactions.add(slotMap[sNum].faction);
      }
    }
    const localHq = this.map.hqs?.[this.localPlayerFaction];
    if (localHq) {
      this.camera.x = clamp(localHq.x, 420, BATTLEFIELD_SIZE - 420);
      this.camera.y = clamp(localHq.y, 420, BATTLEFIELD_SIZE - 420);
    }
    if (this.map) {
      this.map.visionTeam = this.localPlayerTeam;
      this.map.resetFog();
      this.map.updateFogOfWar(
        this.units,
        this.baseBuildings.filter((b) => b.alive !== false),
        0.05,
        this.localPlayerTeam
      );
    }

    // Aplicação Automática dos Pacotes & Loadout Multiplayer (1v1, 2v2, 3P, 4P e Campanha)
    if (networkManager) {
      const packs = networkManager.getActiveCampaignPacks?.() || [];
      const hq = this.map?.hqs?.[this.localPlayerFaction] || this.map?.hqs?.player || { x: 1150, y: 4280 };
      const hqBld = this.baseBuildings.find((b) => b.faction === this.localPlayerFaction && b.isMainHQ);

      if (
        packs.includes('hq_fortification_kit') ||
        packs.includes('hq_defense') ||
        packs.includes('supreme_commander_combo') ||
        packs.includes('vip_combo')
      ) {
        const isSupreme = packs.includes('supreme_commander_combo') || packs.includes('vip_combo');
        const wx1 = hq.x - 165;
        const wx2 = hq.x + 215;
        const wy1 = hq.y - 195;
        const wy2 = hq.y + 195;
        this.fortifiedWalls.push(
          new FortifiedWallLine({ x1: wx2, y1: wy1, x2: wx2, y2: wy2, team: this.localPlayerTeam, isGate: true, isElite: isSupreme }),
          new FortifiedWallLine({ x1: wx1, y1: wy2, x2: wx2, y2: wy2, team: this.localPlayerTeam, isGate: true, isElite: isSupreme }),
          new FortifiedWallLine({ x1: wx1, y1: wy1, x2: wx2, y2: wy1, team: this.localPlayerTeam, isGate: false, isElite: isSupreme }),
          new FortifiedWallLine({ x1: wx1, y1: wy1, x2: wx1, y2: wy2, team: this.localPlayerTeam, isGate: false, isElite: isSupreme })
        );
        this.spawnUnit(this.localPlayerFaction, 'concrete_bunker', wx2 + 28, hq.y - 120, 0);
        this.barricades.push(
          new BarricadeLine({ x1: wx2 + 58, y1: hq.y - 110, x2: wx2 + 58, y2: hq.y + 110, team: this.localPlayerTeam })
        );
        if (hqBld) {
          hqBld.maxHp += 400;
          hqBld.hp += 400;
        }
      }
      if (
        packs.includes('xp_boost_mp') ||
        packs.includes('xp_boost') ||
        packs.includes('supreme_commander_combo') ||
        packs.includes('vip_combo')
      ) {
        this.xpMultiplier = 2.0;
      }
      if (packs.includes('paratroopers_elite') || packs.includes('supreme_commander_combo')) {
        this.unlockedParatroopers = true;
      }
      if (
        packs.includes('visual_arsenal') ||
        packs.includes('supreme_commander_combo') ||
        packs.includes('vip_combo')
      ) {
        this.hasGoldCommanderFlag = true;
      }
      if (isCampaign && (packs.includes('supreme_commander_combo') || packs.includes('vip_combo'))) {
        this.supplies += 250;
        this.ammo += 100;
        this.fuel += 100;
      }
    }

    // Câmera inicial focada no QG do jogador local
    const myHqFocus = this.map.hqs?.[this.localPlayerFaction || 'player'];
    if (myHqFocus) {
      this.camera.x = clamp(myHqFocus.x, 420, BATTLEFIELD_SIZE - 420);
      this.camera.y = clamp(myHqFocus.y, 420, BATTLEFIELD_SIZE - 420);
    }

    // Assina ordens remotas e heartbeat de estado (a cada 1.5s)
    this._mpUnsubCmd?.();
    this._mpUnsubState?.();
    if (networkManager) {
      this._mpUnsubCmd = networkManager.onCommand((cmd) => this._handleRemoteCommand(cmd));
      this._mpUnsubState = networkManager.onStateHeartbeat((state) =>
        this._applyRemoteStateHeartbeat(state)
      );
    }

    this.notify(
      '🌐 BATALHA ONLINE INICIADA',
      localSlot === 2
        ? 'Você comanda o EIXO (Base Norte/Leste).'
        : 'Você comanda os ALIADOS (Base Sul/Oeste).',
      '#c28e38'
    );
    this._emitHud();
  }

  _handleRemoteCommand(cmd) {
    if (!cmd) return;
    const effectiveSlot = cmd.overrideSlot || cmd.slot;
    if (effectiveSlot === this.localSlot && !cmd.overrideSlot) return;
    const slotFactionMap = { 1: 'player', 2: 'enemy_1', 3: 'ally_ai', 4: 'enemy_2' };
    const remoteFaction = slotFactionMap[effectiveSlot] || 'enemy_1';
    if (remoteFaction === this.myFaction) return;
    const remoteTeam = remoteFaction === 'player' || remoteFaction === 'ally_ai' ? 'allies' : 'enemies';
    const matchingUnits = Array.isArray(cmd.unitIds)
      ? this.units.filter((u) => u.alive && u.faction === remoteFaction && cmd.unitIds.includes(u.id))
      : this.units.filter((u) => u.alive && u.faction === remoteFaction).slice(0, 2);

    if (cmd.type === 'move' && typeof cmd.targetX === 'number' && typeof cmd.targetZ === 'number') {
      matchingUnits.forEach((u) => {
        const path = this.map?.buildPathAroundObstacles(
          { x: u.x, y: u.y },
          { x: cmd.targetX, y: cmd.targetZ },
          u.spec?.type === 'vehicle' ? 38 : 22,
          this.fortifiedWalls,
          this.barricades
        );
        u.setMoveOrder(cmd.targetX, cmd.targetZ, null, null, path);
      });
    } else if (cmd.type === 'garrison' && cmd.structureId) {
      const st = this.map?.structures?.find((s) => s.id === cmd.structureId && !s.destroyed);
      if (st && matchingUnits[0]) {
        matchingUnits[0].setGarrisonOrder(st);
      }
    } else if (cmd.type === 'produce' && cmd.unitType) {
      const hq = this.map?.hqs?.[remoteFaction];
      if (hq) {
        const offX = remoteTeam === 'enemies' ? -140 : 140;
        const u = this.spawnUnit(remoteFaction, cmd.unitType, hq.x + offX, hq.y + 80, remoteTeam === 'enemies' ? Math.PI : 0);
        if (u && typeof cmd.targetX === 'number' && typeof cmd.targetY === 'number') {
          u.setMoveOrder(cmd.targetX, cmd.targetY);
        }
      }
    } else if (cmd.type === 'build_base' && cmd.buildingId) {
      const spec = BASE_BUILDING_BY_ID[cmd.buildingId];
      if (spec) {
        this.baseBuildings.push({
          id: `${remoteFaction}_base_${cmd.buildingId}_${Date.now()}`,
          buildingType: cmd.buildingId,
          name: spec.name,
          short: spec.short,
          subtitle: spec.subtitle,
          team: remoteTeam,
          faction: remoteFaction,
          x: cmd.x,
          y: cmd.y,
          sightRadius: spec.sightRadius || 620,
          hp: spec.maxHp || 1500,
          maxHp: spec.maxHp || 1500,
          radius: spec.radius || 84,
          rallyX: cmd.x + (remoteTeam === 'enemies' ? -560 : 560),
          rallyY: cmd.y,
          produces: [...(spec.produces || [])],
          productionQueue: [],
          productionProgress: 0,
          alive: true,
        });
        this.map.syncAllColliders?.(this.baseBuildings);
      }
    }
  }

  _applyRemoteStateHeartbeat(state) {
    if (!state || this.localSlot === 1) return;
    if (Array.isArray(state.sectors)) {
      for (const rs of state.sectors) {
        const localSec = this.map?.sectors?.find((s) => s.id === rs.id);
        if (localSec) {
          localSec.owner = rs.owner;
          localSec.captureProgress = rs.captureProgress;
        }
      }
    }
    if (Array.isArray(state.units)) {
      for (const ru of state.units) {
        const lu = this.units.find((u) => u.id === ru.id);
        if (lu) {
          lu.hp = ru.hp;
          if (!lu.selected) {
            lu.networkTargetPos = {
              x: ru.x,
              z: ru.y,
              rotY: typeof ru.angle === 'number' ? ru.angle : lu.angle,
            };
          }
        }
      }
    }
  }

  startAssaultSandboxDrill() {
    if (!this.sandboxMode) {
      this.toggleSandboxMode(true);
    }
    const baseX = clamp(this.camera?.x || 2200, 1200, BATTLEFIELD_SIZE - 1400);
    const baseY = clamp(this.camera?.y || 4800, 1200, BATTLEFIELD_SIZE - 1200);

    // Entrega 1 Fuzileiros + 1 Assalto + 1 APC Stryker prontos para manobra
    this.spawnUnit('player', 'rifle_squad', baseX - 110, baseY + 55, 0);
    this.spawnUnit('player', 'assault_squad', baseX - 110, baseY - 55, 0);
    this.spawnUnit('player', 'apc_stryker', baseX - 175, baseY, 0);

    // Cenário prático à frente: trincheira/casa inimiga guarnecida ou defendida
    const targetX = clamp(baseX + 360, 1200, BATTLEFIELD_SIZE - 900);
    const targetY = baseY;
    const nearStruct = this.map?.structures?.find(
      (st) => !st.destroyed && st.garrisonable && !st.garrisonUnitId && dist(st.x, st.y, targetX, targetY) < 900
    );
    if (nearStruct) {
      const def = this.spawnUnit('enemy_1', 'rifle_squad', nearStruct.x, nearStruct.y, Math.PI);
      if (def) {
        def.garrisonedBuildingId = nearStruct.id;
        def.garrisonedBuilding = nearStruct;
        nearStruct.garrisonUnitId = def.id;
        nearStruct.garrisonTeam = 'enemies';
        nearStruct.garrisonedSquad = def;
      }
    } else {
      const def = this.spawnUnit('enemy_1', 'rifle_squad', targetX, targetY, Math.PI);
      if (def) def.holdPosition = true;
    }

    this.camera.x = baseX + 120;
    this.camera.y = baseY;
    this.audio.play('star');
    this.notify(
      '🎯 CENÁRIO DE ASSALTO PRONTO!',
      'Use Fuzileiros [F] para suprimir, Assalto [G] para flanquear e o APC [U] para desembarcar!',
      '#c28e38'
    );
    this._emitHud();
  }

  _getGuidedTrainingTip() {
    if (!this.guidedTrainingActive) return null;
    const tips = [
      { step: 1, title: 'PASSO 1/5 • Seleção & Mapa Tático [TAB]', text: 'Selecione seus Fuzileiros ou pressione [TAB] para abrir o Quadro Tático. Escolha ⚔️ ASSALTO e clique em um Setor de Recurso.' },
      { step: 2, title: 'PASSO 2/5 • Economia & Setores', text: 'Envie tropas até as bandeiras com sacos de areia para capturar +SUP, +MUN e +COMB. Evolua seu QG até Nível 3.' },
      { step: 3, title: 'PASSO 3/5 • Cobertura & Florestas', text: 'Use trincheiras escavadas (+65% Defesa) e florestas (+35% Dano de Emboscada). Pressione [G] para lançar granadas e [F] para supressão.' },
      { step: 4, title: 'PASSO 4/5 • Blindados & Engenheiros', text: 'Veículos com <= 30% HP entram em pane mecânica! Envie Engenheiros ou clique em [🔧 Consertar Veículo Mais Próximo].' },
      { step: 5, title: 'PASSO 5/5 • Comandantes & Interrogatório', text: 'Construa o Campo de Prisioneiros (POW). Quando um Comandante Inimigo (★) se render, clique nele para capturar e interrogar.' },
    ];
    return tips[Math.min(tips.length - 1, this.guidedTrainingStep || 0)];
  }

  setupMatch(
    mode = '1v1',
    startingResources = this.startingResourcesPreset,
    mapId = this.mapId,
    aiDifficulty = this.aiDifficulty,
    options = {}
  ) {
    const isOnline = Boolean(options?.isOnline);
    this.gameMode = mode === '2v2' ? '2v2' : '1v1';
    if (aiDifficulty === 'easy' || aiDifficulty === 'medium' || aiDifficulty === 'hard') {
      this.aiDifficulty = aiDifficulty;
    }
    this.hqLevel = 1;
    this.commandPoints = 0;
    this.aiHqLevels = { ally_ai: 1, enemy_1: 1, enemy_2: 1 };
    if (typeof startingResources === 'number' && startingResources > 0) {
      this.startingResourcesPreset = startingResources;
    }
    const nextMapId = mapId || 'normandy_fields';
    if (nextMapId !== this.mapId || !this.map) {
      this.mapId = nextMapId;
      this.map = new BattlefieldMap({ seed: 1944, mapId: this.mapId });
      this.renderer?.buildWorld(this.map);
    }

    this.units = [];
    if (typeof window !== 'undefined') window.__frontlineGame = this;
    this.trenches = [];
    this.barricades = [];
    this.fortifiedWalls = [];
    this.guidedTrainingActive = false;
    this.guidedTrainingStep = 0;
    this.guidedTrainingTimer = 0;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('frontline_start_guided') === '1') {
        localStorage.removeItem('frontline_start_guided');
        this.guidedTrainingActive = true;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('frontline_assault_drill') === '1') {
        localStorage.removeItem('frontline_assault_drill');
        setTimeout(() => this.startAssaultSandboxDrill(), 220);
      }
    } catch {
      // noop
    }
    this.barbedWires = [];
    this.mines = [];
    this.baseBuildings = [];
    this.aircrafts = [];
    this.bullets = [];
    this.pendingGrenades = [];
    this.repairSparkTimer = 0;
    this.particles = [];
    this.texts = [];
    this.selectedBuildingId = null;
    this.selectedStructureId = null;
    this.victoryPoints = 0;
    this.tacticalMapOpen = false;
    this.tacticalArrows = [];
    this.tacticalPings = [];
    this.intelRevealed = false;
    this.spectatorMode = false;
    this.directorCamActive = false;
    this.spectatorHudHidden = false;
    this.activeDirectorSceneId = null;
    this.timeOfDay = 'day';
    this.cinematicLowCam = false;
    this._directorTarget = { x: 4800, y: 4800 };
    this._directorSwitchTimer = 0;
    this.sandboxMode = false;
    this.sandboxFogDisabled = false;
    this.sandboxAiPaused = false;
    this.powPrisoners = [];
    this.enemyProductionDebuffTimer = 0;
    this.enemySabotageTimer = 0;
    this.victoryState = null;
    this.gameOver = false;
    this.techModalOpen = false;
    this.selectedBudgetTier = 0.25;
    this.completedTechs = new Set();
    this.activeResearch = null;
    this.activeDrones = [];
    this.activeDroneLaunchMode = null;
    this.droneStock = { uav_recon: 0, fpv_kamikaze: 0 };
    this.droneQueue = [];
    this.radioInterceptTimer = 0;
    this.hoverPathPreview = null;
    this.matchStats = {
      elapsedSeconds: 0,
      unitsEliminated: 0,
      prisonersInterrogated: 0,
      trenchesDug: 0,
      researchesCompleted: 0,
    };
    this.activeCommandMode = null;
    this.activeAirStrikeMode = null;
    this.trenchPreview = null;
    this.orientationPreview = null;
    this.rightOrderStartWorld = null;
    this.selectionBox = null;
    this.timeScale = 1.0;

    this.airCooldowns = {
      recon_drone: 0,
      a10_strafe: 0,
      precision_bomb: 0,
    };

    const initSup = this.startingResourcesPreset || 600;
    this.supplies = initSup;
    this.ammo = initSup >= 1000 ? 240 : initSup <= 450 ? 90 : 140;
    this.fuel = initSup >= 1000 ? 180 : initSup <= 450 ? 60 : 95;
    this.allyAiSupplies = initSup;
    this.enemySupplies = { enemy_1: initSup, enemy_2: initSup };
    this.supplyIncomeTimer = 6.0;
    this.aiWaveTimer = 38.0; // Primeira onda de reforço inimigo após 38s

    // Reseta Névoa de Guerra Real (0 = Inexplorado, 1 = Shroud, 2 = Visão Ativa)
    this.map.resetFog();

    for (const sec of this.map.sectors) {
      sec.owner = sec.initialOwner || 'neutral';
      sec.captureProgress = sec.owner === 'allies' ? 100 : sec.owner === 'enemies' ? -100 : 0;
    }
    for (const st of this.map.structures) {
      st.garrisonUnitId = null;
      st.garrisonTeam = null;
    }

    // Câmera inicial focada na linha de frente aliada no mapa expandido 9600x9600
    this.camera.x = 2400;
    this.camera.y = 4800;
    this.camera.zoom = 660;

    // 1. Trincheiras, Barricadas e Minas Iniciais (apenas fora do modo Online limpo)
    if (!isOnline) {
      this.trenches.push(
        new TrenchSegment({
          points: [
            { x: 3500, y: 4260 },
            { x: 3545, y: 4380 },
            { x: 3495, y: 4490 },
          ],
          team: 'allies',
          revealed: true,
        }),
        new TrenchSegment({
          points: [
            { x: 3520, y: 5060 },
            { x: 3570, y: 5180 },
            { x: 3520, y: 5300 },
          ],
          team: 'allies',
          revealed: true,
        }),
        new TrenchSegment({
          points: [
            { x: 6040, y: 4260 },
            { x: 6090, y: 4380 },
            { x: 6040, y: 4500 },
            { x: 6180, y: 4500 },
          ],
          team: 'enemies',
          isLShape: true,
          revealed: false,
        }),
        new TrenchSegment({
          points: [
            { x: 6060, y: 2020 },
            { x: 6100, y: 2160 },
            { x: 6060, y: 2300 },
          ],
          team: 'enemies',
          revealed: false,
        }),
        new TrenchSegment({
          points: [
            { x: 6060, y: 7260 },
            { x: 6100, y: 7400 },
            { x: 6060, y: 7540 },
          ],
          team: 'enemies',
          revealed: false,
        })
      );
      if (Array.isArray(this.map.customTrenches)) {
        for (const ct of this.map.customTrenches) {
          if (Array.isArray(ct.points) && ct.points.length >= 2) {
            this.trenches.push(
              new TrenchSegment({
                points: ct.points,
                team: 'allies',
                revealed: true,
                openStart: Boolean(ct.openStart),
                openEnd: Boolean(ct.openEnd),
              })
            );
          }
        }
      }

      // 2. Barricadas Iniciais de Dentes de Dragão e Arame Farpado (fora das trincheiras)
      this.barricades.push(
        new BarricadeLine({ x1: 3860, y1: 4680, x2: 3860, y2: 4820, team: 'allies' }),
        new BarricadeLine({ x1: 5760, y1: 4920, x2: 5760, y2: 5060, team: 'enemies' })
      );

      this.barbedWires.push(
        new BarbedWireLine({ x1: 3720, y1: 4280, x2: 3720, y2: 4460, team: 'allies' }),
        new BarbedWireLine({ x1: 5880, y1: 4280, x2: 5880, y2: 4480, team: 'enemies' })
      );

      // 3. Campos Minados Ocultos do Inimigo (invisíveis na Névoa de Guerra até batedor/drone/interrogatório)
      const enemyMineSpots = [
        { x: 5520, y: 4680 },
        { x: 5560, y: 4780 },
        { x: 5520, y: 4900 },
        { x: 5640, y: 2080 },
        { x: 5680, y: 2180 },
        { x: 5640, y: 7340 },
        { x: 5680, y: 7440 },
      ];
      for (const mp of enemyMineSpots) {
        this.mines.push(
          new Landmine({
            x: mp.x,
            y: mp.y,
            team: 'enemies',
            faction: 'enemy_1',
            revealed: false,
          })
        );
      }
    }

    // 4. Estruturas de Base Militar 3D (Interativas, Selecionáveis e Destrutíveis com HP e Ponto de Encontro)
    const playerHqPos = this.map.hqs.player;
    const centerPos = BATTLEFIELD_SIZE * 0.5;
    const rallyOffset = (pos, distOff = 440) => {
      const dx = centerPos - pos.x;
      const dy = centerPos - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: clamp(pos.x + (dx / len) * distOff, 320, BATTLEFIELD_SIZE - 320),
        y: clamp(pos.y + (dy / len) * distOff, 320, BATTLEFIELD_SIZE - 320),
      };
    };
    const pRally = rallyOffset(playerHqPos, 480);
    this.baseBuildings.push({
      id: 'ally_main_hq',
      buildingType: 'hq_command',
      name: HQ_BUILDING_SPEC.name,
      short: HQ_BUILDING_SPEC.short,
      subtitle: HQ_BUILDING_SPEC.subtitle,
      team: 'allies',
      faction: 'player',
      x: playerHqPos.x,
      y: playerHqPos.y,
      sightRadius: HQ_BUILDING_SPEC.sightRadius,
      hp: HQ_BUILDING_SPEC.maxHp,
      maxHp: HQ_BUILDING_SPEC.maxHp,
      radius: HQ_BUILDING_SPEC.radius,
      rallyX: pRally.x,
      rallyY: pRally.y,
      produces: [...HQ_BUILDING_SPEC.produces],
      productionQueue: [],
      productionProgress: 0,
      isMainHQ: true,
      alive: true,
    });

    const enemy1HqPos = this.map.hqs.enemy_1;
    const e1Rally = rallyOffset(enemy1HqPos, 480);
    this.baseBuildings.push({
      id: 'enemy_1_main_hq',
      buildingType: 'hq_command',
      name: 'QG Central Inimigo',
      short: 'QG Inimigo',
      subtitle: 'Centro de Comando da 1ª Divisão Inimiga',
      team: 'enemies',
      faction: 'enemy_1',
      x: enemy1HqPos.x,
      y: enemy1HqPos.y,
      sightRadius: HQ_BUILDING_SPEC.sightRadius,
      hp: HQ_BUILDING_SPEC.maxHp,
      maxHp: HQ_BUILDING_SPEC.maxHp,
      radius: HQ_BUILDING_SPEC.radius,
      rallyX: e1Rally.x,
      rallyY: e1Rally.y,
      produces: [...HQ_BUILDING_SPEC.produces],
      productionQueue: [],
      productionProgress: 0,
      isMainHQ: true,
      alive: true,
    });

    if (!isOnline) {
      const specOpsSpec = BASE_BUILDING_BY_ID.spec_ops_center;
      const motorPoolSpec = BASE_BUILDING_BY_ID.motor_pool;

      this.baseBuildings.push({
        id: 'enemy_base_spec_ops',
        buildingType: 'spec_ops_center',
        name: 'Quartel de Op. Especiais Inimigo',
        short: 'Quartel Inimigo',
        subtitle: specOpsSpec.subtitle,
        team: 'enemies',
        faction: 'enemy_1',
        x: 8220,
        y: 4460,
        sightRadius: 520,
        hp: specOpsSpec.maxHp || 1450,
        maxHp: specOpsSpec.maxHp || 1450,
        radius: specOpsSpec.radius || 82,
        rallyX: 7780,
        rallyY: 4460,
        produces: [...(specOpsSpec.produces || [])],
        productionQueue: [],
        productionProgress: 0,
        alive: true,
      });
      this.baseBuildings.push({
        id: 'enemy_base_motor_pool',
        buildingType: 'motor_pool',
        name: 'Arsenal Blindado Inimigo',
        short: 'Fábrica Inimiga',
        subtitle: motorPoolSpec.subtitle,
        team: 'enemies',
        faction: 'enemy_1',
        x: 8220,
        y: 5140,
        sightRadius: 520,
        hp: motorPoolSpec.maxHp || 1700,
        maxHp: motorPoolSpec.maxHp || 1700,
        radius: motorPoolSpec.radius || 88,
        rallyX: 7780,
        rallyY: 5140,
        produces: [...(motorPoolSpec.produces || [])],
        productionQueue: [],
        productionProgress: 0,
        alive: true,
      });

      // Guaritas Blindadas (Watchtowers) protegendo a entrada da base inimiga
      this.spawnUnit('enemy_1', 'watchtower_emplacement', 7820, 4560, Math.PI);
      this.spawnUnit('enemy_1', 'watchtower_emplacement', 7820, 5040, Math.PI);

      // 5. Tropas Iniciais do Jogador (1ª Divisão Aliada)
      const p1 = this.spawnUnit('player', 'rifle_squad', 3540, 4760, 0);
      p1.inTrench = true;
      p1.inTrenchId = this.trenches[0].id;

      const p2 = this.spawnUnit('player', 'assault_squad', 2160, 4820, 0);
      const p3 = this.spawnUnit('player', 'humvee', 1840, 4980, 0);
      p1.selected = true;
      p2.selected = true;

      // 6. Tropas Iniciais do Exército Inimigo 1 (ocultas na Névoa de Guerra)
      const e1 = this.spawnUnit('enemy_1', 'rifle_squad', 6060, 4720, Math.PI);
      e1.inTrench = true;
      e1.inTrenchId = this.trenches[2].id;
      this.spawnUnit('enemy_1', 'assault_squad', 6840, 4860, Math.PI);
      this.spawnUnit('enemy_1', 'humvee', 7260, 4640, Math.PI);
      this.spawnUnit('enemy_1', 'command_officer', 6580, 4520, Math.PI);
    }
    this.map.syncAllColliders?.(this.baseBuildings);

    // 7. Modo 2 vs 2: Adiciona IA Aliada + 2º Exército Inimigo + QGs secundários
    if (this.gameMode === '2v2') {
      const allyAiHqPos = this.map.hqs.ally_ai;
      const enemy2HqPos = this.map.hqs.enemy_2;
      const aRally = rallyOffset(allyAiHqPos, 460);
      const e2Rally = rallyOffset(enemy2HqPos, 460);
      this.baseBuildings.push(
        {
          id: 'ally_ai_main_hq',
          buildingType: 'hq_command',
          name: 'QG 2ª Divisão Aliada',
          short: 'QG Aliado (IA)',
          subtitle: 'Centro de Comando da 2ª Divisão Aliada',
          team: 'allies',
          faction: 'ally_ai',
          x: allyAiHqPos.x,
          y: allyAiHqPos.y,
          sightRadius: 720,
          hp: 2600,
          maxHp: 2600,
          radius: 120,
          rallyX: aRally.x,
          rallyY: aRally.y,
          produces: [...HQ_BUILDING_SPEC.produces],
          productionQueue: [],
          productionProgress: 0,
          isMainHQ: true,
          alive: true,
        },
        {
          id: 'enemy_2_main_hq',
          buildingType: 'hq_command',
          name: 'QG 2º Exército Inimigo',
          short: 'QG Inimigo 2',
          subtitle: 'Centro de Comando do 2º Exército Inimigo',
          team: 'enemies',
          faction: 'enemy_2',
          x: enemy2HqPos.x,
          y: enemy2HqPos.y,
          sightRadius: 720,
          hp: 2600,
          maxHp: 2600,
          radius: 120,
          rallyX: e2Rally.x,
          rallyY: e2Rally.y,
          produces: [...HQ_BUILDING_SPEC.produces],
          productionQueue: [],
          productionProgress: 0,
          isMainHQ: true,
          alive: true,
        }
      );

      if (!isOnline) {
        const a1 = this.spawnUnit('ally_ai', 'rifle_squad', 1850, 7320, 0);
        const a2 = this.spawnUnit('ally_ai', 'assault_squad', 1960, 7480, 0);
        const a3 = this.spawnUnit('ally_ai', 'humvee', 1650, 7400, 0);
        a1.setMoveOrder(3600, 7400);
        a2.setMoveOrder(3720, 7520);
        a3.setMoveOrder(3440, 7320);

        const e2_1 = this.spawnUnit('enemy_2', 'rifle_squad', 6060, 2140, Math.PI);
        e2_1.inTrench = true;
        e2_1.inTrenchId = this.trenches[3].id;
        this.spawnUnit('enemy_2', 'assault_squad', 6920, 2220, Math.PI);
        this.spawnUnit('enemy_2', 'humvee', 7360, 2400, Math.PI);
      }
    }

    // Atualiza Névoa de Guerra e Linha de Frente inicial
    this.map.updateFogOfWar(this.units, this.baseBuildings, 0.1);
    this.map.updateFrontline(this.units, 1.0);
    this.notify(
      `OPERAÇÃO ${this.gameMode.toUpperCase()} — NÉVOA DE GUERRA ATIVA`,
      'Clique nos Prédios da Base p/ produzir tropas • [TAB] abre o Quadro de Planejamento Tático',
      '#c87d28'
    );
    this._emitHud();
  }

  spawnUnit(faction, unitType, x, y, angle = 0) {
    const u = new SquadUnit({ x, y, faction, unitType, angle });
    this.units.push(u);
    return u;
  }

  selectBaseBuilding(buildingId) {
    const bld = this.baseBuildings.find((b) => b.id === buildingId && b.faction === this.myFaction && b.alive !== false);
    if (!bld) {
      this.selectedBuildingId = null;
    this.selectedStructureId = null;
      this._emitHud();
      return false;
    }
    for (const u of this.units) u.selected = false;
    this.selectedBuildingId = bld.id;
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  // Enfileira produção de unidade diretamente em um Prédio da Base (com barra de progresso e Ponto de Encontro)
  queueUnitAtBuilding(buildingId, unitId) {
    const bld =
      this.baseBuildings.find((b) => b.id === buildingId && b.faction === this.myFaction && b.alive !== false) ||
      this.baseBuildings.find(
        (b) =>
          b.faction === this.myFaction &&
          b.alive !== false &&
          b.produces &&
          b.produces.includes(unitId)
      );
    const cmd = COMMAND_BY_ID[unitId];
    if (!bld || !cmd) return false;
    this.audio.resume();

    if ((cmd.requiredHqLevel || 1) > this.hqLevel) {
      this.notify(
        `🔒 REQUER QG NÍVEL ${cmd.requiredHqLevel}`,
        `${cmd.short} exige evoluir o Quartel-General para o Nível ${cmd.requiredHqLevel}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    const supCost = cmd.cost || 0;
    const ammoCost = cmd.ammoCost || 0;
    const fuelCost = cmd.fuelCost || 0;

    if (this.supplies < supCost || this.ammo < ammoCost || this.fuel < fuelCost) {
      this.notify(
        'RECURSOS INSUFICIENTES',
        `Necessário ${supCost} SUP${ammoCost ? `, ${ammoCost} MUN` : ''}${fuelCost ? `, ${fuelCost} COMB` : ''}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    if ((bld.productionQueue?.length || 0) >= 5) {
      this.notify('FILA DE PRODUÇÃO CHEIA', 'Aguarde as unidades atuais saírem da instalação.', '#d4a338');
      this.audio.play('empty');
      return false;
    }

    this.supplies -= supCost;
    this.ammo -= ammoCost;
    this.fuel -= fuelCost;

    if (!bld.productionQueue) bld.productionQueue = [];
    bld.productionQueue.push({
      unitId: cmd.id,
      name: cmd.name,
      short: cmd.short,
      duration: this.sandboxMode ? 0.05 : cmd.buildTime || 5.5,
      elapsed: 0,
    });

    this.audio.play('cash');
    this.spawnText(bld.x, bld.y - 32, `⚙ PRODUZINDO: ${cmd.short.toUpperCase()}`, '#7faed9');
    this._emitHud();
    return true;
  }

  cancelBuildingQueueItem(buildingId, queueIdx) {
    const bld = this.baseBuildings.find(
      (b) => b.id === buildingId && b.faction === this.myFaction && b.alive !== false
    );
    if (!bld || !Array.isArray(bld.productionQueue) || queueIdx < 0 || queueIdx >= bld.productionQueue.length) {
      return false;
    }
    const [removed] = bld.productionQueue.splice(queueIdx, 1);
    const cmd = COMMAND_BY_ID[removed.unitId];
    if (cmd) {
      this.supplies += cmd.cost || 0;
      this.ammo += cmd.ammoCost || 0;
      this.fuel += cmd.fuelCost || 0;
    }
    if (queueIdx === 0) {
      bld.productionProgress = 0;
    }
    this.audio.play('switch');
    this.notify('PRODUÇÃO CANCELADA', `${removed.short || removed.name} cancelado (100% reembolsado).`, '#c28e38');
    this._emitHud();
    return true;
  }

  _updateBuildingProduction(dt) {
    for (const bld of this.baseBuildings) {
      if (bld.alive === false || !bld.productionQueue || bld.productionQueue.length === 0) {
        bld.productionProgress = 0;
        continue;
      }
      const current = bld.productionQueue[0];
      current.elapsed += dt;
      bld.productionProgress = clamp((current.elapsed / current.duration) * 100, 0, 100);

      if (current.elapsed >= current.duration) {
        bld.productionQueue.shift();
        bld.productionProgress = 0;

        const cmd = COMMAND_BY_ID[current.unitId];
        const jitterX = randInt(-36, 36);
        const jitterY = randInt(-65, 65);
        const spawnX = clamp(bld.x + 135 + jitterX, 100, BATTLEFIELD_SIZE - 100);
        const spawnY = clamp(bld.y + jitterY, 100, BATTLEFIELD_SIZE - 100);
        const u = this.spawnUnit(bld.faction || 'player', current.unitId, spawnX, spawnY, 0);

        const rallyX = clamp((bld.rallyX || bld.x + 520) + jitterX, 120, BATTLEFIELD_SIZE - 120);
        const rallyY = clamp((bld.rallyY || bld.y) + jitterY, 120, BATTLEFIELD_SIZE - 120);
        u.setMoveOrder(rallyX, rallyY);

        this.audio.play('pickup');
        this.spawnText(u.x, u.y - 18, `✅ ${cmd ? cmd.short : current.short} PRONTO!`, '#a3be8c');
        this.notify(
          `${(cmd ? cmd.name : current.name).toUpperCase()} PRONTO!`,
          `Unidade saiu de ${bld.short || 'Base'} marchando para o Ponto de Encontro.`,
          '#a3be8c'
        );
        this._emitHud();
      }
    }
  }

  // Aplica dano a prédios de Base Militar e concede Pontos de Vitória + Recursos ao destruir instalações inimigas
  damageBaseBuilding(bld, amount, attackerTeam) {
    if (!bld || bld.alive === false) return;
    bld.hp = Math.max(0, (bld.hp || 1500) - amount);

    if (bld.hp <= 0) {
      bld.alive = false;
      bld.productionQueue = [];
      bld.productionProgress = 0;
      if (this.selectedBuildingId === bld.id) {
        this.selectedBuildingId = null;
    this.selectedStructureId = null;
      }

      this.spawnExplosionParticles(bld.x, bld.y, 55);
      this.spawnExplosionParticles(bld.x + 45, bld.y - 35, 35);
      this.spawnExplosionParticles(bld.x - 45, bld.y + 35, 35);
      this.playSoundAt('explosion', bld.x, bld.y, 1.0);
      this.camera.shake(26, 0.55);

      // Adiciona cratera de escombros fumegantes
      this.map.wrecks.push({
        id: `wreck_bld_${bld.id}`,
        type: 'DestroyedTank',
        x: bld.x,
        y: bld.y,
        angle: 0.4,
        coverRadius: 56,
        smoke: true,
      });

      if (bld.team === 'enemies' && attackerTeam === 'allies') {
        const ptsBonus = bld.isMainHQ ? 500 : 250;
        const supBonus = bld.isMainHQ ? 450 : 250;
        const ammoBonus = bld.isMainHQ ? 160 : 100;
        const fuelBonus = bld.isMainHQ ? 110 : 50;

        this.victoryPoints += ptsBonus;
        this.supplies += supBonus;
        this.ammo += ammoBonus;
        this.fuel += fuelBonus;
        this.addCommandPoints(100, 'Estrutura Destruída');

        this.audio.play('win');
        this.spawnText(
          bld.x,
          bld.y - 36,
          `💥 BASE DESTRUÍDA! +${ptsBonus} PTS • +${supBonus} SUP / +${ammoBonus} MUN / +${fuelBonus} COMB`,
          '#d4a338'
        );

        const anyEnemyMainHQLeft = this.baseBuildings.some(
          (other) => other.team === 'enemies' && other.isMainHQ && other.alive !== false
        );

        if (bld.isMainHQ && !anyEnemyMainHQLeft) {
          this._triggerGameOver(
            'allies',
            'VITÓRIA TOTAL ALIADA! QG INIMIGO DESTRUÍDO!',
            `Você demoliu o Centro de Comando Inimigo! (+${ptsBonus} Pontos de Vitória)`
          );
        } else {
          this.notify(
            `INSTALAÇÃO INIMIGA DEMOLIDA: ${(bld.short || bld.name || 'BASE').toUpperCase()}`,
            `Recompensa de Sabotagem: +${ptsBonus} PTS, +${supBonus} SUP, +${ammoBonus} MUN e +${fuelBonus} COMB!`,
            '#d4a338'
          );
        }
      } else if (bld.team === 'allies') {
        if (bld.isMainHQ && bld.faction === 'player') {
          this._triggerGameOver(
            'enemies',
            'DERROTA — QG PRINCIPAL DESTRUÍDO!',
            'O Comando Central Aliado caiu sob fogo inimigo.'
          );
        } else {
          this.notify(
            `ALERTA CRÍTICO: ${(bld.short || bld.name || 'INSTALAÇÃO').toUpperCase()} DESTRUÍDO!`,
            'O inimigo demoliu uma estrutura da nossa base!',
            '#c94a38'
          );
        }
      }

      this._emitHud();
    }
  }

  isAdminUser() {
    if (typeof window === 'undefined') return true; // Permite testes automatizados no Node.js
    const nm = this.networkManager || networkManager;
    return Boolean(nm?.isAdmin?.());
  }

  enableSandboxMode() {
    if (!this.isAdminUser()) {
      this.notify('🔒 ACESSO RESTRITO', 'O Modo Sandbox é exclusivo para Administradores.', '#ef4444');
      return false;
    }
    this.sandboxMode = true;
    this.supplies = 99999;
    this.ammo = 99999;
    this.fuel = 99999;
    this.hqLevel = 3;
    this.commandPoints = 999;
    const hqBld = this.baseBuildings.find((b) => b.faction === 'player' && b.isMainHQ);
    if (hqBld) hqBld.level = 3;
    for (const n of TECH_NODES) {
      if (!this.completedTechs.has(n.id)) {
        this.completedTechs.add(n.id);
        this._applyTechUpgradeEffects(n.id);
      }
    }
    this.activeResearch = null;
    for (const k of Object.keys(this.airCooldowns || {})) this.airCooldowns[k] = 0;
    for (const u of this.units) {
      if (u.faction === 'player') {
        u.grenadeAbilityCooldown = 0;
        u.suppressionCooldown = 0;
        u.medkitCooldown = 0;
      }
    }
    this.audio.play('win');
    this.notify(
      '🛠️ MODO CAIXA DE AREIA ATIVADO [F10]',
      '99.999 Recursos • QG Nv. 3 • Todas Pesquisas • Produção Instantânea!',
      '#c28e38'
    );
    this._emitHud();
    return true;
  }

  toggleSandboxMode() {
    if (!this.isAdminUser()) {
      this.notify('🔒 ACESSO RESTRITO', 'O Modo Sandbox é exclusivo para Administradores.', '#ef4444');
      return false;
    }
    if (this.sandboxMode) {
      this.sandboxMode = false;
      this.notify('🛠️ MODO SANDBOX DESATIVADO', 'Regras normais de produção restauradas.', '#8c948c');
      this._emitHud();
      return false;
    }
    return this.enableSandboxMode();
  }

  sandboxSpawnUnit(faction, unitType, options = {}) {
    const sx = clamp(this.camera.x + randInt(-70, 70), 160, BATTLEFIELD_SIZE - 160);
    const sy = clamp(this.camera.y + randInt(-70, 70), 160, BATTLEFIELD_SIZE - 160);
    const u = this.spawnUnit(faction, unitType, sx, sy, faction === 'player' ? 0 : Math.PI);
    if (options.surrendered) {
      u.surrendered = true;
      u.hp = Math.max(10, Math.ceil(u.maxHp * 0.3));
    }
    if (options.holdPosition) {
      u.holdPosition = true;
    }
    this.audio.play('pickup');
    this.spawnText(u.x, u.y - 20, `🛠️ +${u.short}`, '#c28e38');
    this._emitHud();
    return u;
  }

  sandboxToggleFog() {
    this.sandboxFogDisabled = !this.sandboxFogDisabled;
    this.intelRevealed = this.sandboxFogDisabled;
    if (this.sandboxFogDisabled) {
      this.map.fogGrid.fill(2);
    } else {
      this.map.resetFog();
      this.map.updateFogOfWar(this.units, this.baseBuildings, 0.05, this.myTeam);
    }
    this.audio.play('switch');
    this.notify(
      this.sandboxFogDisabled ? '👁️ NÉVOA DE GUERRA DESLIGADA' : '👁️ NÉVOA DE GUERRA ATIVA',
      '',
      '#c28e38'
    );
    this._emitHud();
  }

  sandboxToggleAi() {
    this.sandboxAiPaused = !this.sandboxAiPaused;
    this.audio.play('switch');
    this.notify(
      this.sandboxAiPaused ? '🤖 IA INIMIGA PAUSADA' : '🤖 IA INIMIGA ATIVA',
      '',
      '#c28e38'
    );
    this._emitHud();
  }

  sandboxHealAll() {
    for (const u of this.units) {
      if (!u.alive || u.team !== 'allies') continue;
      u.hp = u.maxHp;
      u.morale = 100;
      u.suppressedTimer = 0;
      for (const s of u.soldiers || []) {
        s.alive = true;
        s.hp = s.maxHp;
      }
      u.syncSquadHealthFromSoldiers?.();
    }
    for (const b of this.baseBuildings) {
      if (b.alive !== false && b.team === 'allies') b.hp = b.maxHp;
    }
    this.audio.play('win');
    this.notify('💚 TODAS AS TROPAS E PRÉDIOS CURADOS!', '', '#4ade80');
    this._emitHud();
  }

  sandboxDestroySelected() {
    let count = 0;
    for (const u of this.units) {
      if (u.alive && u.selected) {
        u.takeDamage(99999, 'enemies', this, true, true, u.x, u.y);
        count++;
      }
    }
    if (count > 0) {
      this.audio.play('explosion');
      this._emitHud();
    }
  }

  // Constrói instalações militares no QG do Jogador (Quartel Op. Especiais, Fábrica de Blindados, Comando Aéreo/Radar)
  constructBaseBuilding(buildingId) {
    const spec = BASE_BUILDING_BY_ID[buildingId];
    if (!spec) return false;
    this.audio.resume();

    const alreadyBuilt = this.baseBuildings.some(
      (b) => b.faction === this.myFaction && b.buildingType === buildingId && b.alive !== false
    );
    if (alreadyBuilt) {
      const existing = this.baseBuildings.find(
        (b) => b.faction === this.myFaction && b.buildingType === buildingId && b.alive !== false
      );
      if (existing) this.selectBaseBuilding(existing.id);
      this.notify('INSTALAÇÃO JÁ CONSTRUÍDA', `${spec.name} selecionada para produção.`, '#d4a338');
      return false;
    }

    const supCost = spec.cost || 0;
    const fuelCost = spec.fuelCost || 0;
    if (this.supplies < supCost || this.fuel < fuelCost) {
      this.notify(
        'RECURSOS INSUFICIENTES',
        `Necessário ${supCost} SUP e ${fuelCost} COMB para ${spec.short}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    this.supplies -= supCost;
    this.fuel -= fuelCost;

    const hq = this.map.hqs[this.myFaction] || this.map.hqs.player;
    const xSign = this.myTeam === 'enemies' ? -1 : 1;
    const offsets = {
      spec_ops_center: { dx: -160 * xSign, dy: -410 },
      motor_pool: { dx: -160 * xSign, dy: 410 },
      air_command: { dx: -510 * xSign, dy: -270 },
      pow_camp: { dx: -510 * xSign, dy: 270 },
      drone_factory: { dx: 180 * xSign, dy: -410 },
    };
    const off = offsets[buildingId] || { dx: -480 * xSign, dy: 310 };
    let bx = clamp(hq.x + off.dx, 260, this.map.size - 260);
    let by = clamp(hq.y + off.dy, 260, this.map.size - 260);

    // Regra de Posicionamento Anti-Colisão (>= 14m = 140u entre bordas) e fora das estradas principais
    const myRad = spec.radius || 90;
    const others = this.baseBuildings.filter((b) => b.alive !== false && b.team === this.myTeam);
    for (let attempt = 0; attempt < 24; attempt++) {
      const onRoad = this.map.isOnRoad?.(bx, by, myRad + 28);
      const overlaps = others.some(
        (b) => dist(bx, by, b.x, b.y) < myRad + (b.radius || 95) + 140
      );
      if (!onRoad && !overlaps) break;
      const stepDir = off.dy >= 0 ? 1 : -1;
      by = clamp(by + stepDir * 85, 260, this.map.size - 260);
      if (attempt % 4 === 3) {
        bx = clamp(bx - 90 * xSign, 260, this.map.size - 260);
      }
    }

    const newBld = {
      id: `${this.myFaction}_base_${buildingId}_${Date.now()}`,
      buildingType: buildingId,
      name: spec.name,
      short: spec.short,
      subtitle: spec.subtitle,
      team: this.myTeam,
      faction: this.myFaction,
      x: bx,
      y: by,
      sightRadius: spec.sightRadius || 620,
      hp: spec.maxHp || 1500,
      maxHp: spec.maxHp || 1500,
      radius: spec.radius || 84,
      rallyX: bx + 560 * xSign,
      rallyY: by,
      produces: [...(spec.produces || [])],
      productionQueue: [],
      productionProgress: 0,
      alive: true,
    };

    this.baseBuildings.push(newBld);
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendCommand({ type: 'build_base', buildingId, x: bx, y: by });
    }
    this.map.clearFoliageAndFlattenUnderBuilding?.(bx, by, myRad + 35);
    this.map.syncAllColliders?.(this.baseBuildings);
    this.selectedBuildingId = newBld.id;

    if (buildingId === 'air_command') {
      this.audio.play('radio');
      this.spawnText(bx, by - 46, '✈ COMANDO AÉREO DESBLOQUEADO [V]', '#38bdf8');
    } else {
      this.audio.play('win');
    }
    this.spawnText(bx, by - 28, `🏗 ${spec.short.toUpperCase()} OPERACIONAL`, '#a3be8c');
    this.notify(
      `${spec.name.toUpperCase()} CONSTRUÍDO!`,
      'Clique no prédio 3D (ou use o painel da instalação) para produzir unidades e definir Ponto de Encontro.',
      '#a3be8c'
    );
    this.map.updateFogOfWar(this.units, this.baseBuildings, 0.05, this.myTeam);
    this._emitHud();
    return true;
  }

  setMapEditorOpen(isOpen, defaultTool = 'farmhouse', angleDeg = 0, scale = 1.0) {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.'));
    if (isOpen && !isLocal) {
      this.notify('EDITOR RESTRITO AO MODO LOCAL', 'O Editor de Mapas só pode ser aberto em servidor local.', '#ef4444');
      return false;
    }
    this.mapEditorOpen = Boolean(isOpen);
    this._editorWallDragStart = null;
    this._editorDraggingSector = null;
    this._editorDraggingObject = false;
    this._editorRotatingObject = false;
    this.trenchPreview = null;
    if (this.mapEditorOpen) {
      if (this.timeScale > 0) this._preEditorTimeScale = this.timeScale;
      this.timeScale = 0; // Pausa o jogo local automaticamente para editar apenas o mapa
      this.setMapEditorTool(defaultTool, angleDeg, scale);
      this.notify(
        '🛠️ EDITOR DE MAPA ATIVO (HUD OCULTA & JOGO PAUSADO)',
        'Coloque objetos, use [✋ Mover / Girar] para arrastar e clique direito + arraste (ou [R]) para virar o lado!',
        '#d8b4fe'
      );
    } else {
      this.selectedEditorSectorId = null;
      this.selectedEditorObject = null;
      this.setMapEditorTool(null);
      this.timeScale = this._preEditorTimeScale || 1.0;
    }
    this._emitHud();
  }

  _findEditorObjectAt(x, y) {
    if (!this.map) return null;
    // 1. Construções
    for (let i = (this.map.structures || []).length - 1; i >= 0; i--) {
      const s = this.map.structures[i];
      if (dist(x, y, s.x, s.y) <= Math.max(72, Math.max(s.w || 80, s.d || 80) * 0.72)) {
        return { kind: 'structure', id: s.id, item: s, label: s.name || s.type || 'Construção' };
      }
    }
    // 2. Carcaças
    for (let i = (this.map.wrecks || []).length - 1; i >= 0; i--) {
      const w = this.map.wrecks[i];
      if (dist(x, y, w.x, w.y) <= 64) {
        return { kind: 'wreck', id: w.id, item: w, label: w.name || 'Carcaça' };
      }
    }
    // 3. Muros
    for (let i = (this.map.stoneWalls || []).length - 1; i >= 0; i--) {
      const w = this.map.stoneWalls[i];
      if (this.map._distToSegment(x, y, w.x1, w.y1, w.x2, w.y2) <= 46) {
        return {
          kind: 'wall',
          id: w.id,
          item: w,
          label: w.type === 'fortified' ? 'Muralha' : w.type === 'brick' ? 'Muro de Tijolo' : 'Muro',
        };
      }
    }
    // 4. Árvores (converte InstancedMesh em malha editável se ainda não tiver _editorId)
    let bestT = null;
    let bestTD = 58;
    for (const t of this.map.trees || []) {
      const d = dist(x, y, t.x, t.y);
      if (d <= bestTD) {
        bestTD = d;
        bestT = t;
      }
    }
    if (bestT) {
      if (!bestT._editorId) {
        bestT._editorId = `ed_tree_${Date.now()}_${Math.floor(Math.random() * 999)}`;
        this.renderer?.hideInstancedTree?.(bestT);
        const kind = bestT.isBurnt ? 'tree_burnt' : bestT.isPine ? 'tree_pine' : 'tree_oak';
        this.renderer?.addEditorFoliage?.(bestT, kind, this.map);
      }
      return { kind: 'foliage', id: bestT._editorId, item: bestT, label: 'Árvore' };
    }
    // 5. Arbustos
    let bestB = null;
    let bestBD = 52;
    for (const b of this.map.bushes || []) {
      const d = dist(x, y, b.x, b.y);
      if (d <= bestBD) {
        bestBD = d;
        bestB = b;
      }
    }
    if (bestB) {
      if (!bestB._editorId) {
        bestB._editorId = `ed_bush_${Date.now()}_${Math.floor(Math.random() * 999)}`;
        this.renderer?.hideInstancedBush?.(bestB);
        this.renderer?.addEditorFoliage?.(bestB, 'bush', this.map);
      }
      return { kind: 'foliage', id: bestB._editorId, item: bestB, label: 'Arbusto' };
    }
    // 6. Crateras / Rochas colocadas no editor
    for (let i = (this.map.craters || []).length - 1; i >= 0; i--) {
      const c = this.map.craters[i];
      if (c._editorId && dist(x, y, c.x, c.y) <= (c.radius || 44) + 16) {
        return { kind: 'foliage', id: c._editorId, item: c, label: 'Rochas / Cratera' };
      }
    }
    return null;
  }

  moveSelectedEditorObject(nx, ny, syncColliders = false) {
    const sel = this.selectedEditorObject;
    if (!sel || !sel.item || !this.map) return;
    const x = clamp(Math.round(nx), 160, BATTLEFIELD_SIZE - 160);
    const y = clamp(Math.round(ny), 160, BATTLEFIELD_SIZE - 160);
    const it = sel.item;
    if (sel.kind === 'wall') {
      const cx = (it.x1 + it.x2) * 0.5;
      const cy = (it.y1 + it.y2) * 0.5;
      const dx = x - cx;
      const dy = y - cy;
      it.x1 = Math.round(it.x1 + dx);
      it.y1 = Math.round(it.y1 + dy);
      it.x2 = Math.round(it.x2 + dx);
      it.y2 = Math.round(it.y2 + dy);
    } else {
      it.x = x;
      it.y = y;
    }
    this.renderer?.updateEditorObjectTransform?.(sel, this.map);
    if (syncColliders) {
      this.map.syncAllColliders?.(this.baseBuildings);
      if (this.map._navGrids) this.map._navGrids = {};
    }
  }

  setSelectedEditorObjectAngle(angRad, syncColliders = true) {
    const sel = this.selectedEditorObject;
    if (!sel || !sel.item || !this.map) return;
    const norm = ((angRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const it = sel.item;
    if (sel.kind === 'wall') {
      const cx = (it.x1 + it.x2) * 0.5;
      const cy = (it.y1 + it.y2) * 0.5;
      const halfLen = Math.max(20, Math.hypot(it.x2 - it.x1, it.y2 - it.y1) * 0.5);
      it.x1 = Math.round(cx - Math.cos(norm) * halfLen);
      it.y1 = Math.round(cy - Math.sin(norm) * halfLen);
      it.x2 = Math.round(cx + Math.cos(norm) * halfLen);
      it.y2 = Math.round(cy + Math.sin(norm) * halfLen);
      it.angle = norm;
    } else {
      it.angle = norm;
    }
    this.mapEditorAngle = norm;
    this.renderer?.updateEditorObjectTransform?.(sel, this.map);
    if (syncColliders) {
      this.map.syncAllColliders?.(this.baseBuildings);
      if (this.map._navGrids) this.map._navGrids = {};
    }
  }

  selectEditorSector(sectorId) {
    this.selectedEditorSectorId = sectorId || null;
    this.setMapEditorTool('move_sector');
    const sec = (this.map?.sectors || []).find((s) => s.id === sectorId);
    if (sec) {
      this.camera.x = clamp(sec.x, 300, BATTLEFIELD_SIZE - 300);
      this.camera.y = clamp(sec.y, 300, BATTLEFIELD_SIZE - 300);
      this.spawnText(sec.x, sec.y - 24, `🚩 ${(sec.shortName || sec.name).toUpperCase()} SELECIONADO`, '#facc15');
    }
    this._emitHud();
  }

  setEditorTerrainBrush({ radiusMeters, intensity } = {}) {
    if (typeof radiusMeters === 'number') {
      this.editorBrushRadiusMeters = clamp(radiusMeters, 8, 40);
    }
    if (intensity === 'low' || intensity === 'medium' || intensity === 'high') {
      this.editorBrushIntensity = intensity;
    }
    this._emitHud();
  }

  sculptTerrainAt(wx, wy, mode = this.mapEditorTool) {
    if (!this.map?.terrainSculptGrid) return false;
    const gN = this.map.terrainSculptSize || 129;
    const grid = this.map.terrainSculptGrid;
    const rockGrid = this.map.terrainRockGrid;
    const radiusM = this.editorBrushRadiusMeters || 18;
    const radiusW = radiusM * 10;
    const intMult =
      this.editorBrushIntensity === 'high' ? 1.75 : this.editorBrushIntensity === 'low' ? 0.55 : 1.0;
    const cellSpan = this.map.size / (gN - 1);
    const minI = Math.max(0, Math.floor((wx - radiusW) / cellSpan));
    const maxI = Math.min(gN - 1, Math.ceil((wx + radiusW) / cellSpan));
    const minJ = Math.max(0, Math.floor((wy - radiusW) / cellSpan));
    const maxJ = Math.min(gN - 1, Math.ceil((wy + radiusW) / cellSpan));

    for (let j = minJ; j <= maxJ; j++) {
      const vz = j * cellSpan;
      for (let i = minI; i <= maxI; i++) {
        const vx = i * cellSpan;
        const d = Math.hypot(vx - wx, vz - wy);
        if (d > radiusW) continue;
        const normD = d / radiusW;
        const idx = j * gN + i;
        if (mode === 'sculpt_hill') {
          const bell = Math.exp(-normD * normD * 3.0);
          grid[idx] = clamp((grid[idx] || 0) + 18 * intMult * bell, -140, 260);
        } else if (mode === 'sculpt_mountain') {
          const peak = Math.pow(Math.max(0, 1 - normD), 1.35);
          grid[idx] = clamp((grid[idx] || 0) + 32 * intMult * peak, -140, 320);
          if (rockGrid && normD < 0.78) {
            rockGrid[idx] = Math.min(255, Math.round(140 + (1 - normD) * 115));
          }
        } else if (mode === 'sculpt_valley') {
          const bell = Math.exp(-normD * normD * 3.0);
          grid[idx] = clamp((grid[idx] || 0) - 16 * intMult * bell, -140, 260);
        } else if (mode === 'sculpt_flatten') {
          const blend = (1 - normD) * 0.55 * intMult;
          grid[idx] = (grid[idx] || 0) * Math.max(0, 1 - Math.min(1, blend));
          if (rockGrid && normD < 0.7) rockGrid[idx] = 0;
        }
      }
    }
    this.renderer?.syncTerrainSculptGeometry?.(this.map, wx, wy, radiusW + 120);
    return true;
  }

  createEditorSector(wx, wy) {
    if (!this.map) return null;
    if ((this.map.sectors || []).length >= 24) {
      this.notify('LIMITE ATINGIDO', 'Máximo de 24 pontos de conquista por mapa.', '#ef4444');
      return null;
    }
    const idx = (this.map.sectors || []).length + 1;
    const sec = {
      id: `sec_custom_${Date.now().toString(36)}_${idx}`,
      name: `Setor Tático S${idx}`,
      shortName: `S${idx}`,
      type: 'supplies',
      resourceType: 'supplies',
      shortLabel: '+15 SUP',
      x: clamp(Math.round(wx), 220, BATTLEFIELD_SIZE - 220),
      y: clamp(Math.round(wy), 220, BATTLEFIELD_SIZE - 220),
      radius: 175,
      owner: 'neutral',
      initialOwner: 'neutral',
      captureProgress: 0,
      supplyBonus: 15,
      incomeBonus: 15,
      ammoBonus: 0,
      fuelBonus: 0,
    };
    this.map.sectors.push(sec);
    this.selectedEditorSectorId = sec.id;
    this.audio?.play?.('pickup');
    this.spawnText(sec.x, sec.y - 24, `🚩 ${sec.name} CRIADO!`, '#4ade80');
    this._emitHud();
    return sec;
  }

  updateEditorSector(sectorId, patch = {}) {
    const sec = (this.map?.sectors || []).find((s) => s.id === sectorId);
    if (!sec) return false;
    if (typeof patch.name === 'string' && patch.name.trim()) {
      sec.name = patch.name.trim();
      sec.shortName = patch.name.trim().slice(0, 18);
    }
    if (patch.type) {
      sec.type = patch.type;
      sec.resourceType = patch.type;
      if (patch.type === 'supplies') {
        sec.supplyBonus = 15;
        sec.incomeBonus = 15;
        sec.ammoBonus = 0;
        sec.fuelBonus = 0;
        sec.shortLabel = '+15 SUP';
      } else if (patch.type === 'ammo') {
        sec.supplyBonus = 6;
        sec.incomeBonus = 6;
        sec.ammoBonus = 12;
        sec.fuelBonus = 0;
        sec.shortLabel = '+12 MUN';
      } else if (patch.type === 'fuel') {
        sec.supplyBonus = 6;
        sec.incomeBonus = 6;
        sec.ammoBonus = 0;
        sec.fuelBonus = 12;
        sec.shortLabel = '+12 COMB';
      } else if (patch.type === 'strategic') {
        sec.supplyBonus = 10;
        sec.incomeBonus = 10;
        sec.ammoBonus = 5;
        sec.fuelBonus = 5;
        sec.shortLabel = '⭐ +10S/+5M/+5C';
      }
    }
    if (patch.initialOwner) {
      sec.initialOwner = patch.initialOwner;
      sec.owner = patch.initialOwner;
      sec.captureProgress = patch.initialOwner === 'allies' ? 100 : patch.initialOwner === 'enemies' ? -100 : 0;
    }
    this._emitHud();
    return true;
  }

  deleteEditorSector(sectorId) {
    if (!this.map?.sectors) return false;
    const idx = this.map.sectors.findIndex((s) => s.id === sectorId);
    if (idx < 0) return false;
    const removed = this.map.sectors.splice(idx, 1)[0];
    if (this.selectedEditorSectorId === sectorId) {
      this.selectedEditorSectorId = this.map.sectors[0]?.id || null;
    }
    this.audio?.play?.('door');
    this.notify('PONTO REMOVIDO', `${removed.name} foi excluído do mapa.`, '#ef4444');
    this._emitHud();
    return true;
  }

  _placeEditorWallSegment(x1, y1, x2, y2, tool) {
    if (tool === 'trench_line') {
      const rawPts = [
        { x: Math.round(x1), y: Math.round(y1) },
        { x: Math.round(x2), y: Math.round(y2) },
      ];
      const newTrench = new TrenchSegment({
        points: rawPts,
        team: 'allies',
        isLShape: false,
        revealed: true,
      });
      this._connectTrenchToNetwork?.(newTrench);
      this.trenches.push(newTrench);
      if (this.map) {
        if (!Array.isArray(this.map.customTrenches)) this.map.customTrenches = [];
        this.map.customTrenches.push({
          points: (newTrench.points || rawPts).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
          openStart: Boolean(newTrench.openStart),
          openEnd: Boolean(newTrench.openEnd),
        });
      }
      this.audio?.play?.('pickup');
      this.spawnText((x1 + x2) * 0.5, (y1 + y2) * 0.5 - 18, '⛏️ TRINCHEIRA CONECTADA ADICIONADA', '#4ade80');
      this._emitHud();
      return;
    }

    const typeMap = {
      fortified_wall: 'fortified',
      brick_wall: 'brick',
      stone_wall: 'stone',
      sandbag_line: 'sandbag',
      tank_trap_line: 'tank_trap',
    };
    const newWall = {
      id: `ed_wall_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
      type: typeMap[tool] || 'stone',
      height: tool === 'fortified_wall' ? 42 : tool === 'sandbag_line' ? 10 : 14,
      thickness: tool === 'fortified_wall' ? 20 : 18,
    };
    this.map.stoneWalls.push(newWall);
    this.map.syncAllColliders?.(this.baseBuildings);
    if (this.map._navGrids) this.map._navGrids = {};
    this.renderer?.addEditorStoneWall?.(newWall, this.map);
    this.audio?.play?.('pickup');
    const midX = (x1 + x2) * 0.5;
    const midY = (y1 + y2) * 0.5;
    const label =
      tool === 'fortified_wall'
        ? '🏰 MURALHA DE CONCRETO ADICIONADA'
        : tool === 'brick_wall'
        ? '🧱 MURO DE TIJOLO ADICIONADO'
        : tool === 'sandbag_line'
        ? '🛡️ SACOS DE AREIA ADICIONADOS'
        : tool === 'tank_trap_line'
        ? '✖️ OURIÇOS ANTITANQUE ADICIONADOS'
        : '🧱 MURO DE PEDRA ADICIONADO';
    this.selectedEditorObject = {
      kind: 'wall',
      id: newWall.id,
      item: newWall,
      label:
        tool === 'fortified_wall'
          ? 'Muralha'
          : tool === 'brick_wall'
          ? 'Muro de Tijolo'
          : 'Muro',
    };
    this.spawnText(midX, midY - 18, label, '#4ade80');
    this._emitHud();
  }

  adjustEditorZoom(delta) {
    const minZ = this.mapEditorOpen ? 180 : 340;
    const maxZ = this.mapEditorOpen ? 3800 : 1020;
    this.camera.zoom = clamp(this.camera.zoom + delta, minZ, maxZ);
    this._emitHud();
  }

  setEditorOverviewZoom() {
    this.camera.zoom = 2600;
    this.camera.x = BATTLEFIELD_SIZE * 0.5;
    this.camera.y = BATTLEFIELD_SIZE * 0.5;
    this._emitHud();
  }

  setMapEditorTool(tool, angleDeg = null, scale = null) {
    if (typeof angleDeg === 'number') {
      const normDeg = ((angleDeg % 360) + 360) % 360;
      this.mapEditorAngle = (normDeg * Math.PI) / 180;
    }
    if (typeof scale === 'number') this.mapEditorScale = clamp(scale, 0.5, 2.2);
    this.mapEditorTool = tool || null;
    this.activeCommandMode = tool ? 'map_editor' : null;
    if (tool) {
      this.mapEditorOpen = true;
      if (this.timeScale > 0) {
        this._preEditorTimeScale = this.timeScale;
        this.timeScale = 0;
      }
    }
    this._emitHud();
  }

  rotateMapEditorAngle(deltaDeg = 45) {
    const baseRad =
      this.selectedEditorObject && typeof this.selectedEditorObject.item?.angle === 'number'
        ? this.selectedEditorObject.item.angle
        : this.mapEditorAngle || 0;
    const curDeg = Math.round((baseRad * 180) / Math.PI);
    const nextDeg = (((curDeg + deltaDeg) % 360) + 360) % 360;
    const nextRad = (nextDeg * Math.PI) / 180;
    this.mapEditorAngle = nextRad;
    if (this.selectedEditorObject) {
      this.setSelectedEditorObjectAngle(nextRad, true);
    }
    this._emitHud();
    return nextDeg;
  }

  _eraseSingleObjectAt(x, y, searchMult = 1.0) {
    let removedLabel = null;
    // 1. Construções existentes ou novas do mapa
    const sIdx = (this.map.structures || []).findIndex(
      (s) => dist(x, y, s.x, s.y) <= Math.max(95, Math.max(s.w || 80, s.d || 80) * 0.92) * searchMult
    );
    if (sIdx >= 0) {
      const rem = this.map.structures.splice(sIdx, 1)[0];
      this.renderer?.removeEditorStructure?.(rem.id);
      removedLabel = rem.name || rem.type || 'Construção';
    }
    // 2. Carcaças existentes ou novas
    if (!removedLabel) {
      const wIdx = (this.map.wrecks || []).findIndex((w) => dist(x, y, w.x, w.y) <= 78 * searchMult);
      if (wIdx >= 0) {
        const remW = this.map.wrecks.splice(wIdx, 1)[0];
        this.renderer?.removeEditorWreck?.(remW.id);
        removedLabel = remW.name || 'Carcaça';
      }
    }
    // 3. Muros de pedra/tijolo existentes do mapa
    if (!removedLabel) {
      const swIdx = (this.map.stoneWalls || []).findIndex(
        (w) => this.map._distToSegment(x, y, w.x1, w.y1, w.x2, w.y2) <= 55 * searchMult
      );
      if (swIdx >= 0) {
        const remSw = this.map.stoneWalls.splice(swIdx, 1)[0];
        this.renderer?.removeEditorStoneWall?.(remSw.id);
        removedLabel = 'Muro de Pedra';
      }
    }
    // 4. Trincheiras existentes
    if (!removedLabel) {
      const trIdx = (this.trenches || []).findIndex((tr) => tr.containsPoint(x, y, 42 * searchMult));
      if (trIdx >= 0) {
        this.trenches.splice(trIdx, 1);
        removedLabel = 'Trincheira';
      }
    }
    // 5. Muralhas fortificadas ou barricadas
    if (!removedLabel) {
      const fwIdx = (this.fortifiedWalls || []).findIndex((fw) => fw.containsPoint(x, y, 42 * searchMult));
      if (fwIdx >= 0) {
        this.fortifiedWalls.splice(fwIdx, 1);
        removedLabel = 'Muralha';
      }
    }
    if (!removedLabel) {
      const barIdx = (this.barricades || []).findIndex((b) => b.containsPoint(x, y, 42 * searchMult));
      if (barIdx >= 0) {
        this.barricades.splice(barIdx, 1);
        removedLabel = 'Barricada';
      }
    }
    // 6. Árvores existentes (InstancedMesh) ou adicionadas no editor
    if (!removedLabel) {
      let bestT = -1;
      let bestTD = 72 * searchMult;
      for (let i = 0; i < (this.map.trees || []).length; i++) {
        const t = this.map.trees[i];
        const d = dist(x, y, t.x, t.y);
        if (d <= bestTD) {
          bestTD = d;
          bestT = i;
        }
      }
      if (bestT >= 0) {
        const remT = this.map.trees.splice(bestT, 1)[0];
        if (remT._editorId) this.renderer?.removeEditorFoliage?.(remT._editorId);
        this.renderer?.hideInstancedTree?.(remT);
        removedLabel = 'Árvore';
      }
    }
    // 7. Arbustos existentes (InstancedMesh) ou adicionados no editor
    if (!removedLabel) {
      let bestB = -1;
      let bestBD = 68 * searchMult;
      for (let i = 0; i < (this.map.bushes || []).length; i++) {
        const b = this.map.bushes[i];
        const d = dist(x, y, b.x, b.y);
        if (d <= bestBD) {
          bestBD = d;
          bestB = i;
        }
      }
      if (bestB >= 0) {
        const remB = this.map.bushes.splice(bestB, 1)[0];
        if (remB._editorId) this.renderer?.removeEditorFoliage?.(remB._editorId);
        this.renderer?.hideInstancedBush?.(remB);
        removedLabel = 'Arbusto';
      }
    }
    return removedLabel;
  }

  _placeEditorForestArea(cx, cy, radius = 180) {
    if (!this.map) return;
    const x = clamp(Math.round(cx), 200, BATTLEFIELD_SIZE - 200);
    const y = clamp(Math.round(cy), 200, BATTLEFIELD_SIZE - 200);
    const r = clamp(Math.round(radius), 90, 520);
    const sc = this.mapEditorScale || 1.0;

    if (!Array.isArray(this.map.forestZones)) this.map.forestZones = [];
    this.map.forestZones.push({
      id: `ed_fz_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      x,
      y,
      radius: r,
      name: 'Bosque Customizado',
    });

    const treeCount = Math.max(8, Math.min(48, Math.round(r / 11)));
    const placedTrees = [];
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2 + Math.random() * 0.65;
      const distR = (0.14 + Math.sqrt(Math.random()) * 0.82) * r;
      const tx = clamp(Math.round(x + Math.cos(ang) * distR), 180, BATTLEFIELD_SIZE - 180);
      const ty = clamp(Math.round(y + Math.sin(ang) * distR), 180, BATTLEFIELD_SIZE - 180);
      if (this.map.isOnRoad?.(tx, ty, 32)) continue;
      if (placedTrees.some((pt) => dist(tx, ty, pt.x, pt.y) < 38)) continue;

      const isPine = Math.random() < 0.6;
      const newTree = {
        _editorId: `ed_tree_${Date.now()}_${i}_${Math.floor(Math.random() * 999)}`,
        x: tx,
        y: ty,
        angle: Number((Math.random() * Math.PI * 2).toFixed(2)),
        scale: Number(((0.92 + Math.random() * 0.45) * sc).toFixed(2)),
        foliageTone: Number(Math.random().toFixed(2)),
        isPine,
        isBurnt: false,
      };
      placedTrees.push(newTree);
      this.map.trees.push(newTree);
      this.renderer?.addEditorFoliage?.(newTree, isPine ? 'tree_pine' : 'tree_oak', this.map);
    }

    const bushCount = Math.max(4, Math.round(treeCount * 0.45));
    for (let b = 0; b < bushCount; b++) {
      const ang = Math.random() * Math.PI * 2;
      const distR = Math.random() * r * 0.92;
      const bx = clamp(Math.round(x + Math.cos(ang) * distR), 180, BATTLEFIELD_SIZE - 180);
      const by = clamp(Math.round(y + Math.sin(ang) * distR), 180, BATTLEFIELD_SIZE - 180);
      if (this.map.isOnRoad?.(bx, by, 26)) continue;
      const newBush = {
        _editorId: `ed_bush_${Date.now()}_${b}_${Math.floor(Math.random() * 999)}`,
        x: bx,
        y: by,
        angle: Number((Math.random() * Math.PI * 2).toFixed(2)),
        scale: Number(((0.95 + Math.random() * 0.4) * sc).toFixed(2)),
      };
      this.map.bushes.push(newBush);
      this.renderer?.addEditorFoliage?.(newBush, 'bush', this.map);
    }

    this.map.syncAllColliders?.(this.baseBuildings);
    if (this.map._navGrids) this.map._navGrids = {};
    this.audio?.play?.('pickup');
    this.spawnText(
      x,
      y - 22,
      `🌲 ÁREA DE FLORESTA CRIADA (+${placedTrees.length} ÁRVORES)`,
      '#4ade80'
    );
    this._emitHud();
  }

  _applyMapEditorClick(wx, wy) {
    if (!this.map || !this.mapEditorTool) return;
    const x = clamp(Math.round(wx), 160, BATTLEFIELD_SIZE - 160);
    const y = clamp(Math.round(wy), 160, BATTLEFIELD_SIZE - 160);
    const tool = this.mapEditorTool;
    if (
      tool === 'sculpt_hill' ||
      tool === 'sculpt_mountain' ||
      tool === 'sculpt_valley' ||
      tool === 'sculpt_flatten'
    ) {
      this.sculptTerrainAt(x, y, tool);
      return;
    }
    if (tool === 'create_sector') {
      this.createEditorSector(x, y);
      return;
    }
    const ang = this.mapEditorAngle || 0;
    const sc = this.mapEditorScale || 1.0;

    if (tool === 'eraser' || tool === 'eraser_area') {
      if (tool === 'eraser_area') {
        let count = 0;
        for (let k = 0; k < 25; k++) {
          const hit = this._eraseSingleObjectAt(x, y, 2.6);
          if (!hit) break;
          count++;
        }
        if (count > 0) {
          this.map.syncAllColliders?.(this.baseBuildings);
          if (this.map._navGrids) this.map._navGrids = {};
          this.audio?.play?.('door');
          this.spawnText(x, y - 16, `🗑️ ${count} ITEM(NS) REMOVIDO(S) NA ÁREA`, '#ef4444');
        } else {
          this.spawnText(x, y - 16, 'Nenhum item encontrado nesta área', '#94a3b8');
        }
        return;
      }

      const removedLabel = this._eraseSingleObjectAt(x, y, 1.0);
      if (removedLabel) {
        this.map.syncAllColliders?.(this.baseBuildings);
        if (this.map._navGrids) this.map._navGrids = {};
        this.audio?.play?.('door');
        this.spawnText(x, y - 16, `🗑️ ${removedLabel.toUpperCase()} REMOVIDO`, '#ef4444');
      } else {
        this.spawnText(x, y - 16, 'Nenhum objeto próximo para remover', '#94a3b8');
      }
      return;
    }

    const bldPresets = {
      farmhouse: { name: 'Casa Rural', type: 'farmhouse', w: 86, d: 64, h: 36, garrisonable: true },
      two_story: { name: 'Sobrado Urbano (2 Andares)', type: 'two_story', w: 94, d: 72, h: 52, garrisonable: true },
      barn: { name: 'Celeiro Rural', type: 'barn', w: 104, d: 74, h: 42, garrisonable: true },
      warehouse: { name: 'Galpão Industrial', type: 'warehouse', w: 118, d: 78, h: 44, garrisonable: true },
      brick_ruin: { name: 'Ruína de Tijolo', type: 'brick_ruin', w: 88, d: 68, h: 36, garrisonable: true },
      bunker: { name: 'Bunker de Concreto', type: 'bunker', w: 76, d: 68, h: 28, garrisonable: true },
      adobe_house: { name: 'Complexo Adobe', type: 'adobe_house', w: 92, d: 72, h: 38, garrisonable: true },
    };

    if (bldPresets[tool]) {
      const p = bldPresets[tool];
      const w = Math.round(p.w * sc);
      const d = Math.round(p.d * sc);
      const h = Math.round(p.h * sc);
      const newStruct = {
        id: `ed_bld_${Date.now()}_${Math.floor(Math.random() * 999)}`,
        name: p.name,
        type: p.type,
        x,
        y,
        w,
        d,
        h,
        angle: ang,
        garrisonable: p.garrisonable,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: Math.round(Math.max(w, d) * 0.92),
      };
      this.map.structures.push(newStruct);
      this.map.syncAllColliders?.(this.baseBuildings);
      if (this.map._navGrids) this.map._navGrids = {};
      this.renderer?.addEditorStructure?.(newStruct, this.map);
      this.selectedEditorObject = { kind: 'structure', id: newStruct.id, item: newStruct, label: p.name };
      this.audio?.play?.('pickup');
      this.spawnText(x, y - 20, `🏗️ ${p.name.toUpperCase()} ADICIONADO`, '#4ade80');
      this._emitHud();
      return;
    }

    if (tool === 'tree_pine' || tool === 'tree_oak' || tool === 'tree_burnt') {
      const newTree = {
        _editorId: `ed_tree_${Date.now()}_${Math.floor(Math.random() * 999)}`,
        x,
        y,
        angle: ang,
        scale: Number((1.15 * sc).toFixed(2)),
        foliageTone: Number(Math.random().toFixed(2)),
        isPine: tool === 'tree_pine',
        isBurnt: tool === 'tree_burnt',
      };
      this.map.trees.push(newTree);
      this.renderer?.addEditorFoliage?.(newTree, tool, this.map);
      this.selectedEditorObject = { kind: 'foliage', id: newTree._editorId, item: newTree, label: 'Árvore' };
      this.audio?.play?.('pickup');
      const treeMsg =
        tool === 'tree_pine'
          ? '🌲 PINHEIRO PLANTADO'
          : tool === 'tree_burnt'
          ? '🪵 ÁRVORE QUEIMADA ADICIONADA'
          : '🌳 CARVALHO PLANTADO';
      this.spawnText(x, y - 16, treeMsg, '#4ade80');
      this._emitHud();
      return;
    }

    if (tool === 'crater_rock') {
      const newCrater = {
        _editorId: `ed_rock_${Date.now()}_${Math.floor(Math.random() * 999)}`,
        x,
        y,
        angle: ang,
        radius: Math.round(44 * sc),
        scale: Number(sc.toFixed(2)),
      };
      this.map.craters.push(newCrater);
      this.renderer?.addEditorFoliage?.(newCrater, 'crater_rock', this.map);
      this.selectedEditorObject = { kind: 'foliage', id: newCrater._editorId, item: newCrater, label: 'Rochas / Cratera' };
      this.audio?.play?.('pickup');
      this.spawnText(x, y - 16, '🪨 ROCHAS / CRATERA ADICIONADA', '#a3be8c');
      this._emitHud();
      return;
    }

    if (tool === 'forest_area') {
      this._placeEditorForestArea(x, y, Math.round(180 * sc));
      return;
    }

    if (tool === 'bush') {
      const newBush = {
        _editorId: `ed_bush_${Date.now()}_${Math.floor(Math.random() * 999)}`,
        x,
        y,
        angle: ang,
        scale: Number((1.1 * sc).toFixed(2)),
      };
      this.map.bushes.push(newBush);
      this.renderer?.addEditorFoliage?.(newBush, 'bush', this.map);
      this.selectedEditorObject = { kind: 'foliage', id: newBush._editorId, item: newBush, label: 'Arbusto' };
      this.audio?.play?.('pickup');
      this.spawnText(x, y - 16, '🌿 ARBUSTO / BOCAGE ADICIONADO', '#4ade80');
      this._emitHud();
      return;
    }

    if (tool === 'move_sector') {
      const sectors = this.map.sectors || [];
      let hitSec = null;
      let bestD = 220;
      for (const s of sectors) {
        const d = dist(x, y, s.x, s.y);
        if (d <= bestD) {
          bestD = d;
          hitSec = s;
        }
      }
      if (hitSec && this.selectedEditorSectorId !== hitSec.id) {
        this.selectedEditorSectorId = hitSec.id;
        this.audio?.play?.('switch');
        this.spawnText(
          hitSec.x,
          hitSec.y - 24,
          `🚩 ${(hitSec.shortName || hitSec.name).toUpperCase()} SELECIONADO — CLIQUE NO NOVO LOCAL!`,
          '#facc15'
        );
        this._emitHud();
        return;
      }
      const targetSec =
        sectors.find((s) => s.id === this.selectedEditorSectorId) || hitSec || sectors[0];
      if (targetSec) {
        targetSec.x = x;
        targetSec.y = y;
        this.selectedEditorSectorId = targetSec.id;
        this.renderer?.moveEditorSector?.(targetSec, this.map);
        this.audio?.play?.('pickup');
        this.spawnText(
          x,
          y - 24,
          `🚩 ${(targetSec.shortName || targetSec.name).toUpperCase()} MOVIDO PARA AQUI!`,
          '#4ade80'
        );
        this._emitHud();
      }
      return;
    }

    if (
      tool === 'stone_wall' ||
      tool === 'brick_wall' ||
      tool === 'fortified_wall' ||
      tool === 'trench_line' ||
      tool === 'sandbag_line' ||
      tool === 'tank_trap_line'
    ) {
      const halfLen = Math.round(75 * sc);
      const dx = Math.cos(ang) * halfLen;
      const dy = Math.sin(ang) * halfLen;
      this._placeEditorWallSegment(x - dx, y - dy, x + dx, y + dy, tool);
      return;
    }

    if (tool === 'wreck_tank' || tool === 'wreck_truck') {
      const isTank = tool === 'wreck_tank';
      const newWreck = {
        id: `ed_wrk_${Date.now()}_${Math.floor(Math.random() * 999)}`,
        type: isTank ? 'tank' : 'truck',
        x,
        y,
        angle: ang,
        smoke: true,
        radius: isTank ? 56 : 54,
        colRadius: isTank ? 30 : 28,
        name: isTank ? 'Tanque Destruído' : 'Caminhão Militar Queimado',
      };
      this.map.wrecks.push(newWreck);
      this.map.syncAllColliders?.(this.baseBuildings);
      if (this.map._navGrids) this.map._navGrids = {};
      this.renderer?.addEditorWreck?.(newWreck, this.map);
      this.selectedEditorObject = { kind: 'wreck', id: newWreck.id, item: newWreck, label: newWreck.name };
      this.audio?.play?.('pickup');
      this.spawnText(x, y - 16, isTank ? '💥 TANQUE DESTRUÍDO ADICIONADO' : '🚛 CAMINHÃO QUEIMADO ADICIONADO', '#f59e0b');
      this._emitHud();
    }
  }

  async saveCustomMapForDeploy(customName = null) {
    if (!this.map) return { ok: false };
    const payload = this.map.exportCustomMapPayload();
    let finalName = customName;
    if (!finalName && typeof window !== 'undefined' && typeof window.prompt === 'function') {
      finalName = window.prompt('Nome do Mapa Customizado:', 'Batalha das Montanhas') || '';
    }
    if (finalName && finalName.trim()) {
      const slug = finalName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const customId = `custom_${slug || Date.now().toString(36)}`;
      saveUserCustomMapEntry({
        id: customId,
        name: finalName.trim(),
        theme: this.map.theme || 'rural',
        sectorsCount: (this.map.sectors || []).length,
        data: { ...payload, mapId: customId },
      });
    }
    try {
      localStorage.setItem(`COF_CUSTOM_MAP_${this.map.mapId}`, JSON.stringify(payload));
    } catch {}
    try {
      const res = await fetch('/api/save-custom-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: this.map.mapId, data: payload }),
      });
      const json = await res.json();
      if (json.ok) {
        this.notify(
          '💾 MAPA SALVO NO PROJETO (PRONTO P/ DEPLOY)!',
          `Gravado em src/game/data/customMaps.json (${this.map.mapId}). Quando fizer deploy, o mapa já sobe atualizado!`,
          '#4ade80'
        );
        return { ok: true, file: json.file };
      }
    } catch {}
    this.notify(
      '💾 MAPA SALVO LOCALMENTE',
      'Layout salvo no navegador. Em modo npm run dev ele também grava automaticamente em src/game/data/customMaps.json.',
      '#38bdf8'
    );
    return { ok: true, localOnly: true };
  }

  async resetCustomMapToDefault() {
    if (!this.map) return;
    const mapId = this.map.mapId;
    try {
      localStorage.removeItem(`COF_CUSTOM_MAP_${mapId}`);
    } catch {}
    try {
      await fetch('/api/save-custom-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, reset: true }),
      });
    } catch {}
    this.setupMatch(this.gameMode, this.startingResourcesPreset, mapId, this.aiDifficulty);
    this.notify('🔄 MAPA ORIGINAL RESTAURADO', `O mapa ${mapId} voltou ao layout original.`, '#fbbf24');
  }

  getOutpostPlacementStatus(wx, wy, team = 'allies') {
    const sectors = this.map?.sectors || [];
    let nearestSector = null;
    let nearestDist = Infinity;
    for (const sec of sectors) {
      if (sec.owner !== team) continue;
      const limitRadius = Math.max(308, sec.radius || 308); // 22m = 308u
      const d = dist(wx, wy, sec.x, sec.y);
      if (d <= limitRadius && d < nearestDist) {
        nearestDist = d;
        nearestSector = sec;
      }
    }
    if (!nearestSector) {
      return {
        ok: false,
        reason: 'no_sector',
        sector: null,
        count: 0,
        max: 3,
        message: '⚠️ Construa dentro de um Setor Capturado pela sua equipe!',
      };
    }
    const secR = Math.max(308, nearestSector.radius || 308);
    const count = this.units.filter(
      (u) =>
        u.alive &&
        u.team === team &&
        (u.unitType === 'build_outpost' || u.spec?.subType === 'supply_outpost') &&
        dist(u.x, u.y, nearestSector.x, nearestSector.y) <= secR
    ).length;
    if (count >= 3) {
      return {
        ok: false,
        reason: 'cap_reached',
        sector: nearestSector,
        count,
        max: 3,
        message: '🚫 Limite atingido (3/3 Postos neste local)! Capture outro setor.',
      };
    }
    return {
      ok: true,
      reason: 'ok',
      sector: nearestSector,
      count,
      max: 3,
      message: `📦 Postos no Setor: ${count} / 3`,
    };
  }

  addCommandPoints(amount, reason = '') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.commandPoints = (this.commandPoints || 0) + Math.round(amount);
    if (reason) {
      this.spawnText(this.camera.x, this.camera.y - 40, `+${Math.round(amount)} CP (${reason})`, '#facc15');
    }
  }

  upgradeHq() {
    if (this.hqLevel >= 3) {
      this.notify('QG NO NÍVEL MÁXIMO', 'Seu Quartel-General já atingiu o Nível 3.', '#9a9484');
      return false;
    }
    const nextLevel = this.hqLevel + 1;
    if (this.isCampaign && nextLevel >= 3 && (this.campaignOwnedTerritoriesCount || 1) < 3) {
      this.audio.play('empty');
      this.notify(
        'QG NÍVEL 3 BLOQUEADO',
        `🔒 Requer 3 Territórios Dominados (Atual: ${this.campaignOwnedTerritoriesCount || 1}/3) — Expanda no Mapa Continental!`,
        '#c94a38'
      );
      return false;
    }
    const spec = HQ_UPGRADES[nextLevel];
    if (!spec) return false;

    if (this.commandPoints < (spec.requiredCp || 0)) {
      this.audio.play('empty');
      this.notify(
        'PONTOS DE COMANDO INSUFICIENTES',
        `QG Nível ${nextLevel} requer ${spec.requiredCp} CP (atual: ${this.commandPoints} CP).`,
        '#c94a38'
      );
      return false;
    }

    if (
      this.supplies < (spec.supplyCost || 0) ||
      this.fuel < (spec.fuelCost || 0) ||
      this.ammo < (spec.ammoCost || 0)
    ) {
      this.audio.play('empty');
      this.notify(
        'RECURSOS INSUFICIENTES',
        `QG Nível ${nextLevel} custa ${spec.supplyCost} SUP, ${spec.fuelCost} COMB${spec.ammoCost ? `, ${spec.ammoCost} MUN` : ''}.`,
        '#c94a38'
      );
      return false;
    }

    this.supplies -= spec.supplyCost || 0;
    this.fuel -= spec.fuelCost || 0;
    this.ammo -= spec.ammoCost || 0;
    this.hqLevel = nextLevel;

    const hqBld = this.baseBuildings.find((b) => b.faction === this.myFaction && b.isMainHQ && b.alive !== false);
    if (hqBld) {
      hqBld.level = nextLevel;
      hqBld.maxHp = (hqBld.maxHp || 2600) + 650;
      hqBld.hp = Math.min(hqBld.maxHp, (hqBld.hp || 2600) + 650);
      this.spawnText(hqBld.x, hqBld.y - 45, `⭐ QG EVOLUÍDO PARA NÍVEL ${nextLevel}!`, '#facc15');
    }

    this.audio.play('research_done');
    this.notify(
      `⭐ ${spec.name.toUpperCase()}`,
      `Desbloqueado: ${spec.unlocks}`,
      '#4ade80'
    );
    this._emitHud();
    return true;
  }

  // Recruta qualquer unidade imediatamente (usado pelos atalhos rápidos 1-3 e catálogo) saindo do prédio correspondente
  recruitUnitById(unitId) {
    const cmd = COMMAND_BY_ID[unitId];
    if (!cmd) return false;
    this.audio.resume();

    if ((cmd.requiredHqLevel || 1) > this.hqLevel) {
      this.notify(
        `🔒 REQUER QG NÍVEL ${cmd.requiredHqLevel}`,
        `${cmd.short} exige evoluir o Quartel-General para o Nível ${cmd.requiredHqLevel}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    if (cmd.requiresBuilding) {
      const hasBld = this.baseBuildings.some(
        (b) => b.faction === this.myFaction && b.buildingType === cmd.requiresBuilding && b.alive !== false
      );
      if (!hasBld) {
        const reqSpec = BASE_BUILDING_BY_ID[cmd.requiresBuilding];
        this.notify(
          'REQUER INSTALAÇÃO MILITAR',
          `Construa ${reqSpec ? reqSpec.short : cmd.requiresBuilding} no QG primeiro.`,
          '#c94a38'
        );
        this.audio.play('empty');
        return false;
      }
    }

    const supCost = cmd.cost || 0;
    const ammoCost = cmd.ammoCost || 0;
    const fuelCost = cmd.fuelCost || 0;

    if (this.supplies < supCost || this.ammo < ammoCost || this.fuel < fuelCost) {
      this.notify(
        'RECURSOS INSUFICIENTES',
        `Necessário ${supCost} SUP${ammoCost ? `, ${ammoCost} MUN` : ''}${fuelCost ? `, ${fuelCost} COMB` : ''}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    this.supplies -= supCost;
    this.ammo -= ammoCost;
    this.fuel -= fuelCost;

    const producerBld =
      this.baseBuildings.find(
        (b) =>
          b.faction === this.myFaction &&
          b.alive !== false &&
          b.buildingType === (cmd.requiresBuilding || 'hq_command')
      ) || this.map.hqs[this.myFaction] || this.map.hqs.player;

    const jitterX = randInt(-45, 45);
    const jitterY = randInt(-95, 95);
    const spawnOffset = this.myTeam === 'enemies' ? -145 : 145;
    const spawnAngle = this.myTeam === 'enemies' ? Math.PI : 0;
    const u = this.spawnUnit(this.myFaction, cmd.id, producerBld.x + spawnOffset + jitterX, producerBld.y + jitterY, spawnAngle);
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendCommand({ type: 'produce', unitType: cmd.id });
    }

    const destX = producerBld.rallyX
      ? clamp(producerBld.rallyX + jitterX, 160, BATTLEFIELD_SIZE - 160)
      : clamp(this.camera.x, 1200, BATTLEFIELD_SIZE - 1200);
    const destY = producerBld.rallyY
      ? clamp(producerBld.rallyY + jitterY, 160, BATTLEFIELD_SIZE - 160)
      : clamp(this.camera.y + jitterY, 450, BATTLEFIELD_SIZE - 450);
    u.setMoveOrder(destX, destY);

    for (const other of this.units) other.selected = false;
    u.selected = true;

    this.audio.play('cash');
    this.spawnText(u.x, u.y, `${cmd.short}`, '#7faed9');
    this.notify('UNIDADE MOBILIZADA NA BASE', `${cmd.name} marchando para o Ponto de Encontro.`, '#c87d28');
    this._emitHud();
    return true;
  }

  // Ativa Habilidade de Suporte Aéreo do Centro de Comando Aéreo / Radar
  triggerAirDoctrine(doctrineId) {
    const doc = AIR_DOCTRINE_BY_ID[doctrineId];
    if (!doc) return false;
    this.audio.resume();

    if ((doc.requiredHqLevel || 1) > this.hqLevel) {
      this.notify(
        `🔒 REQUER QG NÍVEL ${doc.requiredHqLevel}`,
        `${doc.short} exige Quartel-General Nível ${doc.requiredHqLevel}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    const hasAirCommand = this.baseBuildings.some(
      (b) => b.team === this.myTeam && b.buildingType === 'air_command' && b.alive !== false
    );
    if (!hasAirCommand) {
      this.notify(
        'COMANDO AÉREO NÃO CONSTRUÍDO',
        'Construa o Comando Aéreo & Radar no QG para habilitar suporte aéreo.',
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    const cd = this.airCooldowns[doctrineId] || 0;
    if (cd > 0) {
      this.notify('SUPORTE AÉREO EM RECARGA', `Aguarde ${Math.ceil(cd)}s para ${doc.short}.`, '#d4a338');
      this.audio.play('empty');
      return false;
    }

    if (this.supplies < (doc.cost || 0) || this.ammo < (doc.ammoCost || 0)) {
      this.notify(
        'RECURSOS INSUFICIENTES P/ SUPORTE AÉREO',
        `Necessário ${doc.cost} SUP e ${doc.ammoCost} MUN.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    if (this.activeAirStrikeMode === doctrineId) {
      this.activeAirStrikeMode = null;
      this.notify('SUPORTE AÉREO CANCELADO', '', '#9a9484');
    } else {
      this.activeAirStrikeMode = doctrineId;
      this.activeCommandMode = null;
      this.trenchPreview = null;
      this.notify(
        `ALVO AÉREO: ${doc.name.toUpperCase()}`,
        'Clique Esquerdo em qualquer ponto do mapa (ou minimapa) • Botão Direito cancela',
        '#38bdf8'
      );
      this.audio.play('switch');
    }
    this._emitHud();
    return true;
  }

  _executeAirDoctrineAt(doctrineId, targetX, targetY) {
    const doc = AIR_DOCTRINE_BY_ID[doctrineId];
    if (!doc) return;

    this.supplies -= doc.cost || 0;
    this.ammo -= doc.ammoCost || 0;
    this.airCooldowns[doctrineId] = doc.cooldown || 45;
    this.activeAirStrikeMode = null;

    const tx = clamp(targetX, 180, BATTLEFIELD_SIZE - 180);
    const ty = clamp(targetY, 180, BATTLEFIELD_SIZE - 180);

    // Cria aeronave 3D sobrevoando de Oeste para Leste passando pelo alvo
    this.aircrafts.push({
      id: `air_${doctrineId}_${Date.now()}`,
      type: doctrineId,
      x: tx - 1400,
      y: ty,
      targetX: tx,
      targetY: ty,
      vx: 760,
      vy: 0,
      angle: 0,
      altitude: doctrineId === 'recon_drone' ? 210 : 195,
      payloadDropped: false,
      life: 4.2,
    });

    if (doctrineId === 'recon_drone') {
      // Abre a Névoa de Guerra por 30 segundos na área escolhida e revela minas/trincheiras
      this.map.addTemporaryVision(tx, ty, doc.radius || 920, doc.duration || 30);
      for (const m of this.mines) {
        if (dist(m.x, m.y, tx, ty) <= (doc.radius || 920)) {
          m.revealed = true;
        }
      }
      for (const tr of this.trenches) {
        const c = tr.getCenter();
        if (dist(c.x, c.y, tx, ty) <= (doc.radius || 920)) {
          tr.revealed = true;
        }
      }
      this.audio.play('star');
      this.spawnText(tx, ty - 24, '🛩 RECONHECIMENTO AÉREO ATIVO (30s)', '#38bdf8');
      this.notify(
        'VOO DE RECONHECIMENTO EM CURSO',
        'Névoa de Guerra aberta por 30s na zona designada e minas/trincheiras reveladas!',
        '#38bdf8'
      );
    } else if (doctrineId === 'a10_strafe') {
      this.audio.play('rifle');
      this.spawnText(tx, ty - 24, '✈ RASANTE A-10 (30MM) EM CAMINHO!', '#f59e0b');
      this.notify('ATAQUE RASANTE A-10 DESIGNADO!', 'Canhão rotativo 30mm varrendo a linha alvo.', '#f59e0b');
    } else if (doctrineId === 'precision_bomb') {
      this.audio.play('reload');
      this.spawnText(tx, ty - 24, '💣 BOMBARDEIO TÁTICO GUIADO!', '#ef4444');
      this.notify('BOMBARDEIO DE PRECISÃO AUTORIZADO!', 'Bomba guiada a caminho das fortificações inimigas.', '#ef4444');
    }

    this._emitHud();
  }

  // Alterna a Aba/Categoria da Barra Inferior ([F1] Infantaria, [F2] Veículos, [F3] Engenharia, [F4] Defesas, [F5] Todos)
  setBottomCategory(categoryId) {
    const valid = ['infantry', 'vehicles', 'engineering', 'defenses', 'all'];
    if (!valid.includes(categoryId)) return false;
    this.activeBottomCategory = categoryId;
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  // Aciona qualquer botão da Barra Inferior pelo ID da ação (Unidades, Veículos, Engenharia ou Defesas)
  triggerActionById(actionId) {
    const cmd = COMMAND_BY_ID[actionId];
    if (!cmd) return false;
    this.audio.resume();

    if ((cmd.requiredHqLevel || 1) > this.hqLevel) {
      this.notify(
        `🔒 REQUER QG NÍVEL ${cmd.requiredHqLevel}`,
        `${cmd.short} exige evoluir o Quartel-General para o Nível ${cmd.requiredHqLevel}.`,
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    const slotIdx = COMMAND_ACTIONS.findIndex((c) => c.id === actionId);
    if (slotIdx >= 0) this.activeCommandSlot = slotIdx;

    if (cmd.category === 'unit') {
      this.activeCommandMode = null;
      this.activeEngineeringActionId = null;
      this.activeAirStrikeMode = null;
      this.trenchPreview = null;
      return this.recruitUnitById(cmd.id);
    }

    this.activeAirStrikeMode = null;
    if (this.activeCommandMode === cmd.category && this.activeEngineeringActionId === cmd.id) {
      this.activeCommandMode = null;
      this.activeEngineeringActionId = null;
      this.trenchPreview = null;
      this.notify('ORDEM DE ENGENHARIA CANCELADA', '', '#9a9484');
    } else {
      this.activeCommandMode = cmd.category;
      this.activeEngineeringActionId = cmd.id;
      const isDragMode =
        cmd.category === 'build_trench' ||
        cmd.category === 'build_barricade' ||
        cmd.category === 'build_wall' ||
        cmd.category === 'build_wire';
      this.notify(
        `ENGENHARIA: ${cmd.name.toUpperCase()}`,
        isDragMode
          ? 'Clique e arraste no mapa para traçar a linha • Botão Direito cancela'
          : `Clique no terreno para construir (${cmd.cost} SUP) • Botão Direito cancela`,
        '#d4a338'
      );
      this.audio.play('switch');
    }
    this._emitHud();
    return true;
  }

  // Altera a Formação Tática dos esquadrões selecionados (line | column | wedge | spread)
  setSelectedFormation(formationId) {
    const fSpec = SQUAD_FORMATION_BY_ID[formationId];
    if (!fSpec) return;
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    if (selected.length === 0) return;

    for (const u of selected) {
      u.setFormation(formationId);
    }
    this.audio.play('switch');
    this.spawnText(selected[0].x, selected[0].y - 20, `FORMAÇÃO: ${fSpec.name.toUpperCase()}`, '#7faed9');
    this.notify(`FORMAÇÃO TÁTICA: ${fSpec.name.toUpperCase()}`, fSpec.desc, '#7faed9');
    this._emitHud();
  }

  // Controle de Distanciamento / Espaçamento entre Soldados (1.0m a 8.0m) no COMANDO DE ESQUADRÃO
  setSelectedSpacing(meters) {
    const clamped = clamp(Number(meters) || 3.0, 1.0, 8.0);
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    if (selected.length === 0) return false;

    for (const u of selected) {
      if (typeof u.setSpacing === 'function') {
        u.setSpacing(clamped);
      } else {
        u.spacingMeters = clamped;
      }
    }
    this.audio.play('switch');
    this.spawnText(
      selected[0].x,
      selected[0].y - 18,
      `↔ ESPAÇAMENTO: ${clamped.toFixed(1)}m`,
      '#7faed9'
    );
    this._emitHud();
    return true;
  }

  // Habilidades Táticas do Esquadrão ([G] Granada, [F] Supressão, [C] Kit Médico, Postura e Foco)
  focusSelectedUnit(unitId) {
    this.focusedUnitId = unitId;
    this.audio.play('switch');
    this._emitHud();
  }

  throwSelectedGrenade() {
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry');
    if (selected.length === 0) return false;
    const lead = selected[0];
    if ((lead.grenadeAbilityCooldown || 0) > 0) {
      this.audio.play('empty');
      this.notify('GRANADA EM RECARGA', `Aguarde ${Math.ceil(lead.grenadeAbilityCooldown)}s.`, '#d4a338');
      return false;
    }
    if (this.ammo < 15) {
      this.audio.play('empty');
      this.notify('MUNIÇÃO INSUFICIENTE', 'Granada tática requer 15 MUN.', '#c94a38');
      return false;
    }
    const enemyTeam = this.myTeam === 'enemies' ? 'allies' : 'enemies';
    const target = this._findUnitNearWorld(lead.x, lead.y, 260, (e) => e.team === enemyTeam && !e.surrendered);
    const gx = target ? target.x : lead.x + Math.cos(lead.angle) * 160;
    const gy = target ? target.y : lead.y + Math.sin(lead.angle) * 160;
    this.ammo -= 15;
    for (const u of selected) u.grenadeAbilityCooldown = 12.0;

    if (this.renderer?.vfx) {
      const sy = getTerrainHeight(lead.x, lead.y, this.map) + 10;
      const ty = getTerrainHeight(gx, gy, this.map) + 4;
      this.renderer.vfx.spawnGrenadeArc(lead.x, sy, lead.y, gx, ty, gy, 0.55);
    }
    this.pendingGrenades.push({ x: gx, y: gy, team: this.myTeam, timer: 0.55 });
    this.audio.play('switch');
    this.spawnText(lead.x, lead.y - 16, '💣 GRANADA ARREMESSADA!', '#f97316');
    this._emitHud();
    return true;
  }

  toggleSelectedSuppression() {
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    if (selected.length === 0) return false;
    const lead = selected[0];
    if ((lead.suppressionCooldown || 0) > 0) {
      this.audio.play('empty');
      this.notify('SUPRESSÃO EM RECARGA', `Aguarde ${Math.ceil(lead.suppressionCooldown)}s.`, '#d4a338');
      return false;
    }
    if (this.ammo < 10) {
      this.audio.play('empty');
      this.notify('MUNIÇÃO INSUFICIENTE', 'Fogo de Supressão requer 10 MUN.', '#c94a38');
      return false;
    }
    this.ammo -= 10;
    for (const u of selected) {
      u.suppressionMode = true;
      u.suppressionActiveTimer = 8.0;
      u.suppressionCooldown = 15.0;
    }
    this.audio.play('switch');
    this.spawnText(lead.x, lead.y - 18, '🔥 FOGO DE SUPRESSÃO (8s)!', '#fbbf24');
    this._emitHud();
    return true;
  }

  useSelectedMedkit() {
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry');
    if (selected.length === 0) return false;
    const lead = selected[0];
    if ((lead.medkitCooldown || 0) > 0) {
      this.audio.play('empty');
      this.notify('KIT MÉDICO EM RECARGA', `Aguarde ${Math.ceil(lead.medkitCooldown)}s.`, '#d4a338');
      return false;
    }
    if (this.supplies < 20) {
      this.audio.play('empty');
      this.notify('SUPRIMENTOS INSUFICIENTES', 'Kit Médico requer 20 SUP.', '#c94a38');
      return false;
    }
    this.supplies -= 20;
    for (const u of selected) {
      u.medkitHealTimer = 5.0; // Cura +45 HP ao longo de 5 segundos (+9 HP/s)
      u.medkitCooldown = 20.0;
    }
    this.audio.play('pickup');
    this.spawnText(lead.x, lead.y - 18, '✚ KIT MÉDICO ATIVO (+45 HP / 5s)', '#4ade80');
    this._emitHud();
    return true;
  }

  setSelectedStance(stance) {
    const valid = stance === 'crouch' || stance === 'prone' ? stance : 'stand';
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry');
    if (selected.length === 0) return false;
    for (const u of selected) {
      u.stance = valid;
      u.crouchedInCover = valid !== 'stand' || u.inHeavyCover || u.inTrench;
    }
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  // [Tecla B / R]: Retornar à Base para Reparo (Veículos) ou Recuar para o QG (Infantaria)
  returnSelectedToBase() {
    const selected = this.units.filter((u) => u.alive && u.faction === 'player' && u.selected && !u.embarkedInId);
    if (selected.length === 0) return false;

    const hqBld =
      this.baseBuildings.find((b) => b.faction === 'player' && b.isMainHQ && b.alive !== false) ||
      this.map.hqs.player;
    const motorBld = this.baseBuildings.find(
      (b) => b.faction === 'player' && b.buildingType === 'motor_pool' && b.alive !== false
    );

    for (const u of selected) {
      if (u.garrisonedBuildingId) {
        const st = this.map.structures.find((s) => s.id === u.garrisonedBuildingId);
        if (st) {
          st.garrisonUnitId = null;
          st.garrisonTeam = null;
        }
        u.garrisonedBuildingId = null;
      }
      u.coverSnap = null;
      u.snappedToCover = false;
      u.holdPosition = false;

      const isVeh = u.spec.type === 'vehicle';
      const targetBld =
        isVeh && motorBld && dist(u.x, u.y, motorBld.x, motorBld.y) < dist(u.x, u.y, hqBld.x, hqBld.y)
          ? motorBld
          : hqBld;
      const destX = clamp((targetBld?.x || 1150) + 145, 120, BATTLEFIELD_SIZE - 120);
      const destY = clamp((targetBld?.y || 4800) + (Math.random() - 0.5) * 90, 120, BATTLEFIELD_SIZE - 120);

      u.retreating = !isVeh;
      u.order = {
        type: 'rtb',
        targetX: destX,
        targetY: destY,
        targetUnitId: null,
        targetTrenchId: null,
        targetBuildingId: null,
        targetTransportId: null,
        facingAngle: 0,
      };
      u.waypoints = this.map.computeObstacleDetourPath(
        u.x,
        u.y,
        destX,
        destY,
        u.radius,
        this.fortifiedWalls,
        this.barricades
      );
    }

    this.audio.play('switch');
    const anyVeh = selected.some((u) => u.spec.type === 'vehicle');
    this.spawnText(
      selected[0].x,
      selected[0].y - 20,
      anyVeh ? '🏠 RETORNANDO À BASE P/ REPARO' : '🏃 RECUANDO PARA O QG!',
      '#38bdf8'
    );
    this._emitHud();
    return true;
  }

  // Seleciona / Desmarca um Soldado Individual no COMANDO DE ESQUADRÃO ou com Shift+Clique no mapa 3D
  toggleSelectSoldierInUnit(unitId, soldierId, exclusive = false) {
    const u =
      (unitId && this.units.find((unit) => unit.id === unitId && unit.alive)) ||
      this.units.find((unit) => unit.alive && unit.faction === 'player' && unit.selected);
    if (!u || !u.soldiers || u.soldiers.length === 0) return false;

    u.toggleSelectSoldier(soldierId, exclusive);
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  // [Separar Soldado - Tecla K]: Destaca 1 ou mais soldados selecionados como um novo Esquadrão Independente (Batedor)
  splitSelectedSoldiers(unitId = null) {
    const u =
      (unitId && this.units.find((unit) => unit.id === unitId && unit.alive && unit.faction === 'player')) ||
      this.units.find(
        (unit) => unit.alive && unit.faction === 'player' && unit.selected && unit.spec.type === 'infantry'
      );

    if (!u || u.spec.type !== 'infantry') {
      this.notify('SELECIONE UM ESQUADRÃO DE INFANTARIA', 'Apenas esquadrões de infantaria podem destacar soldados.', '#d4a338');
      return null;
    }

    const living = u.soldiers.filter((s) => s.alive);
    if (living.length < 2) {
      this.notify('EFETIVO MÍNIMO ATINGIDO', 'É necessário pelo menos 2 soldados vivos no esquadrão para separar.', '#c94a38');
      this.audio.play('empty');
      return null;
    }

    let chosen = u.getSelectedSoldiers();
    if (chosen.length === 0) {
      // Se nenhum soldado estiver marcado individualmente, destaca 1 batedor (o último soldado vivo da lista)
      chosen = [living[living.length - 1]];
    } else if (chosen.length >= living.length) {
      // Mantém pelo menos 1 soldado no esquadrão original
      chosen = chosen.slice(0, living.length - 1);
    }

    const detachedSoldiers = u.removeSoldiersByIds(chosen.map((s) => s.id));
    if (detachedSoldiers.length === 0) return null;

    const offsetAngle = (u.angle || 0) + 0.35;
    const spawnX = clamp(u.x + Math.cos(offsetAngle) * 34, 90, BATTLEFIELD_SIZE - 90);
    const spawnY = clamp(u.y + Math.sin(offsetAngle) * 34, 90, BATTLEFIELD_SIZE - 90);

    const newSquad = new SquadUnit({
      x: spawnX,
      y: spawnY,
      faction: u.faction,
      unitType: u.unitType,
      angle: u.angle || 0,
      customSoldiers: detachedSoldiers,
      spacingMeters: u.spacingMeters || 3.0,
    });
    newSquad.setFormation(u.formation || 'line');

    const destX = clamp(u.x + Math.cos(u.angle || 0) * 68 + 26, 90, BATTLEFIELD_SIZE - 90);
    const destY = clamp(u.y + Math.sin(u.angle || 0) * 68 + 26, 90, BATTLEFIELD_SIZE - 90);
    newSquad.setMoveOrder(destX, destY);

    this.units.push(newSquad);

    for (const other of this.units) other.selected = false;
    newSquad.selected = true;

    this.audio.play('pickup');
    const names = detachedSoldiers.map((s) => s.name).join(', ');
    this.spawnText(
      newSquad.x,
      newSquad.y - 20,
      `✂ DESTACAMENTO: ${detachedSoldiers.length} SOLDADO(S)`,
      '#a3be8c'
    );
    this.notify(
      'SOLDADO(S) DESTACADO(S) [TECLA K]',
      `${names} agora formam um esquadrão independente sob seu comando.`,
      '#a3be8c'
    );
    this._emitHud();
    return newSquad;
  }

  // [Transferir ➡️]: Transfere soldados selecionados (ou 1 soldado) de um esquadrão para outro esquadrão aliado
  transferSoldiersToSquad(sourceUnitId = null, targetUnitId = null, soldierIds = null) {
    const sourceUnit =
      (sourceUnitId && this.units.find((u) => u.id === sourceUnitId && u.alive && u.faction === this.myFaction)) ||
      this.units.find(
        (u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry'
      );

    if (!sourceUnit || sourceUnit.spec.type !== 'infantry') {
      this.notify('SELECIONE INFANTARIA', 'Selecione um esquadrão de infantaria para transferir soldados.', '#d4a338');
      return false;
    }

    let targetUnit = targetUnitId
      ? this.units.find((u) => u.id === targetUnitId && u.alive && u.faction === this.myFaction && u.spec.type === 'infantry')
      : null;

    if (!targetUnit) {
      // Se 2 esquadrões estiverem selecionados, transfere do 2º para o 1º (ou do 1º para o 2º)
      const selectedInf = this.units.filter(
        (u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry'
      );
      if (selectedInf.length >= 2) {
        targetUnit = selectedInf.find((u) => u.id !== sourceUnit.id) || selectedInf[0];
      } else {
        // Caso contrário, encontra o esquadrão aliado de infantaria mais próximo no campo
        let bestD = Infinity;
        for (const other of this.units) {
          if (
            !other.alive ||
            other.id === sourceUnit.id ||
            other.faction !== this.myFaction ||
            other.spec.type !== 'infantry'
          ) {
            continue;
          }
          const d = dist(sourceUnit.x, sourceUnit.y, other.x, other.y);
          if (d < bestD) {
            bestD = d;
            targetUnit = other;
          }
        }
      }
    }

    if (!targetUnit || targetUnit.id === sourceUnit.id) {
      this.notify(
        'NENHUM ESQUADRÃO DESTINO DISPONÍVEL',
        'Recrute ou posicione outro esquadrão de infantaria aliado para receber os soldados.',
        '#c94a38'
      );
      this.audio.play('empty');
      return false;
    }

    const living = sourceUnit.soldiers.filter((s) => s.alive);
    if (living.length === 0) return false;

    let idsToTransfer = [];
    if (Array.isArray(soldierIds) && soldierIds.length > 0) {
      idsToTransfer = soldierIds;
    } else {
      const checked = sourceUnit.getSelectedSoldiers();
      if (checked.length > 0) {
        idsToTransfer = checked.map((s) => s.id);
      } else {
        // Se nenhum soldado específico foi marcado, transfere 1 soldado vivo
        idsToTransfer = [living[living.length - 1].id];
      }
    }

    const transferred = sourceUnit.removeSoldiersByIds(idsToTransfer);
    if (transferred.length === 0) return false;

    targetUnit.addTransferredSoldiers(transferred);

    this.audio.play('pickup');
    this.spawnText(
      targetUnit.x,
      targetUnit.y - 22,
      `⇄ +${transferred.length} SOLDADO(S) INTEGRADO(S)!`,
      '#38bdf8'
    );
    const names = transferred.map((s) => s.name).join(', ');
    this.notify(
      'TRANSFERÊNCIA DE TROPAS CONCLUÍDA',
      `${names} juntou-se a ${targetUnit.name} (${targetUnit.soldiersAlive}/${targetUnit.maxSoldiers} soldados).`,
      '#38bdf8'
    );
    this._emitHud();
    return true;
  }

  // Mescla dois ou mais esquadrões de infantaria selecionados em um único esquadrão reforçado
  mergeSelectedSquads() {
    const selectedInf = this.units.filter(
      (u) => u.alive && u.faction === this.myFaction && u.selected && u.spec.type === 'infantry'
    );
    if (selectedInf.length < 2) {
      return this.transferSoldiersToSquad();
    }
    const primary = selectedInf[0];
    let totalMerged = 0;
    for (let i = 1; i < selectedInf.length; i++) {
      const donor = selectedInf[i];
      const livingIds = donor.soldiers.filter((s) => s.alive).map((s) => s.id);
      const removed = donor.removeSoldiersByIds(livingIds);
      if (removed.length > 0) {
        primary.addTransferredSoldiers(removed);
        totalMerged += removed.length;
      }
    }
    if (totalMerged > 0) {
      this.audio.play('pickup');
      this.spawnText(primary.x, primary.y - 24, `⇄ ESQUADRÕES MESCLADOS (+${totalMerged} SOLDADOS)`, '#a3be8c');
      this.notify(
        'ESQUADRÕES REORGANIZADOS',
        `${totalMerged} soldado(s) integrados ao esquadrão principal (${primary.soldiersAlive} efetivos).`,
        '#a3be8c'
      );
      this._emitHud();
      return true;
    }
    return false;
  }

  // Tecla [H] ou botão na HUD: Trava/Destrava Posição (Hold Position)
  toggleSelectedHoldPosition() {
    const selected = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    if (selected.length === 0) return;

    const targetState = !selected[0].holdPosition;
    for (const u of selected) {
      u.holdPosition = targetState;
      if (targetState) {
        u.vx = 0;
        u.vy = 0;
        u.order.type = 'hold';
      }
    }
    this.audio.play('switch');
    this.spawnText(
      selected[0].x,
      selected[0].y - 22,
      targetState ? '🔒 POSIÇÃO TRAVADA [H]' : '🔓 MOVIMENTO LIVRE [H]',
      targetState ? '#f59e0b' : '#a3be8c'
    );
    this._emitHud();
  }

  // Tecla [U] ou botão "Sair do Prédio" na HUD: Desocupa casas/prédios
  ungarrisonSelected() {
    const garrisoned = this.units.filter(
      (u) => u.alive && u.faction === 'player' && u.selected && u.garrisonedBuildingId
    );
    if (garrisoned.length === 0) return;
    for (const u of garrisoned) {
      this._ungarrisonUnit(u);
    }
    this.audio.play('door');
    this.spawnText(garrisoned[0].x, garrisoned[0].y - 18, '🚪 GUARNIÇÃO DESOCUPADA', '#d4a338');
    this._emitHud();
  }

  start() {
    this.resize();
    this.lastTs = performance.now();

    const stepSimulation = (now) => {
      let elapsed = (now - this.lastTs) / 1000;
      if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;
      this.lastTs = now;
      // Limita o catch-up acumulado e divide em passos seguros de <= 0.05s para física estável
      let remaining = Math.min(0.25, elapsed);
      let lastDt = Math.min(0.05, remaining || 0.016);
      while (remaining > 0.0001) {
        const stepDt = Math.min(0.05, remaining);
        this.update(stepDt);
        lastDt = stepDt;
        remaining -= stepDt;
      }
      return lastDt;
    };

    const tick = (ts) => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      const dt = stepSimulation(ts);
      this.renderer?.render(this, dt);
      this.input.endFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    // Hybrid RAF + Web Worker Heartbeat (20 ticks/s): mantém simulação e rede ativas com aba minimizada/oculta
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && !this._bgWorker) {
      try {
        const workerCode = `
          let timer = null;
          self.onmessage = function(e) {
            if (e.data === 'start') {
              if (!timer) timer = setInterval(function() { self.postMessage('tick'); }, 50);
            } else if (e.data === 'stop') {
              if (timer) { clearInterval(timer); timer = null; }
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this._bgWorker = new Worker(workerUrl);
        this._bgWorker.onmessage = () => {
          if (typeof document !== 'undefined' && document.hidden) {
            stepSimulation(performance.now());
            this.input.endFrame();
          }
        };
        this._bgWorker.postMessage('start');

        document.addEventListener('visibilitychange', () => {
          this.lastTs = performance.now();
        });
      } catch (err) {
        console.warn('Background worker fallback:', err);
      }
    }
  }

  resize() {
    if (!this.canvas || !this.renderer) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.resize(w, h);
  }

  setMenuActive(flag) {
    this.menuActive = flag;
    if (this.audio?.setMusicMode) {
      this.audio.setMusicMode(flag ? 'menu' : this.paused ? 'paused' : 'battle');
    }
    this._emitHud();
  }

  setPaused(flag) {
    this.paused = flag;
    if (this.audio?.setMusicMode && !this.menuActive) {
      this.audio.setMusicMode(flag ? 'paused' : 'battle');
    }
    this._emitHud();
  }

  _triggerGameOver(winnerTeam, title, subtitle) {
    if (this.gameOver) return;
    this.victoryState = winnerTeam;
    this.gameOver = true;
    this.activeCommandMode = null;
    this.activeAirStrikeMode = null;
    this.activeDroneLaunchMode = null;
    this.techModalOpen = false;
    this.tacticalMapOpen = false;
    if (this.audio?.setMusicMode) this.audio.setMusicMode('paused');
    this.audio.play(winnerTeam === 'allies' ? 'win' : 'defeat');
    this.notify(title, subtitle, winnerTeam === 'allies' ? '#a3be8c' : '#c94a38');
    if (this.networkManager?.addAccountXp) {
      const won = winnerTeam === (this.localPlayerTeam || 'allies');
      this.networkManager.addAccountXp(won ? 300 : 120, {
        isCampaign: Boolean(this.isCampaign),
        won,
      });
    }
    this._emitHud();
  }

  // ============================================================================
  // TRANSPORTE DE TROPAS (EMBARQUE / DESEMBARQUE TECLA [U])
  // ============================================================================
  disembarkAllFromTransport(transportId) {
    const tr = this.units.find(
      (u) => u.id === transportId && u.alive && u.spec.isTransport
    );
    if (!tr || !tr.cargoSquadIds || tr.cargoSquadIds.length === 0) return 0;

    tr.rampOpenTimer = 1.8;
    const disembarked = [];
    const backAngle = tr.angle + Math.PI;
    const candidateAngles = [0, -0.55, 0.55, -1.15, 1.15, -1.75, 1.75, Math.PI];

    tr.cargoSquadIds.forEach((sid, idx) => {
      const sq = this.units.find((u) => u.id === sid && u.alive);
      if (!sq) return;

      // Busca posição livre em arco atrás/ao redor do veículo (evitando paredes/muros)
      let chosenX = clamp(tr.x + Math.cos(backAngle) * 58, 80, BATTLEFIELD_SIZE - 80);
      let chosenY = clamp(tr.y + Math.sin(backAngle) * 58, 80, BATTLEFIELD_SIZE - 80);
      for (let aIdx = 0; aIdx < candidateAngles.length; aIdx++) {
        const ang = backAngle + candidateAngles[(aIdx + idx) % candidateAngles.length];
        const distOut = 58 + idx * 16;
        const tx = clamp(tr.x + Math.cos(ang) * distOut, 80, BATTLEFIELD_SIZE - 80);
        const ty = clamp(tr.y + Math.sin(ang) * distOut, 80, BATTLEFIELD_SIZE - 80);
        const resolved = this.map.resolveObstacleCollision(tx, ty, sq.radius || 22, null, this.fortifiedWalls);
        if (Math.hypot(resolved.x - tx, resolved.y - ty) < 8) {
          chosenX = resolved.x;
          chosenY = resolved.y;
          break;
        }
      }

      sq.embarkedInId = null;
      sq.inTransport = false;
      sq.boardedVehicle = null;
      sq.targetPos = null;
      sq.transportGraceTimer = 1.5; // 1.5s de imunidade de colisão com o veículo ao desembarcar
      sq.x = chosenX;
      sq.y = chosenY;
      sq.lastValidPos = { x: chosenX, y: chosenY };
      sq.angle = tr.angle;
      sq.facingAngle = tr.angle;
      sq.vx = 0;
      sq.vy = 0;
      for (let i = 0; i < (sq.soldiers || []).length; i++) {
        const s = sq.soldiers[i];
        const off = sq.memberOffsets?.[i] || { ox: (i - 2) * 14, oy: 0 };
        s.worldX = chosenX + off.ox;
        s.worldY = chosenY + off.oy;
        s.personalTarget = { x: s.worldX, y: s.worldY };
        s.targetPos = null;
        s.reactionTimer = 0;
        s._autonomousInit = false;
      }
      sq.updateSoldierWorldPositions();
      sq.setMoveOrder(
        clamp(chosenX + Math.cos(backAngle) * 20, 80, BATTLEFIELD_SIZE - 80),
        clamp(chosenY + Math.sin(backAngle) * 20, 80, BATTLEFIELD_SIZE - 80)
      );
      disembarked.push(sq);
    });
    tr.cargoSquadIds = [];
    if (disembarked.length > 0) {
      this.audio.play('embark');
      this.spawnText(
        tr.x,
        tr.y - 24,
        `🚪 ${disembarked.length} ESQUADRÃO(ÕES) DESEMBARCADO(S)!`,
        '#4ade80'
      );
      this._emitHud();
    }
    return disembarked.length;
  }

  // ============================================================================
  // ÁRVORE DE PESQUISA & DESENVOLVIMENTO MILITAR (TECH TREE % + DRONES 3D)
  // ============================================================================
  toggleTechModal(force) {
    this.techModalOpen = typeof force === 'boolean' ? force : !this.techModalOpen;
    this.audio.play('switch');
    this._emitHud();
  }

  setTechBudgetPct(pct) {
    this.selectedBudgetTier = clamp(Number(pct) || 0.25, 0.25, 0.75);
    this.audio.play('switch');
    this._emitHud();
  }

  startResearch(techId, budgetPct = this.selectedBudgetTier) {
    const tech = TECH_NODE_BY_ID[techId];
    if (!tech) return false;
    if (this.completedTechs.has(techId)) {
      this.notify('PESQUISA JÁ CONCLUÍDA', tech.name, '#9a9484');
      return false;
    }
    if ((tech.requiredHqLevel || 1) > this.hqLevel) {
      this.audio.play('empty');
      this.notify(
        `🔒 REQUER QG NÍVEL ${tech.requiredHqLevel}`,
        `${tech.short} exige QG Nível ${tech.requiredHqLevel}.`,
        '#c94a38'
      );
      return false;
    }
    if (this.commandPoints < (tech.requiredCp || 0)) {
      this.audio.play('empty');
      this.notify(
        `🔒 REQUER ${tech.requiredCp} CP`,
        `${tech.short} exige ${tech.requiredCp} Pontos de Comando (atual: ${this.commandPoints} CP).`,
        '#c94a38'
      );
      return false;
    }
    if (tech.requiresTech && !this.completedTechs.has(tech.requiresTech)) {
      const reqName = TECH_NODE_BY_ID[tech.requiresTech]?.short || tech.requiresTech;
      this.audio.play('empty');
      this.notify('🔒 REQUER PESQUISA ANTERIOR', `Conclua ${reqName} primeiro.`, '#c94a38');
      return false;
    }
    if (this.activeResearch) {
      this.notify(
        'LABORATÓRIO OCUPADO',
        `Aguarde concluir: ${TECH_NODE_BY_ID[this.activeResearch.techId]?.short || 'Pesquisa'}`,
        '#d4a338'
      );
      return false;
    }

    const { supplyCost, ammoCost, fuelCost, duration, speedMult, pct } = computeTechResearchCost(
      tech,
      this.supplies,
      this.fuel,
      budgetPct,
      this.ammo
    );
    if (this.supplies < supplyCost || this.ammo < ammoCost || this.fuel < fuelCost) {
      this.audio.play('empty');
      this.notify(
        'ORÇAMENTO INSUFICIENTE',
        `Necessário ${supplyCost} SUP${ammoCost ? `, ${ammoCost} MUN` : ''}${fuelCost ? ` e ${fuelCost} COMB` : ''}.`,
        '#c94a38'
      );
      return false;
    }

    this.supplies -= supplyCost;
    this.ammo -= ammoCost;
    this.fuel -= fuelCost;
    this.activeResearch = {
      techId,
      progress: 0,
      duration,
      speedMult,
      pct,
      supplyCost,
      fuelCost,
    };
    this.audio.play('cash');
    this.notify(
      `🔬 PESQUISA INICIADA: ${tech.short.toUpperCase()}`,
      `Investimento de ${Math.round(pct * 100)}% (${supplyCost} SUP) • Conclusão em ${duration}s`,
      '#60a5fa'
    );
    this._emitHud();
    return true;
  }

  _applyTechUpgradeEffects(techId) {
    if (techId === 'kevlar_vests') {
      for (const u of this.units) {
        if (u.faction === 'player' && u.spec.type === 'infantry') {
          for (const s of u.soldiers) {
            if (!s.alive) continue;
            s.maxHp = Math.round(s.maxHp * 1.25);
            s.hp = Math.round(s.hp * 1.25);
          }
          u.syncSquadHealthFromSoldiers();
        }
      }
    } else if (techId === 'reactive_armor') {
      for (const u of this.units) {
        if (u.faction === 'player' && u.spec.type === 'vehicle') {
          u.maxHp = Math.round(u.maxHp * 1.35);
          u.hp = Math.round(u.hp * 1.35);
        }
      }
    }
  }

  _updateResearch(dt) {
    // Interceptação de Rádio: revela periodicamente veículos inimigos no minimapa
    if (this.completedTechs.has('radio_intercept')) {
      this.radioInterceptTimer -= dt;
      if (this.radioInterceptTimer <= 0) {
        this.radioInterceptTimer = 6.0;
        for (const u of this.units) {
          if (u.alive && u.team === 'enemies' && u.spec.type === 'vehicle') {
            this.map.revealFogArea(u.x, u.y, 190, 4.5);
          }
        }
      }
    }

    if (!this.activeResearch) return;
    this.activeResearch.progress += dt;
    if (this.activeResearch.progress >= this.activeResearch.duration) {
      const doneId = this.activeResearch.techId;
      const tech = TECH_NODE_BY_ID[doneId];
      this.completedTechs.add(doneId);
      this.activeResearch = null;
      this.matchStats.researchesCompleted = (this.matchStats.researchesCompleted || 0) + 1;
      this._applyTechUpgradeEffects(doneId);
      this.audio.play('research_done');
      this.notify(
        `✅ PESQUISA CONCLUÍDA: ${tech?.short.toUpperCase() || doneId}`,
        tech?.effectText || 'Tecnologia militar aplicada ao batalhão!',
        '#4ade80'
      );
      this._emitHud();
    }
  }

  hasDroneFactory() {
    return this.baseBuildings.some(
      (b) => b.faction === this.myFaction && b.buildingType === 'drone_factory' && b.alive !== false
    );
  }

  getTotalDroneStockCount() {
    return (this.droneStock?.uav_recon || 0) + (this.droneStock?.fpv_kamikaze || 0);
  }

  queueDroneProduction(droneType) {
    if (this.hqLevel < 3) {
      this.audio.play('empty');
      this.notify('🔒 REQUER QG NÍVEL 3', 'Drones de Guerra exigem QG Nível 3.', '#c94a38');
      return false;
    }
    if (!this.hasDroneFactory()) {
      this.audio.play('empty');
      this.notify('🔒 REQUER FÁBRICA DE DRONES', 'Construa a Fábrica de Drones Táticos no QG primeiro.', '#c94a38');
      return false;
    }
    if (!this.completedTechs.has(droneType)) {
      this.audio.play('empty');
      this.notify('TECNOLOGIA BLOQUEADA', 'Pesquise este Drone na Árvore de Pesquisa [T].', '#c94a38');
      return false;
    }
    const usedSlots = this.getTotalDroneStockCount() + this.droneQueue.length;
    if (usedSlots >= this.maxDroneStock) {
      this.audio.play('empty');
      this.notify('HANGAR DE DRONES LOTADO', `Capacidade máxima de ${this.maxDroneStock} drones em estoque/fila.`, '#d4a338');
      return false;
    }
    const isKamikaze = droneType === 'fpv_kamikaze';
    const supCost = isKamikaze ? 500 : 350;
    const ammoCost = isKamikaze ? 200 : 120;
    if (this.supplies < supCost || this.ammo < ammoCost) {
      this.audio.play('empty');
      this.notify('RECURSOS INSUFICIENTES', `Necessário ${supCost} SUP e ${ammoCost} MUN.`, '#c94a38');
      return false;
    }
    this.supplies -= supCost;
    this.ammo -= ammoCost;
    this.droneQueue.push({
      type: droneType,
      duration: this.sandboxMode ? 0.2 : isKamikaze ? 9.0 : 7.0,
      elapsed: 0,
    });
    this.audio.play('cash');
    this.notify(
      isKamikaze ? '💥 FABRICANDO DRONE FPV' : '🛸 FABRICANDO DRONE UAV',
      `Em produção na Fábrica de Drones (${usedSlots + 1}/${this.maxDroneStock}).`,
      '#38bdf8'
    );
    this._emitHud();
    return true;
  }

  _updateDroneFactory(dt) {
    if (!this.droneQueue || this.droneQueue.length === 0) return;
    if (!this.hasDroneFactory()) return;
    const current = this.droneQueue[0];
    current.elapsed += dt;
    if (current.elapsed >= current.duration) {
      this.droneQueue.shift();
      this.droneStock[current.type] = (this.droneStock[current.type] || 0) + 1;
      this.audio.play('research_done');
      this.notify(
        current.type === 'fpv_kamikaze' ? '💥 DRONE FPV PRONTO' : '🛸 DRONE UAV PRONTO',
        'Drone armazenado no hangar e pronto para lançamento!',
        '#4ade80'
      );
      this._emitHud();
    }
  }

  triggerDroneLaunchMode(droneType) {
    if (this.hqLevel < 3) {
      this.audio.play('empty');
      this.notify('🔒 REQUER QG NÍVEL 3', 'Drones de Guerra exigem QG Nível 3.', '#c94a38');
      return false;
    }
    if (!this.hasDroneFactory()) {
      this.audio.play('empty');
      this.notify('🔒 REQUER FÁBRICA DE DRONES', 'Construa a Fábrica de Drones Táticos no QG primeiro.', '#c94a38');
      return false;
    }
    if (!this.completedTechs.has(droneType)) {
      this.audio.play('empty');
      this.notify('TECNOLOGIA BLOQUEADA', 'Pesquise este Drone na Árvore de Pesquisa [T].', '#c94a38');
      return false;
    }
    if ((this.droneStock?.[droneType] || 0) <= 0) {
      this.audio.play('empty');
      this.notify('SEM DRONES NO HANGAR', 'Fabrique um drone na Fábrica de Drones antes de lançar.', '#d4a338');
      return false;
    }
    const activeMyDrones = this.activeDrones.filter((d) => d.alive && (d.team || this.myTeam) === this.myTeam).length;
    if (activeMyDrones >= this.maxActiveDrones) {
      this.audio.play('empty');
      this.notify('LIMITE DE VOO ATINGIDO', `Máximo de ${this.maxActiveDrones} drones ativos simultaneamente.`, '#d4a338');
      return false;
    }
    this.activeDroneLaunchMode = this.activeDroneLaunchMode === droneType ? null : droneType;
    this.activeCommandMode = null;
    this.activeAirStrikeMode = null;
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  launchDrone(droneType, wx, wy) {
    if (this.hqLevel < 3 || !this.completedTechs.has(droneType) || !this.hasDroneFactory()) return false;
    if ((this.droneStock?.[droneType] || 0) <= 0) {
      this.audio.play('empty');
      this.notify('SEM DRONES NO HANGAR', 'Fabrique um drone na Fábrica de Drones antes de lançar.', '#d4a338');
      return false;
    }
    const activeMyDrones = this.activeDrones.filter((d) => d.alive && (d.team || this.myTeam) === this.myTeam).length;
    if (activeMyDrones >= this.maxActiveDrones) {
      this.audio.play('empty');
      this.notify('LIMITE DE VOO ATINGIDO', `Máximo de ${this.maxActiveDrones} drones ativos simultaneamente.`, '#d4a338');
      return false;
    }
    const isKamikaze = droneType === 'fpv_kamikaze';
    this.droneStock[droneType] -= 1;

    const factoryBld = this.baseBuildings.find(
      (b) => b.faction === this.myFaction && b.buildingType === 'drone_factory' && b.alive !== false
    );
    const origin = factoryBld || this.map.hqs[this.myFaction] || this.map.hqs.player || { x: 850, y: 4800 };
    const ang = Math.atan2(wy - origin.y, wx - origin.x);
    this.activeDrones.push({
      id: `drn_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      type: droneType,
      team: this.myTeam,
      x: origin.x,
      y: origin.y,
      z: isKamikaze ? 55 : 115,
      targetX: clamp(wx, 100, BATTLEFIELD_SIZE - 100),
      targetY: clamp(wy, 100, BATTLEFIELD_SIZE - 100),
      angle: ang,
      speed: isKamikaze ? 360 : 260,
      life: isKamikaze ? 24 : 45,
      orbitPhase: 0,
      alive: true,
    });
    this.audio.play('drone_launch');
    this.spawnText(
      wx,
      wy - 18,
      isKamikaze ? '💥 DRONE KAMIKAZE FPV LANÇADO!' : '🛸 DRONE UAV RECON EM VOO!',
      isKamikaze ? '#f97316' : '#38bdf8'
    );
    this._emitHud();
    return true;
  }

  _updateDrones(dt) {
    this._updateDroneFactory(dt);
    for (const dr of this.activeDrones) {
      if (!dr.alive) continue;
      dr.life -= dt;
      if (dr.life <= 0) {
        dr.alive = false;
        continue;
      }

      if (dr.type === 'fpv_kamikaze') {
        // Busca automaticamente tanque ou trincheira inimiga próxima do alvo
        const lock = this._findUnitNearWorld(
          dr.targetX,
          dr.targetY,
          260,
          (u) => u.team === 'enemies' && !u.surrendered
        );
        const tx = lock ? lock.x : dr.targetX;
        const ty = lock ? lock.y : dr.targetY;
        const dx = tx - dr.x;
        const dy = ty - dr.y;
        const d = Math.hypot(dx, dy);
        dr.angle = Math.atan2(dy, dx);
        if (d <= 28) {
          // Detonação FPV sobre trincheira/tanque
          dr.alive = false;
          this.spawnExplosionParticles(tx, ty, 38);
          this.playSoundAt('explosion', tx, ty, 0.9);
          this.camera.shake(16, 0.35);
          this.spawnText(tx, ty - 16, '💥 IMPACTO DRONE FPV!', '#f97316');
          for (const u of this.units) {
            if (!u.alive || u.team !== 'enemies') continue;
            const ud = dist(tx, ty, u.x, u.y);
            if (ud <= 145) {
              const dmg = (u.spec.type === 'vehicle' ? 320 : 185) * (1 - ud / 170);
              u.takeDamage(dmg, 'allies', this, true, true, tx, ty);
            }
          }
          for (const bld of this.baseBuildings) {
            if (bld.alive !== false && bld.team === 'enemies' && dist(tx, ty, bld.x, bld.y) <= 165) {
              this.damageBaseBuilding(bld, 240, 'allies');
            }
          }
        } else if (d > 0.001) {
          dr.x += (dx / d) * dr.speed * dt;
          dr.y += (dy / d) * dr.speed * dt;
          this.map.revealFogArea(dr.x, dr.y, 260, 1.5);
        }
      } else {
        // UAV de Reconhecimento: voa até o setor e orbita revelando névoa e minas
        const dx = dr.targetX - dr.x;
        const dy = dr.targetY - dr.y;
        const d = Math.hypot(dx, dy);
        if (d > 85) {
          dr.angle = Math.atan2(dy, dx);
          dr.x += (dx / d) * dr.speed * dt;
          dr.y += (dy / d) * dr.speed * dt;
        } else {
          dr.orbitPhase += dt * 1.4;
          dr.x = dr.targetX + Math.cos(dr.orbitPhase) * 95;
          dr.y = dr.targetY + Math.sin(dr.orbitPhase) * 95;
          dr.angle = dr.orbitPhase + Math.PI * 0.5;
        }
        this.map.revealFogArea(dr.x, dr.y, 640, 2.0);
        for (const m of this.mines) {
          if (m.active && m.team === 'enemies' && dist(dr.x, dr.y, m.x, m.y) <= 640) {
            m.revealed = true;
          }
        }
      }
    }
    this.activeDrones = this.activeDrones.filter((d) => d.alive);
  }

  setWheelOpen() {}

  lockPointer() {
    this.audio.resume();
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    if (typeof partial.volume === 'number') {
      this.audio.setVolume(partial.volume);
    }
    this.renderer?.applySettings(this.settings);
    this._emitHud();
  }

  setPlayerSkin(skinId) {
    this.playerSkinId = skinId || 'olive_classic';
    this.audio.play('switch');
    this._emitHud();
  }

  restart(mode, startingResources, mapId) {
    this.setupMatch(mode || this.gameMode, startingResources || this.startingResourcesPreset, mapId || this.mapId);
  }

  // ============================================================================
  // SISTEMA DE SALVAR E CARREGAR BATALHA (SERIALIZAÇÃO COMPLETA + LOCALSTORAGE)
  // ============================================================================
  serializeBattleState(customTitle = null) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateLabel = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const allyCount = this.units.filter((u) => u.alive && u.team === 'allies').length;
    const enemyCount = this.units.filter((u) => u.alive && u.team === 'enemies').length;

    const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return {
      version: 1,
      id: `save_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title: customTitle || `Operação ${this.gameMode.toUpperCase()} — ${dateLabel}`,
      savedAt: now.toISOString(),
      dateLabel,
      gameMode: this.gameMode,
      mapId: this.mapId || 'normandy_fields',
      aiDifficulty: this.aiDifficulty || 'medium',
      hqLevel: this.hqLevel || 1,
      commandPoints: this.commandPoints || 0,
      aiHqLevels: { ...(this.aiHqLevels || { ally_ai: 1, enemy_1: 1, enemy_2: 1 }) },
      startingResourcesPreset: this.startingResourcesPreset,
      timeScale: this.timeScale || 1.0,
      supplies: Math.floor(this.supplies),
      ammo: Math.floor(this.ammo),
      fuel: Math.floor(this.fuel),
      hqLevel: this.hqLevel || 1,
      commandPoints: this.commandPoints || 0,
      aiDifficulty: this.aiDifficulty || 'medium',
      playerSkinId: this.playerSkinId || 'olive_classic',
      mapId: this.mapId,
      allyAiSupplies: Math.floor(this.allyAiSupplies || 600),
      enemySupplies: { ...(this.enemySupplies || { enemy_1: 600, enemy_2: 600 }) },
      victoryPoints: this.victoryPoints || 0,
      victoryState: this.victoryState || null,
      intelRevealed: Boolean(this.intelRevealed),
      supplyIncomeTimer: Number((this.supplyIncomeTimer || 6.0).toFixed(2)),
      aiWaveTimer: Number((this.aiWaveTimer || 38.0).toFixed(2)),
      activeBottomCategory: this.activeBottomCategory || 'infantry',
      trenchShapeL: Boolean(this.trenchShapeL),
      allyUnitsCount: allyCount,
      enemyUnitsCount: enemyCount,
      camera: {
        x: Math.round(this.camera.x),
        y: Math.round(this.camera.y),
        zoom: Math.round(this.camera.zoom),
      },
      sectors: this.map.sectors.map((s) => ({
        id: s.id,
        owner: s.owner,
        captureProgress: Number((s.captureProgress || 0).toFixed(2)),
      })),
      exploredGrid: this.map.exploredGrid ? Array.from(this.map.exploredGrid) : [],
      tacticalArrows: (this.tacticalArrows || []).map((a) => ({ ...a })),
      tacticalPings: (this.tacticalPings || []).map((p) => ({ ...p })),
      baseBuildings: (this.baseBuildings || []).map((b) => ({
        id: b.id,
        buildingType: b.buildingType,
        name: b.name,
        short: b.short,
        subtitle: b.subtitle,
        team: b.team,
        faction: b.faction,
        x: b.x,
        y: b.y,
        sightRadius: b.sightRadius,
        hp: b.hp,
        maxHp: b.maxHp,
        radius: b.radius,
        rallyX: b.rallyX,
        rallyY: b.rallyY,
        produces: [...(b.produces || [])],
        productionQueue: (b.productionQueue || []).map((q) => ({ ...q })),
        productionProgress: b.productionProgress || 0,
        isMainHQ: Boolean(b.isMainHQ),
        alive: b.alive !== false,
      })),
      units: (this.units || [])
        .filter((u) => u.alive)
        .map((u) => ({
          id: u.id,
          faction: u.faction,
          unitType: u.unitType,
          x: Number(u.x.toFixed(2)),
          y: Number(u.y.toFixed(2)),
          angle: Number((u.angle || 0).toFixed(3)),
          hp: Number(u.hp.toFixed(2)),
          maxHp: u.maxHp,
          morale: Number((u.morale || 100).toFixed(2)),
          formation: u.formation || 'line',
          spacingMeters: Number((u.spacingMeters || 3.0).toFixed(2)),
          holdPosition: Boolean(u.holdPosition),
          selected: Boolean(u.selected),
          surrendered: Boolean(u.surrendered),
          captured: Boolean(u.captured),
          inTrench: Boolean(u.inTrench),
          inTrenchId: u.inTrenchId || null,
          garrisonedBuildingId: u.garrisonedBuildingId || null,
          order: u.order ? { ...u.order } : { type: 'hold', x: u.x, y: u.y, targetUnitId: null },
          soldiers: (u.soldiers || []).map((s) => ({
            id: s.id,
            index: s.index,
            name: s.name,
            rank: s.rank,
            weapon: s.weapon,
            weaponIcon: s.weaponIcon,
            hp: Number(s.hp.toFixed(2)),
            maxHp: s.maxHp || 100,
            alive: Boolean(s.alive),
            selected: Boolean(s.selected),
            x: Number((s.x || u.x).toFixed(2)),
            y: Number((s.y || u.y).toFixed(2)),
          })),
        })),
      trenches: (this.trenches || []).map((tr) => ({
        id: tr.id,
        points: (tr.points || []).map((p) => ({ x: p.x, y: p.y })),
        team: tr.team,
        isLShape: Boolean(tr.isLShape),
        revealed: Boolean(tr.revealed),
      })),
      barricades: (this.barricades || []).map((b) => ({
        id: b.id,
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2,
        team: b.team,
      })),
      fortifiedWalls: (this.fortifiedWalls || []).map((w) => ({
        id: w.id,
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        team: w.team,
      })),
      barbedWires: (this.barbedWires || []).map((w) => ({
        id: w.id,
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        team: w.team,
      })),
      mines: (this.mines || [])
        .filter((m) => m.active !== false)
        .map((m) => ({
          id: m.id,
          x: m.x,
          y: m.y,
          team: m.team,
          faction: m.faction,
          revealed: Boolean(m.revealed),
        })),
    };
  }

  loadBattleState(state) {
    if (!state || typeof state !== 'object' || !Array.isArray(state.units)) {
      this.notify('ARQUIVO DE BATALHA INVÁLIDO', 'Não foi possível restaurar os dados da operação.', '#c94a38');
      return false;
    }

    this.gameMode = state.gameMode === '2v2' ? '2v2' : '1v1';
    this.aiDifficulty = state.aiDifficulty || 'medium';
    this.hqLevel = clamp(state.hqLevel || 1, 1, 3);
    this.commandPoints = Math.max(0, state.commandPoints || 0);
    this.aiHqLevels = state.aiHqLevels ? { ...state.aiHqLevels } : { ally_ai: 1, enemy_1: 1, enemy_2: 1 };
    const savedMapId = state.mapId || 'normandy_fields';
    if (savedMapId !== this.mapId) {
      this.mapId = savedMapId;
      this.map = new BattlefieldMap({ seed: 1944, mapId: this.mapId });
      this.renderer?.buildWorld(this.map);
    }
    this.startingResourcesPreset = state.startingResourcesPreset || 600;
    this.timeScale = typeof state.timeScale === 'number' ? state.timeScale : 1.0;
    this.supplies = typeof state.supplies === 'number' ? state.supplies : 600;
    this.ammo = typeof state.ammo === 'number' ? state.ammo : 140;
    this.fuel = typeof state.fuel === 'number' ? state.fuel : 95;
    this.allyAiSupplies = typeof state.allyAiSupplies === 'number' ? state.allyAiSupplies : 600;
    this.enemySupplies = state.enemySupplies
      ? { ...state.enemySupplies }
      : { enemy_1: 600, enemy_2: 600 };
    this.victoryPoints = state.victoryPoints || 0;
    this.victoryState = state.victoryState || null;
    this.intelRevealed = Boolean(state.intelRevealed);
    this.supplyIncomeTimer = state.supplyIncomeTimer || 6.0;
    this.aiWaveTimer = state.aiWaveTimer || 38.0;
    this.activeBottomCategory = state.activeBottomCategory || 'infantry';
    this.trenchShapeL = Boolean(state.trenchShapeL);

    this.activeCommandMode = null;
    this.activeEngineeringActionId = null;
    this.activeAirStrikeMode = null;
    this.trenchPreview = null;
    this.orientationPreview = null;
    this.rightOrderStartWorld = null;
    this.selectionBox = null;
    this.selectedBuildingId = null;
    this.selectedStructureId = null;
    this.aircrafts = [];
    this.bullets = [];
    this.pendingGrenades = [];
    this.repairSparkTimer = 0;
    this.particles = [];
    this.texts = [];

    if (state.camera) {
      this.camera.x = clamp(state.camera.x || 2400, 240, BATTLEFIELD_SIZE - 240);
      this.camera.y = clamp(state.camera.y || 4800, 240, BATTLEFIELD_SIZE - 240);
      this.camera.zoom = clamp(state.camera.zoom || 920, 290, 2400);
    }

    // Restaura setores de suprimento
    if (Array.isArray(state.sectors)) {
      for (const savedSec of state.sectors) {
        const sec = this.map.sectors.find((s) => s.id === savedSec.id);
        if (sec) {
          sec.owner = savedSec.owner || 'neutral';
          sec.captureProgress = typeof savedSec.captureProgress === 'number' ? savedSec.captureProgress : 0;
        }
      }
    }

    // Restaura grade de Névoa de Guerra explorada
    this.map.resetFog();
    if (Array.isArray(state.exploredGrid) && this.map.exploredGrid) {
      const len = Math.min(state.exploredGrid.length, this.map.exploredGrid.length);
      for (let i = 0; i < len; i++) {
        this.map.exploredGrid[i] = state.exploredGrid[i];
        if (state.exploredGrid[i] > 0) {
          this.map.fogGrid[i] = 1;
        }
      }
    }

    this.tacticalArrows = Array.isArray(state.tacticalArrows)
      ? state.tacticalArrows.map((a) => ({ ...a }))
      : [];
    this.tacticalPings = Array.isArray(state.tacticalPings)
      ? state.tacticalPings.map((p) => ({ ...p }))
      : [];

    // Restaura Prédios da Base
    this.baseBuildings = Array.isArray(state.baseBuildings)
      ? state.baseBuildings.map((b) => ({
          ...b,
          produces: [...(b.produces || [])],
          productionQueue: (b.productionQueue || []).map((q) => ({ ...q })),
          alive: b.alive !== false,
        }))
      : [];

    // Restaura Trincheiras, Barricadas, Muros, Arames e Minas
    this.trenches = Array.isArray(state.trenches)
      ? state.trenches.map((tr) => {
          const seg = new TrenchSegment({
            points: tr.points,
            team: tr.team,
            isLShape: tr.isLShape,
            revealed: tr.revealed,
          });
          if (tr.id) seg.id = tr.id;
          return seg;
        })
      : [];

    this.barricades = Array.isArray(state.barricades)
      ? state.barricades.map((b) => {
          const bar = new BarricadeLine(b);
          if (b.id) bar.id = b.id;
          return bar;
        })
      : [];

    this.fortifiedWalls = Array.isArray(state.fortifiedWalls)
      ? state.fortifiedWalls.map((w) => {
          const wall = new FortifiedWallLine(w);
          if (w.id) wall.id = w.id;
          return wall;
        })
      : [];

    this.barbedWires = Array.isArray(state.barbedWires)
      ? state.barbedWires.map((w) => {
          const wire = new BarbedWireLine(w);
          if (w.id) wire.id = w.id;
          return wire;
        })
      : [];

    this.mines = Array.isArray(state.mines)
      ? state.mines.map((m) => {
          const mine = new Landmine(m);
          if (m.id) mine.id = m.id;
          return mine;
        })
      : [];

    // Limpa guarnições antigas das casas
    for (const st of this.map.structures) {
      st.garrisonUnitId = null;
      st.garrisonTeam = null;
    }

    // Restaura Unidades e Soldados Individuais (com HP individual, espaçamento e ordens)
    this.units = state.units.map((uData) => {
      const hasCustomSoldiers = Array.isArray(uData.soldiers) && uData.soldiers.length > 0;
      const u = new SquadUnit({
        x: uData.x,
        y: uData.y,
        faction: uData.faction,
        unitType: uData.unitType,
        angle: uData.angle || 0,
        customSoldiers: hasCustomSoldiers ? uData.soldiers : null,
        spacingMeters: uData.spacingMeters || 3.0,
      });
      if (uData.id) u.id = uData.id;
      u.hp = typeof uData.hp === 'number' ? uData.hp : u.maxHp;
      u.morale = typeof uData.morale === 'number' ? uData.morale : 100;
      u.formation = uData.formation || 'line';
      u.spacingMeters = uData.spacingMeters || 3.0;
      u.holdPosition = Boolean(uData.holdPosition);
      u.selected = Boolean(uData.selected);
      u.surrendered = Boolean(uData.surrendered);
      u.captured = Boolean(uData.captured);
      u.inTrench = Boolean(uData.inTrench);
      u.inTrenchId = uData.inTrenchId || null;
      u.garrisonedBuildingId = uData.garrisonedBuildingId || null;
      if (uData.order) {
        u.order = { ...uData.order };
      }
      if (hasCustomSoldiers) {
        u.syncSquadHealthFromSoldiers();
      }
      if (u.garrisonedBuildingId) {
        const st = this.map.structures.find((s) => s.id === u.garrisonedBuildingId);
        if (st && !st.destroyed) {
          st.garrisonUnitId = u.id;
          st.garrisonTeam = u.team;
        } else {
          u.garrisonedBuildingId = null;
        }
      }
      return u;
    });

    this.map.updateFogOfWar(this.units, this.baseBuildings, 0.1);
    this.map.updateFrontline(this.units, 1.0);

    this.audio.play('win');
    this.notify(
      '📂 BATALHA CARREGADA COM SUCESSO!',
      `${state.title || 'Operação Restaurada'} (${this.units.length} unidades no teatro de operações)`,
      '#a3be8c'
    );
    this._emitHud();
    return true;
  }

  getSavedBattles() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.saveStorageKey);
        if (!raw) return this._memorySaves;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback para memória
    }
    return this._memorySaves;
  }

  _persistSavedBattles(list) {
    this._memorySaves = list;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.saveStorageKey, JSON.stringify(list));
      }
    } catch {
      // ignora erro de quota
    }
  }

  saveBattle(customTitle = null) {
    const snap = this.serializeBattleState(customTitle);
    const list = [...this.getSavedBattles()];
    list.unshift(snap);
    // Mantém até 8 salvamentos mais recentes
    if (list.length > 8) list.length = 8;
    this._persistSavedBattles(list);

    this.audio.play('cash');
    this.notify(
      '💾 BATALHA SALVA COM SUCESSO!',
      `${snap.title} • ${snap.supplies} SUP | ${snap.allyUnitsCount} Tropas Aliadas`,
      '#a3be8c'
    );
    this._emitHud();
    return snap;
  }

  autoSaveBattle() {
    if (this.menuActive || this.gameOver || this.spectatorMode || this.mapEditorOpen || this.isMultiplayer) {
      return null;
    }
    const snap = this.serializeBattleState('Salvamento Automático');
    snap.id = 'autosave_latest';
    snap.isAutoSave = true;
    const withoutPrev = this.getSavedBattles().filter((s) => s.id !== 'autosave_latest');
    const list = [snap, ...withoutPrev];
    if (list.length > 9) list.length = 9;
    this._persistSavedBattles(list);
    return snap;
  }

  loadSavedBattle(saveId = null) {
    const list = this.getSavedBattles();
    if (list.length === 0) {
      this.notify('NENHUMA BATALHA SALVA', 'Salve uma operação primeiro usando [F9] ou o menu Salvar Batalha.', '#d4a338');
      return false;
    }
    const target = saveId ? list.find((s) => s.id === saveId) : list[0];
    if (!target) {
      this.notify('SALVAMENTO NÃO ENCONTRADO', '', '#c94a38');
      return false;
    }
    return this.loadBattleState(target);
  }

  deleteSavedBattle(saveId) {
    const list = this.getSavedBattles().filter((s) => s.id !== saveId);
    this._persistSavedBattles(list);
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  notify(title, subtitle = '', color = '#c87d28') {
    this.notifications.unshift({
      id: Date.now() + Math.random(),
      title,
      subtitle,
      color,
      life: 4.8,
    });
    if (this.notifications.length > 3) this.notifications.length = 3;
  }

  spawnText(x, y, text, color = '#e5e0d0') {
    this.texts.push(new FloatingText({ x, y, text, color }));
  }

  playSoundAt(name, x, y, maxVol = 1) {
    const d = dist(x, y, this.camera.x, this.camera.y);
    const vol = clamp(1 - d / 1900, 0, 1) * maxVol;
    if (vol > 0.04) this.audio.play(name, vol);
  }

  countNearbyUnits(x, y, radius, team, excludeId = null) {
    let c = 0;
    for (const u of this.units) {
      if (!u.alive || u.captured || u.surrendered || u.id === excludeId) continue;
      if (team && u.team !== team) continue;
      if (dist(x, y, u.x, u.y) <= radius) c++;
    }
    return c;
  }

  onEnemySquadSurrendered(unit) {
    // Limpa imediatamente o alvo de todas as tropas/veículos que estavam atirando neste Comandante rendido
    for (const other of this.units) {
      if (other.order?.targetUnitId === unit.id) {
        other.order.type = 'hold';
        other.order.targetUnitId = null;
      }
    }
    this.audio.play('star');
    this.spawnText(unit.x, unit.y - 20, '★ COMANDANTE RENDIDO! CLIQUE P/ CAPTURAR', '#facc15');
    this.notify(
      '★ COMANDANTE INIMIGO RENDIDO!',
      'Clique sobre o Comandante rendido (ou aproxime uma tropa) para transferi-lo ao Campo de Prisioneiros.',
      '#d4a338'
    );
  }

  onUnitDestroyed(unit, attackerTeam) {
    for (const st of this.map.structures) {
      if (st.garrisonUnitId === unit.id) {
        st.garrisonUnitId = null;
        st.garrisonTeam = null;
      }
    }
    // Se um Transporte de Tropas for destruído com esquadrões dentro, ejeta sobreviventes com dano leve
    if (unit.spec.isTransport && unit.cargoSquadIds && unit.cargoSquadIds.length > 0) {
      this.disembarkAllFromTransport(unit.id);
    }
    this.spawnExplosionParticles(unit.x, unit.y, unit.spec.type === 'vehicle' ? 28 : 14);
    this.playSoundAt(unit.spec.type === 'vehicle' ? 'explosion' : 'punch', unit.x, unit.y, 0.85);
    if (attackerTeam === 'allies' && unit.team === 'enemies') {
      this.matchStats.unitsEliminated = (this.matchStats.unitsEliminated || 0) + 1;
      const reward =
        unit.spec.type === 'vehicle' ? 75 : unit.spec.type === 'emplacement' ? 90 : 35;
      const pts =
        unit.spec.type === 'vehicle' ? 60 : unit.spec.type === 'emplacement' ? 85 : 25;
      this.supplies += reward;
      this.ammo += unit.spec.type === 'vehicle' ? 15 : 8;
      this.victoryPoints += pts;
      this.addCommandPoints(25);
      this.spawnText(unit.x, unit.y, `+${reward} SUP • +${pts} PTS • +25 CP`, '#a3be8c');
    }
  }

  spawnExplosionParticles(x, y, count = 20) {
    if (count >= 16 && this.renderer?.vfx) {
      const gy = getTerrainHeight(x, y, this.map);
      this.renderer.vfx.spawnHeavyExplosion(x, gy, y, count >= 34 ? 1.25 : 0.9);
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 28 + Math.random() * 120;
      const life = 0.4 + Math.random() * 0.6;
      this.particles.push({
        x,
        y,
        z: 4 + Math.random() * 14,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        radius: 3 + Math.random() * 5,
        color: i % 3 === 0 ? '#c94a38' : i % 3 === 1 ? '#d97706' : '#4a453e',
        life,
        maxLife: life,
      });
    }
  }

  // Gera faíscas e poeira na parede quando um projétil é bloqueado fisicamente pelo muro/saco de areia/trincheira
  spawnWallImpactParticles(x, y) {
    if (this.renderer?.vfx) {
      const gy = getTerrainHeight(x, y, this.map);
      this.renderer.vfx.spawnImpact(x, gy + 6, y, true);
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 18 + Math.random() * 55;
      const life = 0.22 + Math.random() * 0.25;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        z: 6 + Math.random() * 7,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vz: 12 + Math.random() * 14,
        radius: i % 2 === 0 ? 2.1 : 3.2,
        color: i % 2 === 0 ? '#fbbf24' : '#9a9484',
        life,
        maxLife: life,
      });
    }
  }

  // Calcula a direção da ameaça inimiga mais próxima (ou o centro do território inimigo) para determinar o Lado Seguro do muro
  _getThreatOriginFor(wx, wy, team = 'allies') {
    let nearestEnemy = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.captured || u.surrendered || u.team === team) continue;
      const d = dist(wx, wy, u.x, u.y);
      if (d < bestD) {
        bestD = d;
        nearestEnemy = u;
      }
    }
    if (nearestEnemy && bestD < 2600) {
      const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return { x: nearestEnemy.x, y: nearestEnemy.y };
    }
    const fallbackHq = team === 'allies' ? this.map.hqs.enemy_1 : this.map.hqs.player;
    const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return { x: fallbackHq ? fallbackHq.x : 8450, y: fallbackHq ? fallbackHq.y : 4800 };
  }

  // Executado pelos botões da Barra Inferior (Slots 1 a 9)
  triggerCommandSlot(slotIndex) {
    const cmd = COMMAND_ACTIONS[slotIndex];
    if (!cmd) return false;
    this.audio.resume();
    this.activeCommandSlot = slotIndex;

    // Slots 1, 2 e 3 recrutam unidades móveis no QG Aliado
    if (cmd.category === 'unit') {
      this.activeCommandMode = null;
      this.activeAirStrikeMode = null;
      this.trenchPreview = null;
      return this.recruitUnitById(cmd.id);
    }

    // Slots 4 a 9 ativam modos de Engenharia Militar no cursor
    this.activeAirStrikeMode = null;
    if (this.activeCommandMode === cmd.category) {
      this.activeCommandMode = null;
      this.trenchPreview = null;
      this.notify('ORDEM DE ENGENHARIA CANCELADA', '', '#9a9484');
    } else {
      this.activeCommandMode = cmd.category;
      const isDragMode =
        cmd.category === 'build_trench' ||
        cmd.category === 'build_barricade' ||
        cmd.category === 'build_wall' ||
        cmd.category === 'build_wire';
      this.notify(
        `ENGENHARIA: ${cmd.name.toUpperCase()}`,
        isDragMode
          ? 'Clique e arraste no mapa para traçar a linha • Botão Direito cancela'
          : `Clique no terreno para construir (${cmd.cost} SUP) • Botão Direito cancela`,
        '#d4a338'
      );
      this.audio.play('switch');
    }
    this._emitHud();
    return true;
  }

  _createPrisonerDossier(unit) {
    const ranks = ['Tenente', 'Capitão', 'Major', 'Sargento-Mor'];
    const names = ['H. Weber', 'K. Richter', 'M. Vogel', 'F. Becker', 'E. Hartmann', 'L. Hoffmann'];
    const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return {
      id: unit.id,
      name: unit.name,
      officerName: names[Math.floor(Math.random() * names.length)],
      rank: ranks[Math.floor(Math.random() * ranks.length)],
      resistance: randInt(48, 86),
      factionName: unit.factionMeta?.name || 'Forças do Eixo',
      soldiersRemaining: unit.soldiersAlive || 1,
      color: unit.factionMeta?.color || '#c94a38',
      capturedAt: Math.round(this.matchStats?.elapsedSeconds || 0),
    };
  }

  openPowInterrogation() {
    const powCamp = this.baseBuildings.find(
      (b) => b.faction === 'player' && b.buildingType === 'pow_camp' && b.alive !== false
    );
    if (!powCamp) {
      this.audio.play('empty');
      this.notify(
        '⚠️ CAMPO DE DETENÇÃO NECESSÁRIO!',
        'Construa um Campo de Detenção & Inteligência na sua Base para escoltar e interrogar prisioneiros!',
        '#eab308'
      );
      return false;
    }
    if (!this.powPrisoners || this.powPrisoners.length === 0) {
      this.audio.play('empty');
      this.notify(
        'CELA VAZIA',
        'Capture inimigos rendidos (Bandeira Branca) no campo de batalha para trazê-los ao Campo POW.',
        '#d4a338'
      );
      return false;
    }
    const prisoner = this.powPrisoners[0];
    this.setPaused(true);
    this.onInterrogate?.(prisoner);
    return true;
  }

  // Mecânica Chave: Interrogatório de Prisioneiros exige Campo de Detenção (POW Camp) e oferece 4 ações estratégicas!
  resolveInterrogation(method, targetUnitId) {
    const unit = this.units.find((u) => u.id === targetUnitId);
    if (unit) {
      unit.captured = true;
      unit.alive = false;
      unit.selected = false;
    }

    const existingIdx = this.powPrisoners.findIndex((p) => p.id === targetUnitId);

    if (method === 'labor') {
      if (existingIdx === -1 && this.powPrisoners.length < 10) {
        const dossier = unit
          ? this._createPrisonerDossier(unit)
          : {
              id: targetUnitId || `pow_${Date.now()}`,
              name: 'Esquadrão Inimigo',
              officerName: 'K. Richter',
              rank: 'Capitão',
              resistance: 65,
              factionName: 'Forças do Eixo',
              soldiersRemaining: 1,
              color: '#c94a38',
            };
        this.powPrisoners.push(dossier);
      }
      this.addCommandPoints(25, 'Trabalho no Campo POW');
      this.audio.play('cash');
      this.notify(
        '🔄 PRISIONEIRO ALOCADO NO CAMPO POW',
        `Gerando +5 SUP/s contínuos (${this.powPrisoners.length}/10 prisioneiros na cela).`,
        '#a3be8c'
      );
      this._emitHud();
      return;
    }

    // Para interrogatórios estratégicos (1, 2, 3), o prisioneiro é processado e removido da cela ativa
    if (existingIdx !== -1) {
      this.powPrisoners.splice(existingIdx, 1);
    }
    this.matchStats.prisonersInterrogated = (this.matchStats.prisonersInterrogated || 0) + 1;

    if (method === 'maps' || method === 'press') {
      this.intelRevealed = true;
      this.addCommandPoints(60, 'Mapas de Defesa');
      for (const m of this.mines) {
        if (m.team === 'enemies') m.revealed = true;
      }
      for (const tr of this.trenches) {
        if (tr.team === 'enemies') tr.revealed = true;
      }
      if (this.map.hqs.enemy_1) {
        this.map.addTemporaryVision(this.map.hqs.enemy_1.x, this.map.hqs.enemy_1.y, 1350, 60);
      }
      if (this.gameMode === '2v2' && this.map.hqs.enemy_2) {
        this.map.addTemporaryVision(this.map.hqs.enemy_2.x, this.map.hqs.enemy_2.y, 1350, 60);
      }
      for (const tr of this.trenches) {
        if (tr.team === 'enemies') {
          const c = tr.getCenter();
          this.map.addTemporaryVision(c.x, c.y, 700, 60);
        }
      }
      this.map.updateFogOfWar(this.units, this.baseBuildings, 0.05, this.myTeam);
      this.victoryPoints += 120;
      this.audio.play('win');
      this.spawnText(this.camera.x, this.camera.y, '🗺️ MAPAS DE DEFESA EXTRAÍDOS (60s)!', '#d4a338');
      this.notify(
        '🗺️ MAPAS DE DEFESA EXTRAÍDOS!',
        'Névoa aberta sobre os QGs inimigos por 60s e todas as Minas e Trincheiras reveladas!',
        '#a3be8c'
      );
    } else if (method === 'convoy' || method === 'negotiate') {
      this.supplies += 350;
      this.ammo += 180;
      this.fuel += 120;
      this.enemyProductionDebuffTimer = 45;
      this.addCommandPoints(45, 'Rotas de Comboio');
      this.victoryPoints += 100;
      this.audio.play('cash');
      this.spawnText(this.camera.x, this.camera.y, '+350 SUP +180 MUN +120 COMB!', '#4ade80');
      this.notify(
        '📦 COMBOIO INIMIGO CONFISCADO!',
        '+350 SUP, +180 MUN, +120 COMB recebidos e produção inimiga reduzida em -30% por 45s!',
        '#4ade80'
      );
    } else {
      // 'sabotage' ou 'intimidate'
      this.enemySabotageTimer = 40;
      for (const u of this.units) {
        if (u.alive && u.team === 'enemies') u.morale = Math.max(15, u.morale - 25);
      }
      let techMsg = '+120 CP ganhos';
      if (this.activeResearch) {
        this.activeResearch.progress = Math.min(
          this.activeResearch.duration,
          this.activeResearch.progress + this.activeResearch.duration * 0.4
        );
        techMsg = 'Pesquisa Tech avançou +40%';
      } else {
        this.addCommandPoints(120, 'Códigos de Rádio');
      }
      this.victoryPoints += 110;
      this.audio.play('win');
      this.spawnText(this.camera.x, this.camera.y, '📡 SABOTAGEM DE RÁDIO ATIVA (40s)!', '#38bdf8');
      this.notify(
        '📡 SABOTAGEM & CÓDIGOS DE RÁDIO!',
        `Torres/Radares inimigos desativados (40s), Defesa/Moral -25% e ${techMsg}!`,
        '#38bdf8'
      );
    }

    this._emitHud();
  }

  _snapTrenchPoint(wx, wy, snapDist = 38) {
    let best = null;
    let bestD = snapDist;
    for (const tr of this.trenches || []) {
      for (let i = 0; i < (tr.points?.length || 0); i++) {
        const p = tr.points[i];
        const d = dist(wx, wy, p.x, p.y);
        if (d <= bestD) {
          bestD = d;
          best = { x: p.x, y: p.y, trench: tr, pointIndex: i };
        }
      }
    }
    return best;
  }

  _connectTrenchToNetwork(newTrench, snapDist = 40) {
    if (!newTrench?.points || newTrench.points.length < 2) return;
    const startPt = newTrench.points[0];
    const endPt = newTrench.points[newTrench.points.length - 1];
    for (const tr of this.trenches || []) {
      if (tr.id === newTrench.id || !tr.points || tr.points.length < 2) continue;
      const oStart = tr.points[0];
      const oEnd = tr.points[tr.points.length - 1];
      let touched = false;
      if (dist(startPt.x, startPt.y, oStart.x, oStart.y) <= snapDist) {
        newTrench.openStart = true;
        tr.openStart = true;
        touched = true;
      }
      if (dist(startPt.x, startPt.y, oEnd.x, oEnd.y) <= snapDist) {
        newTrench.openStart = true;
        tr.openEnd = true;
        touched = true;
      }
      if (dist(endPt.x, endPt.y, oStart.x, oStart.y) <= snapDist) {
        newTrench.openEnd = true;
        tr.openStart = true;
        touched = true;
      }
      if (dist(endPt.x, endPt.y, oEnd.x, oEnd.y) <= snapDist) {
        newTrench.openEnd = true;
        tr.openEnd = true;
        touched = true;
      }
      if (!touched && tr.containsPoint(startPt.x, startPt.y, 18)) {
        newTrench.openStart = true;
        touched = true;
      }
      if (!touched && tr.containsPoint(endPt.x, endPt.y, 18)) {
        newTrench.openEnd = true;
        touched = true;
      }
      if (touched) {
        tr._meshVersion = (tr._meshVersion || 1) + 1;
      }
    }
  }

  // Calcula rota interna nó-a-nó pelo eixo central das trincheiras conectadas
  findTrenchNetworkPath(startX, startY, endX, endY) {
    if (!this.trenches || this.trenches.length === 0) return null;
    const destTrench = this.trenches.find((tr) => tr.containsPoint(endX, endY, 20));
    if (!destTrench) return null;

    // Constrói grafo dos vértices de todas as trincheiras
    const nodes = [];
    const edges = [];
    const addNode = (x, y, trenchId) => {
      for (let i = 0; i < nodes.length; i++) {
        if (dist(nodes[i].x, nodes[i].y, x, y) <= 42) return i;
      }
      const idx = nodes.length;
      nodes.push({ x, y, trenchId });
      edges.push([]);
      return idx;
    };

    for (const tr of this.trenches) {
      if (!tr.points || tr.points.length < 2) continue;
      let prevIdx = -1;
      for (const p of tr.points) {
        const curIdx = addNode(p.x, p.y, tr.id);
        if (prevIdx !== -1 && prevIdx !== curIdx) {
          const w = dist(nodes[prevIdx].x, nodes[prevIdx].y, nodes[curIdx].x, nodes[curIdx].y);
          edges[prevIdx].push({ to: curIdx, cost: w });
          edges[curIdx].push({ to: prevIdx, cost: w });
        }
        prevIdx = curIdx;
      }
    }
    if (nodes.length === 0) return null;

    // Encontra o nó de entrada mais próximo do esquadrão e o nó mais próximo do destino
    let startNode = 0;
    let bestStartD = Infinity;
    let goalNode = 0;
    let bestGoalD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const ds = dist(startX, startY, nodes[i].x, nodes[i].y);
      if (ds < bestStartD) {
        bestStartD = ds;
        startNode = i;
      }
      const dg = dist(endX, endY, nodes[i].x, nodes[i].y);
      if (dg < bestGoalD) {
        bestGoalD = dg;
        goalNode = i;
      }
    }

    // Dijkstra no grafo interno de trincheiras
    const dArr = new Array(nodes.length).fill(Infinity);
    const parent = new Array(nodes.length).fill(-1);
    const visited = new Array(nodes.length).fill(false);
    dArr[startNode] = 0;

    for (let step = 0; step < nodes.length; step++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        if (!visited[i] && dArr[i] < best) {
          best = dArr[i];
          u = i;
        }
      }
      if (u === -1 || u === goalNode) break;
      visited[u] = true;
      for (const e of edges[u]) {
        if (dArr[u] + e.cost < dArr[e.to]) {
          dArr[e.to] = dArr[u] + e.cost;
          parent[e.to] = u;
        }
      }
    }

    if (!Number.isFinite(dArr[goalNode])) return null;
    const chain = [];
    for (let cur = goalNode; cur !== -1; cur = parent[cur]) {
      chain.push({ x: nodes[cur].x, y: nodes[cur].y });
    }
    chain.reverse();
    const out = [{ x: startX, y: startY }, ...chain, { x: endX, y: endY }];
    return out;
  }

  _buildTrenchPoints(x1, y1, x2, y2, isLShape) {
    const s1 = this._snapTrenchPoint(x1, y1, 38);
    const s2 = this._snapTrenchPoint(x2, y2, 38);
    const ax = s1 ? s1.x : x1;
    const ay = s1 ? s1.y : y1;
    const bx = s2 ? s2.x : x2;
    const by = s2 ? s2.y : y2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const clampedLen = s2 ? clamp(len, 60, 420) : clamp(len, 95, 360);
    const ang = len > 1 ? Math.atan2(dy, dx) : 0;
    const endX = s2 && len <= 420 ? bx : ax + Math.cos(ang) * clampedLen;
    const endY = s2 && len <= 420 ? by : ay + Math.sin(ang) * clampedLen;

    if (!isLShape) {
      return [
        { x: ax, y: ay },
        { x: endX, y: endY },
      ];
    }

    const perpAng = ang + Math.PI / 2;
    const legLen = Math.max(80, clampedLen * 0.55);
    const lEndX = endX + Math.cos(perpAng) * legLen;
    const lEndY = endY + Math.sin(perpAng) * legLen;
    return [
      { x: ax, y: ay },
      { x: endX, y: endY },
      { x: lEndX, y: lEndY },
    ];
  }

  _findBaseBuildingNearWorld(wx, wy, maxDist = 130, predicate = null) {
    let best = null;
    let bestD = maxDist;
    for (const b of this.baseBuildings) {
      if (b.alive === false) continue;
      if (predicate && !predicate(b)) continue;
      const d = dist(wx, wy, b.x, b.y);
      const effDist = Math.max(maxDist, (b.radius || 90) + 18);
      if (d <= effDist && d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  _handleRTSInput(realDt) {
    const { input } = this;

    // 1. Movimento da Câmera RTS (WASD / Setas / Arrastar Botão do Meio / Arrastar 2 Dedos no Touch / Modo Câmera 1 Dedo)
    const camMoveSpeed = (680 + this.camera.zoom * 0.55) * (this.settings.camSpeed || 1);
    let mx = 0;
    let my = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;

    const camBound = this.mapEditorOpen ? 180 : 820;
    const minZoom = this.mapEditorOpen ? 180 : 340;
    const maxZoom = this.mapEditorOpen ? 3800 : 1020;

    if (mx !== 0 || my !== 0) {
      const l = Math.hypot(mx, my);
      this.camera.x = clamp(this.camera.x + (mx / l) * camMoveSpeed * realDt, camBound, BATTLEFIELD_SIZE - camBound);
      this.camera.y = clamp(this.camera.y + (my / l) * camMoveSpeed * realDt, camBound, BATTLEFIELD_SIZE - camBound);
    }

    // Pan com 2 Dedos no Touch ou Botão do Meio do Mouse
    if (input.touch && (input.touch.panDeltaX !== 0 || input.touch.panDeltaY !== 0)) {
      const panFactor = (this.camera.zoom / 680) * 1.65 * (this.settings.camSpeed || 1);
      this.camera.x = clamp(this.camera.x - input.touch.panDeltaX * panFactor, camBound, BATTLEFIELD_SIZE - camBound);
      this.camera.y = clamp(this.camera.y - input.touch.panDeltaY * panFactor, camBound, BATTLEFIELD_SIZE - camBound);
    }

    // Pan com 1 Dedo quando o botão [✋ MODO CÂMERA] estiver ativo (e sem modo de construção ativo)
    if (
      this.touchControlMode === 'camera' &&
      !this.activeCommandMode &&
      !this.activeAirStrikeMode &&
      input.touch &&
      (input.touch.singleDragDeltaX || input.touch.singleDragDeltaY)
    ) {
      const panFactor = (this.camera.zoom / 680) * 1.65 * (this.settings.camSpeed || 1);
      this.camera.x = clamp(
        this.camera.x - (input.touch.singleDragDeltaX || 0) * panFactor,
        camBound,
        BATTLEFIELD_SIZE - camBound
      );
      this.camera.y = clamp(
        this.camera.y - (input.touch.singleDragDeltaY || 0) * panFactor,
        camBound,
        BATTLEFIELD_SIZE - camBound
      );
    }

    // 2. Scroll do Mouse e Pinça com 2 Dedos (Pinch-to-Zoom) — Mais amplo no Editor de Mapa
    if (input.wheel !== 0) {
      const step = this.mapEditorOpen ? 160 : 95;
      this.camera.zoom = clamp(this.camera.zoom + input.wheel * step, minZoom, maxZoom);
    }
    if (input.touch && input.touch.pinchDelta && Math.abs(input.touch.pinchDelta) > 0.2) {
      this.camera.zoom = clamp(this.camera.zoom + input.touch.pinchDelta * 2.8, minZoom, maxZoom);
    }

    // 3. Tecla [TAB]: Abre/Fecha Quadro de Planejamento Tático Interativo
    if (input.wasPressed('Tab')) {
      this.toggleTacticalMap();
      return;
    }

    // Tecla [Espaço]: Pausa Tática estilo Company of Heroes
    if (input.wasPressed('Space')) {
      this.toggleTacticalPause();
    }

    // Tecla [H]: Travar Posição (Hold Position)
    if (input.wasPressed('KeyH')) {
      this.toggleSelectedHoldPosition();
    }

    // Tecla [U]: Desembarcar Tropas do Transporte OU Sair do Prédio (Guarnição)
    if (input.wasPressed('KeyU')) {
      const selTransport = this.units.find(
        (u) => u.selected && u.alive && u.spec.isTransport && u.cargoSquadIds?.length > 0
      );
      if (selTransport) {
        this.disembarkAllFromTransport(selTransport.id);
      } else {
        this.ungarrisonSelected();
      }
    }

    // Tecla [T]: Abrir / Fechar Árvore de Pesquisa & Tecnologia Militar
    if (input.wasPressed('KeyT')) {
      this.toggleTechModal();
    }

    // Tecla [K]: Separar Soldado(s) Selecionado(s) em um Novo Esquadrão Independente (Estilo Men of War)
    if (input.wasPressed('KeyK')) {
      this.splitSelectedSoldiers();
    }

    // Teclas [B] / [R]: Retornar à Base para Reparo (Veículos) ou Recuar para o QG (Infantaria)
    if (input.wasPressed('KeyB') || input.wasPressed('KeyR')) {
      this.returnSelectedToBase();
    }

    // Tecla [F10]: Alternar Modo Caixa de Areia (Sandbox)
    if (input.wasPressed('F10')) {
      this.toggleSandboxMode();
    }

    // Quando o Quadro de Operações Táticas [TAB] estiver aberto, bloqueia cliques no mundo 3D atrás do modal
    if (this.tacticalMapOpen) {
      if (input.wasPressed('Escape')) {
        this.toggleTacticalMap(false);
      }
      return;
    }
    // Atalhos das Habilidades do Esquadrão: [G] Granada, [F] Supressão, [C] Kit Médico
    if (input.wasPressed('KeyG')) this.throwSelectedGrenade();
    if (input.wasPressed('KeyF')) this.toggleSelectedSuppression();
    if (input.wasPressed('KeyC')) {
      const hasInf = this.units.some((u) => u.alive && u.faction === 'player' && u.selected && u.spec.type === 'infantry');
      if (hasInf) this.useSelectedMedkit();
      else this.triggerAirDoctrine('precision_bomb');
    }

    // Atalhos das Abas da Barra Inferior: [F1] Infantaria, [F2] Veículos, [F3] Engenharia, [F4] Defesas, [F5] Todos
    if (input.wasPressed('F1')) this.setBottomCategory('infantry');
    if (input.wasPressed('F2')) this.setBottomCategory('vehicles');
    if (input.wasPressed('F3')) this.setBottomCategory('engineering');
    if (input.wasPressed('F4')) this.setBottomCategory('defenses');
    if (input.wasPressed('F5')) this.setBottomCategory('all');

    // Salvamento Rápido da Batalha [F9]
    if (input.wasPressed('F9')) {
      this.saveBattle('Salvamento Rápido [F9]');
    }

    // Atalhos de Suporte Aéreo: [Z] Drone Recon, [X] Rasante A-10, [C] Bombardeio
    if (input.wasPressed('KeyZ')) this.triggerAirDoctrine('recon_drone');
    if (input.wasPressed('KeyX')) this.triggerAirDoctrine('a10_strafe');
    if (input.wasPressed('KeyC')) this.triggerAirDoctrine('precision_bomb');

    if (input.wasPressed('KeyM')) {
      const m = this.audio.toggleMute();
      this.notify(m ? 'ÁUDIO SILENCIADO' : 'ÁUDIO ATIVADO', '', '#9a9484');
    }

    if (input.wasPressed('KeyR')) {
      this.trenchShapeL = !this.trenchShapeL;
      this.notify(
        this.trenchShapeL ? 'TRINCHEIRA: FORMATO EM "L"' : 'TRINCHEIRA: LINHA RETA',
        'Arraste com o mouse no modo Escavar Trincheira [4]',
        '#d4a338'
      );
    }

    if (input.wasPressed('KeyG')) {
      const surrendered = this.units.find((u) => u.alive && u.surrendered && !u.captured);
      if (surrendered) {
        this._openInterrogationFor(surrendered);
        return;
      }
      const garrisonedSelected = this.units.find((u) => u.alive && u.selected && u.garrisonedBuildingId);
      if (garrisonedSelected) {
        this.ungarrisonSelected();
        return;
      }
    }

    const slotKeys = [
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4',
      'Digit5',
      'Digit6',
      'Digit7',
      'Digit8',
      'Digit9',
    ];
    for (let i = 0; i < slotKeys.length; i++) {
      if (input.wasPressed(slotKeys[i])) {
        const activeCatObj = BOTTOM_BAR_CATEGORIES.find((c) => c.id === this.activeBottomCategory);
        if (activeCatObj && activeCatObj.actionIds && activeCatObj.actionIds[i]) {
          this.triggerActionById(activeCatObj.actionIds[i]);
        } else {
          this.triggerCommandSlot(i);
        }
      }
    }

    if (this.renderer) {
      this.worldMouse = this.renderer.screenToWorld(input.mouse.x, input.mouse.y);
    }

    // 4. Modo de Alvo de Suporte Aéreo (Drone Recon, Rasante A-10, Bombardeio)
    if (this.activeAirStrikeMode) {
      if (input.mouse.rightClicked) {
        this.activeAirStrikeMode = null;
        return;
      }
      if (input.mouse.clicked) {
        this._executeAirDoctrineAt(this.activeAirStrikeMode, this.worldMouse.x, this.worldMouse.y);
      }
      return;
    }

    // 4b. Lançamento de Drone Tático 3D (UAV Recon / Drone Kamikaze FPV)
    if (this.activeDroneLaunchMode) {
      if (input.mouse.rightClicked) {
        this.activeDroneLaunchMode = null;
        this._emitHud();
        return;
      }
      if (input.mouse.clicked) {
        this.launchDrone(this.activeDroneLaunchMode, this.worldMouse.x, this.worldMouse.y);
        this.activeDroneLaunchMode = null;
        this._emitHud();
      }
      return;
    }

    // 5. Construção de Trincheira (Arrastar no mapa)
    if (this.activeCommandMode === 'build_trench') {
      if (input.mouse.rightClicked) {
        this.activeCommandMode = null;
        this.trenchPreview = null;
        return;
      }
      if (input.mouse.clicked) {
        this.trenchStartWorld = { ...this.worldMouse };
      }
      if (input.mouse.down && this.trenchStartWorld) {
        const pts = this._buildTrenchPoints(
          this.trenchStartWorld.x,
          this.trenchStartWorld.y,
          this.worldMouse.x,
          this.worldMouse.y,
          this.trenchShapeL
        );
        this.trenchPreview = { points: pts, isLShape: this.trenchShapeL };
      }
      if (input.mouse.released && this.trenchStartWorld) {
        const cost = COMMAND_BY_ID.build_trench.cost;
        if (this.supplies >= cost) {
          const pts = this._buildTrenchPoints(
            this.trenchStartWorld.x,
            this.trenchStartWorld.y,
            this.worldMouse.x,
            this.worldMouse.y,
            this.trenchShapeL
          );
          const crossesRoad = pts.some((p) => this.map.isOnRoad?.(p.x, p.y, 16));
          if (crossesRoad) {
            this.audio.play('empty');
            this.notify(
              '⚠️ ESTRADA BLOQUEADA',
              'Não é permitido escavar trincheiras atravessando a estrada! Construa nas laterais ou campos.',
              '#eab308'
            );
          } else {
            this.supplies -= cost;
            const tr = new TrenchSegment({
              points: pts,
              team: 'allies',
              isLShape: this.trenchShapeL,
              revealed: true,
            });
            this._connectTrenchToNetwork(tr, 40);
            this.trenches.push(tr);
            this.matchStats.trenchesDug = (this.matchStats.trenchesDug || 0) + 1;
            this.audio.play('door');
            this.spawnText(pts[0].x, pts[0].y, '🛡️ TRINCHEIRA CONECTADA (+70% DEF)', '#d4a338');
          }
        } else {
          this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cost} SUP.`, '#c94a38');
        }
        this.trenchStartWorld = null;
        this.trenchPreview = null;
        this.activeCommandMode = null;
      }
      return;
    }

    // 6. Construção por Clique e Arraste: Barricada, Muro de Concreto/Sacos de Areia ou Arame Farpado
    if (
      this.activeCommandMode === 'build_barricade' ||
      this.activeCommandMode === 'build_wall' ||
      this.activeCommandMode === 'build_wire'
    ) {
      if (input.mouse.rightClicked) {
        this.activeCommandMode = null;
        this.trenchStartWorld = null;
        this.trenchPreview = null;
        return;
      }
      const snapWallPt = (wx, wy) => {
        if (this.activeCommandMode !== 'build_wall') return { x: wx, y: wy };
        let best = { x: wx, y: wy };
        let bestD = 42;
        for (const w of this.fortifiedWalls || []) {
          if ((w.hp ?? 2500) <= 0) continue;
          const d1 = dist(wx, wy, w.x1, w.y1);
          if (d1 < bestD) {
            bestD = d1;
            best = { x: w.x1, y: w.y1 };
          }
          const d2 = dist(wx, wy, w.x2, w.y2);
          if (d2 < bestD) {
            bestD = d2;
            best = { x: w.x2, y: w.y2 };
          }
        }
        return best;
      };
      if (input.mouse.clicked) {
        this.trenchStartWorld = snapWallPt(this.worldMouse.x, this.worldMouse.y);
      }
      if (input.mouse.down && this.trenchStartWorld) {
        const endSnap = snapWallPt(this.worldMouse.x, this.worldMouse.y);
        const pts =
          this.activeCommandMode === 'build_wall'
            ? [
                { x: clamp(this.trenchStartWorld.x, 90, BATTLEFIELD_SIZE - 90), y: clamp(this.trenchStartWorld.y, 90, BATTLEFIELD_SIZE - 90) },
                { x: clamp(endSnap.x, 90, BATTLEFIELD_SIZE - 90), y: clamp(endSnap.y, 90, BATTLEFIELD_SIZE - 90) },
              ]
            : this._buildTrenchPoints(
                this.trenchStartWorld.x,
                this.trenchStartWorld.y,
                this.worldMouse.x,
                this.worldMouse.y,
                false
              );
        this.trenchPreview = { points: pts, isLShape: false, mode: this.activeCommandMode };
      }
      if (input.mouse.released && this.trenchStartWorld) {
        const endSnap = snapWallPt(this.worldMouse.x, this.worldMouse.y);
        const pts =
          this.activeCommandMode === 'build_wall'
            ? [
                { x: clamp(this.trenchStartWorld.x, 90, BATTLEFIELD_SIZE - 90), y: clamp(this.trenchStartWorld.y, 90, BATTLEFIELD_SIZE - 90) },
                { x: clamp(endSnap.x, 90, BATTLEFIELD_SIZE - 90), y: clamp(endSnap.y, 90, BATTLEFIELD_SIZE - 90) },
              ]
            : this._buildTrenchPoints(
                this.trenchStartWorld.x,
                this.trenchStartWorld.y,
                this.worldMouse.x,
                this.worldMouse.y,
                false
              );
        const segLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const cmd = COMMAND_BY_ID[this.activeCommandMode];
        const cost = this.sandboxMode
          ? 0
          : this.activeCommandMode === 'build_wall'
          ? Math.max(45, Math.round((segLen / 180) * 55))
          : cmd
          ? cmd.cost
          : 60;
        if (this.supplies >= cost && segLen >= 28) {
          this.supplies -= cost;
          if (this.activeCommandMode === 'build_wall') {
            const midX = (pts[0].x + pts[1].x) * 0.5;
            const midY = (pts[0].y + pts[1].y) * 0.5;
            const autoGate = Boolean(this.map?.isOnRoad?.(midX, midY, 45));
            const newWall = new FortifiedWallLine({
              x1: pts[0].x,
              y1: pts[0].y,
              x2: pts[1].x,
              y2: pts[1].y,
              team: 'allies',
              isGate: autoGate,
            });
            this.fortifiedWalls.push(newWall);
            this.selectedWallId = newWall.id;
            this.spawnText(
              midX,
              midY - 18,
              autoGate ? '🚧 PORTÃO BLINDADO AUTOMÁTICO' : `🧱 MURALHA CONSTRUÍDA (-${cost} SUP)`,
              '#a3be8c'
            );
          } else if (this.activeCommandMode === 'build_wire') {
            this.barbedWires.push(
              new BarbedWireLine({
                x1: pts[0].x,
                y1: pts[0].y,
                x2: pts[1].x,
                y2: pts[1].y,
                team: 'allies',
              })
            );
            this.spawnText(pts[0].x, pts[0].y, '⛓ ARAME FARPADO (-80% VEL. INFANTARIA)', '#d4a338');
          } else {
            this.barricades.push(
              new BarricadeLine({
                x1: pts[0].x,
                y1: pts[0].y,
                x2: pts[1].x,
                y2: pts[1].y,
                team: 'allies',
              })
            );
            this.spawnText(pts[0].x, pts[0].y, 'DENTES DE DRAGÃO / BARRICADA (+45% DEF)', '#d4a338');
          }
          this.audio.play('door');
        } else {
          this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cost} SUP.`, '#c94a38');
        }
        this.trenchStartWorld = null;
        this.trenchPreview = null;
        this.activeCommandMode = null;
      }
      return;
    }

    // 7. Plantar Campo Minado
    if (this.activeCommandMode === 'build_mine') {
      if (input.mouse.rightClicked) {
        this.activeCommandMode = null;
        return;
      }
      if (input.mouse.clicked) {
        const cost = COMMAND_BY_ID.plant_minefield.cost;
        if (this.supplies >= cost) {
          this.supplies -= cost;
          const cx = clamp(this.worldMouse.x, 120, BATTLEFIELD_SIZE - 120);
          const cy = clamp(this.worldMouse.y, 120, BATTLEFIELD_SIZE - 120);
          const offsets = [
            [0, 0],
            [-28, -22],
            [28, -22],
            [-26, 24],
            [26, 24],
          ];
          for (const [ox, oy] of offsets) {
            this.mines.push(
              new Landmine({
                x: cx + ox,
                y: cy + oy,
                team: 'allies',
                faction: 'player',
                revealed: true,
              })
            );
          }
          this.audio.play('reload');
          this.spawnText(cx, cy, 'CAMPO MINADO PLANTADO (5 MINAS)', '#d4a338');
        } else {
          this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cost} SUP.`, '#c94a38');
        }
        this.activeCommandMode = null;
      }
      return;
    }

    // 8b-0. Editor de Mapa 3D no Modo Local (Adiciona/Remove construções, muros, árvores, move/rotaciona objetos colocados e salva em customMaps.json p/ Deploy)
    if (this.activeCommandMode === 'map_editor') {
      const wx = clamp(Math.round(this.worldMouse.x), 140, BATTLEFIELD_SIZE - 140);
      const wy = clamp(Math.round(this.worldMouse.y), 140, BATTLEFIELD_SIZE - 140);

      // Botão Direito + Arrastar gira o objeto selecionado olhando para o cursor; clique direito simples (ao soltar sem arrastar) cancela seleção
      if (input.mouse.rightDown && this.selectedEditorObject && this.selectedEditorObject.item) {
        if (input.mouse.isRightDragging) {
          this._editorRotatingObject = true;
          const it = this.selectedEditorObject.item;
          const ox = this.selectedEditorObject.kind === 'wall' ? (it.x1 + it.x2) * 0.5 : it.x;
          const oy = this.selectedEditorObject.kind === 'wall' ? (it.y1 + it.y2) * 0.5 : it.y;
          if (dist(ox, oy, wx, wy) > 12) {
            const aimAng =
              this.selectedEditorObject.kind === 'wall'
                ? Math.atan2(wy - oy, wx - ox)
                : Math.atan2(wx - ox, wy - oy);
            this.setSelectedEditorObjectAngle(aimAng, false);
          }
          return;
        }
      }
      if (input.mouse.rightReleased) {
        if (this._editorRotatingObject) {
          this._editorRotatingObject = false;
          this.setSelectedEditorObjectAngle(this.selectedEditorObject?.item?.angle || this.mapEditorAngle || 0, true);
          this._emitHud();
          return;
        }
        this._editorWallDragStart = null;
        this._editorDraggingSector = null;
        this._editorDraggingObject = false;
        this.trenchPreview = null;
        this.selectedEditorSectorId = null;
        this.selectedEditorObject = null;
        this._emitHud();
        return;
      }

      if (input.wasPressed('KeyR')) {
        const deg = this.rotateMapEditorAngle(45);
        this.spawnText(this.worldMouse.x, this.worldMouse.y - 20, `🔄 ROTAÇÃO: ${deg}°`, '#38bdf8');
      }

      const tool = this.mapEditorTool;
      const isEraser = tool === 'eraser' || tool === 'eraser_area';
      const isWallTool =
        tool === 'stone_wall' ||
        tool === 'brick_wall' ||
        tool === 'fortified_wall' ||
        tool === 'trench_line' ||
        tool === 'sandbag_line' ||
        tool === 'tank_trap_line';

      // Arraste ativo de um objeto selecionado (funciona tanto no modo [✋ Mover / Girar] quanto ao segurar e arrastar o objeto recém-colocado!)
      if (this._editorDraggingObject && this.selectedEditorObject) {
        if (input.mouse.down) {
          this.moveSelectedEditorObject(wx, wy, false);
          return;
        }
        if (input.mouse.released || !input.mouse.down) {
          this._editorDraggingObject = false;
          const it = this.selectedEditorObject.item;
          const fx = this.selectedEditorObject.kind === 'wall' ? (it.x1 + it.x2) * 0.5 : it.x;
          const fy = this.selectedEditorObject.kind === 'wall' ? (it.y1 + it.y2) * 0.5 : it.y;
          this.moveSelectedEditorObject(fx, fy, true);
          this._emitHud();
          return;
        }
      }

      if (tool === 'select_move') {
        if (input.mouse.clicked) {
          const hitObj = this._findEditorObjectAt(wx, wy);
          if (hitObj) {
            this.selectedEditorObject = hitObj;
            this._editorDraggingObject = true;
            if (typeof hitObj.item?.angle === 'number') {
              this.mapEditorAngle = ((hitObj.item.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            }
            this.audio?.play?.('switch');
            this._emitHud();
          } else if (this.selectedEditorObject) {
            this.moveSelectedEditorObject(wx, wy, true);
            this._editorDraggingObject = true;
            this.audio?.play?.('pickup');
            this._emitHud();
          }
        }
        return;
      }

      // Mesmo usando uma ferramenta de construção pontual, clicar em cima do objeto recém-selecionado agarra e move ele em vez de empilhar outro em cima
      if (
        !isEraser &&
        !isWallTool &&
        tool !== 'forest_area' &&
        tool !== 'move_sector' &&
        input.mouse.clicked &&
        this.selectedEditorObject?.item
      ) {
        const it = this.selectedEditorObject.item;
        const ox = this.selectedEditorObject.kind === 'wall' ? (it.x1 + it.x2) * 0.5 : it.x;
        const oy = this.selectedEditorObject.kind === 'wall' ? (it.y1 + it.y2) * 0.5 : it.y;
        const grabRadius =
          this.selectedEditorObject.kind === 'structure'
            ? Math.max(55, Math.max(it.w || 80, it.d || 80) * 0.58)
            : 52;
        if (dist(wx, wy, ox, oy) <= grabRadius) {
          this._editorDraggingObject = true;
          return;
        }
      }

      if (tool === 'forest_area') {
        if (input.mouse.clicked) {
          this._editorForestDragStart = { x: wx, y: wy };
          this._editorForestPreview = {
            x: wx,
            y: wy,
            radius: Math.round(180 * (this.mapEditorScale || 1)),
          };
        }
        if (input.mouse.down && this._editorForestDragStart) {
          const d = dist(this._editorForestDragStart.x, this._editorForestDragStart.y, wx, wy);
          this._editorForestPreview = {
            x: this._editorForestDragStart.x,
            y: this._editorForestDragStart.y,
            radius: d >= 45 ? clamp(Math.round(d), 90, 520) : Math.round(180 * (this.mapEditorScale || 1)),
          };
        }
        if (input.mouse.released && this._editorForestDragStart) {
          const start = this._editorForestDragStart;
          const rad = this._editorForestPreview?.radius || Math.round(180 * (this.mapEditorScale || 1));
          this._editorForestDragStart = null;
          this._editorForestPreview = null;
          this._placeEditorForestArea(start.x, start.y, rad);
        }
        return;
      }
      this._editorForestPreview = null;

      if (isWallTool) {
        if (input.mouse.clicked) {
          this._editorWallDragStart = { x: wx, y: wy };
        }
        if (input.mouse.down && this._editorWallDragStart) {
          const d = dist(this._editorWallDragStart.x, this._editorWallDragStart.y, wx, wy);
          if (d >= 24) {
            this.trenchPreview = {
              points: [
                { x: this._editorWallDragStart.x, y: this._editorWallDragStart.y },
                { x: wx, y: wy },
              ],
              tool,
            };
          } else {
            this.trenchPreview = null;
          }
        }
        if (input.mouse.released && this._editorWallDragStart) {
          const start = this._editorWallDragStart;
          this._editorWallDragStart = null;
          this.trenchPreview = null;
          const d = dist(start.x, start.y, wx, wy);
          if (d >= 30) {
            this._placeEditorWallSegment(start.x, start.y, wx, wy, tool);
          } else {
            this._applyMapEditorClick(start.x, start.y);
          }
        }
        return;
      }

      if (tool === 'move_sector') {
        const swx = clamp(wx, 220, BATTLEFIELD_SIZE - 220);
        const swy = clamp(wy, 220, BATTLEFIELD_SIZE - 220);
        if (input.mouse.clicked) {
          const hitSec = (this.map?.sectors || []).find((s) => dist(swx, swy, s.x, s.y) <= 220);
          if (hitSec) {
            this._editorDraggingSector = hitSec;
            this._editorDragStartPos = { x: swx, y: swy };
          } else {
            this._editorDraggingSector = null;
            this._applyMapEditorClick(swx, swy);
          }
        }
        if (input.mouse.down && this._editorDraggingSector && input.mouse.isDragging) {
          this._editorDraggingSector.x = swx;
          this._editorDraggingSector.y = swy;
          this.selectedEditorSectorId = this._editorDraggingSector.id;
          this.renderer?.moveEditorSector?.(this._editorDraggingSector, this.map);
        }
        if (input.mouse.released && this._editorDraggingSector) {
          const draggedSec = this._editorDraggingSector;
          const wasDragged =
            this._editorDragStartPos &&
            dist(this._editorDragStartPos.x, this._editorDragStartPos.y, swx, swy) >= 18;
          this._editorDraggingSector = null;
          this._editorDragStartPos = null;
          if (wasDragged) {
            draggedSec.x = swx;
            draggedSec.y = swy;
            this.selectedEditorSectorId = draggedSec.id;
            this.renderer?.moveEditorSector?.(draggedSec, this.map);
            this.audio?.play?.('pickup');
            this.spawnText(
              swx,
              swy - 24,
              `🚩 ${(draggedSec.shortName || draggedSec.name).toUpperCase()} REPOSICIONADO!`,
              '#4ade80'
            );
            this._emitHud();
          } else {
            this._applyMapEditorClick(swx, swy);
          }
        }
        return;
      }

      if (input.mouse.clicked) {
        this._applyMapEditorClick(this.worldMouse.x, this.worldMouse.y);
      }
      return;
    }

    // 8b. Lançamento Aéreo de Paraquedistas (Batalhão Nível 4+)
    if (this.activeCommandMode === 'paradrop') {
      if (input.mouse.rightClicked) {
        this.activeCommandMode = null;
        return;
      }
      if (input.mouse.clicked) {
        const px = clamp(this.worldMouse.x, 140, BATTLEFIELD_SIZE - 140);
        const py = clamp(this.worldMouse.y, 140, BATTLEFIELD_SIZE - 140);
        if (this.intelRevealed || this.map.isPositionVisibleToAllies(px, py) || this.sandboxMode) {
          if (this.sandboxMode || this.supplies >= 320) {
            if (!this.sandboxMode) this.supplies -= 320;
            this.paradropCooldown = this.sandboxMode ? 0 : 45;
            const para = this.spawnUnit(this.localPlayerFaction || 'player', 'assault_squad', px, py, 0);
            if (para) para.name = 'Paraquedistas 101st Airborne';
            this.audio.play('star');
            this.spawnText(px, py - 24, '🪂 PARAQUEDISTAS EM SOLO!', '#c28e38');
          } else {
            this.notify('SUPRIMENTOS INSUFICIENTES', 'Necessário 320 SUP para lançamento aéreo.', '#c94a38');
          }
        } else {
          this.notify('ÁREA NÃO VISÍVEL', 'Lance os Paraquedistas em qualquer ponto visível do mapa.', '#c94a38');
        }
        this.activeCommandMode = null;
      }
      return;
    }

    // 8. Construir Fortificações Fixas (Torre de Defesa / Guarita, Ninho MG/AT, Bunker de Concreto, Posto de Observação)
    if (
      this.activeCommandMode === 'build_watchtower' ||
      this.activeCommandMode === 'build_emplacement' ||
      this.activeCommandMode === 'build_bunker' ||
      this.activeCommandMode === 'build_outpost'
    ) {
      if (input.mouse.rightClicked) {
        this.activeCommandMode = null;
        this.activeEngineeringActionId = null;
        return;
      }
      if (input.mouse.clicked) {
        const cmd =
          (this.activeEngineeringActionId && COMMAND_BY_ID[this.activeEngineeringActionId]) ||
          COMMAND_ACTIONS.find((c) => c.category === this.activeCommandMode) ||
          COMMAND_BY_ID[this.activeCommandMode];
        const cx = clamp(this.worldMouse.x, 140, BATTLEFIELD_SIZE - 140);
        const cy = clamp(this.worldMouse.y, 140, BATTLEFIELD_SIZE - 140);
        if (cmd && (cmd.id === 'build_outpost' || this.activeCommandMode === 'build_outpost')) {
          const outpostStatus = this.getOutpostPlacementStatus(cx, cy, 'allies');
          if (!outpostStatus.ok) {
            this.audio.play('empty');
            this.notify(
              outpostStatus.reason === 'cap_reached' ? 'LIMITE DE POSTOS ATINGIDO' : 'SETOR NÃO DOMINADO',
              outpostStatus.message,
              '#ef4444'
            );
            return;
          }
        }
        if (cmd && this.supplies >= cmd.cost) {
          this.supplies -= cmd.cost;
          const unitTypeId =
            cmd.id === 'build_watchtower' ? 'watchtower_emplacement' : cmd.id;
          this.spawnUnit('player', unitTypeId, cx, cy, 0);
          this.audio.play('reload');
          this.spawnText(cx, cy, `🗼 ${cmd.short.toUpperCase()} CONSTRUÍDA`, '#a3be8c');
        } else if (cmd) {
          this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cmd.cost} SUP.`, '#c94a38');
        }
        this.activeCommandMode = null;
        this.activeEngineeringActionId = null;
      }
      return;
    }

    // 9. Seleção RTS com Botão Esquerdo ou Toque Simples no Touch (Unidades, Soldados Individuais com Shift+Clique ou Prédios da Base 3D)
    if (input.mouse.clicked) {
      const surrenderedHit = this._findUnitNearWorld(
        this.worldMouse.x,
        this.worldMouse.y,
        56,
        (u) => u.surrendered
      );
      if (surrenderedHit) {
        this._openInterrogationFor(surrenderedHit);
        return;
      }
    }

    // No Modo Câmera [✋], arrastar 1 dedo move a câmera (não desenha caixa de seleção)
    if (input.mouse.down && input.mouse.isDragging && this.touchControlMode !== 'camera') {
      this.selectionBox = {
        x1: input.mouse.dragStartX,
        y1: input.mouse.dragStartY,
        x2: input.mouse.x,
        y2: input.mouse.y,
      };
    }

    if (input.mouse.released) {
      if (this.selectionBox && this.renderer) {
        const minX = Math.min(this.selectionBox.x1, this.selectionBox.x2);
        const maxX = Math.max(this.selectionBox.x1, this.selectionBox.x2);
        const minY = Math.min(this.selectionBox.y1, this.selectionBox.y2);
        const maxY = Math.max(this.selectionBox.y1, this.selectionBox.y2);

        let anySelected = false;
        for (const u of this.units) {
          if (!u.alive || u.faction !== this.myFaction || u.embarkedInId) continue;
          const sc = this.renderer.worldToScreen(u.x, u.y, 12);
          const inside = sc.x >= minX && sc.x <= maxX && sc.y >= minY && sc.y <= maxY;
          u.selected = inside;
          if (inside) anySelected = true;
        }
        if (anySelected) {
          this.selectedBuildingId = null;
    this.selectedStructureId = null;
          this.audio.play('switch');
        }
        this.selectionBox = null;
      } else if (!input.touch?.moved) {
        const additive = input.down('ShiftLeft') || input.down('ShiftRight');

        // Shift + Clique diretamente em um boneco 3D no campo de batalha seleciona aquele Soldado Individual!
        if (additive) {
          const hitSoldier = this._findSoldierNearWorld(this.worldMouse.x, this.worldMouse.y, 26);
          if (hitSoldier) {
            hitSoldier.unit.selected = true;
            hitSoldier.unit.toggleSelectSoldier(hitSoldier.soldier.id, false);
            this.selectedBuildingId = null;
    this.selectedStructureId = null;
            this.audio.play('switch');
            this.spawnText(
              hitSoldier.soldier.worldX,
              hitSoldier.soldier.worldY - 14,
              `🎖 ${hitSoldier.soldier.name} (${Math.ceil(hitSoldier.soldier.hp)} HP)`,
              '#38bdf8'
            );
            this._emitHud();
            return;
          }
        }

        const clickedUnit = this._findUnitNearWorld(
          this.worldMouse.x,
          this.worldMouse.y,
          54,
          (u) => u.faction === this.myFaction
        );

        // Verifica se clicou em um Prédio da Base do jogador local no mundo 3D
        const clickedAlliedBuilding = !clickedUnit
          ? this._findBaseBuildingNearWorld(
              this.worldMouse.x,
              this.worldMouse.y,
              135,
              (b) => b.team === this.myTeam && b.faction === this.myFaction
            )
          : null;

        const clickedStructure =
          !clickedUnit && !clickedAlliedBuilding
            ? this.map.findStructureAt(this.worldMouse.x, this.worldMouse.y, 82)
            : null;

        const clickedWall =
          !clickedUnit && !clickedAlliedBuilding && !clickedStructure
            ? (this.fortifiedWalls || []).find(
                (w) =>
                  w.team === this.myTeam &&
                  (w.hp ?? 2500) > 0 &&
                  w.containsPoint(this.worldMouse.x, this.worldMouse.y, 24)
              )
            : null;

        const currentlySelected = this.units.filter(
          (u) => u.alive && u.faction === this.myFaction && u.selected && !u.embarkedInId
        );

        // SUPORTE TOUCH SCREEN (CELULAR / TABLET):
        // Se foi um Toque Simples (input.touch.tap) no chão, muro, trincheira ou inimigo COM tropa selecionada, emite a ordem!
        if (
          input.mouse.isTouchEvent &&
          input.touch?.tap &&
          !clickedUnit &&
          !clickedAlliedBuilding &&
          currentlySelected.length > 0
        ) {
          this._issueContextualOrderAtWorld(
            this.worldMouse.x,
            this.worldMouse.y,
            currentlySelected,
            null
          );
          return;
        }

        if (clickedWall) {
          this.selectedWallId = clickedWall.id;
          this.selectedStructureId = null;
          this.selectedBuildingId = null;
          this.audio.play('switch');
          this._emitHud();
          return;
        }

        if (clickedStructure) {
          this.selectedStructureId = clickedStructure.id;
          this.selectedBuildingId = null;
          this.selectedWallId = null;
          this.audio.play('switch');
          this._emitHud();
          return;
        }

        if (!additive) {
          for (const u of this.units) u.selected = false;
        }
        if (clickedUnit) {
          clickedUnit.selected = true;
          this.selectedBuildingId = null;
    this.selectedStructureId = null;
          this.audio.play('switch');
        } else if (clickedAlliedBuilding) {
          this.selectedBuildingId = clickedAlliedBuilding.id;
          this.audio.play('switch');
          this.spawnText(
            clickedAlliedBuilding.x,
            clickedAlliedBuilding.y - 30,
            `🏭 ${(clickedAlliedBuilding.short || clickedAlliedBuilding.name).toUpperCase()} SELECIONADO`,
            '#a3be8c'
          );
          this._emitHud();
        } else if (!additive) {
          this.selectedBuildingId = null;
    this.selectedStructureId = null;
        }
      }
    }

    // 10. Se um Prédio da Base estiver selecionado (sem tropas selecionadas), Botão Direito define o Ponto de Encontro (Rally Point)
    const selectedUnits = this.units.filter(
      (u) => u.alive && u.faction === this.myFaction && u.selected && !u.embarkedInId
    );
    if (selectedUnits.length === 0) {
      this.orientationPreview = null;
      this.coverSnapPreview = null;
      this.hoverPathPreview = null;
      this.rightOrderStartWorld = null;
      if (this.selectedBuildingId && input.mouse.rightClicked) {
        const bld = this.baseBuildings.find(
          (b) => b.id === this.selectedBuildingId && b.team === this.myTeam && b.alive !== false
        );
        if (bld) {
          bld.rallyX = clamp(this.worldMouse.x, 120, BATTLEFIELD_SIZE - 120);
          bld.rallyY = clamp(this.worldMouse.y, 120, BATTLEFIELD_SIZE - 120);
          this.audio.play('pickup');
          this.spawnText(bld.rallyX, bld.rallyY, `🚩 PONTO DE ENCONTRO (${bld.short || 'BASE'})`, '#a3be8c');
          this._emitHud();
        }
      }
      return;
    }

    // 10b. Prévia Visual de Encaixe em Muros/Trincheiras + Linha de Trajetória Inteligente (Waypoints contornando objetos)
    const leadInf = selectedUnits.find((u) => u.spec.type === 'infantry');
    const leadAny = leadInf || selectedUnits[0];
    if (leadInf && !this.orientationPreview && !this.activeCommandMode && !this.activeAirStrikeMode) {
      const threat = this._getThreatOriginFor(this.worldMouse.x, this.worldMouse.y, 'allies');
      this.coverSnapPreview = this.map.findNearestCoverSnap(
        this.worldMouse.x,
        this.worldMouse.y,
        leadInf.soldiersAlive || 5,
        threat.x,
        threat.y,
        this.trenches,
        this.fortifiedWalls,
        this.barricades,
        95
      );
    } else {
      this.coverSnapPreview = null;
    }

    if (
      leadAny &&
      (input.mouse.rightDown || this.rightOrderStartWorld) &&
      !this.activeCommandMode &&
      !this.activeAirStrikeMode &&
      !this.activeDroneLaunchMode
    ) {
      const destX = this.coverSnapPreview ? this.coverSnapPreview.cx : this.worldMouse.x;
      const destY = this.coverSnapPreview ? this.coverSnapPreview.cy : this.worldMouse.y;
      // Recalcula a prévia A* apenas quando o destino/unidade muda de célula (evita custo por frame)
      const previewKey = `${leadAny.id}_${Math.round(leadAny.x / 32)}_${Math.round(leadAny.y / 32)}_${Math.round(
        destX / 32
      )}_${Math.round(destY / 32)}`;
      if (previewKey !== this._hoverPathKey || !this.hoverPathPreview) {
        this._hoverPathKey = previewKey;
        this.hoverPathPreview = this.map.computeObstacleDetourPath(
          leadAny.x,
          leadAny.y,
          destX,
          destY,
          leadAny.radius || 24,
          this.fortifiedWalls,
          this.barricades
        );
      }
    } else {
      this.hoverPathPreview = null;
      this._hoverPathKey = null;
    }

    // 11. Clique Direito + Arrastar (ou Toque Longo 0.4s + Arrastar no Mobile): Orientação Direcional de Formação e Ordens Táticas
    if (input.mouse.rightClicked) {
      this.rightOrderStartWorld = {
        x: clamp(this.worldMouse.x, 90, BATTLEFIELD_SIZE - 90),
        y: clamp(this.worldMouse.y, 90, BATTLEFIELD_SIZE - 90),
      };
    }

    if (input.mouse.rightDown && input.mouse.isRightDragging && this.rightOrderStartWorld) {
      const dx = this.worldMouse.x - this.rightOrderStartWorld.x;
      const dy = this.worldMouse.y - this.rightOrderStartWorld.y;
      const facingAngle = Math.hypot(dx, dy) > 8 ? Math.atan2(dy, dx) : 0;
      const lead = selectedUnits[0];
      const count = lead.spec.type === 'infantry' ? lead.soldiersAlive || 4 : selectedUnits.length;
      const points = SquadUnit.computeFormationWorldPreview(
        this.rightOrderStartWorld.x,
        this.rightOrderStartWorld.y,
        facingAngle,
        lead.formation || 'line',
        Math.max(3, count),
        lead.spacingMeters || 3.0
      );
      this.orientationPreview = {
        center: { ...this.rightOrderStartWorld },
        facingAngle,
        points,
      };
    }

    if (input.mouse.rightReleased || (!input.mouse.rightDown && this.rightOrderStartWorld)) {
      const startPt = this.rightOrderStartWorld || this.worldMouse;
      const wx = clamp(startPt.x, 90, BATTLEFIELD_SIZE - 90);
      const wy = clamp(startPt.y, 90, BATTLEFIELD_SIZE - 90);
      const draggedAngle = this.orientationPreview ? this.orientationPreview.facingAngle : null;

      this.orientationPreview = null;
      this.rightOrderStartWorld = null;

      this._issueContextualOrderAtWorld(wx, wy, selectedUnits, draggedAngle);
    }
  }

  // Emite Ordem Contextual RTS (usada tanto pelo Clique Direito no PC quanto pelo Toque Simples no Mobile/Tablet)
  _issueContextualOrderAtWorld(wx, wy, selectedUnits, draggedAngle = null) {
    const cx = clamp(wx, 90, BATTLEFIELD_SIZE - 90);
    const cy = clamp(wy, 90, BATTLEFIELD_SIZE - 90);

    // Libera guarnição anterior se as tropas receberem nova ordem fora do prédio
    for (const u of selectedUnits) {
      if (u.garrisonedBuildingId) {
        this._ungarrisonUnit(u);
      }
    }

    const surrenderedEnemy = this._findUnitNearWorld(cx, cy, 56, (u) => u.surrendered);
    if (surrenderedEnemy) {
      this._openInterrogationFor(surrenderedEnemy);
      return;
    }

    // 1. Verifica se clicou/tocou sobre uma Estrutura de Base Inimiga -> Ordem de Demolição de Base
    const targetEnemyBuilding = this._findBaseBuildingNearWorld(
      cx,
      cy,
      130,
      (b) =>
        b.team === 'enemies' &&
        b.alive !== false &&
        (this.intelRevealed || this.map.isPositionVisibleToAllies(b.x, b.y))
    );
    if (targetEnemyBuilding && draggedAngle === null) {
      for (const u of selectedUnits) {
        u.holdPosition = false;
        u.setAttackBuildingOrder(targetEnemyBuilding);
      }
      this.audio.play('reload');
      this.spawnText(
        targetEnemyBuilding.x,
        targetEnemyBuilding.y - 24,
        `🎯 DEMOLIR ${(targetEnemyBuilding.short || 'BASE INIMIGA').toUpperCase()}`,
        '#c94a38'
      );
      return;
    }

    // 2. Verifica se clicou/tocou sobre uma Unidade Inimiga -> Ordem de Ataque
    const targetEnemy = this._findUnitNearWorld(
      cx,
      cy,
      58,
      (u) =>
        u.team === 'enemies' &&
        !u.surrendered &&
        (this.intelRevealed || this.map.isPositionVisibleToAllies(u.x, u.y))
    );
    if (targetEnemy && draggedAngle === null) {
      for (const u of selectedUnits) {
        u.holdPosition = false;
        u.setAttackOrder(targetEnemy);
      }
      this.audio.play('reload');
      this.spawnText(targetEnemy.x, targetEnemy.y, '🎯 ALVO DESIGNADO', '#c94a38');
      return;
    }

    // 3. Verifica se clicou/tocou sobre uma Construção Intacta -> Guarnição (aliada/livre) ou Invasão/Ataque (ocupada por inimigo)
    const targetBuilding = this.map.findStructureAt(cx, cy, 76);
    if (
      draggedAngle === null &&
      targetBuilding &&
      targetBuilding.garrisonable &&
      !targetBuilding.destroyed
    ) {
      if (!targetBuilding.garrisonUnitId || targetBuilding.garrisonTeam === this.myTeam) {
        const infSquad = selectedUnits.find((u) => u.spec.type === 'infantry');
        if (infSquad) {
          infSquad.holdPosition = false;
          infSquad.setGarrisonOrder(targetBuilding);
          this.audio.play('pickup');
          this.spawnText(
            targetBuilding.x,
            targetBuilding.y,
            `🏠 OCUPAR ${targetBuilding.name.toUpperCase()}`,
            '#d4a338'
          );
          return;
        }
      } else {
        // Construção ocupada pelo inimigo: Tropa de Assalto invade para expulsar; Tanques/Veículos/outras tropas atacam o local!
        const enemyInside = this.units.find(
          (un) => un.id === targetBuilding.garrisonUnitId && un.alive
        );
        const assaultUnits = selectedUnits.filter((u) => u.unitType === 'assault_squad');
        const otherUnits = selectedUnits.filter((u) => u.unitType !== 'assault_squad');
        if (assaultUnits.length > 0) {
          assaultUnits.forEach((au) => {
            au.holdPosition = false;
            au.setGarrisonOrder(targetBuilding);
            au.order.type = 'storm_building';
          });
          this.audio.play('pickup');
          this.spawnText(
            targetBuilding.x,
            targetBuilding.y - 18,
            `⚔️ INVADIR ${targetBuilding.name.toUpperCase()}!`,
            '#ef4444'
          );
        }
        if (otherUnits.length > 0 && enemyInside) {
          otherUnits.forEach((ou) => {
            ou.holdPosition = false;
            ou.setAttackOrder(enemyInside);
          });
          if (assaultUnits.length === 0) {
            this.audio.play('pickup');
            this.spawnText(
              targetBuilding.x,
              targetBuilding.y - 18,
              `🎯 FOGO NA CONSTRUÇÃO!`,
              '#f97316'
            );
          }
        }
        if (assaultUnits.length > 0 || (otherUnits.length > 0 && enemyInside)) {
          return;
        }
      }
    }

    // 3b. Verifica se clicou/tocou em um Veículo de Transporte de Tropas Aliado -> Ordem de Embarque
    const infToBoard = selectedUnits.filter((u) => u.spec.type === 'infantry');
    if (infToBoard.length > 0 && draggedAngle === null) {
      const targetTransport = this._findUnitNearWorld(
        cx,
        cy,
        62,
        (u) => u.team === this.myTeam && u.spec.isTransport && u.alive
      );
      if (targetTransport) {
        let queued = 0;
        for (const inf of infToBoard) {
          if (targetTransport.canBoardSquad(inf, this.units)) {
            inf.holdPosition = false;
            const path = this.map.computeObstacleDetourPath(
              inf.x,
              inf.y,
              targetTransport.x,
              targetTransport.y,
              inf.radius || 22,
              this.fortifiedWalls,
              this.barricades
            );
            inf.setBoardTransportOrder(targetTransport, path);
            queued++;
          }
        }
        if (queued > 0) {
          this.audio.play('pickup');
          this.spawnText(targetTransport.x, targetTransport.y - 26, '🚛 EMBARCANDO NO TRANSPORTE', '#4ade80');
          return;
        }
      }
    }

    // 4. SISTEMA DE ENCAIXE EM MUROS, SACOS DE AREIA, CARCAÇAS E TRINCHEIRAS ("COVER SNAPPING" ESTILO COH)
    const infSquads = selectedUnits.filter((u) => u.spec.type === 'infantry');
    if (infSquads.length > 0 && draggedAngle === null) {
      const threat = this._getThreatOriginFor(cx, cy, 'allies');
      const snap = this.map.findNearestCoverSnap(
        cx,
        cy,
        infSquads[0].soldiersAlive || 5,
        threat.x,
        threat.y,
        this.trenches,
        this.fortifiedWalls,
        this.barricades,
        95
      );
      if (snap) {
        selectedUnits.forEach((u, idx) => {
          u.holdPosition = false;
          if (u.spec.type === 'infantry') {
            const unitSnap =
              idx === 0
                ? snap
                : this.map.findNearestCoverSnap(
                    cx + idx * 32,
                    cy + idx * 24,
                    u.soldiersAlive || 5,
                    threat.x,
                    threat.y,
                    this.trenches,
                    this.fortifiedWalls,
                    this.barricades,
                    135
                  ) || snap;
            const trenchNetPath =
              u.inTrench && unitSnap.trenchId
                ? this.findTrenchNetworkPath(u.x, u.y, unitSnap.cx, unitSnap.cy)
                : null;
            const path =
              trenchNetPath ||
              this.map.computeObstacleDetourPath(
                u.x,
                u.y,
                unitSnap.cx,
                unitSnap.cy,
                u.radius || 22,
                this.fortifiedWalls,
                this.barricades
              );
            u.setCoverSnapOrder(unitSnap, path);
          } else {
            const path = this.map.computeObstacleDetourPath(
              u.x,
              u.y,
              snap.cx - 45,
              snap.cy,
              u.radius || 32,
              this.fortifiedWalls,
              this.barricades
            );
            u.setMoveOrder(snap.cx - 45, snap.cy, null, snap.facingAngle, path);
          }
        });
        this.audio.play('pickup');
        this.spawnText(snap.cx, snap.cy - 18, `🛡 ${snap.label}`, '#4ade80');
        return;
      }
    }

    // 5. Ordem de Movimento em Formação (com Waypoints contornando obstáculos + orientação direcional)
    const cols = Math.ceil(Math.sqrt(selectedUnits.length));
    const spacing = 72;
    selectedUnits.forEach((u, idx) => {
      u.holdPosition = false;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const ox = (col - (cols - 1) * 0.5) * spacing;
      const oy = (row - Math.floor((selectedUnits.length - 1) / cols) * 0.5) * spacing;
      const destX = clamp(cx + ox, 90, BATTLEFIELD_SIZE - 90);
      const destY = clamp(cy + oy, 90, BATTLEFIELD_SIZE - 90);
      const path = this.map.computeObstacleDetourPath(
        u.x,
        u.y,
        destX,
        destY,
        u.radius || 24,
        this.fortifiedWalls,
        this.barricades
      );
      u.setMoveOrder(destX, destY, null, draggedAngle, path);
    });
    this.audio.play('pickup');
    this.texts = this.texts.filter((t) => !t.isOrderMarker);
    this.texts.push(
      Object.assign(
        new FloatingText({
          x: cx,
          y: cy,
          text: draggedAngle !== null ? '🧭 POSICIONAR FORMAÇÃO DIRECIONAL' : '▶ MOVER ESQUADRÃO',
          color: '#7faed9',
          life: 1.2,
        }),
        { isOrderMarker: true }
      )
    );
  }

  getSolidBuildingBoxes() {
    return this.map?.getSolidBuildingBoxes(this.fortifiedWalls, this.barricades) || [];
  }

  pushPointOutsideAllBoxes(pos, currentSquad = null, solidBoxes = null) {
    return this.map?.pushPointOutsideAllBoxes(pos, currentSquad, solidBoxes) || pos;
  }

  activateParatrooperDrop() {
    if ((this.paradropCooldown || 0) > 0 && !this.sandboxMode) {
      this.notify('PARAQUEDISTAS EM RECARGA', `Aguarde ${Math.ceil(this.paradropCooldown)}s.`, '#c94a38');
      return false;
    }
    this.activeCommandMode = this.activeCommandMode === 'paradrop' ? null : 'paradrop';
    this._emitHud();
    return true;
  }

  deployUnlockedBattalion(battalionId, unitType, costSup = 250) {
    if (!this.sandboxMode && this.supplies < costSup) {
      this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${costSup} SUP.`, '#c94a38');
      return false;
    }
    if (!this.sandboxMode) this.supplies -= costSup;
    const fac = this.localPlayerFaction || 'player';
    const hq = this.map?.hqs?.[fac] || { x: 1150, y: 4280 };
    const sq = this.spawnUnit(fac, unitType, hq.x + (fac === 'player' ? 140 : -140), hq.y + randInt(-90, 90), fac === 'player' ? 0 : Math.PI);
    if (sq) {
      this.audio.play('pickup');
      this.spawnText(sq.x, sq.y - 22, `🎖️ BATALHÃO MOBILIZADO!`, '#c28e38');
    }
    this._emitHud();
    return true;
  }

  repairSelectedWallOrBuilding() {
    const cost = this.sandboxMode ? 0 : 60;
    const bld = this.selectedBuildingId
      ? this.baseBuildings.find((b) => b.id === this.selectedBuildingId && b.alive !== false)
      : null;
    const wall = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;
    const target = wall || bld;
    if (!target) return false;
    if (this.supplies < cost) {
      this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cost} SUP para reparo.`, '#c94a38');
      return false;
    }
    this.supplies -= cost;
    target.hp = target.maxHp || 2500;
    const pos = wall ? wall.getCenter() : { x: bld.x, y: bld.y };
    this.audio.play('reload');
    this.spawnText(pos.x, pos.y - 20, '🔧 ESTRUTURA REPARADA 100%', '#4ade80');
    this._emitHud();
    return true;
  }

  convertSelectedWallToGate() {
    const wall = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;
    if (!wall) return false;
    wall.isGate = !wall.isGate;
    wall._meshVersion = (wall._meshVersion || 1) + 1;
    const c = wall.getCenter();
    this.audio.play('door');
    this.spawnText(
      c.x,
      c.y - 20,
      wall.isGate ? '🚧 PORTÃO BLINDADO ATIVADO!' : '🧱 CONVERTIDO EM MURO FECHADO',
      '#c28e38'
    );
    this._emitHud();
    return true;
  }

  reinforceSelectedWall() {
    const wall = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;
    if (!wall || wall.reinforced) return false;
    const cost = this.sandboxMode ? 0 : 80;
    if (this.supplies < cost) {
      this.notify('SUPRIMENTOS INSUFICIENTES', `Necessário ${cost} SUP para reforçar muralha.`, '#c94a38');
      return false;
    }
    this.supplies -= cost;
    wall.reinforced = true;
    wall.maxHp = Math.round((wall.maxHp || 2500) * 1.5);
    wall.hp = wall.maxHp;
    wall._meshVersion = (wall._meshVersion || 1) + 1;
    const c = wall.getCenter();
    this.audio.play('reload');
    this.spawnText(c.x, c.y - 20, '⬆️ MURALHA BLINDADA (+50% HP)!', '#a3be8c');
    this._emitHud();
    return true;
  }

  _ungarrisonUnit(unit) {
    if (!unit.garrisonedBuildingId) return;
    const st = this.map.structures.find((s) => s.id === unit.garrisonedBuildingId);
    if (st) {
      st.garrisonUnitId = null;
      st.garrisonTeam = null;
      st.garrisonedSquad = null;
      unit.x = st.x + (unit.team === 'allies' ? -st.w * 0.68 : st.w * 0.68);
      unit.y = st.y + st.d * 0.68;
    }
    unit.garrisonedBuildingId = null;
    unit.garrisonedBuilding = null;
  }

  _getSquadForStructureOrder(st) {
    const selectedInf = this.units.find(
      (u) => u.alive && u.faction === 'player' && u.selected && u.spec.type === 'infantry' && !u.embarkedInId
    );
    if (selectedInf) return selectedInf;
    let best = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.faction !== 'player' || u.spec.type !== 'infantry' || u.embarkedInId || u.garrisonedBuildingId) continue;
      const d = dist(u.x, u.y, st.x, st.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  structureGarrisonOrder(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId && !s.destroyed);
    if (!st || !st.garrisonable) return false;
    const sq = this._getSquadForStructureOrder(st);
    if (!sq) {
      this.notify('SEM INFANTARIA DISPONÍVEL', 'Produza ou selecione um esquadrão de infantaria.', '#c94a38');
      return false;
    }
    if (sq.garrisonedBuildingId) this._ungarrisonUnit(sq);
    sq.holdPosition = false;
    sq.setGarrisonOrder(st);
    this.selectedStructureId = null;
    this.audio.play('pickup');
    this.spawnText(st.x, st.y - 20, `🏠 OCUPAR ${st.name.toUpperCase()}`, '#d4a338');
    this._emitHud();
    return true;
  }

  structureExternalCoverOrder(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId && !s.destroyed);
    if (!st) return false;
    const sq = this._getSquadForStructureOrder(st);
    if (!sq) return false;
    if (sq.garrisonedBuildingId) this._ungarrisonUnit(sq);
    const fx = clamp(st.x - (st.w * 0.5 + 32), 90, BATTLEFIELD_SIZE - 90);
    const fy = clamp(st.y, 90, BATTLEFIELD_SIZE - 90);
    const path = this.map.buildPathAroundObstacles({ x: sq.x, y: sq.y }, { x: fx, y: fy }, 22, this.fortifiedWalls, this.barricades);
    sq.setMoveOrder(fx, fy, null, 0, path);
    this.selectedStructureId = null;
    this.audio.play('pickup');
    this.spawnText(fx, fy - 18, '🛡️ COBERTURA EXTERNA', '#4ade80');
    this._emitHud();
    return true;
  }

  structureUngarrisonOrder(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId);
    if (!st || !st.garrisonUnitId) return false;
    const u = this.units.find((un) => un.id === st.garrisonUnitId && un.alive);
    if (u) this._ungarrisonUnit(u);
    this.selectedStructureId = null;
    this.audio.play('door');
    this._emitHud();
    return true;
  }

  structureSelectGarrisonedUnit(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId);
    if (!st || !st.garrisonUnitId) return false;
    const u = this.units.find((un) => un.id === st.garrisonUnitId && un.alive);
    if (!u) return false;
    for (const other of this.units) other.selected = false;
    u.selected = true;
    this.selectedStructureId = null;
    this.audio.play('switch');
    this._emitHud();
    return true;
  }

  structureObservationPost(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId && !s.destroyed);
    if (!st) return false;
    st.observationBoosted = !st.observationBoosted;
    if (st.observationBoosted) {
      this.map.revealFogAt?.(st.x, st.y, 560);
      this.spawnText(st.x, st.y - 24, '🔭 POSTO DE OBSERVAÇÃO ATIVO', '#38bdf8');
    }
    this.audio.play('star');
    this._emitHud();
    return true;
  }

  structureAssaultWithGrenades(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId && !s.destroyed);
    if (!st) return false;
    const sq = this._getSquadForStructureOrder(st);
    if (!sq) return false;
    const fx = clamp(st.x - (st.w * 0.5 + 48), 90, BATTLEFIELD_SIZE - 90);
    const fy = clamp(st.y, 90, BATTLEFIELD_SIZE - 90);
    const path = this.map.buildPathAroundObstacles({ x: sq.x, y: sq.y }, { x: fx, y: fy }, 22, this.fortifiedWalls, this.barricades);
    sq.setMoveOrder(fx, fy, null, 0, path);
    if (st.garrisonUnitId) {
      const enemyInside = this.units.find((u) => u.id === st.garrisonUnitId && u.alive);
      if (enemyInside) sq.setAttackOrder(enemyInside);
    }
    if (dist(sq.x, sq.y, st.x, st.y) <= 280) {
      this.throwGrenadeAt?.(sq, st.x, st.y);
    }
    this.selectedStructureId = null;
    this.audio.play('pickup');
    this.spawnText(st.x, st.y - 22, '💣 ASSALTAR PRÉDIO!', '#ef4444');
    this._emitHud();
    return true;
  }

  structureDemolishOrder(structureId) {
    const st = this.map.structures.find((s) => s.id === structureId && !s.destroyed);
    if (!st) return false;
    const attackers = this.units.filter(
      (u) => u.alive && u.faction === 'player' && (u.selected || u.spec.type === 'vehicle' || u.unitType === 'engineers')
    );
    const sel = attackers.filter((u) => u.selected);
    const list = sel.length > 0 ? sel : attackers.slice(0, 2);
    list.forEach((u) => {
      const fx = clamp(st.x - (st.w * 0.5 + 85), 90, BATTLEFIELD_SIZE - 90);
      const fy = clamp(st.y, 90, BATTLEFIELD_SIZE - 90);
      u.setMoveOrder(fx, fy);
    });
    st.hp = Math.max(0, (st.hp ?? 600) - 220);
    this.spawnExplosionParticles?.(st.x, st.y, 24);
    this.playSoundAt?.('explosion', st.x, st.y, 0.9);
    if (st.hp <= 0) {
      st.destroyed = true;
      if (st.garrisonUnitId) {
        const gUnit = this.units.find((u) => u.id === st.garrisonUnitId && u.alive);
        if (gUnit) {
          this._ungarrisonUnit(gUnit);
          gUnit.takeDamage(120, 'allies', this, true, true, st.x, st.y);
        }
      }
      this.spawnText(st.x, st.y - 24, '💥 ESTRUTURA DEMOLIDA!', '#f97316');
    } else {
      this.spawnText(st.x, st.y - 24, '💥 DEMOLINDO ESTRUTURA!', '#f97316');
    }
    this.selectedStructureId = null;
    this._emitHud();
    return true;
  }

  _findUnitNearWorld(wx, wy, maxDist, predicate) {
    let best = null;
    let bestD = maxDist;
    for (const u of this.units) {
      if (!u.alive || u.captured || u.embarkedInId) continue;
      if (predicate && !predicate(u)) continue;
      const d = dist(wx, wy, u.x, u.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  _findSoldierNearWorld(wx, wy, maxDist = 24) {
    let bestUnit = null;
    let bestSoldier = null;
    let bestD = maxDist;

    for (const u of this.units) {
      if (!u.alive || u.captured || u.faction !== this.myFaction || u.spec.type !== 'infantry' || !u.soldiers) {
        continue;
      }
      u.updateSoldierWorldPositions();
      for (const s of u.soldiers) {
        if (!s.alive) continue;
        const d = dist(wx, wy, s.worldX, s.worldY);
        if (d < bestD) {
          bestD = d;
          bestUnit = u;
          bestSoldier = s;
        }
      }
    }

    return bestUnit && bestSoldier ? { unit: bestUnit, soldier: bestSoldier } : null;
  }

  capturePrisoner(surrenderedUnit) {
    try {
      if (!surrenderedUnit || surrenderedUnit.captured) return false;
      const powCamp = this.baseBuildings.find(
        (b) => b.faction === 'player' && b.buildingType === 'pow_camp' && b.alive !== false
      );
      if (!powCamp) {
        this.audio.play('empty');
        this.notify(
          '⚠️ CAMPO DE DETENÇÃO NECESSÁRIO!',
          'Construa um Campo de Detenção & Inteligência na sua Base para capturar Comandantes inimigos!',
          '#eab308'
        );
        return false;
      }

      const dossier = this._createPrisonerDossier(surrenderedUnit);
      if (this.powPrisoners.length < 10 && !this.powPrisoners.some((p) => p.id === dossier.id)) {
        this.powPrisoners.push(dossier);
      }
      surrenderedUnit.captured = true;
      surrenderedUnit.alive = false;
      surrenderedUnit.selected = false;
      surrenderedUnit.order = { type: 'hold', targetX: surrenderedUnit.x, targetY: surrenderedUnit.y };

      for (const other of this.units) {
        if (other.order?.targetUnitId === surrenderedUnit.id) {
          other.order.type = 'hold';
          other.order.targetUnitId = null;
        }
      }

      this.audio.play('pickup');
      this.spawnText(surrenderedUnit.x, surrenderedUnit.y - 24, '★ COMANDANTE CAPTURADO!', '#facc15');
      this.notify(
        '★ COMANDANTE INIMIGO CAPTURADO!',
        'Abra o Campo de Prisioneiros na Base para Interrogar e extrair inteligência.',
        '#a3be8c'
      );
      this._emitHud();
      return true;
    } catch (err) {
      console.warn('capturePrisoner error:', err);
      return false;
    }
  }

  _openInterrogationFor(surrenderedUnit) {
    return this.capturePrisoner(surrenderedUnit);
  }

  update(realDt) {
    for (const n of this.notifications) n.life -= realDt;
    this.notifications = this.notifications.filter((n) => n.life > 0);

    for (const p of this.tacticalPings) p.life -= realDt;
    this.tacticalPings = this.tacticalPings.filter((p) => p.life > 0);

    if (this.menuActive) {
      // Batalha ao vivo em câmera lenta no fundo do Menu Inicial
      if (!this._menuBattleSeeded && this.units?.length > 0) {
        this._menuBattleSeeded = true;
        this.intelRevealed = true;
        this.sandboxFogDisabled = true;
        this.supplies = Math.max(this.supplies, 1400);
        this.allyAiSupplies = Math.max(this.allyAiSupplies || 0, 1400);
        this.enemySupplies.enemy_1 = Math.max(this.enemySupplies.enemy_1 || 0, 1400);
      }
      const bgDt = Math.min(realDt, 0.05) * 0.42;
      if (bgDt > 0 && !this.gameOver) {
        this._updateWreckSmoke(bgDt);
        this._updateBuildingProduction(bgDt);
        this._updateEconomyAndSectors(bgDt);
        this._updateAirDoctrinesAndAircrafts(bgDt);
        this._updateAICommanders(bgDt);
        this._updateUnitsAndCombat(bgDt);
        this._updateBulletsAndMines(bgDt);
        this.map.updateFrontline(this.units, bgDt);
        this._updateParticlesAndTexts(bgDt);
        this._updateDirectorCamera(realDt);
      }
      this.hudSyncTimer -= realDt;
      if (this.hudSyncTimer <= 0) {
        this.hudSyncTimer = 0.25;
        this._emitHud();
      }
      return;
    }

    if (this.paused || this.gameOver) {
      this._updateParticlesAndTexts(realDt);
      this.orientationPreview = null;
      this.rightOrderStartWorld = null;
      this.selectionBox = null;
      if (this.audio?.updateContinuousVehiclesAndDrones) {
        this.audio.updateContinuousVehiclesAndDrones({ paused: true });
      }
      this._emitHud();
      return;
    }

    // Input da câmera e ordens funcionam mesmo com Pausa Tática (timeScale === 0)
    this._handleRTSInput(realDt);
    if (this.spectatorMode && this.directorCamActive) {
      this._updateDirectorCamera(realDt);
    }

    const safeDt = Math.min(realDt, 0.1);
    if (this.isMultiplayer && this.timeScale !== 1.0) {
      this.timeScale = 1.0;
    }
    const ts = this.isMultiplayer ? 1.0 : (Number.isFinite(this.timeScale) ? this.timeScale : 1.0);
    const simDt = safeDt * ts;
    if (simDt > 0) {
      this.matchStats.elapsedSeconds = (this.matchStats.elapsedSeconds || 0) + simDt;
      if (this.enemyProductionDebuffTimer > 0) {
        this.enemyProductionDebuffTimer = Math.max(0, this.enemyProductionDebuffTimer - simDt);
      }
      if (this.enemySabotageTimer > 0) {
        this.enemySabotageTimer = Math.max(0, this.enemySabotageTimer - simDt);
      }
      const hasPowCamp = this.baseBuildings.some(
        (b) => b.faction === 'player' && b.buildingType === 'pow_camp' && b.alive !== false
      );
      if (hasPowCamp && this.powPrisoners && this.powPrisoners.length > 0) {
        this.supplies += this.powPrisoners.length * 5 * simDt;
      }
      this._updateWreckSmoke(simDt);
      this._updateBuildingProduction(simDt);
      this._updateResearch(simDt);
      this._updateDrones(simDt);
      this._updateEconomyAndSectors(simDt);
      this._updateAirDoctrinesAndAircrafts(simDt);
      this._updateAICommanders(simDt);
      this._updateUnitsAndCombat(simDt);
      this._updateBulletsAndMines(simDt);
      this.map.updateFogOfWar(
        this.units,
        this.baseBuildings.filter((b) => b.alive !== false),
        simDt,
        this.localPlayerTeam || 'allies'
      );
      this.map.updateFrontline(this.units, simDt);
      this._updateParticlesAndTexts(simDt);

      // Salvamento Automático a cada 30 segundos em partidas locais
      if (!this.isMultiplayer && !this.spectatorMode && !this.mapEditorOpen && !this.gameOver) {
        this.autoSaveTimer = (this.autoSaveTimer ?? 30) - realDt;
        if (this.autoSaveTimer <= 0) {
          this.autoSaveTimer = 30;
          this.autoSaveBattle();
        }
      }

      // Heartbeat de Estado Multiplayer (suave a cada 0.25s pelo Host)
      if (this.isMultiplayer && this.localSlot === 1 && this.networkManager) {
        this.mpHeartbeatTimer = (this.mpHeartbeatTimer || 0) - simDt;
        if (this.mpHeartbeatTimer <= 0) {
          this.mpHeartbeatTimer = 0.25;
          this.networkManager.sendStateHeartbeat({
            sectors: this.map.sectors.map((s) => ({
              id: s.id,
              owner: s.owner,
              captureProgress: Math.round(s.captureProgress || 0),
            })),
            units: this.units
              .filter((u) => u.alive)
              .slice(0, 80)
              .map((u) => ({
                id: u.id,
                hp: Math.round(u.hp),
                x: Math.round(u.x),
                y: Math.round(u.y),
                angle: Number((u.angle || 0).toFixed(3)),
              })),
            powCount: this.powPrisoners?.length || 0,
          });
        }
      }

      // Condição de vitória por 100% Pontos de Vitória (1000 PTS)
      if (!this.gameOver && this.victoryPoints >= 1000) {
        this._triggerGameOver(
          'allies',
          'VITÓRIA TOTAL — FRENTE CONQUISTADA!',
          'Seu batalhão atingiu 100% dos Pontos de Vitória e dominou o teatro de operações!'
        );
      }
    } else {
      // Mantém os textos flutuantes de confirmação animados mesmo com o jogo pausado no Editor de Mapa
      this._updateParticlesAndTexts(safeDt);
    }

    // Atualiza som contínuo de motores diesel/esteiras e drones conforme distância da câmera
    if (this.audio?.updateContinuousVehiclesAndDrones) {
      let movingVehicles = 0;
      let maxSpeedRatio = 0;
      let closestVehicleDist = 9999;
      for (const u of this.units) {
        if (!u.alive || u.spec.type !== 'vehicle') continue;
        const spd = Math.hypot(u.vx || 0, u.vy || 0);
        if (spd > 6) {
          movingVehicles++;
          maxSpeedRatio = Math.max(maxSpeedRatio, Math.min(1, spd / (u.spec.speed || 70)));
          const d = dist(this.camera.x, this.camera.y, u.x, u.y);
          if (d < closestVehicleDist) closestVehicleDist = d;
        }
      }
      let closestDroneDist = 9999;
      for (const dr of this.activeDrones) {
        const d = dist(this.camera.x, this.camera.y, dr.x, dr.y);
        if (d < closestDroneDist) closestDroneDist = d;
      }
      this.audio.updateContinuousVehiclesAndDrones({
        movingVehicles,
        maxSpeedRatio,
        closestVehicleDist,
        activeDrones: this.activeDrones.length,
        closestDroneDist,
        paused: this.timeScale === 0,
      });
    }

    this.hudSyncTimer -= realDt;
    if (this.hudSyncTimer <= 0) {
      this.hudSyncTimer = 0.08;
      this._emitHud();
    }
  }

  _updateAirDoctrinesAndAircrafts(dt) {
    for (const key of Object.keys(this.airCooldowns)) {
      if (this.airCooldowns[key] > 0) {
        this.airCooldowns[key] = Math.max(0, this.airCooldowns[key] - dt);
      }
    }

    for (const ac of this.aircrafts) {
      ac.life -= dt;
      ac.x += ac.vx * dt;
      ac.y += ac.vy * dt;

      if (!ac.payloadDropped && Math.abs(ac.x - ac.targetX) <= 95) {
        ac.payloadDropped = true;
        if (ac.type === 'a10_strafe') {
          // Rajada linear de canhão 30mm GAU-8
          for (let i = -3; i <= 3; i++) {
            const sx = ac.targetX + i * 55;
            const sy = ac.targetY + (Math.random() - 0.5) * 45;
            this.spawnExplosionParticles(sx, sy, 22);
            for (const u of this.units) {
              if (!u.alive || u.captured || u.team === 'allies') continue;
              if (dist(sx, sy, u.x, u.y) <= 135) {
                u.takeDamage(68, 'allies', this, true, true, sx, sy);
              }
            }
            for (const bld of this.baseBuildings) {
              if (bld.alive === false || bld.team === 'allies') continue;
              if (dist(sx, sy, bld.x, bld.y) <= (bld.radius || 90) + 95) {
                this.damageBaseBuilding(bld, 75, 'allies');
              }
            }
          }
          this.playSoundAt('explosion', ac.targetX, ac.targetY, 1.0);
          this.camera.shake(14, 0.35);
        } else if (ac.type === 'precision_bomb') {
          // Bomba guiada de alta penetração (destrói trincheiras, bunkers, tanques e prédios de base)
          const bx = ac.targetX;
          const by = ac.targetY;
          this.spawnExplosionParticles(bx, by, 42);
          this.playSoundAt('explosion', bx, by, 1.0);
          this.camera.shake(22, 0.48);
          for (const u of this.units) {
            if (!u.alive || u.captured || u.team === 'allies') continue;
            const d = dist(bx, by, u.x, u.y);
            if (d <= 220) {
              u.takeDamage(340 * (1 - d / 260), 'allies', this, true);
            }
          }
          for (const bld of this.baseBuildings) {
            if (bld.alive === false || bld.team === 'allies') continue;
            const d = dist(bx, by, bld.x, bld.y);
            if (d <= (bld.radius || 90) + 190) {
              this.damageBaseBuilding(bld, 480, 'allies');
            }
          }
          // Destrói trincheiras e minas inimigas no raio da bomba
          this.trenches = this.trenches.filter(
            (tr) => tr.team === 'allies' || dist(tr.getCenter().x, tr.getCenter().y, bx, by) > 190
          );
          for (const m of this.mines) {
            if (dist(m.x, m.y, bx, by) <= 210) m.active = false;
          }
        }
      }
    }

    this.aircrafts = this.aircrafts.filter((a) => a.life > 0);
  }

  // Fumaça escura subindo continuamente dos caminhões militares queimados e tanques destruídos
  _updateWreckSmoke(dt) {
    this.wreckSmokeTimer -= dt;
    if (this.wreckSmokeTimer > 0) return;
    this.wreckSmokeTimer = 0.22;

    for (const wrk of this.map.wrecks) {
      if (!wrk.smoke) continue;
      const life = 1.4 + Math.random() * 0.9;
      this.particles.push({
        x: wrk.x + (Math.random() - 0.5) * 14,
        y: wrk.y + (Math.random() - 0.5) * 14,
        z: 10 + Math.random() * 8,
        vx: 8 + Math.random() * 10,
        vy: -6 + (Math.random() - 0.5) * 6,
        vz: 14 + Math.random() * 10,
        radius: 4.5 + Math.random() * 4,
        color: Math.random() < 0.25 ? '#3a3530' : '#242220',
        life,
        maxLife: life,
      });
    }

    // Coluna fina de fumaça preta subindo continuamente das ruínas bombardeadas
    for (const st of this.map.structures) {
      if (st.type !== 'ruin' || Math.random() > 0.45) continue;
      const life = 1.8 + Math.random() * 1.1;
      this.particles.push({
        x: st.x + (Math.random() - 0.5) * 22,
        y: st.y + (Math.random() - 0.5) * 22,
        z: 14 + Math.random() * 8,
        vx: 6 + Math.random() * 8,
        vy: -4 + (Math.random() - 0.5) * 6,
        vz: 18 + Math.random() * 10,
        radius: 5.5 + Math.random() * 4.5,
        color: Math.random() < 0.3 ? '#3b3733' : '#1f1d1b',
        life,
        maxLife: life,
      });
    }
  }

  _updateEconomyAndSectors(dt) {
    // Captura dos 8 Pontos Estratégicos de Suprimento, Munição e Combustível
    for (const sec of this.map.sectors) {
      let allyPower = 0;
      let enemyPower = 0;
      for (const u of this.units) {
        if (!u.alive || u.surrendered || u.captured) continue;
        if (dist(u.x, u.y, sec.x, sec.y) <= sec.radius + 30) {
          if (u.team === 'allies') allyPower += u.spec.captureRate || 0.45;
          else if (u.team === 'enemies') enemyPower += u.spec.captureRate || 0.45;
        }
      }

      if (allyPower > enemyPower) {
        const prevOwner = sec.owner;
        sec.captureProgress = Math.min(100, sec.captureProgress + (allyPower - enemyPower) * 7.5 * dt);
        if (sec.captureProgress >= 75 && prevOwner !== 'allies') {
          sec.owner = 'allies';
          this.victoryPoints += 40;
          this.addCommandPoints(15, 'Setor Capturado');
          this.audio.play('pickup');
          this.notify(
            `PONTO DE SUPRIMENTO CONQUISTADO!`,
            `${sec.name} gerando +${sec.supplyBonus} SUP, +${sec.ammoBonus || 0} MUN, +${sec.fuelBonus || 0} COMB.`,
            '#7faed9'
          );
        }
      } else if (enemyPower > allyPower) {
        const prevOwner = sec.owner;
        sec.captureProgress = Math.max(-100, sec.captureProgress - (enemyPower - allyPower) * 7.5 * dt);
        if (sec.captureProgress <= -75 && prevOwner !== 'enemies') {
          sec.owner = 'enemies';
          this.notify('ALERTA DE SETOR!', `O inimigo tomou ${sec.name}!`, '#c94a38');
        }
      }
    }

    // Geração periódica de Suprimentos, Munição e Combustível
    this.supplyIncomeTimer -= dt;
    if (this.supplyIncomeTimer <= 0) {
      this.supplyIncomeTimer = 6.0;
      let allySup = 24;
      let allyAmmo = 8;
      let allyFuel = 6;
      let enemySup = 24;

      for (const sec of this.map.sectors) {
        if (sec.owner === 'allies') {
          allySup += sec.supplyBonus || sec.incomeBonus || 12;
          allyAmmo += sec.ammoBonus || 0;
          allyFuel += sec.fuelBonus || 0;
        } else if (sec.owner === 'enemies') {
          enemySup += sec.supplyBonus || sec.incomeBonus || 12;
        }
      }
      for (const u of this.units) {
        if (u.alive && u.spec.supplyBonus) {
          if (u.team === 'allies') allySup += u.spec.supplyBonus;
          else enemySup += u.spec.supplyBonus;
        }
      }
      this.supplies += allySup;
      this.ammo += allyAmmo;
      this.fuel += allyFuel;
      this.allyAiSupplies += allySup;
      const enemyIncomeMult = this.enemyProductionDebuffTimer > 0 ? 0.7 : 1.0;
      this.enemySupplies.enemy_1 += Math.round(enemySup * enemyIncomeMult);
      this.enemySupplies.enemy_2 += Math.round(enemySup * enemyIncomeMult);
    }
  }

  // ============================================================================
  // MODO ESPECTADOR (IA vs IA) & DIRECTOR CAM CINEMATOGRÁFICA
  // ============================================================================
  enableSpectatorMode() {
    if (!this.isAdminUser()) {
      this.notify('ACESSO RESTRITO', 'O Modo Espectador (IA vs IA) é exclusivo para Administradores.', '#ef4444');
      return false;
    }
    this.spectatorMode = true;
    this.directorCamActive = true;
    this.spectatorHudHidden = false;
    this.intelRevealed = true;
    this.sandboxFogDisabled = true;
    this.timeScale = 1.0;
    this.supplies = Math.max(this.supplies, 1800);
    this.ammo = Math.max(this.ammo, 600);
    this.fuel = Math.max(this.fuel, 500);
    this.allyAiSupplies = 1800;
    this.enemySupplies = { enemy_1: 1800, enemy_2: 1800 };
    this._directorSwitchTimer = 0;
    this.forceSpectatorArmorWave(true);
    this.notify(
      'MODO ESPECTADOR ATIVO (IA vs IA)',
      'Sem Névoa de Guerra. Use [H] para ocultar a HUD e gravar vídeos limpos!',
      '#c28e38'
    );
    this._emitHud();
  }

  toggleSpectatorHud() {
    this.spectatorHudHidden = !this.spectatorHudHidden;
    this._emitHud();
  }

  runDirectorScene(sceneId) {
    return runDirectorScene(this, sceneId);
  }

  repeatDirectorScene() {
    return this.runDirectorScene(this.activeDirectorSceneId || 'trenches');
  }

  setTimeOfDay(mood = 'day', quiet = false) {
    if (!this.isAdminUser()) return false;
    this.timeOfDay = mood === 'night' || mood === 'sunset' ? mood : 'day';
    this.renderer?.setLightingMood?.(this.timeOfDay);
    if (!quiet) {
      this.audio?.play?.('switch');
      this._emitHud();
    }
    return true;
  }

  toggleCinematicLowCam() {
    if (!this.isAdminUser()) return false;
    this.cinematicLowCam = !this.cinematicLowCam;
    if (this.cinematicLowCam) {
      this.camera.zoom = Math.min(this.camera.zoom, 300);
    } else {
      this.camera.zoom = 860;
    }
    this.audio?.play?.('switch');
    this._emitHud();
    return this.cinematicLowCam;
  }

  toggleDirectorCam() {
    this.directorCamActive = !this.directorCamActive;
    this.notify(
      this.directorCamActive ? 'DIRECTOR CAM ATIVADA' : 'CÂMERA LIVRE (WASD)',
      this.directorCamActive
        ? 'A câmera acompanha automaticamente os maiores combates.'
        : 'Controle a câmera manualmente com WASD / Setas.',
      '#38bdf8'
    );
    this._emitHud();
  }

  forceSpectatorArmorWave(quiet = false) {
    if (!this.map) return;
    const allyHq = this.map.hqs.player || { x: 1150, y: 4800 };
    const enemyHq = this.map.hqs.enemy_1 || { x: 8450, y: 4800 };
    const centerSec =
      this.map.sectors.find((s) => s.id === 'sec_center_cross') ||
      this.map.sectors[Math.floor(this.map.sectors.length / 2)] || { x: 4800, y: 4800 };

    const spawnBatch = [
      { fac: 'player', type: 'mbt_tank', x: allyHq.x + 260, y: allyHq.y - 120, ang: 0 },
      { fac: 'player', type: 'mbt_tank', x: allyHq.x + 260, y: allyHq.y + 120, ang: 0 },
      { fac: 'player', type: 'apc_stryker', x: allyHq.x + 190, y: allyHq.y - 40, ang: 0 },
      { fac: 'player', type: 'assault_squad', x: allyHq.x + 220, y: allyHq.y + 50, ang: 0 },
      { fac: 'enemy_1', type: 'mbt_tank', x: enemyHq.x - 260, y: enemyHq.y - 120, ang: Math.PI },
      { fac: 'enemy_1', type: 'mbt_tank', x: enemyHq.x - 260, y: enemyHq.y + 120, ang: Math.PI },
      { fac: 'enemy_1', type: 'apc_stryker', x: enemyHq.x - 190, y: enemyHq.y + 40, ang: Math.PI },
      { fac: 'enemy_1', type: 'assault_squad', x: enemyHq.x - 220, y: enemyHq.y - 50, ang: Math.PI },
    ];
    for (const sp of spawnBatch) {
      const u = this.spawnUnit(sp.fac, sp.type, sp.x, sp.y, sp.ang);
      if (u) {
        u.setMoveOrder(
          centerSec.x + randInt(-240, 240),
          centerSec.y + randInt(-240, 240)
        );
      }
    }
    this._directorTarget = { x: centerSec.x, y: centerSec.y };
    if (!quiet) {
      this.audio?.play?.('radio');
      this.notify(
        'ONDA DE BLINDADOS LANÇADA!',
        'Tanques MBT e APCs avançando para o centro do campo de batalha!',
        '#f59e0b'
      );
      this._emitHud();
    }
  }

  _updateDirectorCamera(realDt) {
    this._directorSwitchTimer = (this._directorSwitchTimer || 0) - realDt;
    if (this._directorSwitchTimer <= 0) {
      this._directorSwitchTimer = 3.2;
      let bestScore = -1;
      let bestX = 4800;
      let bestY = 4800;
      const allies = this.units.filter((u) => u.alive && u.team === 'allies' && !u.captured);
      const enemies = this.units.filter((u) => u.alive && u.team === 'enemies' && !u.captured);

      for (const a of allies) {
        let localEnemies = 0;
        let closestD = Infinity;
        for (const e of enemies) {
          const d = dist(a.x, a.y, e.x, e.y);
          if (d < closestD) closestD = d;
          if (d < 680) localEnemies++;
        }
        const firingBonus = (a.muzzleFlashTimer || 0) > 0 ? 4 : 0;
        const tankBonus = a.spec?.type === 'vehicle' ? 2.5 : 1;
        const proxScore = closestD < 1200 ? (1200 - closestD) / 180 : 0;
        const score = localEnemies * 3 + firingBonus + tankBonus + proxScore;
        if (score > bestScore) {
          bestScore = score;
          bestX = a.x;
          bestY = a.y;
        }
      }
      if (bestScore > 0) {
        this._directorTarget = {
          x: clamp(bestX, 600, BATTLEFIELD_SIZE - 600),
          y: clamp(bestY, 600, BATTLEFIELD_SIZE - 600),
        };
      }
    }
    const lerp = Math.min(1, realDt * 1.35);
    this.camera.x += (this._directorTarget.x - this.camera.x) * lerp;
    this.camera.y += (this._directorTarget.y - this.camera.y) * lerp;
    const targetZoom = this.menuActive ? 680 : 620;
    this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, realDt * 0.8);
  }

  // IA Inimiga e Aliada com 3 Níveis de Dificuldade (Fácil/Recruta, Médio/Veterano, Difícil/General)
  _updateAICommanders(dt) {
    if (this.sandboxAiPaused) return;
    if (this.isMultiplayer && (this.localSlot !== 1 || !this.onlineBotFactions?.size)) return;
    this.aiWaveTimer -= dt;
    this.aiTacticalOrderTimer -= dt;

    const diff = this.spectatorMode ? 'hard' : this.aiDifficulty || 'medium';
    const fullAiAllies = Boolean(this.spectatorMode || this.menuActive);
    const activeFactions = this.isMultiplayer
      ? Array.from(this.onlineBotFactions)
      : this.gameMode === '2v2'
        ? fullAiAllies
          ? ['player', 'ally_ai', 'enemy_1', 'enemy_2']
          : ['ally_ai', 'enemy_1', 'enemy_2']
        : fullAiAllies
          ? ['player', 'enemy_1']
          : ['enemy_1'];

    if (this.aiWaveTimer <= 0) {
      const baseWave = diff === 'easy' ? 48 : diff === 'hard' ? 28 : 38;
      const debuffMult = this.enemyProductionDebuffTimer > 0 ? 1.3 : 1.0;
      this.aiWaveTimer = (baseWave + Math.random() * 6) * debuffMult;

      for (const fac of activeFactions) {
        const hq = this.map.hqs[fac];
        const hqBld = this.baseBuildings.find(
          (b) => b.faction === fac && b.isMainHQ && b.alive !== false
        );
        if (!hq || !hqBld) continue;

        const myUnits = this.units.filter((u) => u.alive && !u.surrendered && u.faction === fac);
        let bank =
          fac === 'player'
            ? this.supplies
            : fac === 'ally_ai'
              ? this.allyAiSupplies
              : this.enemySupplies[fac];
        let aiLvl = fac === 'player' ? this.hqLevel || 1 : this.aiHqLevels[fac] || 1;

        // Evolução automática do QG da IA conforme dificuldade
        if (diff === 'medium' && aiLvl < 2 && bank >= 650 && this.matchStats.elapsedSeconds > 110) {
          bank -= 650;
          aiLvl = 2;
          if (fac === 'player') this.hqLevel = 2;
          else this.aiHqLevels[fac] = 2;
          hqBld.level = 2;
        } else if (diff === 'hard') {
          if (aiLvl < 2 && bank >= 550 && this.matchStats.elapsedSeconds > 75) {
            bank -= 550;
            aiLvl = 2;
            if (fac === 'player') this.hqLevel = 2;
            else this.aiHqLevels[fac] = 2;
            hqBld.level = 2;
          } else if (aiLvl < 3 && bank >= 1200 && this.matchStats.elapsedSeconds > 190) {
            bank -= 1200;
            aiLvl = 3;
            if (fac === 'player') this.hqLevel = 3;
            else this.aiHqLevels[fac] = 3;
            hqBld.level = 3;
          }
        }

        const unitCap = diff === 'easy' ? 5 : diff === 'hard' ? 9 : 7;
        if (myUnits.length < unitCap && bank >= 180) {
          let pool = ['rifle_squad', 'assault_squad'];
          if (diff !== 'easy' && aiLvl >= 2) {
            pool.push('humvee', 'sniper_squad', 'at_javelin_squad');
            if (bank >= 650) pool.push('apc_stryker');
          }
          if (diff === 'hard' && aiLvl >= 3 && bank >= 1000) {
            pool.push('mbt_tank', 'rocket_artillery');
          }
          const pick = pool[randInt(0, pool.length - 1)];
          const cost = COMMAND_BY_ID[pick]?.cost || 180;
          if (bank >= cost) {
            bank -= cost;
            if (fac === 'player') this.supplies = bank;
            else if (fac === 'ally_ai') this.allyAiSupplies = bank;
            else this.enemySupplies[fac] = bank;

            const dir = hq.team === 'allies' ? 0 : Math.PI;
            const spawnOffset = hq.team === 'allies' ? 140 : -140;
            const u = this.spawnUnit(
              fac,
              pick,
              hq.x + spawnOffset + randInt(-45, 45),
              hq.y + randInt(-110, 110),
              dir
            );
            const targetSec =
              diff === 'easy'
                ? this.map.sectors[Math.floor(this.map.sectors.length / 2)] || this.map.sectors[0]
                : this.map.sectors[randInt(0, this.map.sectors.length - 1)];
            const flankY = diff === 'hard' && Math.random() < 0.45 ? randInt(-360, 360) : randInt(-140, 140);
            u.setMoveOrder(targetSec.x + randInt(-140, 140), targetSec.y + flankY);
          }
        }

        // Médio/Difícil: planta minas ocasionais perto de setores controlados
        if (diff !== 'easy' && this.mines.length < 48 && Math.random() < (diff === 'hard' ? 0.5 : 0.25)) {
          const owned = this.map.sectors.find((s) => s.owner === hq.team);
          if (owned) {
            this.mines.push(new Landmine(owned.x + randInt(-180, 180), owned.y + randInt(-180, 180), hq.team));
          }
        }

        // Difícil: lança Drone UAV inimigo se QG Nv. 3 após partida avançada
        if (diff === 'hard' && aiLvl >= 3 && Math.random() < 0.3 && this.activeDrones.length < 4) {
          this.activeDrones.push({
            id: `drn_ai_${Date.now()}_${Math.floor(Math.random() * 999)}`,
            type: 'uav_recon',
            x: hq.x,
            y: hq.y,
            z: 115,
            targetX: 2400 + randInt(-600, 1400),
            targetY: 4800 + randInt(-1800, 1800),
            angle: Math.PI,
            speed: 250,
            life: 25,
            orbitPhase: 0,
            alive: true,
          });
        }
      }
    }

    if (this.aiTacticalOrderTimer <= 0) {
      this.aiTacticalOrderTimer = diff === 'hard' ? 4.5 : 6.0;
      for (const fac of activeFactions) {
        const myUnits = this.units.filter((u) => u.alive && !u.surrendered && u.faction === fac);
        for (const u of myUnits) {
          if (u.spec.speed <= 0 || u.inTrench || u.garrisonedBuildingId || u.holdPosition) continue;
          if (u.order.type === 'hold') {
            if (diff === 'easy') {
              // Recruta: avança em linha reta sem usar cobertura
              const targetSec = this.map.sectors[randInt(0, this.map.sectors.length - 1)];
              u.setMoveOrder(targetSec.x + randInt(-100, 100), targetSec.y + randInt(-100, 100));
              continue;
            }
            // Difícil: ocupa casas nos vilarejos se estiverem livres
            if (diff === 'hard' && u.spec.type === 'infantry' && Math.random() < 0.35) {
              const freeBld = this.map.structures.find(
                (st) => st.garrisonable && !st.garrisonUnitId && dist(u.x, u.y, st.x, st.y) < 620
              );
              if (freeBld) {
                u.setGarrisonOrder(freeBld);
                continue;
              }
            }
            const freeTrench = this.trenches.find(
              (tr) =>
                tr.team === u.team &&
                dist(u.x, u.y, tr.getCenter().x, tr.getCenter().y) < 420 &&
                !this.units.some((other) => other.alive && other.inTrenchId === tr.id)
            );
            if (freeTrench && u.spec.type === 'infantry' && Math.random() < 0.45) {
              const c = freeTrench.getCenter();
              u.setMoveOrder(c.x, c.y, freeTrench.id);
            } else {
              const targetSec =
                this.map.sectors.find((s) => s.owner !== u.team) ||
                this.map.sectors[randInt(0, this.map.sectors.length - 1)];
              u.setMoveOrder(targetSec.x + randInt(-140, 140), targetSec.y + randInt(-140, 140));
            }
          }
        }
      }
    }
  }

  _updateUnitsAndCombat(dt) {
    this._frameSolidBoxes = this.getSolidBuildingBoxes();
    // Animação automática dos Portões Blindados nas muralhas quando aliados se aproximam
    for (const w of this.fortifiedWalls || []) {
      if (!w.isGate || (w.hp ?? 2500) <= 0) continue;
      const c = w.getCenter();
      const nearAlly = this.units.some(
        (u) =>
          u.alive &&
          u.team === w.team &&
          !u.embarkedInId &&
          (dist(u.x, u.y, c.x, c.y) <= 150 ||
            (Array.isArray(u.waypoints) &&
              u.waypoints.some((wp) => wp && dist(wp.x, wp.y, c.x, c.y) <= 60)))
      );
      w.gateOpen = nearAlly;
      const targetProg = nearAlly ? 1 : 0;
      w.gateOpenProgress = (w.gateOpenProgress || 0) + (targetProg - (w.gateOpenProgress || 0)) * Math.min(1, dt * 4.5);
    }
    if (this.paradropCooldown > 0) this.paradropCooldown = Math.max(0, this.paradropCooldown - dt);
    this.vehicleExhaustTimer -= dt;
    const emitVehicleExhaust = this.vehicleExhaustTimer <= 0;
    if (emitVehicleExhaust) this.vehicleExhaustTimer = 0.14;

    for (const u of this.units) {
      if (!u.alive || u.captured) continue;
      try {
        u.sanitizePosition?.();
        u._clampFormationSlot = (tx, ty) => {
          if (u.garrisonedBuildingId || u.embarkedInId || !this.map?.pushPointOutsideAllBoxes) {
            return { x: tx, y: ty };
          }
          const pt = { x: tx, z: ty };
          this.map.pushPointOutsideAllBoxes(pt, u, this._frameSolidBoxes, 12);
          return { x: pt.x, y: pt.z };
        };

      if (u.muzzleFlashTimer > 0) u.muzzleFlashTimer -= dt;
      if (u.recoilTimer > 0) u.recoilTimer = Math.max(0, u.recoilTimer - dt);
      if (u.rampOpenTimer > 0) u.rampOpenTimer = Math.max(0, u.rampOpenTimer - dt);
      if (u.fireCooldown > 0) u.fireCooldown -= dt;
      if (u.reloadTimer > 0) u.reloadTimer -= dt;
      if (u.grenadeCooldown > 0) u.grenadeCooldown -= dt;
      if (u.grenadeAbilityCooldown > 0) u.grenadeAbilityCooldown = Math.max(0, u.grenadeAbilityCooldown - dt);
      if (u.suppressionCooldown > 0) u.suppressionCooldown = Math.max(0, u.suppressionCooldown - dt);
      if (u.medkitCooldown > 0) u.medkitCooldown = Math.max(0, u.medkitCooldown - dt);
      if (u.suppressedTimer > 0) u.suppressedTimer = Math.max(0, u.suppressedTimer - dt);
      if (u.ambushRevealTimer > 0) u.ambushRevealTimer = Math.max(0, u.ambushRevealTimer - dt);
      const forestZone = this.map.getForestZoneAt?.(u.x, u.y) || null;
      if (u.spec.type === 'infantry' && !u.garrisonedBuildingId) {
        u.inForestStealth = Boolean(forestZone);
        u.camouflagedInForest = Boolean(forestZone && (u.ambushRevealTimer || 0) <= 0);
      } else {
        u.inForestStealth = false;
        u.camouflagedInForest = false;
      }
      if (u.suppressionActiveTimer > 0) {
        u.suppressionActiveTimer = Math.max(0, u.suppressionActiveTimer - dt);
        if (u.suppressionActiveTimer <= 0) u.suppressionMode = false;
      }
      if (u.medkitHealTimer > 0) {
        u.medkitHealTimer = Math.max(0, u.medkitHealTimer - dt);
        if (u.spec.type === 'infantry' && u.soldiers) {
          for (const s of u.soldiers) {
            if (s.alive && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + 9 * dt);
          }
          u.syncSquadHealthFromSoldiers?.();
        }
        if (Math.random() < dt * 2.5) {
          this.spawnText(u.x + (Math.random() - 0.5) * 20, u.y - 12, '✚', '#4ade80');
        }
      }

      // Se o esquadrão estiver embarcado dentro de um Veículo de Transporte, acompanha o veículo e desativa colisão física
      if (u.embarkedInId) {
        const carrier = this.units.find((c) => c.id === u.embarkedInId && c.alive);
        if (carrier) {
          u.x = carrier.x;
          u.y = carrier.y;
          u.vx = 0;
          u.vy = 0;
          u.angle = carrier.angle;
          if (u.soldiers) {
            for (const s of u.soldiers) {
              s.worldX = -9999;
              s.worldY = -9999;
            }
          }
          continue;
        } else {
          u.embarkedInId = null;
        }
      }

      // Interpolação suave de rede para unidades sincronizadas em clientes remotos
      if (this.isMultiplayer && this.localSlot !== 1 && u.networkTargetPos && !u.selected) {
        const lerpAlpha = Math.min(1, dt * 12);
        const netPrevX = u.x;
        const netPrevY = u.y;
        u.x = netPrevX + (u.networkTargetPos.x - netPrevX) * lerpAlpha;
        u.y = netPrevY + (u.networkTargetPos.z - netPrevY) * lerpAlpha;
        const netMoveDist = Math.hypot(u.x - netPrevX, u.y - netPrevY);
        if (netMoveDist > 0.05) {
          u.walkPhase += dt * 7.8;
          if (typeof u.networkTargetPos.rotY === 'number') {
            let dAng = u.networkTargetPos.rotY - u.angle;
            while (dAng > Math.PI) dAng -= Math.PI * 2;
            while (dAng < -Math.PI) dAng += Math.PI * 2;
            u.angle += dAng * Math.min(1, dt * 10);
          }
          u.vx = (u.x - netPrevX) / Math.max(dt, 0.001);
          u.vy = (u.y - netPrevY) / Math.max(dt, 0.001);
          if (u.spec.type === 'infantry') u.stepAutonomousSoldiers?.(dt);
        } else {
          u.vx = 0;
          u.vy = 0;
        }
      }

      // 1. Atualiza status de Trincheira e Cobertura Direcional (Escudo Verde = Pesada +75% / Escudo Amarelo = Leve)
      let insideTrench = null;
      for (const tr of this.trenches) {
        if (tr.containsPoint(u.x, u.y, 14)) {
          insideTrench = tr;
          break;
        }
      }
      const wasInTrench = Boolean(u.inTrench);
      u.inTrench = Boolean(insideTrench && u.spec.type === 'infantry' && !u.garrisonedBuildingId);
      u.inTrenchId = u.inTrench ? insideTrench.id : null;
      if (u.inTrench) {
        // Imunidade total a supressão dentro da trincheira +70% Defesa
        u.suppressedTimer = 0;
        u.pinned = false;
        if (!wasInTrench && u.team === 'allies') {
          this.spawnText(u.x, u.y - 18, '🛡️ COBERTURA DE TRINCHEIRA (+70% DEF)', '#4ade80');
        }
      }
      u.inTreelineCover =
        !u.inTrench && !u.garrisonedBuildingId && this.map.hasTreelineCover(u.x, u.y);

      if (!u.inTrench && !u.garrisonedBuildingId) {
        const cov = this.map.evaluateCoverAt(u.x, u.y, this.barricades, this.fortifiedWalls);
        const isSnapped =
          Boolean(u.coverSnap) && dist(u.x, u.y, u.coverSnap.cx, u.coverSnap.cy) <= 38;
        const inBush = u.spec.type === 'infantry' && this.map.hasBushCover(u.x, u.y);
        u.snappedToCover = isSnapped;
        u.inHeavyCover =
          cov.type === 'heavy' || (isSnapped && u.coverSnap.coverType === 'heavy');
        u.inLightCover =
          cov.type === 'light' || (isSnapped && u.coverSnap.coverType === 'light') || inBush;
        u.camouflagedInBush = inBush && Math.hypot(u.vx, u.vy) < 4;
        u.crouchedInCover =
          u.spec.type === 'infantry' && (u.inHeavyCover || u.inLightCover || isSnapped);
      } else {
        u.camouflagedInBush = false;
        u.snappedToCover = Boolean(u.inTrench && u.coverSnap);
        u.inHeavyCover = false;
        u.inLightCover = false;
        u.crouchedInCover = Boolean(u.inTrench && u.spec.type === 'infantry');
      }

      if (u.surrendered) {
        if (u.order?.type === 'escort_pow') {
          const dx = u.order.targetX - u.x;
          const dy = u.order.targetY - u.y;
          const dCamp = Math.hypot(dx, dy);
          if (dCamp <= 165) {
            this._openInterrogationFor(u);
            return;
          }
          const ang = Math.atan2(dy, dx);
          const step = 68 * dt;
          u.vx = Math.cos(ang) * 68;
          u.vy = Math.sin(ang) * 68;
          u.angle = ang;
          const res = this.map.resolveObstacleCollision(
            u.x + Math.cos(ang) * step,
            u.y + Math.sin(ang) * step,
            u.radius,
            null,
            this.fortifiedWalls
          );
          u.x = res.x;
          u.y = res.y;
        } else {
          u.vx = 0;
          u.vy = 0;
          if (u.spec.type === 'infantry') u.stepAutonomousSoldiers?.(dt);
        }
        continue;
      }

      if (u.team === 'allies') {
        const nearSurrendered = this._findUnitNearWorld(
          u.x,
          u.y,
          58,
          (other) => other.team === 'enemies' && other.surrendered && !other.captured
        );
        if (nearSurrendered && !this.paused) {
          this._openInterrogationFor(nearSurrendered);
          return;
        }
      }

      // Verifica embarque no Veículo de Transporte de Tropas (Raio 5.5m = 55u)
      if (u.transportGraceTimer > 0) {
        u.transportGraceTimer = Math.max(0, u.transportGraceTimer - dt);
      }
      if (u.order.type === 'board_transport' && u.order.targetTransportId) {
        const tr = this.units.find((c) => c.id === u.order.targetTransportId && c.alive && c.spec.isTransport);
        if (!tr || !tr.canBoardSquad(u, this.units)) {
          u.order.type = 'hold';
        } else {
          const rearX = tr.x - Math.cos(tr.angle) * 32;
          const rearY = tr.y - Math.sin(tr.angle) * 32;
          u.order.targetX = rearX;
          u.order.targetY = rearY;
          const centerDist = dist(u.x, u.y, tr.x, tr.y);
          const anySoldierClose =
            u.soldiers &&
            u.soldiers.some((s) => s.alive && dist(s.worldX, s.worldY, tr.x, tr.y) <= 58);

          if (centerDist <= 68 || anySoldierClose) {
            u.embarkedInId = tr.id;
            u.selected = false;
            u.vx = 0;
            u.vy = 0;
            u.waypoints = [];
            u.order.type = 'hold';
            tr.cargoSquadIds.push(u.id);
            tr.rampOpenTimer = 1.4;
            this.audio.play('embark');
            this.spawnText(tr.x, tr.y - 22, `🪖 +${u.soldiersAlive} EMBARCADO(S)`, '#4ade80');
            continue;
          } else if (centerDist > 110 && tr.order.type === 'hold') {
            // Se o caminhão estiver parado, aproxima-se suavemente do esquadrão para facilitar o embarque
            const approachAng = Math.atan2(u.y - tr.y, u.x - tr.x);
            const stepX = tr.x + Math.cos(approachAng) * tr.spec.speed * 0.45 * dt;
            const stepY = tr.y + Math.sin(approachAng) * tr.spec.speed * 0.45 * dt;
            const resTr = this.map.resolveObstacleCollision(stepX, stepY, tr.radius, null, this.fortifiedWalls);
            tr.x = resTr.x;
            tr.y = resTr.y;
          }
        }
      }

      // Verifica entrada ou invasão em Construção (Guarnição / Storm Building)
      if (
        (u.order.type === 'garrison_building' || u.order.type === 'storm_building') &&
        u.order.targetBuildingId
      ) {
        const bld = this.map.structures.find((s) => s.id === u.order.targetBuildingId);
        const enterDist = bld
          ? Math.max(88, Math.max(bld.w || 80, bld.d || 80) * 0.55 + 44)
          : 88;
        if (bld && !bld.destroyed && dist(u.x, u.y, bld.x, bld.y) <= enterDist) {
          if (bld.garrisonUnitId && bld.garrisonTeam !== u.team && u.unitType === 'assault_squad') {
            const enemyInside = this.units.find(
              (un) => un.id === bld.garrisonUnitId && un.alive
            );
            if (enemyInside) {
              this._ungarrisonUnit(enemyInside);
              const outAngle = Math.atan2(enemyInside.y - bld.y, enemyInside.x - bld.x) || 0;
              enemyInside.x = bld.x + Math.cos(outAngle) * (Math.max(bld.w || 70, bld.d || 70) * 0.72 + 28);
              enemyInside.y = bld.y + Math.sin(outAngle) * (Math.max(bld.w || 70, bld.d || 70) * 0.72 + 28);
              enemyInside.suppressedTimer = Math.max(enemyInside.suppressedTimer || 0, 4.5);
              enemyInside.takeDamage(95, u.team, this, true, true, bld.x, bld.y);
              this.spawnExplosionParticles?.(bld.x, bld.y, 18);
              this.playSoundAt?.('explosion', bld.x, bld.y, 0.75);
              this.spawnText(bld.x, bld.y - 26, '⚔️ INVADIDO! INIMIGO EXPULSO!', '#ef4444');
            } else {
              bld.garrisonUnitId = null;
              bld.garrisonTeam = null;
            }
          }

          if (!bld.garrisonUnitId || bld.garrisonUnitId === u.id) {
            bld.garrisonUnitId = u.id;
            bld.garrisonTeam = u.team;
            bld.garrisonedSquad = u;
            u.garrisonedBuildingId = bld.id;
            u.garrisonedBuilding = bld;
            u.x = bld.x;
            u.y = bld.y;
            u.vx = 0;
            u.vy = 0;
            u.order.type = 'hold';
            this.audio.play('door');
            this.spawnText(bld.x, bld.y - 18, '🏠 GUARNECIDO (+70% DEFESA)', '#d4a338');
          } else {
            u.order.type = 'hold';
          }
        }
      }

      // 2. Aquisição de Alvo (Unidades Inimigas ou Prédios de Base Inimiga)
      let targetEnemy = null;
      let targetEnemyBuilding = null;

      if (u.order.type === 'attack_building' && u.order.targetBuildingId) {
        const bld = this.baseBuildings.find(
          (b) => b.id === u.order.targetBuildingId && b.alive !== false && b.team !== u.team
        );
        if (bld) {
          targetEnemyBuilding = bld;
          if (!u.holdPosition) {
            u.order.targetX = bld.x;
            u.order.targetY = bld.y;
          }
        } else {
          u.order.type = 'hold';
        }
      } else if (u.order.type === 'attack_unit' && u.order.targetUnitId) {
        const explicit = this.units.find((e) => e.id === u.order.targetUnitId);
        const visibleOk =
          u.team !== 'allies' ||
          this.intelRevealed ||
          this.map.isPositionVisibleToAllies(explicit?.x || 0, explicit?.y || 0);
        if (explicit && explicit.alive && !explicit.captured && !explicit.surrendered && visibleOk) {
          targetEnemy = explicit;
          if (!u.holdPosition) {
            u.order.targetX = explicit.x;
            u.order.targetY = explicit.y;
          }
        } else {
          u.order.type = 'hold';
        }
      }

      const unitGroundH = getTerrainHeightAt(u.x, u.y, this.map);
      u.highGroundBonus = unitGroundH >= 25;
      const rangeMult = (u.garrisonedBuildingId ? 1.25 : 1.0) * (u.highGroundBonus ? 1.25 : 1.0);
      const effectiveRange = u.spec.range * rangeMult;
      u.aimSwitchCooldown = Math.max(0, (u.aimSwitchCooldown || 0) - dt);
      if (!targetEnemy && !targetEnemyBuilding) {
        if (u.lastTargetId && u.aimSwitchCooldown > 0) {
          const locked = this.units.find(
            (e) =>
              e.id === u.lastTargetId &&
              e.alive &&
              !e.captured &&
              !e.surrendered &&
              e.team !== u.team &&
              dist(u.x, u.y, e.x, e.y) <= effectiveRange
          );
          if (locked) targetEnemy = locked;
        }
        if (!targetEnemy) {
          targetEnemy = this._findUnitNearWorld(
            u.x,
            u.y,
            effectiveRange,
            (e) =>
              e.team !== u.team &&
              !e.surrendered &&
              (!e.camouflagedInForest || dist(u.x, u.y, e.x, e.y) <= 80) &&
              (!e.camouflagedInBush || dist(u.x, u.y, e.x, e.y) <= effectiveRange * 0.55) &&
              (u.team !== this.myTeam ||
                this.intelRevealed ||
                this.map.isPositionVisibleToAllies(e.x, e.y))
          );
          if (targetEnemy) {
            u.lastTargetId = targetEnemy.id;
            u.aimSwitchCooldown = 0.5;
          }
        }
      }

      if (!targetEnemy && !targetEnemyBuilding) {
        targetEnemyBuilding = this._findBaseBuildingNearWorld(
          u.x,
          u.y,
          effectiveRange + 60,
          (b) =>
            b.team !== u.team &&
            b.alive !== false &&
            (u.team !== 'allies' ||
              this.intelRevealed ||
              this.map.isPositionVisibleToAllies(b.x, b.y))
        );
      }

      const activeTarget = u.order.type === 'rtb' ? null : targetEnemy || targetEnemyBuilding;
      u.activeCombatTarget = activeTarget ? { x: activeTarget.x, y: activeTarget.y } : null;
      if (!activeTarget && u.spec.type === 'vehicle') {
        let tDiff = u.angle - u.turretAngle;
        while (tDiff > Math.PI) tDiff -= Math.PI * 2;
        while (tDiff < -Math.PI) tDiff += Math.PI * 2;
        u.turretAngle += tDiff * Math.min(1, dt * 4.5);
      }

      // 2b. Chegada de RTB / Recuo à Base e Reparo/Cura Automática (+15 HP/s veículos, +12 HP/s infantaria)
      if (u.order.type === 'rtb' && dist(u.x, u.y, u.order.targetX, u.order.targetY) <= 75) {
        u.order.type = 'hold';
        u.retreating = false;
        u.waypoints = [];
      }

      if (u.team === 'allies') {
        const nearRepairBase = this.baseBuildings.find(
          (b) =>
            b.team === 'allies' &&
            b.alive !== false &&
            (b.isMainHQ || b.buildingType === 'motor_pool') &&
            dist(u.x, u.y, b.x, b.y) <= 220
        );
        if (nearRepairBase) {
          if (u.spec.type === 'vehicle' && u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + 15 * dt);
            if (Math.random() < dt * 3.5 && this.renderer?.vfx) {
              const gy = getTerrainHeight(u.x, u.y, this.map);
              this.renderer.vfx.spawnImpact(u.x + (Math.random() - 0.5) * 18, gy + 10, u.y + (Math.random() - 0.5) * 18, true);
            }
          } else if (u.spec.type === 'infantry' && u.soldiers) {
            let healedAny = false;
            for (const s of u.soldiers) {
              if (s.alive && s.hp < s.maxHp) {
                s.hp = Math.min(s.maxHp, s.hp + 12 * dt);
                healedAny = true;
              }
            }
            if (healedAny) u.syncSquadHealthFromSoldiers?.();
          }
        }
      }

      // 2c. Pane Mecânica (<= 30% HP): fumaça preta + faíscas laranjas e bloqueio de movimento
      if (u.spec.type === 'vehicle' && u.isBrokenDown) {
        u.vx = 0;
        u.vy = 0;
        if (Math.random() < dt * 7) {
          this.particles.push({
            x: u.x + Math.cos(u.angle) * (u.radius * 0.4) + (Math.random() - 0.5) * 10,
            y: u.y + Math.sin(u.angle) * (u.radius * 0.4) + (Math.random() - 0.5) * 10,
            z: 10 + Math.random() * 4,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            vz: 14 + Math.random() * 10,
            radius: 4.5 + Math.random() * 3.5,
            color: Math.random() < 0.25 ? '#f97316' : '#1f211e',
            life: 0.75,
            maxLife: 0.75,
          });
        }
      }

      // 2d. Reparo em Campo pelos Engenheiros (Veículos, Prédios da Base e Muralhas Fortificadas)
      if (u.spec.type === 'infantry' && (u.spec.id === 'engineers' || u.spec.canBuild)) {
        const injuredVeh = this.units.find(
          (v) =>
            v.alive &&
            v.team === u.team &&
            v.spec.type === 'vehicle' &&
            v.hp > 0 &&
            v.hp < v.maxHp &&
            dist(u.x, u.y, v.x, v.y) <= 115
        );
        if (injuredVeh) {
          injuredVeh.beingRepaired = true;
          injuredVeh.hp = Math.min(injuredVeh.maxHp, injuredVeh.hp + 45 * dt);
          injuredVeh.repairProgress = injuredVeh.hp / Math.max(1, injuredVeh.maxHp);
          u.angle = Math.atan2(injuredVeh.y - u.y, injuredVeh.x - u.x);
          if (Math.random() < dt * 10) {
            this.particles.push({
              x: injuredVeh.x + (Math.random() - 0.5) * 18,
              y: injuredVeh.y + (Math.random() - 0.5) * 18,
              z: 10 + Math.random() * 6,
              vx: (Math.random() - 0.5) * 32,
              vy: (Math.random() - 0.5) * 32,
              vz: 18 + Math.random() * 14,
              radius: 2.2 + Math.random() * 1.4,
              color: Math.random() < 0.5 ? '#38bdf8' : '#e0f2fe',
              life: 0.28,
              maxLife: 0.28,
            });
          }
          if (injuredVeh.isBrokenDown && injuredVeh.hp > injuredVeh.maxHp * 0.5) {
            injuredVeh.isBrokenDown = false;
            this.spawnText(injuredVeh.x, injuredVeh.y - 24, '🔧 MOTOR CONSERTADO!', '#4ade80');
            this.audio.play('reload');
          }
        } else {
          const injuredBld = this.baseBuildings.find(
            (b) =>
              b.alive !== false &&
              b.team === u.team &&
              b.hp > 0 &&
              b.hp < b.maxHp &&
              dist(u.x, u.y, b.x, b.y) <= (b.radius || 90) + 75
          );
          if (injuredBld) {
            injuredBld.hp = Math.min(injuredBld.maxHp, injuredBld.hp + 50 * dt);
            u.angle = Math.atan2(injuredBld.y - u.y, injuredBld.x - u.x);
            if (Math.random() < dt * 8) {
              this.particles.push({
                x: injuredBld.x + (Math.random() - 0.5) * 28,
                y: injuredBld.y + (Math.random() - 0.5) * 28,
                z: 12 + Math.random() * 6,
                vx: (Math.random() - 0.5) * 32,
                vy: (Math.random() - 0.5) * 32,
                vz: 18 + Math.random() * 12,
                radius: 2.4,
                color: '#38bdf8',
                life: 0.28,
                maxLife: 0.28,
              });
            }
          } else {
            const injuredWall = (this.fortifiedWalls || []).find((w) => {
              if (w.team !== u.team) return false;
              const maxHp = w.maxHp || 2500;
              if ((w.hp ?? maxHp) <= 0 || (w.hp ?? maxHp) >= maxHp) return false;
              const wc = w.getCenter ? w.getCenter() : { x: (w.x1 + w.x2) * 0.5, y: (w.y1 + w.y2) * 0.5 };
              return dist(u.x, u.y, wc.x, wc.y) <= 105;
            });
            if (injuredWall) {
              const maxHp = injuredWall.maxHp || 2500;
              injuredWall.hp = Math.min(maxHp, (injuredWall.hp ?? maxHp) + 55 * dt);
            }
          }
        }
      }

      // 3. Movimento com Waypoints + Desvio Inteligente de Obstáculos (Steering & Avoidance Pathfinding)
      const wantsMove =
        !u.garrisonedBuildingId &&
        !u.holdPosition &&
        !u.isBrokenDown &&
        u.spec.speed > 0 &&
        (u.order.type === 'move' ||
          u.order.type === 'rtb' ||
          u.order.type === 'occupy_trench' ||
          u.order.type === 'garrison_building' ||
          u.order.type === 'board_transport' ||
          ((u.order.type === 'attack_unit' || u.order.type === 'attack_building') &&
            activeTarget &&
            dist(u.x, u.y, activeTarget.x, activeTarget.y) > effectiveRange * 0.84));

      if (wantsMove) {
      // Avança pelos waypoints intermediários (raio amplo nos waypoints de curva para virar suave antes de quinas)
        while (
          u.waypoints &&
          u.waypoints.length > 0 &&
          dist(u.x, u.y, u.waypoints[0].x, u.waypoints[0].y) < (u.waypoints.length > 1 ? 26 : 18)
        ) {
          u.waypoints.shift();
        }
        const finalDest = u.finalDestination || { x: u.order.targetX, y: u.order.targetY };
        const hasWaypoints = Boolean(u.waypoints && u.waypoints.length > 0);
        const activeDestX = hasWaypoints ? u.waypoints[0].x : finalDest.x;
        const activeDestY = hasWaypoints ? u.waypoints[0].y : finalDest.y;
        const dx = activeDestX - u.x;
        const dy = activeDestY - u.y;
        const d = Math.hypot(dx, dy);
        const dFinal = Math.hypot(finalDest.x - u.x, finalDest.y - u.y);
        if (hasWaypoints || dFinal > 12) {
          let spd = u.spec.speed;
          if (u.retreating) spd *= 1.35;
          if (u.tacticalOrderMode === 'MARCH') spd *= 1.18;
          if (u.suppressedTimer > 0) spd *= 0.4; // Suprimido: mantém no mínimo 40% da velocidade para recuar/mover
          if (u.spec.type === 'vehicle' && forestZone) spd *= 0.7; // Veículos pesados 30% mais lentos em floresta densa
          if (u.faction === this.myFaction) {
            if (u.spec.type === 'infantry' && this.completedTechs.has('forced_march')) spd *= 1.2;
            if (u.spec.type === 'vehicle' && this.completedTechs.has('turbo_diesel')) spd *= 1.25;
          }

          // Barricadas de Dentes de Dragão bloqueiam/reduzem velocidade de veículos
          if (
            u.spec.type === 'vehicle' &&
            this.barricades.some((b) => b.containsPoint(u.x, u.y, 26))
          ) {
            spd *= 0.22;
          }

          // Arame Farpado: Veículos esmagam; Infantaria inimiga reduz velocidade em 80% e sofre sangramento
          for (const wire of this.barbedWires) {
            if (!wire.active) continue;
            if (wire.containsPoint(u.x, u.y, u.radius + 4)) {
              if (u.spec.type === 'vehicle') {
                wire.active = false;
                this.spawnText(u.x, u.y, '⛓ ARAME FARPADO ESMAGADO!', '#9a9484');
              } else if (u.team !== wire.team) {
                spd *= 0.2; // Reduz velocidade em 80%
                u.takeDamage(4.5 * dt, wire.team, this, false);
              } else {
                spd *= 0.65;
              }
            }
          }

          const ignoreBldId =
            u.order.type === 'garrison_building' || u.order.type === 'storm_building'
              ? u.order.targetBuildingId
              : u.garrisonedBuildingId;

          const prevStepX = u.x;
          const prevStepY = u.y;

          // Calcula vetor de Steering e Desvio Suave (ou desvio tangencial anti-travamento)
          let steered;
          if ((u._tangentialDetourTimer || 0) > 0) {
            u._tangentialDetourTimer = Math.max(0, u._tangentialDetourTimer - dt);
            const tAng = Math.atan2(u._tangentialVy || 0, u._tangentialVx || 1);
            steered = {
              vx: (u._tangentialVx || 0) * spd,
              vy: (u._tangentialVy || 0) * spd,
              angle: tAng,
            };
          } else {
            steered = this.map.computeSteeringVelocity(
              u.x,
              u.y,
              activeDestX,
              activeDestY,
              spd,
              u.radius,
              ignoreBldId,
              this.fortifiedWalls
            );
          }

          u.vx = Number.isFinite(steered.vx) ? steered.vx : 0;
          u.vy = Number.isFinite(steered.vy) ? steered.vy : 0;

          const nextX = clamp(u.x + u.vx * dt, 70, BATTLEFIELD_SIZE - 70);
          const nextY = clamp(u.y + u.vy * dt, 70, BATTLEFIELD_SIZE - 70);

          // Montanhas Rochosas muito íngremes bloqueiam veículos pesados, mas permitem infantaria/snipers
          if (u.spec.type === 'vehicle' && getTerrainSlopeAt(nextX, nextY, this.map) > 0.68) {
            u.vx = 0;
            u.vy = 0;
            continue;
          }

          const resolved = this.map.resolveObstacleCollision(
            nextX,
            nextY,
            u.radius,
            ignoreBldId,
            this.fortifiedWalls
          );
          if (Number.isFinite(resolved.x)) u.x = clamp(resolved.x, 70, BATTLEFIELD_SIZE - 70);
          if (Number.isFinite(resolved.y)) u.y = clamp(resolved.y, 70, BATTLEFIELD_SIZE - 70);

          // Anti-Stuck & Slide Tangencial: se tentar andar por >0.6s com deslocamento real <0.15m (1.5u), aplica desvio perpendicular
          u._repathCooldown = Math.max(0, (u._repathCooldown || 0) - dt);
          u._stuckSampleTimer = (u._stuckSampleTimer || 0) + dt;
          if (u._stuckOriginX === undefined) {
            u._stuckOriginX = u.x;
            u._stuckOriginY = u.y;
          }
          if (u._stuckSampleTimer >= 0.6) {
            const realDisp = Math.hypot(u.x - u._stuckOriginX, u.y - u._stuckOriginY);
            if (realDisp < 1.5 && dFinal > 30) {
              const dirLen = Math.hypot(activeDestX - u.x, activeDestY - u.y) || 1;
              const nx = (activeDestX - u.x) / dirLen;
              const ny = (activeDestY - u.y) / dirLen;
              u._tangentialSign = (u._tangentialSign || (u.id % 2 === 0 ? 1 : -1)) * -1;
              const sgn = u._tangentialSign;
              const tx = -ny * sgn + nx * 0.22;
              const ty = nx * sgn + ny * 0.22;
              const tMag = Math.hypot(tx, ty) || 1;
              u._tangentialVx = tx / tMag;
              u._tangentialVy = ty / tMag;
              u._tangentialDetourTimer = 0.85;

              if (u._repathCooldown <= 0 && dFinal > 40) {
                u._repathCooldown = 1.6;
                const repath = this.map.computeObstacleDetourPath(
                  u.x,
                  u.y,
                  finalDest.x,
                  finalDest.y,
                  u.radius || 24,
                  this.fortifiedWalls,
                  this.barricades
                );
                if (Array.isArray(repath) && repath.length >= 2) {
                  u.waypoints = repath
                    .slice(1)
                    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
                    .map((p) => ({ x: p.x, y: p.y }));
                }
              }
            }
            u._stuckSampleTimer = 0;
            u._stuckOriginX = u.x;
            u._stuckOriginY = u.y;
          }

          // Giro suave para veículos e infantaria (evita trepidação dos soldados em formação ao desviar)
          let angDiff = steered.angle - u.angle;
          while (angDiff > Math.PI) angDiff -= Math.PI * 2;
          while (angDiff < -Math.PI) angDiff += Math.PI * 2;
          const turnRate = u.spec.type === 'vehicle' ? 5.2 : 8.5;
          u.angle += angDiff * Math.min(1, dt * turnRate);
          u.walkPhase += dt * 7.8;
          if (u.spec.type === 'infantry') u.stepAutonomousSoldiers?.(dt);

          // Fumaça de escapamento e poeira das rodas/esteiras para veículos em movimento
          if (emitVehicleExhaust && u.spec.type === 'vehicle') {
            const backX = u.x - Math.cos(u.angle) * (u.radius * 0.85);
            const backY = u.y - Math.sin(u.angle) * (u.radius * 0.85);
            this.particles.push({
              x: backX + (Math.random() - 0.5) * 6,
              y: backY + (Math.random() - 0.5) * 6,
              z: 6 + Math.random() * 4,
              vx: -Math.cos(u.angle) * 18 + (Math.random() - 0.5) * 8,
              vy: -Math.sin(u.angle) * 18 + (Math.random() - 0.5) * 8,
              vz: 10 + Math.random() * 6,
              radius: 2.8 + Math.random() * 2.2,
              color: '#47433e',
              life: 0.55,
              maxLife: 0.55,
            });
            this.particles.push({
              x: backX + (Math.random() - 0.5) * 20,
              y: backY + (Math.random() - 0.5) * 20,
              z: 2 + Math.random() * 3,
              vx: -Math.cos(u.angle) * 10 + (Math.random() - 0.5) * 10,
              vy: -Math.sin(u.angle) * 10 + (Math.random() - 0.5) * 10,
              vz: 4 + Math.random() * 4,
              radius: 4.5 + Math.random() * 3.0,
              color: '#8c7d65',
              life: 0.65,
              maxLife: 0.65,
            });
          }
        } else {
          u.vx = 0;
          u.vy = 0;
          u.wallStuckTimer = 0;
          if (u.spec.type === 'infantry') u.stepAutonomousSoldiers?.(dt);
          if (u.facingAngle !== null && u.facingAngle !== undefined) {
            u.angle = u.facingAngle;
          }
          if (u.order.type === 'move' || u.order.type === 'occupy_trench') {
            u.order.type = 'hold';
            if (u.tacticalOrderMode === 'DEFEND') {
              u.holdPosition = true;
              u.tacticalTargetLabel = 'Defendendo Posição';
              u.tacticalOrderMode = null;
            } else {
              u.tacticalOrderMode = null;
              u.tacticalTargetLabel = null;
            }
          }
        }
      } else {
        u.vx = 0;
        u.vy = 0;
      }

      // Separação esférica suave entre esquadrões (pula parados, passageiros embarcados e transporte alvo)
      const isMovingNow = Math.hypot(u.vx || 0, u.vy || 0) > 2;
      if (isMovingNow && u.spec.speed > 0 && !u.garrisonedBuildingId && !u.holdPosition && !u.embarkedInId) {
        for (const other of this.units) {
          if (other.id === u.id || !other.alive || other.captured || other.garrisonedBuildingId || other.embarkedInId) continue;
          if (u.order.type === 'board_transport' && u.order.targetTransportId === other.id) continue;
          if (other.order.type === 'board_transport' && other.order.targetTransportId === u.id) continue;
          if (u.transportGraceTimer > 0 && other.spec.isTransport) continue;
          if (other.transportGraceTimer > 0 && u.spec.isTransport) continue;

          const minSep = (u.radius + other.radius) * 0.78;
          const dx = u.x - other.x;
          const dy = u.y - other.y;
          const d = Math.hypot(dx, dy);
          if (d < 0.0001) continue;
          if (d < minSep) {
            const push = (minSep - d) * 0.35;
            u.x = clamp(u.x + (dx / d) * push, 70, BATTLEFIELD_SIZE - 70);
            u.y = clamp(u.y + (dy / d) * push, 70, BATTLEFIELD_SIZE - 70);
          }
        }
      }

      // Trava Física Final AABB no centro do esquadrão E em cada soldado individual (impede atravessar casas/muros)
      if (!u.garrisonedBuildingId && !u.embarkedInId && this.map?.pushPointOutsideAllBoxes) {
        const solidBoxes = this._frameSolidBoxes || (this._frameSolidBoxes = this.getSolidBuildingBoxes());
        const centerPos = { x: u.x, z: u.y };
        this.map.pushPointOutsideAllBoxes(
          centerPos,
          u,
          solidBoxes,
          u.spec.type === 'vehicle' ? (u.radius || 32) : 16
        );
        u.x = centerPos.x;
        u.y = centerPos.z;
        if (u.spec.type === 'infantry' && Array.isArray(u.soldiers)) {
          for (const s of u.soldiers) {
            if (!s.alive) continue;
            const sPos = { x: s.worldX, z: s.worldY };
            this.map.pushPointOutsideAllBoxes(sPos, u, solidBoxes, 6);
            s.worldX = sPos.x;
            s.worldY = sPos.z;
          }
        }
      }

      // 4. Combate Cadenciado com Rajadas e Pausas de Recarga (contra Tropas ou Prédios de Base Inimiga)
      const isApcOrArmedVehicle =
        u.spec.type === 'vehicle' &&
        (u.spec.weaponModel === 'autocannon' ||
          u.spec.weaponModel === 'tank_cannon' ||
          /apc|btr|stryker|humvee|tank|mbt|artillery|rocket/.test(u.spec.subType || u.unitType || ''));
      if (activeTarget && !(u.spec.type === 'vehicle' && u.isBrokenDown) && (u.spec.damage > 0 || isApcOrArmedVehicle)) {
        const targetRadius = targetEnemyBuilding ? targetEnemyBuilding.radius || 90 : 0;
        const dToTarget = dist(u.x, u.y, activeTarget.x, activeTarget.y);
        if (dToTarget <= effectiveRange + targetRadius) {
          const aimAngle = Math.atan2(activeTarget.y - u.y, activeTarget.x - u.x);
          u.turretAngle = aimAngle;
          u.aimAngle = aimAngle;
          if (Math.hypot(u.vx, u.vy) < 4) {
            let diff = aimAngle - u.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            u.angle += diff * Math.min(1, dt * 6);
          }

          // Bloqueio de Linha de Visão por Prédios/Casas (ignora o prédio do atirador e o prédio onde o alvo está guarnecido)
          const losBlocked =
            this.map.isLineBlockedByStructures?.(
              u.x,
              u.y,
              activeTarget.x,
              activeTarget.y,
              u.garrisonedBuildingId || null,
              targetEnemy?.garrisonedBuildingId || null
            ) || false;

          const isSabotagedTower =
            u.team === 'enemies' &&
            u.unitType === 'watchtower_emplacement' &&
            this.enemySabotageTimer > 0;

          // Metralhadora Coaxial Secundária 7.62mm do Tanque enquanto o canhão principal recarrega (2.6s)
          if ((u.cannonCooldown || 0) > 0) u.cannonCooldown = Math.max(0, u.cannonCooldown - dt);
          if ((u.coaxialCooldown || 0) > 0) u.coaxialCooldown = Math.max(0, u.coaxialCooldown - dt);
          if (
            !losBlocked &&
            u.spec.weaponModel === 'tank_cannon' &&
            (u.cannonCooldown || 0) > 0 &&
            (u.coaxialCooldown || 0) <= 0 &&
            targetEnemy &&
            targetEnemy.spec.type === 'infantry' &&
            dToTarget <= 392
          ) {
            u.coaxialCooldown = 0.25;
            u.muzzleFlashTimer = 0.06;
            const coaxAngle = aimAngle + (Math.random() - 0.5) * 0.09;
            const cx = u.x + Math.cos(coaxAngle) * 20;
            const cy = u.y + Math.sin(coaxAngle) * 20;
            if (this.renderer?.vfx) {
              const sy = getTerrainHeight(cx, cy, this.map) + 12;
              const ty = getTerrainHeight(targetEnemy.x, targetEnemy.y, this.map) + 8;
              this.renderer.vfx.spawnMuzzleFlash(cx, sy, cy, coaxAngle, false);
              this.renderer.vfx.spawnTracer(cx, sy, cy, targetEnemy.x, ty, targetEnemy.y, false);
            }
            this.bullets.push({
              x: cx,
              y: cy,
              prevX: cx,
              prevY: cy,
              startX: u.x,
              startY: u.y,
              vx: Math.cos(coaxAngle) * 680,
              vy: Math.sin(coaxAngle) * 680,
              angle: coaxAngle,
              team: u.team,
              damage: 10,
              explosive: false,
              life: 0.6,
            });
            this.playSoundAt('hmg', u.x, u.y, 0.35);
          }

          const isTankMainReady =
            u.spec.weaponModel === 'tank_cannon' ? (u.cannonCooldown || 0) <= 0 : true;

          if (
            !losBlocked &&
            !isSabotagedTower &&
            isTankMainReady &&
            u.reloadTimer <= 0 &&
            u.fireCooldown <= 0 &&
            u.spec.damage > 0
          ) {
            const isTankCannon = u.spec.weaponModel === 'tank_cannon';
            const autoloaderMult =
              u.faction === 'player' && u.spec.type === 'vehicle' && this.completedTechs.has('autoloader')
                ? 1.25
                : 1.0;
            const supRateMult = u.suppressionMode ? 2.0 : 1.0;
            const brokenFireMult = u.isBrokenDown ? 0.5 : 1.0;
            if (isTankCannon) {
              u.cannonCooldown = (2.6 / autoloaderMult) / brokenFireMult;
              u.fireCooldown = 0.35;
              u.muzzleFlashTimer = 0.16;
              u.recoilTimer = 0.38;
            } else {
              u.fireCooldown = 1 / (u.spec.fireRate * autoloaderMult * supRateMult * brokenFireMult);
              u.muzzleFlashTimer = 0.08;
              if (u.spec.type === 'vehicle') {
                u.recoilTimer = 0.12;
              }
            }
            u.burstRemaining -= 1;

            if (u.burstRemaining <= 0) {
              const reloadBase = u.spec.reloadPause || 2.0;
              u.reloadTimer =
                u.faction === 'player' && u.spec.type === 'vehicle' && this.completedTechs.has('autoloader')
                  ? reloadBase * 0.7
                  : reloadBase;
              u.burstRemaining = u.spec.burstShots || 4;
            }

            let spread = (Math.random() - 0.5) * (u.spec.spread || 0.06);
            if (u.stance === 'crouch') spread *= 0.85;
            if (u.suppressedTimer > 0) spread *= 1.6;
            const shotAngle = aimAngle + spread;
            const isAtRocket =
              u.spec.weaponModel === 'bazooka' || u.unitType === 'at_javelin_squad';
            const isExplosiveWeapon = Boolean(
              u.spec.explosiveShots ||
                isTankCannon ||
                isAtRocket ||
                u.spec.weaponModel === 'rocket_pod'
            );
            const bSpeed = isAtRocket
              ? 460
              : u.spec.weaponModel === 'rocket_pod'
              ? 520
              : 680;

            let dmg = u.spec.damage;
            if (u.inForestStealth) {
              if ((u.ambushRevealTimer || 0) <= 0) {
                dmg *= 1.35; // Bônus de Emboscada (+35% dano crítico)
                this.spawnText(u.x, u.y - 18, '🌲 EMBOSCADA! +35% DANO', '#4ade80');
              }
              u.ambushRevealTimer = 5.0;
              u.camouflagedInForest = false;
            }
            if (u.faction === 'player' && u.spec.type === 'infantry' && this.completedTechs.has('ap_ammo')) {
              dmg *= 1.2;
            }
            if (targetEnemy) {
              if (u.suppressionMode) {
                targetEnemy.suppressedTimer = Math.min(
                  5.0,
                  Math.max(targetEnemy.suppressedTimer || 0, 4.0)
                );
              }
              if (u.spec.closeRangeBonus && dToTarget <= 130) {
                dmg *= u.spec.closeRangeBonus;
              }
              if (u.spec.trenchBonusAttack && targetEnemy.inTrench) {
                dmg *= u.spec.trenchBonusAttack;
              }
              if (u.spec.antiArmorBonus && targetEnemy.spec.type === 'vehicle') {
                dmg *= u.spec.antiArmorBonus;
              }
            } else if (targetEnemyBuilding && u.spec.antiArmorBonus) {
              dmg *= 1.45;
            }

            // Granadas Automáticas do Esquadrão de Assalto contra inimigos em trincheiras, muros ou casas (até 15m)
            if (
              u.spec.autoGrenade &&
              targetEnemy &&
              u.grenadeCooldown <= 0 &&
              dToTarget <= 155 &&
              (targetEnemy.inTrench || targetEnemy.inHeavyCover || targetEnemy.garrisonedBuildingId)
            ) {
              u.grenadeCooldown = 8.5;
              const gx = targetEnemy.x;
              const gy = targetEnemy.y;
              if (this.renderer?.vfx) {
                const sy = getTerrainHeight(u.x, u.y, this.map) + 10;
                const ty = getTerrainHeight(gx, gy, this.map) + 4;
                this.renderer.vfx.spawnGrenadeArc(u.x, sy, u.y, gx, ty, gy, 0.55);
              }
              this.pendingGrenades.push({
                x: gx,
                y: gy,
                team: u.team,
                timer: 0.55,
              });
            }

            const startX = u.x + Math.cos(shotAngle) * 18;
            const startY = u.y + Math.sin(shotAngle) * 18;
            if (this.renderer?.vfx && activeTarget) {
              const isHeavyCannon =
                u.spec.weaponModel === 'tank_cannon' ||
                u.spec.weaponModel === 'rocket_pod' ||
                isAtRocket;
              const sy = getTerrainHeight(startX, startY, this.map) + (u.spec.type === 'vehicle' ? 14 : 9);
              const ty = getTerrainHeight(activeTarget.x, activeTarget.y, this.map) + 8;
              this.renderer.vfx.spawnMuzzleFlash(startX, sy, startY, shotAngle, isHeavyCannon);
              this.renderer.vfx.spawnTracer(startX, sy, startY, activeTarget.x, ty, activeTarget.y, isHeavyCannon);
            }
            if (isAtRocket) {
              // Sopro traseiro de fumaça da Bazuca / Javelin (Backblast)
              const backX = u.x - Math.cos(shotAngle) * 12;
              const backY = u.y - Math.sin(shotAngle) * 12;
              for (let bp = 0; bp < 4; bp++) {
                this.particles.push({
                  x: backX + (Math.random() - 0.5) * 8,
                  y: backY + (Math.random() - 0.5) * 8,
                  z: 8 + Math.random() * 4,
                  vx: -Math.cos(shotAngle) * (26 + Math.random() * 18) + (Math.random() - 0.5) * 12,
                  vy: -Math.sin(shotAngle) * (26 + Math.random() * 18) + (Math.random() - 0.5) * 12,
                  vz: 8 + Math.random() * 8,
                  radius: 3.4 + Math.random() * 2.2,
                  color: bp === 0 ? '#f97316' : '#cbd5e1',
                  life: 0.42,
                  maxLife: 0.42,
                });
              }
            }
            this.bullets.push({
              x: startX,
              y: startY,
              prevX: startX,
              prevY: startY,
              startX: u.x,
              startY: u.y,
              vx: Math.cos(shotAngle) * bSpeed,
              vy: Math.sin(shotAngle) * bSpeed,
              angle: shotAngle,
              team: u.team,
              damage: dmg,
              explosive: isExplosiveWeapon,
              isRocket: isAtRocket || u.spec.weaponModel === 'rocket_pod',
              isTankShell: isExplosiveWeapon,
              splashRadius: isExplosiveWeapon
                ? u.spec.explosiveSplash || (isAtRocket ? 42 : 45)
                : 0,
              life: (effectiveRange + targetRadius + 75) / bSpeed,
            });

            const snd =
              u.spec.weaponModel === 'tank_cannon' ||
              u.spec.weaponModel === 'rocket_pod' ||
              isAtRocket
                ? 'tank_cannon'
                : u.spec.weaponModel === 'autocannon'
                ? 'autocannon'
                : u.spec.weaponModel === 'hmg' || u.spec.weaponModel === 'at_mg'
                ? 'hmg'
                : u.spec.weaponModel === 'sniper'
                ? 'sniper'
                : u.spec.weaponModel === 'smg'
                ? 'smg'
                : 'rifle';
            this.playSoundAt(snd, u.x, u.y, 0.5);
          }

          // Granadas de assalto contra trincheiras/guarnições/bases inimigas
          if (targetEnemy && u.spec.grenadeChance && u.grenadeCooldown <= 0 && dToTarget < 195) {
            u.grenadeCooldown = 10.5;
            this.spawnExplosionParticles(targetEnemy.x, targetEnemy.y, 16);
            this.playSoundAt('explosion', targetEnemy.x, targetEnemy.y, 0.65);
            targetEnemy.takeDamage(32, u.team, this, true, true, targetEnemy.x, targetEnemy.y);
            this.spawnText(targetEnemy.x, targetEnemy.y - 12, '💥 GRANADA DE ASSALTO', '#d97706');
          }
        }
      }

      if (typeof u.updateSoldierWorldPositions === 'function') {
        u.updateSoldierWorldPositions();
      }
      // Garante que nem o alvo pessoal da formação nem a posição final de cada soldado fiquem dentro de construções
      if (!u.garrisonedBuildingId && !u.embarkedInId && this.map?.pushPointOutsideAllBoxes) {
        const solidBoxes = this._frameSolidBoxes || (this._frameSolidBoxes = this.getSolidBuildingBoxes());
        if (u.spec.type === 'infantry' && Array.isArray(u.soldiers)) {
          for (const s of u.soldiers) {
            if (!s.alive) continue;
            if (s.personalTarget) {
              const tPos = { x: s.personalTarget.x, z: s.personalTarget.y };
              this.map.pushPointOutsideAllBoxes(tPos, u, solidBoxes, 10);
              s.personalTarget.x = tPos.x;
              s.personalTarget.y = tPos.z;
            }
            const sPos = { x: s.worldX, z: s.worldY };
            this.map.pushPointOutsideAllBoxes(sPos, u, solidBoxes, 7);
            s.worldX = sPos.x;
            s.worldY = sPos.z;
          }
        }
      }
      u.sanitizePosition?.();
      } catch (err) {
        console.warn('Unit update error:', err);
      }
    }

    this.barbedWires = this.barbedWires.filter((w) => w.active);
  }

  _detonateTankShell(b) {
    const splashR = b.splashRadius || 45; // 4.5m de raio de dano explosivo
    if (this.renderer?.vfx) {
      const gy = getTerrainHeight(b.x, b.y, this.map) + 3;
      this.renderer.vfx.spawnHeavyExplosion(b.x, gy, b.y, 1.35);
    }
    this.spawnExplosionParticles(b.x, b.y, 26);
    this.playSoundAt('explosion', b.x, b.y, 0.85);

    const dmgMult = this.enemySabotageTimer > 0 ? 1.25 : 1.0;
    for (const u of this.units) {
      if (!u.alive || u.captured || u.team === b.team) continue;
      const d = dist(b.x, b.y, u.x, u.y);
      if (d <= splashR + (u.radius || 20)) {
        const falloff = clamp(1 - d / (splashR + 28), 0.35, 1.0);
        const armorMult = u.spec.type === 'vehicle' ? 1.35 : 1.0;
        const unitDmgMult = u.team === 'enemies' ? dmgMult : 1.0;
        u.takeDamage(
          b.damage * falloff * armorMult * unitDmgMult,
          b.team,
          this,
          true,
          true,
          b.x,
          b.y
        );
      }
    }
    // Destrói coberturas leves (arame farpado / barricadas próximas)
    for (const wire of this.barbedWires) {
      if (wire.active && wire.containsPoint(b.x, b.y, splashR)) {
        wire.active = false;
      }
    }
  }

  _updateBulletsAndMines(dt) {
    // Atualiza granadas em arco 3D lançadas automaticamente pelo Esquadrão de Assalto
    for (let i = this.pendingGrenades.length - 1; i >= 0; i--) {
      const g = this.pendingGrenades[i];
      g.timer -= dt;
      if (g.timer <= 0) {
        this.pendingGrenades.splice(i, 1);
        this.spawnExplosionParticles(g.x, g.y, 26);
        this.playSoundAt('explosion', g.x, g.y, 0.78);
        this.spawnText(g.x, g.y - 14, '💥 GRANADA DE ASSALTO!', '#f97316');
        for (const u of this.units) {
          if (!u.alive || u.team === g.team) continue;
          const d = dist(g.x, g.y, u.x, u.y);
          if (d <= 115) {
            u.takeDamage(95 * (1 - d / 135), g.team, this, true, true, g.x, g.y);
          }
        }
      }
    }

    for (const b of this.bullets) {
      b.prevX = b.x;
      b.prevY = b.y;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Rastro de fumaça e propulsão de fogo para foguetes antitanque (Bazuca / Javelin / Katyusha)
      if (b.isRocket && Math.random() < 0.85) {
        this.particles.push({
          x: b.x - Math.cos(b.angle) * 6 + (Math.random() - 0.5) * 3,
          y: b.y - Math.sin(b.angle) * 6 + (Math.random() - 0.5) * 3,
          z: 9 + (Math.random() - 0.5) * 2,
          vx: -Math.cos(b.angle) * 16 + (Math.random() - 0.5) * 10,
          vy: -Math.sin(b.angle) * 16 + (Math.random() - 0.5) * 10,
          vz: 6 + Math.random() * 6,
          radius: 2.6 + Math.random() * 1.8,
          color: Math.random() < 0.35 ? '#fb923c' : '#d6d3d1',
          life: 0.32,
          maxLife: 0.32,
        });
      }

      let hitSomething = false;

      // 1. BLOQUEIO FÍSICO REAL DE PROJÉTEIS POR MUROS, SACOS DE AREIA E TRINCHEIRAS (RAYCAST 2D)
      // Se o tiro não for explosivo (morteiro/granada/artilharia) e já tiver saído de perto do próprio atirador,
      // checa se bateu fisicamente em um muro, saco de areia ou borda de trincheira!
      if (!b.explosive && dist(b.startX ?? b.prevX, b.startY ?? b.prevY, b.x, b.y) > 48) {
        const barrierHit = this.map.checkProjectileCoverBlock(
          b.prevX,
          b.prevY,
          b.x,
          b.y,
          this.fortifiedWalls,
          this.barricades,
          this.trenches
        );
        if (barrierHit && Math.random() < (barrierHit.blockChance || 0.86)) {
          b.life = 0;
          hitSomething = true;
          this.spawnWallImpactParticles(barrierHit.hitX, barrierHit.hitY);
          continue;
        }
      }

      for (const u of this.units) {
        if (!u.alive || u.captured || u.team === b.team) continue;
        const hitRad =
          u.spec.type === 'infantry'
            ? Math.max(u.radius, (u.spacingMeters || 3) * 11)
            : u.radius;
        if (dist(b.x, b.y, u.x, u.y) <= hitRad) {
          // 2. PROTEÇÃO FÍSICA REAL PARA SOLDADOS AGACHADOS ATRÁS DE MURO / TRINCHEIRA (85% A 90% DE BLOQUEIO FRONTAL)
          // Se o esquadrão estiver agachado atrás de um muro ou dentro de uma trincheira e o tiro vier da frente
          // (ou cruzar o muro entre o atirador e o soldado), o muro bloqueia fisicamente o tiro!
          if (!b.explosive && u.spec.type === 'infantry' && (u.crouchedInCover || u.inTrench)) {
            const rayHit = this.map.checkProjectileCoverBlock(
              b.startX ?? b.prevX,
              b.startY ?? b.prevY,
              u.x,
              u.y,
              this.fortifiedWalls,
              this.barricades,
              this.trenches
            );
            // Verifica se o tiro não é de flanqueamento lateral/traseiro
            let isFrontalCover = Boolean(rayHit);
            if (!isFrontalCover && u.coverSnap && typeof u.coverSnap.facingAngle === 'number') {
              const incomingFromX = (b.startX ?? b.prevX) - u.x;
              const incomingFromY = (b.startY ?? b.prevY) - u.y;
              const inLen = Math.hypot(incomingFromX, incomingFromY) || 1;
              const faceCos = Math.cos(u.coverSnap.facingAngle);
              const faceSin = Math.sin(u.coverSnap.facingAngle);
              const dotFront = (incomingFromX / inLen) * faceCos + (incomingFromY / inLen) * faceSin;
              if (dotFront > 0.25) isFrontalCover = true;
            }
            if (isFrontalCover && Math.random() < 0.86) {
              b.life = 0;
              hitSomething = true;
              this.spawnWallImpactParticles(
                rayHit ? rayHit.hitX : b.x,
                rayHit ? rayHit.hitY : b.y
              );
              break;
            }
          }

          if (b.isTankShell) {
            this._detonateTankShell(b);
          } else {
            const dmgMult = u.team === 'enemies' && this.enemySabotageTimer > 0 ? 1.25 : 1.0;
            u.takeDamage(b.damage * dmgMult, b.team, this, Boolean(b.explosive), Boolean(b.explosive), b.x, b.y);
            if (b.explosive && u.garrisonedBuildingId) {
              const st = this.map?.structures?.find((s) => s.id === u.garrisonedBuildingId && !s.destroyed);
              if (st) {
                st.hp = Math.max(0, (st.hp ?? 650) - Math.round((b.damage || 30) * 0.65));
                if (st.hp <= 0) {
                  st.destroyed = true;
                  this._ungarrisonUnit(u);
                  this.spawnText(st.x, st.y - 24, '💥 CONSTRUÇÃO DESTRUÍDA!', '#f97316');
                }
              }
            }
            if (b.explosive) {
              this.spawnExplosionParticles(b.x, b.y, 14);
            } else {
              this.particles.push({
                x: b.x,
                y: b.y,
                z: 8,
                vx: (Math.random() - 0.5) * 35,
                vy: (Math.random() - 0.5) * 35,
                radius: 2.2,
                color: '#d4a338',
                life: 0.18,
                maxLife: 0.18,
              });
            }
          }
          b.life = 0;
          hitSomething = true;
          break;
        }
      }

      if (!hitSomething && b.life > 0) {
        for (const bld of this.baseBuildings) {
          if (bld.alive === false || bld.team === b.team) continue;
          if (dist(b.x, b.y, bld.x, bld.y) <= (bld.radius || 85)) {
            this.damageBaseBuilding(bld, b.damage, b.team);
            if (b.isTankShell) {
              this._detonateTankShell(b);
            } else if (b.explosive) {
              this.spawnExplosionParticles(b.x, b.y, 16);
            }
            b.life = 0;
            if (!b.explosive) {
              this.particles.push({
                x: b.x,
                y: b.y,
                z: 14,
                vx: (Math.random() - 0.5) * 40,
                vy: (Math.random() - 0.5) * 40,
                radius: 2.5,
                color: '#f59e0b',
                life: 0.2,
                maxLife: 0.2,
              });
            }
            break;
          }
        }
      }

      if (!hitSomething && b.isTankShell && b.life > 0) {
        if (this.map.isLineBlockedByStructures?.(b.prevX, b.prevY, b.x, b.y)) {
          this._detonateTankShell(b);
          b.life = 0;
          hitSomething = true;
        }
      }
      if (!hitSomething && b.isTankShell && b.life <= 0) {
        this._detonateTankShell(b);
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    for (const m of this.mines) {
      if (!m.active) continue;

      if (!m.revealed && m.team === 'enemies') {
        const scout = this._findUnitNearWorld(
          m.x,
          m.y,
          135,
          (u) => u.team === 'allies'
        );
        if (scout) m.revealed = true;
      }

      const triggerUnit = this._findUnitNearWorld(
        m.x,
        m.y,
        m.triggerRadius,
        (u) => {
          if (u.team === m.team || u.surrendered || u.garrisonedBuildingId) return false;
          const effTrigger = u.formation === 'column' ? m.triggerRadius * 0.58 : m.triggerRadius;
          return dist(m.x, m.y, u.x, u.y) <= effTrigger;
        }
      );

      if (triggerUnit) {
        m.active = false;
        m.revealed = true;
        this.spawnExplosionParticles(m.x, m.y, 30);
        this.playSoundAt('explosion', m.x, m.y, 1.0);
        this.camera.shake(14, 0.35);
        this.spawnText(m.x, m.y - 16, '💥 MINA TERRESTRE DETONADA!', '#c94a38');

        for (const u of this.units) {
          if (!u.alive || u.captured) continue;
          const d = dist(m.x, m.y, u.x, u.y);
          if (d <= m.blastRadius) {
            const falloff = 1 - (d / m.blastRadius) * 0.55;
            u.takeDamage(m.damage * falloff, m.team, this, true, true, m.x, m.y);
          }
        }
      }
    }
    this.mines = this.mines.filter((m) => m.active);
  }

  _updateParticlesAndTexts(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.vz) {
        pt.z = (pt.z || 6) + pt.vz * dt;
      } else {
        pt.vx *= Math.exp(-dt * 4);
        pt.vy *= Math.exp(-dt * 4);
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  _computeContextPrompt() {
    const surrendered = this.units.find((u) => u.alive && u.surrendered && !u.captured);
    if (surrendered) {
      return '🏳 Esquadrão Inimigo Rendido! Clique nele ou pressione [G] para interrogar e abrir a Névoa de Guerra na Base Inimiga';
    }
    if (this.activeAirStrikeMode) {
      const doc = AIR_DOCTRINE_BY_ID[this.activeAirStrikeMode];
      return `✈ SUPORTE AÉREO (${doc?.name || ''}): Clique Esquerdo no mapa para designar as coordenadas • Botão Direito cancela`;
    }
    if (this.activeCommandMode === 'build_trench') {
      return `🛠 Escavar Trincheira (${this.trenchShapeL ? 'Formato em L' : 'Linha Reta'}): Clique e arraste no mapa • [R] Alternar Formato • Botão Direito cancela`;
    }
    if (this.activeCommandMode === 'build_wall') {
      return '🧱 Construir Muro de Concreto / Sacos de Areia (+75% Cobertura Pesada): Clique e arraste no mapa • Botão Direito cancela';
    }
    if (this.activeCommandMode === 'build_wire') {
      return '⛓ Construir Arame Farpado (-80% Velocidade Infantaria Inimiga): Clique e arraste no mapa • Botão Direito cancela';
    }
    if (this.activeCommandMode === 'build_barricade') {
      return '🚧 Construir Barricada & Dentes de Dragão: Clique e arraste no mapa • Botão Direito cancela';
    }
    if (this.activeCommandMode === 'build_mine') {
      return '💣 Plantar Campo Minado: Clique no terreno para espalhar 5 minas terrestres • Botão Direito cancela';
    }
    if (
      this.activeCommandMode === 'build_watchtower' ||
      this.activeCommandMode === 'build_emplacement' ||
      this.activeCommandMode === 'build_bunker' ||
      this.activeCommandMode === 'build_outpost'
    ) {
      return '🗼 Construir Torre de Defesa / Fortificação: Clique no terreno para posicionar • Botão Direito cancela';
    }
    if (this.selectedBuildingId) {
      const bld = this.baseBuildings.find((b) => b.id === this.selectedBuildingId && b.alive !== false);
      if (bld) {
        return `🏭 ${bld.name} Selecionado: Clique nas unidades para produzir • Clique Direito no mapa define o Ponto de Encontro`;
      }
    }
    const selCount = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected).length;
    if (selCount > 0) {
      return `${selCount} esquadrão(ões) selecionado(s) • Clique Direito p/ Mover, Ocupar Casa/Trincheira ou Demolir Base Inimiga • [TAB] Mapa Tático`;
    }
    return 'Clique Esquerdo em Tropas ou Prédios da Base • [TAB] Quadro de Planejamento Tático • [Espaço] Pausa Tática';
  }

  getHudSnapshot() {
    const selectedUnits = this.units.filter((u) => u.alive && u.faction === this.myFaction && u.selected);
    const allyUnitsCount = this.units.filter((u) => u.alive && u.team === this.myTeam).length;
    const enemyTeam = this.myTeam === 'enemies' ? 'allies' : 'enemies';
    const visibleEnemiesCount = this.units.filter(
      (u) =>
        u.alive &&
        u.team === enemyTeam &&
        !u.surrendered &&
        (this.intelRevealed || this.map.isPositionVisibleToAllies(u.x, u.y))
    ).length;
    const surrenderedUnits = this.units.filter((u) => u.alive && u.surrendered && !u.captured);

    let allyIncome = 24;
    let ammoIncome = 8;
    let fuelIncome = 6;
    for (const sec of this.map.sectors) {
      if (sec.owner === this.myTeam) {
        allyIncome += sec.supplyBonus || sec.incomeBonus || 12;
        ammoIncome += sec.ammoBonus || 0;
        fuelIncome += sec.fuelBonus || 0;
      }
    }
    for (const u of this.units) {
      if (u.alive && u.team === this.myTeam && u.spec.supplyBonus) {
        allyIncome += u.spec.supplyBonus;
      }
    }

    const builtAlliedBuildings = this.baseBuildings
      .filter((b) => b.team === this.myTeam && b.alive !== false)
      .map((b) => b.buildingType);

    const selectedBldObj = this.selectedBuildingId
      ? this.baseBuildings.find((b) => b.id === this.selectedBuildingId && b.alive !== false)
      : null;
    const selectedStructObj = this.selectedStructureId
      ? this.map?.structures?.find((s) => s.id === this.selectedStructureId && !s.destroyed)
      : null;
    const garrisonedInStruct = selectedStructObj?.garrisonUnitId
      ? this.units.find((u) => u.id === selectedStructObj.garrisonUnitId && u.alive)
      : null;

    const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return {
      gameMode: this.gameMode,
      mapId: this.mapId || 'normandy_fields',
      aiDifficulty: this.aiDifficulty || 'medium',
      hqLevel: this.hqLevel || 1,
      commandPoints: this.commandPoints || 0,
      aiHqLevels: { ...(this.aiHqLevels || { ally_ai: 1, enemy_1: 1, enemy_2: 1 }) },
      startingResourcesPreset: this.startingResourcesPreset,
      timeScale: this.timeScale,
      supplies: Math.floor(this.supplies),
      ammo: Math.floor(this.ammo),
      fuel: Math.floor(this.fuel),
      hqLevel: this.hqLevel || 1,
      commandPoints: this.commandPoints || 0,
      aiDifficulty: this.aiDifficulty || 'medium',
      playerSkinId: this.playerSkinId || 'olive_classic',
      mapId: this.mapId,
      victoryPoints: this.victoryPoints,
      victoryState: this.victoryState,
      gameOver: Boolean(this.gameOver),
      matchStats: { ...this.matchStats },
      techModalOpen: Boolean(this.techModalOpen),
      selectedBudgetTier: this.selectedBudgetTier,
      completedTechs: Array.from(this.completedTechs),
      activeResearch: this.activeResearch ? { ...this.activeResearch } : null,
      activeDroneLaunchMode: this.activeDroneLaunchMode,
      activeDronesCount: this.activeDrones.length,
      hasDroneFactory: this.hasDroneFactory(),
      droneStock: { ...this.droneStock },
      droneQueue: this.droneQueue.map((q) => ({
        type: q.type,
        remaining: Math.max(0, Math.ceil(q.duration - q.elapsed)),
      })),
      maxDroneStock: this.maxDroneStock,
      maxActiveDrones: this.maxActiveDrones,
      supplyIncome: allyIncome,
      ammoIncome,
      fuelIncome,
      supplyTimer: Math.ceil(this.supplyIncomeTimer),
      aiWaveTimer: Math.ceil(this.aiWaveTimer),
      intelRevealed: this.intelRevealed,
      spectatorMode: Boolean(this.spectatorMode),
      directorCamActive: Boolean(this.directorCamActive),
      spectatorHudHidden: Boolean(this.spectatorHudHidden),
      activeDirectorSceneId: this.activeDirectorSceneId || null,
      timeOfDay: this.timeOfDay || 'day',
      cinematicLowCam: Boolean(this.cinematicLowCam),
      sandboxMode: Boolean(this.sandboxMode),
      mapEditorOpen: Boolean(this.mapEditorOpen),
      mapEditorTool: this.mapEditorTool || null,
      mapEditorAngleDeg: Math.round((((this.mapEditorAngle || 0) * 180) / Math.PI + 360) % 360),
      mapEditorScale: Number((this.mapEditorScale || 1.0).toFixed(2)),
      selectedEditorSectorId: this.selectedEditorSectorId || null,
      selectedEditorObject: this.selectedEditorObject
        ? {
            id: this.selectedEditorObject.id,
            kind: this.selectedEditorObject.kind,
            label: this.selectedEditorObject.label,
            angleDeg: Math.round(
              ((((this.selectedEditorObject.item?.angle || 0) * 180) / Math.PI) % 360 + 360) % 360
            ),
          }
        : null,
      sandboxFogDisabled: Boolean(this.sandboxFogDisabled),
      sandboxAiPaused: Boolean(this.sandboxAiPaused),
      isCampaign: Boolean(this.isCampaign),
      campaignDay: this.campaignDay || 1,
      unlockedBattalions: this.networkManager?.currentUser?.unlockedBattalions || [],
      paradropCooldown: Math.ceil(this.paradropCooldown || 0),
      activeCommandMode: this.activeCommandMode,
      guidedTrainingTip: this._getGuidedTrainingTip(),
      selectedStructure: selectedStructObj
        ? {
            id: selectedStructObj.id,
            name: selectedStructObj.name || 'Construção',
            hp: Math.round(selectedStructObj.hp ?? 600),
            maxHp: Math.round(selectedStructObj.maxHp ?? 600),
            garrisonable: Boolean(selectedStructObj.garrisonable),
            garrisonUnitId: selectedStructObj.garrisonUnitId || null,
            garrisonTeam: selectedStructObj.garrisonTeam || null,
            garrisonUnitName: garrisonedInStruct ? garrisonedInStruct.name : null,
            observationBoosted: Boolean(selectedStructObj.observationBoosted),
          }
        : null,
      selectedWall: selectedWallObj
        ? {
            id: selectedWallObj.id,
            hp: Math.round(selectedWallObj.hp ?? 2500),
            maxHp: Math.round(selectedWallObj.maxHp ?? 2500),
            isGate: Boolean(selectedWallObj.isGate),
            reinforced: Boolean(selectedWallObj.reinforced),
          }
        : null,
      hasPowCamp: this.baseBuildings.some(
        (b) => b.faction === 'player' && b.buildingType === 'pow_camp' && b.alive !== false
      ),
      powPrisonersCount: this.powPrisoners?.length || 0,
      powPrisonersMax: 10,
      powIncomePerSec: this.baseBuildings.some(
        (b) => b.faction === 'player' && b.buildingType === 'pow_camp' && b.alive !== false
      )
        ? (this.powPrisoners?.length || 0) * 5
        : 0,
      enemyProductionDebuffTimer: Math.ceil(this.enemyProductionDebuffTimer || 0),
      enemySabotageTimer: Math.ceil(this.enemySabotageTimer || 0),
      isMultiplayer: Boolean(this.isMultiplayer),
      isCampaign: Boolean(this.isCampaign),
      campaignOwnedTerritoriesCount: this.campaignOwnedTerritoriesCount || 1,
      tacticalMapOpen: this.tacticalMapOpen,
      tacticalArrowsCount: this.tacticalArrows.length,
      tacticalPingsCount: this.tacticalPings.length,
      activeCommandSlot: this.activeCommandSlot,
      activeBottomCategory: this.activeBottomCategory,
      touchControlMode: this.touchControlMode || 'select',
      activeCommandMode: this.activeCommandMode,
      focusedUnitId: this.focusedUnitId || null,
      activeEngineeringActionId: this.activeEngineeringActionId,
      activeAirStrikeMode: this.activeAirStrikeMode,
      airCooldowns: {
        recon_drone: Math.ceil(this.airCooldowns.recon_drone || 0),
        a10_strafe: Math.ceil(this.airCooldowns.a10_strafe || 0),
        precision_bomb: Math.ceil(this.airCooldowns.precision_bomb || 0),
      },
      builtBuildings: builtAlliedBuildings,
      alliedBaseBuildings: this.baseBuildings
        .filter((b) => b.team === 'allies' && b.faction === 'player' && b.alive !== false)
        .map((b) => ({
          id: b.id,
          buildingType: b.buildingType,
          name: b.name,
          short: b.short,
          hp: Math.ceil(b.hp || 1500),
          maxHp: b.maxHp || 1500,
          queueLength: b.productionQueue?.length || 0,
          progress: Math.round(b.productionProgress || 0),
        })),
      selectedBuilding: selectedBldObj
        ? {
            id: selectedBldObj.id,
            buildingType: selectedBldObj.buildingType,
            name: selectedBldObj.name,
            short: selectedBldObj.short,
            subtitle: selectedBldObj.subtitle,
            hp: Math.ceil(selectedBldObj.hp || 1500),
            maxHp: selectedBldObj.maxHp || 1500,
            rallyX: Math.round(selectedBldObj.rallyX || selectedBldObj.x),
            rallyY: Math.round(selectedBldObj.rallyY || selectedBldObj.y),
            produces: selectedBldObj.produces || [],
            productionProgress: Math.round(selectedBldObj.productionProgress || 0),
            productionRemainingSec:
              selectedBldObj.productionQueue?.length > 0
                ? Math.ceil(
                    Math.max(
                      0,
                      (selectedBldObj.productionQueue[0].duration || 6) -
                        (selectedBldObj.productionQueue[0].elapsed || 0)
                    )
                  )
                : 0,
            productionQueue: (selectedBldObj.productionQueue || []).map((q, idx) => ({
              idx,
              unitId: q.unitId,
              name: q.name,
              short: q.short,
              remainingSec: Math.ceil(Math.max(0, (q.duration || 6) - (q.elapsed || 0))),
            })),
          }
        : null,
      trenchShapeL: this.trenchShapeL,
      allyUnitsCount,
      enemyUnitsCount: visibleEnemiesCount,
      surrenderedCount: surrenderedUnits.length,
      selectedCount: selectedUnits.length,
      selectedFormation: selectedUnits[0]?.formation || 'line',
      selectedSpacing: Number((selectedUnits[0]?.spacingMeters || 3.0).toFixed(1)),
      selectedHoldPosition: Boolean(selectedUnits[0]?.holdPosition),
      anySelectedGarrisoned: selectedUnits.some((u) => Boolean(u.garrisonedBuildingId)),
      anySelectedSnappedToCover: selectedUnits.some((u) => Boolean(u.snappedToCover)),
      anySelectedCrouching: selectedUnits.some((u) => Boolean(u.crouchedInCover || u.inTrench)),
      otherAlliedInfantrySquads: this.units
        .filter(
          (u) =>
            u.alive &&
            !u.captured &&
            u.faction === 'player' &&
            u.spec.type === 'infantry' &&
            u.id !== selectedUnits[0]?.id
        )
        .map((u) => ({
          id: u.id,
          name: u.name,
          short: u.short,
          soldiersAlive: u.soldiersAlive,
          maxSoldiers: u.maxSoldiers,
        })),
      selectedUnits: selectedUnits.map((u) => {
        const cargoSquads = (u.cargoSquadIds || [])
          .map((sid) => this.units.find((c) => c.id === sid && c.alive))
          .filter(Boolean);
        const cargoSoldiersCount = cargoSquads.reduce((acc, c) => acc + (c.soldiersAlive || 0), 0);
        const selectedWallObj = this.selectedWallId
      ? (this.fortifiedWalls || []).find((w) => w.id === this.selectedWallId && (w.hp ?? 2500) > 0)
      : null;

    return {
          id: u.id,
          unitType: u.unitType,
          isInfantry: u.spec.type === 'infantry',
          isVehicle: u.spec.type === 'vehicle',
          armorPct: Math.round((u.spec.armor || 0) * 100),
          weaponLabel: u.spec.weaponModel || u.unitType,
          isTransport: Boolean(u.spec.isTransport),
          cargoSquadsCount: cargoSquads.length,
          maxCargoSquads: u.maxCargoSquads || 2,
          cargoSoldiersCount,
          maxCargoSoldiers: u.maxCargoSoldiers || 12,
          cargoNames: cargoSquads.map((c) => `${c.short} (${c.soldiersAlive})`),
          name: u.name,
          short: u.short,
          hp: Math.ceil(u.hp),
          maxHp: u.maxHp,
          soldiersAlive: u.soldiersAlive,
          maxSoldiers: u.maxSoldiers,
          formation: u.formation || 'line',
          spacingMeters: Number((u.spacingMeters || 3.0).toFixed(1)),
          holdPosition: Boolean(u.holdPosition),
          suppressionMode: Boolean(u.suppressionMode),
          suppressed: (u.suppressedTimer || 0) > 0,
          medkitHealing: (u.medkitHealTimer || 0) > 0,
          abilityCooldowns: {
            grenade: Math.ceil(u.grenadeAbilityCooldown || 0),
            suppression: Math.ceil(u.suppressionCooldown || 0),
            medkit: Math.ceil(u.medkitCooldown || 0),
          },
          stance: u.stance || (u.crouchedInCover ? 'crouch' : 'stand'),
          inTrench: u.inTrench,
          inTreelineCover: u.inTreelineCover,
          inForestStealth: Boolean(u.inForestStealth),
          camouflagedInForest: Boolean(u.camouflagedInForest),
          inHeavyCover: u.inHeavyCover,
          inLightCover: u.inLightCover,
          garrisonedBuildingId: u.garrisonedBuildingId,
          soldiers: (u.soldiers || [])
            .filter((s) => s.alive)
            .map((s) => ({
              id: s.id,
              name: s.name,
              rank: s.rank,
              weapon: s.weapon,
              weaponIcon: s.weaponIcon,
              hp: Math.ceil(s.hp),
              maxHp: s.maxHp,
              alive: s.alive,
              selected: Boolean(s.selected),
            })),
        };
      }),
      sectors: this.map.sectors.map((s) => ({
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        shortLabel: s.shortLabel,
        type: s.type,
        owner: s.owner,
        x: s.x,
        y: s.y,
        captureProgress: Math.round(s.captureProgress),
        incomeBonus: s.incomeBonus,
        supplyBonus: s.supplyBonus,
        ammoBonus: s.ammoBonus,
        fuelBonus: s.fuelBonus,
      })),
      contextPrompt: this._computeContextPrompt(),
      notifications: this.notifications.map((n) => ({ ...n })),
      muted: this.audio.muted,
      settings: { ...this.settings },
      savedBattles: this.getSavedBattles().map((s) => ({
        id: s.id,
        title: s.title,
        dateLabel: s.dateLabel,
        savedAt: s.savedAt,
        gameMode: s.gameMode,
        supplies: s.supplies,
        ammo: s.ammo,
        fuel: s.fuel,
        victoryPoints: s.victoryPoints || 0,
        allyUnitsCount: s.allyUnitsCount || (s.units ? s.units.length : 0),
        enemyUnitsCount: s.enemyUnitsCount || 0,
      })),
    };
  }

  _emitHud() {
    this.onHudUpdate?.(this.getHudSnapshot());
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.input.destroy();
    this.renderer?.destroy();
    this.audio.close();
  }
}
