import { clamp, dist } from '../core/math.js';
import { COMMAND_BY_ID, ARMY_FACTIONS, SOLDIER_SURNAMES } from '../data/rtsData.js';

let NEXT_UNIT_ID = 1;
let NEXT_SOLDIER_ID = 1;
let NEXT_TRENCH_ID = 1;
let NEXT_MINE_ID = 1;
let NEXT_BARRICADE_ID = 1;

function getWeaponMetaForUnit(unitType, weaponModel, idx) {
  if (unitType === 'sniper_squad' || weaponModel === 'sniper') {
    return {
      weapon: idx === 0 ? 'Rifle Sniper M24' : 'Fuzil DMR M14 Luneta',
      weaponIcon: '🎯',
      weaponModel: 'sniper',
    };
  }
  if (unitType === 'at_javelin_squad' || weaponModel === 'bazooka') {
    return {
      weapon: idx % 2 === 0 ? 'Lança-Mísseis Javelin' : 'Bazuca M1 Antitanque',
      weaponIcon: '🚀',
      weaponModel: 'bazooka',
    };
  }
  if (unitType === 'shock_flamer' || weaponModel === 'flamer') {
    return {
      weapon: idx < 2 ? 'Lança-Chamas M2' : 'Escopeta Tática M1014',
      weaponIcon: '🔥',
      weaponModel: idx < 2 ? 'flamer' : 'smg',
    };
  }
  if (unitType === 'engineer_squad') {
    return {
      weapon: idx === 0 ? 'Submetralhadora + Kit Reparo' : 'Carabina M1 + Carga C4',
      weaponIcon: '🛠',
      weaponModel: 'smg',
    };
  }
  if (unitType === 'assault_squad' || weaponModel === 'smg') {
    return {
      weapon: idx === 0 ? 'SMG Thompson + Granada' : 'Submetralhadora MP5',
      weaponIcon: '🔫',
      weaponModel: 'smg',
    };
  }
  if (unitType === 'command_officer') {
    return {
      weapon: idx === 0 ? 'Carabina Tática Oficial' : 'Fuzil M4A1 Escolta',
      weaponIcon: '⭐',
      weaponModel: 'm4',
    };
  }
  return {
    weapon: idx === 0 ? 'Fuzil Tático M4A1' : idx % 2 === 0 ? 'Fuzil M16A4' : 'Carabina M1 Garand',
    weaponIcon: '🔫',
    weaponModel: 'm4',
  };
}

export class SquadUnit {
  constructor({
    x,
    y,
    faction = 'player',
    unitType = 'rifle_squad',
    angle = 0,
    customSoldiers = null,
    spacingMeters = 3.0,
  }) {
    this.id = NEXT_UNIT_ID++;
    this.x = x;
    this.y = y;
    this.lastValidPos = { x, y };
    this.vx = 0;
    this.vy = 0;
    this.state = 'IDLE';
    this.pinned = false;
    this.angle = angle;
    this.facingAngle = angle;
    this.turretAngle = angle;

    this.faction = faction;
    this.factionMeta = ARMY_FACTIONS[faction] || ARMY_FACTIONS.player;
    this.team = this.factionMeta.team; // 'allies' | 'enemies'

    const cmd = COMMAND_BY_ID[unitType] || COMMAND_BY_ID.rifle_squad;
    this.unitType = unitType;
    this.isCommanderSquad = Boolean(cmd.unitSpec?.isCommander || unitType === 'command_officer');
    this.name = cmd.name;
    this.short = cmd.short;
    this.spec = { ...cmd.unitSpec };

    this.radius = this.spec.radius || 26;
    this.selected = false;
    this.alive = true;
    this.surrendered = false;
    this.captured = false;
    this.morale = 100;
    this.isBrokenDown = false;
    this.beingRepaired = false;
    this.repairProgress = 0;
    this.wallStuckTimer = 0;
    this.aimSwitchCooldown = 0;
    this.tacticalOrderMode = null;

    // Formação ('line' | 'column' | 'wedge' | 'spread'), Espaçamento em Metros (1.0m a 8.0m) e Postura Fixa [H]
    this.formation = 'line';
    this.spacingMeters = clamp(spacingMeters || 3.0, 1.0, 8.0);
    this.holdPosition = false;

    // Sub-Unidades Reais: Cada soldado tem seu próprio ID, Patente/Nome, Arma e HP Individual (ex: 100/100 HP)
    this.soldiers = [];
    if (this.spec.type === 'infantry') {
      if (Array.isArray(customSoldiers) && customSoldiers.length > 0) {
        this.soldiers = customSoldiers.map((s) => ({
          ...s,
          selected: false,
          alive: s.hp > 0,
        }));
      } else {
        const count = this.spec.soldiersCount || 5;
        const hpEach = this.spec.hpPerSoldier || 100;
        for (let i = 0; i < count; i++) {
          const sId = NEXT_SOLDIER_ID++;
          const rank =
            i === 0
              ? this.unitType === 'command_officer'
                ? 'Cap.'
                : 'Sgt.'
              : i === 1
              ? 'Cb.'
              : 'Sd.';
          const surname = SOLDIER_SURNAMES[(this.id * 5 + sId * 3 + i) % SOLDIER_SURNAMES.length];
          const wMeta = getWeaponMetaForUnit(this.unitType, this.spec.weaponModel, i);
          this.soldiers.push({
            id: `sld_${sId}`,
            rank,
            surname,
            name: `${rank} ${surname}`,
            weapon: wMeta.weapon,
            weaponIcon: wMeta.weaponIcon,
            weaponModel: wMeta.weaponModel,
            hp: hpEach,
            maxHp: hpEach,
            alive: true,
            turnSpeed: 4.5 + Math.random() * 2.5,
            reactionDelay: 0.05 + Math.random() * 0.3,
            reactionTimer: 0,
            speedMultiplier: 0.92 + Math.random() * 0.16,
            animPhaseOffset: Math.random() * Math.PI * 2,
            strideFrequency: 6.8 + Math.random() * 2.2,
            walkPhase: Math.random() * Math.PI * 2,
            currentYaw: Math.PI / 2 - angle,
            vx: 0,
            vy: 0,
            selected: false,
            worldX: x,
            worldY: y,
            targetPos: null,
          });
        }
      }
      this.maxSoldiers = this.soldiers.length;
      this.syncSquadHealthFromSoldiers();
    } else {
      this.maxSoldiers = this.spec.soldiersCount || 1;
      this.soldiersAlive = this.maxSoldiers;
      this.maxHp = this.spec.maxHp;
      this.hp = this.maxHp;
    }

    // Ordens RTS
    this.order = {
      type: 'hold',
      targetX: x,
      targetY: y,
      targetUnitId: null,
      targetTrenchId: null,
      targetBuildingId: null,
      targetTransportId: null,
      facingAngle: angle,
    };
    this.waypoints = [];

    // Transporte de Tropas (Embarque / Desembarque)
    this.embarkedInId = null;
    this.cargoSquadIds = [];
    this.maxCargoSquads = this.spec.transportCapacitySquads || 2;
    this.maxCargoSoldiers = this.spec.transportCapacitySoldiers || 12;
    this.rampOpenTimer = 0;
    this.cannonCooldown = 0;
    this.coaxialCooldown = 0;

    this.inTrench = false;
    this.inTrenchId = null;
    this.inTreelineCover = false;
    this.inLightCover = false;
    this.inHeavyCover = false;
    this.crouchedInCover = false;
    this.coverSnap = null;
    this.snappedToCover = false;
    this.garrisonedBuildingId = null;

    this.fireCooldown = Math.random() * 0.55;
    this.burstRemaining = this.spec.burstShots || 4;
    this.reloadTimer = 0;
    this.grenadeCooldown = 6 + Math.random() * 5;
    this.muzzleFlashTimer = 0;
    this.recoilTimer = 0;
    this.dustTimer = 0;
    this.walkPhase = Math.random() * Math.PI * 2;

    this.refreshFormationOffsets();
    this.updateSoldierWorldPositions();
  }

  syncSquadHealthFromSoldiers() {
    if (this.spec.type !== 'infantry') return;
    let totalHp = 0;
    let totalMaxHp = 0;
    let aliveCount = 0;
    for (const s of this.soldiers) {
      totalMaxHp += s.maxHp;
      if (s.alive && s.hp > 0) {
        totalHp += s.hp;
        aliveCount++;
      } else {
        s.hp = 0;
        s.alive = false;
        s.selected = false;
      }
    }
    this.soldiersAlive = aliveCount;
    this.maxHp = Math.max(100, totalMaxHp);
    this.hp = totalHp;
  }

  refreshFormationOffsets() {
    const activeCount =
      this.spec.type === 'infantry' ? Math.max(1, this.soldiers.length) : this.maxSoldiers;
    this.memberOffsets = this._buildFormationOffsets(
      activeCount,
      this.formation,
      this.spacingMeters
    );
    this.radius = clamp(22 + (this.spacingMeters - 3.0) * 3.5, 18, 48);
  }

  updateSoldierWorldPositions() {
    if (this.spec.type !== 'infantry') return;
    const rot = Math.PI / 2 - this.angle;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Se encaixado em Muro/Trincheira (Cover Snapping), cada soldado i recebe destino único 1-para-1!
    if (
      this.coverSnap &&
      Array.isArray(this.coverSnap.slots) &&
      this.coverSnap.slots.length > 0 &&
      (this.snappedToCover || dist(this.x, this.y, this.coverSnap.cx, this.coverSnap.cy) <= 46)
    ) {
      let slotIdx = 0;
      for (let i = 0; i < this.soldiers.length; i++) {
        const s = this.soldiers[i];
        const slot =
          this.coverSnap.slots[Math.min(slotIdx, this.coverSnap.slots.length - 1)] ||
          this.coverSnap.slots[0];
        if (s.alive) slotIdx++;
        s.targetPos = { x: slot.x, y: slot.y };
        s.worldX = slot.x;
        s.worldY = slot.y;

        // Converte coordenadas de mundo do slot para offset local do grupo 3D do esquadrão
        const dx = slot.x - this.x;
        const dy = slot.y - this.y;
        const localOx = dx * cos - dy * sin;
        const localOy = dx * sin + dy * cos;
        this.memberOffsets[i] = { ox: localOx, oy: localOy };
      }
      return;
    }

    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      const off = this.memberOffsets[i] || { ox: 0, oy: 0 };
      const tx = this.x + off.ox * cos + off.oy * sin;
      const ty = this.y - off.ox * sin + off.oy * cos;
      s.personalTarget = { x: tx, y: ty };
      if (!Number.isFinite(s.worldX) || !Number.isFinite(s.worldY) || !s._autonomousInit) {
        s.worldX = tx;
        s.worldY = ty;
        s._autonomousInit = true;
      }
    }

    // Força de Repulsão Obrigatória entre soldados do mesmo esquadrão (evita agrupamento)
    if (!this.snappedToCover && !this.inTrench) {
      const minSep = Math.max(18, (this.spacingMeters || 3.0) * 7.2);
      for (let i = 0; i < this.soldiers.length; i++) {
        const a = this.soldiers[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < this.soldiers.length; j++) {
          const b = this.soldiers[j];
          if (!b.alive) continue;
          const dx = b.worldX - a.worldX;
          const dy = b.worldY - a.worldY;
          const d = Math.hypot(dx, dy);
          if (d < minSep) {
            const nx = d > 0.01 ? dx / d : Math.cos(i * 1.7);
            const ny = d > 0.01 ? dy / d : Math.sin(i * 1.7);
            const push = (minSep - d) * 0.5;
            a.worldX -= nx * push;
            a.worldY -= ny * push;
            b.worldX += nx * push;
            b.worldY += ny * push;
          }
        }
      }
    }
  }

  stepAutonomousSoldiers(dt) {
    if (this.spec.type !== 'infantry' || !this.soldiers || this.soldiers.length === 0) return;
    this.updateSoldierWorldPositions();
    const baseSpd = Math.max(45, (this.spec.speed || 62) * 1.18);

    const lerpAngle = (cur, target, t) => {
      let diff = target - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return cur + diff * Math.min(1, t);
    };

    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) continue;
      if (s.reactionTimer > 0) {
        s.reactionTimer = Math.max(0, s.reactionTimer - dt);
        s.vx = 0;
        s.vy = 0;
        continue;
      }

      const tgt = s.personalTarget || s.targetPos || { x: this.x, y: this.y };
      const dx = tgt.x - s.worldX;
      const dy = tgt.y - s.worldY;
      const d = Math.hypot(dx, dy);

      if (d > 6.5) {
        const spd = baseSpd * (s.speedMultiplier || 1.0);
        const step = Math.min(d, spd * dt);
        const invD = d < 0.001 ? 0.001 : d;
        s.vx = (dx / invD) * spd;
        s.vy = (dy / invD) * spd;
        s.worldX += (dx / invD) * step;
        s.worldY += (dy / invD) * step;
        s.walkPhase = (s.walkPhase || 0) + dt * (s.strideFrequency || 7.5);

        const moveYaw = Math.atan2(dx, dy);
        s.currentYaw = lerpAngle(s.currentYaw ?? moveYaw, moveYaw, dt * 6);
      } else {
        // Zona morta de chegada (~0.45m): zera velocidade e mantém soldado firme sem oscilar
        s.vx = 0;
        s.vy = 0;
        let desiredYaw = Math.PI / 2 - this.angle;
        if (this.activeCombatTarget) {
          desiredYaw = Math.atan2(
            this.activeCombatTarget.x - s.worldX,
            this.activeCombatTarget.y - s.worldY
          );
        } else if (this.aimAngle !== undefined && this.muzzleFlashTimer > 0) {
          desiredYaw = Math.PI / 2 - this.aimAngle;
        }
        s.currentYaw = lerpAngle(s.currentYaw ?? desiredYaw, desiredYaw, dt * 6);
      }
    }
  }

  setFormation(formationId) {
    if (!['line', 'column', 'wedge', 'spread'].includes(formationId)) return;
    this.formation = formationId;
    if (formationId === 'spread' && this.spacingMeters < 4.5) {
      this.spacingMeters = 5.0;
    }
    this.refreshFormationOffsets();
    this.updateSoldierWorldPositions();
  }

  setSpacing(meters) {
    this.spacingMeters = clamp(Number(meters) || 3.0, 1.0, 8.0);
    this.refreshFormationOffsets();
    this.updateSoldierWorldPositions();
  }

  toggleSelectSoldier(soldierId, exclusive = false) {
    if (this.spec.type !== 'infantry') return false;
    let found = false;
    for (const s of this.soldiers) {
      if (!s.alive) {
        s.selected = false;
        continue;
      }
      if (s.id === soldierId) {
        s.selected = exclusive ? true : !s.selected;
        found = true;
      } else if (exclusive) {
        s.selected = false;
      }
    }
    return found;
  }

  getSelectedSoldiers() {
    if (this.spec.type !== 'infantry') return [];
    return this.soldiers.filter((s) => s.alive && s.selected);
  }

  getLivingSoldiers() {
    if (this.spec.type !== 'infantry') return [];
    return this.soldiers.filter((s) => s.alive && s.hp > 0);
  }

  // Remove soldados específicos deste esquadrão (para Transferência ou Destacamento [K])
  removeSoldiersByIds(soldierIds) {
    if (this.spec.type !== 'infantry') return [];
    const idSet = new Set(soldierIds);
    const removed = [];
    const remaining = [];
    for (const s of this.soldiers) {
      if (s.alive && idSet.has(s.id)) {
        s.selected = false;
        removed.push(s);
      } else if (s.alive) {
        remaining.push(s);
      }
    }
    this.soldiers = remaining;
    this.maxSoldiers = Math.max(1, this.soldiers.length);
    this.syncSquadHealthFromSoldiers();
    this.refreshFormationOffsets();
    this.updateSoldierWorldPositions();

    if (this.soldiersAlive <= 0) {
      this.alive = false;
      this.selected = false;
      this.captured = true;
    }
    return removed;
  }

  // Recebe soldados transferidos de outro esquadrão aliado
  addTransferredSoldiers(incomingSoldiers) {
    if (this.spec.type !== 'infantry' || !Array.isArray(incomingSoldiers)) return 0;
    const livingNow = this.soldiers.filter((s) => s.alive);
    for (const inc of incomingSoldiers) {
      if (livingNow.length >= 10) break;
      livingNow.push({
        ...inc,
        alive: true,
        selected: false,
      });
    }
    this.soldiers = livingNow;
    this.maxSoldiers = this.soldiers.length;
    this.syncSquadHealthFromSoldiers();
    this.refreshFormationOffsets();
    this.updateSoldierWorldPositions();
    return incomingSoldiers.length;
  }

  toggleHoldPosition(forceValue) {
    this.holdPosition = typeof forceValue === 'boolean' ? forceValue : !this.holdPosition;
    if (this.holdPosition) {
      this.vx = 0;
      this.vy = 0;
      if (this.order.type === 'move') {
        this.order.type = 'hold';
      }
    }
    return this.holdPosition;
  }

  // Calcula os pontos exatos de cada soldado de acordo com a formação escolhida e o Espaçamento Tático (1m a 8m)
  _buildFormationOffsets(count, formation = 'line', spacingMeters = 3.0) {
    if (count <= 1) return [{ ox: 0, oy: 0 }];
    const arr = [];
    const distScale = clamp((spacingMeters || 3.0) / 3.0, 0.45, 2.85);

    if (formation === 'line') {
      const spacing = 26 * distScale;
      for (let i = 0; i < count; i++) {
        const xOff = (i - (count - 1) * 0.5) * spacing;
        const zOff = (i % 2 === 0 ? 4.5 : -4.5) * distScale;
        arr.push({ ox: xOff, oy: zOff });
      }
      return arr;
    }

    if (formation === 'column') {
      const spacing = 24 * distScale;
      for (let i = 0; i < count; i++) {
        const zOff = ((count - 1) * 0.5 - i) * spacing;
        const xOff = (i % 2 === 0 ? -5.5 : 5.5) * distScale;
        arr.push({ ox: xOff, oy: zOff });
      }
      return arr;
    }

    if (formation === 'wedge') {
      for (let i = 0; i < count; i++) {
        if (i === 0) {
          arr.push({ ox: 0, oy: 24 * distScale });
        } else {
          const rank = Math.ceil(i / 2);
          const side = i % 2 === 1 ? -1 : 1;
          arr.push({
            ox: side * rank * 22 * distScale,
            oy: (24 - rank * 20) * distScale,
          });
        }
      }
      return arr;
    }

    // 'spread' (Dispersos / Skirmish: 6m-9m)
    const ringRadius = 46 * distScale;
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        arr.push({ ox: 0, oy: 6 });
      } else {
        const a = ((i - 1) / (count - 1)) * Math.PI * 2;
        arr.push({
          ox: Math.cos(a) * ringRadius,
          oy: Math.sin(a) * ringRadius,
        });
      }
    }
    return arr;
  }

  static computeFormationWorldPreview(
    wx,
    wy,
    facingAngle,
    arg4 = 'line',
    arg5 = 5,
    spacingMeters = 3.0
  ) {
    const formation = typeof arg4 === 'string' ? arg4 : typeof arg5 === 'string' ? arg5 : 'line';
    const count = typeof arg4 === 'number' ? arg4 : typeof arg5 === 'number' ? arg5 : 5;
    const temp = SquadUnit.prototype._buildFormationOffsets(count, formation, spacingMeters);
    const rot = Math.PI / 2 - facingAngle;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return temp.map((o) => ({
      x: wx + o.ox * cos + o.oy * sin,
      y: wy - o.ox * sin + o.oy * cos,
    }));
  }

  sanitizePosition() {
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      this.x = this.lastValidPos?.x ?? 1150;
      this.y = this.lastValidPos?.y ?? 4280;
    } else {
      this.lastValidPos = { x: this.x, y: this.y };
    }
    if (!Number.isFinite(this.vx) || !Number.isFinite(this.vy)) {
      this.vx = 0;
      this.vy = 0;
    }
    for (const s of this.soldiers || []) {
      if (!Number.isFinite(s.worldX) || !Number.isFinite(s.worldY)) {
        s.worldX = this.x;
        s.worldY = this.y;
      }
      if (!Number.isFinite(s.vx) || !Number.isFinite(s.vy)) {
        s.vx = 0;
        s.vy = 0;
      }
    }
  }

  setMoveOrder(tx, ty, trenchId = null, facingAngle = null, waypoints = null) {
    if (this.surrendered || this.spec.speed <= 0 || this.embarkedInId) return;
    this.holdPosition = false;
    this.inTrench = false;
    this.inHeavyCover = false;
    this.inLightCover = false;
    this.crouchedInCover = false;
    this.suppressedTimer = 0;
    this.pinned = false;
    this.state = 'MOVING';
    this.garrisonedBuildingId = null;
    this.garrisonedBuilding = null;
    this.targetBuilding = null;
    this.coverSnap = null;
    this.snappedToCover = false;
    for (const s of this.soldiers) {
      s.targetPos = null;
      s.reactionTimer = 0;
    }
    this.finalDestination = { x: tx, y: ty };
    const rawWps = Array.isArray(waypoints) ? waypoints : [];
    const cleanWps = [];
    for (const wp of rawWps) {
      if (!wp || !Number.isFinite(wp.x) || !Number.isFinite(wp.y)) continue;
      if (cleanWps.length === 0 && Math.hypot(wp.x - this.x, wp.y - this.y) < 16) continue;
      cleanWps.push({ x: wp.x, y: wp.y });
    }
    this.waypoints = cleanWps;
    const ang =
      typeof facingAngle === 'number'
        ? facingAngle
        : Math.atan2(ty - this.y, tx - this.x);
    this.facingAngle = ang;
    this.order = {
      type: trenchId ? 'occupy_trench' : 'move',
      targetX: tx,
      targetY: ty,
      targetUnitId: null,
      targetTrenchId: trenchId,
      targetBuildingId: null,
      targetTransportId: null,
      facingAngle: ang,
    };
  }

  // Ordem de Encaixe em Muro, Saco de Areia, Carcaça ou Trincheira ("Cover Snapping")
  // Atribui destino único 1-para-1: soldier[i].targetPos = coverSlots[i]
  setCoverSnapOrder(snap, waypoints = null) {
    if (this.surrendered || this.spec.speed <= 0 || !snap || this.embarkedInId) return;
    this.holdPosition = false;
    this.inTrench = false;
    this.suppressedTimer = 0;
    this.pinned = false;
    this.state = 'MOVING';
    this.garrisonedBuildingId = null;
    this.coverSnap = snap;
    this.snappedToCover = false;
    this.facingAngle = snap.facingAngle;
    this.finalDestination = { x: snap.cx, y: snap.cy };
    const rawWps = Array.isArray(waypoints) ? waypoints : [];
    const cleanWps = [];
    for (const wp of rawWps) {
      if (!wp || !Number.isFinite(wp.x) || !Number.isFinite(wp.y)) continue;
      if (cleanWps.length === 0 && Math.hypot(wp.x - this.x, wp.y - this.y) < 16) continue;
      cleanWps.push({ x: wp.x, y: wp.y });
    }
    this.waypoints = cleanWps;

    // Distribuição explícita 1-para-1 nos Cover Slots (sem bloquear movimento)
    const living = this.getLivingSoldiers();
    for (let i = 0; i < living.length; i++) {
      living[i].reactionTimer = 0;
      const slot = snap.slots[Math.min(i, snap.slots.length - 1)] || snap.slots[0];
      if (slot) {
        living[i].targetPos = { x: slot.x, y: slot.y };
        living[i].personalTarget = { x: slot.x, y: slot.y };
      }
    }

    this.order = {
      type: snap.trenchId ? 'occupy_trench' : 'move',
      targetX: snap.cx,
      targetY: snap.cy,
      targetUnitId: null,
      targetTrenchId: snap.trenchId || null,
      targetBuildingId: null,
      targetTransportId: null,
      facingAngle: snap.facingAngle,
    };
  }

  // Ordem para Esquadrão de Infantaria embarcar no Veículo de Transporte de Tropas
  setBoardTransportOrder(transportUnit, waypoints = null) {
    if (this.surrendered || this.spec.type !== 'infantry' || !transportUnit || this.embarkedInId) {
      return;
    }
    this.garrisonedBuildingId = null;
    this.garrisonedBuilding = null;
    this.targetBuilding = null;
    this.coverSnap = null;
    this.snappedToCover = false;
    for (const s of this.soldiers) s.targetPos = null;
    this.finalDestination = { x: transportUnit.x, y: transportUnit.y };
    const rawWps = Array.isArray(waypoints) ? waypoints : [];
    const cleanWps = [];
    for (const wp of rawWps) {
      if (!wp || !Number.isFinite(wp.x) || !Number.isFinite(wp.y)) continue;
      if (cleanWps.length === 0 && Math.hypot(wp.x - this.x, wp.y - this.y) < 16) continue;
      cleanWps.push({ x: wp.x, y: wp.y });
    }
    this.waypoints = cleanWps;
    const rearX = transportUnit.x - Math.cos(transportUnit.angle) * 44;
    const rearY = transportUnit.y - Math.sin(transportUnit.angle) * 44;
    this.order = {
      type: 'board_transport',
      targetX: rearX,
      targetY: rearY,
      targetUnitId: null,
      targetTrenchId: null,
      targetBuildingId: null,
      targetTransportId: transportUnit.id,
      facingAngle: transportUnit.angle,
    };
  }

  canBoardSquad(squad, allUnits = []) {
    if (!this.spec.isTransport || !this.alive || !squad || !squad.alive) return false;
    if (squad.spec.type !== 'infantry' || squad.team !== this.team || squad.embarkedInId) return false;
    if (this.cargoSquadIds.length >= this.maxCargoSquads) return false;
    let currentSoldiers = 0;
    for (const sid of this.cargoSquadIds) {
      const cu = allUnits.find((u) => u.id === sid && u.alive);
      if (cu) currentSoldiers += cu.soldiersAlive;
    }
    return currentSoldiers + squad.soldiersAlive <= this.maxCargoSoldiers;
  }

  setGarrisonOrder(building) {
    if (this.surrendered || this.spec.type !== 'infantry' || !building) return;
    this.holdPosition = false;
    this.inTrench = false;
    this.inHeavyCover = false;
    this.inLightCover = false;
    this.suppressedTimer = 0;
    this.pinned = false;
    this.state = 'MOVING';
    this.garrisonedBuildingId = null;
    this.garrisonedBuilding = null;
    this.targetBuilding = building;
    this.coverSnap = null;
    this.snappedToCover = false;
    this.finalDestination = { x: building.x, y: building.y };
    this.waypoints = [];
    for (const s of this.soldiers) {
      s.targetPos = null;
      s.reactionTimer = 0;
    }
    this.facingAngle = Math.atan2(building.y - this.y, building.x - this.x);
    this.order = {
      type: 'garrison_building',
      targetX: building.x,
      targetY: building.y,
      targetUnitId: null,
      targetTrenchId: null,
      targetBuildingId: building.id,
      facingAngle: this.facingAngle,
    };
  }

  setAttackOrder(enemyUnit) {
    if (this.surrendered || !enemyUnit) return;
    this.coverSnap = null;
    this.snappedToCover = false;
    this.order = {
      type: 'attack_unit',
      targetX: enemyUnit.x,
      targetY: enemyUnit.y,
      targetUnitId: enemyUnit.id,
      targetTrenchId: null,
      targetBuildingId: null,
      facingAngle: Math.atan2(enemyUnit.y - this.y, enemyUnit.x - this.x),
    };
  }

  setAttackBuildingOrder(enemyBuilding) {
    if (this.surrendered || !enemyBuilding) return;
    this.coverSnap = null;
    this.snappedToCover = false;
    this.order = {
      type: 'attack_building',
      targetX: enemyBuilding.x,
      targetY: enemyBuilding.y,
      targetUnitId: null,
      targetTrenchId: null,
      targetBuildingId: enemyBuilding.id,
      facingAngle: Math.atan2(enemyBuilding.y - this.y, enemyBuilding.x - this.x),
    };
  }

  // Aplica dano individualizado ao(s) soldado(s) atingido(s) no terreno 3D
  takeDamage(
    amount,
    attackerTeam,
    game,
    bypassCover = false,
    isExplosive = false,
    hitX = null,
    hitY = null
  ) {
    if (!this.alive || this.captured) return;

    let dmg = amount;

    // Formação Dispersos ('spread') e Espaçamento Amplo (>3.5m) reduzem drasticamente o dano de área/artilharia
    if (isExplosive && this.spec.type === 'infantry') {
      if (this.formation === 'spread') dmg *= 0.55;
      if (this.spacingMeters > 3.2) {
        const spacingFactor = clamp(1 - (this.spacingMeters - 3.0) * 0.09, 0.45, 1.0);
        dmg *= spacingFactor;
      }
    }

    if (!bypassCover) {
      if (this.garrisonedBuildingId) {
        dmg *= 0.3;
      } else if (this.inTrench && this.spec.type === 'infantry') {
        dmg *= 0.35;
      } else if (this.inHeavyCover && this.spec.type === 'infantry') {
        dmg *= 0.25;
      } else if (this.inForestStealth && this.spec.type === 'infantry') {
        dmg *= 0.5;
      } else if (this.inLightCover) {
        dmg *= 0.6;
      } else if (this.inTreelineCover) {
        dmg *= 0.65;
      }
      if (this.spec.armor) {
        dmg *= 1 - this.spec.armor;
      }
    }

    if (this.surrendered) {
      dmg *= 0.12;
    }

    this.morale = Math.max(0, this.morale - dmg * 0.42);

    if (this.spec.type === 'infantry' && this.soldiers.length > 0) {
      this.updateSoldierWorldPositions();
      const living = this.soldiers.filter((s) => s.alive && s.hp > 0);
      if (living.length > 0) {
        const impactX = typeof hitX === 'number' ? hitX : this.x;
        const impactY = typeof hitY === 'number' ? hitY : this.y;

        // Ordena soldados vivos pela proximidade física ao impacto 3D
        const sortedByDist = [...living].sort(
          (a, b) =>
            dist(a.worldX, a.worldY, impactX, impactY) -
            dist(b.worldX, b.worldY, impactX, impactY)
        );

        if (isExplosive) {
          // Explosão atinge apenas soldados próximos; esquadrões espaçados (>3m) sofrem no máx. 1-2 baixas
          const splashRadius = this.spacingMeters >= 3.0 ? 44 : 64;
          const maxSplashHits = this.spacingMeters >= 5.0 ? 1 : this.spacingMeters >= 3.0 ? 2 : 4;
          let hitsCount = 0;
          for (const s of sortedByDist) {
            if (hitsCount >= maxSplashHits) break;
            const dToImpact = dist(s.worldX, s.worldY, impactX, impactY);
            if (dToImpact <= splashRadius) {
              const falloff = clamp(1 - (dToImpact / splashRadius) * 0.65, 0.3, 1.0);
              s.hp = Math.max(0, s.hp - dmg * falloff);
              hitsCount++;
              if (s.hp <= 0 && s.alive) {
                s.alive = false;
                s.selected = false;
                game?.spawnText?.(s.worldX, s.worldY - 12, `💀 ${s.name} KIA`, '#ef4444');
              }
            }
          }
          if (hitsCount === 0) {
            const closest = sortedByDist[0];
            closest.hp = Math.max(0, closest.hp - dmg * 0.65);
            if (closest.hp <= 0 && closest.alive) {
              closest.alive = false;
              closest.selected = false;
              game?.spawnText?.(closest.worldX, closest.worldY - 12, `💀 ${closest.name} KIA`, '#ef4444');
            }
          }
        } else {
          // Tiro balístico atinge especificamente o soldado mais próximo da trajetória
          let remainingDmg = dmg;
          for (const targetSoldier of sortedByDist) {
            if (remainingDmg <= 0) break;
            const absorbed = Math.min(targetSoldier.hp, remainingDmg);
            targetSoldier.hp = Math.max(0, targetSoldier.hp - absorbed);
            remainingDmg -= absorbed;
            if (targetSoldier.hp <= 0 && targetSoldier.alive) {
              targetSoldier.alive = false;
              targetSoldier.selected = false;
              game?.spawnText?.(
                targetSoldier.worldX,
                targetSoldier.worldY - 12,
                `💀 ${targetSoldier.name}`,
                '#ef4444'
              );
            }
            // Um tiro balístico localizado atinge apenas o soldado impactado
            if (typeof hitX === 'number' || dmg < 180) break;
          }
        }
      }
      this.syncSquadHealthFromSoldiers();
    } else {
      this.hp = Math.max(0, this.hp - dmg);
      if (
        this.spec.type === 'vehicle' &&
        !this.isBrokenDown &&
        this.hp > 0 &&
        this.hp <= this.maxHp * 0.3
      ) {
        this.isBrokenDown = true;
        this.vx = 0;
        this.vy = 0;
        if (game) {
          game.spawnText(this.x, this.y - 26, '⚠️ MOTOR AVARIADO!', '#f97316');
          if (this.team === 'allies') {
            game.notify(
              '⚠️ VEÍCULO AVARIADO (<= 30% HP)',
              `${this.name} sofreu pane mecânica! Envie Engenheiros para consertar.`,
              '#f97316'
            );
          }
        }
      }
    }

    // Condição de Rendição (Bandeira Branca) para esquadrões inimigos de infantaria
    // Somente Unidades de Comandante / Oficial Inimigo entram no estado RENDIDO; tropas comuns são eliminadas normalmente
    if (
      this.isCommanderSquad &&
      this.team === 'enemies' &&
      this.spec.type === 'infantry' &&
      !this.surrendered &&
      this.hp > 0 &&
      this.hp <= this.maxHp * 0.45
    ) {
      const nearbyAllies = game ? game.countNearbyUnits(this.x, this.y, 320, 'allies') : 1;
      const nearbyFriends = game ? game.countNearbyUnits(this.x, this.y, 220, 'enemies', this.id) : 0;
      if (nearbyAllies >= 1 && (this.inTrench || nearbyAllies >= nearbyFriends || this.soldiersAlive <= 2)) {
        this.surrendered = true;
        this.garrisonedBuildingId = null;
        this.vx = 0;
        this.vy = 0;
        this.order.type = 'hold';
        game?.onEnemySquadSurrendered(this);
      }
    }

    if (this.hp <= 0 || (this.spec.type === 'infantry' && this.soldiersAlive <= 0)) {
      this.hp = 0;
      this.alive = false;
      this.selected = false;
      this.garrisonedBuildingId = null;
      game?.onUnitDestroyed(this, attackerTeam);
    }
  }
}

export class TrenchSegment {
  constructor({ points, team = 'allies', isLShape = false, revealed = false }) {
    this.id = NEXT_TRENCH_ID++;
    this.points = points;
    this.team = team;
    this.isLShape = isLShape;
    this.width = 48;
    this.revealed = team === 'allies' ? true : revealed;
  }

  containsPoint(px, py, extraRadius = 14) {
    const threshold = this.width * 0.55 + extraRadius;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const d = this._distToSegment(px, py, a.x, a.y, b.x, b.y);
      if (d <= threshold) return true;
    }
    return false;
  }

  getSlotPosition(slotIndex = 0, totalSlots = 1) {
    const a = this.points[0];
    const b = this.points[this.points.length - 1];
    const t = totalSlots <= 1 ? 0.5 : clamp((slotIndex + 0.5) / totalSlots, 0.15, 0.85);
    if (this.points.length === 3) {
      const mid = this.points[1];
      if (t < 0.5) {
        const lt = t * 2;
        return { x: a.x + (mid.x - a.x) * lt, y: a.y + (mid.y - a.y) * lt };
      }
      const lt = (t - 0.5) * 2;
      return { x: mid.x + (b.x - mid.x) * lt, y: mid.y + (b.y - mid.y) * lt };
    }
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  getCenter() {
    if (this.points.length === 3) {
      return { x: this.points[1].x, y: this.points[1].y };
    }
    return {
      x: (this.points[0].x + this.points[1].x) * 0.5,
      y: (this.points[0].y + this.points[1].y) * 0.5,
    };
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return dist(px, py, x1, y1);
    const t = clamp(((px - x1) * vx + (py - this.y1) * vy) / l2, 0, 1);
    return dist(px, py, x1 + t * vx, y1 + t * vy);
  }
}

export class BarricadeLine {
  constructor({ x1, y1, x2, y2, team = 'allies' }) {
    this.id = NEXT_BARRICADE_ID++;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.team = team;
    this.width = 28;
  }

  containsPoint(px, py, extraRadius = 18) {
    const vx = this.x2 - this.x1;
    const vy = this.y2 - this.y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return dist(px, py, this.x1, this.y1) <= extraRadius;
    const t = clamp(((px - this.x1) * vx + (py - this.y1) * vy) / l2, 0, 1);
    return dist(px, py, this.x1 + t * vx, this.y1 + t * vy) <= this.width * 0.5 + extraRadius;
  }
}

export class Landmine {
  constructor({ x, y, team = 'allies', faction = 'player', revealed = false }) {
    this.id = NEXT_MINE_ID++;
    this.x = x;
    this.y = y;
    this.team = team;
    this.faction = faction;
    this.triggerRadius = 32;
    this.blastRadius = 105;
    this.damage = 220;
    this.active = true;
    this.revealed = team === 'allies' ? true : revealed;
  }
}

let NEXT_WALL_ID = 1;
let NEXT_WIRE_ID = 1;

export class FortifiedWallLine {
  constructor({
    x1,
    y1,
    x2,
    y2,
    team = 'allies',
    isGate = false,
    reinforced = false,
    isElite = false,
    maxHp = 2500,
  }) {
    this.id = NEXT_WALL_ID++;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.team = team;
    this.width = 22; // ~1.4m de espessura
    this.height = 46; // ~3.2m de altura
    this.maxHp = reinforced ? Math.round(maxHp * 1.5) : maxHp;
    this.hp = this.maxHp;
    this.isGate = Boolean(isGate);
    this.gateOpen = false;
    this.gateOpenProgress = 0;
    this.reinforced = Boolean(reinforced);
    this.isElite = Boolean(isElite);
    this._meshVersion = 1;
  }

  getCenter() {
    return { x: (this.x1 + this.x2) * 0.5, y: (this.y1 + this.y2) * 0.5 };
  }

  getLength() {
    return Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
  }

  containsPoint(px, py, extraRadius = 18) {
    const vx = this.x2 - this.x1;
    const vy = this.y2 - this.y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return dist(px, py, this.x1, this.y1) <= extraRadius;
    const t = clamp(((px - this.x1) * vx + (py - this.y1) * vy) / l2, 0, 1);
    return dist(px, py, this.x1 + t * vx, this.y1 + t * vy) <= this.width * 0.5 + extraRadius;
  }
}

export class BarbedWireLine {
  constructor({ x1, y1, x2, y2, team = 'allies' }) {
    this.id = NEXT_WIRE_ID++;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.team = team;
    this.width = 22;
    this.active = true;
  }

  containsPoint(px, py, extraRadius = 16) {
    if (!this.active) return false;
    const vx = this.x2 - this.x1;
    const vy = this.y2 - this.y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return dist(px, py, this.x1, this.y1) <= extraRadius;
    const t = clamp(((px - this.x1) * vx + (py - this.y1) * vy) / l2, 0, 1);
    return dist(px, py, this.x1 + t * vx, this.y1 + t * vy) <= this.width * 0.5 + extraRadius;
  }
}
