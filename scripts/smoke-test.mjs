import assert from 'node:assert/strict';
import { CityMap } from '../src/game/world/CityMap.js';
import { Player } from '../src/game/entities/Player.js';
import { Pedestrian } from '../src/game/entities/Pedestrian.js';
import { Vehicle } from '../src/game/entities/Vehicle.js';
import { WeaponSystem } from '../src/game/systems/WeaponSystem.js';
import { TerritorySystem } from '../src/game/systems/TerritorySystem.js';
import { HeistSystem } from '../src/game/systems/HeistSystem.js';
import { WantedSystem } from '../src/game/systems/WantedSystem.js';
import { WEAPON_CATEGORIES } from '../src/game/data/weapons.js';
import { ECONOMY, HEIST } from '../src/game/config.js';

function createMockGame() {
  const map = new CityMap(2077);
  const player = new Player(map.spawnPoint.x, map.spawnPoint.y);
  const territorySystem = new TerritorySystem();
  const wantedSystem = new WantedSystem();
  const heistSystem = new HeistSystem();
  const weaponSystem = new WeaponSystem();

  const game = {
    map,
    player,
    territorySystem,
    wantedSystem,
    heistSystem,
    weaponSystem,
    peds: [],
    vehicles: [],
    bullets: [],
    grenades: [],
    particles: [],
    texts: [],
    pickups: [],
    worldMouse: { x: player.x + 120, y: player.y },
    input: { wasPressed: () => false, down: () => false, mouse: { down: false, clicked: false } },
    camera: { shake: () => {} },
    audio: { play: () => {} },
    notify: () => {},
    spawnText: () => {},
    playSoundAt: () => {},
    onPedKilled(ped, attackerFaction) {
      territorySystem.registerKill(game, ped, attackerFaction);
    },
  };
  return game;
}

// 1. Mapa e Pontos de Interesse
const game = createMockGame();
const { map, player } = game;
assert.equal(map.pois.filter((p) => p.type === 'bank').length, 2, 'Deve haver 2 grandes bancos');
assert.equal(map.pois.filter((p) => p.type === 'store').length, 6, 'Deve haver 6 lojas de conveniência');
assert.equal(map.pois.filter((p) => p.type === 'ammunation').length, 4, 'Deve haver 4 Ammu-Nation');
assert.equal(map.pois.filter((p) => p.type === 'bribe').length, 3, 'Deve haver 3 pontos de suborno');
assert.equal(map.isSolidAt(player.x, player.y), false, 'Spawn do jogador deve estar livre');

// Colisão com parede de prédio
const b = map.buildings.find((x) => !x.isInteriorShell);
const colRes = map.resolveCircle(b.x + 16, b.y + 16, player.radius);
assert.equal(colRes.hit, true, 'Colisão dentro de prédio deve ser detectada');

// 2. Sistema de Armas, Recarga e Explosões
assert.equal(WEAPON_CATEGORIES.length, 6, 'Deve haver 6 categorias de armas');
player.selectSlot(1); // Pistola 9mm
assert.equal(player.equippedId, 'pistol');
const fired = game.weaponSystem.firePlayer(game);
assert.equal(fired, true, 'Disparo de pistola deve criar projétil');
assert.equal(game.bullets.length, 1);
assert.equal(player.weaponState.mag, 14);
assert.equal(player.startReload(), true);
player.reloadTimer = 0.01;
player.update(0.02, game.input, map, game.worldMouse);
assert.equal(player.weaponState.mag, 15, 'Recarga deve preencher o carregador');

// Explosão com dano em área
const targetPed = new Pedestrian({ x: player.x + 50, y: player.y, faction: 'lossantos', hp: 80 });
const targetVeh = new Vehicle({ x: player.x + 60, y: player.y + 10, typeId: 'sedan' });
game.peds.push(targetPed);
game.vehicles.push(targetVeh);
game.weaponSystem.triggerExplosion(game, player.x + 50, player.y, 145, 190, 'player');
assert.equal(targetPed.alive, false, 'Explosão deve eliminar NPC no raio');
assert.ok(targetVeh.hp < targetVeh.maxHp, 'Explosão deve danificar veículo próximo');

// 3. Sistema de Assaltos (Loja + Banco)
const store = map.pois.find((p) => p.type === 'store');
player.x = store.cashierX;
player.y = store.cashierY + 25;
player.angle = -Math.PI / 2;
const moneyBeforeStore = player.money;
game.heistSystem.update(game, 0.05);
assert.ok(game.heistSystem.activeHeist, 'Mirar para o caixa deve iniciar assalto à loja');
game.heistSystem.update(game, HEIST.STORE_TIME + 0.1);
assert.ok(player.money > moneyBeforeStore, 'Concluir assalto à loja deve render dinheiro');

const bank = map.pois.find((p) => p.type === 'bank');
player.x = bank.vaultX;
player.y = bank.vaultY;
const moneyBeforeBank = player.money;
game.heistSystem.update(game, 0.05);
assert.ok(game.heistSystem.activeHeist, 'Entrar no cofre deve iniciar assalto ao banco');
assert.ok(game.wantedSystem.stars >= 3, 'Assalto a banco deve gerar 3+ estrelas de procurado');
game.heistSystem.update(game, HEIST.BANK_TIME + 0.1);
assert.ok(player.money >= moneyBeforeBank + bank.rewardMin, 'Assalto ao banco deve pagar recompensa alta');

// 4. Polícia 1-5 estrelas, evasão e suborno
game.wantedSystem.addHeat(2500, 'Teste força-tarefa');
assert.equal(game.wantedSystem.stars, 5, 'Deve atingir nível máximo de 5 estrelas');
const bribeRes = game.wantedSystem.bribePolice(game);
assert.equal(bribeRes.ok, true, 'Suborno deve limpar procurado com dinheiro suficiente');
assert.equal(game.wantedSystem.stars, 0);

// 5. Guerra de Território em 3 Ondas e Renda Passiva
const targetDistrict = game.territorySystem.districts[0]; // Docas Oeste (lossantos)
const dx = targetDistrict.col * 1536 + 200;
const dy = targetDistrict.row * 1536 + 200;
player.x = dx;
player.y = dy;
for (let i = 0; i < 3; i++) {
  const gMember = new Pedestrian({
    x: dx + i * 10,
    y: dy,
    faction: targetDistrict.owner,
    role: 'gang',
    districtIndex: targetDistrict.index,
  });
  game.peds.push(gMember);
  gMember.takeDamage(999, 'player');
  game.onPedKilled(gMember, 'player');
}
assert.ok(game.territorySystem.activeWar, 'Eliminar 3 rivais no distrito deve iniciar guerra');

// Simula sobrevivência às 3 ondas
for (let wave = 1; wave <= 3; wave++) {
  for (const p of game.peds) {
    if (p.isWarEnemy) {
      p.alive = false;
      game.onPedKilled(p, 'player');
    }
  }
  game.territorySystem.update(game, 0.1);
  if (wave < 3) {
    game.territorySystem.update(game, 5.1);
  }
}
assert.equal(targetDistrict.owner, 'player', 'Sobreviver a 3 ondas deve conquistar o território');
assert.equal(game.territorySystem.countOwned(), 1);

const moneyBeforeIncome = player.money;
game.territorySystem.update(game, ECONOMY.INCOME_INTERVAL + 0.1);
assert.equal(
  player.money,
  moneyBeforeIncome + ECONOMY.INCOME_PER_DISTRICT,
  'Território conquistado deve gerar renda passiva periódica'
);

console.log('SMOKE TEST OK: Mapa, Combate, Assaltos, Polícia (1-5★) e Territórios (3 ondas) validados.');


// 6. Validação dos Sistemas RTS Táticos 3D (Névoa de Guerra Real, Mapa 9600x9600, 8 Setores, Base Militar, Formações e Cobertura)
import { Game } from '../src/game/Game.js';
import { COMMAND_ACTIONS, BOTTOM_BAR_CATEGORIES, SPACING_PRESETS } from '../src/game/data/rtsData.js';
import { BATTLEFIELD_SIZE } from '../src/game/world/BattlefieldMap.js';
import { SquadUnit } from '../src/game/entities/SquadUnit.js';

const rtsGame = new Game({});
assert.equal(BATTLEFIELD_SIZE, 9600, 'Mapa deve ser expandido em 3x (9600x9600)');
assert.equal(rtsGame.map.sectors.length, 12, 'Mapa deve possuir 12 Pontos Estratégicos de Suprimento/Munição/Combustível');
assert.equal(COMMAND_ACTIONS.length, 9, 'Barra inferior deve ter 9 ações de comando/engenharia estilo CoH');

rtsGame.setupMatch('2v2', 1000);
assert.equal(rtsGame.gameMode, '2v2', 'Deve configurar partida no modo 2v2');
assert.equal(rtsGame.supplies, 1000, 'Deve respeitar seleção de recursos iniciais no Lobby Skirmish');
rtsGame.setGameSpeed(0.5);
assert.equal(rtsGame.timeScale, 0.5, 'Controle de velocidade tática deve ajustar timeScale para 0.5x');
assert.ok(rtsGame.map.structures.length >= 10, 'Mapa deve ter construções rurais/urbanas e ruínas para guarnição/cobertura');
assert.ok(rtsGame.map.stoneWalls.length >= 10, 'Mapa deve ter muros baixos de pedra/tijolo para Cobertura Pesada (Escudo Verde)');
assert.ok(rtsGame.map.wrecks.length >= 10, 'Mapa deve ter carros/caminhões/tanques abandonados para Cobertura Leve (Escudo Amarelo)');

// Validação de Névoa de Guerra Real (3 Estados: 0 Inexplorado, 1 Shroud, 2 Visão Ativa)
const playerHq = rtsGame.map.hqs.player;
const enemyHq = rtsGame.map.hqs.enemy_1;
assert.equal(
  rtsGame.map.isPositionVisibleToAllies(playerHq.x + 200, playerHq.y),
  true,
  'Área próxima às tropas aliadas deve estar em Visão Ativa (2)'
);
assert.equal(
  rtsGame.map.isPositionVisibleToAllies(enemyHq.x, enemyHq.y),
  false,
  'Base inimiga distante deve iniciar oculta na Névoa de Guerra'
);

// Construção de Instalações Militares no QG e Recrutamento de Elite / Blindados / Suporte Aéreo
assert.equal(
  rtsGame.constructBaseBuilding('spec_ops_center'),
  true,
  'Deve construir Quartel de Operações Especiais no QG'
);
assert.equal(
  rtsGame.recruitUnitById('sniper_squad'),
  false,
  'Snipers devem exigir QG Nível 2 antes de recrutar'
);
rtsGame.supplies = 3500;
rtsGame.ammo = 800;
rtsGame.fuel = 800;
rtsGame.addCommandPoints(150);
assert.equal(rtsGame.upgradeHq(), true, 'Deve evoluir QG para Nível 2');
assert.equal(
  rtsGame.recruitUnitById('sniper_squad'),
  true,
  'Deve recrutar Esquadrão de Snipers Camuflados no QG Nível 2'
);
assert.equal(
  rtsGame.constructBaseBuilding('motor_pool'),
  true,
  'Deve construir Fábrica de Blindados Pesados no QG'
);
assert.equal(
  rtsGame.constructBaseBuilding('air_command'),
  true,
  'Deve construir Centro de Comando Aéreo & Radar no QG'
);
rtsGame.hqLevel = 1;
rtsGame.commandPoints = 0;

// Reconhecimento Aéreo abrindo a Névoa de Guerra por 30s
rtsGame.supplies = 1000;
rtsGame.ammo = 300;
rtsGame._executeAirDoctrineAt('recon_drone', enemyHq.x, enemyHq.y);
rtsGame.map.updateFogOfWar(rtsGame.units, rtsGame.baseBuildings, 0.05);
assert.equal(
  rtsGame.map.isPositionVisibleToAllies(enemyHq.x, enemyHq.y),
  true,
  'Voo de Reconhecimento Aéreo deve abrir a Névoa de Guerra na área escolhida'
);

// Formações de Esquadrão, Orientação Direcional e Travar Posição [H]
rtsGame.setSelectedFormation('spread');
const selUnit = rtsGame.units.find((u) => u.selected);
assert.equal(selUnit.formation, 'spread', 'Deve alterar formação do esquadrão selecionado para Dispersos');
const previewPts = SquadUnit.computeFormationWorldPreview(4000, 4000, Math.PI / 4, 'wedge', 5);
assert.equal(previewPts.length, 5, 'Preview direcional deve calcular a posição exata de cada soldado na formação');
rtsGame.toggleSelectedHoldPosition();
assert.equal(selUnit.holdPosition, true, 'Tecla [H] deve travar a posição do esquadrão');

// Colisão Real com Obstáculos e Cobertura Direcional (Escudo Verde / Amarelo)
const wall = rtsGame.map.stoneWalls[0];
const wallMidX = (wall.x1 + wall.x2) * 0.5;
const wallMidY = (wall.y1 + wall.y2) * 0.5;
const covEval = rtsGame.map.evaluateCoverAt(wallMidX + 10, wallMidY + 10, rtsGame.barricades);
assert.equal(covEval.type, 'heavy', 'Posicionar esquadrão junto a muro de pedra deve ativar Cobertura Pesada (Escudo Verde)');
const bld0 = rtsGame.map.structures[0];
const colBuilding = rtsGame.map.resolveObstacleCollision(bld0.x, bld0.y, 18, null);
assert.equal(colBuilding.collided, true, 'Unidades devem colidir e contornar construções sólidas');

// Rendição e Sala de Interrogatório Militar revelando Base Inimiga, minas e trincheiras ocultas
const enemyInf = rtsGame.units.find((u) => u.team === 'enemies' && u.spec.type === 'infantry');
enemyInf.surrendered = true;
const suppliesBeforeIntel = rtsGame.supplies;
rtsGame.resolveInterrogation('maps', enemyInf.id);
assert.equal(rtsGame.intelRevealed, true, 'Interrogatório (maps) deve ativar revelação de inteligência');
rtsGame.resolveInterrogation('convoy', enemyInf.id);
assert.ok(rtsGame.supplies > suppliesBeforeIntel, 'Interrogatório (convoy) deve conceder Pontos de Suprimento extras');
assert.ok(
  rtsGame.mines.filter((m) => m.team === 'enemies').every((m) => m.revealed),
  'Todas as minas ocultas do inimigo devem ser reveladas'
);
assert.ok(
  rtsGame.trenches.filter((t) => t.team === 'enemies').every((t) => t.revealed),
  'Todas as trincheiras inimigas devem ser reveladas'
);

// 7. Validação do Mapa Tático Interativo ([TAB]), Vilarejos, Steering Pathfinding, Muros/Arame Farpado e Bases 3D Destrutíveis
assert.ok(
  rtsGame.map.sectors.every((s) => typeof s.supplyBonus === 'number' && Boolean(s.shortLabel)),
  'Todos os 8 setores devem ter supplyBonus numérico e shortLabel válido (sem undefined)'
);
assert.ok(rtsGame.map.structures.length >= 18, 'Mapa deve incluir os 2 vilarejos nas rotas com igrejas, sobrados, armazéns e postos');

rtsGame.addTacticalArrow(2000, 4800, 4800, 4800, '#ef4444', 'ATAQUE');
rtsGame.addTacticalPing(4800, 4800, 'attack');
assert.equal(rtsGame.tacticalArrows.length, 1, 'Deve adicionar seta de ataque no Quadro de Planejamento Tático');
assert.equal(rtsGame.tacticalPings.length, 1, 'Deve adicionar marcador de alerta (Ping) no Mapa Tático');

// Steering & Avoidance Pathfinding ao redor de obstáculos
const steerVec = rtsGame.map.computeSteeringVelocity(
  bld0.x - bld0.w * 0.5 - 24,
  bld0.y,
  bld0.x + 200,
  bld0.y,
  60,
  18,
  null,
  rtsGame.fortifiedWalls
);
assert.ok(Math.hypot(steerVec.vx, steerVec.vy) > 10, 'Steering pathfinding deve calcular vetor lateral para contornar casas/muros');

// Seleção de Prédio da Base 3D, Fila de Produção e Destruição de Base Inimiga
const allyHQ = rtsGame.baseBuildings.find((b) => b.id === 'ally_main_hq');
assert.equal(rtsGame.selectBaseBuilding(allyHQ.id), true, 'Deve selecionar o QG Aliado no mundo 3D');
rtsGame.supplies = 1000;
assert.equal(rtsGame.queueUnitAtBuilding(allyHQ.id, 'rifle_squad'), true, 'Deve enfileirar produção de unidade no prédio selecionado');
assert.equal(allyHQ.productionQueue.length, 1, 'Fila de produção do prédio deve conter 1 unidade');

const enemySpecOpsBld = rtsGame.baseBuildings.find((b) => b.id === 'enemy_base_spec_ops');
const vpBefore = rtsGame.victoryPoints;
rtsGame.damageBaseBuilding(enemySpecOpsBld, 5000, 'allies');
assert.equal(enemySpecOpsBld.alive, false, 'Prédio inimigo deve ser destruído ao zerar HP');
assert.ok(rtsGame.victoryPoints > vpBefore, 'Destruir prédio da base inimiga deve conceder Pontos de Vitória e Recursos');

// 8. Validação da Barra Inferior Categorizada ([F1]-[F5]), Espaçamento Tático (1m-8m), Vida Individual por Soldado e Destacar/Transferir Soldados (Men of War)
assert.equal(BOTTOM_BAR_CATEGORIES.length, 4, 'Barra inferior deve ter 4 abas táticas (Infantaria, Veículos, Engenharia, Defesas)');
assert.equal(SPACING_PRESETS.length, 4, 'Deve ter 4 presets rápidos de espaçamento (1.5m, 3m, 5m, 7.5m)');
assert.equal(rtsGame.setBottomCategory('defenses'), true, 'Deve alternar para a aba Defesas & Estruturas [F4]');
assert.equal(rtsGame.activeBottomCategory, 'defenses');
assert.equal(rtsGame.setBottomCategory('all'), true, 'Deve alternar para a visão TODOS [F5]');

rtsGame.supplies = 1200;
assert.equal(rtsGame.triggerActionById('engineer_squad'), true, 'Deve recrutar Esquadrão de Engenheiros de Combate pela Barra Inferior');

const engSquad = rtsGame.units.find((u) => u.faction === 'player' && u.unitType === 'engineer_squad' && u.alive);
assert.ok(engSquad, 'Esquadrão de Engenheiros deve estar ativo no campo');
assert.equal(engSquad.soldiers.length, 4, 'Esquadrão de Engenheiros deve ter 4 sub-unidades individuais de soldados');
assert.ok(engSquad.soldiers.every((s) => s.hp === 100 && s.maxHp === 100 && s.name && s.weapon), 'Cada soldado deve ter nome/patente, arma e 100/100 HP individual');

// Espaçamento Tático entre Soldados (1.5m Compacto vs 7.5m Anti-Artilharia)
for (const u of rtsGame.units) u.selected = false;
engSquad.selected = true;
rtsGame.setSelectedSpacing(1.5);
const compactSpan = Math.hypot(
  engSquad.memberOffsets[0].ox - engSquad.memberOffsets[3].ox,
  engSquad.memberOffsets[0].oy - engSquad.memberOffsets[3].oy
);
rtsGame.setSelectedSpacing(7.5);
const wideSpan = Math.hypot(
  engSquad.memberOffsets[0].ox - engSquad.memberOffsets[3].ox,
  engSquad.memberOffsets[0].oy - engSquad.memberOffsets[3].oy
);
assert.ok(wideSpan > compactSpan * 3.5, 'Alterar o espaçamento para 7.5m deve afastar imediatamente os soldados 3D do esquadrão');

// Dano Físico Individual por Soldado (atingindo 1 soldado específico na posição 3D dele)
engSquad.inTrench = false;
engSquad.inHeavyCover = false;
engSquad.inLightCover = false;
engSquad.inTreelineCover = false;
engSquad.updateSoldierWorldPositions();
const targetSoldier = engSquad.soldiers[0];
engSquad.takeDamage(120, 'enemies', rtsGame, true, false, targetSoldier.worldX, targetSoldier.worldY);
assert.equal(targetSoldier.alive, false, 'Soldado atingido fatalmente deve morrer individualmente');
assert.equal(engSquad.soldiersAlive, 3, 'Efetivo vivo do esquadrão deve cair de 4 para 3 soldados');
assert.ok(engSquad.soldiers[1].alive && engSquad.soldiers[1].hp === 100, 'Demais soldados fora do impacto do projétil devem manter seu HP individual');

// Destacar Soldado como Novo Esquadrão Independente ([Separar Soldado - Tecla K])
const aliveSquadsBeforeSplit = rtsGame.units.filter((u) => u.alive && u.faction === 'player').length;
rtsGame.toggleSelectSoldierInUnit(engSquad.id, engSquad.soldiers[1].id, true);
const detachedScoutSquad = rtsGame.splitSelectedSoldiers(engSquad.id);
assert.ok(detachedScoutSquad, 'Deve destacar o soldado selecionado em um novo esquadrão independente');
assert.equal(detachedScoutSquad.soldiersAlive, 1, 'Novo esquadrão destacado deve conter 1 soldado batedor');
assert.equal(engSquad.soldiersAlive, 2, 'Esquadrão original deve permanecer com os 2 soldados restantes');
assert.equal(
  rtsGame.units.filter((u) => u.alive && u.faction === 'player').length,
  aliveSquadsBeforeSplit + 1,
  'Total de esquadrões aliados no mapa deve aumentar em 1'
);

// Transferir Soldado entre Esquadrões ([Transferir ➡️])
const rifleSquad = rtsGame.units.find((u) => u.alive && u.faction === 'player' && u.unitType === 'rifle_squad');
const rifleCountBefore = rifleSquad.soldiersAlive;
const transferredOk = rtsGame.transferSoldiersToSquad(detachedScoutSquad.id, rifleSquad.id);
assert.equal(transferredOk, true, 'Deve transferir soldado do destacamento para o Esquadrão de Fuzileiros');
assert.equal(rifleSquad.soldiersAlive, rifleCountBefore + 1, 'Esquadrão receptor deve ganhar +1 soldado vivo');
assert.equal(detachedScoutSquad.alive, false, 'Esquadrão doador que transferiu seu último soldado deve ser encerrado');

// 9. Validação dos Nomes das Abas da Barra Inferior e Sistema Completo de Salvar / Carregar Batalha
assert.ok(
  BOTTOM_BAR_CATEGORIES.every((c) => Boolean(c.label) && Boolean(c.hotkey) && Boolean(c.shortLabel)),
  'Todas as 4 abas da Barra Inferior devem ter label, shortLabel e hotkey preenchidos (sem [] vazios)'
);

rtsGame.supplies = 888;
rtsGame.ammo = 222;
rtsGame.fuel = 111;
const savedSnap = rtsGame.saveBattle('Operação Teste de Salvamento');
assert.ok(savedSnap && savedSnap.id, 'Deve salvar a batalha atual com ID e metadados');
assert.equal(rtsGame.getSavedBattles().length, 1, 'Lista de batalhas salvas deve conter 1 registro');

// Modifica o estado e depois restaura o salvamento para comprovar a restauração completa
rtsGame.supplies = 10;
rtsGame.units = [];
const loadedOk = rtsGame.loadSavedBattle(savedSnap.id);
assert.equal(loadedOk, true, 'Deve carregar a batalha salva pelo ID');
assert.equal(rtsGame.supplies, 888, 'Suprimentos devem ser restaurados para 888 SUP');
assert.equal(rtsGame.ammo, 222, 'Munição deve ser restaurada para 222 MUN');
assert.equal(rtsGame.fuel, 111, 'Combustível deve ser restaurado para 111 COMB');
const restoredRifle = rtsGame.units.find((u) => u.id === rifleSquad.id);
assert.ok(restoredRifle, 'Esquadrão de Fuzileiros com soldado transferido deve ser restaurado');
assert.equal(restoredRifle.soldiersAlive, rifleCountBefore + 1, 'Efetivo individual de soldados deve ser preservado no salvamento');

rtsGame.deleteSavedBattle(savedSnap.id);
assert.equal(rtsGame.getSavedBattles().length, 0, 'Deve excluir o salvamento da lista');

// 10. Validação do Sistema de Encaixe em Muros e Trincheiras (Cover Snapping estilo Company of Heroes), Raycast Físico de Tiros e Modo Híbrido Touch/Mouse
const snapWall = rtsGame.map.stoneWalls[0];
const snapMidX = (snapWall.x1 + snapWall.x2) * 0.5;
const snapMidY = (snapWall.y1 + snapWall.y2) * 0.5;
const threatOrigin = rtsGame._getThreatOriginFor(snapMidX, snapMidY, 'allies');
const coverSnap = rtsGame.map.findNearestCoverSnap(
  snapMidX + 12,
  snapMidY + 12,
  5,
  threatOrigin.x,
  threatOrigin.y,
  rtsGame.trenches,
  rtsGame.fortifiedWalls,
  rtsGame.barricades,
  115
);
assert.ok(coverSnap, 'Deve encontrar encaixe de cobertura (Cover Snap) ao clicar/tocar perto de um muro');
assert.equal(coverSnap.slots.length, 5, 'Deve gerar exatamente 5 Cover Slots alinhados paralelamente para os 5 soldados');

// Verifica se os slots ficaram do lado oposto à ameaça inimiga (Lado Seguro)
const vecToThreatX = threatOrigin.x - coverSnap.cx;
const vecToThreatY = threatOrigin.y - coverSnap.cy;
assert.ok(
  coverSnap.normalX * vecToThreatX + coverSnap.normalY * vecToThreatY < 0,
  'Todos os Cover Slots devem ficar posicionados do lado seguro (oposto à direção da ameaça inimiga)'
);

// Ordena o esquadrão para encaixar no muro e valida postura agachada e alinhamento dos soldados
restoredRifle.setCoverSnapOrder(coverSnap);
restoredRifle.x = coverSnap.cx;
restoredRifle.y = coverSnap.cy;
rtsGame._updateUnitsAndCombat(0.016);
restoredRifle.updateSoldierWorldPositions();
assert.equal(restoredRifle.snappedToCover, true, 'Esquadrão deve marcar estado snappedToCover = true ao chegar no muro');
assert.equal(restoredRifle.crouchedInCover, true, 'Soldados no muro devem entrar em postura agachada (crouching)');
const firstAliveSoldier = restoredRifle.soldiers.find((s) => s.alive);
assert.equal(
  Math.round(firstAliveSoldier.worldX),
  Math.round(coverSnap.slots[0].x),
  'Soldado 1 deve ficar encaixado exatamente nas coordenadas do Slot 0 do muro'
);

// Validação de Bloqueio Físico de Projéteis (Raycast / Colisão de Tiro contra o muro)
// Atirador inimigo posicionado à frente do muro (lado da ameaça), 70 unidades de distância
const frontShooterX = coverSnap.cx - coverSnap.normalX * 70;
const frontShooterY = coverSnap.cy - coverSnap.normalY * 70;
const rayHit = rtsGame.map.checkProjectileCoverBlock(
  frontShooterX,
  frontShooterY,
  coverSnap.cx,
  coverSnap.cy,
  rtsGame.fortifiedWalls,
  rtsGame.barricades,
  rtsGame.trenches
);
assert.equal(rayHit && rayHit.blocked, true, 'Raycast de tiro vindo da direção frontal inimiga deve colidir fisicamente contra o muro');

// Validação de Alternância Rápida do Controle Touch ([Modo Seleção ▭] vs [Modo Câmera ✋])
assert.equal(rtsGame.touchControlMode, 'select', 'Modo de toque deve iniciar em Modo Seleção (select)');
rtsGame.setTouchControlMode('camera');
assert.equal(rtsGame.touchControlMode, 'camera', 'Deve alternar para Modo Câmera (camera)');
rtsGame.toggleTouchControlMode();
assert.equal(rtsGame.touchControlMode, 'select', 'toggleTouchControlMode deve voltar para Modo Seleção (select)');

// 11. Validação dos Menus Responsivos, Redimensionáveis (−/+), Móveis e Fixáveis (📌)
const hudLayoutMod = await import('../src/game/ui/hudLayout.js');
assert.equal(hudLayoutMod.HUD_PANELS.length, 5, 'HUD deve ter 5 painéis controláveis');
assert.equal(hudLayoutMod.clampHudScale(5), hudLayoutMod.HUD_SCALE_MAX, 'Escala do painel deve respeitar o máximo');
assert.equal(hudLayoutMod.clampHudScale(0.1), hudLayoutMod.HUD_SCALE_MIN, 'Escala do painel deve respeitar o mínimo');
assert.equal(hudLayoutMod.clampHudScale('abc'), 1, 'Escala inválida deve voltar para 100%');
assert.ok(
  hudLayoutMod.computeAutoHudScale(800, 450) < hudLayoutMod.computeAutoHudScale(1920, 1080),
  'Escala automática responsiva deve diminuir em telas menores'
);
assert.equal(
  hudLayoutMod.createDefaultHudLayout(400).command.collapsed,
  true,
  'No celular o painel Comando & Base deve iniciar recolhido'
);
const clampedPos = hudLayoutMod.clampPanelPosition(5000, -300, 300, 200, 1280, 720);
assert.deepEqual(clampedPos, { x: 976, y: 4 }, 'Painel arrastado deve ser mantido dentro da tela');

const memStore = new Map();
const fakeStorage = { getItem: (k) => memStore.get(k) ?? null, setItem: (k, v) => memStore.set(k, v) };
const customLayout = hudLayoutMod.createDefaultHudLayout(1680);
customLayout.squad = { scale: 1.3, pinned: true, collapsed: false, x: 900, y: 400 };
hudLayoutMod.saveHudLayout(fakeStorage, customLayout);
const reloadedLayout = hudLayoutMod.loadHudLayout(fakeStorage, 1680);
assert.equal(reloadedLayout.squad.scale, 1.3, 'Tamanho manual do painel deve persistir');
assert.equal(reloadedLayout.squad.pinned, true, 'Painel fixado deve persistir após recarregar');
assert.equal(reloadedLayout.squad.x, 900, 'Posição livre do painel deve persistir');
assert.equal(
  hudLayoutMod.sanitizeHudLayout({ hotbar: { scale: 9, x: 10 } }).hotbar.x,
  null,
  'Posição incompleta (sem y) deve voltar para a âncora padrão'
);

// 12. Validação: Slots 1-para-1 na Cobertura, Waypoints Contornando Objetos, Transporte de Tropas, Tech Tree (% + Drones), Fim de Jogo e SoundManager
const livingCheck = restoredRifle.getLivingSoldiers();
assert.ok(livingCheck.length >= 2, 'Deve haver soldados vivos para validar slots 1-para-1');
assert.ok(livingCheck[0].targetPos && livingCheck[1].targetPos, 'Cada soldado deve receber targetPos único na cobertura');
const slotSeparation = Math.hypot(
  livingCheck[0].targetPos.x - livingCheck[1].targetPos.x,
  livingCheck[0].targetPos.y - livingCheck[1].targetPos.y
);
assert.ok(slotSeparation >= 12.0, 'Espaçamento mínimo entre soldados na cobertura deve ser >= 1.2m (12 unidades)');

const bldObstacle = rtsGame.map.structures[0];
const detourPath = rtsGame.map.computeObstacleDetourPath(
  bldObstacle.x - 220,
  bldObstacle.y,
  bldObstacle.x + 220,
  bldObstacle.y,
  24,
  rtsGame.fortifiedWalls,
  rtsGame.barricades
);
assert.ok(detourPath.length >= 3, 'computeObstacleDetourPath deve gerar waypoints intermediários contornando a construção');

// Transporte de Tropas: Embarque e Desembarque [Tecla U]
const transportVeh = rtsGame.spawnUnit('player', 'troop_transport', 1600, 4800, 0);
assert.equal(transportVeh.spec.isTransport, true, 'troop_transport deve ser um Veículo de Transporte');
restoredRifle.x = 1580;
restoredRifle.y = 4800;
restoredRifle.setBoardTransportOrder(transportVeh);
rtsGame._updateUnitsAndCombat(0.05);
assert.equal(restoredRifle.embarkedInId, transportVeh.id, 'Esquadrão próximo deve embarcar dentro do Transporte');
assert.equal(transportVeh.cargoSquadIds.includes(restoredRifle.id), true, 'Transporte deve registrar o esquadrão a bordo');

// Garante que o transporte carregado se move livremente sem travar na colisão dos passageiros
const trStartX = transportVeh.x;
transportVeh.setMoveOrder(trStartX + 180, transportVeh.y);
for (let step = 0; step < 12; step++) {
  rtsGame._updateUnitsAndCombat(0.1);
}
assert.ok(transportVeh.x - trStartX > 45, 'Transporte carregado deve manter velocidade normal sem travar nos passageiros');

const disembarkedCount = rtsGame.disembarkAllFromTransport(transportVeh.id);
assert.equal(disembarkedCount, 1, 'disembarkAllFromTransport deve desembarcar o esquadrão');
assert.equal(restoredRifle.embarkedInId, null, 'Esquadrão desembarcado não deve mais estar embarcado');

// Progressão do QG (Nv. 1 -> 2 -> 3), Pontos de Comando (CP), Árvore de Pesquisa e Drones 3D
const { computeTechResearchCost, TECH_NODE_BY_ID } = await import('../src/game/data/techTreeData.js');
assert.equal(rtsGame.hqLevel, 1, 'Partida deve iniciar no QG Nível 1');
assert.equal(rtsGame.startResearch('kevlar_vests', 0.75), false, 'QG Nível 1 deve bloquear pesquisas de Nível 2');
assert.equal(rtsGame.recruitUnitById('mbt_tank'), false, 'QG Nível 1 deve bloquear Tanque MBT');

rtsGame.supplies = 3000;
rtsGame.ammo = 800;
rtsGame.fuel = 800;
rtsGame.addCommandPoints(150);
assert.equal(rtsGame.upgradeHq(), true, 'Deve evoluir QG para Nível 2 com 150 CP e recursos');
assert.equal(rtsGame.hqLevel, 2, 'hqLevel deve ser 2 após evolução');

const quote25 = computeTechResearchCost(TECH_NODE_BY_ID.kevlar_vests, 1000, 100, 0.25, 200);
const quote75 = computeTechResearchCost(TECH_NODE_BY_ID.kevlar_vests, 1000, 100, 0.75, 200);
assert.ok(quote75.supplyCost > quote25.supplyCost, 'Investir 75% do orçamento deve custar mais Suprimentos que 25%');
assert.ok(quote75.duration < quote25.duration, 'Investir 75% deve concluir a pesquisa mais rápido que 25%');

const hpBeforeKevlar = restoredRifle.soldiers.find((s) => s.alive).maxHp;
assert.equal(rtsGame.startResearch('kevlar_vests', 0.75), true, 'Deve iniciar pesquisa Coletes de Kevlar no QG Nv. 2');
rtsGame._updateResearch(quote75.duration + 0.5);
assert.equal(rtsGame.completedTechs.has('kevlar_vests'), true, 'Pesquisa Coletes de Kevlar deve concluir');
assert.ok(restoredRifle.soldiers.find((s) => s.alive).maxHp > hpBeforeKevlar, 'Coletes de Kevlar devem aumentar o HP individual');

// Evolução para QG Nível 3 + Drones (450+ / 700+ CP)
assert.equal(rtsGame.startResearch('uav_recon', 0.75), false, 'QG Nível 2 deve bloquear Drone UAV');
rtsGame.supplies = 4000;
rtsGame.ammo = 1500;
rtsGame.fuel = 1000;
rtsGame.addCommandPoints(550);
assert.equal(rtsGame.upgradeHq(), true, 'Deve evoluir QG para Nível 3 com 450+ CP');
assert.equal(rtsGame.hqLevel, 3, 'hqLevel deve ser 3 após segunda evolução');

rtsGame.supplies = 4000;
rtsGame.ammo = 1500;
rtsGame.fuel = 1000;
assert.equal(rtsGame.startResearch('uav_recon', 0.75), true, 'Deve iniciar pesquisa Drone UAV no QG Nv. 3 + 450 CP');
rtsGame._updateResearch(30);
assert.equal(rtsGame.launchDrone('uav_recon', 4800, 4800), false, 'Sem Fábrica de Drones não deve lançar Drone');
rtsGame.baseBuildings.push({
  id: 'smoke_drone_factory',
  buildingType: 'drone_factory',
  team: 'allies',
  faction: 'player',
  x: 1100,
  y: 4400,
  hp: 1350,
  maxHp: 1350,
  alive: true,
});
assert.equal(rtsGame.queueDroneProduction('uav_recon'), true, 'Deve fabricar Drone UAV na Fábrica de Drones');
rtsGame._updateDrones(10);
assert.equal(rtsGame.launchDrone('uav_recon', 4800, 4800), true, 'Deve lançar Drone Quadricóptero UAV 3D após fabricação');
assert.equal(rtsGame.activeDrones.length, 1, 'Drone UAV deve estar ativo no campo');
rtsGame._updateDrones(0.2);
assert.ok(rtsGame.map.tempVisionZones.length >= 1, 'Drone UAV deve revelar névoa de guerra sem travar');

rtsGame.supplies = 4000;
rtsGame.ammo = 1500;
rtsGame.fuel = 1000;
assert.equal(rtsGame.startResearch('fpv_kamikaze', 0.75), true, 'Deve iniciar pesquisa Drone Kamikaze FPV');
rtsGame._updateResearch(35);
assert.equal(rtsGame.queueDroneProduction('fpv_kamikaze'), true, 'Deve fabricar Drone FPV na Fábrica de Drones');
rtsGame._updateDrones(12);
assert.equal(rtsGame.launchDrone('fpv_kamikaze', 4800, 4800), true, 'Deve lançar Drone FPV Kamikaze');
rtsGame._updateDrones(0.2);

// SoundManager Procedural
rtsGame.audio.setMusicMode('menu');
rtsGame.audio.setMusicMode('battle');
rtsGame.audio.updateContinuousVehiclesAndDrones({ movingVehicles: 2, maxSpeedRatio: 0.8, closestVehicleDist: 300, activeDrones: 1, closestDroneDist: 400, paused: false });

// Fim de Jogo (Vitória)
rtsGame._triggerGameOver('allies', 'VITÓRIA TOTAL — FRENTE CONQUISTADA!', 'Teste de encerramento');
assert.equal(rtsGame.gameOver, true, 'gameOver deve travar em true ao encerrar partida');
assert.equal(rtsGame.victoryState, 'allies', 'victoryState deve registrar allies');

// Segundo Mapa: Deserto de El Alamein (12 Setores) + Dificuldade IA + Relevo 3D (getTerrainHeight)
const { getTerrainHeight } = await import('../src/game/world/terrainHeight.js');
const hCenter = getTerrainHeight(4800, 4800, rtsGame.map);
const hCrater = getTerrainHeight(rtsGame.map.craters[0].x, rtsGame.map.craters[0].y, rtsGame.map);
assert.ok(Number.isFinite(hCenter) && Number.isFinite(hCrater), 'getTerrainHeight deve retornar altura numérica válida');
assert.ok(hCrater < hCenter + 15, 'Cratera 3D deve gerar depressão real no relevo');

rtsGame.setupMatch('1v1', 600, 'el_alamein_ridge', 'hard');
assert.equal(rtsGame.map.mapId, 'el_alamein_ridge', 'setupMatch deve carregar o mapa Deserto de El Alamein');
assert.equal(rtsGame.map.theme, 'desert', 'Mapa 2 deve usar tema desert');
assert.equal(rtsGame.map.sectors.length, 12, 'Mapa 2 deve conter 12 pontos estratégicos');
assert.equal(rtsGame.aiDifficulty, 'hard', 'Dificuldade da IA deve ser definida como hard');
assert.ok(rtsGame.map.structures.length >= 6, 'Mapa 2 deve conter construções táticas do deserto');

// Terceiro Mapa: Bastogne Inverno Ardenas + Arbustos Volumétricos + Skins do Exército
rtsGame.setupMatch('1v1', 600, 'bastogne_winter', 'medium');
assert.equal(rtsGame.map.mapId, 'bastogne_winter', 'setupMatch deve carregar Bastogne Inverno');
assert.equal(rtsGame.map.theme, 'winter', 'Mapa 3 deve usar tema winter');
assert.equal(rtsGame.map.sectors.length, 12, 'Mapa 3 deve conter 12 pontos estratégicos');
assert.ok(rtsGame.map.bushes.length >= 200, 'Mapa deve gerar arbustos volumétricos para camuflagem');
const b0 = rtsGame.map.bushes[0];
assert.equal(rtsGame.map.hasBushCover(b0.x, b0.y), true, 'hasBushCover deve detectar cobertura dentro do arbusto');
rtsGame.setPlayerSkin('arctic_ghost');
assert.equal(rtsGame.playerSkinId, 'arctic_ghost', 'Skin do exército deve atualizar para arctic_ghost');

// RTB / Reparo na Base [B] & Diferenciação Assalto vs Fuzileiros
const { COMMAND_BY_ID } = await import('../src/game/data/rtsData.js');
assert.ok(
  COMMAND_BY_ID.assault_squad.unitSpec.speed > COMMAND_BY_ID.rifle_squad.unitSpec.speed * 1.2,
  'Esquadrão de Assalto deve ser >=20% mais rápido que Fuzileiros'
);
assert.ok(
  COMMAND_BY_ID.assault_squad.unitSpec.fireRate >= 4.5 && COMMAND_BY_ID.assault_squad.unitSpec.range < COMMAND_BY_ID.rifle_squad.unitSpec.range,
  'Esquadrão de Assalto deve ter cadência SMG rápida e alcance menor que Fuzileiros'
);
const dmgVeh = rtsGame.spawnUnit('player', 'humvee', 3000, 4800, 0);
dmgVeh.hp = 200;
dmgVeh.selected = true;
assert.equal(rtsGame.returnSelectedToBase(), true, 'Veículo selecionado deve aceitar ordem de Retornar à Base [B]');
assert.equal(dmgVeh.order.type, 'rtb', 'Ordem do veículo deve ser rtb');
dmgVeh.x = rtsGame.map.hqs.player.x + 80;
dmgVeh.y = rtsGame.map.hqs.player.y;
rtsGame._updateUnitsAndCombat(1.0);
assert.ok(dmgVeh.hp > 205, 'Veículo na base deve receber reparo automático (+15 HP/s)');

// Pathfinding com contorno de obstáculos (computeObstacleFreePath)
const stHouse = rtsGame.map.structures[0];
const obstacleFreePath = rtsGame.map.computeObstacleFreePath(
  { x: stHouse.x - 160, y: stHouse.y },
  { x: stHouse.x + 160, y: stHouse.y },
  18,
  rtsGame.fortifiedWalls,
  rtsGame.barricades
);
assert.ok(obstacleFreePath.length >= 2, 'computeObstacleFreePath deve gerar waypoints contornando construções/obstáculos');

// Campo de Detenção & Inteligência (POW Camp) obrigatório e 4 opções de Interrogatório
let interrogatedCalled = false;
rtsGame.onInterrogate = () => {
  interrogatedCalled = true;
};
const surrenderedSq = rtsGame.spawnUnit('enemy_1', 'rifle_squad', 3000, 4800, 0);
surrenderedSq.surrendered = true;
rtsGame._openInterrogationFor(surrenderedSq);
assert.equal(interrogatedCalled, false, 'Sem Campo de Detenção (pow_camp), não deve abrir interrogatório');

rtsGame.supplies = 4000;
rtsGame.fuel = 1000;
assert.equal(rtsGame.constructBaseBuilding('pow_camp'), true, 'Deve construir Campo de Detenção & Inteligência na Base');
assert.equal(rtsGame.constructBaseBuilding('spec_ops_center'), true, 'Deve construir Operações Especiais na Base');
assert.equal(rtsGame.constructBaseBuilding('motor_pool'), true, 'Deve construir Fábrica de Blindados na Base');
assert.equal(rtsGame.constructBaseBuilding('air_command'), true, 'Deve construir Comando Aéreo na Base');

const allyBlds = rtsGame.baseBuildings.filter((b) => b.team === 'allies' && b.alive !== false);
for (let i = 0; i < allyBlds.length; i++) {
  const bi = allyBlds[i];
  if (bi.buildingType !== 'hq_command') {
    assert.equal(rtsGame.map.isOnRoad(bi.x, bi.y, 10), false, `${bi.buildingType} não pode ficar sobre a estrada`);
  }
  for (let j = i + 1; j < allyBlds.length; j++) {
    const bj = allyBlds[j];
    const gap = Math.hypot(bi.x - bj.x, bi.y - bj.y) - (bi.radius || 90) - (bj.radius || 90);
    assert.ok(gap >= 135, `Distância entre ${bi.buildingType} e ${bj.buildingType} deve ser >= 14m (gap=${gap.toFixed(1)})`);
  }
}

const powCamp = rtsGame.baseBuildings.find((b) => b.faction === 'player' && b.buildingType === 'pow_camp');
assert.equal(rtsGame.capturePrisoner(surrenderedSq), true, 'Com Campo POW, deve capturar Comandante diretamente para a cela');
assert.equal(rtsGame.powPrisoners.length, 1, 'Comandante capturado deve entrar na cela do Campo POW');
assert.equal(surrenderedSq.captured, true, 'Comandante capturado deve ser removido do campo de batalha');

const supBeforeConvoy = rtsGame.supplies;
rtsGame.resolveInterrogation('convoy', surrenderedSq.id);
assert.equal(rtsGame.supplies, supBeforeConvoy + 350, 'Opção 2 (convoy) deve conceder +350 SUP');
assert.ok(rtsGame.enemyProductionDebuffTimer >= 44, 'Opção 2 (convoy) deve aplicar debuff de -30% na produção inimiga');

rtsGame.resolveInterrogation('sabotage', 'fake_pow');
assert.ok(rtsGame.enemySabotageTimer >= 39, 'Opção 3 (sabotage) deve desativar torres/radares inimigos por 40s');

rtsGame.resolveInterrogation('maps', 'fake_pow_2');
assert.equal(rtsGame.intelRevealed, true, 'Opção 1 (maps) deve revelar minas/trincheiras e abrir Névoa dos QGs');

// Bloqueio de Linha de Visão por Prédios (isLineBlockedByStructures) e Nivelamento (clearFoliageAndFlattenUnderBuilding)
const struct0 = rtsGame.map.structures[0];
assert.equal(
  rtsGame.map.isLineBlockedByStructures(struct0.x - 160, struct0.y, struct0.x + 160, struct0.y, null),
  true,
  'Casas e prédios devem bloquear linha de visão/tiro entre unidades'
);
assert.equal(
  rtsGame.map.isLineBlockedByStructures(struct0.x - 160, struct0.y, struct0.x + 160, struct0.y, struct0.id),
  false,
  'Unidade guarnecida dentro do próprio prédio deve poder atirar pelas janelas'
);

// Tanque MBT disparando projétil explosivo HE/AP com splash de 4.5m (45u) + Coaxial 7.62mm
const testTank = rtsGame.spawnUnit('player', 'mbt_tank', 4000, 4000, 0);
testTank.fireCooldown = 0;
const targetInf = rtsGame.spawnUnit('enemy_1', 'rifle_squad', 4035, 4000, Math.PI);
rtsGame.intelRevealed = true;
const tankBulletsBefore = rtsGame.bullets.length;
rtsGame._updateUnitsAndCombat(0.1);
assert.ok(rtsGame.bullets.length > tankBulletsBefore, 'Tanque MBT deve adquirir alvo e disparar canhão principal 120mm automaticamente');
const firedShell = rtsGame.bullets.find((b) => b.isTankShell);
assert.ok(Boolean(firedShell), 'Projétil do MBT deve ser isTankShell');
assert.ok(firedShell.damage >= 135, 'Canhão principal 120mm deve causar 135+ de dano');
const infHpBefore = targetInf.hp;
rtsGame._detonateTankShell({ x: 4030, y: 4000, team: 'allies', damage: 135, splashRadius: 45 });
assert.ok(targetInf.hp < infHpBefore, 'Detonação de projétil de tanque deve causar dano em área (4.5m)');
// Coaxial enquanto recarrega
const bulletsBeforeCoax = rtsGame.bullets.length;
rtsGame._updateUnitsAndCombat(0.3);
assert.ok(rtsGame.bullets.length > bulletsBeforeCoax, 'Tanque MBT deve disparar metralhadora coaxial enquanto o canhão 120mm recarrega');

// Transporte de Tropas carregado deve ser selecionável e se mover normalmente (sem travar no esquadrão embarcado)
const paxSquad = rtsGame.spawnUnit('player', 'rifle_squad', 3200, 4800, 0);
const truck = rtsGame.spawnUnit('player', 'troop_transport', 3220, 4800, 0);
paxSquad.setBoardTransportOrder(truck, [{ x: truck.x, y: truck.y }]);
rtsGame._updateUnitsAndCombat(0.1);
assert.equal(paxSquad.embarkedInId, truck.id, 'Esquadrão deve embarcar no caminhão de transporte');
const picked = rtsGame._findUnitNearWorld(truck.x, truck.y, 54, (u) => u.faction === 'player');
assert.equal(picked?.id, truck.id, 'Clicar no caminhão carregado deve selecionar o caminhão e não a tropa embarcada');
truck.setMoveOrder(3500, 4800, null, null, [{ x: 3500, y: 4800 }]);
const truckXBefore = truck.x;
rtsGame._updateUnitsAndCombat(0.5);
assert.ok(truck.x > truckXBefore + 10, 'Caminhão carregado deve se mover normalmente quando ordenado');
const disCount = rtsGame.disembarkAllFromTransport(truck.id);
assert.equal(disCount, 1, 'Deve desembarcar o esquadrão do caminhão');
assert.equal(paxSquad.embarkedInId, null, 'Esquadrão desembarcado deve limpar embarkedInId');
assert.ok(paxSquad.soldiers.every((s) => s.worldX > 0 && s.worldY > 0), 'Soldados desembarcados devem restaurar coordenadas reais ao lado do caminhão');

// Sistema de Camuflagem e Emboscada em Florestas (Forest Stealth Zone)
rtsGame.setupMatch('1v1', 600, 'normandy', 'medium');
const fz = rtsGame.map.forestZones[0];
assert.ok(fz, 'Mapa deve possuir zonas de floresta fechada (forestZones)');
const ambushSq = rtsGame.spawnUnit('player', 'rifle_squad', fz.x, fz.y, 0);
rtsGame._updateUnitsAndCombat(0.1);
assert.equal(ambushSq.inForestStealth, true, 'Infantaria dentro da floresta deve ativar inForestStealth (+50% DEF)');
assert.equal(ambushSq.camouflagedInForest, true, 'Infantaria parada na floresta deve ficar camuflada (invisível à distância)');
const hpForestBefore = ambushSq.hp;
ambushSq.takeDamage(100, 'enemies', rtsGame, false, false, fz.x, fz.y);
assert.ok(hpForestBefore - ambushSq.hp <= 55, 'Camuflagem na floresta deve conceder +50% de defesa');

// Fila de Produção 1-5 Slots com cancelamento e reembolso 100%
rtsGame.supplies = 2000;
rtsGame.ammo = 500;
rtsGame.fuel = 500;
rtsGame.constructBaseBuilding('motor_pool');
const motorPool = rtsGame.baseBuildings.find((b) => b.faction === 'player' && b.buildingType === 'motor_pool');
assert.equal(rtsGame.queueUnitAtBuilding(motorPool.id, 'mbt_tank'), false, 'Não deve enfileirar Tanque MBT sem QG Nível 3');
rtsGame.hqLevel = 2;
const supBeforeQ = rtsGame.supplies;
assert.equal(rtsGame.queueUnitAtBuilding(motorPool.id, 'apc_stryker'), true, 'Deve enfileirar APC BTR/Stryker na Fábrica');
assert.equal(motorPool.productionQueue.length, 1, 'Fila deve conter 1 item');
assert.equal(rtsGame.cancelBuildingQueueItem(motorPool.id, 0), true, 'Botão direito deve cancelar item da fila');
assert.equal(rtsGame.supplies, supBeforeQ, 'Cancelar item da fila deve reembolsar 100% dos recursos');

// APC BTR / Stryker: Atira canhão 30mm mesmo com infantaria embarcada
const apcUnit = rtsGame.spawnUnit('player', 'apc_stryker', 2600, 4800, 0);
apcUnit.fireCooldown = 0;
const apcPax = rtsGame.spawnUnit('player', 'rifle_squad', 2595, 4800, 0);
apcPax.setBoardTransportOrder(apcUnit);
rtsGame._updateUnitsAndCombat(0.05);
assert.equal(apcPax.embarkedInId, apcUnit.id, 'APC Stryker deve embarcar infantaria');
const apcEnemy = rtsGame.spawnUnit('enemy_1', 'rifle_squad', 2820, 4800, Math.PI);
rtsGame.intelRevealed = true;
rtsGame.bullets = [];
rtsGame._updateUnitsAndCombat(0.1);
assert.ok(rtsGame.bullets.length > 0 || apcUnit.muzzleFlashTimer > 0, 'APC BTR/Stryker deve disparar canhão 30mm mesmo transportando infantaria');

// Limite de 3 Postos de Suprimentos por Setor Capturado
const capSec = rtsGame.map.sectors[0];
capSec.owner = 'neutral';
const statusNeutral = rtsGame.getOutpostPlacementStatus(capSec.x + 40, capSec.y, 'allies');
assert.equal(statusNeutral.ok, false, 'Não deve permitir Posto de Suprimento em setor neutro');
capSec.owner = 'allies';
const outposts = [];
for (let k = 0; k < 3; k++) {
  const st = rtsGame.getOutpostPlacementStatus(capSec.x + 20 * k, capSec.y, 'allies');
  assert.equal(st.ok, true, `Deve permitir construir posto ${k + 1}/3 no setor capturado`);
  outposts.push(rtsGame.spawnUnit('player', 'build_outpost', capSec.x + 20 * k, capSec.y, 0));
}
const statusFull = rtsGame.getOutpostPlacementStatus(capSec.x + 80, capSec.y, 'allies');
assert.equal(statusFull.ok, false, 'Deve bloquear 4º posto no mesmo setor (limite 3/3)');
assert.equal(statusFull.reason, 'cap_reached', 'Motivo deve ser cap_reached');
outposts[0].alive = false;
const statusFreed = rtsGame.getOutpostPlacementStatus(capSec.x + 80, capSec.y, 'allies');
assert.equal(statusFreed.ok, true, 'Destruir 1 posto deve liberar a vaga (2/3)');

// Rede de Trincheiras Conectadas e Navegação Interna
const trNetPath = rtsGame.findTrenchNetworkPath(
  rtsGame.trenches[0].points[0].x,
  rtsGame.trenches[0].points[0].y,
  rtsGame.trenches[0].points[rtsGame.trenches[0].points.length - 1].x,
  rtsGame.trenches[0].points[rtsGame.trenches[0].points.length - 1].y
);
assert.ok(Array.isArray(trNetPath) && trNetPath.length >= 2, 'findTrenchNetworkPath deve calcular caminho interno na trincheira');

console.log('SMOKE TEST RTS 3D OK: QG Nv. 1-3, CP, Drones, 12 Setores, 3 Mapas, RTB/Reparo [B], Pathfinding, Campo POW, LOS, Tanques HE/AP, Transporte, Camuflagem e Fila 1-5 Slots validados.');



