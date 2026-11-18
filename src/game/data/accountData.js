export const ACCOUNT_RANKS = [
  { level: 1, rank: 'Recruta', minXp: 0 },
  { level: 2, rank: 'Cabo', minXp: 250 },
  { level: 3, rank: 'Cabo Especialista', minXp: 450 },
  { level: 4, rank: 'Sargento', minXp: 700 },
  { level: 5, rank: '1º Sargento', minXp: 1000 },
  { level: 6, rank: 'Tenente', minXp: 1400 },
  { level: 7, rank: '1º Tenente', minXp: 1850 },
  { level: 8, rank: 'Capitão', minXp: 2400 },
  { level: 9, rank: 'Major', minXp: 3050 },
  { level: 10, rank: 'General', minXp: 3800 },
];

export const BATTALION_UNLOCKS = [
  {
    id: 'adv_engineers',
    requiredLevel: 2,
    rankName: 'Cabo',
    icon: '🔧',
    name: 'Engenheiros de Combate Avançados',
    desc: 'Reparo acelerado de blindados e construção tática avançada em campo.',
    unitType: 'engineers',
    costSup: 200,
  },
  {
    id: 'paratroopers',
    requiredLevel: 4,
    rankName: 'Sargento',
    icon: '🪂',
    name: 'Batalhão de Paraquedistas (101st Airborne)',
    desc: 'Libera na HUD a habilidade especial de Lançamento Aéreo em qualquer ponto visível do mapa!',
    unitType: 'assault_squad',
    costSup: 320,
    isSpecialDrop: true,
  },
  {
    id: 'commandos',
    requiredLevel: 6,
    rankName: 'Tenente',
    icon: '🎖️',
    name: 'Batalhão de Comandos / Forças Especiais',
    desc: 'Tropas furtivas de elite com cargas de demolição e submetralhadoras silenciadas.',
    unitType: 'spec_ops_commando',
    costSup: 360,
  },
  {
    id: 'heavy_armor',
    requiredLevel: 8,
    rankName: 'Capitão',
    icon: '🚜',
    name: 'Divisão de Blindados Pesados',
    desc: 'Tanque Pesado Elite com blindagem frontal reforçada e canhão 120mm.',
    unitType: 'mbt_tank',
    costSup: 950,
  },
  {
    id: 'heavy_artillery',
    requiredLevel: 10,
    rankName: 'General',
    icon: '🚀',
    name: 'Bateria de Artilharia Pesada de Longo Alcance',
    desc: 'Salva de foguetes de longo alcance para demolir fortificações e colunas inimigas.',
    unitType: 'rocket_artillery',
    costSup: 850,
  },
];

export const CAMPAIGN_PACKS = [
  {
    id: 'xp_boost',
    icon: '⚡',
    name: 'Impulso de XP de Campanha (+100% XP Dobrado)',
    priceGold: 350,
    priceBrl: 'R$ 14,90',
    badge: '+100% XP',
    desc: 'Dobra todo o XP ganho pela conta nas Campanhas de 15 Dias, liberando Paraquedistas, Comandos e Blindados Pesados na metade do tempo.',
    perks: ['2× XP em todos os dias e vitórias de Campanha', 'Sobe de patente 2× mais rápido'],
  },
  {
    id: 'hq_defense',
    icon: '🏰',
    name: 'Pacote Inicial de Defesa de Quartel-General',
    priceGold: 500,
    priceBrl: 'R$ 24,90',
    badge: 'DEFESA DE QG',
    desc: 'Seu QG já começa fortificado no Dia 1 da Campanha de 15 Dias com defesas pesadas.',
    perks: [
      '2 Bunkers de Concreto com Metralhadoras Fixas nas entradas da base',
      'Perímetro de Sacos de Areia Reforçados + Arame Farpado + Ouriços Checos Antitanque',
      '+500 HP Estrutural Extra no QG + 1 Esquadrão de Engenheiros de Guarda',
    ],
  },
  {
    id: 'vip_combo',
    icon: '📦',
    name: 'Combo Logístico de Operação (15 Dias VIP)',
    priceGold: 750,
    priceBrl: 'R$ 34,90',
    badge: 'VIP 15 DIAS',
    desc: 'O pacote definitivo para dominar a Campanha de 15 Dias desde o primeiro minuto.',
    perks: [
      'Inclui Impulso de XP (+100% Dobrado)',
      'Inclui Pacote Inicial de Defesa de QG completo',
      'Caixa Aérea Dia 1: +250 SUP, +100 MUN, +100 COMB',
      'Insígnia Dourada de Comandante no Lobby',
    ],
  },
];

export function computeLevelFromXp(xp = 0) {
  let current = ACCOUNT_RANKS[0];
  for (const r of ACCOUNT_RANKS) {
    if (xp >= r.minXp) current = r;
  }
  const next = ACCOUNT_RANKS.find((r) => r.level === current.level + 1) || null;
  const unlockedBattalions = BATTALION_UNLOCKS.filter((b) => current.level >= b.requiredLevel).map(
    (b) => b.id
  );
  return {
    level: current.level,
    rank: current.rank,
    currentMinXp: current.minXp,
    nextLevelXp: next ? next.minXp : current.minXp,
    unlockedBattalions,
  };
}
