import * as THREE from 'three';

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.effects = [];
    this.tracers = [];
    this.scorchMarks = [];

    this.geometries = {
      sphere: new THREE.SphereGeometry(1, 10, 8),
      cone: new THREE.ConeGeometry(1, 2.2, 6),
      ring: new THREE.RingGeometry(0.7, 1.0, 24),
      box: new THREE.BoxGeometry(1, 1, 1),
      circle: new THREE.CircleGeometry(1, 18),
    };
    this.geometries.ring.rotateX(-Math.PI / 2);
    this.geometries.circle.rotateX(-Math.PI / 2);
  }

  clear() {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.effects = [];
    this.tracers = [];
    this.scorchMarks = [];
  }

  spawnMuzzleFlash(x, y, z, angle, isHeavyCannon = false) {
    // Clarão de fogo alaranjado/amarelo na ponta do cano + PointLight rápida
    const flashMat = new THREE.MeshBasicMaterial({
      color: isHeavyCannon ? 0xffa726 : 0xffd54f,
      transparent: true,
      opacity: 0.95,
    });
    const flash = new THREE.Mesh(this.geometries.cone, flashMat);
    const sc = isHeavyCannon ? 7.5 : 2.6;
    flash.scale.set(sc, sc * 1.6, sc);
    flash.position.set(x, y, z);
    flash.rotation.order = 'YXZ';
    flash.rotation.y = Math.PI / 2 - angle;
    flash.rotation.x = Math.PI / 2;
    this.group.add(flash);

    const light = new THREE.PointLight(0xff9800, isHeavyCannon ? 5.5 : 2.2, isHeavyCannon ? 180 : 75);
    light.position.set(x, y + 4, z);
    this.group.add(light);

    this.effects.push({
      kind: 'flash',
      mesh: flash,
      light,
      life: isHeavyCannon ? 0.14 : 0.075,
      maxLife: isHeavyCannon ? 0.14 : 0.075,
    });

    if (isHeavyCannon) {
      // Fumaça densa saindo do cano do canhão do Tanque/Artilharia
      for (let i = 0; i < 4; i++) {
        const smMat = new THREE.MeshStandardMaterial({
          color: 0x3b3833,
          transparent: true,
          opacity: 0.78,
          roughness: 0.95,
        });
        const sm = new THREE.Mesh(this.geometries.sphere, smMat);
        sm.scale.setScalar(6 + i * 1.5);
        sm.position.set(
          x + Math.cos(angle) * (8 + i * 6),
          y + 2 + i * 2,
          z + Math.sin(angle) * (8 + i * 6)
        );
        this.group.add(sm);
        this.effects.push({
          kind: 'smoke',
          mesh: sm,
          vx: Math.cos(angle) * (42 - i * 6) + (Math.random() - 0.5) * 14,
          vy: 14 + Math.random() * 10,
          vz: Math.sin(angle) * (42 - i * 6) + (Math.random() - 0.5) * 14,
          grow: 18,
          life: 0.9 + i * 0.15,
          maxLife: 0.9 + i * 0.15,
        });
      }
    }
  }

  spawnTracer(x1, y1, z1, x2, y2, z2, isHeavy = false) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const totalDist = Math.hypot(dx, dy, dz);
    if (totalDist < 4) return;

    const mat = new THREE.MeshBasicMaterial({
      color: isHeavy ? 0xff7043 : 0xffca28,
      transparent: true,
      opacity: 0.95,
    });
    const bolt = new THREE.Mesh(this.geometries.box, mat);
    bolt.scale.set(isHeavy ? 3.2 : 1.4, isHeavy ? 3.2 : 1.4, isHeavy ? 26 : 16);
    bolt.position.set(x1, y1, z1);
    bolt.lookAt(x2, y2, z2);
    this.group.add(bolt);

    const speed = isHeavy ? 950 : 1450;
    const travelTime = Math.max(0.05, Math.min(0.45, totalDist / speed));
    this.tracers.push({
      mesh: bolt,
      x1,
      y1,
      z1,
      x2,
      y2,
      z2,
      t: 0,
      duration: travelTime,
    });
  }

  spawnImpact(x, y, z, isMetallic = false) {
    const count = isMetallic ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: isMetallic ? 0xffb74d : 0x8d7b64,
        transparent: true,
        opacity: 0.9,
      });
      const p = new THREE.Mesh(this.geometries.box, mat);
      const sc = isMetallic ? 1.8 : 3.4;
      p.scale.setScalar(sc);
      p.position.set(x, y + 1, z);
      this.group.add(p);
      this.effects.push({
        kind: 'debris',
        mesh: p,
        vx: (Math.random() - 0.5) * 75,
        vy: 35 + Math.random() * 55,
        vz: (Math.random() - 0.5) * 75,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
      });
    }
  }

  spawnHeavyExplosion(x, y, z, radiusScale = 1.0) {
    // 1. Bola de fogo brilhante central (amarelo -> laranja -> vermelho escuro)
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xffeb3b,
      transparent: true,
      opacity: 0.96,
    });
    const fireball = new THREE.Mesh(this.geometries.sphere, fireMat);
    fireball.position.set(x, y + 6, z);
    fireball.scale.setScalar(8 * radiusScale);
    this.group.add(fireball);

    const light = new THREE.PointLight(0xff6d00, 7.5 * radiusScale, 260 * radiusScale);
    light.position.set(x, y + 18, z);
    this.group.add(light);

    this.effects.push({
      kind: 'fireball',
      mesh: fireball,
      light,
      baseScale: 8 * radiusScale,
      maxScale: 42 * radiusScale,
      life: 0.48,
      maxLife: 0.48,
    });

    // 2. Onda de choque circular no chão (Shockwave ring)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(this.geometries.ring, ringMat);
    ring.position.set(x, y + 2.2, z);
    ring.scale.setScalar(10 * radiusScale);
    this.group.add(ring);
    this.effects.push({
      kind: 'shockwave',
      mesh: ring,
      maxScale: 95 * radiusScale,
      life: 0.42,
      maxLife: 0.42,
    });

    // 3. Coluna de fumaça preta/cinza escura que sobe lentamente
    for (let i = 0; i < 7; i++) {
      const shade = i % 2 === 0 ? 0x1e1d1b : 0x34312d;
      const smMat = new THREE.MeshStandardMaterial({
        color: shade,
        transparent: true,
        opacity: 0.82,
        roughness: 0.98,
      });
      const sm = new THREE.Mesh(this.geometries.sphere, smMat);
      sm.scale.setScalar((10 + i * 2.5) * radiusScale);
      sm.position.set(
        x + (Math.random() - 0.5) * 18 * radiusScale,
        y + 8 + i * 6,
        z + (Math.random() - 0.5) * 18 * radiusScale
      );
      this.group.add(sm);
      this.effects.push({
        kind: 'smoke',
        mesh: sm,
        vx: (Math.random() - 0.5) * 16,
        vy: (24 + i * 4) * radiusScale,
        vz: (Math.random() - 0.5) * 16,
        grow: 22 * radiusScale,
        life: 2.1 + Math.random() * 0.7,
        maxLife: 2.8,
      });
    }

    // 4. Detritos de terra/fogo voando em parábola + marca escura de cratera queimada
    for (let i = 0; i < 12; i++) {
      const isFireChunk = i % 3 === 0;
      const dMat = new THREE.MeshBasicMaterial({
        color: isFireChunk ? 0xff7043 : 0x3a2c1e,
        transparent: true,
        opacity: 0.95,
      });
      const deb = new THREE.Mesh(this.geometries.box, dMat);
      deb.scale.setScalar((2.4 + Math.random() * 2.4) * radiusScale);
      deb.position.set(x, y + 4, z);
      this.group.add(deb);
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const sp = (60 + Math.random() * 90) * radiusScale;
      this.effects.push({
        kind: 'debris',
        mesh: deb,
        vx: Math.cos(a) * sp,
        vy: (85 + Math.random() * 90) * radiusScale,
        vz: Math.sin(a) * sp,
        life: 0.85 + Math.random() * 0.35,
        maxLife: 1.2,
      });
    }

    const scorchMat = new THREE.MeshBasicMaterial({
      color: 0x181410,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const scorch = new THREE.Mesh(this.geometries.circle, scorchMat);
    scorch.position.set(x, y + 1.1, z);
    scorch.scale.setScalar(34 * radiusScale);
    this.group.add(scorch);
    this.scorchMarks.push(scorch);
    if (this.scorchMarks.length > 48) {
      const old = this.scorchMarks.shift();
      this.group.remove(old);
    }
  }

  spawnGrenadeArc(x1, y1, z1, x2, y2, z2, duration = 0.55) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2f3e24, roughness: 0.7 });
    const gran = new THREE.Mesh(this.geometries.sphere, mat);
    gran.scale.setScalar(2.4);
    gran.position.set(x1, y1, z1);
    this.group.add(gran);
    this.effects.push({
      kind: 'grenade_arc',
      mesh: gran,
      x1,
      y1,
      z1,
      x2,
      y2,
      z2,
      life: duration,
      maxLife: duration,
    });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      const p = Math.min(1, tr.t / tr.duration);
      tr.mesh.position.set(
        tr.x1 + (tr.x2 - tr.x1) * p,
        tr.y1 + (tr.y2 - tr.y1) * p,
        tr.z1 + (tr.z2 - tr.z1) * p
      );
      if (p >= 1) {
        this.group.remove(tr.mesh);
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      ef.life -= dt;
      const ratio = Math.max(0, ef.life / ef.maxLife);

      if (ef.kind === 'flash') {
        ef.mesh.material.opacity = ratio;
        if (ef.light) ef.light.intensity *= ratio;
      } else if (ef.kind === 'fireball') {
        const prog = 1 - ratio;
        const sc = ef.baseScale + (ef.maxScale - ef.baseScale) * Math.sin(prog * Math.PI * 0.65);
        ef.mesh.scale.setScalar(sc);
        ef.mesh.material.opacity = ratio;
        if (prog < 0.35) ef.mesh.material.color.setHex(0xffeb3b);
        else if (prog < 0.7) ef.mesh.material.color.setHex(0xff7043);
        else ef.mesh.material.color.setHex(0x8e2412);
        if (ef.light) ef.light.intensity = 7.5 * ratio;
      } else if (ef.kind === 'shockwave') {
        const prog = 1 - ratio;
        ef.mesh.scale.setScalar(10 + ef.maxScale * prog);
        ef.mesh.material.opacity = ratio * 0.85;
      } else if (ef.kind === 'smoke') {
        ef.mesh.position.x += ef.vx * dt;
        ef.mesh.position.y += ef.vy * dt;
        ef.mesh.position.z += ef.vz * dt;
        ef.mesh.scale.addScalar(ef.grow * dt);
        ef.mesh.material.opacity = ratio * 0.75;
      } else if (ef.kind === 'grenade_arc') {
        const prog = 1 - ratio;
        const arcH = Math.sin(prog * Math.PI) * 58;
        ef.mesh.position.set(
          ef.x1 + (ef.x2 - ef.x1) * prog,
          ef.y1 + (ef.y2 - ef.y1) * prog + arcH,
          ef.z1 + (ef.z2 - ef.z1) * prog
        );
        ef.mesh.rotation.x += 12 * dt;
      } else if (ef.kind === 'debris') {
        ef.vy -= 210 * dt;
        ef.mesh.position.x += ef.vx * dt;
        ef.mesh.position.y += ef.vy * dt;
        ef.mesh.position.z += ef.vz * dt;
        ef.mesh.rotation.x += 6 * dt;
        ef.mesh.rotation.y += 5 * dt;
        ef.mesh.material.opacity = ratio;
      }

      if (ef.life <= 0) {
        this.group.remove(ef.mesh);
        if (ef.light) this.group.remove(ef.light);
        this.effects.splice(i, 1);
      }
    }
  }
}
