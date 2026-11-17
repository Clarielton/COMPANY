// Constantes globais do jogo. Ajuste o balanceamento aqui.

export const TILE = 32;            // tamanho de um tile em pixels
export const BLOCK = 16;           // período do quarteirão (rua + calçada + interior) em tiles
export const ROAD_W = 3;           // largura da rua em tiles
export const BLOCKS = 9;           // quarteirões por eixo
export const MAP_TILES = BLOCK * BLOCKS + ROAD_W; // 147 (fecha com rua na borda)
export const WORLD_SIZE = MAP_TILES * TILE;
export const DISTRICT_SIZE = 3 * BLOCK * TILE;    // 3x3 quarteirões por distrito

export const T = { ROAD: 0, SIDEWALK: 1, BUILDING: 2, ALLEY: 3, PARK: 4, FLOOR: 5, WALL: 6 };
export const SOLID_TILES = [false, false, true, false, false, false, true];

export const SPAWN = {
  CIV_TARGET: 24,
  GANG_TARGET: 14,
  TRAFFIC_TARGET: 14,
  RADIUS_MIN: 750,
  RADIUS_MAX: 1300,
  DESPAWN: 1900,
};

export const WANTED = {
  thresholds: [0, 50, 250, 600, 1200, 2200],
  maxHeat: 3000,
  hideTime: [0, 7, 9, 12, 15, 18],   // segundos fora de vista para cair 1 estrela
  maxFoot: [0, 3, 5, 7, 9, 12],
  maxCars: [0, 1, 2, 2, 3, 4],
};

export const ECONOMY = {
  START_MONEY: 500,
  INCOME_INTERVAL: 30,
  INCOME_PER_DISTRICT: 250,
  DEATH_PENALTY: 0.1,
  BUSTED_PENALTY: 0.2,
  BRIBE_PER_STAR: 750,
  WAR_BONUS: 2000,
};

export const WAR = {
  TRIGGER_KILLS: 3,
  INTERMISSION: 5,
  LEAVE_LIMIT: 10,
  WAVES: [
    { count: 4, weapons: ['pistol', 'uzi', 'bat'], armor: 0 },
    { count: 6, weapons: ['uzi', 'shotgun', 'pistol'], armor: 25 },
    { count: 8, weapons: ['ak47', 'shotgun', 'mp5'], armor: 60 },
  ],
};

export const HEIST = {
  STORE_TIME: 6,
  BANK_TIME: 18,
  STORE_COOLDOWN: 150,
  BANK_COOLDOWN: 480,
  AIM_TOLERANCE: 0.45,
};
