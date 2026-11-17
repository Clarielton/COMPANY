export class Bullet {
  constructor({
    x,
    y,
    angle,
    speed,
    damage,
    range,
    ownerFaction,
    isPlayer = false,
    color = '#fde047',
  }) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed;
    this.damage = damage;
    this.rangeLeft = range;
    this.ownerFaction = ownerFaction;
    this.isPlayer = isPlayer;
    this.color = color;
    this.alive = true;
  }
}

export class Grenade {
  constructor({
    x,
    y,
    angle,
    speed,
    damage = 190,
    blastRadius = 145,
    ownerFaction = 'player',
    isPlayer = true,
  }) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.z = 8;
    this.vz = 150;
    this.fuse = 1.45;
    this.damage = damage;
    this.blastRadius = blastRadius;
    this.ownerFaction = ownerFaction;
    this.isPlayer = isPlayer;
    this.spin = 0;
    this.alive = true;
  }
}
