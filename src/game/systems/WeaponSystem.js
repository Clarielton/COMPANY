import { angleDiff, dist, clamp } from '../core/math.js';
import { WEAPONS } from '../data/weapons.js';
import { Bullet, Grenade } from '../entities/Projectile.js';
import { Particle } from '../entities/Particle.js';

export class WeaponSystem {
  firePlayer(game) {
    const { player, audio, map, camera } = game;
    if (!player.alive || player.inVehicle) return false;
    if (player.fireCooldown > 0 || player.reloadTimer > 0) return false;

    const w = player.weapon;
    const st = player.weaponState;

    if (w.type === 'melee') {
      player.fireCooldown = 1 / w.fireRate;
      player.meleeSwing = 0.25;
      player.meleeCombo = ((player.meleeCombo || 0) + 1) % 2;
      player.recoilKick = w.recoilKick;
      audio.play(w.sound);

      let hitAny = false;
      for (const ped of game.peds) {
        if (!ped.alive) continue;
        const d = dist(player.x, player.y, ped.x, ped.y);
        if (d > w.range + ped.radius) continue;
        const ang = Math.atan2(ped.y - player.y, ped.x - player.x);
        if (Math.abs(angleDiff(player.angle, ang)) > 1.05) continue;
        if (map.raycast(player.x, player.y, ped.x, ped.y).hit) continue;

        ped.takeDamage(w.damage, 'player');
        this._spawnBlood(game, ped.x, ped.y, ang);
        hitAny = true;

        if (!ped.alive) {
          game.onPedKilled(ped, 'player');
        } else {
          game.wantedSystem.reportCrime(ped.faction === 'police' ? 95 : 35, ped.faction === 'police' ? 'Agressão policial' : 'Agressão');
        }
      }

      for (const veh of game.vehicles) {
        if (veh.dead) continue;
        const d = dist(player.x, player.y, veh.x, veh.y);
        if (d > w.range + veh.radius) continue;
        const ang = Math.atan2(veh.y - player.y, veh.x - player.x);
        if (Math.abs(angleDiff(player.angle, ang)) > 0.95) continue;
        veh.takeDamage(w.damage * 0.7);
        this._spawnSparks(game, veh.x, veh.y, 4);
        hitAny = true;
      }

      if (hitAny) {
        audio.play('punch');
        camera.shake(2.5, 0.08);
      }
      return true;
    }

    if (w.type === 'throw') {
      if (st.mag <= 0) {
        if (st.reserve > 0) {
          st.mag = 1;
          st.reserve -= 1;
        } else {
          audio.play('empty');
          player.fireCooldown = 0.25;
          return false;
        }
      }
      st.mag -= 1;
      player.fireCooldown = 1 / w.fireRate;
      player.recoilKick = w.recoilKick;
      audio.play('throw');

      const aimDist = game.worldMouse
        ? clamp(dist(player.x, player.y, game.worldMouse.x, game.worldMouse.y), 70, w.range)
        : 220;
      const throwSpeed = aimDist / 0.85;
      game.grenades.push(
        new Grenade({
          x: player.x + Math.cos(player.angle) * 14,
          y: player.y + Math.sin(player.angle) * 14,
          angle: player.angle,
          speed: throwSpeed,
          damage: w.damage,
          blastRadius: w.blastRadius,
          ownerFaction: 'player',
          isPlayer: true,
        })
      );

      if (st.mag === 0 && st.reserve > 0) {
        player.reloadTimer = w.reloadTime;
      }
      return true;
    }

    // Armas de fogo
    if (st.mag <= 0) {
      if (st.reserve > 0) {
        if (player.startReload()) audio.play('reload');
      } else {
        audio.play('empty');
        player.fireCooldown = 0.22;
      }
      return false;
    }

    st.mag -= 1;
    player.fireCooldown = 1 / w.fireRate;
    player.muzzleFlash = 0.06;
    player.recoilKick = w.recoilKick;

    const muzzleX = player.x + Math.cos(player.angle) * 18;
    const muzzleY = player.y + Math.sin(player.angle) * 18;
    const totalSpread = w.spread + player.recoilBloom;

    for (let i = 0; i < w.pellets; i++) {
      const ang = player.angle + (Math.random() - 0.5) * 2 * totalSpread;
      game.bullets.push(
        new Bullet({
          x: muzzleX,
          y: muzzleY,
          angle: ang,
          speed: w.speed,
          damage: w.damage,
          range: w.range,
          ownerFaction: 'player',
          isPlayer: true,
          color: w.color,
        })
      );
    }

    player.recoilBloom = Math.min(0.28, player.recoilBloom + w.recoil);
    camera.shake(w.pellets > 1 ? 4.8 : 2.0, 0.09);
    audio.play(w.sound);

    this.alertNearby(game, player.x, player.y, 460);

    if (st.mag === 0 && st.reserve > 0) {
      if (player.startReload()) audio.play('reload');
    }
    return true;
  }

  fireNpc(game, ped, angle) {
    const w = WEAPONS[ped.weaponId || 'pistol'] || WEAPONS.pistol;
    if (w.type === 'melee') {
      ped.fireCooldown = 1 / w.fireRate;
      const d = dist(ped.x, ped.y, game.player.x, game.player.y);
      if (d <= w.range + game.player.radius && !game.player.inVehicle) {
        game.player.takeDamage(w.damage * 0.55);
        game.playSoundAt('punch', ped.x, ped.y);
        this._spawnBlood(game, game.player.x, game.player.y, angle);
      }
      return;
    }

    ped.fireCooldown = (1 / w.fireRate) * (1.45 + Math.random() * 0.65);
    ped.muzzleFlash = 0.06;
    const muzzleX = ped.x + Math.cos(angle) * 16;
    const muzzleY = ped.y + Math.sin(angle) * 16;
    const spread = w.spread * 1.45 + 0.04;

    for (let i = 0; i < w.pellets; i++) {
      const ang = angle + (Math.random() - 0.5) * 2 * spread;
      game.bullets.push(
        new Bullet({
          x: muzzleX,
          y: muzzleY,
          angle: ang,
          speed: w.speed * 0.88,
          damage: w.damage * 0.5,
          range: w.range,
          ownerFaction: ped.faction,
          isPlayer: false,
          color: w.color,
        })
      );
    }
    game.playSoundAt(w.sound, ped.x, ped.y, 0.55);
  }

  alertNearby(game, x, y, radius) {
    for (const ped of game.peds) {
      if (!ped.alive) continue;
      if (dist(x, y, ped.x, ped.y) > radius) continue;
      if (ped.role === 'civilian') {
        ped.state = 'flee';
        ped.alertTimer = 8;
      } else if (ped.faction === 'police') {
        ped.alertTimer = 14;
        if (game.wantedSystem.stars > 0) ped.state = 'combat';
      }
    }
  }

  triggerExplosion(game, x, y, radius, damage, ownerFaction = 'player') {
    const { camera, player, map } = game;
    game.playSoundAt('explosion', x, y, 1.0);
    const dPlayer = dist(x, y, player.x, player.y);
    if (dPlayer < 950) {
      camera.shake(clamp(18 * (1 - dPlayer / 950), 3, 18), 0.35);
    }

    // Onda de choque e fogo
    game.particles.push(
      new Particle({ x, y, vx: 0, vy: 0, life: 0.35, size: radius, color: '#fb923c', kind: 'ring' })
    );
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 240;
      game.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35 + Math.random() * 0.45,
          size: 4 + Math.random() * 8,
          color: i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#f97316' : '#ef4444',
          kind: 'fire',
        })
      );
    }
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 90;
      game.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.8 + Math.random() * 0.7,
          size: 10 + Math.random() * 14,
          color: '#334155',
          kind: 'smoke',
        })
      );
    }

    // Dano em área no jogador
    if (player.alive && dPlayer < radius) {
      const falloff = 1 - (dPlayer / radius) * 0.7;
      const mult = player.inVehicle ? 0.45 : 1.0;
      player.takeDamage(damage * 0.65 * falloff * mult);
    }

    // Dano em área em NPCs
    for (const ped of game.peds) {
      if (!ped.alive) continue;
      const d = dist(x, y, ped.x, ped.y);
      if (d < radius) {
        if (map.raycast(x, y, ped.x, ped.y).hit) continue;
        const falloff = 1 - (d / radius) * 0.65;
        ped.takeDamage(damage * falloff, ownerFaction);
        if (!ped.alive) {
          game.onPedKilled(ped, ownerFaction);
        }
      }
    }

    // Dano em área em veículos (reação em cadeia)
    for (const veh of game.vehicles) {
      if (veh.dead) continue;
      const d = dist(x, y, veh.x, veh.y);
      if (d < radius + veh.radius * 0.5) {
        const falloff = 1 - (d / (radius + veh.radius)) * 0.65;
        veh.takeDamage(damage * 1.45 * falloff);
      }
    }

    this.alertNearby(game, x, y, 720);
    if (ownerFaction === 'player' && dPlayer < 600) {
      game.wantedSystem.addHeat(110, 'Explosão em via pública');
    }
  }

  update(game, dt) {
    const { map, player } = game;

    // Projéteis de arma
    for (const b of game.bullets) {
      if (!b.alive) continue;
      b.prevX = b.x;
      b.prevY = b.y;

      const stepDist = b.speed * dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;

      // Checar parede no caminho
      const wall = map.raycast(b.x, b.y, nx, ny, 8);
      if (wall.hit) {
        b.alive = false;
        this._spawnSparks(game, wall.x, wall.y, 4);
        continue;
      }

      b.x = nx;
      b.y = ny;
      b.rangeLeft -= stepDist;
      if (b.rangeLeft <= 0) {
        b.alive = false;
        continue;
      }

      // Colisão com jogador
      if (!b.isPlayer && player.alive && !player.inVehicle) {
        if (dist(b.x, b.y, player.x, player.y) <= player.radius + 3) {
          b.alive = false;
          player.takeDamage(b.damage);
          this._spawnBlood(game, b.x, b.y, Math.atan2(b.vy, b.vx));
          continue;
        }
      }

      // Colisão com NPCs
      let hitPed = false;
      for (const ped of game.peds) {
        if (!ped.alive) continue;
        if (ped.faction === b.ownerFaction && !b.isPlayer) continue;
        if (dist(b.x, b.y, ped.x, ped.y) <= ped.radius + 3) {
          b.alive = false;
          hitPed = true;
          ped.takeDamage(b.damage, b.ownerFaction);
          this._spawnBlood(game, b.x, b.y, Math.atan2(b.vy, b.vx));
          if (!ped.alive) {
            game.onPedKilled(ped, b.ownerFaction);
          } else if (b.isPlayer) {
            if (ped.faction === 'police') game.wantedSystem.addHeat(55, 'Disparo contra polícia');
            else if (ped.faction === 'civilian') game.wantedSystem.addHeat(30, 'Disparo contra civil');
          }
          break;
        }
      }
      if (hitPed) continue;

      // Colisão com veículos
      for (const veh of game.vehicles) {
        if (veh.dead) continue;
        if (b.isPlayer && player.inVehicle === veh) continue;
        if (dist(b.x, b.y, veh.x, veh.y) <= veh.radius) {
          b.alive = false;
          veh.takeDamage(b.damage * 0.85);
          this._spawnSparks(game, b.x, b.y, 3);
          if (b.isPlayer && veh.spec.police) {
            game.wantedSystem.addHeat(45, 'Dano a viatura');
          }
          break;
        }
      }
    }

    // Granadas
    for (const g of game.grenades) {
      if (!g.alive) continue;
      g.fuse -= dt;
      g.spin += dt * 9;

      const nx = g.x + g.vx * dt;
      const ny = g.y + g.vy * dt;
      if (map.isSolidAt(nx, g.y)) g.vx *= -0.55;
      else g.x = nx;
      if (map.isSolidAt(g.x, ny)) g.vy *= -0.55;
      else g.y = ny;

      g.vz -= 420 * dt;
      g.z += g.vz * dt;
      if (g.z <= 0) {
        g.z = 0;
        g.vz = Math.abs(g.vz) * 0.42;
        g.vx *= 0.65;
        g.vy *= 0.65;
      }

      if (g.fuse <= 0) {
        g.alive = false;
        this.triggerExplosion(game, g.x, g.y, g.blastRadius, g.damage, g.ownerFaction);
      }
    }

    game.bullets = game.bullets.filter((b) => b.alive);
    game.grenades = game.grenades.filter((g) => g.alive);
  }

  _spawnSparks(game, x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      game.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.16 + Math.random() * 0.14,
          size: 2.2,
          color: '#fde047',
          kind: 'spark',
        })
      );
    }
  }

  _spawnBlood(game, x, y, dirAngle) {
    for (let i = 0; i < 6; i++) {
      const ang = dirAngle + (Math.random() - 0.5) * 1.1;
      const spd = 30 + Math.random() * 95;
      game.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.25 + Math.random() * 0.25,
          size: 2.5 + Math.random() * 2,
          color: '#dc2626',
          kind: 'blood',
        })
      );
    }
  }
}
