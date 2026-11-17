import { VEHICLE_TYPES } from '../data/vehicles.js';
import { clamp, pick } from '../core/math.js';

let NEXT_VEH_ID = 1;

export class Vehicle {
  constructor({ x, y, angle = 0, typeId = 'sedan', aiRole = 'traffic', color = null }) {
    this.id = NEXT_VEH_ID++;
    this.typeId = typeId;
    this.spec = VEHICLE_TYPES[typeId] || VEHICLE_TYPES.sedan;

    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;

    this.w = this.spec.w;
    this.h = this.spec.h;
    this.radius = Math.max(this.w, this.h) * 0.48;

    this.color = color || pick(this.spec.colors);
    this.hp = this.spec.hp;
    this.maxHp = this.spec.hp;
    this.mass = this.spec.mass;

    this.driver = null; // Player | Pedestrian | null
    this.aiRole = aiRole; // 'traffic' | 'police' | 'gang' | 'roadblock' | 'parked'
    this.sirenOn = Boolean(this.spec.siren && aiRole === 'police');
    this.sirenPhase = Math.random() * 10;

    this.aiTimer = 0.5 + Math.random();
    this.stuckTimer = 0;
    this.smokeTimer = 0;
    this.dead = false;
    this.exploded = false;
    this.explodeDelay = 0;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.dead = true;
      this.explodeDelay = 0.05;
    }
  }

  getExitPoint(map) {
    // Tenta sair pela porta esquerda do veículo; se bloqueado, tenta direita ou atrás
    const offsets = [
      { ax: -Math.sin(this.angle), ay: Math.cos(this.angle), d: this.h * 0.8 + 14 },
      { ax: Math.sin(this.angle), ay: -Math.cos(this.angle), d: this.h * 0.8 + 14 },
      { ax: -Math.cos(this.angle), ay: -Math.sin(this.angle), d: this.w * 0.8 + 14 },
    ];
    for (const o of offsets) {
      const ex = this.x + o.ax * o.d;
      const ey = this.y + o.ay * o.d;
      if (!map.isSolidAt(ex, ey)) {
        return map.resolveCircle(ex, ey, 13);
      }
    }
    return map.resolveCircle(this.x, this.y, 13);
  }

  stepPhysics(dt, throttle, steer, brake, map) {
    const { maxSpeed, reverseSpeed, accel, brake: brakeForce, turnRate } = this.spec;

    if (throttle > 0) {
      if (this.speed < 0) {
        this.speed += brakeForce * dt;
      } else {
        this.speed += accel * throttle * dt;
      }
    } else if (throttle < 0) {
      if (this.speed > 12) {
        this.speed -= brakeForce * dt;
      } else {
        this.speed -= accel * 0.72 * dt;
      }
    } else {
      // Atrito natural de rolamento
      this.speed *= Math.exp(-dt * 2.2);
      if (Math.abs(this.speed) < 3) this.speed = 0;
    }

    if (brake) {
      this.speed *= Math.exp(-dt * 7.5);
    }

    this.speed = clamp(this.speed, -reverseSpeed, maxSpeed);

    // Esterçamento proporcional à velocidade
    const speedFactor = clamp(Math.abs(this.speed) / 95, 0, 1);
    const dir = this.speed >= -1 ? 1 : -1;
    this.angle += steer * turnRate * speedFactor * dir * dt;

    // Movimento suavizado (derrapagem leve em alta velocidade)
    const targetVx = Math.cos(this.angle) * this.speed;
    const targetVy = Math.sin(this.angle) * this.speed;
    const grip = brake ? 4.5 : 8.5;
    const blend = 1 - Math.exp(-dt * grip);
    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;

    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // Verificação de colisão com dois círculos (dianteiro e traseiro) para evitar travar quinas
    const halfBody = this.w * 0.28;
    const r = this.h * 0.52;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const fRes = map.resolveCircle(nx + cos * halfBody, ny + sin * halfBody, r);
    const bRes = map.resolveCircle(nx - cos * halfBody, ny - sin * halfBody, r);

    if (fRes.hit || bRes.hit) {
      const dfx = fRes.x - (nx + cos * halfBody);
      const dfy = fRes.y - (ny + sin * halfBody);
      const dbx = bRes.x - (nx - cos * halfBody);
      const dby = bRes.y - (ny - sin * halfBody);
      this.x = nx + (dfx + dbx) * 0.6;
      this.y = ny + (dfy + dby) * 0.6;
      const impactSpeed = Math.abs(this.speed);
      this.speed *= -0.25;
      this.vx *= 0.25;
      this.vy *= 0.25;
      if (impactSpeed > 260) {
        this.takeDamage((impactSpeed - 240) * 0.08);
      }
      return impactSpeed;
    }

    this.x = nx;
    this.y = ny;
    return 0;
  }
}
