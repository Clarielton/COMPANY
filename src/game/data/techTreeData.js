// =============================================================================
// ÁRVORE DE PESQUISA & DESENVOLVIMENTO MILITAR (TECH TREE COM CUSTO EM %)
// 3 Ramos: Melhoria de Tropas, Melhoria de Veículos, Inteligência & Drones
// =============================================================================

export const TECH_BUDGET_TIERS = [
  {
    id: '25',
    pct: 0.25,
    label: '25% DO ORÇAMENTO',
    short: '25%',
    speedMult: 1.0,
    desc: 'Investimento conservador • Tempo padrão de pesquisa',
  },
  {
    id: '50',
    pct: 0.5,
    label: '50% DO ORÇAMENTO',
    short: '50%',
    speedMult: 1.75,
    desc: 'Esforço de guerra • Conclui 75% mais rápido',
  },
  {
    id: '75',
    pct: 0.75,
    label: '75% DO ORÇAMENTO',
    short: '75%',
    speedMult: 2.6,
    desc: 'Prioridade máxima do QG • Pesquisa ultra-rápida',
  },
];

export const TECH_BRANCHES = [
  {
    id: 'infantry',
    icon: '🪖',
    title: 'MELHORIA DE TROPAS',
    subtitle: 'Equipamento individual, munição e marcha de infantaria',
    color: '#60a5fa',
  },
  {
    id: 'vehicles',
    icon: '🚜',
    title: 'MELHORIA DE VEÍCULOS',
    subtitle: 'Blindagem reativa, propulsão diesel e sistemas de canhão',
    color: '#fbbf24',
  },
  {
    id: 'drones',
    icon: '🛰️',
    title: 'INTELIGÊNCIA & DRONES',
    subtitle: 'VANTs de reconhecimento, drones kamikaze FPV e interceptação',
    color: '#4ade80',
  },
];

export const TECH_NODES = [
  // RAMO 1: MELHORIA DE TROPAS
  {
    id: 'kevlar_vests',
    branch: 'infantry',
    tier: 1,
    requiredHqLevel: 2,
    requiredCp: 0,
    icon: '🦺',
    name: 'Coletes de Kevlar Balísticos',
    short: 'Coletes Kevlar (+25% HP)',
    effectText: '+25% HP individual para todos os soldados',
    minSupplyCost: 500,
    minAmmoCost: 150,
    minFuelCost: 0,
    baseDuration: 18,
  },
  {
    id: 'ap_ammo',
    branch: 'infantry',
    tier: 2,
    requiredHqLevel: 2,
    requiredCp: 0,
    icon: '🎯',
    name: 'Munição Perfurante (AP)',
    short: 'Munição Perfurante (+20% Dano)',
    effectText: '+20% dano de fuzil e melhor penetração contra blindagem leve',
    minSupplyCost: 500,
    minAmmoCost: 150,
    minFuelCost: 0,
    baseDuration: 22,
  },
  {
    id: 'forced_march',
    branch: 'infantry',
    tier: 3,
    requiredHqLevel: 3,
    requiredCp: 450,
    icon: '🥾',
    name: 'Treinamento de Marcha Tática',
    short: 'Marcha Tática (+20% Vel.)',
    effectText: '+20% velocidade de deslocamento para toda a infantaria',
    minSupplyCost: 650,
    minAmmoCost: 180,
    minFuelCost: 0,
    baseDuration: 18,
  },

  // RAMO 2: MELHORIA DE VEÍCULOS
  {
    id: 'reactive_armor',
    branch: 'vehicles',
    tier: 1,
    requiredHqLevel: 2,
    requiredCp: 0,
    icon: '🛡',
    name: 'Blindagem Reativa (ERA)',
    short: 'Blindagem Reativa (+35% HP)',
    effectText: '+35% HP máximo e +10% absorção para Tanques e Blindados',
    minSupplyCost: 750,
    minAmmoCost: 0,
    minFuelCost: 220,
    baseDuration: 24,
  },
  {
    id: 'turbo_diesel',
    branch: 'vehicles',
    tier: 2,
    requiredHqLevel: 2,
    requiredCp: 0,
    icon: '⚙',
    name: 'Motor Turbo Diesel V8',
    short: 'Turbo Diesel (+25% Vel.)',
    effectText: '+25% velocidade para Tanques, APCs, Humvees e Transportes',
    minSupplyCost: 750,
    minAmmoCost: 0,
    minFuelCost: 220,
    baseDuration: 20,
  },
  {
    id: 'autoloader',
    branch: 'vehicles',
    tier: 3,
    requiredHqLevel: 3,
    requiredCp: 450,
    icon: '💥',
    name: 'Canhão de Recarga Rápida',
    short: 'Recarga Rápida (+30% Cadência)',
    effectText: '-30% tempo de recarga e +25% cadência de tiro nos veículos',
    minSupplyCost: 950,
    minAmmoCost: 120,
    minFuelCost: 260,
    baseDuration: 26,
  },

  // RAMO 3: INTELIGÊNCIA & DRONES DE GUERRA
  {
    id: 'uav_recon',
    branch: 'drones',
    tier: 1,
    requiredHqLevel: 3,
    requiredCp: 450,
    icon: '🛸',
    name: 'Drone de Reconhecimento (UAV)',
    short: 'Drone Reconhecimento 3D',
    effectText: 'Desbloqueia quadricóptero UAV 3D (Lançamento: 350 SUP + 120 MUN)',
    minSupplyCost: 1200,
    minAmmoCost: 300,
    minFuelCost: 200,
    launchSupplyCost: 350,
    launchAmmoCost: 120,
    baseDuration: 22,
  },
  {
    id: 'fpv_kamikaze',
    branch: 'drones',
    tier: 2,
    requiredHqLevel: 3,
    requiredCp: 700,
    requiresTech: 'uav_recon',
    icon: '💣',
    name: 'Enxame de Drones Kamikaze (FPV)',
    short: 'Drone Kamikaze FPV',
    effectText: 'Desbloqueia drones explosivos teleguiados (Lançamento: 500 SUP + 200 MUN)',
    minSupplyCost: 1800,
    minAmmoCost: 500,
    minFuelCost: 350,
    launchSupplyCost: 500,
    launchAmmoCost: 200,
    baseDuration: 28,
  },
  {
    id: 'radio_intercept',
    branch: 'drones',
    tier: 3,
    requiredHqLevel: 3,
    requiredCp: 550,
    icon: '📡',
    name: 'Interceptação de Rádio Militar',
    short: 'Interceptação de Rádio',
    effectText: 'Revela periodicamente a posição dos veículos inimigos no minimapa',
    minSupplyCost: 1100,
    minAmmoCost: 250,
    minFuelCost: 150,
    baseDuration: 22,
  },
];

export const TECH_NODE_BY_ID = Object.fromEntries(TECH_NODES.map((t) => [t.id, t]));

export function computeTechResearchCost(tech, supplies = 0, fuel = 0, budgetPct = 0.25, ammo = 0) {
  const pct = Math.min(0.75, Math.max(0.25, Number(budgetPct) || 0.25));
  const supplyCost = Math.max(tech.minSupplyCost || 100, Math.floor((supplies || 0) * pct));
  const ammoCost =
    tech.minAmmoCost > 0
      ? Math.max(tech.minAmmoCost, Math.floor((ammo || 0) * (pct * 0.5)))
      : 0;
  const fuelCost =
    tech.minFuelCost > 0
      ? Math.max(tech.minFuelCost, Math.floor((fuel || 0) * (pct * 0.6)))
      : 0;
  const tier = TECH_BUDGET_TIERS.find((t) => Math.abs(t.pct - pct) < 0.05) || TECH_BUDGET_TIERS[0];
  const duration = Math.max(4, Math.round((tech.baseDuration / tier.speedMult) * 10) / 10);
  return { supplyCost, ammoCost, fuelCost, duration, speedMult: tier.speedMult, pct };
}
