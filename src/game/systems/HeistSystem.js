import { HEIST } from '../config.js';
import { angleDiff, dist, randInt } from '../core/math.js';
import { Pedestrian } from '../entities/Pedestrian.js';

export class HeistSystem {
  constructor() {
    this.activeHeist = null; // { poi, progress, duration, reward }
  }

  update(game, dt) {
    const { map, player } = game;

    // Atualiza cooldown de todas as lojas e bancos
    for (const poi of map.pois) {
      if (poi.cooldown > 0) poi.cooldown = Math.max(0, poi.cooldown - dt);
    }

    if (!player.alive || player.inVehicle) {
      this._cancelActive();
      return;
    }

    // Se já há um assalto em andamento, progredir
    if (this.activeHeist) {
      const h = this.activeHeist;
      const anchorX = h.poi.type === 'bank' ? h.poi.vaultX : h.poi.cashierX;
      const anchorY = h.poi.type === 'bank' ? h.poi.vaultY : h.poi.cashierY;
      const maxDist = h.poi.type === 'bank' ? h.poi.vaultRadius + 40 : h.poi.robRadius + 45;

      if (dist(player.x, player.y, anchorX, anchorY) > maxDist) {
        game.notify('ASSALTO INTERROMPIDO', 'Você se afastou do alvo.', '#f87171');
        this._cancelActive();
        return;
      }

      h.progress += dt;
      if (h.progress >= h.duration) {
        this._completeHeist(game, h);
      }
      return;
    }

    // Detectar início de assalto em bancos ou lojas
    for (const poi of map.pois) {
      if (poi.cooldown > 0) continue;

      if (poi.type === 'bank') {
        const d = dist(player.x, player.y, poi.vaultX, poi.vaultY);
        if (d <= poi.vaultRadius) {
          this._startBankHeist(game, poi);
          break;
        }
      } else if (poi.type === 'store') {
        const d = dist(player.x, player.y, poi.cashierX, poi.cashierY);
        if (d <= poi.robRadius) {
          const angToCashier = Math.atan2(poi.cashierY - player.y, poi.cashierX - player.x);
          const aimingGun =
            player.weapon.type !== 'melee' &&
            Math.abs(angleDiff(player.angle, angToCashier)) <= HEIST.AIM_TOLERANCE &&
            !map.raycast(player.x, player.y, poi.cashierX, poi.cashierY).hit;
          const manualTrigger = game.input.wasPressed('KeyE') && d <= 95;

          if (aimingGun || manualTrigger) {
            this._startStoreHeist(game, poi);
            break;
          }
        }
      }
    }
  }

  _startStoreHeist(game, poi) {
    const reward = randInt(poi.rewardMin, poi.rewardMax);
    this.activeHeist = {
      poi,
      progress: 0,
      duration: HEIST.STORE_TIME,
      reward,
    };
    for (const ped of game.peds) {
      if (ped.poiId === poi.id && ped.role === 'cashier') {
        ped.state = 'surrender';
      }
    }
    game.wantedSystem.addHeat(75, `Assalto: ${poi.name}`);
    game.notify('ASSALTO À LOJA!', `${poi.name} — Fique perto do caixa!`, '#22d3ee');
  }

  _startBankHeist(game, poi) {
    const reward = randInt(poi.rewardMin, poi.rewardMax);
    this.activeHeist = {
      poi,
      progress: 0,
      duration: HEIST.BANK_TIME,
      reward,
    };
    game.audio.play('alarm');
    game.wantedSystem.addHeat(620, `Assalto ao ${poi.name}`);
    game.notify('ALARME DO COFRE DISPARADO!', `${poi.name} — Segurança máxima acionada!`, '#facc15');

    // Spawn de seguranças armados do banco próximos à entrada
    const guardOffsets = [
      [-45, 70],
      [45, 70],
      [0, 110],
    ];
    for (const [ox, oy] of guardOffsets) {
      const gx = poi.doorX + ox;
      const gy = poi.doorY - 30 - oy * 0.2;
      if (game.map.isSolidAt(gx, gy)) continue;
      const guard = new Pedestrian({
        x: gx,
        y: gy,
        faction: 'police',
        role: 'swat',
        weaponId: 'mp5',
        hp: 110,
        armor: 45,
      });
      guard.state = 'combat';
      guard.alertTimer = 45;
      game.peds.push(guard);
    }
  }

  _completeHeist(game, h) {
    const { poi, reward } = h;
    game.player.money += reward;
    poi.cooldown = poi.type === 'bank' ? HEIST.BANK_COOLDOWN : HEIST.STORE_COOLDOWN;

    if (poi.type === 'bank') {
      game.wantedSystem.addHeat(650, 'Cofre saqueado');
      game.audio.play('win');
      game.notify('COFRE SAQUEADO!', `+$${reward.toLocaleString()} — Fuja da polícia!`, '#facc15');
    } else {
      game.wantedSystem.addHeat(140, 'Caixa roubado');
      game.audio.play('cash');
      game.notify('LOJA ASSALTADA!', `+$${reward.toLocaleString()} roubados!`, '#22d3ee');
    }

    game.spawnText(game.player.x, game.player.y - 30, `+$${reward}`, '#facc15');
    this.activeHeist = null;
  }

  _cancelActive() {
    this.activeHeist = null;
  }
}
