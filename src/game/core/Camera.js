export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.w = 800; this.h = 600;
    this.zoom = 1; this.targetZoom = 1;
    this.shakeT = 0; this.shakeMag = 0;
    this.ox = 0; this.oy = 0;
  }

  resize(w, h) { this.w = w; this.h = h; }

  shake(mag, time = 0.15) {
    if (mag <= 0) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, time);
  }

  follow(tx, ty, dt) {
    const k = 1 - Math.exp(-dt * 7);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 2.5));
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.ox = (Math.random() * 2 - 1) * this.shakeMag;
      this.oy = (Math.random() * 2 - 1) * this.shakeMag;
      if (this.shakeT <= 0) this.shakeMag = 0;
    } else {
      this.ox = 0; this.oy = 0;
    }
  }

  get viewW() { return this.w / this.zoom; }
  get viewH() { return this.h / this.zoom; }
  get left() { return this.x - this.viewW / 2 + this.ox; }
  get top() { return this.y - this.viewH / 2 + this.oy; }

  apply(ctx) {
    const z = this.zoom;
    ctx.setTransform(z, 0, 0, z, Math.round(-this.left * z), Math.round(-this.top * z));
  }

  screenToWorld(sx, sy) {
    return { x: this.left + sx / this.zoom, y: this.top + sy / this.zoom };
  }

  inView(x, y, m = 64) {
    const l = this.left, t = this.top;
    return x > l - m && x < l + this.viewW + m && y > t - m && y < t + this.viewH + m;
  }

  rectInView(r, m = 0) {
    const l = this.left, t = this.top;
    return r.x + r.w > l - m && r.x < l + this.viewW + m && r.y + r.h > t - m && r.y < t + this.viewH + m;
  }
}
