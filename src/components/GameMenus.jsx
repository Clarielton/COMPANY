import React, { useEffect, useRef, useState } from 'react';
import TutorialModal from './TutorialModal.jsx';
import MultiplayerLobby from './MultiplayerLobby.jsx';
import AuthGate from './AuthGate.jsx';
import AdminPanel from './AdminPanel.jsx';
import { SoundManager } from '../game/core/SoundManager.js';
import {
  IconCrosshair,
  IconGlobe,
  IconMedal,
  IconCamera,
  IconCompass,
  IconSupply,
  IconBook,
  IconShield,
  IconPlay,
  IconGold,
  IconLogout,
  IconBell,
  IconInfantry,
  IconBunker,
  IconDrone,
  IconWrench,
  IconBolt,
} from './MilIcons.jsx';
import { loadStoredFirebaseConfig, networkManager } from '../game/net/NetworkManager.js';
import {
  COMMAND_BY_ID,
  BOTTOM_BAR_CATEGORIES,
  ARMY_FACTIONS,
  BATTLEFIELD_MAPS,
  getAvailableBattlefieldMaps,
  AI_DIFFICULTIES,
  ARMY_SKINS,
} from '../game/data/rtsData.js';
import {
  BATTALION_UNLOCKS,
  CAMPAIGN_PACKS,
  computeLevelFromXp,
} from '../game/data/accountData.js';

function MapPreviewCanvas({ map }) {
  const cRef = useRef(null);
  useEffect(() => {
    const c = cRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    const isDesert = map.theme === 'desert';
    const isWinter = map.theme === 'winter';

    ctx.fillStyle = isDesert ? '#bfa06b' : isWinter ? '#dbe4ec' : '#43582c';
    ctx.fillRect(0, 0, w, h);

    // Zonas de terreno / lago / oásis
    ctx.fillStyle = isDesert ? 'rgba(139,118,89,0.5)' : isWinter ? 'rgba(165,206,232,0.75)' : 'rgba(168,138,56,0.5)';
    ctx.fillRect(w * 0.36, h * 0.32, w * 0.28, h * 0.36);

    // Estradas
    ctx.strokeStyle = isDesert ? '#8d714a' : isWinter ? '#6c7278' : '#7a6244';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, h * 0.5);
    ctx.lineTo(w - 4, h * 0.5);
    ctx.moveTo(w * 0.5, 4);
    ctx.lineTo(w * 0.5, h - 4);
    ctx.moveTo(4, h * 0.22);
    ctx.lineTo(w - 4, h * 0.22);
    ctx.moveTo(4, h * 0.78);
    ctx.lineTo(w - 4, h * 0.78);
    ctx.stroke();

    // 12 Pontos de Setor
    ctx.fillStyle = '#eab308';
    const pts = [
      [0.22, 0.2], [0.22, 0.8], [0.5, 0.2], [0.5, 0.5],
      [0.5, 0.8], [0.37, 0.5], [0.7, 0.28], [0.7, 0.72],
      [0.29, 0.28], [0.29, 0.72], [0.78, 0.2], [0.78, 0.8],
    ];
    pts.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px * w, py * h, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [map]);

  return <canvas ref={cRef} width={170} height={84} className="map-preview-canvas" />;
}

function WireframeTopoRadar({ mapId }) {
  const cRef = useRef(null);
  useEffect(() => {
    const c = cRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let raf = 0;
    let ang = 0.4;
    const draw = () => {
      ang += 0.012;
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(4, 10, 8, 0.9)';
      ctx.fillRect(0, 0, w, h);
      const grid = 6;
      const seedOff = mapId === 'kursk_steppe' ? 1.4 : mapId === 'rhine_valley' ? 2.2 : 0.7;
      const proj = (gx, gz) => {
        const x = gx - 2.5;
        const z = gz - 2.5;
        const elev = (Math.sin(gx * 0.9 + seedOff) * Math.cos(gz * 0.8 + seedOff) + 1) * 7;
        const rx = x * Math.cos(ang) - z * Math.sin(ang);
        const rz = x * Math.sin(ang) + z * Math.cos(ang);
        return [w * 0.5 + rx * 14, h * 0.58 + rz * 6.5 - elev];
      };
      ctx.lineWidth = 1;
      for (let i = 0; i < grid; i++) {
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 229, 255, 0.72)' : 'rgba(245, 158, 11, 0.65)';
        ctx.beginPath();
        for (let j = 0; j < grid; j++) {
          const [px, py] = proj(i, j);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let j = 0; j < grid; j++) {
          const [px, py] = proj(j, i);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mapId]);
  return (
    <div className="outlive-wireframe-dock">
      <canvas ref={cRef} width={132} height={82} />
      <span style={{ fontSize: 9, color: '#00e5ff', fontWeight: 800, letterSpacing: '0.08em' }}>
        TOPOGRAFIA 3D • {String(mapId || 'normandy').toUpperCase()}
      </span>
    </div>
  );
}

export default function GameMenus({
  gameState,
  initialTab = 'skirmish',
  hud,
  interrogationTarget,
  onPlayMode,
  onPlaySandbox,
  onPlaySpectator,
  onOpenMapEditor,
  onStartOnlineMatch,
  onResume,
  onSaveBattle,
  onLoadBattle,
  onDeleteBattle,
  onExportBattle,
  onImportBattle,
  onReturnMainMenu,
  onRestart,
  onUpdateSettings,
  onSelectSkin,
  canInstallPwa,
  isInstalledPwa,
  onInstallPwa,
  onResolveInterrogation,
}) {
  const [subTab, setSubTab] = useState(initialTab === 'skirmish' ? 'rooms' : initialTab || 'rooms');
  const [hoveredNav, setHoveredNav] = useState(null);
  const [net, setNet] = useState(() => networkManager.getStatusSnapshot());
  const [storeMsg, setStoreMsg] = useState('');
  const [uiMuted, setUiMuted] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState('');
  const uiSoundRef = useRef(null);
  const getUiSound = () => {
    if (!uiSoundRef.current) uiSoundRef.current = new SoundManager();
    uiSoundRef.current.muted = uiMuted;
    return uiSoundRef.current;
  };
  const [selectedMode, setSelectedMode] = useState(hud?.gameMode || '1v1');
  const [selectedMapId, setSelectedMapId] = useState(hud?.mapId || 'normandy_fields');
  const [selectedDifficulty, setSelectedDifficulty] = useState(hud?.aiDifficulty || 'medium');
  const [startingResources, setStartingResources] = useState(
    hud?.startingResourcesPreset || 600
  );
  const [saveTitleInput, setSaveTitleInput] = useState('');
  const [fbModalOpen, setFbModalOpen] = useState(false);
  const [fbConfigText, setFbConfigText] = useState(() => {
    const cfg = loadStoredFirebaseConfig();
    return cfg ? JSON.stringify(cfg, null, 2) : '';
  });
  const [fbError, setFbError] = useState('');
  const [showUpdatesPopup, setShowUpdatesPopup] = useState(() => {
    try {
      return localStorage.getItem('cof_updates_seen_v2026_11') !== '1';
    } catch {
      return false;
    }
  });
  const fileInputRef = useRef(null);

  const closeUpdatesPopup = () => {
    try {
      localStorage.setItem('cof_updates_seen_v2026_11', '1');
    } catch {}
    setShowUpdatesPopup(false);
  };

  useEffect(() => {
    const unsub = networkManager.subscribe(setNet);
    return () => unsub();
  }, []);

  // Atalho secreto exclusivo do proprietário: Ctrl + Shift + L
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'l') {
        e.preventDefault();
        if (networkManager.isAdmin()) {
          setSubTab('admin');
          return;
        }
        const key = window.prompt('Acesso Restrito — Digite a Senha Mestre:');
        if (key) {
          const res = networkManager.claimAdmin(key);
          if (res.ok) {
            setSubTab('admin');
          } else {
            alert(res.error);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (initialTab && (gameState === 'PAUSED' || gameState === 'MENU')) {
      setSubTab(initialTab);
    }
  }, [initialTab, gameState]);

  if (!hud) return null;

  const savedBattles = hud.savedBattles || [];

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        onImportBattle?.(parsed);
      } catch {
        // arquivo inválido
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 0. TELA GRANDE DE FIM DE JOGO (VITÓRIA / DERROTA)
  if (gameState === 'PLAYING' && hud.gameOver) {
    const isVictory = hud.victoryState === 'allies';
    const stats = hud.matchStats || {};
    const totalSecs = Math.max(0, Math.floor(stats.elapsedSeconds || 0));
    const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');

    return (
      <div className={`gameover-overlay ${isVictory ? 'victory' : 'defeat'}`}>
        <div className="gameover-card">
          <div className="gameover-badge">
            {isVictory ? '★ OPERAÇÃO CONCLUÍDA ★' : '✖ COMANDO DESTRUÍDO ✖'}
          </div>
          <h1 className="gameover-title">
            {isVictory
              ? 'VITÓRIA TOTAL — FRENTE CONQUISTADA'
              : 'DERROTA — LINHA DE FRENTE PERDIDA'}
          </h1>
          <p className="gameover-sub">
            {isVictory
              ? 'As forças aliadas romperam as defesas do Eixo e assumiram o controle total do teatro de operações.'
              : 'O Quartel-General aliado caiu e as forças inimigas tomaram o controle da linha de frente.'}
          </p>

          <div className="gameover-stats-grid">
            <div className="gameover-stat-box">
              <span>UNIDADES ELIMINADAS</span>
              <strong>{stats.unitsEliminated || 0}</strong>
            </div>
            <div className="gameover-stat-box">
              <span>PRISIONEIROS INTERROGADOS</span>
              <strong>{stats.prisonersInterrogated || 0}</strong>
            </div>
            <div className="gameover-stat-box">
              <span>TRINCHEIRAS ESCAVADAS</span>
              <strong>{stats.trenchesDug || 0}</strong>
            </div>
            <div className="gameover-stat-box">
              <span>PESQUISAS CONCLUÍDAS</span>
              <strong>{stats.researchesCompleted || 0}</strong>
            </div>
            <div className="gameover-stat-box">
              <span>TEMPO DE BATALHA</span>
              <strong>
                {mins}:{secs}
              </strong>
            </div>
          </div>

          <div className="gameover-actions">
            <button
              type="button"
              className="gameover-btn primary"
              onClick={() => onRestart?.(selectedMode, startingResources)}
            >
              ⚔ JOGAR NOVAMENTE
            </button>
            <button
              type="button"
              className="gameover-btn secondary"
              onClick={() => onReturnMainMenu?.()}
            >
              🏛 VOLTAR AO MENU PRINCIPAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1. SALA DE INTERROGATÓRIO MILITAR (Exige Campo de Detenção & Inteligência — 4 Protocolos Estratégicos)
  if (gameState === 'INTERROGATION' && interrogationTarget) {
    const resistance = interrogationTarget.resistance ?? 65;
    return (
      <div className="menu-overlay interrogation-bg">
        <div className="menu-panel interrogation-panel" style={{ maxWidth: 680 }}>
          <div className="menu-badge">🏕️ CAMPO DE DETENÇÃO & INTELIGÊNCIA — INTERROGATÓRIO</div>
          <h2>SALA DE INTERROGATÓRIO MILITAR</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 12,
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(212, 163, 56, 0.35)',
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', letterSpacing: 0.6 }}>
                DOSSIÊ DO PRISIONEIRO CAPTURADO
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                {interrogationTarget.rank || 'Capitão'} {interrogationTarget.officerName || 'K. Richter'} —{' '}
                <span style={{ color: interrogationTarget.color }}>{interrogationTarget.factionName}</span>
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
                Unidade: <strong>{interrogationTarget.name}</strong> ({interrogationTarget.soldiersRemaining || 1}{' '}
                sobrevivente(s)) • Duração dos efeitos: <strong>40s – 60s</strong>
              </div>
            </div>
            <div style={{ minWidth: 155, textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#facc15', fontWeight: 700 }}>
                RESISTÊNCIA PSICOLÓGICA: {resistance}%
              </div>
              <div
                style={{
                  height: 7,
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 4,
                  marginTop: 5,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${resistance}%`,
                    height: '100%',
                    background: resistance > 70 ? '#ef4444' : '#eab308',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="interrogation-options">
            <button
              type="button"
              className="interrogate-btn intel"
              onClick={() => onResolveInterrogation('maps')}
            >
              <strong>🗺️ 1. ARRANCAR MAPAS DE DEFESA</strong>
              <span>
                Abre a Névoa de Guerra sobre os QGs Inimigos por 60s e revela permanentemente todas as Minas Ocultas e Trincheiras no mapa.
              </span>
            </button>

            <button
              type="button"
              className="interrogate-btn cash"
              onClick={() => onResolveInterrogation('convoy')}
            >
              <strong>📦 2. CONFISCAR ROTAS DE COMBOIO</strong>
              <span>
                Captura suprimentos imediatos (+350 SUP, +180 MUN, +120 COMB) e reduz a produção inimiga em -30% por 45s.
              </span>
            </button>

            <button
              type="button"
              className="interrogate-btn supplies"
              onClick={() => onResolveInterrogation('sabotage')}
            >
              <strong>📡 3. SABOTAGEM & CÓDIGOS DE RÁDIO</strong>
              <span>
                Desativa Torres/Radares inimigos por 40s, reduz Defesa/Moral inimiga em -25% e avança a Pesquisa Tech atual em +40% (ou +120 CP).
              </span>
            </button>

            <button
              type="button"
              className="interrogate-btn"
              style={{ borderColor: 'rgba(163, 190, 140, 0.55)' }}
              onClick={() => onResolveInterrogation('labor')}
            >
              <strong>🔄 4. MANTER TRABALHANDO NO CAMPO DE DETENÇÃO</strong>
              <span>
                Mantém o prisioneiro na cela do Campo POW gerando renda contínua de +5 SUP/seg (máx. 10 prisioneiros).
              </span>
            </button>
          </div>

          <div className="menu-footer-row">
            <button type="button" className="menu-secondary-btn" onClick={onResume}>
              RETORNAR AO FRONT [ESC]
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState !== 'MENU' && gameState !== 'PAUSED') return null;

  // AUTH GATE OBRIGATÓRIO: exige login antes de acessar o Hub Principal
  if (gameState === 'MENU' && !net.currentUser) {
    return <AuthGate />;
  }

  // TRIBUNAL MILITAR: TELA DE CONTA SUSPENSA / BANIDA
  if (net.currentUser?.banned) {
    return (
      <div className="mil-menu-overlay">
        <div className="mil-menu-panel" style={{ maxWidth: 520, margin: 'auto', textAlign: 'center', borderColor: '#ef4444' }}>
          <header className="mil-menu-header" style={{ justifyContent: 'center' }}>
            <div className="mil-brand">
              <span className="mil-brand-title" style={{ color: '#ef4444' }}>⛔ ACESSO RESTRITO — CONTA SUSPENSA</span>
              <span className="mil-brand-sub">TRIBUNAL DE DISCIPLINA MILITAR</span>
            </div>
          </header>
          <div style={{ padding: 24 }}>
            <p style={{ color: '#fca5a5', fontSize: '1.05rem', marginBottom: 14 }}>
              Sua conta foi suspensa pelo Administrador por violação das diretrizes de combate.
            </p>
            <div style={{ background: '#1c1917', border: '1px solid #7f1d1d', padding: 14, borderRadius: 6, marginBottom: 20 }}>
              <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.85rem' }}>MOTIVO DA RESTRIÇÃO:</span>
              <strong style={{ color: '#f87171' }}>{net.currentUser?.banReason || 'Suspensão aplicada pelo comando supremo.'}</strong>
            </div>
            <button
              type="button"
              className="mil-btn-secondary"
              style={{ width: '100%', borderColor: '#ef4444', color: '#fca5a5' }}
              onClick={() => networkManager.logout()}
            >
              ▪ ENCERRAR SESSÃO / TROCAR DE CONTA
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPaused = gameState === 'PAUSED';
  const s = hud.settings || { camSpeed: 1.0, volume: 0.35, highQuality: true };
  const isAdmin = Boolean(net.isAdmin || networkManager.isAdmin());
  const isModerator = Boolean(net.currentUser?.role === 'moderator');
  const canModerate = isAdmin || isModerator;
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.'));
  const allowOfflineModes = isLocalHost || isAdmin;

  const activeTab =
    subTab === 'admin'
      ? 'admin'
      : subTab === 'rooms'
      ? 'rooms'
      : subTab === 'spectator'
      ? 'spectator'
      : subTab === 'editor_hub'
      ? 'editor_hub'
      : subTab === 'ranks' || subTab === 'skins'
      ? 'ranks'
      : subTab === 'store'
      ? 'store'
      : ['tutorial', 'settings', 'controls'].includes(subTab)
      ? 'arsenal_hub'
      : subTab === 'saves'
      ? 'skirmish'
      : 'rooms';

  const hubSubTab = ['skins', 'tutorial', 'saves', 'settings', 'controls'].includes(subTab)
    ? subTab
    : 'tutorial';
  const systemSubTab =
    subTab === 'settings' ? 'settings' : subTab === 'controls' ? 'controls' : 'saves';

  const mapSubtitles = {
    normandy_fields: 'Frente Rural Europeia • Campos, Sebes & Vilarejos',
  };

  const xp = net.currentUser?.xp || 0;
  const prog = computeLevelFromXp(xp);
  const span = Math.max(1, prog.nextLevelXp - prog.currentMinXp);
  const xpPct =
    prog.nextLevelXp > prog.currentMinXp
      ? Math.min(100, Math.round(((xp - prog.currentMinXp) / span) * 100))
      : 100;

  const HUB_NAV_ITEMS = [
    {
      id: 'store',
      emoji: '📦',
      label: 'SUPRIMENTOS',
      sub: 'Fortificação QG, Paraquedistas, 2x XP & Camuflagens',
      Icon: IconSupply,
      kicker: 'DEPÓSITO DE SUPRIMENTOS & PACOTES',
      title: '📦 SUPRIMENTOS MILITARES',
      desc: 'Adquira pacotes multiplayer, impulsos de XP e reforços especiais ativados automaticamente nas partidas.',
      rules: [`${net.currentUser?.militaryGold ?? 0} Ouro Militar`, '5 Pacotes Táticos'],
      ctaLabel: 'VER PACOTES',
      onLaunch: () => setSubTab('store'),
    },
    {
      id: 'rooms',
      emoji: '⚔️',
      label: 'BATALHA MULTIPLAYER',
      sub: '1v1, 2v2, 3P & 4P FFA • Salas & Busca Rápida',
      Icon: IconCrosshair,
      kicker: 'BATALHA MULTIPLAYER • SELEÇÃO DE OPERAÇÃO',
      title: '⚔️ BATALHA MULTIPLAYER',
      desc: 'Crie uma sala 1v1, 2v2, 3P ou 4P FFA ou entre em uma operação aberta com jogadores reais e Comandantes IA.',
      rules: ['Velocidade Travada 1x', 'Lobby em Tempo Real', 'Início Limpo QG'],
      ctaLabel: 'CRIAR / BUSCAR SALA',
      onLaunch: () => setSubTab('rooms'),
    },
    {
      id: 'ranks',
      emoji: '🎖️',
      label: 'PATENTE',
      sub: 'Estatísticas, Evolução & Camuflagens',
      Icon: IconMedal,
      kicker: 'FICHA DO COMANDANTE & PATENTE',
      title: `🎖️ NÍVEL ${prog.level} — ${prog.rank.toUpperCase()}`,
      desc: 'Acompanhe seu histórico de vitórias, progresso de patente e personalize camuflagens do exército.',
      rules: [`${xp} XP Total`, `${net.currentUser?.wins || 0} Vitórias`],
      ctaLabel: 'VER PATENTE',
      onLaunch: () => setSubTab('ranks'),
    },
    {
      id: 'arsenal_hub',
      emoji: '📖',
      label: 'MANUAL',
      sub: 'Rede Elétrica, Coletores, Construtores & Trincheiras',
      Icon: IconBook,
      kicker: 'MANUAL DE CAMPO & SISTEMAS OUTLIVE',
      title: '📖 MANUAL TÁTICO DE CAMPO',
      desc: 'Guia rápido de Rede Elétrica, Refinarias & Caminhões Coletores, Carros Construtores, Centro de Pesquisa e Trincheiras.',
      rules: ['Rede Elétrica', 'Coletores & Construtores', 'Controles RTS'],
      ctaLabel: 'ABRIR MANUAL',
      onLaunch: () => setSubTab('tutorial'),
    },
    ...(allowOfflineModes
      ? [
          {
            id: 'skirmish',
            emoji: '🛡️',
            label: 'CAMPANHA / LOCAL',
            sub: 'Escaramuças vs IA & Saves [F9]',
            Icon: IconShield,
            kicker: 'OPERAÇÃO LOCAL CONTRA IA',
            title: 'CAMPANHA & SAVES LOCAIS',
            desc: 'Partidas locais contra IA tática com salvamento rápido [F9] e importação .JSON.',
            rules: ['1v1 e 2v2', 'Saves Locais'],
            ctaLabel: 'INICIAR LOCAL',
            onLaunch: () =>
              onPlayMode(selectedMode, startingResources, selectedMapId, selectedDifficulty),
          },
          {
            id: 'spectator',
            emoji: '👁️',
            label: 'MODO ESPECTADOR',
            sub: 'IA vs IA com Diretor de Cenas',
            Icon: IconCamera,
            kicker: 'ESTÚDIO IA vs IA (ADMIN)',
            title: '👁️ MODO ESPECTADOR',
            desc: 'Assista dois Comandantes de IA lutando pelo mapa com Director Cam e velocidade 1x–3x.',
            rules: ['Sem Névoa', 'Director Cam'],
            ctaLabel: 'ASSISTIR IA vs IA',
            onLaunch: () => onPlaySpectator?.(selectedMapId),
          },
          {
            id: 'editor_hub',
            emoji: '📍',
            label: 'EDITOR DE MAPAS',
            sub: 'Relevo, Montanhas, Setores & Rebeldes',
            Icon: IconCompass,
            kicker: 'EDITOR DE TERRENO & SETORES 3D',
            title: '📍 EDITOR DE MAPAS 3D',
            desc: 'Esculpa morros/montanhas, crie pontos de conquista e configure Áreas Rebeldes.',
            rules: ['Escultura 3D', 'Áreas Rebeldes', 'Duplicar/Excluir'],
            ctaLabel: 'ABRIR EDITOR 3D',
            onLaunch: () => onOpenMapEditor?.(selectedMapId),
          },
        ]
      : []),
  ];

  const previewId = hoveredNav || activeTab;
  const heroMeta = HUB_NAV_ITEMS.find((it) => it.id === previewId) || HUB_NAV_ITEMS[0];

  return (
    <div className="mil-menu-overlay commercial-hub-overlay outlive-hub-overlay">
      <div className="outlive-hub-chassis">
        <span className="outlive-rivet tl" />
        <span className="outlive-rivet tr" />
        <span className="outlive-rivet bl" />
        <span className="outlive-rivet br" />

        {/* CABEÇALHO TERMINAL INDUSTRIAL BLINDADO */}
        <header className="outlive-hub-header">
          <div className="outlive-brand-block">
            <div className="outlive-crest-shield">
              <IconShield size={24} />
            </div>
            <div>
              <div className="outlive-brand-title">
                COMPANY OF
                <br />
                FRONTLINE
              </div>
              <div className="outlive-brand-sub">
                {isPaused
                  ? `OPERAÇÃO ${hud.gameMode.toUpperCase()} PAUSADA`
                  : 'SISTEMA DE COMANDO TÁTICO • v2.0'}
              </div>
            </div>
          </div>

          <div className="outlive-vent-grille" aria-hidden="true" />

          {net.currentUser && (
            <div className="outlive-commander-card">
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  background: '#16201c',
                  border: '1.5px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                🎖️
              </div>
              <div className="mil-profile-meta">
                <div className="mil-profile-top">
                  <span className="mil-online-dot" title="Conectado" />
                  <strong>{net.currentUser.callsign}</strong>
                  <span className="mil-online-tag">ONLINE</span>
                </div>
                <div className="mil-profile-rank-row">
                  <span>
                    Nv.{prog.level} {prog.rank}
                  </span>
                  <span className="mil-gold-pill">
                    🪙 {net.currentUser.militaryGold ?? 0} Ouro
                  </span>
                </div>
                <div className="mil-profile-xp-track" title={`${xp} / ${prog.nextLevelXp} XP`}>
                  <div className="mil-profile-xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
              </div>

              <button
                type="button"
                className="outlive-sq-btn"
                onClick={() => {
                  const next = !uiMuted;
                  setUiMuted(next);
                  if (uiSoundRef.current) uiSoundRef.current.muted = next;
                }}
                title={uiMuted ? 'Ativar Áudio de Interface' : 'Silenciar Áudio de Interface'}
              >
                {uiMuted ? '🔇' : '🔊'}
              </button>

              <button
                type="button"
                className="outlive-sq-btn"
                onClick={() => {
                  getUiSound().playUiHydraulic();
                  setSupportOpen(true);
                }}
                title="Suporte & Central de Ajuda"
              >
                🎧
              </button>

              {canModerate && (
                <button
                  type="button"
                  className="outlive-sq-btn"
                  style={{ borderColor: isAdmin ? '#ef4444' : '#f59e0b', color: isAdmin ? '#fca5a5' : '#fde047' }}
                  onClick={() => {
                    getUiSound().playUiHydraulic();
                    setSubTab('admin');
                  }}
                  title={isAdmin ? 'Painel Admin' : 'Painel Moderação'}
                >
                  🛡️
                </button>
              )}

              <button
                type="button"
                className="outlive-sq-btn danger"
                onClick={() => networkManager.logout()}
                title="Sair da Conta"
              >
                🚪
              </button>
            </div>
          )}
        </header>

        {showUpdatesPopup && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(6, 10, 14, 0.82)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={closeUpdatesPopup}
          >
            <div
              className="mp-card"
              style={{
                maxWidth: 620,
                width: '100%',
                borderColor: '#c28e38',
                boxShadow: '0 24px 60px rgba(0,0,0,0.75)',
                margin: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mp-card-head">
                <div>
                  <span className="mp-kicker" style={{ color: '#f59e0b' }}>
                    BOLETIM OFICIAL DE COMBATE
                  </span>
                  <h3 style={{ margin: 0, color: '#fef3c7' }}>
                    ÚLTIMAS ATUALIZAÇÕES DO JOGO
                  </h3>
                </div>
                <button type="button" className="mil-pill" onClick={closeUpdatesPopup}>
                  ✕ Fechar
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 12,
                  maxHeight: '58vh',
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {[
                  {
                    Icon: IconInfantry,
                    title: 'Movimentação Mais Fluida & Tiro em Movimento',
                    desc: 'Soldados respondem mais rápido às ordens, giram sem trepidação ao contornar obstáculos e agora atiram continuamente enquanto caminham.',
                  },
                  {
                    Icon: IconBunker,
                    title: 'Invasão de Construções pela Tropa de Assalto',
                    desc: 'Clique com o botão direito em casas ocupadas pelo inimigo usando a Tropa de Assalto para invadir, expulsar os defensores e tomar o prédio. Tanques e veículos também concentram fogo pesado em construções ocupadas.',
                  },
                  {
                    Icon: IconDrone,
                    title: 'Nova Fábrica de Drones Táticos [F5]',
                    desc: 'Construa a Fábrica de Drones na sua base para fabricar e lançar Drones UAV Recon e FPV Kamikaze diretamente do hangar, com estoque estratégico controlado.',
                  },
                  {
                    Icon: IconWrench,
                    title: 'Engenheiros Multifunção em Campo',
                    desc: 'Engenheiros de Combate agora reparam automaticamente veículos danificados, prédios da base e muralhas fortificadas aliadas.',
                  },
                  {
                    Icon: IconBolt,
                    title: 'Equipe Antitanque com Munição Explosiva HEAT',
                    desc: 'Foguetes antitanque agora contam com sopro traseiro, rastro de fumaça e detonação explosiva em área contra blindados e fortificações.',
                  },
                  {
                    Icon: IconCrosshair,
                    title: 'Batalha Online por Equipes & Campo de Visão Dedicado',
                    desc: 'Cada comandante controla exclusivamente suas próprias tropas e prédios em partidas online, com Névoa de Guerra independente para cada lado.',
                  },
                ].map((item) => {
                  const ItemIcon = item.Icon;
                  return (
                  <div
                    key={item.title}
                    style={{
                      background: 'rgba(20, 24, 28, 0.9)',
                      border: '1px solid rgba(194, 142, 56, 0.28)',
                      borderRadius: 6,
                      padding: '10px 12px',
                    }}
                  >
                    <strong style={{ color: '#fde68a', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <ItemIcon size={15} /> {item.title}
                    </strong>
                    <span style={{ color: '#e5e7eb', fontSize: '0.88rem', lineHeight: 1.4 }}>
                      {item.desc}
                    </span>
                  </div>
                );})}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="mil-btn-primary" onClick={closeUpdatesPopup}>
                  ENTENDI — IR PARA O FRONT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT EM 2 COLUNAS: BOTÕES CHANFRADOS OUTLIVE + VISOR DE TELEMETRIA CRT */}
        <div className="outlive-hub-columns">
          <aside className="outlive-hub-sidebar" aria-label="Menu Tático">
            {HUB_NAV_ITEMS.map((item) => {
              const isAct = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.sub}
                  className={`outlive-chamfer-btn ${isAct ? 'active' : ''}`}
                  onMouseEnter={() => {
                    setHoveredNav(item.id);
                    getUiSound().playUiHover();
                  }}
                  onMouseLeave={() => setHoveredNav(null)}
                  onClick={() => {
                    getUiSound().playUiHydraulic();
                    if (item.id === 'arsenal_hub') setSubTab('tutorial');
                    else setSubTab(item.id);
                  }}
                >
                  <div className="outlive-chamfer-ico">{item.emoji || '⚔️'}</div>
                  <div className="outlive-chamfer-txt">
                    <strong>{item.label}</strong>
                  </div>
                </button>
              );
            })}

            {canModerate && (
              <button
                type="button"
                title="Contas, Bans & Segurança"
                className={`outlive-chamfer-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onMouseEnter={() => getUiSound().playUiHover()}
                onClick={() => {
                  getUiSound().playUiHydraulic();
                  setSubTab('admin');
                }}
              >
                <div className="outlive-chamfer-ico">🛡️</div>
                <div className="outlive-chamfer-txt">
                  <strong>{isAdmin ? 'PAINEL ADMIN' : 'MODERAÇÃO'}</strong>
                </div>
              </button>
            )}

            {isPaused && (
              <button
                type="button"
                className="mil-hub-resume-btn"
                onClick={() => {
                  getUiSound().playUiHydraulic();
                  onResume();
                }}
              >
                <IconPlay size={15} /> RETORNAR À BATALHA
              </button>
            )}
          </aside>

          {/* PAINEL CENTRAL/DIREITO: CHASSI BLINDADO DO VISOR DE TELEMETRIA CRT + RODAPÉ */}
          <div className="outlive-crt-housing">
            <main className="outlive-crt-visor">
              <div className="outlive-crt-bar">
                <span>Visor de Telemetria</span>
                <span>SINAL CRIPTOGRAFADO • 60 HZ</span>
              </div>
              <div className="outlive-crt-body">
              {activeTab !== 'admin' && activeTab !== 'rooms' && (
                <section className="mil-hero-card">
                  <div className="mil-hero-info">
                    <span className="mil-hero-kicker">{heroMeta.kicker}</span>
                    <h2>{heroMeta.title}</h2>
                    <p>{heroMeta.desc}</p>
                    <div className="mil-hero-rules">
                      {heroMeta.rules.map((r) => (
                        <span key={r} className="mil-hero-rule-pill">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mil-hero-actions">
                    <div className="mil-hero-map-mini">
                      <span>TEATRO ATIVO</span>
                      <strong>
                        {getAvailableBattlefieldMaps().find((m) => m.id === selectedMapId)?.name ||
                          'Campos da Normandia'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="mil-btn-primary mil-hero-cta"
                      onClick={() => {
                        getUiSound().playUiHydraulic();
                        heroMeta.onLaunch();
                      }}
                    >
                      <IconPlay size={15} />
                      <span>{heroMeta.ctaLabel}</span>
                    </button>
                  </div>
                </section>
              )}

            {/* CONTEÚDO INTERATIVO DA SEÇÃO SELECIONADA */}
            <div className="mil-hub-content">
              {activeTab === 'spectator' && isAdmin && (
                <div className="mil-subpane">
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <div>
                        <span className="mp-kicker">ESTÚDIO DE GRAVAÇÃO • TIKTOK / SHORTS / REELS</span>
                        <h3>MODO ESPECTADOR: BATALHA AUTOMATIZADA IA vs IA</h3>
                      </div>
                      <button
                        type="button"
                        className="mil-btn-primary"
                        onClick={() => onPlaySpectator?.(selectedMapId)}
                      >
                        <IconCamera size={16} /> INICIAR IA vs IA AGORA
                      </button>
                    </div>
                    <div className="mil-controls-grid">
                      <div className="mil-ctrl-item">
                        <kbd>Tecla H</kbd>
                        <div>
                          <strong>Ocultar HUD</strong>
                          <span>Tela 100% limpa para gravar vídeos</span>
                        </div>
                      </div>
                      <div className="mil-ctrl-item">
                        <kbd>Director Cam</kbd>
                        <div>
                          <strong>Câmera Automática</strong>
                          <span>Segue tiroteios, tanques e explosões</span>
                        </div>
                      </div>
                      <div className="mil-ctrl-item">
                        <kbd>1x | 2x | 3x</kbd>
                        <div>
                          <strong>Controle de Velocidade</strong>
                          <span>Acelere batalhas épicas em minutos</span>
                        </div>
                      </div>
                      <div className="mil-ctrl-item">
                        <kbd>Onda Blindada</kbd>
                        <div>
                          <strong>Forçar Reforço</strong>
                          <span>Dispara choque imediato de tanques MBT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'editor_hub' && isLocalHost && (
                <div className="mil-subpane">
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <div>
                        <span className="mp-kicker">CONSTRUÇÃO DE CENÁRIO 3D</span>
                        <h3>EDITOR DE MAPAS & TESTE TÁTICO</h3>
                      </div>
                      <div className="mp-join-inline">
                        {isLocalHost && (
                          <button
                            type="button"
                            className="mil-btn-primary"
                            onClick={() => onOpenMapEditor?.(selectedMapId)}
                          >
                            <IconCompass size={16} /> ABRIR EDITOR DE MAPA (LOCAL)
                          </button>
                        )}
                        <button
                type="button"
                className="mil-pill"
                style={{ borderColor: '#d4a338', color: '#fde68a' }}
                onClick={() => setShowUpdatesPopup(true)}
                title="Ver últimas atualizações do jogo"
              >
                <IconBell size={14} /> Novidades
              </button>

              {isAdmin && (
                          <button
                            type="button"
                            className="mil-btn-secondary"
                            style={{ borderColor: '#c28e38', color: '#fde68a' }}
                            onClick={() => onPlaySandbox?.(selectedMode, selectedMapId)}
                          >
                            <IconShield size={16} /> ENTRAR NO SANDBOX [F10]
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ color: '#9ca898', fontSize: 13, margin: 0 }}>
                      Pausa a partida automaticamente, oculta a Névoa de Guerra, libera zoom amplo e permite adicionar casas, muros, trincheiras, áreas inteiras de floresta e reposicionar os 12 setores de conquista gravando direto em <code>src/game/data/customMaps.json</code>.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'store_ranks' && (
                <div className="mil-subpane">
                  <div className="mil-subbar">
                    <button
                      type="button"
                      className={`mil-pill ${subTab === 'store' ? 'active' : ''}`}
                      onClick={() => setSubTab('store')}
                    >
                      SUPRIMENTOS DE CAMPANHA
                    </button>
                    <button
                      type="button"
                      className={`mil-pill ${subTab === 'ranks' ? 'active' : ''}`}
                      onClick={() => setSubTab('ranks')}
                    >
                      PATENTE & BATALHÕES
                    </button>
                    <button
                      type="button"
                      className={`mil-pill ${subTab === 'skins' ? 'active' : ''}`}
                      onClick={() => setSubTab('skins')}
                    >
                      UNIFORMES & CAMUFLAGENS
                    </button>
                  </div>
                </div>
              )}

              {(activeTab === 'rooms' || activeTab === 'rooms_2v2') && (
            <div className="mil-subpane">
              <MultiplayerLobby onStartOnlineMatch={onStartOnlineMatch} />
            </div>
          )}

          {(subTab === 'ranks' || (activeTab === 'store_ranks' && subTab === 'ranks')) && (
            <div className="mil-subpane">
              {(() => {
                const xp = net.currentUser?.xp || 0;
                const prog = computeLevelFromXp(xp);
                const span = Math.max(1, prog.nextLevelXp - prog.currentMinXp);
                const pct =
                  prog.nextLevelXp > prog.currentMinXp
                    ? Math.min(100, Math.round(((xp - prog.currentMinXp) / span) * 100))
                    : 100;
                const userBats = net.currentUser?.unlockedBattalions || [];
                return (
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <div>
                        <span className="mp-kicker">PROGRESSÃO DE CONTA NA NUVEM (FIREBASE)</span>
                        <h3>
                          PATENTE ATUAL: Nível {prog.level} — {prog.rank.toUpperCase()} ({xp} XP)
                        </h3>
                      </div>
                      <div className="mp-room-meta">
                        <span className="mp-ping-badge" style={{ color: '#fde047' }}>
                          💰 {net.currentUser?.militaryGold ?? 0} Ouro
                        </span>
                      </div>
                    </div>
                    <div className="struct-ctx-hpbar" style={{ height: 8 }}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <small style={{ color: '#8c948c' }}>
                      Próximo nível: {xp} / {prog.nextLevelXp} XP • Toda partida concluída e dia sobrevivido na Campanha concede XP. Batalhões especiais requerem patente e aquisição via Ouro Militar.
                    </small>

                    <div className="mp-campaigns-grid">
                      {BATTALION_UNLOCKS.map((b) => {
                        const isUnlocked = userBats.includes(b.id);
                        const isLevelMet = prog.level >= b.requiredLevel;
                        const goldPrice = b.priceGold || 200;
                        return (
                          <div
                            key={b.id}
                            className={`mp-campaign-card ${isUnlocked ? 'unlocked-bat' : 'locked-bat'}`}
                          >
                            <div className="mp-card-head">
                              <strong>
                                {b.icon} {b.name}
                              </strong>
                              {isUnlocked ? (
                                <span
                                  className="mp-ping-badge"
                                  style={{
                                    background: 'rgba(74, 222, 128, 0.15)',
                                    borderColor: '#4ade80',
                                    color: '#4ade80',
                                  }}
                                >
                                  ✓ LIBERADO & EQUIPADO
                                </span>
                              ) : isLevelMet ? (
                                <button
                                  type="button"
                                  className="mil-btn-primary"
                                  style={{ minHeight: 32, padding: '0 10px', fontSize: '0.78rem' }}
                                  onClick={() => {
                                    const res = networkManager.unlockBattalion(b.id);
                                    if (!res.ok) alert(res.error);
                                  }}
                                >
                                  💰 ADQUIRIR ({goldPrice} OURO)
                                </button>
                              ) : (
                                <span className="mp-ping-badge" style={{ color: '#9ca3af' }}>
                                  🔒 Nv.{b.requiredLevel} ({b.rankName}) • {goldPrice} Ouro
                                </span>
                              )}
                            </div>
                            <small style={{ color: '#b7beb7', lineHeight: 1.4 }}>{b.desc}</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {(subTab === 'store' || (activeTab === 'store_ranks' && subTab === 'store')) && (
            <div className="mil-subpane">
              <div className="mp-card">
                <div className="mp-card-head">
                  <div>
                    <span className="mp-kicker">LOJA MULTIPLAYER CONECTADA À CONTA • VINCULADA AO UID</span>
                    <h3>🛒 SUPRIMENTOS MULTIPLAYER (1v1, 2v2, 3P & 4P)</h3>
                  </div>
                  <div className="mp-room-meta">
                    <span className="mp-ping-badge">
                      💰 {net.currentUser?.militaryGold ?? 0} Ouro Militar
                    </span>
                  </div>
                </div>

                <div className="store-fairplay-banner" style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#bae6fd' }}>
                  ⚡ <strong>Ativação Automática em Partidas Online (1v1, 2v2, 3P e 4P):</strong> Seus selos e benefícios são sincronizados automaticamente no Lobby e na Batalha 3D!
                </div>

                {storeMsg && <div className="mp-status-note">{storeMsg}</div>}

                <div className="mp-campaigns-grid">
                  {CAMPAIGN_PACKS.map((pack) => {
                    const owned = (net.currentUser?.ownedCampaignPacks || []).includes(pack.id);
                    return (
                      <div key={pack.id} className="mp-campaign-card store-pack-card">
                        <div className="mp-card-head">
                          <strong>
                            {pack.icon} {pack.name}
                          </strong>
                          <span className="mp-ping-badge">{pack.badge}</span>
                        </div>
                        <small style={{ color: '#8c948c', lineHeight: 1.4 }}>{pack.desc}</small>
                        <ul className="store-perks-list">
                          {pack.perks.map((pk, idx) => (
                            <li key={idx}>✓ {pk}</li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          disabled={owned}
                          className={owned ? 'mil-btn-secondary' : 'mil-btn-primary'}
                          onClick={() => {
                            const res = networkManager.purchaseCampaignPack(pack.id);
                            setStoreMsg(
                              res.ok
                                ? `✓ ${pack.name} ativado na sua conta!`
                                : res.error || 'Erro na compra.'
                            );
                          }}
                        >
                          {owned
                            ? '✓ EQUIPADO NA CONTA'
                            : `ADQUIRIR (${pack.priceGold} OURO • ${pack.priceBrl})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'arsenal_hub' || subTab === 'skins') && (
            <div className="mil-subpane">
              <div className="mil-subbar">
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'tutorial' ? 'active' : ''}`}
                  onClick={() => setSubTab('tutorial')}
                >
                  TUTORIAL & ASSALTO
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'skins' ? 'active' : ''}`}
                  onClick={() => setSubTab('skins')}
                >
                  UNIFORMES & SKINS
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'saves' ? 'active' : ''}`}
                  onClick={() => setSubTab('saves')}
                >
                  SAVES
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setSubTab('settings')}
                >
                  ÁUDIO / CÂMERA
                </button>
                <button
                  type="button"
                  className="mil-pill"
                  onClick={() => {
                    setFbError('');
                    setFbModalOpen(true);
                  }}
                >
                  Chaves Firebase
                </button>
              </div>

              {hubSubTab === 'tutorial' && (
                <TutorialModal
                  embedded
                  onStartGuided={() => {
                    try {
                      localStorage.setItem('frontline_start_guided', '1');
                    } catch {
                      // noop
                    }
                    if (isPaused) onResume?.();
                    else onPlaySandbox?.('1v1', selectedMapId);
                  }}
                  onStartAssaultDrill={() => {
                    if (isPaused) {
                      window.__frontlineGame?.startAssaultSandboxDrill?.();
                      onResume?.();
                    } else {
                      try {
                        localStorage.setItem('frontline_assault_drill', '1');
                      } catch {
                        // noop
                      }
                      onPlaySandbox?.('1v1', selectedMapId);
                    }
                  }}
                />
              )}

              {hubSubTab === 'skins' && (
                <div className="mil-skins-grid">
                  {ARMY_SKINS.map((sk) => {
                    const active = (hud.playerSkinId || 'olive_classic') === sk.id;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        className={`mil-skin-card ${active ? 'active' : ''}`}
                        onClick={() => onSelectSkin?.(sk.id)}
                      >
                        <div className="mil-skin-swatches">
                          <span style={{ background: sk.swatch }} />
                          <span style={{ background: sk.accent }} />
                        </div>
                        <strong>{sk.name}</strong>
                        <small>{sk.desc}</small>
                      </button>
                    );
                  })}
                </div>
              )}

              {hubSubTab === 'saves' && (
                <div>
                  <div className="mil-save-bar">
                    <input
                      type="text"
                      className="mil-input"
                      placeholder={`Nome da Operação (${hud.gameMode.toUpperCase()})`}
                      value={saveTitleInput}
                      onChange={(e) => setSaveTitleInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="mil-btn-primary"
                      style={{ minHeight: 44, padding: '0 14px' }}
                      onClick={() => {
                        onSaveBattle?.(saveTitleInput.trim() || null);
                        setSaveTitleInput('');
                      }}
                    >
                      ▪ SALVAR
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => onExportBattle?.(null)}
                    >
                      ▸ EXPORTAR .JSON
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      ▸ IMPORTAR .JSON
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleFileImport}
                    />
                  </div>
                  {savedBattles.length === 0 ? (
                    <div className="mil-empty-box">Nenhuma batalha salva.</div>
                  ) : (
                    <div className="mil-saves-list">
                      {savedBattles.map((save, idx) => (
                        <div key={save.id} className="mil-save-row">
                          <div>
                            <strong>#{idx + 1} {save.title}</strong>
                            <span>{(save.gameMode || '1v1').toUpperCase()} • {save.supplies} SUP</span>
                          </div>
                          <div className="mil-save-actions">
                            <button type="button" className="mil-pill active" onClick={() => onLoadBattle?.(save.id)}>▸ CARREGAR</button>
                            <button type="button" className="mil-pill" onClick={() => onDeleteBattle?.(save.id)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hubSubTab === 'settings' && (
                <div className="mil-settings-grid">
                  <label className="mil-range-row">
                    <span>Velocidade Câmera: <strong>{Math.round((s.camSpeed || 1) * 100)}%</strong></span>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={s.camSpeed || 1.0} onChange={(e) => onUpdateSettings?.({ camSpeed: Number(e.target.value) })} />
                  </label>
                  <label className="mil-range-row">
                    <span>Volume Geral: <strong>{Math.round((s.volume ?? 0.35) * 100)}%</strong></span>
                    <input type="range" min="0" max="1" step="0.05" value={s.volume ?? 0.35} onChange={(e) => onUpdateSettings?.({ volume: Number(e.target.value) })} />
                  </label>
                  <button type="button" className={`mil-pill ${s.highQuality !== false ? 'active' : ''}`} onClick={() => onUpdateSettings?.({ highQuality: !(s.highQuality !== false) })}>
                    {s.highQuality !== false ? '☀ SOMBRAS 3D: ATIVADAS' : '☀ SOMBRAS 3D: DESATIVADAS'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div id="admin-panel" className="mil-subpane">
              <AdminPanel onLaunchSandbox={() => onPlaySandbox?.(selectedMode, selectedMapId)} />
            </div>
          )}

          {activeTab === 'skirmish' && (
            <div className="mil-combat-pane">
              <div className="mil-section-label">▸ TEATRO DE OPERAÇÕES</div>
              <div className="mil-map-list">
                {getAvailableBattlefieldMaps().map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mil-map-row ${selectedMapId === m.id ? 'active' : ''}`}
                    onClick={() => setSelectedMapId(m.id)}
                  >
                    <MapPreviewCanvas map={m} />
                    <div className="mil-map-meta">
                      <strong>{m.name}</strong>
                      <span>{mapSubtitles[m.id] || m.subtitle}</span>
                    </div>
                    <span className="mil-map-check">
                      {selectedMapId === m.id ? '▪ ATIVO' : '▸'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mil-quick-config">
                <div className="mil-cfg-group">
                  <span className="mil-cfg-label">MODO</span>
                  <div className="mil-cfg-pills">
                    {['1v1', '2v2'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`mil-pill ${selectedMode === mode ? 'active' : ''}`}
                        onClick={() => setSelectedMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mil-cfg-group">
                  <span className="mil-cfg-label">DIFICULDADE IA</span>
                  <div className="mil-cfg-pills">
                    {[
                      { id: 'easy', label: 'Recruta' },
                      { id: 'medium', label: 'Veterano' },
                      { id: 'hard', label: 'General' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`mil-pill ${selectedDifficulty === d.id ? 'active' : ''}`}
                        onClick={() => setSelectedDifficulty(d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mil-cfg-group">
                  <span className="mil-cfg-label">RECURSOS</span>
                  <div className="mil-cfg-pills">
                    {[450, 600, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={`mil-pill ${startingResources === val ? 'active' : ''}`}
                        onClick={() => setStartingResources(val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="mil-combat-footer">
                {isPaused && (
                  <button type="button" className="mil-btn-secondary" onClick={onResume}>
                    ▸ RETORNAR AO FRONT
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    className="mil-btn-secondary"
                    onClick={() => {
                      setSubTab('skirmish');
                      onReturnMainMenu();
                    }}
                  >
                    ▪ MENU PRINCIPAL
                  </button>
                )}
                {!isPaused && savedBattles.length > 0 && (
                  <button
                    type="button"
                    className="mil-btn-secondary"
                    onClick={() => onLoadBattle?.(savedBattles[0].id)}
                  >
                    ▸ CONTINUAR SALVA ({savedBattles[0].gameMode?.toUpperCase()})
                  </button>
                )}
                <button
                type="button"
                className="mil-pill"
                style={{ borderColor: '#d4a338', color: '#fde68a' }}
                onClick={() => setShowUpdatesPopup(true)}
                title="Ver últimas atualizações do jogo"
              >
                <IconBell size={14} /> Novidades
              </button>

              {isAdmin && (
                  <button
                    type="button"
                    className="mil-btn-secondary"
                    style={{ borderColor: '#c28e38', color: '#c28e38' }}
                    onClick={() => onPlaySandbox?.(selectedMode, selectedMapId)}
                  >
                    🛠️ MODO CAIXA DE AREIA (ADMIN)
                  </button>
                )}
                <button
                  type="button"
                  className="mil-btn-primary"
                  onClick={() =>
                    onPlayMode(selectedMode, startingResources, selectedMapId, selectedDifficulty)
                  }
                >
                  <IconPlay size={14} /> INICIAR OPERAÇÃO
                </button>
              </footer>
            </div>
          )}

          {activeTab === 'multiplayer' && (
            <div className="mil-subpane">
              <MultiplayerLobby
                onStartOnlineMatch={onStartOnlineMatch}
                onOpenFirebaseConfig={() => {
                  setFbError('');
                  setFbModalOpen(true);
                }}
              />
            </div>
          )}

          {activeTab === 'tutorial' && (
            <div className="mil-subpane">
              <TutorialModal
                embedded
                onStartGuided={() => {
                  try {
                    localStorage.setItem('frontline_start_guided', '1');
                  } catch {
                    // noop
                  }
                  if (isPaused) {
                    onResume?.();
                  } else {
                    onPlayMode(selectedMode, startingResources, selectedMapId, selectedDifficulty);
                  }
                }}
                onStartAssaultDrill={() => {
                  if (isPaused) {
                    if (typeof window !== 'undefined') {
                      window.__frontlineGame?.startAssaultSandboxDrill?.();
                    }
                    onResume?.();
                  } else {
                    try {
                      localStorage.setItem('frontline_assault_drill', '1');
                    } catch {
                      // noop
                    }
                    onPlaySandbox?.(selectedMode, selectedMapId);
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'skins' && (
            <div className="mil-subpane">
              <div className="mil-subbar">
                <button
                  type="button"
                  className={`mil-pill ${subTab === 'skins' ? 'active' : ''}`}
                  onClick={() => setSubTab('skins')}
                >
                  ✦ UNIFORMES & CAMUFLAGEM
                </button>
                <button
                  type="button"
                  className={`mil-pill ${subTab === 'arsenal' ? 'active' : ''}`}
                  onClick={() => setSubTab('arsenal')}
                >
                  ▪ CATÁLOGO F1–F4
                </button>
              </div>

              {subTab !== 'arsenal' ? (
                <div className="mil-skins-grid">
                  {ARMY_SKINS.map((sk) => {
                    const isActive = (hud.playerSkinId || 'olive_classic') === sk.id;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        className={`mil-skin-card ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectSkin?.(sk.id)}
                      >
                        <div className="mil-skin-swatches">
                          <span style={{ background: sk.uniform }} />
                          <span style={{ background: sk.helmet }} />
                          <span style={{ background: sk.vehicle }} />
                        </div>
                        <div className="mil-skin-info">
                          <strong>{sk.name}</strong>
                          <span>{sk.subtitle}</span>
                        </div>
                        <span className="mil-map-check">{isActive ? '▪ ATIVA' : '▸'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mil-controls-grid">
                  {BOTTOM_BAR_CATEGORIES.map((cat) =>
                    cat.actionIds.map((actId, idx) => {
                      const cmd = COMMAND_BY_ID[actId];
                      if (!cmd) return null;
                      return (
                        <div key={cmd.id} className="mil-ctrl-item">
                          <kbd>[{cat.hotkey || cat.key}] › [{idx + 1}]</kbd>
                          <div>
                            <strong>{cmd.name} ({cmd.cost} SUP)</strong>
                            <span>{cmd.subtitle}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="mil-subpane">
              <div className="mil-subbar">
                <button
                  type="button"
                  className={`mil-pill ${systemSubTab === 'saves' ? 'active' : ''}`}
                  onClick={() => setSubTab('saves')}
                >
                  ▪ SALVAR / CARREGAR
                </button>
                <button
                  type="button"
                  className={`mil-pill ${systemSubTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setSubTab('settings')}
                >
                  ⚙ ÁUDIO & VÍDEO
                </button>
                <button
                  type="button"
                  className={`mil-pill ${systemSubTab === 'controls' ? 'active' : ''}`}
                  onClick={() => setSubTab('controls')}
                >
                  ▸ MANUAL DE CAMPO
                </button>
                {!isInstalledPwa && (
                  <button
                    type="button"
                    className="mil-pill"
                    onClick={() => onInstallPwa?.()}
                  >
                    ▸ INSTALAR APP
                  </button>
                )}
                <button
                  type="button"
                  className="mil-pill"
                  onClick={() => {
                    setFbError('');
                    setFbModalOpen(true);
                  }}
                >
                  ⚙️ Configurar Chaves Firebase
                </button>
              </div>

              {systemSubTab === 'saves' && (
                <div>
                  <div className="mil-save-bar">
                    <input
                      type="text"
                      className="mil-input"
                      placeholder={`Nome da Operação (${hud.gameMode.toUpperCase()})`}
                      value={saveTitleInput}
                      onChange={(e) => setSaveTitleInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="mil-btn-primary"
                      style={{ minHeight: 44, padding: '0 14px' }}
                      onClick={() => {
                        onSaveBattle?.(saveTitleInput.trim() || null);
                        setSaveTitleInput('');
                      }}
                    >
                      ▪ SALVAR
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => onExportBattle?.(null)}
                    >
                      ▸ EXPORTAR .JSON
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      ▸ IMPORTAR .JSON
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleFileImport}
                    />
                  </div>

                  {savedBattles.length === 0 ? (
                    <div className="mil-empty-box">
                      Nenhuma batalha salva. Clique em SALVAR ou pressione [F9] durante a partida.
                    </div>
                  ) : (
                    <div className="mil-saves-list">
                      {savedBattles.map((save, idx) => (
                        <div key={save.id} className="mil-save-row">
                          <div>
                            <strong>#{idx + 1} {save.title}</strong>
                            <span>
                              {(save.gameMode || '1v1').toUpperCase()} • {save.supplies} SUP • {save.allyUnitsCount || 0} Tropas
                            </span>
                          </div>
                          <div className="mil-save-actions">
                            <button
                              type="button"
                              className="mil-pill active"
                              onClick={() => onLoadBattle?.(save.id)}
                            >
                              ▸ CARREGAR
                            </button>
                            <button
                              type="button"
                              className="mil-pill"
                              onClick={() => onDeleteBattle?.(save.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {systemSubTab === 'settings' && (
                <div className="mil-settings-list">
                  <label className="mil-setting-row">
                    <div>
                      <strong>Velocidade da Câmera</strong>
                      <span>{(s.camSpeed || 1).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.2"
                      step="0.1"
                      value={s.camSpeed || 1}
                      onChange={(e) => onUpdateSettings({ camSpeed: parseFloat(e.target.value) })}
                    />
                  </label>

                  <label className="mil-setting-row">
                    <div>
                      <strong>Volume Geral</strong>
                      <span>{Math.round((s.volume ?? 0.35) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={s.volume ?? 0.35}
                      onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                    />
                  </label>

                  <div className="mil-setting-row">
                    <div>
                      <strong>Sombras Solares (PCF)</strong>
                      <span>{s.highQuality ? 'Ativadas' : 'Desempenho'}</span>
                    </div>
                    <button
                      type="button"
                      className={`mil-pill ${s.highQuality ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ highQuality: !s.highQuality })}
                    >
                      {s.highQuality ? '▪ ATIVADAS' : '▸ DESATIVADAS'}
                    </button>
                  </div>
                </div>
              )}

              {systemSubTab === 'controls' && (
                <div className="mil-controls-grid">
                  <div className="mil-ctrl-item"><kbd>W A S D</kbd><div><strong>Câmera</strong><span>Mover pelo campo</span></div></div>
                  <div className="mil-ctrl-item"><kbd>Scroll</kbd><div><strong>Zoom</strong><span>Estratégico ↔ Tático</span></div></div>
                  <div className="mil-ctrl-item"><kbd>Espaço</kbd><div><strong>Pausa Tática</strong><span>Dar ordens em pausa</span></div></div>
                  <div className="mil-ctrl-item"><kbd>Clique Dir.</kbd><div><strong>Mover / Atacar</strong><span>Ocupar casas e trincheiras</span></div></div>
                  <div className="mil-ctrl-item"><kbd>F1 – F5</kbd><div><strong>Abas</strong><span>Infantaria, Veículos, Eng., Defesas</span></div></div>
                  <div className="mil-ctrl-item"><kbd>K / F9</kbd><div><strong>Atalhos</strong><span>Separar soldado [K] • Salvar [F9]</span></div></div>
                </div>
              )}
            </div>
          )}
            </div>
            {activeTab === 'rooms' && (
              <div className="outlive-crt-lower-dock">
                <div style={{ fontSize: '0.72rem', color: '#64748b', paddingBottom: 4 }}>
                  Selecione uma operação acima ou crie uma nova sala tática 1v1, 2v2, 3P ou 4P FFA.
                </div>
                <WireframeTopoRadar mapId={selectedMapId} />
              </div>
            )}
          </div>
          <div className="outlive-crt-bar bottom">
            <span>Visor de Telemetria</span>
            <span>REDE CRIPTOGRAFADA ATIVA</span>
          </div>
        </main>

        {/* BARRA DE RODAPÉ TÁTICA & COMUNIDADE */}
        <footer className="outlive-hub-footer">
          <div className="outlive-footer-btn" style={{ cursor: 'default' }}>
            <span className="outlive-server-pulse" />
            <span>SERVIDOR ONLINE</span>
          </div>
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="outlive-footer-btn"
            onMouseEnter={() => getUiSound().playUiHover()}
          >
            💬 Discord
          </a>
          <a
            href="https://chat.whatsapp.com"
            target="_blank"
            rel="noreferrer"
            className="outlive-footer-btn"
            onMouseEnter={() => getUiSound().playUiHover()}
          >
            📱 WhatsApp
          </a>
          <button
            type="button"
            className="outlive-footer-btn"
            onMouseEnter={() => getUiSound().playUiHover()}
            onClick={() => {
              getUiSound().playUiHydraulic();
              setRedeemMsg('');
              setRedeemOpen(true);
            }}
          >
            🎟️ RESGATAR CÓDIGO
          </button>
        </footer>
        </div>
        </div>
      </div>

      {supportOpen && (
        <div className="sys-modal-backdrop" onClick={() => setSupportOpen(false)}>
          <div className="sys-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="tutorial-header">
              <div>
                <div className="tutorial-kicker">CENTRAL DE COMANDO</div>
                <h3 className="tutorial-title">🎧 SUPORTE AO COMANDANTE</h3>
              </div>
              <button type="button" className="hud-btn" onClick={() => setSupportOpen(false)}>✕</button>
            </div>
            <p className="mp-desc" style={{ marginTop: 10 }}>
              Precisa de ajuda com sua conta, partidas online ou pacotes? Entre em contato pelos canais oficiais no Discord ou WhatsApp no rodapé do terminal.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="mil-btn-primary" onClick={() => setSupportOpen(false)}>FECHAR</button>
            </div>
          </div>
        </div>
      )}

      {redeemOpen && (
        <div className="sys-modal-backdrop" onClick={() => setRedeemOpen(false)}>
          <div className="sys-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="tutorial-header">
              <div>
                <div className="tutorial-kicker">PROMOÇÃO MILITAR</div>
                <h3 className="tutorial-title">🎟️ RESGATAR CÓDIGO</h3>
              </div>
              <button type="button" className="hud-btn" onClick={() => setRedeemOpen(false)}>✕</button>
            </div>
            <input
              type="text"
              className="mil-input"
              style={{ marginTop: 10, width: '100%' }}
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="Digite seu código promocional..."
            />
            {redeemMsg && <div className="mp-status-note" style={{ marginTop: 8 }}>{redeemMsg}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="mil-btn-primary"
                onClick={() => {
                  const clean = redeemCode.trim().toUpperCase();
                  if (!clean) {
                    setRedeemMsg('Informe um código válido.');
                    return;
                  }
                  if (clean === 'OUTLIVE2026' || clean === 'FRONTLINE100') {
                    setRedeemMsg('✅ Código validado! Bônus aplicado ao comandante.');
                  } else {
                    setRedeemMsg('❌ Código não reconhecido ou expirado.');
                  }
                }}
              >
                ATIVAR CÓDIGO
              </button>
            </div>
          </div>
        </div>
      )}

      {fbModalOpen && (
        <div className="sys-modal-backdrop" onClick={() => setFbModalOpen(false)}>
          <div className="sys-modal-card mp-fb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tutorial-header">
              <div>
                <div className="tutorial-kicker">DEPLOY VERCEL / FIREBASE REALTIME DATABASE</div>
                <h3 className="tutorial-title">⚙️ CONFIGURAR CHAVES FIREBASE</h3>
              </div>
              <button type="button" className="hud-btn" onClick={() => setFbModalOpen(false)}>
                ✕
              </button>
            </div>
            <p className="mp-desc" style={{ marginTop: 8 }}>
              Cole abaixo o JSON do seu <code>firebaseConfig</code> (ou configure as variáveis <code>VITE_FIREBASE_API_KEY</code> e <code>VITE_FIREBASE_DATABASE_URL</code> na Vercel):
            </p>
            <textarea
              className="mp-fb-textarea"
              rows={8}
              value={fbConfigText}
              onChange={(e) => setFbConfigText(e.target.value)}
              placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "databaseURL": "https://seu-projeto-default-rtdb.firebaseio.com",\n  "projectId": "..."\n}'}
            />
            {fbError && <div className="mp-status-note" style={{ color: '#f87171' }}>{fbError}</div>}
            <div className="mp-waiting-footer" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="mil-btn-secondary"
                onClick={() => {
                  networkManager.updateFirebaseConfig(null);
                  setFbConfigText('');
                  setFbModalOpen(false);
                }}
              >
                🗑 Limpar (Modo Local)
              </button>
              <button
                type="button"
                className="mil-btn-primary"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(fbConfigText);
                    if (!parsed.apiKey || !parsed.databaseURL) {
                      setFbError('Informe pelo menos apiKey e databaseURL válidos.');
                      return;
                    }
                    networkManager.updateFirebaseConfig(parsed);
                    setFbModalOpen(false);
                  } catch {
                    setFbError('JSON inválido. Verifique as aspas e chaves.');
                  }
                }}
              >
                ✓ SALVAR CONFIGURAÇÃO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
