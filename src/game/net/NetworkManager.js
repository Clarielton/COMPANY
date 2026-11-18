import { CAMPAIGN_PACKS, computeLevelFromXp } from '../data/accountData.js';

const CONFIG_STORAGE_KEY = 'frontline_firebase_config';
const USER_STORAGE_KEY = 'COF_AUTH_USER';
const ACTIVE_ROOMS_KEY = 'COF_ACTIVE_ROOMS';
const CAMPAIGNS_KEY = 'COF_CAMPAIGNS_V1';
const LOCAL_CAMPAIGN_SAVES_KEY = 'COF_LOCAL_CAMPAIGN_SAVES';
const BROADCAST_CHANNEL_NAME = 'cof_multiplayer_v2';

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
    this.currentUser = this._loadStoredUser();
    this.uid = this.currentUser?.uid || `cmd_${Math.random().toString(36).slice(2, 10)}`;
    this.idToken = this.currentUser?.idToken || null;
    this.commanderName = this.currentUser?.callsign || 'Comandante';
    this.isOnline = Boolean(this.currentUser && this.currentUser.isFirebase);
    this.mode = this.isOnline ? 'firebase' : 'local_broadcast';

    this.roomId = null;
    this.room = null;
    this.localSlot = 1;
    this.pingMs = 14;
    this.openRooms = [];
    this.campaigns = this._readLocalCampaigns();

    this._listeners = new Set();
    this._cmdListeners = new Set();
    this._stateListeners = new Set();
    this._matchStartListeners = new Set();

    this._seenCommandIds = new Set();
    this._pollTimer = null;
    this._browserPollTimer = null;
    this._channel = null;

    this._initDualLayerSync();
    this._refreshOpenRooms();
    this._startBrowserPoll();
  }

  _loadStoredUser() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.uid ? parsed : null;
    } catch {
      return null;
    }
  }

  _saveStoredUser(user) {
    try {
      if (!user) {
        localStorage.removeItem(USER_STORAGE_KEY);
        return;
      }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // noop
    }
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
      currentUser: this.currentUser ? { ...this.currentUser } : null,
      uid: this.uid,
      commanderName: this.commanderName,
      isOnline: this.isOnline,
      mode: this.mode,
      hasFirebaseConfig: this.hasFirebaseConfig(),
      roomId: this.roomId,
      room: this.room ? { ...this.room } : null,
      localSlot: this.localSlot,
      pingMs: this.pingMs,
      openRooms: [...this.openRooms],
      campaigns: [...this.campaigns],
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

  // =========================================================================
  // CAMADA DUAL: BROADCASTCHANNEL + SHARED LOCALSTORAGE + FIREBASE RTDB
  // =========================================================================
  _initDualLayerSync() {
    if (typeof BroadcastChannel !== 'undefined') {
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

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === ACTIVE_ROOMS_KEY) {
          this._refreshOpenRooms();
        } else if (ev.key === CAMPAIGNS_KEY) {
          this.campaigns = this._readLocalCampaigns();
          this._emit();
        }
      });

      // Equivalente ao onDisconnect: remove sala abandonada ao fechar a aba
      window.addEventListener('beforeunload', () => {
        if (this.roomId && this.localSlot === 1 && this.room?.status === 'waiting') {
          this._removeLocalRoom(this.roomId);
          this._postBroadcast({ kind: 'rooms_updated' });
        }
      });
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
    if (msg.kind === 'rooms_updated') {
      this._refreshOpenRooms();
    } else if (msg.kind === 'room_sync' && msg.room) {
      this._saveLocalRoom(msg.room);
      this._refreshOpenRooms();
      if (msg.room.roomId === this.roomId) {
        const prevStatus = this.room?.status;
        this.room = msg.room;
        this._emit();
        if (prevStatus !== 'playing' && msg.room.status === 'playing') {
          for (const fn of this._matchStartListeners) fn(msg.room);
        }
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
      const raw = JSON.parse(localStorage.getItem(ACTIVE_ROOMS_KEY) || '{}') || {};
      const now = Date.now();
      const cleaned = {};
      for (const [id, r] of Object.entries(raw)) {
        if (r && now - (r.updatedAt || r.createdAt || now) < 900000) {
          cleaned[id] = r;
        }
      }
      return cleaned;
    } catch {
      return {};
    }
  }

  _saveLocalRoom(room) {
    try {
      const all = this._readLocalRooms();
      all[room.roomId] = { ...room, updatedAt: Date.now() };
      localStorage.setItem(ACTIVE_ROOMS_KEY, JSON.stringify(all));
    } catch {
      // noop
    }
  }

  _removeLocalRoom(roomId) {
    try {
      const all = this._readLocalRooms();
      delete all[roomId];
      localStorage.setItem(ACTIVE_ROOMS_KEY, JSON.stringify(all));
    } catch {
      // noop
    }
  }

  _startBrowserPoll() {
    if (this._browserPollTimer) clearInterval(this._browserPollTimer);
    this._browserPollTimer = setInterval(() => {
      if (this.currentUser) {
        this._refreshOpenRooms();
      }
    }, 2000);
  }

  async _refreshOpenRooms() {
    const merged = { ...this._readLocalRooms() };

    if (this.hasFirebaseConfig() && this.isOnline) {
      try {
        const remote = await this._rtdbGet('rooms');
        if (remote && typeof remote === 'object') {
          for (const [id, r] of Object.entries(remote)) {
            if (r && r.roomId) merged[id] = r;
          }
        }
      } catch {
        // Mantém fallback local se Firebase RTDB estiver restrito ou offline
      }
    }

    const list = Object.values(merged).filter(
      (r) => r && r.status === 'WAITING' && (r.playersCount || 1) < (r.maxPlayers || 2)
    );
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    this.openRooms = list;

    if (this.roomId && merged[this.roomId]) {
      const prevStatus = this.room?.status;
      this.room = merged[this.roomId];
      if (prevStatus !== 'playing' && this.room.status === 'playing') {
        for (const fn of this._matchStartListeners) fn(this.room);
      }
    }
    this._emit();
  }

  // =========================================================================
  // AUTENTICAÇÃO MILITAR (AUTH GATE)
  // =========================================================================
  _applyAuthenticatedUser({ uid, callsign, email = '', provider = 'guest', idToken = null, isFirebase = false }) {
    const existing = this._loadStoredUser();
    const xp = existing?.xp ?? 0;
    const prog = computeLevelFromXp(xp);
    const ownedPacks = Array.isArray(existing?.ownedCampaignPacks) ? existing.ownedCampaignPacks : [];
    const user = {
      uid: uid || existing?.uid || `cmd_${Math.random().toString(36).slice(2, 10)}`,
      callsign: (callsign || existing?.callsign || 'Comandante').trim().slice(0, 24),
      email: email || existing?.email || '',
      provider,
      xp,
      level: prog.level,
      rank: prog.rank,
      unlockedBattalions: prog.unlockedBattalions,
      militaryGold: typeof existing?.militaryGold === 'number' ? existing.militaryGold : 1000,
      ownedCampaignPacks: ownedPacks,
      hasGoldInsignia: ownedPacks.includes('vip_combo'),
      wins: existing?.wins || 0,
      losses: existing?.losses || 0,
      idToken: idToken || null,
      isFirebase,
    };
    this.currentUser = user;
    this.uid = user.uid;
    this.idToken = user.idToken;
    this.commanderName = user.callsign;
    this.isOnline = isFirebase;
    this.mode = isFirebase ? 'firebase' : 'local_broadcast';
    this._saveStoredUser(user);

    if (isFirebase && this.hasFirebaseConfig()) {
      this._syncUserToCloud(user);
      // Tenta recuperar perfil da nuvem para sincronizar XP/compras entre dispositivos
      this._rtdbGet(`players/${user.uid}`)
        .then((cloud) => {
          if (cloud && typeof cloud === 'object' && this.currentUser?.uid === user.uid) {
            const mergedXp = Math.max(this.currentUser.xp || 0, cloud.xp || 0);
            const mergedProg = computeLevelFromXp(mergedXp);
            const mergedPacks = Array.from(
              new Set([
                ...(this.currentUser.ownedCampaignPacks || []),
                ...(Array.isArray(cloud.ownedCampaignPacks) ? cloud.ownedCampaignPacks : []),
              ])
            );
            this.currentUser = {
              ...this.currentUser,
              xp: mergedXp,
              level: mergedProg.level,
              rank: mergedProg.rank,
              unlockedBattalions: mergedProg.unlockedBattalions,
              ownedCampaignPacks: mergedPacks,
              hasGoldInsignia: mergedPacks.includes('vip_combo'),
              militaryGold:
                typeof cloud.militaryGold === 'number'
                  ? cloud.militaryGold
                  : this.currentUser.militaryGold,
              wins: Math.max(this.currentUser.wins || 0, cloud.wins || 0),
              losses: Math.max(this.currentUser.losses || 0, cloud.losses || 0),
            };
            this._saveStoredUser(this.currentUser);
            this._emit();
          }
        })
        .catch(() => {});
    }

    this._refreshOpenRooms();
    this._emit();
    return { ok: true, user };
  }

  _syncUserToCloud(user = this.currentUser) {
    if (!user) return;
    this._saveStoredUser(user);
    if (this.isOnline && this.hasFirebaseConfig()) {
      this._rtdbPut(`players/${user.uid}`, {
        uid: user.uid,
        callsign: user.callsign,
        xp: user.xp || 0,
        level: user.level || 1,
        rank: user.rank || 'Recruta',
        unlockedBattalions: user.unlockedBattalions || [],
        militaryGold: user.militaryGold ?? 1000,
        ownedCampaignPacks: user.ownedCampaignPacks || [],
        hasGoldInsignia: Boolean(user.hasGoldInsignia),
        wins: user.wins || 0,
        losses: user.losses || 0,
        lastSeen: Date.now(),
      }).catch(() => {});
    }
  }

  addAccountXp(baseAmount, { isCampaign = false, won = false } = {}) {
    if (!this.currentUser) return null;
    const packs = this.currentUser.ownedCampaignPacks || [];
    const hasXpBoost = isCampaign && (packs.includes('xp_boost') || packs.includes('vip_combo'));
    const gained = Math.max(0, Math.round(baseAmount * (hasXpBoost ? 2 : 1)));
    const nextXp = (this.currentUser.xp || 0) + gained;
    const prog = computeLevelFromXp(nextXp);
    this.currentUser = {
      ...this.currentUser,
      xp: nextXp,
      level: prog.level,
      rank: prog.rank,
      unlockedBattalions: prog.unlockedBattalions,
      wins: (this.currentUser.wins || 0) + (won ? 1 : 0),
    };
    this._syncUserToCloud(this.currentUser);
    this._emit();
    return { gained, hasXpBoost, level: prog.level, rank: prog.rank };
  }

  addMilitaryGold(amount) {
    if (!this.currentUser) return;
    this.currentUser = {
      ...this.currentUser,
      militaryGold: Math.max(0, (this.currentUser.militaryGold || 0) + amount),
    };
    this._syncUserToCloud(this.currentUser);
    this._emit();
  }

  purchaseCampaignPack(packId) {
    if (!this.currentUser) return { ok: false, error: 'Faça login primeiro.' };
    const pack = CAMPAIGN_PACKS.find((p) => p.id === packId);
    if (!pack) return { ok: false, error: 'Pacote inválido.' };
    const owned = new Set(this.currentUser.ownedCampaignPacks || []);
    if (owned.has(packId)) return { ok: false, error: 'Pacote já adquirido na conta.' };
    const gold = this.currentUser.militaryGold || 0;
    if (gold < pack.priceGold) {
      return { ok: false, error: `Ouro Militar insuficiente (${pack.priceGold} necessários).` };
    }
    owned.add(packId);
    if (packId === 'vip_combo') {
      owned.add('xp_boost');
      owned.add('hq_defense');
    }
    const ownedArr = Array.from(owned);
    this.currentUser = {
      ...this.currentUser,
      militaryGold: gold - pack.priceGold,
      ownedCampaignPacks: ownedArr,
      hasGoldInsignia: ownedArr.includes('vip_combo'),
    };
    this._syncUserToCloud(this.currentUser);
    this._emit();
    return { ok: true, pack };
  }

  getActiveCampaignPacks() {
    return this.currentUser?.ownedCampaignPacks || [];
  }

  // =========================================================================
  // SAVES DE CAMPANHA 100% LOCAIS (COF_LOCAL_CAMPAIGN_SAVES — ATÉ 3 SLOTS)
  // =========================================================================
  getLocalCampaignSaves() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGN_SAVES_KEY) || '[null,null,null]');
      return [0, 1, 2].map((i) => (Array.isArray(raw) && raw[i] ? raw[i] : null));
    } catch {
      return [null, null, null];
    }
  }

  saveLocalCampaignSlot(slotIdx, snapshot) {
    if (slotIdx < 0 || slotIdx > 2 || !snapshot) return false;
    try {
      const slots = this.getLocalCampaignSaves();
      slots[slotIdx] = {
        ...snapshot,
        slotIdx,
        savedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_CAMPAIGN_SAVES_KEY, JSON.stringify(slots));
      this._emit();
      return true;
    } catch {
      return false;
    }
  }

  deleteLocalCampaignSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx > 2) return false;
    try {
      const slots = this.getLocalCampaignSaves();
      slots[slotIdx] = null;
      localStorage.setItem(LOCAL_CAMPAIGN_SAVES_KEY, JSON.stringify(slots));
      this._emit();
      return true;
    } catch {
      return false;
    }
  }

  async loginAsGuest(callsign) {
    const cleanName = (callsign || `Cmd_${Math.floor(100 + Math.random() * 899)}`).trim();
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
          return this._applyAuthenticatedUser({
            uid: data.localId,
            callsign: cleanName,
            provider: 'anonymous',
            idToken: data.idToken,
            isFirebase: true,
          });
        }
      } catch {
        // Fallback local
      }
    }
    return this._applyAuthenticatedUser({
      callsign: cleanName,
      provider: 'guest_local',
      isFirebase: false,
    });
  }

  async loginWithEmail(email, password, callsign) {
    if (!email || !password || password.length < 6) {
      return { ok: false, error: 'Informe e-mail válido e senha com no mínimo 6 caracteres.' };
    }
    if (this.hasFirebaseConfig()) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
            this.config.apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
          }
        );
        const data = await res.json();
        if (res.ok && data.idToken) {
          return this._applyAuthenticatedUser({
            uid: data.localId,
            callsign: callsign || email.split('@')[0],
            email,
            provider: 'email',
            idToken: data.idToken,
            isFirebase: true,
          });
        }
        return { ok: false, error: data.error?.message || 'E-mail ou senha inválidos.' };
      } catch {
        // fallback local
      }
    }
    return this._applyAuthenticatedUser({
      callsign: callsign || email.split('@')[0],
      email,
      provider: 'email_local',
      isFirebase: false,
    });
  }

  async registerWithEmail(email, password, callsign) {
    if (!email || !password || password.length < 6) {
      return { ok: false, error: 'Informe e-mail válido e senha com no mínimo 6 caracteres.' };
    }
    if (this.hasFirebaseConfig()) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
            this.config.apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
          }
        );
        const data = await res.json();
        if (res.ok && data.idToken) {
          return this._applyAuthenticatedUser({
            uid: data.localId,
            callsign: callsign || email.split('@')[0],
            email,
            provider: 'email',
            idToken: data.idToken,
            isFirebase: true,
          });
        }
        return { ok: false, error: data.error?.message || 'Erro ao criar conta.' };
      } catch {
        // fallback local
      }
    }
    return this._applyAuthenticatedUser({
      callsign: callsign || email.split('@')[0],
      email,
      provider: 'email_local',
      isFirebase: false,
    });
  }

  async loginWithGoogle(callsign) {
    const cleanName = (callsign || 'Comandante Google').trim();
    // Usa fluxo anônimo/token Firebase seguro sem exigir domínio OAuth extra em localhost/Vercel
    const res = await this.loginAsGuest(cleanName);
    if (res.ok && this.currentUser) {
      this.currentUser.provider = 'google';
      this._saveStoredUser(this.currentUser);
      this._emit();
    }
    return res;
  }

  logout() {
    this.leaveRoom();
    this.currentUser = null;
    this.idToken = null;
    this.isOnline = false;
    this._saveStoredUser(null);
    this._emit();
  }

  // =========================================================================
  // RTDB HELPERS
  // =========================================================================
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

  // =========================================================================
  // SALAS, SERVER BROWSER & MATCHMAKING AUTOMÁTICO
  // =========================================================================
  async createRoom({
    roomName = '',
    mapId = 'normandy_fields',
    mode = '1v1',
    isPrivate = false,
    password = '',
    startingResources = 600,
  } = {}) {
    const roomId = generateRoomCode();
    const mapSeed = Math.floor(1000 + Math.random() * 900000);
    const maxPlayers = mode === '2v2' ? 4 : 2;
    const room = {
      roomId,
      codeFormatted: formatRoomCode(roomId),
      roomName: (roomName || `Operação ${formatRoomCode(roomId)}`).trim().slice(0, 36),
      status: 'WAITING',
      mode,
      mapId,
      mapSeed,
      isPrivate: Boolean(isPrivate),
      password: isPrivate ? String(password || '') : '',
      startingResources,
      playersCount: 1,
      maxPlayers,
      pingMs: this.pingMs,
      createdAt: Date.now(),
      host: { uid: this.uid, name: this.commanderName, ready: true },
      guest: null,
    };

    this.roomId = roomId;
    this.room = room;
    this.localSlot = 1;
    this._saveLocalRoom(room);

    if (this.isOnline && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${roomId}`, room);
      } catch {
        // Fallback local já salvo em COF_ACTIVE_ROOMS
      }
    }

    this._postBroadcast({ kind: 'room_sync', room });
    this._postBroadcast({ kind: 'rooms_updated' });
    this._startRoomSyncLoop();
    await this._refreshOpenRooms();
    return room;
  }

  async joinRoom(rawCodeOrId, passwordAttempt = '') {
    const roomId = normalizeCode(rawCodeOrId);
    if (roomId.length < 4) return { ok: false, error: 'Código inválido.' };

    let targetRoom = null;
    if (this.isOnline && this.hasFirebaseConfig()) {
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
    if (targetRoom.isPrivate && targetRoom.password && targetRoom.password !== passwordAttempt) {
      return { ok: false, error: 'Senha incorreta para esta sala privada.' };
    }

    if (targetRoom.host?.uid !== this.uid) {
      targetRoom.guest = { uid: this.uid, name: this.commanderName, ready: true };
      targetRoom.playersCount = Math.min(targetRoom.maxPlayers || 2, 2);
    }

    this.roomId = roomId;
    this.room = targetRoom;
    this.localSlot = targetRoom.host?.uid === this.uid ? 1 : 2;
    this._saveLocalRoom(targetRoom);

    if (this.isOnline && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${roomId}`, targetRoom);
      } catch {
        // noop
      }
    }

    this._postBroadcast({ kind: 'room_sync', room: targetRoom });
    this._postBroadcast({ kind: 'rooms_updated' });
    this._startRoomSyncLoop();
    await this._refreshOpenRooms();
    return { ok: true, room: targetRoom };
  }

  async autoMatchmake({ mapId = 'normandy_fields', startingResources = 600 } = {}) {
    await this._refreshOpenRooms();
    const candidate = this.openRooms.find(
      (r) =>
        r.status === 'WAITING' &&
        !r.isPrivate &&
        (r.playersCount || 1) < (r.maxPlayers || 2) &&
        r.host?.uid !== this.uid
    );
    if (candidate) {
      return this.joinRoom(candidate.roomId);
    }
    const created = await this.createRoom({
      roomName: `Matchmaking ${this.commanderName}`,
      mapId,
      mode: '1v1',
      isPrivate: false,
      startingResources,
    });
    return { ok: true, room: created, createdNew: true };
  }

  async updateRoomMap(mapId) {
    if (!this.room || this.localSlot !== 1) return;
    this.room.mapId = mapId;
    this._saveLocalRoom(this.room);
    if (this.isOnline && this.hasFirebaseConfig()) {
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
    if (this.isOnline && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPut(`rooms/${this.roomId}/status`, 'playing');
      } catch {
        // noop
      }
    }
    this._postBroadcast({ kind: 'room_sync', room: this.room });
    this._postBroadcast({ kind: 'rooms_updated' });
    this._emit();
    for (const fn of this._matchStartListeners) fn(this.room);
    return true;
  }

  // =========================================================================
  // CAMPANHA PERSISTENTE DE 15 DIAS
  // =========================================================================
  _readLocalCampaigns() {
    try {
      const list = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || '[]');
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {
      // noop
    }
    return [
      {
        id: 'camp_normandy_15d',
        name: 'Operação Overlord — 15 Dias',
        mapId: 'normandy_fields',
        day: 1,
        totalDays: 15,
        alliesSectors: 4,
        axisSectors: 4,
        playerSupplies: 1200,
        mapSeed: 194406,
      },
    ];
  }

  _saveLocalCampaigns(list) {
    try {
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
    } catch {
      // noop
    }
  }

  async createCampaign({ name, mapId = 'normandy_fields' } = {}) {
    const camp = {
      id: `camp_${Date.now().toString(36)}`,
      name: (name || `Campanha 15 Dias (${this.commanderName})`).trim(),
      mapId,
      day: 1,
      totalDays: 15,
      alliesSectors: 3,
      axisSectors: 3,
      playerSupplies: 1000,
      mapSeed: Math.floor(10000 + Math.random() * 899999),
    };
    this.campaigns = [camp, ...this.campaigns];
    this._saveLocalCampaigns(this.campaigns);
    if (this.isOnline && this.hasFirebaseConfig()) {
      this._rtdbPut(`campaigns/${camp.id}`, camp).catch(() => {});
    }
    this._emit();
    return camp;
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

    if (this.isOnline && this.hasFirebaseConfig()) {
      try {
        await this._rtdbPost(`rooms/${this.roomId}/commands`, cmd);
      } catch {
        // noop
      }
    }
  }

  async sendStateHeartbeat(stateSnapshot) {
    if (!this.roomId || this.localSlot !== 1) return;
    const state = { timestamp: Date.now(), ...stateSnapshot };
    this._postBroadcast({ kind: 'state', roomId: this.roomId, state });
    if (this.isOnline && this.hasFirebaseConfig()) {
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

      if (this.isOnline && this.hasFirebaseConfig()) {
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
    if (this.roomId && this.localSlot === 1 && this.room?.status === 'WAITING') {
      this._removeLocalRoom(this.roomId);
      if (this.isOnline && this.hasFirebaseConfig()) {
        this._rtdbPut(`rooms/${this.roomId}`, null).catch(() => {});
      }
      this._postBroadcast({ kind: 'rooms_updated' });
    }
    this._stopRoomSyncLoop();
    this.roomId = null;
    this.room = null;
    this.localSlot = 1;
    this._seenCommandIds.clear();
    this._refreshOpenRooms();
    this._emit();
  }
}

export const networkManager = new NetworkManager();
