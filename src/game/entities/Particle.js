export class Particle {
  constructor({ x, y, vx, vy, life, size, color, kind = 'spark' }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.kind = kind; // 'spark' | 'blood' | 'smoke' | 'fire' | 'ring'
  }
}

export class FloatingText {
  constructor({ x, y, text, color = '#f8fafc', life = 1.1 }) {
    this.x = x;
    this.y = y;
    this.vy = -34;
    this.text = text;
    this.color = color;
    this.life = life;
    this.maxLife = life;
  }
}

export class Pickup {
  constructor({ x, y, type, value, life = 35 }) {
    this.x = x;
    this.y = y;
    this.type = type; // 'cash' | 'ammo' | 'health' | 'armor'
    this.value = value;
    this.life = life;
    this.phase = Math.random() * Math.PI * 2;
    this.radius = 12;
  }
}
