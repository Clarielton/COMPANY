import { FACTIONS } from '../data/factions.js';
import { pick } from '../core/math.js';

let NEXT_PED_ID = 1;

export class Pedestrian {
  constructor({
    x,
    y,
    faction = 'civilian',
    role = 'civilian',
    weaponId = null,
    hp = 60,
    armor = 0,
    poiId = null,
    districtIndex = -1,
    isWarEnemy = false,
  }) {
    this.id = NEXT_PED_ID++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.radius = 12;

    this.faction = faction;
    this.role = role;
    this.weaponId = weaponId;
    this.hp = hp;
    this.maxHp = hp;
    this.armor = armor;

    this.poiId = poiId;
    this.districtIndex = districtIndex;
    this.isWarEnemy = isWarEnemy;

    this.homeX = x;
    this.homeY = y;
    this.state = role === 'cashier' ? 'idle' : 'wander';
    this.target = null;
    this.wanderAngle = this.angle;
    this.thinkTimer = Math.random() * 1.5;
    this.fireCooldown = 0.2 + Math.random() * 0.4;
    this.alertTimer = 0;
    this.muzzleFlash = 0;
    this.hitFlash = 0;
    this.walkPhase = Math.random() * 6;

    const fac = FACTIONS[faction] || FACTIONS.civilian;
    this.clothesColor = pick(fac.clothes);
    this.accentColor = fac.color;
    this.alive = true;
    this.deadTimer = 0;
  }

  takeDamage(amount, attackerFaction = null) {
    if (!this.alive || amount <= 0) return 0;
    let rem = amount;
    if (this.armor > 0) {
      const abs = Math.min(this.armor, rem);
      this.armor -= abs;
      rem -= abs;
    }
    this.hp = Math.max(0, this.hp - rem);
    this.hitFlash = 0.14;
    this.alertTimer = 10;

    if (this.role === 'civilian') {
      this.state = 'flee';
    } else if (this.role === 'cashier') {
      this.state = 'surrender';
    } else if (attackerFaction === 'player') {
      this.state = 'combat';
    }

    if (this.hp <= 0) {
      this.alive = false;
    }
    return amount;
  }
}
