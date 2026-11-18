import React, { useEffect, useRef, useState } from 'react';
import TutorialModal from './TutorialModal.jsx';
import MultiplayerLobby from './MultiplayerLobby.jsx';
import AuthGate from './AuthGate.jsx';
import { loadStoredFirebaseConfig, networkManager } from '../game/net/NetworkManager.js';
import {
  COMMAND_BY_ID,
  BOTTOM_BAR_CATEGORIES,
  ARMY_FACTIONS,
  BATTLEFIELD_MAPS,
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

export default function GameMenus({
  gameState,
  initialTab = 'skirmish',
  hud,
  interrogationTarget,
  onPlayMode,
  onPlaySandbox,
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
  const [subTab, setSubTab] = useState(initialTab || 'skirmish');
  const [net, setNet] = useState(() => networkManager.getStatusSnapshot());
  const [newCampName, setNewCampName] = useState('');
  const [storeMsg, setStoreMsg] = useState('');
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsub = networkManager.subscribe(setNet);
    return () => unsub();
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

  const isPaused = gameState === 'PAUSED';
  const s = hud.settings || { camSpeed: 1.0, volume: 0.35, highQuality: true };

  const activeTab =
    subTab === 'skirmish'
      ? 'skirmish'
      : subTab === 'campaign'
      ? 'campaign'
      : subTab === 'ranks'
      ? 'ranks'
      : subTab === 'store'
      ? 'store'
      : ['skins', 'arsenal', 'tutorial', 'saves', 'settings', 'controls', 'sandbox'].includes(subTab)
      ? 'arsenal_hub'
      : 'rooms';

  const hubSubTab = ['skins', 'arsenal', 'tutorial', 'saves', 'settings', 'controls', 'sandbox'].includes(
    subTab
  )
    ? subTab
    : 'skins';
  const systemSubTab =
    subTab === 'settings' ? 'settings' : subTab === 'controls' ? 'controls' : 'saves';

  const mapSubtitles = {
    normandy_fields: 'Frente Rural Europeia • Campos e Vilarejos',
    el_alamein_ridge: 'Frente Árida Norte da África • Dunas e Oásis',
    bastogne_winter: 'Frente Congelada das Ardenas • Neve e Pinheiros',
  };

  return (
    <div className="mil-menu-overlay">
      <div className="mil-menu-panel">
        {/* CABEÇALHO DO HUB ONLINE + PERFIL DO COMANDANTE */}
        <header className="mil-menu-header">
          <div className="mil-brand">
            <span className="mil-brand-title">COMPANY OF FRONTLINE</span>
            <span className="mil-brand-sub">
              {isPaused
                ? `▪ OPERAÇÃO ${hud.gameMode.toUpperCase()} PAUSADA`
                : '▪ HUB MULTIPLAYER ONLINE'}
            </span>
          </div>

          <nav className="mil-tabs" aria-label="Hub Principal">
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'skirmish' ? 'active' : ''}`}
              onClick={() => setSubTab('skirmish')}
            >
              ⚔️ CAMPANHA / 1v1 & 2v2
            </button>
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setSubTab('rooms')}
            >
              📡 SALAS ONLINE
            </button>
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'campaign' ? 'active' : ''}`}
              onClick={() => setSubTab('campaign')}
            >
              🗓️ CAMPANHAS (15 DIAS)
            </button>
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'ranks' ? 'active' : ''}`}
              onClick={() => setSubTab('ranks')}
            >
              🎖️ PATENTE & BATALHÕES
            </button>
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
              onClick={() => setSubTab('store')}
            >
              🛒 SUPRIMENTOS
            </button>
            <button
              type="button"
              className={`mil-tab-btn ${activeTab === 'arsenal_hub' ? 'active' : ''}`}
              onClick={() => setSubTab('tutorial')}
            >
              📖 GUIA / SIST.
            </button>
          </nav>

          {net.currentUser && (
            <div className="hub-user-badge">
              <div className="hub-user-info">
                <strong>
                  {net.currentUser.hasGoldInsignia ? '🏅 ' : ''}
                  {net.currentUser.callsign}
                </strong>
                <small>
                  Nv.{net.currentUser.level || 1} {net.currentUser.rank} • 💰{' '}
                  {net.currentUser.militaryGold ?? 1000} Ouro
                </small>
              </div>
              <button
                type="button"
                className="mil-pill"
                onClick={() => networkManager.logout()}
                title="Encerrar sessão do comandante"
              >
                Sair
              </button>
            </div>
          )}
        </header>

        {/* CORPO DO HUB CENTRAL */}
        <main className="mil-menu-body">
          {activeTab === 'rooms' && (
            <div className="mil-subpane">
              <MultiplayerLobby onStartOnlineMatch={onStartOnlineMatch} />
            </div>
          )}

          {activeTab === 'campaign' && (
            <div className="mil-subpane">
              <div className="mp-card">
                <div className="mp-card-head">
                  <div>
                    <span className="mp-kicker">OPERAÇÕES PERSISTENTES DE 15 DIAS</span>
                    <h3>CAMPANHAS ATIVAS</h3>
                  </div>
                  <div className="mp-join-inline">
                    <input
                      type="text"
                      className="mil-input"
                      value={newCampName}
                      onChange={(e) => setNewCampName(e.target.value)}
                      placeholder="Nome da nova campanha..."
                    />
                    <button
                      type="button"
                      className="mil-btn-primary"
                      onClick={() => {
                        networkManager.createCampaign({ name: newCampName, mapId: selectedMapId });
                        setNewCampName('');
                      }}
                    >
                      ➕ Criar Campanha de 15 Dias
                    </button>
                  </div>
                </div>

                {/* Pacotes Táticos Ativos na Conta para Campanhas */}
                <div className="mp-active-packs-strip">
                  <span className="mp-kicker">PACOTES ATIVOS NA CAMPANHA:</span>
                  {(net.currentUser?.ownedCampaignPacks || []).length === 0 ? (
                    <small style={{ color: '#8c948c' }}>
                      Nenhum pacote ativo (visite 🛒 SUPRIMENTOS para equipar Defesa de QG / 2× XP).
                    </small>
                  ) : (
                    (net.currentUser?.ownedCampaignPacks || []).map((pid) => {
                      const pk = CAMPAIGN_PACKS.find((x) => x.id === pid);
                      return (
                        <span key={pid} className="mp-ping-badge">
                          {pk?.icon || '✓'} {pk?.badge || pid}
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="mp-campaigns-grid">
                  {(net.campaigns || []).map((c) => (
                    <div key={c.id} className="mp-campaign-card">
                      <div className="mp-card-head">
                        <strong>{c.name}</strong>
                        <span className="mp-ping-badge">
                          Dia {c.day} / {c.totalDays || 15}
                        </span>
                      </div>
                      <div className="mp-campaign-stats">
                        <span>Aliados: {c.alliesSectors} Setores</span>
                        <span>Eixo: {c.axisSectors} Setores</span>
                        <span>Recursos: {c.playerSupplies} SUP</span>
                      </div>
                      <button
                        type="button"
                        className="mil-btn-primary"
                        onClick={() =>
                          onStartOnlineMatch?.({
                            networkManager,
                            room: {
                              roomId: c.id,
                              mapId: c.mapId || 'normandy_fields',
                              mapSeed: c.mapSeed || 194406,
                              startingResources: c.playerSupplies || 1000,
                              isCampaign: true,
                              campaignDay: c.day || 1,
                            },
                            localSlot: 1,
                          })
                        }
                      >
                        ⚔️ Entrar no Front da Campanha
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Salvamento 100% Local das Campanhas (COF_LOCAL_CAMPAIGN_SAVES — 3 Slots) */}
              <div className="mp-card">
                <div className="mp-card-head">
                  <div>
                    <span className="mp-kicker">COF_LOCAL_CAMPAIGN_SAVES • ARMAZENAMENTO NO NAVEGADOR</span>
                    <h3>SAVES LOCAIS DE CAMPANHA (3 SLOTS)</h3>
                  </div>
                  <div className="mp-join-inline">
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => onExportBattle?.(null)}
                    >
                      📥 Exportar Save (.json)
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📤 Importar Save
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleFileImport}
                    />
                  </div>
                </div>
                <div className="mp-campaigns-grid">
                  {networkManager.getLocalCampaignSaves().map((slotData, idx) => (
                    <div key={idx} className="mp-campaign-card">
                      <div className="mp-card-head">
                        <strong>SLOT #{idx + 1}</strong>
                        <span className="mp-ping-badge">
                          {slotData ? `Dia ${slotData.campaignDay || 1}/15` : 'VAZIO'}
                        </span>
                      </div>
                      <small style={{ color: '#8c948c' }}>
                        {slotData
                          ? `${slotData.title || 'Campanha'} • ${Math.round(slotData.supplies || 0)} SUP`
                          : 'Salve uma partida de Campanha em andamento para retomar deste dispositivo.'}
                      </small>
                      <div className="mp-join-inline" style={{ marginLeft: 0 }}>
                        {slotData && (
                          <button
                            type="button"
                            className="mil-pill active"
                            onClick={() => onImportBattle?.(slotData)}
                          >
                            ▸ Carregar
                          </button>
                        )}
                        {isPaused && (
                          <button
                            type="button"
                            className="mil-pill"
                            onClick={() => {
                              const snap = window.__frontlineGame?.serializeBattleState?.(
                                `Campanha Slot ${idx + 1}`
                              );
                              if (snap) networkManager.saveLocalCampaignSlot(idx, snap);
                            }}
                          >
                            💾 Salvar Aqui
                          </button>
                        )}
                        {slotData && (
                          <button
                            type="button"
                            className="mil-pill"
                            onClick={() => networkManager.deleteLocalCampaignSlot(idx)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ranks' && (
            <div className="mil-subpane">
              {(() => {
                const xp = net.currentUser?.xp || 0;
                const prog = computeLevelFromXp(xp);
                const span = Math.max(1, prog.nextLevelXp - prog.currentMinXp);
                const pct =
                  prog.nextLevelXp > prog.currentMinXp
                    ? Math.min(100, Math.round(((xp - prog.currentMinXp) / span) * 100))
                    : 100;
                return (
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <div>
                        <span className="mp-kicker">PROGRESSÃO DE CONTA NA NUVEM (FIREBASE)</span>
                        <h3>
                          PATENTE ATUAL: Nível {prog.level} — {prog.rank.toUpperCase()} ({xp} XP)
                        </h3>
                      </div>
                      <button
                        type="button"
                        className="mil-pill"
                        onClick={() => networkManager.addAccountXp(250, { isCampaign: true })}
                        title="Simular ganho de XP de Campanha para testar desbloqueios"
                      >
                        ⚡ +250 XP Teste
                      </button>
                    </div>
                    <div className="struct-ctx-hpbar" style={{ height: 8 }}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <small style={{ color: '#8c948c' }}>
                      Próximo nível: {xp} / {prog.nextLevelXp} XP • Toda partida concluída e dia sobrevivido na Campanha de 15 Dias concede XP.
                    </small>

                    <div className="mp-campaigns-grid">
                      {BATTALION_UNLOCKS.map((b) => {
                        const unlocked = prog.level >= b.requiredLevel;
                        return (
                          <div
                            key={b.id}
                            className={`mp-campaign-card ${unlocked ? 'unlocked-bat' : 'locked-bat'}`}
                          >
                            <div className="mp-card-head">
                              <strong>
                                {b.icon} {b.name}
                              </strong>
                              <span className="mp-ping-badge">
                                {unlocked ? '✓ LIBERADO' : `🔒 Nv.${b.requiredLevel} (${b.rankName})`}
                              </span>
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

          {activeTab === 'store' && (
            <div className="mil-subpane">
              <div className="mp-card">
                <div className="mp-card-head">
                  <div>
                    <span className="mp-kicker">LOJA CONECTADA À CONTA • VINCULADA AO UID</span>
                    <h3>🛒 SUPRIMENTOS DE CAMPANHA (ITENS PAGOS)</h3>
                  </div>
                  <div className="mp-room-meta">
                    <span className="mp-ping-badge">
                      💰 {net.currentUser?.militaryGold ?? 1000} Ouro Militar
                    </span>
                    <button
                      type="button"
                      className="mil-pill"
                      onClick={() => networkManager.addMilitaryGold(500)}
                    >
                      +500 Ouro (Teste)
                    </button>
                  </div>
                </div>

                <div className="store-fairplay-banner">
                  ⚠️ <strong>Válido Exclusivamente em Operações de Campanha de 15 Dias</strong> — Desativado automaticamente em Partidas 1v1 / 2v2 Competitivas.
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

          {activeTab === 'arsenal_hub' && (
            <div className="mil-subpane">
              <div className="mil-subbar">
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'tutorial' ? 'active' : ''}`}
                  onClick={() => setSubTab('tutorial')}
                >
                  📖 TUTORIAL & ASSALTO
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'skins' ? 'active' : ''}`}
                  onClick={() => setSubTab('skins')}
                >
                  ✦ UNIFORMES & SKINS
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'arsenal' ? 'active' : ''}`}
                  onClick={() => setSubTab('arsenal')}
                >
                  ⚙ ARSENAL DE COMBATE
                </button>
                <button
                  type="button"
                  className="mil-pill"
                  style={{ borderColor: '#c28e38', color: '#c28e38' }}
                  onClick={() => onPlaySandbox?.('1v1', selectedMapId)}
                >
                  🛠️ CAMPO DE TREINAMENTO (SANDBOX)
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'saves' ? 'active' : ''}`}
                  onClick={() => setSubTab('saves')}
                >
                  💾 SAVES
                </button>
                <button
                  type="button"
                  className={`mil-pill ${hubSubTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setSubTab('settings')}
                >
                  ⚙ ÁUDIO/CÂMERA
                </button>
                <button
                  type="button"
                  className="mil-pill"
                  onClick={() => {
                    setFbError('');
                    setFbModalOpen(true);
                  }}
                >
                  ⚙️ Chaves Firebase
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

              {hubSubTab === 'arsenal' && (
                <div className="mil-arsenal-grid">
                  {BOTTOM_BAR_CATEGORIES.map((cat) => (
                    <div key={cat.id} className="mil-arsenal-col">
                      <div className="mil-section-label">
                        {cat.icon} {cat.label} ({cat.hotkey})
                      </div>
                      {cat.commands.map((cmdId) => {
                        const cmd = COMMAND_BY_ID[cmdId];
                        if (!cmd) return null;
                        return (
                          <div key={cmdId} className="mil-arsenal-row">
                            <span>{cmd.name}</span>
                            <small>{cmd.cost ? `${cmd.cost} SUP` : 'GRÁTIS'}</small>
                          </div>
                        );
                      })}
                    </div>
                  ))}
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

          {activeTab === 'skirmish' && (
            <div className="mil-combat-pane">
              <div className="mil-section-label">▸ TEATRO DE OPERAÇÕES</div>
              <div className="mil-map-list">
                {BATTLEFIELD_MAPS.map((m) => (
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
                  className="mil-btn-secondary"
                  style={{ borderColor: '#c28e38', color: '#c28e38' }}
                  onClick={() => onPlaySandbox?.(selectedMode, selectedMapId)}
                >
                  🛠️ MODO CAIXA DE AREIA (TESTE LIVRE)
                </button>
                <button
                  type="button"
                  className="mil-btn-primary"
                  onClick={() =>
                    onPlayMode(selectedMode, startingResources, selectedMapId, selectedDifficulty)
                  }
                >
                  ⚔ INICIAR OPERAÇÃO
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
        </main>
      </div>

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
