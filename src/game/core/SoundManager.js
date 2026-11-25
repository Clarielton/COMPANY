// =============================================================================
// SoundManager — Sistema de Áudio Militar 100% Procedural (Web Audio API)
// Sem arquivos MP3 externos: Ruído Rosa/Marrom, Osciladores, Filtros e Loops
// =============================================================================

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;

    this.whiteNoiseBuf = null;
    this.pinkNoiseBuf = null;
    this.brownNoiseBuf = null;

    this.last = {};
    this.muted = false;
    this.volume = 0.35;
    this.mode = 'none'; // 'none' | 'menu' | 'battle' | 'paused'

    // Timers de música / ambiente
    this._musicTimer = null;
    this._ambienceTimer = null;
    this._musicStep = 0;

    // Nós contínuos (Ambiente + Motor Diesel/Esteiras + Drone)
    this._windNode = null;
    this._engineOsc = null;
    this._engineSubOsc = null;
    this._engineTrackSrc = null;
    this._engineGain = null;
    this._engineFilter = null;
    this._droneOsc = null;
    this._droneGain = null;
  }

  resume() {
    try {
      if (!this.ctx) {
        const AC =
          typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        this.ctx = new AC();

        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.42;
        this.musicGain.connect(this.master);

        this.ambienceGain = this.ctx.createGain();
        this.ambienceGain.gain.value = 0.35;
        this.ambienceGain.connect(this.master);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.95;
        this.sfxGain.connect(this.master);

        this._buildNoiseBuffers();
        this._initContinuousLoops();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.mode === 'menu' && !this._musicTimer) {
        this._startMenuMusic();
      } else if (this.mode === 'battle' && !this._ambienceTimer) {
        this._startBattleAmbience();
      }
    } catch {
      this.ctx = null;
    }
  }

  _buildNoiseBuffers() {
    const c = this.ctx;
    const sr = c.sampleRate;
    const len = sr * 2;

    // 1. Ruído Branco
    this.whiteNoiseBuf = c.createBuffer(1, len, sr);
    const wd = this.whiteNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;

    // 2. Ruído Rosa (Paul Kellet)
    this.pinkNoiseBuf = c.createBuffer(1, len, sr);
    const pd = this.pinkNoiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 3. Ruído Marrom (grave/vento/motor)
    this.brownNoiseBuf = c.createBuffer(1, len, sr);
    const bd = this.brownNoiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      bd[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = bd[i];
      bd[i] *= 3.2;
    }
  }

  _initContinuousLoops() {
    const c = this.ctx;
    if (!c) return;

    // Motor Diesel + Esteiras Metálicas Contínuas
    this._engineGain = c.createGain();
    this._engineGain.gain.value = 0;
    this._engineFilter = c.createBiquadFilter();
    this._engineFilter.type = 'lowpass';
    this._engineFilter.frequency.value = 180;
    this._engineFilter.Q.value = 2.5;
    this._engineFilter.connect(this._engineGain);
    this._engineGain.connect(this.sfxGain);

    this._engineOsc = c.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 38;
    this._engineOsc.connect(this._engineFilter);
    this._engineOsc.start();

    this._engineSubOsc = c.createOscillator();
    this._engineSubOsc.type = 'triangle';
    this._engineSubOsc.frequency.value = 76;
    const subGain = c.createGain();
    subGain.gain.value = 0.35;
    this._engineSubOsc.connect(subGain);
    subGain.connect(this._engineFilter);
    this._engineSubOsc.start();

    // Rangido metálico das esteiras (ruído rosa filtrado)
    this._engineTrackSrc = c.createBufferSource();
    this._engineTrackSrc.buffer = this.pinkNoiseBuf;
    this._engineTrackSrc.loop = true;
    const trackFilter = c.createBiquadFilter();
    trackFilter.type = 'bandpass';
    trackFilter.frequency.value = 620;
    trackFilter.Q.value = 3.2;
    const trackGain = c.createGain();
    trackGain.gain.value = 0.25;
    this._engineTrackSrc.connect(trackFilter);
    trackFilter.connect(trackGain);
    trackGain.connect(this._engineGain);
    this._engineTrackSrc.start();

    // Zunido elétrico de Drone voando
    this._droneGain = c.createGain();
    this._droneGain.gain.value = 0;
    this._droneOsc = c.createOscillator();
    this._droneOsc.type = 'sawtooth';
    this._droneOsc.frequency.value = 290;
    const droneFilter = c.createBiquadFilter();
    droneFilter.type = 'bandpass';
    droneFilter.frequency.value = 680;
    droneFilter.Q.value = 2.0;
    this._droneOsc.connect(droneFilter);
    droneFilter.connect(this._droneGain);
    this._droneGain.connect(this.sfxGain);
    this._droneOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx?.currentTime || 0, 0.04);
    }
    return this.muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx?.currentTime || 0, 0.04);
    }
  }

  // Alterna entre Música de Menu Principal ('menu'), Ambiente de Guerra ('battle') e Pausa ('paused')
  setMusicMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this._stopMusicAndAmbience();
    if (!this.ctx) return;

    if (newMode === 'menu') {
      this._startMenuMusic();
    } else if (newMode === 'battle') {
      this._startBattleAmbience();
    }
  }

  _stopMusicAndAmbience() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
    if (this._ambienceTimer) {
      clearInterval(this._ambienceTimer);
      this._ambienceTimer = null;
    }
    if (this._windNode) {
      try {
        this._windNode.stop();
      } catch { /* noop */ }
      this._windNode = null;
    }
    if (this.ctx && this._engineGain) {
      this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    if (this.ctx && this._droneGain) {
      this._droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  // Tema Orquestral/Militar Tenso do Menu Principal (tambores cadenciados, cordas graves e metais solenes)
  _startMenuMusic() {
    if (!this.ctx) return;
    this._musicStep = 0;
    const bassNotes = [55.0, 55.0, 65.41, 61.74, 55.0, 55.0, 73.42, 65.41]; // Lá1, Dó2, Si1, Ré2
    const brassNotes = [110.0, 130.81, 164.81, 146.83, 110.0, 123.47, 146.83, 130.81];

    const tick = () => {
      if (!this.ctx || this.mode !== 'menu' || this.muted) return;
      const c = this.ctx;
      const t = c.currentTime;
      const step = this._musicStep++;

      // Tambor militar grave (Tímpano / Bumbo) no tempo 0 e 2
      if (step % 2 === 0) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(step % 4 === 0 ? 78 : 66, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.45);
      }

      // Caixa militar (Snare cadenciado) sutil
      if (step % 4 === 1 || step % 4 === 3 || step % 8 === 6) {
        this._playSnareHit(0.14, this.musicGain);
      }

      // Cordas graves sintetizadas a cada 4 tempos
      if (step % 4 === 0) {
        const idx = Math.floor(step / 4) % bassNotes.length;
        const f = bassNotes[idx];
        for (const detune of [-6, 6]) {
          const s = c.createOscillator();
          s.type = 'sawtooth';
          s.frequency.setValueAtTime(f, t);
          s.detune.value = detune;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(360, t);
          const g = c.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.16, t + 0.4);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
          s.connect(lp);
          lp.connect(g);
          g.connect(this.musicGain);
          s.start(t);
          s.stop(t + 1.95);
        }
      }

      // Metais solenes (Trompa de Guerra) a cada 8 tempos
      if (step % 8 === 0) {
        const idx = Math.floor(step / 8) % brassNotes.length;
        const bf = brassNotes[idx];
        const b = c.createOscillator();
        b.type = 'sawtooth';
        b.frequency.setValueAtTime(bf, t);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(180, t);
        lp.frequency.linearRampToValueAtTime(720, t + 0.8);
        lp.frequency.linearRampToValueAtTime(240, t + 3.4);
        const g = c.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + 3.6);
        b.connect(lp);
        lp.connect(g);
        g.connect(this.musicGain);
        b.start(t);
        b.stop(t + 3.7);
      }
    };

    tick();
    this._musicTimer = setInterval(tick, 480);
  }

  _playSnareHit(vol = 0.14, dest = this.musicGain) {
    const c = this.ctx;
    if (!c || !this.whiteNoiseBuf) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.whiteNoiseBuf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1300;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(hp);
    hp.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.13);
  }

  // Som Ambiente de Campo de Batalha (Vento contínuo + Estrondos distantes + Rádio sutil)
  _startBattleAmbience() {
    const c = this.ctx;
    if (!c || !this.brownNoiseBuf) return;

    // Vento contínuo suave
    const wind = c.createBufferSource();
    wind.buffer = this.brownNoiseBuf;
    wind.loop = true;
    const windFilter = c.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 280;
    const windGain = c.createGain();
    windGain.gain.value = 0.22;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambienceGain);
    wind.start();
    this._windNode = wind;

    // Estrondos distantes de artilharia e chiado sutil de rádio
    this._ambienceTimer = setInterval(() => {
      if (!this.ctx || this.mode !== 'battle' || this.muted) return;
      const r = Math.random();
      if (r < 0.45) {
        // Artilharia distante abafada
        this._noiseBuf(this.brownNoiseBuf, 1.4, 160, 0.28, 'lowpass', this.ambienceGain);
      } else if (r < 0.65) {
        // Chiado sutil de rádio militar
        this._noiseBuf(this.pinkNoiseBuf, 0.14, 2400, 0.05, 'bandpass', this.ambienceGain);
        this.tone(1450, 0.04, 0.03, 'sine');
      }
    }, 3600);
  }

  // Atualiza som contínuo de motor diesel + esteiras dos veículos e zunido dos drones
  updateContinuousVehiclesAndDrones({
    movingVehicles = 0,
    maxSpeedRatio = 0,
    closestVehicleDist = 9999,
    activeDrones = 0,
    closestDroneDist = 9999,
    paused = false,
  }) {
    if (!this.ctx || !this._engineGain || !this._droneGain) return;
    const t = this.ctx.currentTime;

    if (paused || this.muted || this.mode !== 'battle') {
      this._engineGain.gain.setTargetAtTime(0, t, 0.08);
      this._droneGain.gain.setTargetAtTime(0, t, 0.08);
      return;
    }

    // 1. Motor Diesel + Esteiras (Filtro Lowpass 85Hz - 140Hz)
    if (movingVehicles > 0 && closestVehicleDist < 1800) {
      const distAtten = Math.max(0, 1 - closestVehicleDist / 1800);
      const targetVol = Math.min(0.28, (0.08 + movingVehicles * 0.03) * distAtten);
      const basePitch = 34 + maxSpeedRatio * 26;
      this._engineOsc.frequency.setTargetAtTime(basePitch, t, 0.12);
      this._engineSubOsc.frequency.setTargetAtTime(basePitch * 2.0, t, 0.12);
      this._engineFilter.frequency.setTargetAtTime(85 + maxSpeedRatio * 55, t, 0.12);
      this._engineGain.gain.setTargetAtTime(targetVol, t, 0.1);
    } else {
      this._engineGain.gain.setTargetAtTime(0, t, 0.15);
    }

    // 2. Zunido elétrico de Hélice dos Drones
    if (activeDrones > 0 && closestDroneDist < 1900) {
      const dAtten = Math.max(0, 1 - closestDroneDist / 1900);
      this._droneOsc.frequency.setTargetAtTime(280 + Math.sin(t * 9) * 14, t, 0.08);
      this._droneGain.gain.setTargetAtTime(0.09 * dAtten, t, 0.08);
    } else {
      this._droneGain.gain.setTargetAtTime(0, t, 0.12);
    }
  }

  playWeldingPulse() {
    if (!this.ctx || this.muted || this.mode !== 'battle') return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.last.weld && now - this.last.weld < 160) return;
    this.last.weld = now;
    this._noiseBuf(this.whiteNoiseBuf, 0.09, 2400 + Math.random() * 1400, 0.055, 'bandpass', this.sfxGain);
  }

  _noiseBuf(buffer, dur, freq, vol, type = 'lowpass', dest = this.sfxGain) {
    const c = this.ctx;
    if (!c || !buffer) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.master);
    src.start(t, Math.random() * 0.6);
    src.stop(t + dur + 0.05);
  }

  noise(dur, freq, vol, type = 'lowpass') {
    this._noiseBuf(this.whiteNoiseBuf, dur, freq, vol, type, this.sfxGain);
  }

  tone(freq, dur, vol, type = 'square', slide) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(18, slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  later(ms, fn) {
    setTimeout(() => {
      if (this.ctx) fn();
    }, ms);
  }

  play(name, vol = 1) {
    if (!this.ctx || this.muted || vol <= 0.03) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.last[name] && now - this.last[name] < 38) return;
    this.last[name] = now;

    switch (name) {
      case 'rifle':
      case 'pistol':
        // Tiro de fuzil seco + eco tático
        this._noiseBuf(this.whiteNoiseBuf, 0.14, 2900, 0.65 * vol, 'bandpass');
        this.tone(175, 0.06, 0.25 * vol, 'sawtooth', 55);
        this.later(65, () =>
          this._noiseBuf(this.pinkNoiseBuf, 0.18, 1100, 0.18 * vol, 'lowpass')
        );
        break;

      case 'sniper':
        // Estalo agudo + eco longo no campo
        this._noiseBuf(this.whiteNoiseBuf, 0.22, 3400, 0.9 * vol, 'highpass');
        this.tone(240, 0.09, 0.32 * vol, 'square', 65);
        this.later(90, () =>
          this._noiseBuf(this.pinkNoiseBuf, 0.38, 950, 0.25 * vol, 'lowpass')
        );
        break;

      case 'smg':
        this._noiseBuf(this.whiteNoiseBuf, 0.075, 3100, 0.48 * vol, 'bandpass');
        this.tone(145, 0.04, 0.18 * vol, 'square', 70);
        break;

      case 'hmg':
      case 'autocannon':
        // Rajada pesada de metralhadora .50 / canhão 30mm
        this._noiseBuf(this.pinkNoiseBuf, 0.2, 1600, 0.85 * vol, 'lowpass');
        this.tone(110, 0.11, 0.42 * vol, 'sawtooth', 42);
        break;

      case 'shotgun':
      case 'tank_cannon':
        // Estrondo grave e profundo do canhão 120mm do Tanque
        this._noiseBuf(this.brownNoiseBuf, 0.85, 580, 1.15 * vol, 'lowpass');
        this._noiseBuf(this.whiteNoiseBuf, 0.24, 2200, 0.7 * vol, 'bandpass');
        this.tone(85, 0.45, 0.65 * vol, 'sine', 24);
        break;

      case 'explosion':
        // Impacto sub-bass + onda de choque + estilhaços
        this._noiseBuf(this.brownNoiseBuf, 1.35, 420, 1.25 * vol, 'lowpass');
        this._noiseBuf(this.whiteNoiseBuf, 0.45, 2600, 0.65 * vol, 'highpass');
        this.tone(68, 0.75, 0.75 * vol, 'sine', 22);
        break;

      case 'wall_hit':
        // Ricochete / impacto em muro de pedra ou saco de areia
        this._noiseBuf(this.whiteNoiseBuf, 0.09, 2600, 0.35 * vol, 'bandpass');
        this.tone(1250, 0.05, 0.12 * vol, 'triangle', 480);
        break;

      case 'drone_launch':
        this.tone(240, 0.28, 0.22 * vol, 'sawtooth', 520);
        break;

      case 'embark':
      case 'door':
        this._noiseBuf(this.brownNoiseBuf, 0.14, 480, 0.45 * vol, 'lowpass');
        this.tone(140, 0.08, 0.18 * vol, 'triangle', 95);
        break;

      case 'research_done':
        [523, 659, 988].forEach((f, i) =>
          this.later(i * 95, () => this.tone(f, 0.22, 0.2 * vol, 'triangle'))
        );
        break;

      case 'empty':
        this.tone(1800, 0.03, 0.18 * vol);
        break;
      case 'reload':
        this.tone(700, 0.04, 0.18 * vol);
        this.later(220, () => this.tone(500, 0.05, 0.18 * vol));
        break;
      case 'switch':
        this.tone(900, 0.03, 0.11 * vol);
        break;
      case 'cash':
        this.tone(988, 0.08, 0.18 * vol, 'triangle');
        this.later(80, () => this.tone(1318, 0.15, 0.18 * vol, 'triangle'));
        break;
      case 'pickup':
        this.tone(660, 0.06, 0.14 * vol, 'triangle');
        this.later(60, () => this.tone(880, 0.08, 0.14 * vol, 'triangle'));
        break;
      case 'star':
        this.tone(440, 0.15, 0.18, 'square', 880);
        break;
      case 'wasted':
      case 'defeat':
        [220, 196, 165, 130].forEach((f, i) =>
          this.later(i * 220, () => this.tone(f, 0.45, 0.28, 'sawtooth'))
        );
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.later(i * 130, () => this.tone(f, 0.3, 0.22, 'triangle'))
        );
        break;
      default:
        break;
    }
  }

  close() {
    this._stopMusicAndAmbience();
    try {
      this.ctx?.close();
    } catch { /* noop */ }
  }
}
