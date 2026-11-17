import { ECONOMY } from '../config.js';
import { clamp } from '../core/math.js';
import { WEAPONS, WEAPONS_BY_SLOT, createInitialInventory } from '../data/weapons.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.pitch = 0;
    this.radius = 13;

    this.hp = 100;
    this.maxHp = 100;
    this.armor = 50;
    this.maxArmor = 100;
    this.money = ECONOMY.START_MONEY;

    this.walkSpeed = 195;
    this.sprintSpeed = 285;

    this.inventory = createInitialInventory();
    this.equippedId = 'pistol';

    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.recoilBloom = 0;
    this.recoilKick = 0;
    this.muzzleFlash = 0;
    this.meleeSwing = 0;
    this.meleeCombo = 0;
    this.hitFlash = 0;
    this.walkPhase = 0;
    this.aiming = false;

    this.inVehicle = null;
    this.alive = true;
    this.statusBanner = null;
  }

  get weapon() {
    return WEAPONS[this.equippedId];
  }

  get weaponState() {
    return this.inventory[this.equippedId];
  }

  get ownedWeaponIds() {
    return Object.keys(this.inventory).filter((id) => this.inventory[id].owned);
  }

  equip(id) {
    if (!this.inventory[id]?.owned || this.equippedId === id) return false;
    this.equippedId = id;
    this.reloadTimer = 0;
    this.fireCooldown = Math.min(this.fireCooldown, 0.12);
    this.recoilBloom = 0;
    return true;
  }

  selectSlot(slot) {
    const list = WEAPONS_BY_SLOT[slot];
    if (!list) return false;
    const owned = list.filter((w) => this.inventory[w.id]?.owned);
    if (owned.length === 0) return false;

    const currentIdx = owned.findIndex((w) => w.id === this.equippedId);
    const next = currentIdx === -1 ? owned[0] : owned[(currentIdx + 1) % owned.length];
    return this.equip(next.id);
  }

  cycleWeapon(dir) {
    const list = this.ownedWeaponIds;
    if (list.length <= 1) return false;
    const idx = list.indexOf(this.equippedId);
    const nextIdx = (idx + (dir > 0 ? 1 : -1) + list.length) % list.length;
    return this.equip(list[nextIdx]);
  }

  giveWeapon(id) {
    const w = WEAPONS[id];
    const st = this.inventory[id];
    if (!w || !st) return;
    if (!st.owned) {
      st.owned = true;
      st.mag = w.magSize;
      st.reserve = Math.min(w.maxReserve, w.ammoPack * 2);
    } else if (w.ammoPack > 0) {
      st.reserve = Math.min(w.maxReserve, st.reserve + w.ammoPack);
    }
  }

  addAmmo(id, amount) {
    const w = WEAPONS[id];
    const st = this.inventory[id];
    if (!w || !st || !st.owned) return false;
    if (st.reserve >= w.maxReserve && st.mag >= w.magSize) return false;
    st.reserve = Math.min(w.maxReserve, st.reserve + amount);
    if (w.type === 'throw' && st.mag === 0 && st.reserve > 0) {
      st.mag = 1;
      st.reserve -= 1;
    }
    return true;
  }

  startReload() {
    const w = this.weapon;
    const st = this.weaponState;
    if (!w || w.magSize <= 0 || this.reloadTimer > 0) return false;
    if (st.mag >= w.magSize || st.reserve <= 0) return false;
    this.reloadTimer = w.reloadTime;
    return true;
  }

  finishReload() {
    const w = this.weapon;
    const st = this.weaponState;
    if (!w || w.magSize <= 0) return;
    const need = w.magSize - st.mag;
    const take = Math.min(need, st.reserve);
    st.mag += take;
    st.reserve -= take;
  }

  takeDamage(amount) {
    if (!this.alive || amount <= 0) return 0;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
    }
    this.hitFlash = 0.16;
    if (this.hp <= 0) {
      this.alive = false;
    }
    return amount;
  }

  update(dt, input, map, worldMouse, sensitivity = 1.0) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.meleeSwing = Math.max(0, this.meleeSwing - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.recoilBloom = Math.max(0, this.recoilBloom - dt * 0.42);
    this.recoilKick = Math.max(0, this.recoilKick - dt * 36);
    this.aiming = Boolean(input.mouse?.rightDown);

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.finishReload();
      }
    }

    if (!this.alive) return;

    if (this.inVehicle) {
      this.x = this.inVehicle.x;
      this.y = this.inVehicle.y;
      this.angle = this.inVehicle.angle;
      this.pitch = 0;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Rotação da câmera por PointerLock / Mouse Delta
    if (input.useRelativeMove) {
      const sens = 0.0024 * sensitivity * (this.aiming ? 0.65 : 1.0);
      if (input.lookDeltaX) {
        this.angle += input.lookDeltaX * sens;
      }
      if (input.lookDeltaY) {
        this.pitch = clamp(this.pitch - input.lookDeltaY * sens, -0.58, 0.52);
      }
    } else if (worldMouse) {
      this.angle = Math.atan2(worldMouse.y - this.y, worldMouse.x - this.x);
    }

    // Entrada de movimento (WASD)
    let forward = 0;
    let strafe = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) forward += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) forward -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) strafe += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) strafe -= 1;

    const len = Math.hypot(forward, strafe);
    if (len > 0) {
      forward /= len;
      strafe /= len;
      const sprinting = (input.down('ShiftLeft') || input.down('ShiftRight')) && !this.aiming;
      const spd = (sprinting ? this.sprintSpeed : this.walkSpeed) * (this.aiming ? 0.72 : 1);

      if (input.useRelativeMove) {
        // Movimento relativo à direção para onde a câmera (1ª/3ª pessoa) aponta
        const fx = Math.cos(this.angle);
        const fy = Math.sin(this.angle);
        const rx = -fy;
        const ry = fx;
        this.vx = (fx * forward + rx * strafe) * spd;
        this.vy = (fy * forward + ry * strafe) * spd;
      } else {
        this.vx = strafe * spd;
        this.vy = -forward * spd;
      }
      this.walkPhase += dt * (sprinting ? 14 : 10);
    } else {
      this.vx *= Math.exp(-dt * 18);
      this.vy *= Math.exp(-dt * 18);
    }

    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;
    const res = map.resolveCircle(nextX, nextY, this.radius);
    this.x = res.x;
    this.y = res.y;
  }
}
