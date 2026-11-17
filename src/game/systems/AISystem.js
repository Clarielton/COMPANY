import { SPAWN } from '../config.js';
import { angleDiff, dist, pick, clamp } from '../core/math.js';
import { FACTIONS, RIVAL_IDS } from '../data/factions.js';
import { Pedestrian } from '../entities/Pedestrian.js';
import { Vehicle } from '../entities/Vehicle.js';
import { Particle } from '../entities/Particle.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'sports', 'muscle', 'gangvan'];

export class AISystem {
  constructor() {
    this.spawnTimer = 0;
  }

  initWorld(game) {
    // Caixas em todas as lojas de conveniência
    for (const poi of game.map.pois) {
      if (poi.type === 'store') {
        const cashier = new Pedestrian({
          x: poi.cashierX,
          y: poi.cashierY,
          faction: 'civilian',
          role: 'cashier',
          hp: 50,
          poiId: poi.id,
        });
        cashier.angle = Math.PI / 2;
        game.peds.push(cashier);
      }
    }

    // População inicial ao redor do jogador
    this._populateAroundPlayer(game, true);
  }

  _populateAroundPlayer(game, initial = false) {
    const { player, map, territorySystem } = game;
    const minR = initial ? 220 : SPAWN.RADIUS_MIN;
    const maxR = SPAWN.RADIUS_MAX;

    let civCount = 0;
    let gangCount = 0;
    let trafficCount = 0;

    for (const p of game.peds) {
      if (!p.alive || p.role === 'cashier') continue;
      const d = dist(p.x, p.y, player.x, player.y);
      if (d > SPAWN.DESPAWN && !p.isWarEnemy) {
        p.alive = false;
        p.deadTimer = 99;
        continue;
      }
      if (p.role === 'civilian') civCount++;
      else if (p.role === 'gang' && !p.isWarEnemy) gangCount++;
    }

    for (const v of game.vehicles) {
      if (v.dead || v === player.inVehicle) continue;
      if (dist(v.x, v.y, player.x, player.y) > SPAWN.DESPAWN) {
        v._despawn = true;
        continue;
      }
      if (v.aiRole === 'traffic') trafficCount++;
    }
    game.vehicles = game.vehicles.filter((v) => !v._despawn);

    while (civCount < SPAWN.CIV_TARGET) {
      const pt = map.randomSidewalkPoint(player.x, player.y, minR, maxR);
      game.peds.push(new Pedestrian({ x: pt.x, y: pt.y, faction: 'civilian', role: 'civilian', hp: 45 }));
      civCount++;
    }

    while (gangCount < SPAWN.GANG_TARGET) {
      const pt = map.randomSidewalkPoint(player.x, player.y, minR, maxR);
      const district = territorySystem.getDistrictAt(pt.x, pt.y, map);
      const faction = district.owner;
      const fac = FACTIONS[faction];
      const weaponId = pick(fac.weapons.length ? fac.weapons : ['pistol']);
      game.peds.push(
        new Pedestrian({
          x: pt.x,
          y: pt.y,
          faction,
          role: 'gang',
          weaponId,
          hp: faction === 'player' ? 85 : 68,
          districtIndex: district.index,
        })
      );
      gangCount++;
    }

    while (trafficCount < SPAWN.TRAFFIC_TARGET) {
      const pt = map.randomRoadPoint(player.x, player.y, minR, maxR);
      const crowded = game.vehicles.some((v) => dist(v.x, v.y, pt.x, pt.y) < 120);
      if (crowded) break;
      const isCopPatrol = Math.random() < 0.14;
      const typeId = isCopPatrol ? 'police' : pick(TRAFFIC_TYPES);
      const veh = new Vehicle({
        x: pt.x,
        y: pt.y,
        angle: pt.angle,
        typeId,
        aiRole: 'traffic',
      });
      veh.speed = isCopPatrol ? 170 : 140 + Math.random() * 60;
      game.vehicles.push(veh);
      trafficCount++;
    }
  }

  update(game, dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.25;
      this._populateAroundPlayer(game, false);
    }

    this._updatePedestrians(game, dt);
    this._updateVehicles(game, dt);
  }

  _updatePedestrians(game, dt) {
    const { player, map, wantedSystem, weaponSystem } = game;

    for (const ped of game.peds) {
      ped.hitFlash = Math.max(0, ped.hitFlash - dt);
      ped.muzzleFlash = Math.max(0, ped.muzzleFlash - dt);
      ped.fireCooldown = Math.max(0, ped.fireCooldown - dt);

      if (!ped.alive) {
        ped.deadTimer += dt;
        continue;
      }

      if (ped.role === 'cashier') {
        if (ped.state === 'surrender') {
          ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
        }
        continue;
      }

      const dPlayer = dist(ped.x, ped.y, player.x, player.y);

      // Seleção de comportamento
      if (ped.faction === 'police') {
        if (wantedSystem.stars > 0 && player.alive) {
          ped.state = 'combat';
          ped.target = player;
        } else {
          ped.state = 'wander';
          ped.target = null;
        }
      } else if (RIVAL_IDS.includes(ped.faction)) {
        if (ped.isWarEnemy) {
          ped.state = 'combat';
          ped.target = player;
        } else if (ped.alertTimer > 0) {
          ped.alertTimer -= dt;
          ped.state = 'combat';
          ped.target = player;
        } else {
          // Ameaça se o jogador mirar perto com arma equipada ou atirar
          if (player.alive && dPlayer < 175 && player.weapon.type !== 'melee' && player.muzzleFlash > 0) {
            ped.state = 'combat';
            ped.alertTimer = 12;
            ped.target = player;
          } else {
            ped.state = 'wander';
          }
        }
      } else if (ped.faction === 'player') {
        // Aliados do sindicato atacam membros de guerra de gangues próximos
        let enemy = null;
        let bestD = 360;
        for (const other of game.peds) {
          if (!other.alive || !other.isWarEnemy) continue;
          const d = dist(ped.x, ped.y, other.x, other.y);
          if (d < bestD) {
            bestD = d;
            enemy = other;
          }
        }
        if (enemy) {
          ped.state = 'combat';
          ped.target = enemy;
        } else {
          ped.state = 'wander';
          ped.target = null;
        }
      } else if (ped.role === 'civilian') {
        if (ped.alertTimer > 0) {
          ped.alertTimer -= dt;
          ped.state = 'flee';
        } else {
          ped.state = 'wander';
        }
      }

      // Executar estado
      let moveVx = 0;
      let moveVy = 0;

      if (ped.state === 'flee') {
        const away = Math.atan2(ped.y - player.y, ped.x - player.x);
        ped.angle = away;
        moveVx = Math.cos(away) * 145;
        moveVy = Math.sin(away) * 145;
        ped.walkPhase += dt * 11;
      } else if (ped.state === 'combat' && ped.target && (ped.target === player ? player.alive : ped.target.alive)) {
        const tx =
          ped.faction === 'police' && ped.target === player && wantedSystem.evading
            ? wantedSystem.lastSeen.x
            : ped.target.x;
        const ty =
          ped.faction === 'police' && ped.target === player && wantedSystem.evading
            ? wantedSystem.lastSeen.y
            : ped.target.y;

        const dTarget = dist(ped.x, ped.y, tx, ty);
        const ang = Math.atan2(ty - ped.y, tx - ped.x);
        ped.angle = ang;

        const hasLOS = dTarget < 520 && !map.raycast(ped.x, ped.y, tx, ty).hit;
        const preferredDist = ped.weaponId === 'bat' || ped.weaponId === 'knife' ? 36 : 210;

        if (!hasLOS || dTarget > preferredDist) {
          const spd = ped.faction === 'police' ? 165 : 145;
          moveVx = Math.cos(ang) * spd;
          moveVy = Math.sin(ang) * spd;
          ped.walkPhase += dt * 10;
        } else if (dTarget < preferredDist * 0.55 && ped.weaponId !== 'bat' && ped.weaponId !== 'knife') {
          moveVx = -Math.cos(ang) * 75;
          moveVy = -Math.sin(ang) * 75;
        }

        if (hasLOS && ped.fireCooldown <= 0) {
          if (ped.target === player) {
            weaponSystem.fireNpc(game, ped, ang);
          } else {
            // Aliado atira em inimigo de guerra
            ped.fireCooldown = 0.45;
            ped.muzzleFlash = 0.05;
            ped.target.takeDamage(16, 'player');
            if (!ped.target.alive) game.onPedKilled(ped.target, 'player');
          }
        }
      } else {
        // Wander tranquilo
        ped.thinkTimer -= dt;
        if (ped.thinkTimer <= 0) {
          ped.thinkTimer = 1.8 + Math.random() * 2.5;
          ped.wanderAngle += (Math.random() - 0.5) * 2.2;
        }
        ped.angle = ped.wanderAngle;
        moveVx = Math.cos(ped.wanderAngle) * 58;
        moveVy = Math.sin(ped.wanderAngle) * 58;
        ped.walkPhase += dt * 5;
      }

      const nextX = ped.x + moveVx * dt;
      const nextY = ped.y + moveVy * dt;
      const res = map.resolveCircle(nextX, nextY, ped.radius);
      if (res.hit && ped.state === 'wander') {
        ped.wanderAngle += Math.PI * 0.75;
      }
      ped.x = res.x;
      ped.y = res.y;
    }

    game.peds = game.peds.filter((p) => p.alive || p.deadTimer < 6);
  }

  _updateVehicles(game, dt) {
    const { player, map, input, weaponSystem } = game;

    for (const veh of game.vehicles) {
      if (veh.sirenOn) veh.sirenPhase += dt * 9;

      if (veh.dead) {
        if (!veh.exploded) {
          veh.explodeDelay -= dt;
          if (veh.explodeDelay <= 0) {
            veh.exploded = true;
            if (veh.driver === player) {
              player.inVehicle = null;
            }
            weaponSystem.triggerExplosion(game, veh.x, veh.y, 160, 220, 'player');
          }
        }
        continue;
      }

      // Fumaça se muito danificado
      if (veh.hp < veh.maxHp * 0.45) {
        veh.smokeTimer -= dt;
        if (veh.smokeTimer <= 0) {
          veh.smokeTimer = 0.09;
          game.particles.push(
            new Particle({
              x: veh.x + Math.cos(veh.angle) * (veh.w * 0.35),
              y: veh.y + Math.sin(veh.angle) * (veh.w * 0.35),
              vx: (Math.random() - 0.5) * 25,
              vy: -25 - Math.random() * 20,
              life: 0.55,
              size: 8 + Math.random() * 6,
              color: veh.hp < veh.maxHp * 0.2 ? '#f97316' : '#475569',
              kind: 'smoke',
            })
          );
        }
      }

      let impact = 0;
      if (veh.driver === player) {
        let throttle = 0;
        let steer = 0;
        if (input.down('KeyW') || input.down('ArrowUp')) throttle += 1;
        if (input.down('KeyS') || input.down('ArrowDown')) throttle -= 1;
        if (input.down('KeyA') || input.down('ArrowLeft')) steer -= 1;
        if (input.down('KeyD') || input.down('ArrowRight')) steer += 1;
        const brake = input.down('Space');
        impact = veh.stepPhysics(dt, throttle, steer, brake, map);
      } else if (veh.aiRole === 'roadblock' || veh.aiRole === 'parked') {
        impact = veh.stepPhysics(dt, 0, 0, true, map);
      } else if (veh.aiRole === 'police') {
        const target = game.wantedSystem.evading ? game.wantedSystem.lastSeen : player;
        const d = dist(veh.x, veh.y, target.x, target.y);
        const desired = Math.atan2(target.y - veh.y, target.x - veh.x);
        const diff = angleDiff(veh.angle, desired);
        const steer = clamp(diff * 2.2, -1, 1);

        // Desvia se houver parede imediatamente à frente
        const aheadX = veh.x + Math.cos(veh.angle) * 70;
        const aheadY = veh.y + Math.sin(veh.angle) * 70;
        const blocked = map.isSolidAt(aheadX, aheadY);

        let throttle = d > 130 ? 0.95 : 0;
        if (blocked) throttle = -0.7;

        impact = veh.stepPhysics(dt, throttle, blocked ? -steer : steer, d <= 130, map);

        // Desembarca reforço quando encosta perto do jogador
        if (d < 210 && game.wantedSystem.stars > 0 && !veh._deployed) {
          veh._deployed = true;
          const exitPt = veh.getExitPoint(map);
          const officer = game.wantedSystem._createOfficer(exitPt.x, exitPt.y);
          game.peds.push(officer);
        }
      } else {
        // Tráfego urbano
        const aheadX = veh.x + Math.cos(veh.angle) * 85;
        const aheadY = veh.y + Math.sin(veh.angle) * 85;
        const blocked = map.isSolidAt(aheadX, aheadY);

        let steer = 0;
        let throttle = 0.45;
        if (blocked) {
          veh.aiTimer -= dt;
          const leftFree = !map.isSolidAt(
            veh.x + Math.cos(veh.angle - Math.PI / 2) * 85,
            veh.y + Math.sin(veh.angle - Math.PI / 2) * 85
          );
          steer = leftFree ? -1 : 1;
          throttle = 0.25;
        }
        impact = veh.stepPhysics(dt, throttle, steer, false, map);
        if (impact > 40) {
          veh.angle += Math.PI / 2;
        }
      }

      if (impact > 180 && veh.driver === player) {
        game.playSoundAt('crash', veh.x, veh.y, 0.7);
        game.camera.shake(4, 0.12);
      }

      // Atropelamento de pedestres em velocidade
      const absSpd = Math.abs(veh.speed);
      if (absSpd > 110) {
        for (const ped of game.peds) {
          if (!ped.alive) continue;
          if (dist(veh.x, veh.y, ped.x, ped.y) < veh.radius * 0.78 + ped.radius) {
            const attacker = veh.driver === player ? 'player' : 'civilian';
            ped.takeDamage(absSpd * 0.45, attacker);
            if (!ped.alive) {
              game.onPedKilled(ped, attacker);
            } else if (attacker === 'player') {
              game.wantedSystem.addHeat(35, 'Atropelamento');
            }
          }
        }
      }
    }

    // Colisão elástica simples entre veículos
    for (let i = 0; i < game.vehicles.length; i++) {
      const a = game.vehicles[i];
      if (a.dead) continue;
      for (let j = i + 1; j < game.vehicles.length; j++) {
        const b = game.vehicles[j];
        if (b.dead) continue;
        const minD = (a.radius + b.radius) * 0.78;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < minD) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = minD - d;
          const totalMass = a.mass + b.mass;
          a.x -= nx * overlap * (b.mass / totalMass);
          a.y -= ny * overlap * (b.mass / totalMass);
          b.x += nx * overlap * (a.mass / totalMass);
          b.y += ny * overlap * (a.mass / totalMass);

          const relSpeed = Math.abs(a.speed) + Math.abs(b.speed);
          if (relSpeed > 180) {
            a.takeDamage(relSpeed * 0.03);
            b.takeDamage(relSpeed * 0.03);
            a.speed *= 0.55;
            b.speed *= 0.55;
            if (a.driver === player || b.driver === player) {
              game.playSoundAt('crash', a.x, a.y, 0.5);
              if (b.spec.police || a.spec.police) {
                game.wantedSystem.addHeat(40, 'Colisão contra viatura');
              }
            }
          }
        }
      }
    }

    // Remove veículos explodidos após pequeno intervalo
    game.vehicles = game.vehicles.filter((v) => !v.exploded);
  }
}
