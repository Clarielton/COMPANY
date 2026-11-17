import { DISTRICT_SIZE, ECONOMY, WAR } from '../config.js';
import { INITIAL_DISTRICTS, RIVAL_IDS, FACTIONS } from '../data/factions.js';
import { Pedestrian } from '../entities/Pedestrian.js';
import { pick } from '../core/math.js';

export class TerritorySystem {
  constructor() {
    this.districts = INITIAL_DISTRICTS.map((d, index) => ({
      ...d,
      index,
      killsTowardWar: 0,
      peaceTimer: 0,
    }));
    this.activeWar = null;
    this.incomeTimer = ECONOMY.INCOME_INTERVAL;
  }

  getDistrictAt(x, y, map) {
    const idx = map.getDistrictIndexAt(x, y);
    return this.districts[idx];
  }

  countOwned() {
    return this.districts.filter((d) => d.owner === 'player').length;
  }

  registerKill(game, ped, attackerFaction) {
    if (attackerFaction !== 'player') return;
    if (!RIVAL_IDS.includes(ped.faction)) return;

    if (this.activeWar) {
      if (ped.isWarEnemy) {
        const alive = this._countWarEnemies(game);
        this.activeWar.remainingEnemies = alive;
      }
      return;
    }

    const district =
      ped.districtIndex >= 0
        ? this.districts[ped.districtIndex]
        : this.getDistrictAt(ped.x, ped.y, game.map);

    if (!district || district.owner !== ped.faction) return;

    district.killsTowardWar += 1;
    district.peaceTimer = 25;

    if (district.killsTowardWar >= WAR.TRIGGER_KILLS) {
      this.startWar(game, district);
    } else {
      const left = WAR.TRIGGER_KILLS - district.killsTowardWar;
      game.spawnText(ped.x, ped.y - 18, `Guerra em ${left} abate(s)`, '#facc15');
    }
  }

  startWar(game, district) {
    district.killsTowardWar = 0;
    district.peaceTimer = 0;

    this.activeWar = {
      districtIndex: district.index,
      districtName: district.name,
      factionId: district.owner,
      wave: 1,
      totalWaves: WAR.WAVES.length,
      state: 'fighting',
      timer: 0,
      leaveTimer: 0,
      remainingEnemies: 0,
    };

    this._spawnWave(game, 1);
    const facName = FACTIONS[district.owner]?.name || district.owner;
    game.notify('GUERRA DE TERRITÓRIO!', `${district.name} (${facName}) — Onda 1/3`, '#ff2a85');
    game.audio.play('alarm');
  }

  _spawnWave(game, waveNum) {
    if (!this.activeWar) return;
    const cfg = WAR.WAVES[waveNum - 1] || WAR.WAVES[0];
    const d = this.districts[this.activeWar.districtIndex];
    const minX = d.col * DISTRICT_SIZE + 64;
    const maxX = (d.col + 1) * DISTRICT_SIZE - 64;
    const minY = d.row * DISTRICT_SIZE + 64;
    const maxY = (d.row + 1) * DISTRICT_SIZE - 64;

    let spawned = 0;
    for (let i = 0; i < cfg.count; i++) {
      let pt = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 340 + Math.random() * 260;
        const sx = Math.max(minX, Math.min(maxX, game.player.x + Math.cos(ang) * r));
        const sy = Math.max(minY, Math.min(maxY, game.player.y + Math.sin(ang) * r));
        if (!game.map.isSolidAt(sx, sy)) {
          pt = { x: sx, y: sy };
          break;
        }
      }
      if (!pt) {
        pt = game.map.randomSidewalkPoint(game.player.x, game.player.y, 260, 620);
      }

      const enemy = new Pedestrian({
        x: pt.x,
        y: pt.y,
        faction: this.activeWar.factionId,
        role: 'gang',
        weaponId: pick(cfg.weapons),
        hp: 75 + waveNum * 15,
        armor: cfg.armor,
        districtIndex: d.index,
        isWarEnemy: true,
      });
      enemy.state = 'combat';
      enemy.target = game.player;
      enemy.alertTimer = 999;
      game.peds.push(enemy);
      spawned += 1;
    }
    this.activeWar.remainingEnemies = spawned;
  }

  _countWarEnemies(game) {
    let c = 0;
    for (const p of game.peds) {
      if (p.alive && p.isWarEnemy) c += 1;
    }
    return c;
  }

  update(game, dt) {
    // Renda passiva periódica de territórios conquistados
    const owned = this.countOwned();
    if (owned > 0) {
      this.incomeTimer -= dt;
      if (this.incomeTimer <= 0) {
        this.incomeTimer = ECONOMY.INCOME_INTERVAL;
        const payout = owned * ECONOMY.INCOME_PER_DISTRICT;
        game.player.money += payout;
        game.audio.play('cash');
        game.spawnText(game.player.x, game.player.y - 26, `+$${payout} Renda`, '#00f5d4');
        game.notify('RENDA DE TERRITÓRIOS', `+$${payout} recebidos (${owned} zonas)`, '#00f5d4');
      }
    } else {
      this.incomeTimer = ECONOMY.INCOME_INTERVAL;
    }

    // Decaimento do contador de provocações fora de guerra
    for (const d of this.districts) {
      if (d.killsTowardWar > 0) {
        d.peaceTimer -= dt;
        if (d.peaceTimer <= 0) d.killsTowardWar = 0;
      }
    }

    if (!this.activeWar) return;

    const war = this.activeWar;
    const playerDistrictIdx = game.map.getDistrictIndexAt(game.player.x, game.player.y);

    // Se o jogador fugir da zona por tempo demais, perde a guerra
    if (playerDistrictIdx !== war.districtIndex) {
      war.leaveTimer += dt;
      if (war.leaveTimer >= WAR.LEAVE_LIMIT) {
        for (const p of game.peds) {
          if (p.isWarEnemy) p.isWarEnemy = false;
        }
        game.notify('GUERRA ABANDONADA', `Você deixou ${war.districtName}.`, '#f87171');
        this.activeWar = null;
        return;
      }
    } else {
      war.leaveTimer = Math.max(0, war.leaveTimer - dt * 2);
    }

    if (war.state === 'fighting') {
      war.remainingEnemies = this._countWarEnemies(game);
      if (war.remainingEnemies <= 0) {
        if (war.wave < war.totalWaves) {
          war.state = 'intermission';
          war.timer = WAR.INTERMISSION;
          game.notify(
            `ONDA ${war.wave}/${war.totalWaves} SOBREVIVIDA!`,
            `Próxima onda em ${WAR.INTERMISSION}s...`,
            '#facc15'
          );
        } else {
          // Território conquistado!
          const district = this.districts[war.districtIndex];
          district.owner = 'player';
          district.killsTowardWar = 0;
          game.player.money += ECONOMY.WAR_BONUS;
          game.audio.play('win');
          game.spawnText(game.player.x, game.player.y - 34, `+$${ECONOMY.WAR_BONUS}`, '#00f5d4');
          game.notify(
            'TERRITÓRIO CONQUISTADO!',
            `${district.name} agora é seu! (+$${ECONOMY.WAR_BONUS})`,
            '#00f5d4'
          );
          this.activeWar = null;
        }
      }
    } else if (war.state === 'intermission') {
      war.timer -= dt;
      if (war.timer <= 0) {
        war.wave += 1;
        war.state = 'fighting';
        this._spawnWave(game, war.wave);
        game.notify(
          `ONDA ${war.wave}/${war.totalWaves}`,
          `Defenda ${war.districtName}!`,
          '#ff2a85'
        );
      }
    }
  }
}
