// Sistema Híbrido de Entrada: Teclado + Mouse RTS (PC) + Multi-Touch Screen (Celular e Tablet)
// Suporta: Clique Esquerdo/Direito, Arrastar Caixa, Botão do Meio p/ Câmera, Toque Simples, Arrastar 1 Dedo (Seleção/Construção ou Câmera), Arrastar 2 Dedos (Pan), Pinça 2 Dedos (Pinch-to-Zoom) e Toque Longo 0.4s + Arrastar (Orientação de Formação)
const BLOCKED = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = {
      x: (canvas.clientWidth || 800) / 2,
      y: (canvas.clientHeight || 600) / 2,
      down: false,
      rightDown: false,
      middleDown: false,
      clicked: false,
      rightClicked: false,
      released: false,
      rightReleased: false,
      dragStartX: 0,
      dragStartY: 0,
      isDragging: false,
      rightDragStartX: 0,
      rightDragStartY: 0,
      isRightDragging: false,
      isTouchEvent: false,
    };

    // Estado Multi-Touch para Mobile / Tablet
    this.touch = {
      activeCount: 0,
      tap: null, // { x, y } emitido em toque simples rápido
      panDeltaX: 0,
      panDeltaY: 0,
      pinchDelta: 0,
      isLongPressOrientation: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startTime: 0,
      moved: false,
      lastTwoDist: 0,
      lastTwoMidX: 0,
      lastTwoMidY: 0,
      longPressTimer: null,
    };

    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.wheel = 0;
    this.pointerLocked = false;
    this.useRelativeMove = false;

    this._kd = (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    };
    this._ku = (e) => this.keys.delete(e.code);

    this._mm = (e) => {
      const r = canvas.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;

      if (this.mouse.middleDown) {
        this.touch.panDeltaX += nx - this.mouse.x;
        this.touch.panDeltaY += ny - this.mouse.y;
      }

      this.mouse.x = nx;
      this.mouse.y = ny;

      if (this.mouse.down && !this.mouse.isTouchEvent) {
        const dx = this.mouse.x - this.mouse.dragStartX;
        const dy = this.mouse.y - this.mouse.dragStartY;
        if (Math.hypot(dx, dy) > 8) {
          this.mouse.isDragging = true;
        }
      }
      if (this.mouse.rightDown && !this.mouse.isTouchEvent) {
        const dx = this.mouse.x - this.mouse.rightDragStartX;
        const dy = this.mouse.y - this.mouse.rightDragStartY;
        if (Math.hypot(dx, dy) > 10) {
          this.mouse.isRightDragging = true;
        }
      }
    };

    this._md = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.isTouchEvent = false;
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
        this.mouse.dragStartX = this.mouse.x;
        this.mouse.dragStartY = this.mouse.y;
        this.mouse.isDragging = false;
      } else if (e.button === 1) {
        e.preventDefault();
        this.mouse.middleDown = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
        this.mouse.rightClicked = true;
        this.mouse.rightDragStartX = this.mouse.x;
        this.mouse.rightDragStartY = this.mouse.y;
        this.mouse.isRightDragging = false;
      }
    };

    this._mu = (e) => {
      if (e.button === 0) {
        if (this.mouse.down) this.mouse.released = true;
        this.mouse.down = false;
      } else if (e.button === 1) {
        this.mouse.middleDown = false;
      } else if (e.button === 2) {
        if (this.mouse.rightDown) this.mouse.rightReleased = true;
        this.mouse.rightDown = false;
      }
    };

    this._wh = (e) => {
      this.wheel += Math.sign(e.deltaY);
    };
    this._cm = (e) => e.preventDefault();

    // =========================================================================
    // EVENTOS MULTI-TOUCH (CELULAR E TABLET)
    // =========================================================================
    this._clearLongPress = () => {
      if (this.touch.longPressTimer) {
        clearTimeout(this.touch.longPressTimer);
        this.touch.longPressTimer = null;
      }
    };

    this._ts = (e) => {
      if (e.cancelable) e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const touches = e.touches;
      this.touch.activeCount = touches.length;
      this.mouse.isTouchEvent = true;

      if (touches.length === 1) {
        const tx = touches[0].clientX - r.left;
        const ty = touches[0].clientY - r.top;
        this.mouse.x = tx;
        this.mouse.y = ty;
        this.touch.startX = tx;
        this.touch.startY = ty;
        this.touch.lastX = tx;
        this.touch.lastY = ty;
        this.touch.startTime = performance.now();
        this.touch.moved = false;
        this.touch.isLongPressOrientation = false;

        this.mouse.down = true;
        this.mouse.clicked = true;
        this.mouse.dragStartX = tx;
        this.mouse.dragStartY = ty;
        this.mouse.isDragging = false;

        this._clearLongPress();
        // Toque Longo (0.4s = 400ms) sem mover o dedo inicia Orientação de Formação (equivalente ao Clique Direito + Arrastar)
        this.touch.longPressTimer = setTimeout(() => {
          if (this.touch.activeCount === 1 && !this.touch.moved) {
            this.touch.isLongPressOrientation = true;
            this.mouse.down = false;
            this.mouse.isDragging = false;
            this.mouse.rightDown = true;
            this.mouse.rightClicked = true;
            this.mouse.rightDragStartX = this.touch.startX;
            this.mouse.rightDragStartY = this.touch.startY;
            this.mouse.isRightDragging = true;
          }
        }, 400);
      } else if (touches.length >= 2) {
        // 2 Dedos: Cancela seleção/long-press e ativa Pan + Pinch-to-Zoom imediato
        this._clearLongPress();
        this.mouse.down = false;
        this.mouse.isDragging = false;
        this.mouse.rightDown = false;
        this.mouse.isRightDragging = false;
        this.touch.isLongPressOrientation = false;

        const x1 = touches[0].clientX - r.left;
        const y1 = touches[0].clientY - r.top;
        const x2 = touches[1].clientX - r.left;
        const y2 = touches[1].clientY - r.top;
        this.touch.lastTwoDist = Math.hypot(x2 - x1, y2 - y1);
        this.touch.lastTwoMidX = (x1 + x2) * 0.5;
        this.touch.lastTwoMidY = (y1 + y2) * 0.5;
      }
    };

    this._tm = (e) => {
      if (e.cancelable) e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const touches = e.touches;
      this.touch.activeCount = touches.length;

      if (touches.length === 1) {
        const tx = touches[0].clientX - r.left;
        const ty = touches[0].clientY - r.top;
        const dxStart = tx - this.touch.startX;
        const dyStart = ty - this.touch.startY;

        const stepX = tx - this.touch.lastX;
        const stepY = ty - this.touch.lastY;
        this.touch.lastX = tx;
        this.touch.lastY = ty;
        this.mouse.x = tx;
        this.mouse.y = ty;

        if (Math.hypot(dxStart, dyStart) > 12) {
          this.touch.moved = true;
          this._clearLongPress();
        }

        if (this.touch.isLongPressOrientation) {
          this.mouse.rightDown = true;
          this.mouse.isRightDragging = true;
        } else if (this.touch.moved) {
          this.mouse.isDragging = true;
          // Acumula delta de 1 dedo caso o jogo esteja em [Modo Câmera ✋]
          this.touch.singleDragDeltaX = (this.touch.singleDragDeltaX || 0) + stepX;
          this.touch.singleDragDeltaY = (this.touch.singleDragDeltaY || 0) + stepY;
        }
      } else if (touches.length >= 2) {
        this._clearLongPress();
        const x1 = touches[0].clientX - r.left;
        const y1 = touches[0].clientY - r.top;
        const x2 = touches[1].clientX - r.left;
        const y2 = touches[1].clientY - r.top;

        const newDist = Math.hypot(x2 - x1, y2 - y1);
        const newMidX = (x1 + x2) * 0.5;
        const newMidY = (y1 + y2) * 0.5;

        if (this.touch.lastTwoDist > 0) {
          this.touch.pinchDelta += this.touch.lastTwoDist - newDist;
          this.touch.panDeltaX += newMidX - this.touch.lastTwoMidX;
          this.touch.panDeltaY += newMidY - this.touch.lastTwoMidY;
        }

        this.touch.lastTwoDist = newDist;
        this.touch.lastTwoMidX = newMidX;
        this.touch.lastTwoMidY = newMidY;
      }
    };

    this._te = (e) => {
      if (e.cancelable) e.preventDefault();
      this._clearLongPress();
      const remaining = e.touches.length;
      this.touch.activeCount = remaining;

      if (remaining === 0) {
        if (this.touch.isLongPressOrientation) {
          this.mouse.rightDown = false;
          this.mouse.rightReleased = true;
          this.touch.isLongPressOrientation = false;
        } else {
          const elapsed = performance.now() - this.touch.startTime;
          if (!this.touch.moved && elapsed < 380) {
            this.touch.tap = { x: this.touch.startX, y: this.touch.startY };
          }
          this.mouse.down = false;
          this.mouse.released = true;
        }
        this.touch.lastTwoDist = 0;
      } else if (remaining === 1) {
        const r = canvas.getBoundingClientRect();
        this.touch.lastX = e.touches[0].clientX - r.left;
        this.touch.lastY = e.touches[0].clientY - r.top;
        this.touch.lastTwoDist = 0;
      }
    };

    this._blur = () => {
      this._clearLongPress();
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
      this.mouse.middleDown = false;
      this.mouse.isDragging = false;
      this.mouse.isRightDragging = false;
      this.touch.activeCount = 0;
      this.touch.isLongPressOrientation = false;
    };

    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('mousemove', this._mm);
    window.addEventListener('mouseup', this._mu);
    window.addEventListener('pointerup', this._mu);
    window.addEventListener('pointercancel', this._blur);
    window.addEventListener('blur', this._blur);
    canvas.addEventListener('mousedown', this._md);
    canvas.addEventListener('wheel', this._wh, { passive: true });
    canvas.addEventListener('contextmenu', this._cm);
    canvas.addEventListener('touchstart', this._ts, { passive: false });
    canvas.addEventListener('touchmove', this._tm, { passive: false });
    canvas.addEventListener('touchend', this._te, { passive: false });
    canvas.addEventListener('touchcancel', this._te, { passive: false });
  }

  requestPointerLock() {}

  exitPointerLock() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // noop
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightClicked = false;
    this.mouse.released = false;
    this.mouse.rightReleased = false;
    this.touch.tap = null;
    this.touch.panDeltaX = 0;
    this.touch.panDeltaY = 0;
    this.touch.pinchDelta = 0;
    this.touch.singleDragDeltaX = 0;
    this.touch.singleDragDeltaY = 0;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.wheel = 0;
  }

  destroy() {
    this._clearLongPress();
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('mousemove', this._mm);
    window.removeEventListener('mouseup', this._mu);
    window.removeEventListener('pointerup', this._mu);
    window.removeEventListener('pointercancel', this._blur);
    window.removeEventListener('blur', this._blur);
    this.canvas.removeEventListener('mousedown', this._md);
    this.canvas.removeEventListener('wheel', this._wh);
    this.canvas.removeEventListener('contextmenu', this._cm);
    this.canvas.removeEventListener('touchstart', this._ts);
    this.canvas.removeEventListener('touchmove', this._tm);
    this.canvas.removeEventListener('touchend', this._te);
    this.canvas.removeEventListener('touchcancel', this._te);
  }
}
