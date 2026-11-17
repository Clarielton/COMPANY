import { clamp, dist, mulberry32 } from '../core/math.js';

// Mapa 3x Maior (9600 x 9600) dando espaço real para exploração na névoa, flanqueamento e defesa em profundidade
export const BATTLEFIELD_SIZE = 9600;
export const FOG_GRID_SIZE = 160; // 160x160 células de 60x60 unidades

export class BattlefieldMap {
  constructor(options = 1944) {
    const seed = typeof options === 'object' && options !== null ? (options.seed ?? 1944) : options;
    this.mapId = typeof options === 'object' && options !== null ? (options.mapId || 'normandy_fields') : 'normandy_fields';
    this.theme =
      this.mapId === 'el_alamein_ridge'
        ? 'desert'
        : this.mapId === 'bastogne_winter'
        ? 'winter'
        : 'rural';
    this.seed = seed;
    this.size = BATTLEFIELD_SIZE;
    this.fogSize = FOG_GRID_SIZE;
    const rng = mulberry32(seed);

    // =========================================================================
    // 1. SISTEMA REAL DE NÉVOA DE GUERRA (3 ESTADOS: 0 = Inexplorado, 1 = Shroud/Explorado sem visão, 2 = Visão Ativa)
    // =========================================================================
    this.fogGrid = new Uint8Array(this.fogSize * this.fogSize); // 0 por padrão (Escuridão Total / Névoa Densa)
    this.tempVisionZones = []; // Zonas temporárias reveladas por Avião/Drone Recon ou Interrogatório Militar
    this.bushes = [];

    if (this.mapId === 'el_alamein_ridge') {
      this._buildDesertMap(rng);
      this._generateBushes(rng);
      this.frontlineSamples = 40;
      this.frontlineX = new Float32Array(this.frontlineSamples).fill(this.size * 0.5);
      return;
    }

    if (this.mapId === 'bastogne_winter') {
      this._buildWinterMap(rng);
      this._generateBushes(rng);
      this.frontlineSamples = 40;
      this.frontlineX = new Float32Array(this.frontlineSamples).fill(this.size * 0.5);
      return;
    }

    // 2. Campos Agrícolas Escalados (9600x9600)
    const S = 3;
    this.fields = [
      { x: 180 * S, y: 200 * S, w: 840 * S, h: 680 * S, type: 'wheat', angle: 0.04, name: 'Lavoura Noroeste' },
      { x: 1120 * S, y: 180 * S, w: 920 * S, h: 640 * S, type: 'pasture', angle: -0.03, name: 'Prado do Moinho Norte' },
      { x: 2140 * S, y: 220 * S, w: 860 * S, h: 700 * S, type: 'plowed', angle: 0.02, name: 'Terra Arada Nordeste' },
      { x: 200 * S, y: 1050 * S, w: 780 * S, h: 980 * S, type: 'pasture', angle: 0.0, name: 'Campina Central Oeste' },
      { x: 1100 * S, y: 1020 * S, w: 1000 * S, h: 1120 * S, type: 'mud', angle: 0.0, name: 'Terra de Ninguém (Crateras)' },
      { x: 2220 * S, y: 1050 * S, w: 780 * S, h: 980 * S, type: 'wheat', angle: -0.02, name: 'Trigal Leste' },
      { x: 180 * S, y: 2220 * S, w: 860 * S, h: 760 * S, type: 'plowed', angle: -0.02, name: 'Lavoura Sudoeste' },
      { x: 1140 * S, y: 2300 * S, w: 920 * S, h: 700 * S, type: 'wheat', angle: 0.03, name: 'Vale da Fazenda Sul' },
      { x: 2160 * S, y: 2240 * S, w: 840 * S, h: 740 * S, type: 'pasture', angle: 0.01, name: 'Colina Sudeste' },
    ];

    // 3. Estradas Rurais Principais e Secundárias
    this.roads = [
      {
        points: [
          { x: 60 * S, y: 1600 * S },
          { x: 920 * S, y: 1540 * S },
          { x: 1600 * S, y: 1600 * S },
          { x: 2320 * S, y: 1650 * S },
          { x: 3140 * S, y: 1580 * S },
        ],
        width: 115,
      },
      {
        points: [
          { x: 80 * S, y: 920 * S },
          { x: 1050 * S, y: 950 * S },
          { x: 2120 * S, y: 920 * S },
          { x: 3120 * S, y: 960 * S },
        ],
        width: 95,
      },
      {
        points: [
          { x: 80 * S, y: 2160 * S },
          { x: 1080 * S, y: 2200 * S },
          { x: 2120 * S, y: 2160 * S },
          { x: 3120 * S, y: 2190 * S },
        ],
        width: 95,
      },
      {
        points: [
          { x: 1600 * S, y: 80 * S },
          { x: 1570 * S, y: 950 * S },
          { x: 1600 * S, y: 1600 * S },
          { x: 1630 * S, y: 2200 * S },
          { x: 1600 * S, y: 3120 * S },
        ],
        width: 95,
      },
      {
        points: [
          { x: 960 * S, y: 200 * S },
          { x: 930 * S, y: 880 * S },
          { x: 960 * S, y: 1540 * S },
          { x: 995 * S, y: 2240 * S },
          { x: 960 * S, y: 2950 * S },
        ],
        width: 82,
      },
      {
        points: [
          { x: 2240 * S, y: 200 * S },
          { x: 2275 * S, y: 900 * S },
          { x: 2240 * S, y: 1650 * S },
          { x: 2205 * S, y: 2300 * S },
          { x: 2240 * S, y: 2950 * S },
        ],
        width: 82,
      },
    ];

    // 4. Fileiras de Árvores (Treelines) nas divisas dos campos
    this.treelines = [];
    this.trees = [];

    const addTreeline = (x1, y1, x2, y2, density = 26) => {
      this.treelines.push({ x1, y1, x2, y2, radius: 75 });
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const count = Math.max(8, Math.floor((len / 950) * density * 3));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const jx = (rng() - 0.5) * 68;
        const jy = (rng() - 0.5) * 68;
        this.trees.push({
          x: x1 + dx * t + jx,
          y: y1 + dy * t + jy,
          scale: 0.9 + rng() * 0.72,
          foliageTone: rng(),
        });
      }
    };

    addTreeline(1040 * S, 220 * S, 1040 * S, 840 * S, 22);
    addTreeline(2090 * S, 220 * S, 2090 * S, 840 * S, 22);
    addTreeline(1020 * S, 1080 * S, 1020 * S, 1450 * S, 18);
    addTreeline(1020 * S, 1690 * S, 1020 * S, 2060 * S, 18);
    addTreeline(2160 * S, 1080 * S, 2160 * S, 1500 * S, 18);
    addTreeline(2160 * S, 1740 * S, 2160 * S, 2080 * S, 18);
    addTreeline(1060 * S, 2320 * S, 1060 * S, 2940 * S, 22);
    addTreeline(2100 * S, 2320 * S, 2100 * S, 2940 * S, 22);
    addTreeline(480 * S, 960 * S, 860 * S, 960 * S, 16);
    addTreeline(2320 * S, 960 * S, 2760 * S, 960 * S, 16);
    addTreeline(480 * S, 2140 * S, 880 * S, 2140 * S, 16);
    addTreeline(2320 * S, 2140 * S, 2760 * S, 2140 * S, 16);

    // 5. Crateras de Artilharia
    this.craters = [];
    for (let i = 0; i < 85; i++) {
      this.craters.push({
        x: 1800 + rng() * 6000,
        y: 600 + rng() * 8400,
        radius: 36 + rng() * 64,
      });
    }

    // =========================================================================
    // 6. CONSTRUÇÕES RURAIS/URBANAS E RUÍNAS (Com Colisão Física e Guarnição +75% Def)
    // =========================================================================
    this.structures = [
      {
        id: 'bld_north_mill',
        name: 'Moinho & Silo Norte',
        type: 'windmill',
        x: 4520,
        y: 1820,
        w: 96,
        d: 78,
        h: 52,
        angle: 0.06,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 96,
      },
      {
        id: 'bld_north_cottage',
        name: 'Chalé da Colina Norte',
        type: 'farmhouse',
        x: 5120,
        y: 2120,
        w: 84,
        d: 64,
        h: 34,
        angle: -0.1,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 82,
      },
      {
        id: 'bld_center_townhouse',
        name: 'Posto Alfandegário Central',
        type: 'farmhouse',
        x: 4540,
        y: 4560,
        w: 92,
        d: 68,
        h: 38,
        angle: 0.0,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 88,
      },
      {
        id: 'bld_center_ruin_1',
        name: 'Ruínas da Encruzilhada Leste',
        type: 'ruin',
        x: 5080,
        y: 4590,
        w: 96,
        d: 74,
        h: 30,
        angle: 0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 92,
      },
      {
        id: 'bld_center_ruin_2',
        name: 'Armazém Bombardeado Central',
        type: 'ruin',
        x: 4780,
        y: 5080,
        w: 98,
        d: 68,
        h: 28,
        angle: -0.05,
        garrisonable: false,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 90,
      },
      {
        id: 'bld_south_barn',
        name: 'Grande Celeiro da Fazenda Sul',
        type: 'barn',
        x: 4560,
        y: 7380,
        w: 108,
        d: 78,
        h: 42,
        angle: 0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 98,
      },
      {
        id: 'bld_south_farmhouse',
        name: 'Sede da Fazenda Sul',
        type: 'farmhouse',
        x: 5140,
        y: 7740,
        w: 86,
        d: 66,
        h: 34,
        angle: -0.08,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 84,
      },
      {
        id: 'bld_west_depot_house',
        name: 'Armazém do Depósito Oeste',
        type: 'farmhouse',
        x: 2740,
        y: 2820,
        w: 88,
        d: 66,
        h: 34,
        angle: 0.08,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 84,
      },
      {
        id: 'bld_west_fuel_barn',
        name: 'Galpão de Combustível Sudoeste',
        type: 'barn',
        x: 2760,
        y: 6420,
        w: 96,
        d: 70,
        h: 38,
        angle: -0.06,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 88,
      },
      {
        id: 'bld_east_radio_house',
        name: 'Estação de Rádio Nordeste',
        type: 'farmhouse',
        x: 6820,
        y: 2840,
        w: 88,
        d: 66,
        h: 34,
        angle: -0.08,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 84,
      },
      {
        id: 'bld_east_munitions_barn',
        name: 'Arsenal Sudeste do Eixo',
        type: 'barn',
        x: 6840,
        y: 6440,
        w: 96,
        d: 70,
        h: 38,
        angle: 0.07,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 88,
      },
      // VILAREJO 1 (ROTA OESTE-CENTRAL: VILAREJO DE SAINTE-MÈRE)
      {
        id: 'bld_village1_church',
        name: 'Igreja & Torre de Sainte-Mère',
        type: 'church',
        x: 3680,
        y: 3320,
        w: 112,
        d: 76,
        h: 64,
        angle: 0.02,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 105,
      },
      {
        id: 'bld_village1_twostory_1',
        name: 'Sobrado Comercial Oeste',
        type: 'two_story',
        x: 3420,
        y: 4460,
        w: 94,
        d: 72,
        h: 54,
        angle: -0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 92,
      },
      {
        id: 'bld_village1_gas',
        name: 'Posto Abandonado da Estrada Oeste',
        type: 'gas_station',
        x: 2480,
        y: 4540,
        w: 92,
        d: 64,
        h: 32,
        angle: 0.05,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 86,
      },
      {
        id: 'bld_village1_warehouse',
        name: 'Galpão Ferroviário Sudoeste',
        type: 'warehouse',
        x: 3640,
        y: 6260,
        w: 116,
        d: 78,
        h: 44,
        angle: 0.0,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 102,
      },
      // VILAREJO 2 (ROTA LESTE-CENTRAL: VILAREJO DE BASTOGNE)
      {
        id: 'bld_village2_twostory_1',
        name: 'Hotel de Dois Andares (Bastogne)',
        type: 'two_story',
        x: 5920,
        y: 4440,
        w: 98,
        d: 74,
        h: 56,
        angle: 0.03,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 94,
      },
      {
        id: 'bld_village2_church',
        name: 'Capela & Campanário Leste',
        type: 'church',
        x: 5860,
        y: 6240,
        w: 108,
        d: 74,
        h: 62,
        angle: -0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 102,
      },
      {
        id: 'bld_village2_warehouse',
        name: 'Galpão Logístico Nordeste',
        type: 'warehouse',
        x: 5880,
        y: 3180,
        w: 114,
        d: 76,
        h: 44,
        angle: 0.02,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 100,
      },
      {
        id: 'bld_village2_gas',
        name: 'Posto de Abastecimento Leste',
        type: 'gas_station',
        x: 7120,
        y: 4580,
        w: 92,
        d: 64,
        h: 32,
        angle: -0.05,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 86,
      },
    ];

    // =========================================================================
    // 7. MUROS BAIXOS DE PEDRA/TIJOLO E CERCAS REFORÇADAS (Cobertura Pesada Direcional +65% Def)
    // =========================================================================
    this.stoneWalls = [
      { id: 'wall_1', x1: 4320, y1: 4620, x2: 4320, y2: 4920, type: 'stone', thickness: 18 },
      { id: 'wall_2', x1: 5280, y1: 4620, x2: 5280, y2: 4920, type: 'stone', thickness: 18 },
      { id: 'wall_3', x1: 4640, y1: 4380, x2: 4960, y2: 4380, type: 'brick', thickness: 18 },
      { id: 'wall_4', x1: 4380, y1: 1880, x2: 4380, y2: 2140, type: 'stone', thickness: 18 },
      { id: 'wall_5', x1: 5260, y1: 1880, x2: 5260, y2: 2140, type: 'stone', thickness: 18 },
      { id: 'wall_6', x1: 4380, y1: 7420, x2: 4380, y2: 7680, type: 'stone', thickness: 18 },
      { id: 'wall_7', x1: 5260, y1: 7420, x2: 5260, y2: 7680, type: 'stone', thickness: 18 },
      { id: 'wall_8', x1: 2940, y1: 2990, x2: 2940, y2: 3150, type: 'brick', thickness: 18 },
      { id: 'wall_9', x1: 2940, y1: 6380, x2: 2940, y2: 6640, type: 'brick', thickness: 18 },
      { id: 'wall_10', x1: 6640, y1: 2780, x2: 6640, y2: 3040, type: 'brick', thickness: 18 },
      { id: 'wall_11', x1: 6640, y1: 6380, x2: 6640, y2: 6640, type: 'brick', thickness: 18 },
      { id: 'wall_12', x1: 3560, y1: 4660, x2: 3560, y2: 4940, type: 'stone', thickness: 18 },
      { id: 'wall_13', x1: 6040, y1: 4660, x2: 6040, y2: 4940, type: 'stone', thickness: 18 },
      { id: 'wall_14', x1: 3540, y1: 3420, x2: 3820, y2: 3420, type: 'stone', thickness: 18 },
      { id: 'wall_15', x1: 5740, y1: 6120, x2: 6020, y2: 6120, type: 'stone', thickness: 18 },
      { id: 'wall_16', x1: 2380, y1: 4460, x2: 2620, y2: 4460, type: 'brick', thickness: 18 },
      { id: 'wall_17', x1: 7000, y1: 4680, x2: 7240, y2: 4680, type: 'brick', thickness: 18 },
    ];

    // =========================================================================
    // 8. CARROS ABANDONADOS, CAMINHÕES QUEIMADOS E TANQUES DESTRUÍDOS (Cobertura Leve +40% Def & Colisão)
    // =========================================================================
    this.wrecks = [
      { id: 'wrk_1', type: 'tank', x: 3960, y: 4720, angle: 0.35, smoke: true, radius: 56, colRadius: 30, name: 'Tanque Médio Destruído' },
      { id: 'wrk_2', type: 'truck', x: 5520, y: 4860, angle: -2.6, smoke: true, radius: 54, colRadius: 28, name: 'Caminhão Militar Queimado' },
      { id: 'wrk_3', type: 'car', x: 3360, y: 4640, angle: 0.18, smoke: false, radius: 46, colRadius: 22, name: 'Sedan Civil Enferrujado' },
      { id: 'wrk_4', type: 'car', x: 4770, y: 3960, angle: 1.45, smoke: false, radius: 46, colRadius: 22, name: 'Carro Abandonado' },
      { id: 'wrk_5', type: 'truck', x: 4080, y: 2800, angle: -0.25, smoke: true, radius: 54, colRadius: 28, name: 'Comboio Queimado Norte' },
      { id: 'wrk_6', type: 'tank', x: 5460, y: 2770, angle: 2.8, smoke: true, radius: 56, colRadius: 30, name: 'Blindado Destruído Norte' },
      { id: 'wrk_7', type: 'car', x: 3840, y: 6540, angle: -0.4, smoke: false, radius: 46, colRadius: 22, name: 'Utilitário Rural Abandonado' },
      { id: 'wrk_8', type: 'truck', x: 5670, y: 6510, angle: 2.4, smoke: true, radius: 54, colRadius: 28, name: 'Caminhão de Suprimentos Queimado' },
      { id: 'wrk_9', type: 'tank', x: 4845, y: 5880, angle: -1.3, smoke: true, radius: 56, colRadius: 30, name: 'Caça-Tanques Destruído' },
      { id: 'wrk_10', type: 'car', x: 6240, y: 4920, angle: 2.9, smoke: false, radius: 46, colRadius: 22, name: 'Carro Civil Abandonado' },
      { id: 'wrk_11', type: 'tank', x: 2620, y: 4760, angle: 0.2, smoke: true, radius: 56, colRadius: 30, name: 'Blindado de Vanguarda Queimado' },
      { id: 'wrk_12', type: 'truck', x: 7020, y: 4780, angle: -2.9, smoke: true, radius: 54, colRadius: 28, name: 'Meia-Lagarta Queimado' },
      { id: 'wrk_13', type: 'car', x: 3560, y: 3180, angle: 0.6, smoke: false, radius: 46, colRadius: 22, name: 'Carro Abandonado na Praça' },
      { id: 'wrk_14', type: 'truck', x: 6020, y: 3320, angle: -1.2, smoke: true, radius: 54, colRadius: 28, name: 'Caminhão Logístico Destruído' },
    ];

    // 9. Bases de Comando (HQs) no Mapa 9600x9600 (posicionadas >= 14m fora das estradas principais)
    this.hqs = {
      player: { x: 1150, y: 4280, team: 'allies', faction: 'player', name: 'QG 1ª Divisão Aliada' },
      ally_ai: { x: 1250, y: 7400, team: 'allies', faction: 'ally_ai', name: 'QG 2º Grupo Aliado' },
      enemy_1: { x: 8450, y: 4280, team: 'enemies', faction: 'enemy_1', name: 'QG Kampfgruppe Norte' },
      enemy_2: { x: 8350, y: 2200, team: 'enemies', faction: 'enemy_2', name: 'QG Brigada Leste' },
    };

    // =========================================================================
    // 10. 8 PONTOS ESTRATÉGICOS DE CONQUISTA (Suprimentos, Combustível e Munição)
    // =========================================================================
    this.sectors = [
      {
        id: 'sec_west_ammo',
        name: 'Depósito de Munição Oeste',
        shortName: 'Munição Oeste',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+12 MUN',
        x: 2850,
        y: 2920,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 12,
        fuelBonus: 0,
      },
      {
        id: 'sec_west_fuel',
        name: 'Posto de Combustível Sudoeste',
        shortName: 'Combustível SO',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+12 COMB',
        x: 2850,
        y: 6520,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 12,
      },
      {
        id: 'sec_north_mill',
        name: 'Setor Alfa (Moinho Norte)',
        shortName: 'Moinho Norte',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+22 SUP',
        x: 4800,
        y: 1980,
        radius: 165,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 22,
        incomeBonus: 22,
        ammoBonus: 5,
        fuelBonus: 5,
      },
      {
        id: 'sec_center_cross',
        name: 'Setor Bravo (Encruzilhada Central)',
        shortName: 'Encruzilhada',
        type: 'strategic',
        resourceType: 'strategic',
        shortLabel: '+30 SUP',
        x: 4800,
        y: 4800,
        radius: 180,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 30,
        incomeBonus: 30,
        ammoBonus: 8,
        fuelBonus: 8,
      },
      {
        id: 'sec_south_farm',
        name: 'Setor Charlie (Fazenda Sul)',
        shortName: 'Fazenda Sul',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+22 SUP',
        x: 4800,
        y: 7560,
        radius: 165,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 22,
        incomeBonus: 22,
        ammoBonus: 5,
        fuelBonus: 5,
      },
      {
        id: 'sec_center_radio',
        name: 'Torre de Rádio da Colina',
        shortName: 'Torre Rádio',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+10 MUN',
        x: 3720,
        y: 4800,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 16,
        incomeBonus: 16,
        ammoBonus: 10,
        fuelBonus: 0,
      },
      {
        id: 'sec_east_radio',
        name: 'Refinaria de Combustível Nordeste',
        shortName: 'Refinaria NE',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+12 COMB',
        x: 6750,
        y: 2920,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 12,
      },
      {
        id: 'sec_east_munitions',
        name: 'Depósito de Munições Sudeste',
        shortName: 'Munições SE',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+12 MUN',
        x: 6750,
        y: 6520,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 12,
        fuelBonus: 0,
      },
      {
        id: 'sec_nw_outpost',
        name: 'Entroncamento Florestal Noroeste',
        shortName: 'Floresta NO',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+18 SUP',
        x: 2150,
        y: 1650,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 18,
        incomeBonus: 18,
        ammoBonus: 4,
        fuelBonus: 4,
      },
      {
        id: 'sec_sw_crossing',
        name: 'Ponte Rural Sudoeste',
        shortName: 'Ponte SO',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+10 COMB',
        x: 2150,
        y: 8050,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 10,
      },
      {
        id: 'sec_ne_ridge',
        name: 'Colina da Artilharia Nordeste',
        shortName: 'Colina NE',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+10 MUN',
        x: 7450,
        y: 1650,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 10,
        fuelBonus: 0,
      },
      {
        id: 'sec_se_depot',
        name: 'Estação Ferroviária Sudeste',
        shortName: 'Estação SE',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+18 SUP',
        x: 7450,
        y: 8050,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 18,
        incomeBonus: 18,
        ammoBonus: 4,
        fuelBonus: 4,
      },
    ];

    // Mais casas e celeiros ao longo das rotas para combate urbano e cobertura
    this.structures.push(
      { id: 'bld_route_nw_house', name: 'Casa da Encruzilhada Noroeste', type: 'farmhouse', x: 2420, y: 1740, w: 86, d: 64, h: 36, angle: 0.05, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 84 },
      { id: 'bld_route_sw_barn', name: 'Celeiro da Ponte Sudoeste', type: 'barn', x: 2440, y: 7860, w: 102, d: 72, h: 42, angle: -0.04, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 94 },
      { id: 'bld_route_ne_house', name: 'Casarão da Colina Nordeste', type: 'farmhouse', x: 7160, y: 1780, w: 88, d: 66, h: 38, angle: -0.05, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 86 },
      { id: 'bld_route_se_warehouse', name: 'Armazém Ferroviário Sudeste', type: 'warehouse', x: 7180, y: 7920, w: 108, d: 74, h: 44, angle: 0.03, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 98 },
      { id: 'bld_mid_west_inn', name: 'Estalagem da Estrada Oeste', type: 'farmhouse', x: 3420, y: 4520, w: 90, d: 68, h: 40, angle: 0.02, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 88 },
      { id: 'bld_mid_east_inn', name: 'Posto da Estrada Leste', type: 'farmhouse', x: 6180, y: 5060, w: 90, d: 68, h: 40, angle: -0.02, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 88 }
    );

    this._addBorderForests(rng);
    this._addPineGroves(rng);
    this._generateBushes(rng);

    this.frontlineSamples = 40;
    this.frontlineX = new Float32Array(this.frontlineSamples).fill(this.size * 0.5);
  }

  _addBorderForests(rng) {
    // Floresta densa nas bordas do mapa para impedir visão do vazio externo
    const step = 190;
    for (let pos = 120; pos <= this.size - 120; pos += step) {
      for (let layer = 0; layer < 2; layer++) {
        const offset = 110 + layer * 165;
        this.trees.push(
          { x: pos + (rng() - 0.5) * 90, y: offset + (rng() - 0.5) * 70, scale: 1.15 + rng() * 0.65, foliageTone: rng() },
          { x: pos + (rng() - 0.5) * 90, y: this.size - offset + (rng() - 0.5) * 70, scale: 1.15 + rng() * 0.65, foliageTone: rng() },
          { x: offset + (rng() - 0.5) * 70, y: pos + (rng() - 0.5) * 90, scale: 1.15 + rng() * 0.65, foliageTone: rng() },
          { x: this.size - offset + (rng() - 0.5) * 70, y: pos + (rng() - 0.5) * 90, scale: 1.15 + rng() * 0.65, foliageTone: rng() }
        );
      }
    }
    this._dedupeTrees(54);
  }

  _addPineGroves(rng) {
    // Bosques densos de 8 a 15 pinheiros altos nas laterais, ao redor de setores e estradas secundárias (longe >= 12m das bases)
    const centers = [];
    for (const sec of this.sectors || []) {
      const ang = rng() * Math.PI * 2;
      centers.push({
        x: clamp(sec.x + Math.cos(ang) * 320, 420, this.size - 420),
        y: clamp(sec.y + Math.sin(ang) * 320, 420, this.size - 420),
      });
    }
    // Bosques laterais (Norte / Sul)
    for (let i = 0; i < 14; i++) {
      const x = 900 + (i / 13) * (this.size - 1800) + (rng() - 0.5) * 240;
      const y = i % 2 === 0 ? 780 + rng() * 680 : this.size - (780 + rng() * 680);
      centers.push({ x, y });
    }
    // Bosques próximos a estradas secundárias
    for (const road of (this.roads || []).slice(1)) {
      const pts = road.points || [];
      if (pts.length >= 2) {
        const p = pts[Math.floor(pts.length * 0.5)];
        const side = rng() > 0.5 ? 1 : -1;
        centers.push({
          x: clamp(p.x + (rng() - 0.5) * 260, 460, this.size - 460),
          y: clamp(p.y + side * (165 + rng() * 95), 460, this.size - 460),
        });
      }
    }

    const hqList = Object.values(this.hqs || {});
    for (const c of centers) {
      const count = 8 + Math.floor(rng() * 8); // 8 a 15 pinheiros por bosque
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = 28 + rng() * 165;
        const tx = clamp(c.x + Math.cos(a) * r, 220, this.size - 220);
        const ty = clamp(c.y + Math.sin(a) * r, 220, this.size - 220);
        if (this.isOnRoad(tx, ty, 38)) continue;
        // Mantém >= 12m (120u) livres ao redor do raio de qualquer prédio/HQ da base
        const tooCloseToHq = hqList.some((hq) => Math.hypot(tx - hq.x, ty - hq.y) < 760);
        if (tooCloseToHq) continue;
        const tooCloseToStruct = (this.structures || []).some(
          (s) => Math.hypot(tx - s.x, ty - s.y) < Math.max(s.w || 80, s.d || 80) + 55
        );
        if (tooCloseToStruct) continue;
        this.trees.push({
          x: tx,
          y: ty,
          scale: 0.92 + rng() * 0.48,
          foliageTone: rng(),
          isPine: true,
        });
      }
    }
    this._dedupeTrees(46);
    this._populateForestZonesAndCover(rng);
    this._ensureBuildingsOffRoadsAndCleared();
  }

  getForestZoneAt(x, y) {
    for (const f of this.forestZones || []) {
      if (Math.hypot(x - f.x, y - f.y) <= f.radius) return f;
    }
    return null;
  }

  _populateForestZonesAndCover(rng) {
    this.forestZones = [];
    const hqList = Object.values(this.hqs || {});
    const isDesert = this.theme === 'desert';
    const isWinter = this.theme === 'winter';

    // 1. Zonas de Floresta Fechada / Oásis (15 a 30 árvores + arbustos para Camuflagem & Emboscada)
    const zoneCandidates = isDesert
      ? [
          { x: 2350, y: 3650, r: 215, name: 'Oásis Avançado Oeste' },
          { x: 3500, y: 2900, r: 240, name: 'Oásis Norte' },
          { x: 6100, y: 6700, r: 245, name: 'Oásis Sul' },
          { x: 2500, y: 6900, r: 195, name: 'Bosque Árido Oeste' },
          { x: 7100, y: 2700, r: 195, name: 'Bosque Árido Leste' },
        ]
      : [
          { x: 2180, y: 3650, r: 215, name: 'Bosque da Vanguarda' },
          { x: 2420, y: 5250, r: 215, name: 'Mata do Flanco Sul' },
          { x: 2650, y: 2400, r: 230, name: 'Bosque Noroeste' },
          { x: 4800, y: 2150, r: 245, name: 'Mata Norte' },
          { x: 6950, y: 2400, r: 230, name: 'Bosque Nordeste' },
          { x: 3350, y: 4100, r: 215, name: 'Mata Central Oeste' },
          { x: 6250, y: 5500, r: 215, name: 'Mata Central Leste' },
          { x: 2650, y: 7200, r: 235, name: 'Bosque Sudoeste' },
          { x: 4800, y: 7450, r: 245, name: 'Mata Sul' },
          { x: 6950, y: 7200, r: 235, name: 'Bosque Sudeste' },
          { x: 3800, y: 5850, r: 210, name: 'Bosque da Emboscada O' },
          { x: 5800, y: 3750, r: 210, name: 'Bosque da Emboscada L' },
        ];

    for (let zi = 0; zi < zoneCandidates.length; zi++) {
      const zc = zoneCandidates[zi];
      if (this.isOnRoad(zc.x, zc.y, 85)) continue;
      if (hqList.some((hq) => Math.hypot(zc.x - hq.x, zc.y - hq.y) < 760)) continue;
      this.forestZones.push({
        id: `forest_${zi}`,
        x: zc.x,
        y: zc.y,
        radius: zc.r,
        name: zc.name,
      });

      const treeCount = isDesert ? 22 : isWinter ? 26 : 20;
      for (let i = 0; i < treeCount; i++) {
        const a = rng() * Math.PI * 2;
        const r = 18 + rng() * (zc.r - 22);
        const tx = clamp(zc.x + Math.cos(a) * r, 240, this.size - 240);
        const ty = clamp(zc.y + Math.sin(a) * r, 240, this.size - 240);
        if (this.isOnRoad(tx, ty, 36)) continue;
        this.trees.push({
          x: tx,
          y: ty,
          scale: 0.95 + rng() * 0.45,
          foliageTone: rng(),
          isPine: !isDesert,
          isPalm: isDesert,
        });
      }
      for (let b = 0; b < 10; b++) {
        const a = rng() * Math.PI * 2;
        const r = 15 + rng() * (zc.r - 18);
        const bx = clamp(zc.x + Math.cos(a) * r, 240, this.size - 240);
        const by = clamp(zc.y + Math.sin(a) * r, 240, this.size - 240);
        if (!this.isOnRoad(bx, by, 28)) {
          this.bushes.push({ x: bx, y: by, radius: 18 + rng() * 12 });
        }
      }
    }

    // 2. Muros Quebrados ("L", "U" e Retos), Ruínas Abertas, Cemitérios e Comboios Destruídos
    const addStoneSeg = (x1, y1, x2, y2) => {
      if (this.isOnRoad(x1, y1, 24) || this.isOnRoad(x2, y2, 24)) return;
      this.stoneWalls.push({
        id: `tac_wall_${this.stoneWalls.length}`,
        x1,
        y1,
        x2,
        y2,
        thickness: 18,
      });
    };

    const tacticalSpots = [
      { x: 2400, y: 3600 },
      { x: 3550, y: 3300 },
      { x: 4300, y: 3900 },
      { x: 5300, y: 3900 },
      { x: 6050, y: 3300 },
      { x: 7200, y: 3600 },
      { x: 2400, y: 6000 },
      { x: 3550, y: 6300 },
      { x: 4300, y: 5700 },
      { x: 5300, y: 5700 },
      { x: 6050, y: 6300 },
      { x: 7200, y: 6000 },
      { x: 4050, y: 4800 },
      { x: 5550, y: 4800 },
    ];

    tacticalSpots.forEach((sp, idx) => {
      if (this.isOnRoad(sp.x, sp.y, 90)) return;
      if (hqList.some((hq) => Math.hypot(sp.x - hq.x, sp.y - hq.y) < 720)) return;
      const pattern = idx % 4;
      if (pattern === 0) {
        // Muro Quebrado em "L" com brecha
        addStoneSeg(sp.x - 65, sp.y - 45, sp.x + 25, sp.y - 45);
        addStoneSeg(sp.x - 65, sp.y - 45, sp.x - 65, sp.y + 45);
      } else if (pattern === 1) {
        // Ruína Aberta (4 paredes baixas com entradas nos lados)
        addStoneSeg(sp.x - 55, sp.y - 50, sp.x + 55, sp.y - 50);
        addStoneSeg(sp.x - 55, sp.y + 50, sp.x + 55, sp.y + 50);
        addStoneSeg(sp.x - 55, sp.y - 50, sp.x - 55, sp.y - 12);
        addStoneSeg(sp.x + 55, sp.y + 12, sp.x + 55, sp.y + 50);
      } else if (pattern === 2) {
        // Muro em "U" (Cemitério Rural / Posição Defensiva)
        addStoneSeg(sp.x - 55, sp.y - 40, sp.x + 55, sp.y - 40);
        addStoneSeg(sp.x - 55, sp.y - 40, sp.x - 55, sp.y + 35);
        addStoneSeg(sp.x + 55, sp.y - 40, sp.x + 55, sp.y + 35);
      } else {
        // Comboio Militar Destruído na beira do caminho + Crateras
        this.wrecks.push(
          { id: `conv_wrk_a_${idx}`, type: 'truck', x: sp.x - 36, y: sp.y, angle: 0.25, smoke: true, radius: 52, colRadius: 26, name: 'Caminhão do Comboio' },
          { id: `conv_wrk_b_${idx}`, type: 'tank', x: sp.x + 42, y: sp.y + 18, angle: -0.35, smoke: false, radius: 56, colRadius: 28, name: 'Blindado Destruído' }
        );
      }
    });

    // 3. Marcos Arquitetônicos Exclusivos + Complexos Cercados ao Redor de Todos os Setores (25–38 Prédios Grandes)
    this.cemeteryProps = this.cemeteryProps || [];
    this.checkpointProps = this.checkpointProps || [];
    this.cemeteryProps.push({ x: 3250, y: 5350 }, { x: 6350, y: 4250 });
    this.checkpointProps.push({ x: 2950, y: 4660 }, { x: 6650, y: 4940 });
    addStoneSeg(3190, 5290, 3310, 5290);
    addStoneSeg(3190, 5290, 3190, 5410);
    addStoneSeg(3310, 5290, 3310, 5410);

    // Linha Férrea e Pátio Ferroviário cortando o mapa próximo aos pontos estratégicos
    this.railways = [
      {
        y: isDesert ? 3120 : 3020,
        xStart: 500,
        xEnd: 9100,
        yardX: 4800,
      },
    ];

    const addStructureSafe = (st) => {
      if (this.isOnRoad(st.x, st.y, 72)) return false;
      if (hqList.some((hq) => Math.hypot(st.x - hq.x, st.y - hq.y) < 700)) return false;
      const tooClose = (this.structures || []).some(
        (other) => Math.hypot(st.x - other.x, st.y - other.y) < 190
      );
      if (tooClose) return false;
      this.structures.push(st);
      return true;
    };

    // Gera Complexos Cercados (2 Prédios Grandes + Muros em L/U) ao redor de TODOS os 12 Pontos de Captura
    (this.sectors || []).forEach((sec, sIdx) => {
      const typesForTheme = isDesert
        ? ['adobe_house', 'adobe_house', 'oil_refinery', 'column_ruins']
        : isWinter
        ? ['two_story', 'warehouse', 'brick_ruin', 'bunker']
        : ['two_story', 'warehouse', 'brick_ruin', 'barn'];

      for (const side of [-1, 1]) {
        const bx = clamp(sec.x + side * (165 + (sIdx % 3) * 20), 420, this.size - 420);
        const by = clamp(sec.y + (side > 0 ? -155 : 155), 420, this.size - 420);
        const bType = typesForTheme[(sIdx + (side > 0 ? 1 : 0)) % typesForTheme.length];
        const added = addStructureSafe({
          id: `sec_comp_${sec.id}_${side > 0 ? 'a' : 'b'}`,
          name: isDesert ? 'Complexo de Adobe' : bType === 'brick_ruin' ? 'Ruína de Tijolo' : 'Edifício do Setor',
          type: bType,
          x: bx,
          y: by,
          w: bType === 'warehouse' ? 142 : 112,
          d: bType === 'warehouse' ? 102 : 88,
          h: bType === 'two_story' ? 62 : 48,
          angle: side * 0.14,
          garrisonable: bType !== 'column_ruins',
          garrisonUnitId: null,
          garrisonTeam: null,
          coverRadius: 112,
        });
        if (added) {
          // Muros de pátio em "L" conectando o lote
          addStoneSeg(bx - 75, by + 62, bx + 65, by + 62);
          addStoneSeg(bx - 75, by - 55, bx - 75, by + 62);
        }
      }
    });

    if (isDesert) {
      const desertVillages = [
        { id: 'des_adobe_1', name: 'Vila Árabe Norte', type: 'adobe_house', x: 3820, y: 2450, w: 118, d: 94, h: 52, angle: 0.1 },
        { id: 'des_adobe_2', name: 'Vila Árabe Sul', type: 'adobe_house', x: 5780, y: 7150, w: 122, d: 98, h: 54, angle: -0.2 },
        { id: 'des_adobe_3', name: 'Casa de Arenito Oeste', type: 'adobe_house', x: 2550, y: 4250, w: 112, d: 90, h: 50, angle: 0.05 },
        { id: 'des_adobe_4', name: 'Casa de Arenito Leste', type: 'adobe_house', x: 7050, y: 5350, w: 112, d: 90, h: 50, angle: -0.05 },
        { id: 'des_refinery', name: 'Complexo de Refinaria', type: 'oil_refinery', x: 4800, y: 3180, w: 156, d: 116, h: 58, angle: 0 },
        { id: 'des_columns', name: 'Ruínas de Colunas Antigas', type: 'column_ruins', x: 4800, y: 6450, w: 130, d: 108, h: 52, angle: 0.15 },
      ];
      for (const dv of desertVillages) {
        addStructureSafe({ ...dv, garrisonable: dv.type !== 'column_ruins', garrisonUnitId: null, garrisonTeam: null, coverRadius: 115 });
      }
    } else if (isWinter) {
      const winterLandmarks = [
        { id: 'win_sawmill', name: 'Serraria Abandonada', type: 'sawmill', x: 3600, y: 3450, w: 144, d: 102, h: 52, angle: 0.08 },
        { id: 'win_bunker_1', name: 'Bunker Linha Siegfried N', type: 'bunker', x: 5900, y: 3350, w: 108, d: 92, h: 40, angle: -0.2 },
        { id: 'win_bunker_2', name: 'Bunker Linha Siegfried S', type: 'bunker', x: 5900, y: 6250, w: 108, d: 92, h: 40, angle: 0.2 },
        { id: 'win_bunker_3', name: 'Bunker Avançado Oeste', type: 'bunker', x: 2680, y: 4280, w: 106, d: 90, h: 40, angle: 0.1 },
        { id: 'win_chalet_1', name: 'Chalé Nevado Oeste', type: 'two_story', x: 2450, y: 5650, w: 110, d: 88, h: 56, angle: -0.1 },
      ];
      for (const wl of winterLandmarks) {
        addStructureSafe({ ...wl, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 110 });
      }
    } else {
      const normandyFarms = [
        { id: 'norm_farm_1', name: 'Fazenda da Vanguarda', type: 'barn', x: 2480, y: 3920, w: 128, d: 96, h: 52, angle: 0.12 },
        { id: 'norm_farm_2', name: 'Fazenda do Sul', type: 'barn', x: 3950, y: 6550, w: 132, d: 98, h: 52, angle: -0.08 },
        { id: 'norm_farm_3', name: 'Fazenda Leste', type: 'barn', x: 6650, y: 3150, w: 132, d: 98, h: 52, angle: 0.05 },
      ];
      for (const nf of normandyFarms) {
        addStructureSafe({ ...nf, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 112 });
      }
    }

    // 4. Prédios Extras e Muros Mais Altos nos Quarteirões (sem alterar nenhuma construção existente)
    const addTallWall = (x1, y1, x2, y2, height = 21, type = 'stone') => {
      if (this.isOnRoad(x1, y1, 24) || this.isOnRoad(x2, y2, 24)) return;
      this.stoneWalls.push({
        id: `tall_wall_${this.stoneWalls.length}`,
        x1,
        y1,
        x2,
        y2,
        thickness: 18,
        height,
        type,
      });
    };

    const extraBlocks = [
      { x: 2620, y: 4050 },
      { x: 3420, y: 5450 },
      { x: 4320, y: 3650 },
      { x: 5280, y: 5950 },
      { x: 6180, y: 4050 },
      { x: 6980, y: 5550 },
      { x: 4120, y: 2650 },
      { x: 5480, y: 6950 },
    ];
    extraBlocks.forEach((blk, idx) => {
      const bType = isDesert
        ? 'adobe_house'
        : idx % 3 === 0
        ? 'two_story'
        : idx % 3 === 1
        ? 'warehouse'
        : 'brick_ruin';
      const added = addStructureSafe({
        id: `extra_blk_bld_${idx}`,
        name: isDesert ? 'Sobrado de Adobe' : bType === 'warehouse' ? 'Galpão do Quarteirão' : 'Prédio do Quarteirão',
        type: bType,
        x: blk.x,
        y: blk.y,
        w: bType === 'warehouse' ? 148 : 118,
        d: bType === 'warehouse' ? 104 : 92,
        h: bType === 'two_story' ? 66 : 52,
        angle: (idx % 2 === 0 ? 1 : -1) * 0.08,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 114,
      });
      if (added) {
        const wType = isDesert ? 'stone' : idx % 2 === 0 ? 'brick' : 'stone';
        addTallWall(blk.x - 98, blk.y - 72, blk.x + 98, blk.y - 72, 22, wType);
        addTallWall(blk.x - 98, blk.y - 72, blk.x - 98, blk.y + 68, 22, wType);
        addTallWall(blk.x + 98, blk.y - 20, blk.x + 98, blk.y + 72, 20, wType);
      }
    });
  }

  clearFoliageAndFlattenUnderBuilding(x, z, radius = 140) {
    if (!this.flattenedPads) this.flattenedPads = [];
    this.flattenedPads.push({ x, y: z, radius });
    const clearR = radius + 35;
    if (this.trees) {
      this.trees = this.trees.filter((t) => Math.hypot(t.x - x, t.y - z) > clearR);
    }
    if (this.bushes) {
      this.bushes = this.bushes.filter((b) => Math.hypot(b.x - x, b.y - z) > clearR);
    }
  }

  _ensureBuildingsOffRoadsAndCleared() {
    this.flattenedPads = [];
    for (const hq of Object.values(this.hqs || {})) {
      if (!hq) continue;
      for (let step = 0; step < 12; step++) {
        if (!this.isOnRoad(hq.x, hq.y, 140)) break;
        hq.y = clamp(hq.y - 120, 320, this.size - 320);
      }
      this.clearFoliageAndFlattenUnderBuilding(hq.x, hq.y, 210);
    }
    for (const st of this.structures || []) {
      const r = Math.max(st.w || 80, st.d || 80) * 0.65;
      for (let step = 0; step < 8; step++) {
        if (!this.isOnRoad(st.x, st.y, 140)) break;
        st.y = clamp(st.y + (st.y < this.size * 0.5 ? -95 : 95), 240, this.size - 240);
      }
      this.clearFoliageAndFlattenUnderBuilding(st.x, st.y, r + 24);
    }
  }

  isLineBlockedByStructures(x1, y1, x2, y2, ignoreStructureId = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) return false;
    const minX = Math.min(x1, x2) - 120;
    const maxX = Math.max(x1, x2) + 120;
    const minY = Math.min(y1, y2) - 120;
    const maxY = Math.max(y1, y2) + 120;
    for (const st of this.structures || []) {
      if (st.id === ignoreStructureId) continue;
      if (st.x < minX || st.x > maxX || st.y < minY || st.y > maxY) continue;
      const t = clamp(((st.x - x1) * dx + (st.y - y1) * dy) / lenSq, 0.05, 0.95);
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const hw = (st.w || 70) * 0.48;
      const hd = (st.d || 60) * 0.48;
      if (Math.abs(px - st.x) < hw && Math.abs(py - st.y) < hd) {
        return true;
      }
    }
    return false;
  }

  _dedupeTrees(minDist = 54) {
    const kept = [];
    const minSq = minDist * minDist;
    for (const t of this.trees) {
      let ok = true;
      for (let i = kept.length - 1; i >= Math.max(0, kept.length - 45); i--) {
        const dx = t.x - kept[i].x;
        const dy = t.y - kept[i].y;
        if (dx * dx + dy * dy < minSq) {
          ok = false;
          break;
        }
      }
      if (ok) kept.push(t);
    }
    this.trees = kept;
  }

  _generateBushes(rng) {
    this.bushes = [];
    // Arbustos densos nas bordas de estradas, campos, crateras e cercas (para cobertura + camuflagem)
    for (let i = 0; i < 240; i++) {
      let bx, by;
      if (i < 75 && this.craters?.length > 0) {
        const cr = this.craters[i % this.craters.length];
        const a = rng() * Math.PI * 2;
        bx = cr.x + Math.cos(a) * (cr.radius + 22);
        by = cr.y + Math.sin(a) * (cr.radius + 22);
      } else if (i < 155 && this.fields?.length > 0) {
        const f = this.fields[i % this.fields.length];
        const side = i % 2 === 0;
        bx = side ? f.x + rng() * f.w : f.x + (i % 4 === 1 ? 12 : f.w - 12);
        by = side ? f.y + (i % 4 === 0 ? 12 : f.h - 12) : f.y + rng() * f.h;
      } else {
        bx = 650 + rng() * (this.size - 1300);
        by = 650 + rng() * (this.size - 1300);
      }
      this.bushes.push({
        x: clamp(bx, 300, this.size - 300),
        y: clamp(by, 300, this.size - 300),
        scale: 0.85 + rng() * 0.65,
        radius: 26,
      });
    }
  }

  hasBushCover(x, y) {
    for (let i = 0; i < this.bushes.length; i++) {
      const b = this.bushes[i];
      if (Math.abs(x - b.x) < 36 && Math.abs(y - b.y) < 36) {
        if (dist(x, y, b.x, b.y) <= 34) return true;
      }
    }
    return false;
  }

  _buildWinterMap(rng) {
    // 1. Campos Nevados, Lago Congelado & Lama Gelada (Bastogne / Ardenas)
    this.fields = [
      { x: 650, y: 700, w: 2500, h: 1900, type: 'snow_field', angle: 0.05, name: 'Bosque Nevado Noroeste' },
      { x: 3500, y: 650, w: 2600, h: 1800, type: 'frozen_mud', angle: -0.04, name: 'Estrada Congelada Norte' },
      { x: 6450, y: 750, w: 2450, h: 1900, type: 'snow_field', angle: 0.03, name: 'Colina Nevada Nordeste' },
      { x: 700, y: 3400, w: 2300, h: 2700, type: 'snow_field', angle: 0.0, name: 'Floresta das Ardenas Oeste' },
      { x: 3650, y: 3550, w: 2300, h: 2450, type: 'ice_lake', angle: 0.0, name: 'Praça & Lago Congelado de Bastogne' },
      { x: 6600, y: 3400, w: 2300, h: 2700, type: 'frozen_mud', angle: -0.02, name: 'Terreno Bombardeado Leste' },
      { x: 650, y: 6900, w: 2550, h: 1950, type: 'snow_field', angle: -0.05, name: 'Vale Nevado Sudoeste' },
      { x: 3550, y: 7000, w: 2500, h: 1900, type: 'frozen_mud', angle: 0.03, name: 'Passagem Sul' },
      { x: 6450, y: 6850, w: 2500, h: 2000, type: 'snow_field', angle: 0.02, name: 'Pinhal Sudeste' },
    ];

    // 2. Estradas de Inverno
    this.roads = [
      {
        points: [
          { x: 200, y: 4800 },
          { x: 2450, y: 4680 },
          { x: 4800, y: 4800 },
          { x: 7150, y: 4920 },
          { x: 9400, y: 4800 },
        ],
        width: 118,
      },
      {
        points: [
          { x: 400, y: 2000 },
          { x: 3100, y: 1850 },
          { x: 4800, y: 1800 },
          { x: 6500, y: 1900 },
          { x: 9200, y: 2050 },
        ],
        width: 96,
      },
      {
        points: [
          { x: 400, y: 7650 },
          { x: 3000, y: 7850 },
          { x: 4800, y: 7900 },
          { x: 6600, y: 7800 },
          { x: 9200, y: 7600 },
        ],
        width: 96,
      },
      {
        points: [
          { x: 4800, y: 250 },
          { x: 4800, y: 1800 },
          { x: 4800, y: 4800 },
          { x: 4800, y: 7900 },
          { x: 4800, y: 9350 },
        ],
        width: 98,
      },
      {
        points: [
          { x: 2800, y: 600 },
          { x: 2750, y: 4680 },
          { x: 2850, y: 9000 },
        ],
        width: 82,
      },
      {
        points: [
          { x: 6800, y: 600 },
          { x: 6850, y: 4920 },
          { x: 6750, y: 9000 },
        ],
        width: 82,
      },
    ];

    // 3. Pinheiros Nevados Densos
    this.treelines = [];
    this.trees = [];
    const addPineLine = (x1, y1, x2, y2, density = 20) => {
      this.treelines.push({ x1, y1, x2, y2, radius: 75 });
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const count = Math.max(8, Math.floor((len / 950) * density * 2.4));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        this.trees.push({
          x: x1 + dx * t + (rng() - 0.5) * 65,
          y: y1 + dy * t + (rng() - 0.5) * 65,
          scale: 0.92 + rng() * 0.65,
          foliageTone: rng(),
        });
      }
    };

    addPineLine(3100, 750, 3100, 2550, 20);
    addPineLine(6450, 750, 6450, 2550, 20);
    addPineLine(3050, 3150, 3050, 4400, 18);
    addPineLine(3050, 5150, 3050, 6350, 18);
    addPineLine(6550, 3150, 6550, 4450, 18);
    addPineLine(6550, 5200, 6550, 6350, 18);
    addPineLine(3150, 7000, 3150, 8850, 20);
    addPineLine(6450, 7000, 6450, 8850, 20);
    addPineLine(1450, 2850, 2550, 2850, 16);
    addPineLine(7000, 2850, 8200, 2850, 16);
    addPineLine(1450, 6750, 2550, 6750, 16);
    addPineLine(7000, 6750, 8200, 6750, 16);

    // 4. Crateras de Gelo
    this.craters = [];
    for (let i = 0; i < 80; i++) {
      this.craters.push({
        x: 1700 + rng() * 6200,
        y: 650 + rng() * 8300,
        radius: 36 + rng() * 64,
      });
    }

    // 5. Construções Congeladas e Ruínas de Inverno
    this.structures = [
      { id: 'win_north_church', name: 'Capela Congelada Norte', type: 'church', x: 4540, y: 1720, w: 102, d: 72, h: 58, angle: 0.04, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 96 },
      { id: 'win_north_ruin', name: 'Ruínas da Serraria Norte', type: 'ruin', x: 5140, y: 1960, w: 96, d: 72, h: 32, angle: -0.05, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 90 },
      { id: 'win_center_town', name: 'Prefeitura de Bastogne', type: 'two_story', x: 4520, y: 4540, w: 100, d: 74, h: 56, angle: 0.02, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 94 },
      { id: 'win_center_ruin', name: 'Galpão Bombardeado Central', type: 'ruin', x: 5100, y: 5040, w: 98, d: 72, h: 30, angle: -0.04, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 92 },
      { id: 'win_south_barn', name: 'Celeiro Nevado Sul', type: 'barn', x: 4560, y: 7820, w: 108, d: 76, h: 42, angle: 0.03, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 98 },
      { id: 'win_west_depot', name: 'Estação Ferroviária Oeste', type: 'warehouse', x: 2740, y: 2650, w: 106, d: 74, h: 42, angle: 0.04, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 95 },
      { id: 'win_east_house', name: 'Casa da Guarda Leste', type: 'farmhouse', x: 6860, y: 6980, w: 88, d: 66, h: 36, angle: -0.05, garrisonable: true, garrisonUnitId: null, garrisonTeam: null, coverRadius: 86 },
    ];

    this.stoneWalls = [
      { id: 'wwall_1', x1: 4320, y1: 4620, x2: 4320, y2: 4960, type: 'stone', thickness: 18 },
      { id: 'wwall_2', x1: 5280, y1: 4620, x2: 5280, y2: 4960, type: 'stone', thickness: 18 },
      { id: 'wwall_3', x1: 4620, y1: 4380, x2: 4980, y2: 4380, type: 'brick', thickness: 18 },
      { id: 'wwall_4', x1: 4620, y1: 5220, x2: 4980, y2: 5220, type: 'brick', thickness: 18 },
      { id: 'wwall_5', x1: 4380, y1: 1700, x2: 4380, y2: 1980, type: 'stone', thickness: 18 },
      { id: 'wwall_6', x1: 5260, y1: 7700, x2: 5260, y2: 8000, type: 'stone', thickness: 18 },
    ];

    this.wrecks = [
      { id: 'wwrk_1', type: 'tank', x: 3880, y: 4740, angle: 0.3, smoke: true, radius: 56, colRadius: 30, name: 'Sherman Congelado' },
      { id: 'wwrk_2', type: 'tank', x: 5720, y: 4860, angle: -2.4, smoke: true, radius: 56, colRadius: 30, name: 'Panther Destruído' },
      { id: 'wwrk_3', type: 'truck', x: 3560, y: 1880, angle: 0.2, smoke: true, radius: 54, colRadius: 28, name: 'Caminhão na Neve' },
      { id: 'wwrk_4', type: 'truck', x: 6040, y: 7800, angle: 2.6, smoke: true, radius: 54, colRadius: 28, name: 'Comboio de Inverno' },
    ];

    this.hqs = {
      player: { x: 1150, y: 4800, team: 'allies', faction: 'player', name: 'QG 101ª Aerotransportada' },
      ally_ai: { x: 1250, y: 7400, team: 'allies', faction: 'ally_ai', name: 'QG 4ª Divisão Blindada' },
      enemy_1: { x: 8450, y: 4800, team: 'enemies', faction: 'enemy_1', name: 'QG 5º Exército Panzer' },
      enemy_2: { x: 8350, y: 2200, team: 'enemies', faction: 'enemy_2', name: 'QG Volksgrenadier Norte' },
    };

    this.sectors = [
      { id: 'sec_win_west_ammo', name: 'Depósito Ferroviário Oeste', shortName: 'Ferrovia O', type: 'ammo', resourceType: 'ammo', shortLabel: '+12 MUN', x: 2800, y: 2620, radius: 155, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 12, fuelBonus: 0 },
      { id: 'sec_win_sw_fuel', name: 'Comboio de Combustível SO', shortName: 'Combust. SO', type: 'fuel', resourceType: 'fuel', shortLabel: '+12 COMB', x: 2800, y: 7000, radius: 155, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 0, fuelBonus: 12 },
      { id: 'sec_win_north_chapel', name: 'Setor Alfa (Capela Norte)', shortName: 'Capela N', type: 'supplies', resourceType: 'supplies', shortLabel: '+22 SUP', x: 4800, y: 1800, radius: 165, owner: 'neutral', captureProgress: 0, supplyBonus: 22, incomeBonus: 22, ammoBonus: 5, fuelBonus: 5 },
      { id: 'sec_win_center', name: 'Setor Bravo (Bastogne Centro)', shortName: 'Bastogne', type: 'strategic', resourceType: 'strategic', shortLabel: '+32 SUP', x: 4800, y: 4800, radius: 180, owner: 'neutral', captureProgress: 0, supplyBonus: 32, incomeBonus: 32, ammoBonus: 8, fuelBonus: 8 },
      { id: 'sec_win_south_barn', name: 'Setor Charlie (Celeiro Sul)', shortName: 'Celeiro S', type: 'supplies', resourceType: 'supplies', shortLabel: '+22 SUP', x: 4800, y: 7850, radius: 165, owner: 'neutral', captureProgress: 0, supplyBonus: 22, incomeBonus: 22, ammoBonus: 5, fuelBonus: 5 },
      { id: 'sec_win_west_road', name: 'Bloqueio Rodoviário Oeste', shortName: 'Bloqueio O', type: 'ammo', resourceType: 'ammo', shortLabel: '+10 MUN', x: 3550, y: 4800, radius: 150, owner: 'neutral', captureProgress: 0, supplyBonus: 16, incomeBonus: 16, ammoBonus: 10, fuelBonus: 0 },
      { id: 'sec_win_ne_fuel', name: 'Depósito de Diesel NE', shortName: 'Diesel NE', type: 'fuel', resourceType: 'fuel', shortLabel: '+12 COMB', x: 6800, y: 2620, radius: 155, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 0, fuelBonus: 12 },
      { id: 'sec_win_se_ammo', name: 'Paiol das Ardenas SE', shortName: 'Paiol SE', type: 'ammo', resourceType: 'ammo', shortLabel: '+12 MUN', x: 6800, y: 7000, radius: 155, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 12, fuelBonus: 0 },
      { id: 'sec_win_nw_woods', name: 'Bosque Congelado NO', shortName: 'Bosque NO', type: 'supplies', resourceType: 'supplies', shortLabel: '+18 SUP', x: 2100, y: 1750, radius: 150, owner: 'neutral', captureProgress: 0, supplyBonus: 18, incomeBonus: 18, ammoBonus: 4, fuelBonus: 4 },
      { id: 'sec_win_sw_pass', name: 'Ponte Congelada SO', shortName: 'Ponte SO', type: 'fuel', resourceType: 'fuel', shortLabel: '+10 COMB', x: 2100, y: 7900, radius: 150, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 0, fuelBonus: 10 },
      { id: 'sec_win_ne_ridge', name: 'Bateria Nevada NE', shortName: 'Bateria NE', type: 'ammo', resourceType: 'ammo', shortLabel: '+10 MUN', x: 7500, y: 1750, radius: 150, owner: 'neutral', captureProgress: 0, supplyBonus: 14, incomeBonus: 14, ammoBonus: 10, fuelBonus: 0 },
      { id: 'sec_win_se_depot', name: 'Guarnição Sul-Leste', shortName: 'Guarnição SE', type: 'supplies', resourceType: 'supplies', shortLabel: '+18 SUP', x: 7500, y: 7900, radius: 150, owner: 'neutral', captureProgress: 0, supplyBonus: 18, incomeBonus: 18, ammoBonus: 4, fuelBonus: 4 },
    ];

    this._addBorderForests(rng);
    this._addPineGroves(rng);
  }

  _buildDesertMap(rng) {
    // 1. Regiões Desérticas (Dunas, Platôs Rochosos, Leito Seco / Wadi e Oásis)
    this.fields = [
      { x: 600, y: 700, w: 2600, h: 1900, type: 'dune', angle: 0.08, name: 'Dunas Noroeste' },
      { x: 3500, y: 650, w: 2600, h: 1700, type: 'rock', angle: -0.05, name: 'Platô da Refinaria Norte' },
      { x: 6400, y: 800, w: 2500, h: 1850, type: 'dune', angle: 0.04, name: 'Campo de Dunas Nordeste' },
      { x: 750, y: 3400, w: 2300, h: 2700, type: 'rock', angle: 0.02, name: 'Desfiladeiro Rochoso Oeste' },
      { x: 3650, y: 3600, w: 2300, h: 2400, type: 'oasis', angle: 0.0, name: 'Bacia do Oásis Central' },
      { x: 6550, y: 3400, w: 2300, h: 2700, type: 'rock', angle: -0.03, name: 'Crista Rochosa Leste' },
      { x: 650, y: 6900, w: 2600, h: 2000, type: 'dune', angle: -0.06, name: 'Mar de Areia Sudoeste' },
      { x: 3550, y: 7000, w: 2500, h: 1950, type: 'wadi', angle: 0.03, name: 'Leito Seco do Wadi Sul' },
      { x: 6400, y: 6850, w: 2550, h: 2050, type: 'dune', angle: -0.04, name: 'Dunas Sudeste' },
    ];

    // 2. Rodovia Costeira Central e Trilhas de Comboio no Deserto
    this.roads = [
      {
        points: [
          { x: 200, y: 4800 },
          { x: 2400, y: 4650 },
          { x: 4800, y: 4800 },
          { x: 7200, y: 4950 },
          { x: 9400, y: 4800 },
        ],
        width: 125,
      },
      {
        points: [
          { x: 400, y: 2100 },
          { x: 3100, y: 1850 },
          { x: 4800, y: 1750 },
          { x: 6500, y: 1880 },
          { x: 9200, y: 2150 },
        ],
        width: 96,
      },
      {
        points: [
          { x: 400, y: 7600 },
          { x: 3000, y: 7850 },
          { x: 4800, y: 7950 },
          { x: 6600, y: 7820 },
          { x: 9200, y: 7550 },
        ],
        width: 96,
      },
      {
        points: [
          { x: 4800, y: 250 },
          { x: 4800, y: 1750 },
          { x: 4800, y: 4800 },
          { x: 4800, y: 7950 },
          { x: 4800, y: 9350 },
        ],
        width: 100,
      },
      {
        points: [
          { x: 2800, y: 600 },
          { x: 2700, y: 4650 },
          { x: 2850, y: 9000 },
        ],
        width: 82,
      },
      {
        points: [
          { x: 6800, y: 600 },
          { x: 6900, y: 4950 },
          { x: 6750, y: 9000 },
        ],
        width: 82,
      },
    ];

    // 3. Palmeiras do Oásis e Arbustos Secos do Deserto
    this.treelines = [];
    this.trees = [];
    const addPalmLine = (x1, y1, x2, y2, density = 14) => {
      this.treelines.push({ x1, y1, x2, y2, radius: 68 });
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const count = Math.max(4, Math.floor((len / 950) * density));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        this.trees.push({
          x: x1 + dx * t + (rng() - 0.5) * 55,
          y: y1 + dy * t + (rng() - 0.5) * 55,
          scale: 0.95 + rng() * 0.55,
          foliageTone: rng(),
        });
      }
    };

    addPalmLine(4280, 4220, 5320, 4220, 14);
    addPalmLine(4280, 5380, 5320, 5380, 14);
    addPalmLine(4220, 4300, 4220, 5300, 12);
    addPalmLine(5380, 4300, 5380, 5300, 12);
    addPalmLine(2600, 2950, 3150, 2950, 10);
    addPalmLine(6450, 6650, 7000, 6650, 10);
    addPalmLine(2600, 6650, 3150, 6650, 10);
    addPalmLine(6450, 2950, 7000, 2950, 10);

    // 4. Crateras de Bombardeio na Areia
    this.craters = [];
    for (let i = 0; i < 70; i++) {
      this.craters.push({
        x: 1600 + rng() * 6400,
        y: 650 + rng() * 8300,
        radius: 38 + rng() * 68,
      });
    }

    // 5. Construções do Teatro Desértico (Guarnição +75% Def)
    this.structures = [
      {
        id: 'des_north_refinery',
        name: 'Estação de Bombeamento Norte',
        type: 'warehouse',
        x: 4520,
        y: 1620,
        w: 112,
        d: 76,
        h: 44,
        angle: 0.02,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 100,
      },
      {
        id: 'des_north_tower',
        name: 'Torre de Observação do Platô',
        type: 'church',
        x: 5140,
        y: 1840,
        w: 88,
        d: 72,
        h: 58,
        angle: -0.05,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 92,
      },
      {
        id: 'des_oasis_fort',
        name: 'Forte Antigo do Oásis',
        type: 'ruin',
        x: 4480,
        y: 4540,
        w: 104,
        d: 78,
        h: 36,
        angle: 0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 96,
      },
      {
        id: 'des_oasis_depot',
        name: 'Posto de Abastecimento do Oásis',
        type: 'gas_station',
        x: 5140,
        y: 5040,
        w: 96,
        d: 68,
        h: 34,
        angle: -0.04,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 88,
      },
      {
        id: 'des_south_hangar',
        name: 'Hangar Avançado do Wadi',
        type: 'barn',
        x: 4540,
        y: 7840,
        w: 112,
        d: 80,
        h: 44,
        angle: 0.03,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 100,
      },
      {
        id: 'des_west_depot',
        name: 'Depósito Ferroviário Oeste',
        type: 'warehouse',
        x: 2740,
        y: 2560,
        w: 106,
        d: 74,
        h: 40,
        angle: 0.05,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 95,
      },
      {
        id: 'des_east_bunkerhouse',
        name: 'Casamata de Arenito Leste',
        type: 'ruin',
        x: 6860,
        y: 7020,
        w: 96,
        d: 72,
        h: 34,
        angle: -0.06,
        garrisonable: true,
        garrisonUnitId: null,
        garrisonTeam: null,
        coverRadius: 90,
      },
    ];

    // 6. Muros de Arenito e Perímetros de Cobertura Pesada
    this.stoneWalls = [
      { id: 'dwall_1', x1: 4320, y1: 4620, x2: 4320, y2: 4960, type: 'stone', thickness: 18 },
      { id: 'dwall_2', x1: 5280, y1: 4620, x2: 5280, y2: 4960, type: 'stone', thickness: 18 },
      { id: 'dwall_3', x1: 4620, y1: 4360, x2: 4980, y2: 4360, type: 'stone', thickness: 18 },
      { id: 'dwall_4', x1: 4620, y1: 5240, x2: 4980, y2: 5240, type: 'stone', thickness: 18 },
      { id: 'dwall_5', x1: 4380, y1: 1680, x2: 4380, y2: 1980, type: 'stone', thickness: 18 },
      { id: 'dwall_6', x1: 5240, y1: 1680, x2: 5240, y2: 1980, type: 'stone', thickness: 18 },
      { id: 'dwall_7', x1: 4380, y1: 7740, x2: 4380, y2: 8040, type: 'stone', thickness: 18 },
      { id: 'dwall_8', x1: 5240, y1: 7740, x2: 5240, y2: 8040, type: 'stone', thickness: 18 },
      { id: 'dwall_9', x1: 2880, y1: 4620, x2: 2880, y2: 4980, type: 'brick', thickness: 18 },
      { id: 'dwall_10', x1: 6720, y1: 4620, x2: 6720, y2: 4980, type: 'brick', thickness: 18 },
      { id: 'dwall_11', x1: 2680, y1: 2380, x2: 2980, y2: 2380, type: 'stone', thickness: 18 },
      { id: 'dwall_12', x1: 6620, y1: 7180, x2: 6920, y2: 7180, type: 'stone', thickness: 18 },
    ];

    // 7. Destroços de Blindados no Deserto
    this.wrecks = [
      { id: 'dwrk_1', type: 'tank', x: 3820, y: 4720, angle: 0.4, smoke: true, radius: 56, colRadius: 30, name: 'Tanque Queimado na Rodovia' },
      { id: 'dwrk_2', type: 'tank', x: 5760, y: 4880, angle: -2.5, smoke: true, radius: 56, colRadius: 30, name: 'Panzer Destruído no Oásis' },
      { id: 'dwrk_3', type: 'truck', x: 3560, y: 1860, angle: 0.25, smoke: true, radius: 54, colRadius: 28, name: 'Comboio de Combustível Queimado' },
      { id: 'dwrk_4', type: 'truck', x: 6040, y: 7820, angle: 2.7, smoke: true, radius: 54, colRadius: 28, name: 'Caminhão de Munição Destruído' },
      { id: 'dwrk_5', type: 'car', x: 2560, y: 4740, angle: 0.12, smoke: false, radius: 46, colRadius: 22, name: 'Jipe de Reconhecimento Abandonado' },
      { id: 'dwrk_6', type: 'car', x: 7040, y: 4860, angle: -2.8, smoke: false, radius: 46, colRadius: 22, name: 'Veículo Comando Abandonado' },
      { id: 'dwrk_7', type: 'tank', x: 4800, y: 3120, angle: 1.5, smoke: true, radius: 56, colRadius: 30, name: 'Blindado Emboscado Norte' },
      { id: 'dwrk_8', type: 'tank', x: 4800, y: 6480, angle: -1.4, smoke: true, radius: 56, colRadius: 30, name: 'Blindado Emboscado Sul' },
    ];

    // 8. Bases de Comando (HQs)
    this.hqs = {
      player: { x: 1150, y: 4800, team: 'allies', faction: 'player', name: 'QG 8º Exército Aliado' },
      ally_ai: { x: 1250, y: 7400, team: 'allies', faction: 'ally_ai', name: 'QG Ratos do Deserto' },
      enemy_1: { x: 8450, y: 4800, team: 'enemies', faction: 'enemy_1', name: 'QG Afrika Korps' },
      enemy_2: { x: 8350, y: 2200, team: 'enemies', faction: 'enemy_2', name: 'QG Divisão Blindada Sul' },
    };

    // 9. 8 Pontos Estratégicos do Deserto
    this.sectors = [
      {
        id: 'sec_des_west_rail',
        name: 'Depósito Ferroviário Oeste',
        shortName: 'Ferrovia Oeste',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+12 MUN',
        x: 2800,
        y: 2550,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 12,
        fuelBonus: 0,
      },
      {
        id: 'sec_des_sw_oil',
        name: 'Poço Petrolífero Sudoeste',
        shortName: 'Petróleo SO',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+14 COMB',
        x: 2800,
        y: 7050,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 14,
      },
      {
        id: 'sec_des_north_refinery',
        name: 'Setor Alfa (Refinaria Norte)',
        shortName: 'Refinaria Norte',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+22 SUP',
        x: 4800,
        y: 1750,
        radius: 165,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 22,
        incomeBonus: 22,
        ammoBonus: 4,
        fuelBonus: 10,
      },
      {
        id: 'sec_des_oasis',
        name: 'Setor Bravo (Oásis Central)',
        shortName: 'Oásis Central',
        type: 'strategic',
        resourceType: 'strategic',
        shortLabel: '+32 SUP',
        x: 4800,
        y: 4800,
        radius: 180,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 32,
        incomeBonus: 32,
        ammoBonus: 8,
        fuelBonus: 8,
      },
      {
        id: 'sec_des_wadi_south',
        name: 'Setor Charlie (Passo do Wadi Sul)',
        shortName: 'Passo Wadi',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+22 SUP',
        x: 4800,
        y: 7900,
        radius: 165,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 22,
        incomeBonus: 22,
        ammoBonus: 8,
        fuelBonus: 4,
      },
      {
        id: 'sec_des_west_pass',
        name: 'Posto da Rodovia Oeste',
        shortName: 'Rodovia Oeste',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+10 MUN',
        x: 3450,
        y: 4800,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 16,
        incomeBonus: 16,
        ammoBonus: 10,
        fuelBonus: 0,
      },
      {
        id: 'sec_des_ne_fuel',
        name: 'Reservatório de Combustível NE',
        shortName: 'Tanques NE',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+14 COMB',
        x: 6800,
        y: 2550,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 14,
      },
      {
        id: 'sec_des_se_ammo',
        name: 'Arsenal do Desfiladeiro SE',
        shortName: 'Arsenal SE',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+12 MUN',
        x: 6800,
        y: 7050,
        radius: 155,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 12,
        fuelBonus: 0,
      },
      {
        id: 'sec_des_nw_dunes',
        name: 'Posto das Dunas Noroeste',
        shortName: 'Dunas NO',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+18 SUP',
        x: 2100,
        y: 1750,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 18,
        incomeBonus: 18,
        ammoBonus: 4,
        fuelBonus: 4,
      },
      {
        id: 'sec_des_sw_pass',
        name: 'Passagem do Cânion Sudoeste',
        shortName: 'Cânion SO',
        type: 'fuel',
        resourceType: 'fuel',
        shortLabel: '+12 COMB',
        x: 2100,
        y: 7850,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 0,
        fuelBonus: 12,
      },
      {
        id: 'sec_des_ne_ridge',
        name: 'Bateria da Crista Nordeste',
        shortName: 'Crista NE',
        type: 'ammo',
        resourceType: 'ammo',
        shortLabel: '+12 MUN',
        x: 7500,
        y: 1750,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 14,
        incomeBonus: 14,
        ammoBonus: 12,
        fuelBonus: 0,
      },
      {
        id: 'sec_des_se_depot',
        name: 'Base Avançada Sudeste',
        shortName: 'Base SE',
        type: 'supplies',
        resourceType: 'supplies',
        shortLabel: '+18 SUP',
        x: 7500,
        y: 7850,
        radius: 150,
        owner: 'neutral',
        captureProgress: 0,
        supplyBonus: 18,
        incomeBonus: 18,
        ammoBonus: 4,
        fuelBonus: 4,
      },
    ];

    this._addBorderForests(rng);
    this._addPineGroves(rng);
  }

  // ===========================================================================
  // NÉVOA DE GUERRA (FOG OF WAR): 0 = Inexplorado, 1 = Shroud (Cinza Escuro), 2 = Visão Ativa
  // ===========================================================================
  resetFog() {
    this.fogGrid.fill(0);
    this.tempVisionZones = [];
  }

  addTemporaryVision(x, y, radius, duration = 30) {
    this.tempVisionZones.push({ x, y, radius, timer: duration });
  }

  revealFogArea(x, y, radius, duration = 2.0) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;
    // Atualiza zona próxima existente para evitar acúmulo de centenas de zonas por segundo (UAV/FPV)
    for (const z of this.tempVisionZones) {
      if (Math.abs(z.x - x) < 75 && Math.abs(z.y - y) < 75 && Math.abs(z.radius - radius) < 80) {
        z.x = x;
        z.y = y;
        z.radius = Math.max(z.radius, radius);
        z.timer = Math.max(z.timer, duration);
        return;
      }
    }
    if (this.tempVisionZones.length >= 36) {
      this.tempVisionZones.shift();
    }
    this.tempVisionZones.push({ x, y, radius, timer: duration });
  }

  updateFogOfWar(units, baseBuildings = [], dt = 0.05) {
    // 1. Rebaixa células com Visão Ativa (2) para Explorado sem Visão / Shroud (1)
    const len = this.fogGrid.length;
    for (let i = 0; i < len; i++) {
      if (this.fogGrid[i] === 2) this.fogGrid[i] = 1;
    }

    // 2. Atualiza zonas temporárias (Reconhecimento Aéreo ou Interrogatório)
    for (const z of this.tempVisionZones) {
      z.timer -= dt;
      this._revealCircle(z.x, z.y, z.radius);
    }
    this.tempVisionZones = this.tempVisionZones.filter((z) => z.timer > 0);

    // 3. Visão do QG Aliado (e QG da IA Aliada no 2v2)
    this._revealCircle(this.hqs.player.x, this.hqs.player.y, 1250);
    if (this.hqs.ally_ai) {
      this._revealCircle(this.hqs.ally_ai.x, this.hqs.ally_ai.y, 980);
    }

    // 4. Visão dos Prédios da Base Construídos (ex: Centro de Comando Aéreo/Radar tem grande visão)
    for (const b of baseBuildings) {
      if (b.team === 'allies') {
        this._revealCircle(b.x, b.y, b.sightRadius || 560);
      }
    }

    // 5. Visão dos Setores Estratégicos Dominados pelos Aliados
    for (const sec of this.sectors) {
      if (sec.owner === 'allies') {
        this._revealCircle(sec.x, sec.y, 440);
      }
    }

    // 6. Visão de cada Esquadrão, Veículo, Sniper e Oficial Aliado Vivo
    for (const u of units) {
      if (!u.alive || u.captured || u.team !== 'allies') continue;
      let sight = u.spec.sightRadius || 520;
      if (u.garrisonedBuildingId) sight *= 1.32; // Bônus de visão no alto das janelas do prédio
      this._revealCircle(u.x, u.y, sight);
    }
  }

  _revealCircle(wx, wy, radius) {
    const cellSpan = this.size / this.fogSize;
    const cx = Math.floor(wx / cellSpan);
    const cy = Math.floor(wy / cellSpan);
    const rCells = Math.ceil(radius / cellSpan);
    const r2 = rCells * rCells;

    const minX = Math.max(0, cx - rCells);
    const maxX = Math.min(this.fogSize - 1, cx + rCells);
    const minY = Math.max(0, cy - rCells);
    const maxY = Math.min(this.fogSize - 1, cy + rCells);

    for (let gy = minY; gy <= maxY; gy++) {
      const dy = gy - cy;
      const rowOffset = gy * this.fogSize;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        if (dx * dx + dy * dy <= r2) {
          this.fogGrid[rowOffset + gx] = 2;
        }
      }
    }
  }

  getFogStateAt(wx, wy) {
    const cellSpan = this.size / this.fogSize;
    const gx = clamp(Math.floor(wx / cellSpan), 0, this.fogSize - 1);
    const gy = clamp(Math.floor(wy / cellSpan), 0, this.fogSize - 1);
    return this.fogGrid[gy * this.fogSize + gx];
  }

  getFogStateAtWorld(wx, wy) {
    return this.getFogStateAt(wx, wy);
  }

  isPositionVisibleToAllies(wx, wy) {
    return this.getFogStateAt(wx, wy) === 2;
  }

  // ===========================================================================
  // COLISÃO FÍSICA REAL E DESVIO INTELIGENTE DE OBSTÁCULOS (STEERING & AVOIDANCE)
  // ===========================================================================
  isPointBlocked(x, y, unitRadius = 24, ignoreStructureId = null, customWalls = []) {
    for (const st of this.structures) {
      if (st.id === ignoreStructureId) continue;
      const hw = st.w * 0.5 + unitRadius * 0.72;
      const hd = st.d * 0.5 + unitRadius * 0.72;
      if (Math.abs(x - st.x) < hw && Math.abs(y - st.y) < hd) return true;
    }
    for (const w of this.stoneWalls) {
      const d = this._distToSegment(x, y, w.x1, w.y1, w.x2, w.y2);
      if (d < (w.thickness || 18) * 0.5 + unitRadius * 0.65) return true;
    }
    for (const cw of customWalls) {
      const d = this._distToSegment(x, y, cw.x1, cw.y1, cw.x2, cw.y2);
      if (d < (cw.width || 24) * 0.5 + unitRadius * 0.65) return true;
    }
    for (const wrk of this.wrecks) {
      if (dist(x, y, wrk.x, wrk.y) < (wrk.colRadius || 26) + unitRadius * 0.65) return true;
    }
    return false;
  }

  // Calcula vetor de velocidade com desvio lateral suave (Steering & Avoidance) para contornar prédios, muros, árvores e carcaças
  computeSteeringVelocity(
    x,
    y,
    targetX,
    targetY,
    speed,
    unitRadius = 24,
    ignoreStructureId = null,
    customWalls = []
  ) {
    const dx = targetX - x;
    const dy = targetY - y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return { vx: 0, vy: 0, angle: 0 };

    const desiredAngle = Math.atan2(dy, dx);
    const lookDist = Math.min(d, Math.max(54, unitRadius * 2.4));

    // Testa ângulo direto primeiro; se houver obstáculo à frente, escolhe o melhor ângulo de contorno livre
    const testOffsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.75, -1.75];
    let chosenAngle = desiredAngle;

    for (const off of testOffsets) {
      const ang = desiredAngle + off;
      const probeX = x + Math.cos(ang) * lookDist;
      const probeY = y + Math.sin(ang) * lookDist;
      const midX = x + Math.cos(ang) * (lookDist * 0.55);
      const midY = y + Math.sin(ang) * (lookDist * 0.55);
      if (
        !this.isPointBlocked(probeX, probeY, unitRadius, ignoreStructureId, customWalls) &&
        !this.isPointBlocked(midX, midY, unitRadius, ignoreStructureId, customWalls)
      ) {
        chosenAngle = ang;
        break;
      }
    }

    let vx = Math.cos(chosenAngle) * speed;
    let vy = Math.sin(chosenAngle) * speed;

    // Força tangencial suave de afastamento de construções e carcaças muito próximas
    for (const st of this.structures) {
      if (st.id === ignoreStructureId) continue;
      const sdx = x - st.x;
      const sdy = y - st.y;
      const sd = Math.hypot(sdx, sdy);
      const safeR = Math.max(st.w, st.d) * 0.62 + unitRadius + 18;
      if (sd > 1 && sd < safeR) {
        const push = ((safeR - sd) / safeR) * speed * 0.55;
        vx += (sdx / sd) * push;
        vy += (sdy / sd) * push;
      }
    }

    let vMag = Math.hypot(vx, vy);
    if (vMag < 0.001) vMag = 0.001;
    vx = (vx / vMag) * speed;
    vy = (vy / vMag) * speed;
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
      return { vx: 0, vy: 0, angle: 0 };
    }

    return { vx, vy, angle: Math.atan2(vy, vx) };
  }

  resolveObstacleCollision(x, y, unitRadius = 24, ignoreStructureId = null, customWalls = []) {
    let rx = clamp(x, 80, this.size - 80);
    let ry = clamp(y, 80, this.size - 80);
    let collided = false;

    // 1. Colisão AABB contra Construções Rurais/Urbanas (exceto se o esquadrão estiver entrando nela em Guarnição)
    for (const st of this.structures) {
      if (st.id === ignoreStructureId) continue;
      const hw = st.w * 0.5 + unitRadius * 0.65;
      const hd = st.d * 0.5 + unitRadius * 0.65;
      const dx = rx - st.x;
      const dy = ry - st.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hd) {
        collided = true;
        const overlapX = hw - Math.abs(dx);
        const overlapY = hd - Math.abs(dy);
        if (overlapX < overlapY) {
          rx += dx >= 0 ? overlapX : -overlapX;
        } else {
          ry += dy >= 0 ? overlapY : -overlapY;
        }
      }
    }

    // 1b. Colisão contra Registro Unificado (Prédios da Base + Bunkers de Captura)
    for (const col of this.allColliders || []) {
      if (col.kind !== 'base_building') continue;
      const dx = rx - col.x;
      const dy = ry - col.y;
      const d = Math.hypot(dx, dy);
      const minD = col.radius + unitRadius * 0.55;
      if (d < minD) {
        collided = true;
        const invD = d < 0.001 ? 0.001 : d;
        const nx = d < 0.001 ? 1 : dx / invD;
        const ny = d < 0.001 ? 0 : dy / invD;
        rx = col.x + nx * minD;
        ry = col.y + ny * minD;
      }
    }

    // 2. Colisão contra Muros de Pedra/Tijolo do Mapa
    for (const w of this.stoneWalls) {
      const res = this._pushFromSegment(
        rx,
        ry,
        w.x1,
        w.y1,
        w.x2,
        w.y2,
        (w.thickness || 18) * 0.5 + unitRadius * 0.55
      );
      if (res.x !== rx || res.y !== ry) collided = true;
      rx = res.x;
      ry = res.y;
    }

    // 3. Colisão contra Muros Fortificados Construídos (Concreto / Sacos de Areia)
    for (const cw of customWalls) {
      const res = this._pushFromSegment(
        rx,
        ry,
        cw.x1,
        cw.y1,
        cw.x2,
        cw.y2,
        (cw.width || 24) * 0.5 + unitRadius * 0.55
      );
      if (res.x !== rx || res.y !== ry) collided = true;
      rx = res.x;
      ry = res.y;
    }

    // 4. Colisão contra Carcaças de Carros, Caminhões e Tanques Destruídos
    for (const wrk of this.wrecks) {
      const minD = (wrk.colRadius || 26) + unitRadius * 0.55;
      const dx = rx - wrk.x;
      const dy = ry - wrk.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001 && d < minD) {
        collided = true;
        const push = minD - d;
        rx += (dx / d) * push;
        ry += (dy / d) * push;
      }
    }

    // 5. Colisão leve contra Troncos de Árvores
    for (const tr of this.trees) {
      const minD = 9 + unitRadius * 0.35;
      const dx = rx - tr.x;
      const dy = ry - tr.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001 && d < minD) {
        const push = minD - d;
        rx += (dx / d) * push;
        ry += (dy / d) * push;
      }
    }

    return { x: rx, y: ry, collided };
  }

  _pushFromSegment(px, py, x1, y1, x2, y2, minDist) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const l2 = vx * vx + vy * vy;
    const t = l2 === 0 ? 0 : clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1);
    const cx = x1 + t * vx;
    const cy = y1 + t * vy;
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d > 0.001 && d < minDist) {
      const push = minDist - d;
      return { x: px + (dx / d) * push, y: py + (dy / d) * push };
    }
    return { x: px, y: py };
  }

  // ===========================================================================
  // COBERTURA DIRECIONAL (Muros Fortificados/Pedra = Escudo Verde Pesado; Carros/Árvores = Escudo Amarelo Leve)
  // ===========================================================================
  evaluateCoverAt(x, y, barricades = [], customWalls = []) {
    // 1. Muros Fortificados de Concreto/Sacos de Areia construídos (+75% Cobertura Pesada)
    for (const cw of customWalls) {
      const d = this._distToSegment(x, y, cw.x1, cw.y1, cw.x2, cw.y2);
      if (d <= 58) {
        return { level: 'heavy', type: 'heavy', bonus: 0.75, wall: cw };
      }
    }
    // 2. Muros de Pedra/Tijolo do Mapa ou Barricadas (+65% Cobertura Pesada)
    for (const w of this.stoneWalls) {
      const d = this._distToSegment(x, y, w.x1, w.y1, w.x2, w.y2);
      if (d <= 54) {
        return { level: 'heavy', type: 'heavy', bonus: 0.65, wall: w };
      }
    }
    for (const b of barricades) {
      if (b.containsPoint(x, y, 28)) {
        return { level: 'heavy', type: 'heavy', bonus: 0.65, barricade: b };
      }
    }

    // 3. Verifica Cobertura Leve (Escudo Amarelo: Carros Abandonados, Ruínas ou Fileiras de Árvores)
    for (const wrk of this.wrecks) {
      if (dist(x, y, wrk.x, wrk.y) <= wrk.radius + 16) {
        return { level: 'light', type: 'light', bonus: 0.4, wreck: wrk };
      }
    }
    for (const st of this.structures) {
      if (dist(x, y, st.x, st.y) <= st.coverRadius + 14) {
        return { level: 'light', type: 'light', bonus: 0.4, structure: st };
      }
    }
    if (this.hasTreelineCover(x, y)) {
      return { level: 'light', type: 'light', bonus: 0.35 };
    }

    return { level: 'none', type: 'none', bonus: 0 };
  }

  hasTreelineCover(x, y) {
    for (const tl of this.treelines) {
      const d = this._distToSegment(x, y, tl.x1, tl.y1, tl.x2, tl.y2);
      if (d <= tl.radius) return true;
    }
    return false;
  }

  hasLightCover(x, y, barricades = []) {
    const cov = this.evaluateCoverAt(x, y, barricades);
    return cov.level === 'light' || cov.level === 'heavy';
  }

  findStructureAt(x, y, maxDist = 96) {
    let best = null;
    let bestD = maxDist;
    for (const s of this.structures) {
      const d = dist(x, y, s.x, s.y);
      if (d <= Math.max(maxDist, s.coverRadius) && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1);
    return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
  }

  isOnRoad(x, y, margin = 35) {
    for (const road of this.roads || []) {
      const pts = road.points || [];
      const halfW = (road.width || 90) * 0.5 + margin;
      for (let i = 0; i < pts.length - 1; i++) {
        if (this._distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= halfW) {
          return true;
        }
      }
    }
    return false;
  }

  // ===========================================================================
  // SISTEMA DE ENCAIXE EM MUROS E TRINCHEIRAS ("COVER SNAPPING" ESTILO COH)
  // Calcula os Slots de Cobertura alinhados paralelamente do Lado Seguro (oposto à ameaça inimiga)
  // ===========================================================================
  findNearestCoverSnap(
    wx,
    wy,
    soldierCount = 5,
    threatX = 8450,
    threatY = 4800,
    trenches = [],
    fortifiedWalls = [],
    barricades = [],
    maxSnapDist = 92
  ) {
    const count = Math.max(1, soldierCount || 5);
    let bestSnap = null;
    let bestDist = maxSnapDist;

    // 1. Verifica Trincheiras Escavadas (Soldados encaixam dentro do corredor da vala)
    for (const tr of trenches) {
      if (!tr.points || tr.points.length < 2) continue;
      for (let sIdx = 0; sIdx < tr.points.length - 1; sIdx++) {
        const a = tr.points[sIdx];
        const b = tr.points[sIdx + 1];
        const d = this._distToSegment(wx, wy, a.x, a.y, b.x, b.y);
        if (d < bestDist) {
          bestDist = d;
          const segDx = b.x - a.x;
          const segDy = b.y - a.y;
          const segLen = Math.hypot(segDx, segDy) || 1;
          const tx = segDx / segLen;
          const ty = segDy / segLen;
          const l2 = segLen * segLen;
          const projT = clamp(((wx - a.x) * segDx + (wy - a.y) * segDy) / l2, 0.18, 0.82);
          const cx = a.x + segDx * projT;
          const cy = a.y + segDy * projT;

          // Escolhe a normal que aponta para a ameaça inimiga como direção de tiro
          const n1x = -ty;
          const n1y = tx;
          const toThreatX = threatX - cx;
          const toThreatY = threatY - cy;
          const dot = n1x * toThreatX + n1y * toThreatY;
          const faceX = dot >= 0 ? n1x : -n1x;
          const faceY = dot >= 0 ? n1y : -n1y;
          const facingAngle = Math.atan2(faceY, faceX);

          const slotSpacing = Math.max(12.5, Math.min(18, (segLen * 0.84) / Math.max(1, count)));
          const slots = [];
          for (let i = 0; i < count; i++) {
            const offsetAlong = (i - (count - 1) * 0.5) * slotSpacing;
            slots.push({
              x: cx + tx * offsetAlong,
              y: cy + ty * offsetAlong,
              facingAngle,
            });
          }

          bestSnap = {
            kind: 'trench',
            coverType: 'heavy',
            label: 'TRINCHEIRA ESCAVADA (+65% DEF)',
            trenchId: tr.id,
            coverId: `trench_${tr.id}`,
            cx,
            cy,
            facingAngle,
            normalX: -faceX,
            normalY: -faceY,
            wallSegment: { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
            slots,
          };
        }
      }
    }

    // Helper para segmentos de Muro de Pedra, Muro Fortificado de Sacos de Areia e Barricadas
    const evaluateSegmentCover = (seg, kind, label, thickness = 18) => {
      const d = this._distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2);
      if (d >= bestDist) return;
      bestDist = d;

      const segDx = seg.x2 - seg.x1;
      const segDy = seg.y2 - seg.y1;
      const segLen = Math.hypot(segDx, segDy) || 1;
      const tx = segDx / segLen;
      const ty = segDy / segLen;
      const l2 = segLen * segLen;
      const projT = clamp(((wx - seg.x1) * segDx + (wy - seg.y1) * segDy) / l2, 0.14, 0.86);
      const wallPointX = seg.x1 + segDx * projT;
      const wallPointY = seg.y1 + segDy * projT;

      // Normais perpendiculares ao muro
      const n1x = -ty;
      const n1y = tx;
      const toThreatX = threatX - wallPointX;
      const toThreatY = threatY - wallPointY;
      const dotThreat = n1x * toThreatX + n1y * toThreatY;

      // Lado Seguro = normal OPOSTA à ameaça inimiga!
      const safeNormalX = dotThreat >= 0 ? -n1x : n1x;
      const safeNormalY = dotThreat >= 0 ? -n1y : n1y;
      const facingAngle = Math.atan2(-safeNormalY, -safeNormalX);

      // Posiciona soldados colados do lado de trás do muro (fora do raio de colisão física do muro)
      const standoff = (thickness || 18) * 0.5 + 16;
      const cx = wallPointX + safeNormalX * standoff;
      const cy = wallPointY + safeNormalY * standoff;

      const slotSpacing = Math.max(12.5, Math.min(17.5, (segLen * 0.88) / Math.max(1, count)));
      const slots = [];
      for (let i = 0; i < count; i++) {
        const offsetAlong = (i - (count - 1) * 0.5) * slotSpacing;
        slots.push({
          x: cx + tx * offsetAlong,
          y: cy + ty * offsetAlong,
          wallX: wallPointX + tx * offsetAlong,
          wallY: wallPointY + ty * offsetAlong,
          facingAngle,
        });
      }

      bestSnap = {
        kind,
        coverType: 'heavy',
        label,
        trenchId: null,
        coverId: seg.id || `${kind}_${Math.round(seg.x1)}_${Math.round(seg.y1)}`,
        cx,
        cy,
        facingAngle,
        normalX: safeNormalX,
        normalY: safeNormalY,
        wallSegment: { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 },
        slots,
      };
    };

    // 2. Muros Fortificados Construídos (Sacos de Areia / Concreto)
    for (const cw of fortifiedWalls) {
      evaluateSegmentCover(cw, 'fortified_wall', 'MURO DE SACOS DE AREIA (+85% BLOQUEIO)', cw.width || 22);
    }

    // 3. Muros de Pedra e Tijolo do Mapa
    for (const sw of this.stoneWalls) {
      evaluateSegmentCover(sw, 'stone_wall', 'MURO DE PEDRA (+85% BLOQUEIO)', sw.thickness || 18);
    }

    // 4. Barricadas & Dentes de Dragão
    for (const bar of barricades) {
      evaluateSegmentCover(bar, 'barricade', 'BARRICADA FORTIFICADA (+75% BLOQUEIO)', bar.width || 24);
    }

    // 5. Carcaças de Tanques, Caminhões e Carros Destruídos
    for (const wrk of this.wrecks) {
      const d = dist(wx, wy, wrk.x, wrk.y);
      if (d < bestDist && d <= (wrk.radius || 54) + 38) {
        bestDist = d;
        const toThreatX = threatX - wrk.x;
        const toThreatY = threatY - wrk.y;
        const tLen = Math.hypot(toThreatX, toThreatY) || 1;
        const safeNormalX = -toThreatX / tLen;
        const safeNormalY = -toThreatY / tLen;
        const tx = -safeNormalY;
        const ty = safeNormalX;
        const facingAngle = Math.atan2(-safeNormalY, -safeNormalX);

        const standoff = (wrk.colRadius || 26) + 16;
        const cx = wrk.x + safeNormalX * standoff;
        const cy = wrk.y + safeNormalY * standoff;
        const slotSpacing = 13.0;
        const slots = [];
        for (let i = 0; i < count; i++) {
          const offsetAlong = (i - (count - 1) * 0.5) * slotSpacing;
          slots.push({
            x: cx + tx * offsetAlong,
            y: cy + ty * offsetAlong,
            facingAngle,
          });
        }

        bestSnap = {
          kind: 'wreck',
          coverType: 'light',
          label: `${(wrk.name || 'BLINDADO DESTRUÍDO').toUpperCase()} (COBERTURA)`,
          trenchId: null,
          coverId: wrk.id,
          cx,
          cy,
          facingAngle,
          normalX: safeNormalX,
          normalY: safeNormalY,
          wallSegment: {
            x1: wrk.x - tx * 28,
            y1: wrk.y - ty * 28,
            x2: wrk.x + tx * 28,
            y2: wrk.y + ty * 28,
          },
          slots,
        };
      }
    }

    return bestSnap;
  }

  // ===========================================================================
  // BLOQUEIO FÍSICO REAL DE PROJÉTEIS (RAYCAST / INTERSEÇÃO DE SEGMENTO DE TIRO)
  // Verifica se o segmento do projétil (x1,y1)->(x2,y2) colide com Muro, Saco de Areia ou Trincheira
  // ===========================================================================
  _intersectSegments(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    const s1x = p1x - p0x;
    const s1y = p1y - p0y;
    const s2x = p3x - p2x;
    const s2y = p3y - p2y;
    const denom = -s2x * s1y + s1x * s2y;
    if (Math.abs(denom) < 1e-6) return null;

    const s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / denom;
    const t = (s2x * (p0y - p2y) - s2y * (p0x - p2x)) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      return {
        x: p0x + t * s1x,
        y: p0y + t * s1y,
        t,
      };
    }
    return null;
  }

  checkProjectileCoverBlock(
    x1,
    y1,
    x2,
    y2,
    fortifiedWalls = [],
    barricades = [],
    trenches = []
  ) {
    // 1. Muros de Pedra/Tijolo do Mapa
    for (const w of this.stoneWalls) {
      const hit = this._intersectSegments(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2);
      if (hit) {
        return {
          blocked: true,
          kind: 'stone_wall',
          coverId: w.id,
          hitX: hit.x,
          hitY: hit.y,
          blockChance: 0.88,
        };
      }
    }

    // 2. Muros Fortificados Construídos (Concreto / Sacos de Areia)
    for (const cw of fortifiedWalls) {
      const hit = this._intersectSegments(x1, y1, x2, y2, cw.x1, cw.y1, cw.x2, cw.y2);
      if (hit) {
        return {
          blocked: true,
          kind: 'fortified_wall',
          coverId: cw.id,
          hitX: hit.x,
          hitY: hit.y,
          blockChance: 0.9,
        };
      }
    }

    // 3. Barricadas
    for (const bar of barricades) {
      const hit = this._intersectSegments(x1, y1, x2, y2, bar.x1, bar.y1, bar.x2, bar.y2);
      if (hit) {
        return {
          blocked: true,
          kind: 'barricade',
          coverId: bar.id,
          hitX: hit.x,
          hitY: hit.y,
          blockChance: 0.82,
        };
      }
    }

    // 4. Parapeito de Sacos de Areia das Trincheiras
    for (const tr of trenches) {
      if (!tr.points || tr.points.length < 2) continue;
      for (let i = 0; i < tr.points.length - 1; i++) {
        const a = tr.points[i];
        const b = tr.points[i + 1];
        const hit = this._intersectSegments(x1, y1, x2, y2, a.x, a.y, b.x, b.y);
        if (hit) {
          return {
            blocked: true,
            kind: 'trench',
            coverId: `trench_${tr.id}`,
            trenchId: tr.id,
            hitX: hit.x,
            hitY: hit.y,
            blockChance: 0.86,
          };
        }
      }
    }

    return null;
  }

  // ===========================================================================
  // ROTA INTELIGENTE DE WAYPOINTS CONTORNANDO OBJETOS (Raycast Obstacle Detour)
  // Desvia de construções, muros, carcaças queimadas e fileiras de árvores
  // ===========================================================================
  _isSegmentBlockedByObstacles(x1, y1, x2, y2, pad = 22, fortifiedWalls = [], barricades = []) {
    const minX = Math.min(x1, x2) - pad - 120;
    const maxX = Math.max(x1, x2) + pad + 120;
    const minY = Math.min(y1, y2) - pad - 120;
    const maxY = Math.max(y1, y2) + pad + 120;

    let closest = null;
    let bestT = 2;

    const testCircle = (cx, cy, r, kind) => {
      if (cx < minX || cx > maxX || cy < minY || cy > maxY) return;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 < 1) return;
      const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0.04, 0.96);
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const d = Math.hypot(px - cx, py - cy);
      if (d < r + pad && t < bestT) {
        bestT = t;
        closest = { cx, cy, r: r + pad + 14, t, kind, px, py };
      }
    };

    for (const s of this.structures) {
      const r = Math.max(s.w, s.d || s.h) * 0.56 + 25;
      testCircle(s.x, s.y, r, 'structure');
    }
    for (const wrk of this.wrecks) {
      testCircle(wrk.x, wrk.y, (wrk.colRadius || 28) + 22, 'wreck');
    }
    for (const tr of this.trees || []) {
      testCircle(tr.x, tr.y, 16, 'tree');
    }

    const testSegment = (ax, ay, bx, by, kind) => {
      if (Math.max(ax, bx) < minX || Math.min(ax, bx) > maxX) return;
      if (Math.max(ay, by) < minY || Math.min(ay, by) > maxY) return;
      const hit = this._intersectSegments(x1, y1, x2, y2, ax, ay, bx, by);
      if (hit && hit.t > 0.03 && hit.t < 0.97 && hit.t < bestT) {
        bestT = hit.t;
        const wdx = bx - ax;
        const wdy = by - ay;
        const wLen = Math.hypot(wdx, wdy) || 1;
        closest = {
          cx: hit.x,
          cy: hit.y,
          r: pad + 30,
          t: hit.t,
          kind,
          seg: { ax, ay, bx, by, tx: wdx / wLen, ty: wdy / wLen },
        };
      }
    };

    for (const sw of this.stoneWalls) testSegment(sw.x1, sw.y1, sw.x2, sw.y2, 'wall');
    for (const fw of fortifiedWalls) testSegment(fw.x1, fw.y1, fw.x2, fw.y2, 'wall');
    for (const bar of barricades) testSegment(bar.x1, bar.y1, bar.x2, bar.y2, 'barricade');

    return closest;
  }

  syncAllColliders(baseBuildings = []) {
    this.allColliders = [];
    for (const b of baseBuildings || []) {
      if (b.alive === false) continue;
      this.allColliders.push({
        kind: 'base_building',
        id: b.id,
        x: b.x,
        y: b.y,
        radius: (b.radius || 90) * 0.72,
      });
    }
    for (const st of this.structures || []) {
      this.allColliders.push({
        kind: 'structure',
        id: st.id,
        x: st.x,
        y: st.y,
        w: st.w,
        d: st.d,
      });
    }
    for (const wrk of this.wrecks || []) {
      this.allColliders.push({
        kind: 'wreck',
        x: wrk.x,
        y: wrk.y,
        radius: wrk.colRadius || 26,
      });
    }
    for (const tr of this.trees || []) {
      this.allColliders.push({
        kind: 'tree',
        x: tr.x,
        y: tr.y,
        radius: 10,
      });
    }
    return this.allColliders;
  }

  getSolidBuildingBoxes(fortifiedWalls = [], barricades = []) {
    const padding = 9; // ~0.6m de margem de segurança no plano XZ
    const boxes = [];

    for (const st of this.structures || []) {
      if (st.destroyed) continue;
      const ang = st.angle || 0;
      const cos = Math.abs(Math.cos(ang));
      const sin = Math.abs(Math.sin(ang));
      const halfW = (st.w || 60) * 0.5 * cos + (st.d || 60) * 0.5 * sin;
      const halfD = (st.w || 60) * 0.5 * sin + (st.d || 60) * 0.5 * cos;
      boxes.push({
        minX: st.x - halfW - padding,
        maxX: st.x + halfW + padding,
        minZ: st.y - halfD - padding,
        maxZ: st.y + halfD + padding,
        isGarrisonable: Boolean(st.garrisonable),
        ref: st,
      });
    }

    for (const col of this.allColliders || []) {
      if (col.kind !== 'base_building') continue;
      const r = col.radius || 48;
      boxes.push({
        minX: col.x - r - padding,
        maxX: col.x + r + padding,
        minZ: col.y - r - padding,
        maxZ: col.y + r + padding,
        isGarrisonable: false,
        ref: col,
      });
    }

    const pushWallBoxes = (list, defaultThick) => {
      for (const w of list || []) {
        const halfT = (w.thickness || w.width || defaultThick) * 0.5;
        const dx = Math.abs(w.x2 - w.x1);
        const dz = Math.abs(w.y2 - w.y1);
        if (dx < 20 || dz < 20) {
          boxes.push({
            minX: Math.min(w.x1, w.x2) - halfT - padding,
            maxX: Math.max(w.x1, w.x2) + halfT + padding,
            minZ: Math.min(w.y1, w.y2) - halfT - padding,
            maxZ: Math.max(w.y1, w.y2) + halfT + padding,
            isGarrisonable: false,
            ref: w,
          });
        } else {
          // Subdivide muro diagonal em 4 caixas ajustadas
          const segs = 4;
          for (let i = 0; i < segs; i++) {
            const t0 = i / segs;
            const t1 = (i + 1) / segs;
            const sx0 = w.x1 + (w.x2 - w.x1) * t0;
            const sz0 = w.y1 + (w.y2 - w.y1) * t0;
            const sx1 = w.x1 + (w.x2 - w.x1) * t1;
            const sz1 = w.y1 + (w.y2 - w.y1) * t1;
            boxes.push({
              minX: Math.min(sx0, sx1) - halfT - padding,
              maxX: Math.max(sx0, sx1) + halfT + padding,
              minZ: Math.min(sz0, sz1) - halfT - padding,
              maxZ: Math.max(sz0, sz1) + halfT + padding,
              isGarrisonable: false,
              ref: w,
            });
          }
        }
      }
    };

    pushWallBoxes(this.stoneWalls, 18);
    pushWallBoxes(fortifiedWalls, 22);
    pushWallBoxes(barricades, 24);
    return boxes;
  }

  segmentIntersectsAABB(p1, p2, box) {
    const x1 = p1.x;
    const z1 = p1.z ?? p1.y;
    const x2 = p2.x;
    const z2 = p2.z ?? p2.y;
    const dx = x2 - x1;
    const dz = z2 - z1;

    let tmin = 0;
    let tmax = 1;

    if (Math.abs(dx) < 1e-6) {
      if (x1 < box.minX || x1 > box.maxX) return false;
    } else {
      const invD = 1 / dx;
      let t1 = (box.minX - x1) * invD;
      let t2 = (box.maxX - x1) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    if (Math.abs(dz) < 1e-6) {
      if (z1 < box.minZ || z1 > box.maxZ) return false;
    } else {
      const invD = 1 / dz;
      let t1 = (box.minZ - z1) * invD;
      let t2 = (box.maxZ - z1) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    return true;
  }

  pushPointOutsideAllBoxes(pos, currentSquad = null, solidBoxes = null) {
    const boxes = solidBoxes || this.getSolidBuildingBoxes();
    const pz = pos.z !== undefined ? pos.z : pos.y;
    let px = pos.x;
    let curZ = pz;

    for (const box of boxes) {
      if (
        currentSquad &&
        (currentSquad.targetBuilding === box.ref ||
          currentSquad.garrisonedBuilding === box.ref ||
          (currentSquad.order?.type === 'garrison_building' &&
            box.ref?.id &&
            currentSquad.order.targetBuildingId === box.ref.id) ||
          (currentSquad.garrisonedBuildingId &&
            box.ref?.id &&
            currentSquad.garrisonedBuildingId === box.ref.id))
      ) {
        continue;
      }
      if (px > box.minX && px < box.maxX && curZ > box.minZ && curZ < box.maxZ) {
        const dLeft = px - box.minX;
        const dRight = box.maxX - px;
        const dTop = curZ - box.minZ;
        const dBottom = box.maxZ - curZ;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);
        if (minD === dLeft) px = box.minX;
        else if (minD === dRight) px = box.maxX;
        else if (minD === dTop) curZ = box.minZ;
        else curZ = box.maxZ;
      }
    }

    pos.x = clamp(px, 70, this.size - 70);
    if (pos.z !== undefined) pos.z = clamp(curZ, 70, this.size - 70);
    if (pos.y !== undefined) pos.y = clamp(curZ, 70, this.size - 70);
    return pos;
  }

  buildPathAroundObstacles(startPos, endPos, unitRadius = 22, fortifiedWalls = [], barricades = []) {
    if (typeof startPos === 'number' && typeof endPos === 'number') {
      return this.computeObstacleDetourPath(startPos, endPos, unitRadius, fortifiedWalls, 22, [], []);
    }
    return this.computeObstacleDetourPath(
      startPos.x,
      startPos.y,
      endPos.x,
      endPos.y,
      unitRadius,
      fortifiedWalls,
      barricades
    );
  }

  computeObstacleFreePath(startPos, endPos, unitRadius = 25, fortifiedWalls = [], barricades = []) {
    return this.computeObstacleDetourPath(
      startPos.x,
      startPos.y,
      endPos.x,
      endPos.y,
      unitRadius,
      fortifiedWalls,
      barricades
    );
  }

  computeObstacleDetourPath(
    startX,
    startY,
    endX,
    endY,
    unitRadius = 22,
    fortifiedWalls = [],
    barricades = []
  ) {
    const waypoints = [{ x: startX, y: startY }];
    const totalDist = Math.hypot(endX - startX, endY - startY);
    if (totalDist < 20) {
      waypoints.push({ x: endX, y: endY });
      return waypoints;
    }

    let curX = startX;
    let curY = startY;
    const solidBoxes = this.getSolidBuildingBoxes(fortifiedWalls, barricades);
    const maxIter = 1; // Máximo 1 ponto intermediário suave de contorno (sem zigue-zague)

    for (let iter = 0; iter < maxIter; iter++) {
      // 1. Teste Line-vs-AABB contra todas as caixas retangulares (casas e muros compridos)
      let hitBox = null;
      let hitDist = Infinity;
      const p1 = { x: curX, z: curY };
      const p2 = { x: endX, z: endY };
      for (const box of solidBoxes) {
        if (this.segmentIntersectsAABB(p1, p2, box)) {
          const cx = (box.minX + box.maxX) * 0.5;
          const cz = (box.minZ + box.maxZ) * 0.5;
          const d = Math.hypot(cx - curX, cz - curY);
          if (d < hitDist) {
            hitDist = d;
            hitBox = box;
          }
        }
      }

      if (hitBox) {
        const margin = Math.max(22, unitRadius);
        const corners = [
          { x: clamp(hitBox.minX - margin, 80, this.size - 80), y: clamp(hitBox.minZ - margin, 80, this.size - 80) },
          { x: clamp(hitBox.maxX + margin, 80, this.size - 80), y: clamp(hitBox.minZ - margin, 80, this.size - 80) },
          { x: clamp(hitBox.minX - margin, 80, this.size - 80), y: clamp(hitBox.maxZ + margin, 80, this.size - 80) },
          { x: clamp(hitBox.maxX + margin, 80, this.size - 80), y: clamp(hitBox.maxZ + margin, 80, this.size - 80) },
        ];
        let bestCorner = null;
        let bestScore = Infinity;
        for (const c of corners) {
          const insideAny = solidBoxes.some(
            (b) => c.x > b.minX && c.x < b.maxX && c.y > b.minZ && c.y < b.maxZ
          );
          if (insideAny) continue;
          const leg1Blocked = this.segmentIntersectsAABB(p1, { x: c.x, z: c.y }, hitBox);
          const leg2Blocked = this.segmentIntersectsAABB({ x: c.x, z: c.y }, p2, hitBox);
          const penalty = (leg1Blocked ? 1500 : 0) + (leg2Blocked ? 800 : 0);
          const score =
            Math.hypot(c.x - curX, c.y - curY) + Math.hypot(endX - c.x, endY - c.y) + penalty;
          if (score < bestScore) {
            bestScore = score;
            bestCorner = c;
          }
        }
        if (bestCorner && Math.hypot(bestCorner.x - curX, bestCorner.y - curY) >= 18) {
          waypoints.push(bestCorner);
          curX = bestCorner.x;
          curY = bestCorner.y;
          continue;
        }
      }

      const block = this._isSegmentBlockedByObstacles(
        curX,
        curY,
        endX,
        endY,
        unitRadius,
        fortifiedWalls,
        barricades
      );
      if (!block) break;

      let candA = null;
      let candB = null;

      if (block.seg) {
        // Contorna pelas duas extremidades do muro/barricada
        const ext = unitRadius + 28;
        candA = {
          x: clamp(block.seg.ax - block.seg.tx * ext, 80, this.size - 80),
          y: clamp(block.seg.ay - block.seg.ty * ext, 80, this.size - 80),
        };
        candB = {
          x: clamp(block.seg.bx + block.seg.tx * ext, 80, this.size - 80),
          y: clamp(block.seg.by + block.seg.ty * ext, 80, this.size - 80),
        };
      } else {
        // Contorna tangencialmente à esquerda ou à direita do prédio/carcaça/árvore
        const dx = endX - curX;
        const dy = endY - curY;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = block.r + 16;
        candA = {
          x: clamp(block.cx + nx * offset, 80, this.size - 80),
          y: clamp(block.cy + ny * offset, 80, this.size - 80),
        };
        candB = {
          x: clamp(block.cx - nx * offset, 80, this.size - 80),
          y: clamp(block.cy - ny * offset, 80, this.size - 80),
        };
      }

      const costA =
        Math.hypot(candA.x - curX, candA.y - curY) + Math.hypot(endX - candA.x, endY - candA.y);
      const costB =
        Math.hypot(candB.x - curX, candB.y - curY) + Math.hypot(endX - candB.x, endY - candB.y);
      const colA = this.resolveObstacleCollision(candA.x, candA.y, unitRadius, null, fortifiedWalls, barricades).collided;
      const colB = this.resolveObstacleCollision(candB.x, candB.y, unitRadius, null, fortifiedWalls, barricades).collided;

      let chosen = costA <= costB ? candA : candB;
      if (colA && !colB) chosen = candB;
      else if (colB && !colA) chosen = candA;

      // Evita loop se o ponto escolhido não avança
      if (Math.hypot(chosen.x - curX, chosen.y - curY) < 18) break;
      waypoints.push(chosen);
      curX = chosen.x;
      curY = chosen.y;
    }

    waypoints.push({ x: endX, y: endY });
    return waypoints;
  }

  updateFrontline(units, dt = 0.05) {
    const n = this.frontlineSamples;
    for (let i = 0; i < n; i++) {
      const sampleY = ((i + 0.5) / n) * this.size;
      let maxAllyX = 1800;
      let minEnemyX = 7800;

      for (const u of units) {
        if (!u.alive || u.surrendered) continue;
        const dy = Math.abs(u.y - sampleY);
        if (dy > 1600) continue;
        const weight = 1 - dy / 1600;
        if (u.team === 'allies') {
          const effX = u.x + 240 * weight;
          if (effX > maxAllyX) maxAllyX = effX;
        } else if (u.team === 'enemies') {
          const effX = u.x - 240 * weight;
          if (effX < minEnemyX) minEnemyX = effX;
        }
      }

      for (const sec of this.sectors) {
        const dy = Math.abs(sec.y - sampleY);
        if (dy < 1600) {
          if (sec.owner === 'allies') maxAllyX = Math.max(maxAllyX, sec.x + 320);
          else if (sec.owner === 'enemies') minEnemyX = Math.min(minEnemyX, sec.x - 320);
        }
      }

      const targetX = clamp((maxAllyX + minEnemyX) * 0.5, 1100, this.size - 1100);
      this.frontlineX[i] += (targetX - this.frontlineX[i]) * Math.min(1, dt * 1.5);
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n - 1; i++) {
        this.frontlineX[i] =
          this.frontlineX[i] * 0.6 + (this.frontlineX[i - 1] + this.frontlineX[i + 1]) * 0.2;
      }
    }
  }

  getFrontlineXAt(y) {
    const idx = clamp(Math.floor((y / this.size) * this.frontlineSamples), 0, this.frontlineSamples - 1);
    return this.frontlineX[idx];
  }
}
