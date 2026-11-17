import { WANTED, ECONOMY, SPAWN } from '../config.js';
import { clamp, dist } from '../core/math.js';
import { Pedestrian } from '../entities/Pedestrian.js';
import { Vehicle } from '../entities/Vehicle.js';

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.evading = false;
    this.evadeTimer = 0;
    this.spawnTimer = 0;
    this.roadblockTimer = 0;
    this.lastSeen = { x: 0, y: 0 };
  }

  get bribeCost() {
    return this.stars * ECONOMY.BRIBE_PER_STAR;
  }

  get evadeProgress() {
    if (this.stars === 0 || !this.evading) return 0;
    const target = WANTED.hideTime[this.stars] || 10;
    return clamp(this.evadeTimer / target, 0, 1);
  }

  _computeStars(heat) {
    let s = 0;
    for (let i = 1; i < WANTED.thresholds.length; i++) {
      if (heat >= WANTED.thresholds[i]) s = i;
    }
    return s;
  }

  reportCrime(amount, reason = 'Crime') {
    this.addHeat(amount, reason);
  }

  addHeat(amount, reason = '') {
    const prev = this.stars;
    this.heat = clamp(this.heat + amount, 0, WANTED.maxHeat);
    this.evadeTimer = 0;
    this.evading = false;
    this.stars = this._computeStars(this.heat);
    if (this.stars > prev && this._game) {
      this._game.audio.play('star');
      this._game.notify(
        `NÍVEL DE PROCURADO: ${'★'.repeat(this.stars)}`,
        reason || 'A polícia está em alerta!',
        '#3a86ff'
      );
    }
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.evadeTimer = 0;
    this.evading = false;
  }

  bribePolice(game) {
    if (this.stars === 0) return { ok: false, msg: 'Você não está sendo procurado.' };
    const cost = this.bribeCost;
    if (game.player.money < cost) {
      return { ok: false, msg: `Precisa de $${cost.toLocaleString()} para subornar.` };
    }
    game.player.money -= cost;
    this.clear();
    for (const p of game.peds) {
      if (p.faction === 'police') {
        p.state = 'wander';
        p.alertTimer = 0;
      }
    }
    for (const v of game.vehicles) {
      if (v.spec.police) {
        v.sirenOn = false;
        if (v.aiRole === 'police' || v.aiRole === 'roadblock') {
          v.aiRole = 'traffic';
        }
      }
    }
    game.audio.play('cash');
    game.notify('SUBORNO ACEITO', `Mandado limpo por $${cost.toLocaleString()}`, '#3a86ff');
    return { ok: true };
  }

  update(game, dt) {
    this._game = game;
    if (!game.player.alive) return;

    this.stars = this._computeStars(this.heat);
    if (this.stars === 0) {
      this.evading = false;
      this.evadeTimer = 0;
      return;
    }

    const { player, map } = game;

    // Verificar linha de visão da polícia
    let spotted = false;
    for (const ped of game.peds) {
      if (!ped.alive || ped.faction !== 'police') continue;
      if (dist(ped.x, ped.y, player.x, player.y) <= 680) {
        if (!map.raycast(ped.x, ped.y, player.x, player.y).hit) {
          spotted = true;
          break;
        }
      }
    }
    if (!spotted) {
      for (const veh of game.vehicles) {
        if (veh.dead || !veh.spec.police || veh.aiRole === 'traffic') continue;
        if (dist(veh.x, veh.y, player.x, player.y) <= 720) {
          if (!map.raycast(veh.x, veh.y, player.x, player.y).hit) {
            spotted = true;
            break;
          }
        }
      }
    }

    if (spotted) {
      this.evading = false;
      this.evadeTimer = 0;
      this.lastSeen = { x: player.x, y: player.y };
    } else {
      this.evading = true;
      this.evadeTimer += dt;
      const limit = WANTED.hideTime[this.stars] || 10;
      if (this.evadeTimer >= limit) {
        this.evadeTimer = 0;
        if (this.stars <= 1) {
          this.clear();
          game.notify('FUGA BEM-SUCEDIDA!', 'Você despistou a polícia.', '#00f5d4');
          return;
        } else {
          this.heat = WANTED.thresholds[this.stars - 1] + 30;
          this.stars = this._computeStars(this.heat);
          game.notify('PERSEGUIÇÃO REDUZIDA', `Nível caiu para ${this.stars} estrela(s).`, '#38bdf8');
        }
      }
    }

    // Reforços policiais proporcionais às estrelas (1 a 5)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.2, 3.8 - this.stars * 0.5);
      this._maintainPolicePresence(game);
    }

    // Bloqueios nas ruas a partir de 3 estrelas
    if (this.stars >= 3) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        this.roadblockTimer = this.stars >= 5 ? 10 : 15;
        this._spawnRoadblock(game);
      }
    }
  }

  _maintainPolicePresence(game) {
    const { player, map } = game;
    const maxFoot = WANTED.maxFoot[this.stars] || 3;
    const maxCars = WANTED.maxCars[this.stars] || 1;

    let footCount = 0;
    let carCount = 0;
    for (const p of game.peds) {
      if (p.alive && p.faction === 'police' && dist(p.x, p.y, player.x, player.y) < SPAWN.DESPAWN) {
        footCount++;
      }
    }
    for (const v of game.vehicles) {
      if (!v.dead && v.spec.police && v.aiRole === 'police' && dist(v.x, v.y, player.x, player.y) < SPAWN.DESPAWN) {
        carCount++;
      }
    }

    if (footCount < maxFoot) {
      const pt = map.randomSidewalkPoint(player.x, player.y, 480, 960);
      const cop = this._createOfficer(pt.x, pt.y);
      game.peds.push(cop);
    }

    if (carCount < maxCars) {
      const pt = map.randomRoadPoint(player.x, player.y, 620, 1150);
      const tooClose = game.vehicles.some((v) => !v.dead && dist(v.x, v.y, pt.x, pt.y) < 110);
      if (!tooClose) {
        let typeId = 'police';
        if (this.stars === 3 || this.stars === 4) typeId = Math.random() < 0.55 ? 'swat' : 'police';
        else if (this.stars >= 5) typeId = Math.random() < 0.6 ? 'enforcer' : 'swat';

        const veh = new Vehicle({
          x: pt.x,
          y: pt.y,
          angle: Math.atan2(player.y - pt.y, player.x - pt.x),
          typeId,
          aiRole: 'police',
        });
        veh.sirenOn = true;
        game.vehicles.push(veh);
      }
    }
  }

  _createOfficer(x, y) {
    let role = 'cop';
    let weaponId = 'pistol';
    let hp = 70;
    let armor = 10;

    if (this.stars === 2) {
      weaponId = Math.random() < 0.35 ? 'shotgun' : 'pistol';
      hp = 80;
      armor = 20;
    } else if (this.stars === 3 || this.stars === 4) {
      role = 'swat';
      weaponId = Math.random() < 0.5 ? 'mp5' : 'm4';
      hp = 115;
      armor = 50;
    } else if (this.stars >= 5) {
      role = 'commando';
      weaponId = Math.random() < 0.5 ? 'm4' : 'ak47';
      hp = 145;
      armor = 85;
    }

    const ped = new Pedestrian({ x, y, faction: 'police', role, weaponId, hp, armor });
    ped.state = 'combat';
    ped.alertTimer = 30;
    return ped;
  }

  _spawnRoadblock(game) {
    const { player, map } = game;
    const roadblocks = game.vehicles.filter((v) => !v.dead && v.aiRole === 'roadblock');
    if (roadblocks.length >= 2) return;

    const pt = map.randomRoadPoint(player.x, player.y, 580, 950);
    if (game.vehicles.some((v) => !v.dead && dist(v.x, v.y, pt.x, pt.y) < 130)) return;

    const typeId = this.stars >= 5 ? 'enforcer' : 'swat';
    const veh = new Vehicle({
      x: pt.x,
      y: pt.y,
      angle: pt.angle + Math.PI / 2,
      typeId,
      aiRole: 'roadblock',
    });
    veh.sirenOn = true;
    game.vehicles.push(veh);

    // 2 agentes SWAT guarnecendo o bloqueio
    for (const side of [-1, 1]) {
      const ox = pt.x + Math.cos(pt.angle) * side * 34;
      const oy = pt.y + Math.sin(pt.angle) * side * 34;
      if (!map.isSolidAt(ox, oy)) {
        game.peds.push(this._createOfficer(ox, oy));
      }
    }
  }
}
