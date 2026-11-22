// Dados e lógica da Campanha Persistente de 15 Dias Reais (40 Territórios Continentais)
export const CONTINENT_MAP_W = 2400;
export const CONTINENT_MAP_H = 1500;
export const CAMPAIGN_DURATION_MS = 15 * 24 * 60 * 60 * 1000; // 360 horas reais

export const MARCH_UNIT_CATEGORIES = [
  {
    id: 'recon_air',
    label: 'Reconhecimento (Humvee) / Paraquedistas',
    short: 'Recon / Paraquedistas',
    minMs: 15 * 60 * 1000,
    maxMs: 25 * 60 * 1000,
    color: '#38bdf8',
  },
  {
    id: 'mechanized',
    label: 'Coluna Mecanizada (APC Stryker / Caminhões)',
    short: 'Coluna Mecanizada',
    minMs: 25 * 60 * 1000,
    maxMs: 45 * 60 * 1000,
    color: '#4ade80',
  },
  {
    id: 'heavy_armor',
    label: 'Blindados Pesados (Tanque MBT)',
    short: 'Blindados MBT',
    minMs: 35 * 60 * 1000,
    maxMs: 55 * 60 * 1000,
    color: '#f59e0b',
  },
  {
    id: 'infantry_artillery',
    label: 'Infantaria & Artilharia a Pé',
    short: 'Infantaria / Artilharia',
    minMs: 45 * 60 * 1000,
    maxMs: 90 * 60 * 1000,
    color: '#e5e0d0',
  },
];

// 15 Capitais Iniciais (bordas/regiões estratégicas) + 25 Setores Estratégicos = 40 Territórios
export const CONTINENTAL_TERRITORIES = [
  // === 15 CAPITAIS INICIAIS ===
  { id: 'cap_01', name: 'Capital Cherbourg (NO)', kind: 'capital', x: 180, y: 180, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_02', name: 'Capital Calais (Norte)', kind: 'capital', x: 640, y: 130, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_03', name: 'Capital Antuérpia (Norte)', kind: 'capital', x: 1180, y: 120, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_04', name: 'Capital Bremen (NE)', kind: 'capital', x: 1740, y: 140, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_05', name: 'Capital Kiel (NE)', kind: 'capital', x: 2210, y: 190, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_06', name: 'Capital Brest (Oeste)', kind: 'capital', x: 140, y: 560, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_07', name: 'Capital Nantes (SO)', kind: 'capital', x: 160, y: 980, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_08', name: 'Capital Bordeaux (SO)', kind: 'capital', x: 220, y: 1340, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_09', name: 'Capital Lyon (Sul)', kind: 'capital', x: 740, y: 1370, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_10', name: 'Capital Milão (Sul)', kind: 'capital', x: 1260, y: 1380, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_11', name: 'Capital Munique (SE)', kind: 'capital', x: 1780, y: 1360, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_12', name: 'Capital Viena (SE)', kind: 'capital', x: 2220, y: 1310, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_13', name: 'Capital Praga (Leste)', kind: 'capital', x: 2250, y: 930, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_14', name: 'Capital Berlim (Leste)', kind: 'capital', x: 2240, y: 540, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },
  { id: 'cap_15', name: 'Capital Bayeux (Costa)', kind: 'capital', x: 420, y: 360, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 120 },

  // === 25 SETORES ESTRATÉGICOS ===
  { id: 'sec_01', name: 'Centro Industrial Rouen', kind: 'industrial', x: 560, y: 540, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 180 },
  { id: 'sec_02', name: 'Refinaria Le Havre', kind: 'refinery', x: 860, y: 360, biome: 'normandy_fields', resourceType: 'fuel', hourlyBonus: 95 },
  { id: 'sec_03', name: 'Arsenal Lille', kind: 'arsenal', x: 1120, y: 380, biome: 'normandy_fields', resourceType: 'ammo', hourlyBonus: 110 },
  { id: 'sec_04', name: 'Base Aérea Eindhoven', kind: 'airbase', x: 1460, y: 310, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 90 },
  { id: 'sec_05', name: 'Centro Industrial Ruhr', kind: 'industrial', x: 1760, y: 420, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 210 },
  { id: 'sec_06', name: 'Refinaria Hanover', kind: 'refinery', x: 1980, y: 360, biome: 'normandy_fields', resourceType: 'fuel', hourlyBonus: 100 },
  { id: 'sec_07', name: 'Fortaleza Caen', kind: 'fortress', x: 410, y: 740, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 80 },
  { id: 'sec_08', name: 'Base Aérea Paris Norte', kind: 'airbase', x: 780, y: 690, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 95 },
  { id: 'sec_09', name: 'Arsenal Reims', kind: 'arsenal', x: 1080, y: 640, biome: 'normandy_fields', resourceType: 'ammo', hourlyBonus: 120 },
  { id: 'sec_10', name: 'Fortaleza Ardenas', kind: 'fortress', x: 1360, y: 560, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 85 },
  { id: 'sec_11', name: 'Refinaria Colônia', kind: 'refinery', x: 1620, y: 650, biome: 'normandy_fields', resourceType: 'fuel', hourlyBonus: 110 },
  { id: 'sec_12', name: 'Arsenal Kassel', kind: 'arsenal', x: 1920, y: 650, biome: 'normandy_fields', resourceType: 'ammo', hourlyBonus: 115 },
  { id: 'sec_13', name: 'Centro Industrial Le Mans', kind: 'industrial', x: 470, y: 1020, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 175 },
  { id: 'sec_14', name: 'Arsenal Orleans', kind: 'arsenal', x: 760, y: 970, biome: 'normandy_fields', resourceType: 'ammo', hourlyBonus: 115 },
  { id: 'sec_15', name: 'Fortaleza Verdun', kind: 'fortress', x: 1140, y: 890, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 90 },
  { id: 'sec_16', name: 'Centro Industrial Metz', kind: 'industrial', x: 1430, y: 850, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 190 },
  { id: 'sec_17', name: 'Base Aérea Frankfurt', kind: 'airbase', x: 1720, y: 880, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 100 },
  { id: 'sec_18', name: 'Refinaria Nuremberg', kind: 'refinery', x: 1980, y: 910, biome: 'normandy_fields', resourceType: 'fuel', hourlyBonus: 105 },
  { id: 'sec_19', name: 'Refinaria Clermont', kind: 'refinery', x: 520, y: 1220, biome: 'normandy_fields', resourceType: 'fuel', hourlyBonus: 95 },
  { id: 'sec_20', name: 'Base Aérea Dijon', kind: 'airbase', x: 930, y: 1140, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 95 },
  { id: 'sec_21', name: 'Fortaleza Estrasburgo', kind: 'fortress', x: 1290, y: 1110, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 95 },
  { id: 'sec_22', name: 'Arsenal Stuttgart', kind: 'arsenal', x: 1580, y: 1120, biome: 'normandy_fields', resourceType: 'ammo', hourlyBonus: 120 },
  { id: 'sec_23', name: 'Centro Industrial Augsburg', kind: 'industrial', x: 1860, y: 1130, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 185 },
  { id: 'sec_24', name: 'Base Aérea Linz', kind: 'airbase', x: 2070, y: 1160, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 90 },
  { id: 'sec_25', name: 'Fortaleza Central Reno', kind: 'fortress', x: 1200, y: 760, biome: 'normandy_fields', resourceType: 'supplies', hourlyBonus: 140 },
];

export const CONTINENTAL_EDGES = [
  { from: 'cap_01', to: 'cap_15', roadType: 'highway' },
  { from: 'cap_01', to: 'cap_06', roadType: 'highway' },
  { from: 'cap_15', to: 'cap_02', roadType: 'highway' },
  { from: 'cap_15', to: 'sec_01', roadType: 'rail' },
  { from: 'cap_15', to: 'sec_07', roadType: 'highway' },
  { from: 'cap_02', to: 'sec_02', roadType: 'highway' },
  { from: 'cap_02', to: 'cap_03', roadType: 'rail' },
  { from: 'cap_03', to: 'sec_03', roadType: 'rail' },
  { from: 'cap_03', to: 'sec_04', roadType: 'bridge' },
  { from: 'cap_04', to: 'sec_04', roadType: 'highway' },
  { from: 'cap_04', to: 'sec_05', roadType: 'rail' },
  { from: 'cap_04', to: 'cap_05', roadType: 'highway' },
  { from: 'cap_05', to: 'sec_06', roadType: 'rail' },
  { from: 'cap_05', to: 'cap_14', roadType: 'highway' },
  { from: 'cap_06', to: 'sec_07', roadType: 'highway' },
  { from: 'cap_06', to: 'cap_07', roadType: 'rail' },
  { from: 'cap_07', to: 'sec_13', roadType: 'highway' },
  { from: 'cap_07', to: 'cap_08', roadType: 'highway' },
  { from: 'cap_08', to: 'sec_19', roadType: 'rail' },
  { from: 'cap_08', to: 'cap_09', roadType: 'highway' },
  { from: 'cap_09', to: 'sec_19', roadType: 'highway' },
  { from: 'cap_09', to: 'sec_20', roadType: 'rail' },
  { from: 'cap_09', to: 'cap_10', roadType: 'bridge' },
  { from: 'cap_10', to: 'sec_21', roadType: 'bridge' },
  { from: 'cap_10', to: 'cap_11', roadType: 'highway' },
  { from: 'cap_11', to: 'sec_22', roadType: 'rail' },
  { from: 'cap_11', to: 'sec_23', roadType: 'highway' },
  { from: 'cap_11', to: 'cap_12', roadType: 'rail' },
  { from: 'cap_12', to: 'sec_24', roadType: 'highway' },
  { from: 'cap_12', to: 'cap_13', roadType: 'rail' },
  { from: 'cap_13', to: 'sec_18', roadType: 'highway' },
  { from: 'cap_13', to: 'cap_14', roadType: 'rail' },
  { from: 'cap_14', to: 'sec_06', roadType: 'rail' },
  { from: 'cap_14', to: 'sec_12', roadType: 'highway' },
  { from: 'sec_01', to: 'sec_02', roadType: 'highway' },
  { from: 'sec_01', to: 'sec_07', roadType: 'rail' },
  { from: 'sec_01', to: 'sec_08', roadType: 'highway' },
  { from: 'sec_02', to: 'sec_03', roadType: 'bridge' },
  { from: 'sec_02', to: 'sec_08', roadType: 'highway' },
  { from: 'sec_03', to: 'sec_04', roadType: 'highway' },
  { from: 'sec_03', to: 'sec_09', roadType: 'rail' },
  { from: 'sec_04', to: 'sec_10', roadType: 'bridge' },
  { from: 'sec_05', to: 'sec_06', roadType: 'rail' },
  { from: 'sec_05', to: 'sec_11', roadType: 'highway' },
  { from: 'sec_06', to: 'sec_12', roadType: 'highway' },
  { from: 'sec_07', to: 'sec_08', roadType: 'highway' },
  { from: 'sec_07', to: 'sec_13', roadType: 'rail' },
  { from: 'sec_08', to: 'sec_09', roadType: 'highway' },
  { from: 'sec_08', to: 'sec_14', roadType: 'rail' },
  { from: 'sec_09', to: 'sec_10', roadType: 'highway' },
  { from: 'sec_09', to: 'sec_25', roadType: 'rail' },
  { from: 'sec_10', to: 'sec_11', roadType: 'bridge' },
  { from: 'sec_10', to: 'sec_25', roadType: 'highway' },
  { from: 'sec_11', to: 'sec_12', roadType: 'highway' },
  { from: 'sec_11', to: 'sec_17', roadType: 'rail' },
  { from: 'sec_12', to: 'sec_18', roadType: 'rail' },
  { from: 'sec_13', to: 'sec_14', roadType: 'highway' },
  { from: 'sec_13', to: 'sec_19', roadType: 'highway' },
  { from: 'sec_14', to: 'sec_15', roadType: 'rail' },
  { from: 'sec_14', to: 'sec_20', roadType: 'highway' },
  { from: 'sec_15', to: 'sec_25', roadType: 'bridge' },
  { from: 'sec_15', to: 'sec_16', roadType: 'highway' },
  { from: 'sec_16', to: 'sec_25', roadType: 'bridge' },
  { from: 'sec_16', to: 'sec_17', roadType: 'rail' },
  { from: 'sec_16', to: 'sec_21', roadType: 'highway' },
  { from: 'sec_17', to: 'sec_18', roadType: 'highway' },
  { from: 'sec_17', to: 'sec_22', roadType: 'rail' },
  { from: 'sec_18', to: 'sec_23', roadType: 'highway' },
  { from: 'sec_18', to: 'sec_24', roadType: 'rail' },
  { from: 'sec_19', to: 'sec_20', roadType: 'highway' },
  { from: 'sec_20', to: 'sec_21', roadType: 'rail' },
  { from: 'sec_21', to: 'sec_22', roadType: 'bridge' },
  { from: 'sec_22', to: 'sec_23', roadType: 'highway' },
  { from: 'sec_23', to: 'sec_24', roadType: 'rail' },
];

export const TERRITORY_BY_ID = Object.fromEntries(CONTINENTAL_TERRITORIES.map((t) => [t.id, t]));

export function getTerritoryNeighbors(territoryId) {
  const res = [];
  for (const e of CONTINENTAL_EDGES) {
    if (e.from === territoryId) res.push({ id: e.to, roadType: e.roadType });
    else if (e.to === territoryId) res.push({ id: e.from, roadType: e.roadType });
  }
  return res;
}

export function calculateMarchDurationMs(fromId, toId, unitCategory = 'infantry_artillery') {
  const fromT = TERRITORY_BY_ID[fromId];
  const toT = TERRITORY_BY_ID[toId];
  const cat =
    MARCH_UNIT_CATEGORIES.find((c) => c.id === unitCategory) || MARCH_UNIT_CATEGORIES[3];

  let distRatio = 0.5;
  let roadMult = 1.0;
  if (fromT && toT) {
    const d = Math.hypot(toT.x - fromT.x, toT.y - fromT.y);
    distRatio = Math.max(0, Math.min(1, (d - 220) / 420));
    const edge = CONTINENTAL_EDGES.find(
      (e) => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
    );
    if (edge?.roadType === 'rail') roadMult = 0.85;
    else if (edge?.roadType === 'bridge') roadMult = 1.15;
  }
  const baseMs = cat.minMs + (cat.maxMs - cat.minMs) * distRatio;
  return Math.round(baseMs * roadMult);
}

export function formatCountdownMs(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export function formatRemainingDaysHours(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  return { days, hours };
}

export function buildInitialCampaignState({
  campaignId,
  name,
  hostUid,
  hostName,
  mapId = 'normandy_fields',
}) {
  const now = Date.now();
  const territories = {};
  CONTINENTAL_TERRITORIES.forEach((t, idx) => {
    const isHostCap = t.id === 'cap_01';
    const isAiCap = t.kind === 'capital' && !isHostCap;
    const inf = isHostCap ? 4 : isAiCap ? 3 : 1;
    const arm = isHostCap ? 2 : isAiCap ? 1 : 0;
    territories[t.id] = {
      id: t.id,
      ownerUid: isHostCap ? hostUid : isAiCap ? `ai_cmd_${idx}` : null,
      ownerName: isHostCap ? hostName : isAiCap ? `Comandante IA #${idx}` : 'Neutro',
      team: isHostCap ? 'allies' : isAiCap ? 'enemies' : 'neutral',
      garrison: inf + arm,
      troops: { infantry: inf, armor: arm },
      fortifications: { walls: isHostCap ? 2 : 0, bunkers: isHostCap ? 1 : 0, trenches: isHostCap ? 1 : 0 },
    };
  });

  return {
    id: campaignId,
    name: (name || `Operação Continental #${campaignId.slice(-4).toUpperCase()}`).trim(),
    mapId,
    mapSeed: Math.floor(10000 + Math.random() * 899999),
    startedAt: now,
    endsAt: now + CAMPAIGN_DURATION_MS,
    totalDays: 15,
    status: 'ACTIVE',
    winnerUid: null,
    players: {
      [hostUid]: {
        uid: hostUid,
        name: hostName,
        capitalId: 'cap_01',
        supplies: 1200,
        ammo: 400,
        fuel: 350,
        eliminated: false,
      },
    },
    territories,
    marches: [],
  };
}

export function resolveCompletedMarches(campaign, now = Date.now()) {
  if (!campaign || !Array.isArray(campaign.marches) || campaign.marches.length === 0) {
    return { campaign, changed: false };
  }
  let changed = false;
  const remaining = [];
  const territories = { ...(campaign.territories || {}) };

  for (const m of campaign.marches) {
    if (!m) continue;
    if (now >= m.arrivalTimestamp) {
      changed = true;
      const dest = { ...(territories[m.toId] || { id: m.toId, garrison: 0, fortifications: { walls: 0, bunkers: 0 } }) };
      if (dest.ownerUid === m.ownerUid) {
        dest.garrison = (dest.garrison || 0) + (m.count || 1);
      } else {
        const power = (m.count || 1) + (m.unitCategory === 'heavy_armor' ? 1 : 0);
        if (power >= (dest.garrison || 0)) {
          dest.ownerUid = m.ownerUid;
          dest.ownerName = m.ownerName || 'Comandante';
          dest.team = m.team || 'allies';
          dest.garrison = Math.max(1, power - Math.floor((dest.garrison || 0) * 0.5));
        } else {
          dest.garrison = Math.max(1, (dest.garrison || 1) - power);
        }
      }
      territories[m.toId] = dest;
    } else {
      remaining.push(m);
    }
  }

  if (!changed) return { campaign, changed: false };
  return {
    changed: true,
    campaign: {
      ...campaign,
      territories,
      marches: remaining,
    },
  };
}
