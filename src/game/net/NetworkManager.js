const CONFIG_STORAGE_KEY = 'frontline_firebase_config';
const PROFILE_STORAGE_KEY = 'frontline_commander_name';
const LOCAL_ROOMS_KEY = 'frontline_mp_local_rooms';
const BROADCAST_CHANNEL_NAME = 'frontline_rts_mp_v1';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCXzNWDYr_w8lsb48UezYv_Yr7YGo9K3Pw',
  authDomain: 'companyoffrontline.firebaseapp.com',
  databaseURL: 'https://companyoffrontline-default-rtdb.firebaseio.com',
  projectId: 'companyoffrontline',
  storageBucket: 'companyoffrontline.firebasestorage.app',
  messagingSenderId: '807337677247',
  appId: '1:807337677247:web:f1c4cf58842fcf3ca4910a',
};

function readEnvFirebaseConfig() {
  try {
    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    const cfg = {
      apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
      projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
      appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    };
    return cfg.apiKey && cfg.databaseURL ? cfg : DEFAULT_FIREBASE_CONFIG;
  } catch {
    return DEFAULT_FIREBASE_CONFIG;
  }
}

export function loadStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.apiKey || parsed.databaseURL)) return parsed;
    }
  } catch {
    // noop
  }
  return readEnvFirebaseConfig();
}

export function saveStoredFirebaseConfig(cfg) {
  try {
    if (!cfg) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // noop
  }
}

function normalizeCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export function formatRoomCode(raw) {
  const clean = normalizeCode(raw);
  if (clean.length <= 3) return `#${clean}`;
  return `#${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

function generateRoomCode() {
  const num = Math.floor(100 + Math.random() * 900);
  return `FRT${num}`;
}

export class NetworkManager {
  constructor() {
    this.config = loadStoredFirebaseConfig();
    this.uid = `cmd_${Math.random().toString(36).slice(2, 10)}`;
    this.idToken = null;
    this.authProvider = 'offline';
    this.commanderName = this._loadCommanderName();
    this.isOnline = false;
    this.mode = 'local_broadcast'; // 'firebase' | 'local_broadcast'
    this.roomId = null;
    this.room = null;
    this.localSlot = 1; // 1 = Host (Aliados), 2 = Guest (Eixo)
    this.pingMs = 14;

    this._listeners = new Set();
    this._cmdListeners = new Set();
    this._stateListeners = new Set();
    this._matchStartListeners = new Set();

    this._seenCommandIds = new Set();
    this._pollTimer = null;
    this._heartbeatTimer = null;
    this._channel = null;

    this._initBroadcastChannel();
  }

  _loadCommanderName() {
    try {
      return localStorage.getItem(PROFILE_STORAGE_KEY) || `Comandante_${Math.floor(100 + Math.random() * 899)}`;
    } catch {
      return 'Comandante';
    }
  }

  setCommanderName(name) {
    this.commanderName = (name || 'Comandante').trim().slice(0, 24) || 'Comandante';
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, this.commanderName);
    } catch {
      // noop
    }
    this._emit();
  }

  hasFirebaseConfig() {
    return Boolean(this.config && this.config.apiKey && this.config.databaseURL);
  }

  updateFirebaseConfig(cfg) {
    this.config = cfg;
    saveStoredFirebaseConfig(cfg);
    if (!this.hasFirebaseConfig()) {
      this.isOnline = false;
      this.mode = 'local_broadcast';
    }
    this._emit();
  }

  getStatusSnapshot() {
    return {
      uid: this.uid,
      commanderName: this.commanderName,
      isOnline: this.isOnline,
      mode: this.mode,
      hasFirebaseConfig: this.hasFirebaseConfig(),
      roomId: this.roomId,
      room: this.room ? { ...this.room } : null,
      localSlot: this.localSlot,
      pingMs: this.pingMs,
      authProvider: this.authProvider,
    };
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this.getStatusSnapshot());
    return () => this._listeners.delete(fn);
  }

  onCommand(fn) {
    this._cmdListeners.add(fn);
    return () => this._cmdListeners.delete(fn);
  }

  onStateHeartbeat(fn) {
    this._stateListeners.add(fn);
    return () => this._stateListeners.delete(fn);
  }

  onMatchStart(fn) {
    this._matchStartListeners.add(fn);
    return () => this._matchStartListeners.delete(fn);
  }

  _emit() {
    const snap = this.getStatusSnapshot();
    for (const fn of this._listeners) fn(snap);
  }

  _initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this._channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this._channel.onmessage = (ev) => {
        const msg = ev?.data;
        if (!msg || msg.senderId === this.uid) return;
        this._handleBroadcastMessage(msg);
      };
    } catch {
      this._channel = null;
    }
  }

  _postBroadcast(msg) {
    try {
      this._channel?.postMessage({ ...msg, senderId: this.uid, ts: Date.now() });
    } catch {
      // noop
    }
  }

  _handleBroadcastMessage(msg) {
    if (msg.kind === 'room_sync' && msg.room && msg.room.roomId === this.roomId) {
      const prevStatus = this.room?.status;
      this.room = msg.room;
      this._saveLocalRoom(this.room);
      this._emit();
      if (prevStatus !== 'playing' && msg.room.status === 'playing') {
        for (const fn of this._matchStartListeners) fn(msg.room);
      }
    } else if (msg.kind === 'command' && msg.roomId === this.roomId && msg.cmd) {
      if (!this._seenCommandIds.has(msg.cmd.id)) {
        this._seenCommandIds.add(msg.cmd.id);
        for (const fn of this._cmdListeners) fn(msg.cmd);
      }
    } else if (msg.kind === 'state' && msg.roomId === this.roomId && msg.state) {
      for (const fn of this._stateListeners) fn(msg.state);
    } else if (msg.kind === 'ping' && msg.roomId === this.roomId) {
      this._postBroadcast({ kind: 'pong', roomId: this.roomId, sentAt: msg.sentAt });
    } else if (msg.kind === 'pong' && msg.roomId === this.roomId && msg.sentAt) {
      this.pingMs = Math.max(2, Math.round((Date.now() - msg.sentAt) * 0.5));
      this._emit();
    }
  }

  _readLocalRooms() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_ROOMS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  _saveLocalRoom(room) {
    try {
      const all = this._readLocalRooms();
      all[room.roomId] = room;
      localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(all));
    } catch {
      // noop
    }
  }

  async loginAnonymous() {
    if (this.hasFirebaseConfig()) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
            this.config.apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnSecureToken: true }),
          }
        );
        const data = await res.json();
        if (res.ok && data.idToken) {
          this.uid = data.localId || this.uid;
          this.idToken = data.idToken;
          this.isOnline = true;
          this.mode = 'firebase';
          this.authProvider = 'anonymous';
          this._emit();
          return { ok: true, mode: 'firebase' };
        }
      } catch {
        // fallback para modo local
      }
    }
    this.isOnline = false;
    this.mode = 'local_broadcast';
    this.authProvider = 'local';
    this._emit();
    return { ok: true, mode: 'local_broadcast' };
  }

  async loginGoogle() {
    // Em deploy estático sem SDK externo, usa Firebase Auth REST se configurado ou sessão local autenticada
    return this.loginAnonymous();
  }

  _rtdbUrl(path) {
    const base = String(this.config?.databaseURL || '').replace(/\/+$/, '');
    const auth = this.idToken ? `?auth=${encodeURIComponent(this.idToken)}` : '';
    return `${base}/${path}.json${auth}`;
  }

  async _rtdbGet(path) {
    const t0 = Date.now();
    const res = await fetch(this._rtdbUrl(path));
    this.pingMs = Math.max(8, Date.now() - t0);
    if (!res.ok) throw new Error(`RTDB GET ${res.status}`);
    return res.json();
  }

  async _rtdbPut(path, payload) {
    const t0 = Date.now();
    const res = await fetch(this._rtdbUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    this.pingMs = Math.max(8, Date.now() - t0);
    if (!res.ok) throw new Error(`RTDB PUT ${res.status}`);
    return res.json();
  }

  async _rtdbPost(path, payload) {
    const res = await fetch(this._rtdbUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`RTDB POST ${res.status}`);
    return res.json();
  }

  async createPrivateRoom({ mapId = 'normandy_fields', startingResources = 600 } = {}) {
    const roomId = generateRoomCode();
    const mapSeed = Math.floor(1000 + Math.random() * 900000);
    const room = {
      roomId,
      codeFormatted: formatRoomCode(roomId),
      status: 'waiting',
      mapId,
      mapSeed,
      startingResources,
      createdAt: Date.now(),
      host: { uid: this.uid, name: this.commanderName, ready: true },
      guest: null,
    };

    this.roomId = roomId;
    this.room = room;
    this.localSlot = 1;
    this._saveLocalRoom(room);

    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${roomId}`, room);
      } catch {
        this.mode = 'local_broadcast';
      }
    }

    this._startRoomSyncLoop();
    this._emit();
    return room;
  }

  async findOrCreateQuickMatch({ mapId = 'normandy_fields', startingResources = 600 } = {}) {
    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        const queue = await this._rtdbGet('matchmaking_queue');
        if (queue && typeof queue === 'object') {
          const open = Object.values(queue).find(
            (q) => q && q.status === 'waiting' && q.hostUid !== this.uid && Date.now() - q.createdAt < 180000
          );
          if (open?.roomId) {
            const joined = await this.joinRoomByCode(open.roomId);
            if (joined.ok) return joined;
          }
        }
        const room = await this.createPrivateRoom({ mapId, startingResources });
        await this._rtdbPut(`matchmaking_queue/${room.roomId}`, {
          roomId: room.roomId,
          hostUid: this.uid,
          status: 'waiting',
          createdAt: Date.now(),
        });
        return { ok: true, room };
      } catch {
        // fallback local
      }
    }

    // Fallback Local 2 Abas (localStorage + BroadcastChannel)
    const rooms = this._readLocalRooms();
    const openLocal = Object.values(rooms).find(
      (r) => r && r.status === 'waiting' && !r.guest && r.host?.uid !== this.uid && Date.now() - r.createdAt < 300000
    );
    if (openLocal) {
      return this.joinRoomByCode(openLocal.roomId);
    }
    const created = await this.createPrivateRoom({ mapId, startingResources });
    return { ok: true, room: created };
  }

  async joinRoomByCode(rawCode) {
    const roomId = normalizeCode(rawCode);
    if (roomId.length < 4) return { ok: false, error: 'Código inválido.' };

    let targetRoom = null;
    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        targetRoom = await this._rtdbGet(`rooms/${roomId}`);
      } catch {
        targetRoom = null;
      }
    }
    if (!targetRoom) {
      const localRooms = this._readLocalRooms();
      targetRoom = localRooms[roomId] || null;
    }
    if (!targetRoom) {
      return { ok: false, error: `Sala ${formatRoomCode(roomId)} não encontrada.` };
    }

    targetRoom.guest = { uid: this.uid, name: this.commanderName, ready: true };
    this.roomId = roomId;
    this.room = targetRoom;
    this.localSlot = targetRoom.host?.uid === this.uid ? 1 : 2;
    this._saveLocalRoom(targetRoom);

    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${roomId}/guest`, targetRoom.guest);
      } catch {
        // noop
      }
    }
    this._postBroadcast({ kind: 'room_sync', room: targetRoom });
    this._startRoomSyncLoop();
    this._emit();
    return { ok: true, room: targetRoom };
  }

  async updateRoomMap(mapId) {
    if (!this.room || this.localSlot !== 1) return;
    this.room.mapId = mapId;
    this._saveLocalRoom(this.room);
    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${this.roomId}/mapId`, mapId);
      } catch {
        // noop
      }
    }
    this._postBroadcast({ kind: 'room_sync', room: this.room });
    this._emit();
  }

  async startMatch() {
    if (!this.room || this.localSlot !== 1) return false;
    this.room.status = 'playing';
    this._saveLocalRoom(this.room);
    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${this.roomId}/status`, 'playing');
        await this._rtdbPut(`matchmaking_queue/${this.roomId}/status`, 'playing');
      } catch {
        // noop
      }
    }
    this._postBroadcast({ kind: 'room_sync', room: this.room });
    this._emit();
    for (const fn of this._matchStartListeners) fn(this.room);
    return true;
  }

  async sendCommand(cmdPayload) {
    if (!this.roomId) return;
    const cmd = {
      id: `${this.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: this.uid,
      slot: this.localSlot,
      timestamp: Date.now(),
      ...cmdPayload,
    };
    this._seenCommandIds.add(cmd.id);
    this._postBroadcast({ kind: 'command', roomId: this.roomId, cmd });

    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPost(`rooms/${this.roomId}/commands`, cmd);
      } catch {
        // noop
      }
    }
  }

  async sendStateHeartbeat(stateSnapshot) {
    if (!this.roomId || this.localSlot !== 1) return;
    const state = {
      timestamp: Date.now(),
      ...stateSnapshot,
    };
    this._postBroadcast({ kind: 'state', roomId: this.roomId, state });
    if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${this.roomId}/state`, state);
      } catch {
        // noop
      }
    }
  }

  _startRoomSyncLoop() {
    this._stopRoomSyncLoop();
    this._pollTimer = setInterval(async () => {
      if (!this.roomId) return;
      this._postBroadcast({ kind: 'ping', roomId: this.roomId, sentAt: Date.now() });

      if (this.mode === 'firebase' && this.hasFirebaseConfig()) {
        try {
          const remoteRoom = await this._rtdbGet(`rooms/${this.roomId}`);
          if (remoteRoom) {
            const prevStatus = this.room?.status;
            this.room = remoteRoom;
            this._emit();
            if (prevStatus !== 'playing' && remoteRoom.status === 'playing') {
              for (const fn of this._matchStartListeners) fn(remoteRoom);
            }
          }
          const cmds = await this._rtdbGet(`rooms/${this.roomId}/commands`);
          if (cmds && typeof cmds === 'object') {
            for (const cmd of Object.values(cmds)) {
              if (!cmd || !cmd.id || cmd.playerId === this.uid || this._seenCommandIds.has(cmd.id)) continue;
              this._seenCommandIds.add(cmd.id);
              for (const fn of this._cmdListeners) fn(cmd);
            }
          }
          if (this.localSlot === 2) {
            const st = await this._rtdbGet(`rooms/${this.roomId}/state`);
            if (st) {
              for (const fn of this._stateListeners) fn(st);
            }
          }
        } catch {
          // noop
        }
      } else {
        const localRooms = this._readLocalRooms();
        const latest = localRooms[this.roomId];
        if (latest) {
          const prevStatus = this.room?.status;
          this.room = latest;
          this._emit();
          if (prevStatus !== 'playing' && latest.status === 'playing') {
            for (const fn of this._matchStartListeners) fn(latest);
          }
        }
      }
    }, 900);
  }

  _stopRoomSyncLoop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  leaveRoom() {
    this._stopRoomSyncLoop();
    this.roomId = null;
    this.room = null;
    this.localSlot = 1;
    this._seenCommandIds.clear();
    this._emit();
  }
}

export const networkManager = new NetworkManager();
