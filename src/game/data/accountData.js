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
    priceGold: 200,
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
    priceGold: 350,
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
    priceGold: 500,
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
    priceGold: 750,
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
    priceGold: 1000,
  },
];

export const MULTIPLAYER_PACKS = [
  {
    id: 'hq_fortification_kit',
    icon: '🏰',
    name: 'Kit Fortificação Inicial de QG',
    priceGold: 350,
    durationLabel: '10 Partidas / Passe',
    badge: '🏰 Kit QG',
    desc: 'Nas partidas online (1v1, 2v2, 3P, 4P), seu QG já nasce com perímetro de sacos de areia, 1 Bunker leve de vigia e +400 HP.',
    perks: [
      'Perímetro inicial de Sacos de Areia ao redor do QG',
      '1 Bunker Leve de Vigia pronto desde o segundo 0',
      '+400 HP Estrutural no Quartel-General contra rush inicial',
    ],
  },
  {
    id: 'xp_boost_mp',
    icon: '⚡',
    name: 'Impulso Tático de Patente & XP (+100%)',
    priceGold: 250,
    durationLabel: '7 Dias Reais',
    badge: '⚡ 2x XP',
    desc: 'Dobra todo o XP ganho ao capturar territórios nos mapas de 16–20 setores, destruir blindados e vencer partidas 1v1, 2v2, 3P e 4P.',
    perks: [
      '2× XP em capturas de setor e destruição de blindados',
      'Acelera a subida de patente em partidas 1v1, 2v2, 3P e 4P',
    ],
  },
  {
    id: 'paratroopers_elite',
    icon: '🪂',
    name: 'Batalhão de Elite: Paraquedistas & Comando',
    priceGold: 500,
    durationLabel: 'Desbloqueio Permanente',
    badge: '🪂 Paraquedistas',
    desc: 'Libera imediatamente na aba de Operações Especiais (a partir do QG Nível 2) o Esquadrão de Paraquedistas Táticos.',
    perks: [
      'Desbloqueio permanente na conta',
      'Lançamento de infantaria de elite atrás das linhas inimigas',
      'Ideal para flanqueamentos em mapas grandes de 3P e 4P',
    ],
  },
  {
    id: 'visual_arsenal',
    icon: '🎨',
    name: 'Arsenal Visual: Camuflagens & Bandeira de Comandante',
    priceGold: 300,
    durationLabel: 'Desbloqueio Permanente',
    badge: '🎨 Camuflagem Elite',
    desc: 'Libera pinturas exclusivas para Tanques MBT, APC Stryker e QG + Bandeira Dourada de Comandante visível para todos nas salas.',
    perks: [
      'Camuflagens Tigre Urbano, Deserto Dourado e Florestal Elite',
      'Bandeira Dourada de Comandante visível no Lobby e em jogo',
    ],
  },
  {
    id: 'supreme_commander_combo',
    icon: '📦',
    name: 'Combo Comandante Supremo (Tudo + 1.000 Ouro Bônus)',
    priceGold: 990,
    durationLabel: 'Pacote Completo',
    featured: true,
    badge: '👑 COMBO SUPREMO',
    desc: 'Pacote completo em destaque reunindo Paraquedistas, Camuflagens Exclusivas, Impulso +100% XP, 10 cargas de Kit QG e +1.000 Ouro Bônus.',
    perks: [
      'Inclui Batalhão de Paraquedistas & Comando (Permanente)',
      'Inclui Arsenal Visual & Bandeira Dourada (Permanente)',
      'Inclui Impulso +100% XP (7 Dias) + 10 Cargas Kit Fortificação QG',
      'Bônus Imediato: +1.000 Ouro Militar creditados na conta',
    ],
  },
];

export const CAMPAIGN_PACKS = MULTIPLAYER_PACKS;

export function computeLevelFromXp(xp = 0) {
  let current = ACCOUNT_RANKS[0];
  for (const r of ACCOUNT_RANKS) {
    if (xp >= r.minXp) current = r;
  }
  const next = ACCOUNT_RANKS.find((r) => r.level === current.level + 1) || null;
  const eligibleBattalions = BATTALION_UNLOCKS.filter((b) => current.level >= b.requiredLevel).map(
    (b) => b.id
  );
  return {
    level: current.level,
    rank: current.rank,
    currentMinXp: current.minXp,
    nextLevelXp: next ? next.minXp : current.minXp,
    eligibleBattalions,
  };
}
