import React, { useEffect, useState } from 'react';
import Minimap from './Minimap.jsx';
import TutorialModal from './TutorialModal.jsx';
import {
  IconCamera,
  IconEyeOff,
  IconFastForward,
  IconBolt,
  IconLogout,
  IconSupply,
  IconAmmo,
  IconFuel,
  IconBuilding,
  IconAir,
  IconDrone,
  IconResearch,
  IconCompass,
  IconBook,
  IconGear,
  IconWrench,
  IconGrenade,
  IconFlame,
  IconMedkit,
  IconLock,
  IconUnlock,
  IconParachute,
  IconShield,
  IconStar,
  GameCategoryIcon,
} from './MilIcons.jsx';
import { BATTALION_UNLOCKS } from '../game/data/accountData.js';
import { networkManager } from '../game/net/NetworkManager.js';
import { DIRECTOR_SCENES } from '../game/spectator/SceneDirector.js';
import { HudPanel, useHudLayout } from './HudPanel.jsx';
import {
  COMMAND_BY_ID,
  BOTTOM_BAR_CATEGORIES,
  SPACING_PRESETS,
  BASE_BUILDINGS,
  BASE_BUILDING_BY_ID,
  HQ_UPGRADES,
  ADVANCED_UNITS,
  AIR_DOCTRINES,
  SQUAD_FORMATIONS,
} from '../game/data/rtsData.js';
import {
  TECH_BRANCHES,
  TECH_NODES,
  TECH_BUDGET_TIERS,
  TECH_NODE_BY_ID,
  computeTechResearchCost,
} from '../game/data/techTreeData.js';

export default function HUD({
  gameRef,
  hud,
  onPause,
  onOpenSaves,
  onToggleMute,
}) {
  const [activeBaseTab, setActiveBaseTab] = useState('command'); // 'command' | 'defenses' | 'logistics'
  const [baseDrawerOpen, setBaseDrawerOpen] = useState(false);
  const [airDrawerOpen, setAirDrawerOpen] = useState(false);
  const [editorDrawerOpen, setEditorDrawerOpen] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [editorTab, setEditorTab] = useState('buildings'); // 'buildings' | 'walls' | 'nature' | 'sectors'
  const [editorTool, setEditorTool] = useState('farmhouse');
  const [editorAngleDeg, setEditorAngleDeg] = useState(0);
  const [editorScale, setEditorScale] = useState(1.0);
  const [airLockNotice, setAirLockNotice] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [sandboxCollapsed, setSandboxCollapsed] = useState(false);
  const [directorPanelCollapsed, setDirectorPanelCollapsed] = useState(false);
  const [isAdminState, setIsAdminState] = useState(() => Boolean(networkManager.isAdmin()));
  const layoutApi = useHudLayout(); // Menus responsivos, redimensionáveis e fixáveis

  useEffect(() => {
    const unsub = networkManager.subscribe((snap) => {
      setIsAdminState(Boolean(snap?.isAdmin || networkManager.isAdmin()));
    });
    return () => unsub();
  }, []);

  const isAdmin = isAdminState || Boolean(networkManager.isAdmin());
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.'));

  const hasAirCommand = Boolean(hud?.builtBuildings?.includes('air_command'));

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const k = e.key?.toLowerCase();
      if (k === 'h' && hud?.spectatorMode) {
        e.preventDefault();
        gameRef.current?.toggleSpectatorHud();
        return;
      }
      if (k === 'v') {
        if (hasAirCommand) {
          setAirDrawerOpen((prev) => {
            const next = !prev;
            if (next) setBaseDrawerOpen(false);
            return next;
          });
        } else {
          setAirLockNotice(true);
          gameRef.current?.notify(
            'COMANDO AÉREO BLOQUEADO',
            'Construa o Comando Aéreo / Radar no Menu de Construções para desbloquear os ataques aéreos!',
            '#fbbf24'
          );
        }
      } else if (k === 'b' && !(hud?.selectedUnits?.length > 0)) {
        setBaseDrawerOpen((prev) => {
          const next = !prev;
          if (next) setAirDrawerOpen(false);
          return next;
        });
      } else if (e.key === 'Escape') {
        setBaseDrawerOpen(false);
        setAirDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasAirCommand, hud?.selectedUnits?.length, hud?.spectatorMode, gameRef]);

  if (!hud) return null;

  if (hud.spectatorMode) {
    if (hud.spectatorHudHidden) {
      return (
        <div className="hud-layer" style={{ pointerEvents: 'none' }}>
          <button
            type="button"
            className="spectator-unhide-pill"
            onClick={() => gameRef.current?.toggleSpectatorHud()}
            title="Mostrar Controles do Espectador (Tecla H)"
          >
            [H] Mostrar HUD
          </button>
        </div>
      );
    }
    return (
      <div className="hud-layer" style={{ pointerEvents: 'none' }}>
        <div className="spectator-control-bar">
          <div className="spectator-badge">
            <IconCamera size={15} />
            <span>MODO ESPECTADOR • IA vs IA</span>
          </div>

          <button
            type="button"
            className="spec-btn"
            onClick={() => gameRef.current?.toggleSpectatorHud()}
            title="Ocultar todos os menus da tela para gravação limpa (Tecla H)"
          >
            <IconEyeOff size={14} />
            <span>Ocultar HUD [H]</span>
          </button>

          <button
            type="button"
            className={`spec-btn ${hud.directorCamActive ? 'active' : ''}`}
            onClick={() => gameRef.current?.toggleDirectorCam()}
            title="Câmera Automática acompanha os maiores tiroteios e explosões"
          >
            <IconCamera size={14} />
            <span>Director Cam: {hud.directorCamActive ? 'ON' : 'OFF'}</span>
          </button>

          <div className="spec-speed-group">
            <IconFastForward size={13} />
            {[1, 2, 3].map((spd) => (
              <button
                key={spd}
                type="button"
                className={`spec-speed-btn ${Math.abs((hud.timeScale || 1) - spd) < 0.1 ? 'active' : ''}`}
                onClick={() => gameRef.current?.setGameSpeed(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            className="spec-btn wave"
            onClick={() => gameRef.current?.forceSpectatorArmorWave(false)}
            title="Disparar imediatamente uma grande onda de tanques MBT e APCs dos dois lados"
          >
            <IconBolt size={14} />
            <span>Forçar Onda de Blindados</span>
          </button>

          <button
            type="button"
            className="spec-btn exit"
            onClick={onPause}
            title="Abrir Menu / Sair do Modo Espectador [ESC]"
          >
            <IconLogout size={14} />
            <span>Menu [ESC]</span>
          </button>
        </div>

        {isAdmin && (
          <div className={`spectator-director-panel ${directorPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="spec-dir-head">
              <div className="spec-dir-title">
                <IconCamera size={14} />
                <span>DIRETOR DE CENAS (GERADOR DE BATALHAS)</span>
              </div>
              <button
                type="button"
                className="spec-btn"
                onClick={() => setDirectorPanelCollapsed((v) => !v)}
              >
                {directorPanelCollapsed ? 'Expandir ▾' : 'Recolher ▴'}
              </button>
            </div>

            {!directorPanelCollapsed && (
              <>
                <div className="spec-dir-grid">
                  {DIRECTOR_SCENES.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      className={`spec-scene-btn ${hud.activeDirectorSceneId === sc.id ? 'active' : ''}`}
                      onClick={() => gameRef.current?.runDirectorScene(sc.id)}
                      title={sc.sub}
                    >
                      <strong>{sc.title}</strong>
                      <small>{sc.sub}</small>
                    </button>
                  ))}
                </div>

                <div className="spec-dir-extras">
                  <button
                    type="button"
                    className="spec-btn"
                    onClick={() => gameRef.current?.repeatDirectorScene()}
                    title="Reiniciar cena atual em 1 segundo"
                  >
                    Repetir Cena Atual
                  </button>

                  <div className="spec-speed-group">
                    {[
                      { id: 'day', label: 'Dia' },
                      { id: 'sunset', label: 'Fim de Tarde' },
                      { id: 'night', label: 'Noite' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`spec-speed-btn ${(hud.timeOfDay || 'day') === m.id ? 'active' : ''}`}
                        onClick={() => gameRef.current?.setTimeOfDay(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`spec-btn ${hud.cinematicLowCam ? 'active' : ''}`}
                    onClick={() => gameRef.current?.toggleCinematicLowCam()}
                    title="Aproximar câmera ao nível dos soldados e tanques"
                  >
                    <IconCamera size={13} />
                    <span>Câmera Baixa (Close-up)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const setSpeed = (mult) => {
    gameRef.current?.setGameSpeed(mult);
  };

  const builtSet = new Set(hud.builtBuildings || []);
  const specOpsUnits = ADVANCED_UNITS.filter((u) => u.requiresBuilding === 'spec_ops_center');
  const armorUnits = ADVANCED_UNITS.filter((u) => u.requiresBuilding === 'motor_pool');
  const selectedBld = hud.selectedBuilding;
  const activeBottomCat = hud.activeBottomCategory || 'infantry';
  const leadSquad =
    hud.selectedUnits?.find((u) => u.id === hud.focusedUnitId) ||
    hud.selectedUnits?.[0] ||
    null;
  const completedTechSet = new Set(hud.completedTechs || []);
  const budgetPct = hud.selectedBudgetTier || 0.25;
  const selectedSoldierCount = leadSquad?.soldiers
    ? leadSquad.soldiers.filter((s) => s.selected).length
    : 0;

  const renderActionSlot = (actionId, slotIdx = 0, isAllView = false) => {
    const cmd = COMMAND_BY_ID[actionId];
    if (!cmd) return null;

    const hqLevel = hud.hqLevel || 1;
    const reqHq = cmd.requiredHqLevel || 1;
    const hqUnlocked = hqLevel >= reqHq;
    const reqBld = cmd.requiresBuilding;
    const isUnlocked = hqUnlocked && (!reqBld || builtSet.has(reqBld));
    const canAfford =
      isUnlocked &&
      hud.supplies >= (cmd.cost || 0) &&
      hud.ammo >= (cmd.ammoCost || 0) &&
      hud.fuel >= (cmd.fuelCost || 0);

    const isEngActive =
      hud.activeCommandMode &&
      hud.activeCommandMode === cmd.category &&
      (!hud.activeEngineeringActionId || hud.activeEngineeringActionId === cmd.id);

    const costLabel = [
      `${cmd.cost || 0} SUP`,
      cmd.ammoCost ? `${cmd.ammoCost} MUN` : null,
      cmd.fuelCost ? `${cmd.fuelCost} COMB` : null,
    ]
      .filter(Boolean)
      .join(' + ');

    const reqSpec = reqBld ? BASE_BUILDING_BY_ID[reqBld] : null;
    const keyBadge = isAllView
      ? cmd.key
        ? `[${cmd.key}]`
        : `[${slotIdx + 1}]`
      : `[${slotIdx + 1}]`;

    const subText = !hqUnlocked
      ? `🔒 Requer QG Nível ${reqHq}`
      : !isUnlocked && reqSpec
      ? `🔒 Requer ${reqSpec.short}`
      : cmd.cardSub || cmd.subtitle;

    return (
      <button
        key={cmd.id}
        type="button"
        className={`hotbar-slot rts-slot ${isEngActive ? 'active' : ''} ${!canAfford ? 'locked' : ''
          }`}
        onClick={() => gameRef.current?.triggerActionById(cmd.id)}
        title={`${cmd.name} — ${cmd.subtitle}`}
      >
        <div className="slot-top-row">
          <span className="slot-num">{keyBadge}</span>
          <span className="slot-cost">{costLabel}</span>
        </div>
        <span className="slot-label">{cmd.short || cmd.name}</span>
        <span className="slot-ammo">{subText}</span>
      </button>
    );
  };

  return (
    <div className="hud-layer">
      {/* MODAL DA ÁRVORE DE PESQUISA & TECNOLOGIA MILITAR [TECLA T] */}
      {hud.techModalOpen && (
        <div
          className="tactical-board-backdrop"
          onClick={() => gameRef.current?.toggleTechModal(false)}
        >
          <div className="tech-tree-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="tech-tree-header">
              <div>
                <span className="menu-badge">🔬 P&amp;D MILITAR • TECLA [T]</span>
                <h2>ÁRVORE DE PESQUISA &amp; TECNOLOGIA</h2>
              </div>
              <button
                type="button"
                className="hud-btn pause-btn"
                onClick={() => gameRef.current?.toggleTechModal(false)}
              >
                ✕ FECHAR [T]
              </button>
            </div>

            {/* SELETOR DE ORÇAMENTO (% DOS SUPRIMENTOS ATUAIS) */}
            <div className="tech-budget-bar">
              <div className="tech-budget-info">
                <strong>INVESTIMENTO DO ORÇAMENTO ATUAL:</strong>
                <span>
                  Quanto maior a % dos seus Suprimentos investida, mais rápido a pesquisa conclui!
                </span>
              </div>
              <div className="tech-budget-pills">
                {TECH_BUDGET_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    className={`tech-budget-btn ${Math.abs(budgetPct - tier.pct) < 0.05 ? 'active' : ''}`}
                    onClick={() => gameRef.current?.setTechBudgetPct(tier.pct)}
                    title={tier.desc}
                  >
                    <strong>{tier.short}</strong>
                    <small>{tier.speedMult}x Vel.</small>
                  </button>
                ))}
              </div>
            </div>

            {/* BARRA DE PESQUISA ATIVA */}
            {hud.activeResearch && (
              <div className="tech-active-progress">
                <div className="bprod-progress-head">
                  <span>
                    ⚙ Pesquisando:{' '}
                    {TECH_NODE_BY_ID[hud.activeResearch.techId]?.name || hud.activeResearch.techId}
                  </span>
                  <strong>
                    {Math.min(
                      100,
                      Math.round((hud.activeResearch.progress / hud.activeResearch.duration) * 100)
                    )}
                    % ({Math.max(0, hud.activeResearch.duration - hud.activeResearch.progress).toFixed(1)}s)
                  </strong>
                </div>
                <div className="stat-track">
                  <div
                    className="stat-fill prod-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (hud.activeResearch.progress / hud.activeResearch.duration) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 3 RAMOS DA ÁRVORE DE PESQUISA */}
            <div className="tech-branches-grid">
              {TECH_BRANCHES.map((branch) => {
                const nodes = TECH_NODES.filter((n) => n.branch === branch.id);
                return (
                  <div key={branch.id} className="tech-branch-col">
                    <div className="tech-branch-title" style={{ borderLeftColor: branch.color }}>
                      <span>
                        {branch.icon} {branch.title}
                      </span>
                      <small>{branch.subtitle}</small>
                    </div>
                    <div className="tech-nodes-list">
                      {nodes.map((node) => {
                        const isDone = completedTechSet.has(node.id);
                        const isRunning = hud.activeResearch?.techId === node.id;
                        const hqLevel = hud.hqLevel || 1;
                        const cp = hud.commandPoints || 0;
                        const hqOk = hqLevel >= (node.requiredHqLevel || 1);
                        const cpOk = cp >= (node.requiredCp || 0);
                        const prereqOk = !node.requiresTech || completedTechSet.has(node.requiresTech);
                        const isTechUnlocked = hqOk && cpOk && prereqOk;
                        const quote = computeTechResearchCost(
                          node,
                          hud.supplies,
                          hud.fuel,
                          budgetPct,
                          hud.ammo
                        );
                        const canAfford =
                          !isDone &&
                          !hud.activeResearch &&
                          isTechUnlocked &&
                          hud.supplies >= quote.supplyCost &&
                          hud.ammo >= quote.ammoCost &&
                          hud.fuel >= quote.fuelCost;
                        const lockParts = [];
                        if (!hqOk) lockParts.push(`QG Nv.${node.requiredHqLevel}`);
                        if (!cpOk) lockParts.push(`${node.requiredCp} CP`);
                        if (!prereqOk) lockParts.push(TECH_NODE_BY_ID[node.requiresTech]?.short || 'UAV');
                        return (
                          <button
                            key={node.id}
                            type="button"
                            className={`tech-node-card ${isDone ? 'done' : ''} ${isRunning ? 'running' : ''} ${!canAfford && !isDone && !isRunning ? 'locked' : ''}`}
                            disabled={isDone || isRunning}
                            onClick={() => gameRef.current?.startResearch(node.id, budgetPct)}
                          >
                            <div className="tech-node-top">
                              <strong>
                                {node.icon} {node.name}
                              </strong>
                              <span className="tech-node-status">
                                {isDone
                                  ? '✅ CONCLUÍDA'
                                  : isRunning
                                  ? '⏳ PESQUISANDO'
                                  : !isTechUnlocked
                                  ? `🔒 ${lockParts.join(' + ')}`
                                  : `${quote.supplyCost} SUP${quote.ammoCost ? ` + ${quote.ammoCost} MUN` : ''}${quote.fuelCost ? ` + ${quote.fuelCost} COMB` : ''} • ${quote.duration}s`}
                              </span>
                            </div>
                            <div className="tech-node-desc">{node.effectText}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPANDIDO DO QUADRO DE OPERAÇÕES TÁTICAS ([TAB]) */}
      {hud.tacticalMapOpen && (
        <div
          className="tactical-board-backdrop"
          onClick={() => gameRef.current?.toggleTacticalMap(false)}
        >
          <div className="tactical-board-dialog" onClick={(e) => e.stopPropagation()}>
            <Minimap gameRef={gameRef} expanded />
          </div>
        </div>
      )}

      {/* TOPO ESQUERDO: Mini-Mapa / Quadro de Planejamento Tático Interativo (Oculto quando Editor de Mapa está aberto) */}
      {!editorDrawerOpen && (
      <HudPanel id="theater" className="hud-top-left" layoutApi={layoutApi}>
        <Minimap gameRef={gameRef} expanded={false} />

        <div className="district-card">
          <div className="district-name">TEATRO DE OPERAÇÕES ({hud.gameMode.toUpperCase()})</div>
          <div className="district-owner">
            Aliados: {hud.allyUnitsCount} • Eixo Avistado: {hud.enemyUnitsCount}
          </div>
          <div className="district-meta">
            <span>Próx. Onda: {hud.aiWaveTimer}s</span>
            <span style={{ color: '#d4a338', fontWeight: 700 }}>
              🏆 {hud.victoryPoints || 0} PTS
            </span>
          </div>
          {hud.intelRevealed && (
            <div className="war-progress-hint" style={{ color: '#a3be8c' }}>
              ✓ INTELIGÊNCIA ATIVA: Base Inimiga, Minas & Trincheiras Expostas
            </div>
          )}
          {hud.surrenderedCount > 0 && (
            <div className="war-progress-hint" style={{ color: '#ffffff' }}>
              🏳 {hud.surrenderedCount} Esquadrão Rendido! Clique nele ou [G] p/ Interrogar
            </div>
          )}
        </div>
      </HudPanel>
      )}

      {/* TOPO CENTRO: 100% Livre e Transparente (apenas avisos flutuantes de combate) */}
      <div className="hud-top-center-notices">
        {hud.victoryState === 'allies' && (
          <div className="victory-banner">
            🏆 VITÓRIA TOTAL ALIADA! QG INIMIGO DEMOLIDO! (+{hud.victoryPoints} PONTOS DE VITÓRIA)
          </div>
        )}

        <div className="notify-stack">
          {hud.notifications.map((n) => (
            <div key={n.id} className="notify-toast" style={{ borderLeftColor: n.color }}>
              <div className="notify-title" style={{ color: n.color }}>
                {n.title}
              </div>
              {n.subtitle && <div className="notify-sub">{n.subtitle}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* TOPO DIREITO / LATERAL ESQUERDA: Quando Editor de Mapa está aberto, esconde o HUD de partida e deixa só os menus de construção */}
      <HudPanel id="command" className="hud-top-right" layoutApi={layoutApi}>
        {!editorDrawerOpen && (
          <>
            <div className="toolbar-row compact-combat-bar">
              {(hud.droneStock?.uav_recon || 0) > 0 && (
                <button
                  type="button"
                  className={`hud-btn ${hud.activeDroneLaunchMode === 'uav_recon' ? 'active' : ''}`}
                  onClick={() => gameRef.current?.triggerDroneLaunchMode('uav_recon')}
                  title="Lançar Drone UAV do Hangar"
                >
                  <IconDrone size={13} /> UAV ({hud.droneStock.uav_recon})
                </button>
              )}
              {(hud.droneStock?.fpv_kamikaze || 0) > 0 && (
                <button
                  type="button"
                  className={`hud-btn ${hud.activeDroneLaunchMode === 'fpv_kamikaze' ? 'active' : ''}`}
                  onClick={() => gameRef.current?.triggerDroneLaunchMode('fpv_kamikaze')}
                  title="Lançar Drone Kamikaze FPV do Hangar"
                >
                  <IconDrone size={13} /> FPV ({hud.droneStock.fpv_kamikaze})
                </button>
              )}
              {hud.droneQueue?.length > 0 && (
                <span className="hud-btn" style={{ cursor: 'default', opacity: 0.9 }}>
                  <IconDrone size={12} /> {hud.droneQueue[0].remaining}s
                </span>
              )}

              <button
                type="button"
                className={`hud-btn ${hud.techModalOpen ? 'active' : ''}`}
                onClick={() => gameRef.current?.toggleTechModal()}
                title="Árvore de Pesquisa & Drones [T]"
              >
                <IconResearch size={13} /> [T]
              </button>
              <button
                type="button"
                className={`hud-btn ${hud.tacticalMapOpen ? 'active' : ''}`}
                onClick={() => gameRef.current?.toggleTacticalMap()}
                title="Mapa Estratégico [TAB]"
              >
                <IconCompass size={13} /> [TAB]
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`hud-btn ${hud.sandboxMode ? 'active' : ''}`}
                  onClick={() => gameRef.current?.toggleSandboxMode()}
                  title="Modo Caixa de Areia / Campo de Testes [F10] (Exclusivo Admin)"
                >
                  <IconWrench size={13} /> F10
                </button>
              )}
              <button
                type="button"
                className={`hud-btn ${tutorialOpen ? 'active' : ''}`}
                onClick={() => setTutorialOpen((v) => !v)}
                title="Tutorial Completo & Guia Tático de Campo"
              >
                <IconBook size={13} /> GUIA
              </button>
              <button
                type="button"
                className={`hud-btn gear-btn ${systemMenuOpen ? 'active' : ''}`}
                onClick={() => setSystemMenuOpen((v) => !v)}
                title="Opções do Sistema [ESC]"
              >
                <IconGear size={14} />
              </button>
            </div>

            {/* BARRA DE PROGRESSÃO DO QG (NÍVEL 1-3) + PONTOS DE COMANDO (CP) */}
            {(() => {
              const lvl = hud.hqLevel || 1;
              const cp = hud.commandPoints || 0;
              const nextSpec = lvl < 3 ? HQ_UPGRADES[lvl + 1] : null;
              const canUpgradeHq =
                nextSpec &&
                cp >= (nextSpec.requiredCp || 0) &&
                hud.supplies >= (nextSpec.supplyCost || 0) &&
                hud.fuel >= (nextSpec.fuelCost || 0) &&
                hud.ammo >= (nextSpec.ammoCost || 0);
              return (
                <div className="hq-progression-bar">
                  <span className="hq-lvl-badge">
                    <IconBuilding size={12} /> QG NV. {lvl}/3
                  </span>
                  <span className="hq-cp-badge">
                    <IconStar size={12} /> {cp} CP
                  </span>
                  {nextSpec ? (
                    <button
                      type="button"
                      className={`hud-btn hq-upgrade-btn ${canUpgradeHq ? 'ready' : 'locked'}`}
                      onClick={() => gameRef.current?.upgradeHq()}
                      title={`${nextSpec.name}: ${nextSpec.unlocks}`}
                    >
                      +QG NV.{lvl + 1} ({nextSpec.supplyCost}S/{nextSpec.fuelCost}C • {nextSpec.requiredCp}CP)
                    </button>
                  ) : (
                    <span className="hq-max-badge">
                      <IconShield size={12} /> NÍVEL MÁX.
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="resources-bar">
              <div className="res-pill sup" title="Suprimentos Militares">
                <span>
                  <IconSupply size={13} /> {hud.supplies} SUP
                </span>
                <small>+{hud.supplyIncome}</small>
              </div>
              <div className="res-pill ammo" title="Munição Tática (Tropas de Elite e Suporte Aéreo)">
                <span>
                  <IconAmmo size={13} /> {hud.ammo} MUN
                </span>
                <small>+{hud.ammoIncome}</small>
              </div>
              <div
                className="res-pill fuel"
                title="Combustível Militar (Prédios de Base e Blindados Pesados)"
              >
                <span>
                  <IconFuel size={13} /> {hud.fuel} COMB
                </span>
                <small>+{hud.fuelIncome}</small>
              </div>
            </div>

            {/* ATALHO DE PRÉDIOS DA BASE 3D (Clicar seleciona o prédio no mundo 3D e abre seu Menu de Produção) */}
            {hud.alliedBaseBuildings && hud.alliedBaseBuildings.length > 0 && (
              <div className="allied-buildings-strip">
                {hud.alliedBaseBuildings.map((b) => {
                  const isSel = selectedBld && selectedBld.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`bstrip-btn ${isSel ? 'active' : ''}`}
                      onClick={() => gameRef.current?.selectBaseBuilding(b.id)}
                      title={`Selecionar ${b.name} no mapa 3D (${b.hp}/${b.maxHp} HP)`}
                    >
                      <span>
                        <IconBuilding size={12} /> {b.short}
                      </span>
                      {b.queueLength > 0 && (
                        <small className="bstrip-prog">
                          {b.progress}% ({b.queueLength})
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* BARRA DE ACESSO RÁPIDO (CONSTRUÇÕES & COMANDO AÉREO) */}
        {!editorDrawerOpen && (
          <div className="left-quick-bar">
            <button
              type="button"
              className={`quick-access-btn ${baseDrawerOpen ? 'active' : ''}`}
              onClick={() => {
                setBaseDrawerOpen((v) => {
                  const next = !v;
                  if (next) setAirDrawerOpen(false);
                  return next;
                });
              }}
              title="Abrir / Fechar Menu de Construções da Base (Atalho B)"
            >
              <span>
                <IconBuilding size={13} /> CONSTRUÇÕES DA BASE
              </span>
              <small>[B] ({Math.max(0, builtSet.size - 1)}/5)</small>
            </button>

            <button
              type="button"
              className={`quick-access-btn ${
                hasAirCommand ? (airDrawerOpen ? 'air-active active' : 'air-active') : 'air-locked'
              }`}
              onMouseEnter={() => {
                if (!hasAirCommand) setAirLockNotice(true);
              }}
              onMouseLeave={() => setAirLockNotice(false)}
              onClick={() => {
                if (!hasAirCommand) {
                  setAirLockNotice(true);
                  gameRef.current?.notify(
                    'COMANDO AÉREO BLOQUEADO',
                    'Construa o Comando Aéreo / Radar no Menu de Construções para desbloquear os ataques aéreos!',
                    '#fbbf24'
                  );
                  return;
                }
                setAirDrawerOpen((v) => {
                  const next = !v;
                  if (next) setBaseDrawerOpen(false);
                  return next;
                });
              }}
              title={
                hasAirCommand
                  ? 'Abrir Painel Exclusivo de Ataques Aéreos (Atalho V)'
                  : 'Construa o Comando Aéreo / Radar no Menu de Construções para desbloquear os ataques aéreos!'
              }
            >
              <span>
                {hasAirCommand ? <IconAir size={13} /> : <IconLock size={13} />}{' '}
                {hasAirCommand ? 'COMANDO AÉREO (ATIVO)' : 'COMANDO AÉREO (Requer Radar)'}
              </span>
              <small>[V]</small>
            </button>

            {isLocalHost && (
              <button
                type="button"
                className="quick-access-btn"
                style={{ borderColor: '#84cc16', color: '#d9f99d' }}
                onClick={() => {
                  setBaseDrawerOpen(false);
                  setAirDrawerOpen(false);
                  setEditorCollapsed(false);
                  setEditorDrawerOpen(true);
                  gameRef.current?.setMapEditorOpen(true, editorTool, editorAngleDeg, editorScale);
                }}
                title="Editor de Mapa 3D Local (Oculta HUD do jogo, pausa partida, libera Zoom amplo e salva em customMaps.json)"
              >
                <span>
                  <IconWrench size={13} /> EDITOR DE MAPA (LOCAL)
                </span>
                <small>PAUSA + ZOOM</small>
              </button>
            )}
          </div>
        )}

        {isLocalHost && editorDrawerOpen && (() => {
          const activeToolId = hud.mapEditorTool !== undefined ? hud.mapEditorTool : editorTool;
          const activeAngle =
            typeof hud.mapEditorAngleDeg === 'number' ? hud.mapEditorAngleDeg : editorAngleDeg;
          const activeScale =
            typeof hud.mapEditorScale === 'number' ? hud.mapEditorScale : editorScale;

          const EDITOR_CATALOG = {
            buildings: [
              { id: 'farmhouse', icon: '🏠', title: 'Casa Rural Europeia' },
              { id: 'two_story', icon: '🏢', title: 'Sobrado Urbano (2 And.)' },
              { id: 'barn', icon: '🏚️', title: 'Celeiro + Silo' },
              { id: 'warehouse', icon: '🏭', title: 'Galpão Industrial' },
              { id: 'brick_ruin', icon: '🧱', title: 'Ruína de Tijolo' },
              { id: 'bunker', icon: '🛡️', title: 'Bunker de Concreto' },
              { id: 'adobe_house', icon: '🕌', title: 'Casa Adobe (Deserto)' },
              { id: 'wreck_tank', icon: '💥', title: 'Carcaça de Tanque' },
              { id: 'wreck_truck', icon: '🚛', title: 'Caminhão Queimado' },
            ],
            walls: [
              { id: 'fortified_wall', icon: '🏰', title: 'Muralha Fortificada de Concreto' },
              { id: 'brick_wall', icon: '🧱', title: 'Muro de Tijolo / Alvenaria' },
              { id: 'stone_wall', icon: '🧱', title: 'Muro de Pedra Rural' },
              { id: 'trench_line', icon: '⛏️', title: 'Trincheira Conectável' },
              { id: 'sandbag_line', icon: '🛡️', title: 'Sacos de Areia' },
              { id: 'tank_trap_line', icon: '✖️', title: 'Ouriços Antitanque' },
            ],
            nature: [
              { id: 'forest_area', icon: '🌲', title: 'Área de Floresta (Arrastar Raio)' },
              { id: 'tree_pine', icon: '🌲', title: 'Pinheiro / Conífera 3D' },
              { id: 'tree_oak', icon: '🌳', title: 'Carvalho Copa Larga' },
              { id: 'tree_burnt', icon: '🪵', title: 'Árvores Queimadas' },
              { id: 'bush', icon: '🌿', title: 'Arbustos / Cerca Viva' },
              { id: 'crater_rock', icon: '🪨', title: 'Rochas / Crateras' },
            ],
          };

          const allItems = [
            ...EDITOR_CATALOG.buildings,
            ...EDITOR_CATALOG.walls,
            ...EDITOR_CATALOG.nature,
            { id: 'select_move', icon: '✋', title: 'Mover / Girar Objeto' },
            { id: 'move_sector', icon: '🚩', title: 'Mover Bandeira (Setor)' },
            { id: 'eraser', icon: '🗑️', title: 'Borracha (Apagar Objeto)' },
            { id: 'eraser_area', icon: '🧹', title: 'Limpar Área (15m)' },
          ];
          const activeObjMeta = allItems.find((i) => i.id === activeToolId);
          const activeLabel = activeObjMeta ? activeObjMeta.title : 'Nenhum (Navegação)';

          const selectTool = (toolId) => {
            setEditorTool(toolId);
            gameRef.current?.setMapEditorTool(toolId, activeAngle, activeScale);
          };

          const rotateBy = (delta) => {
            const next = gameRef.current?.rotateMapEditorAngle(delta);
            if (typeof next === 'number') setEditorAngleDeg(next);
            else {
              const fallback = (((activeAngle + delta) % 360) + 360) % 360;
              setEditorAngleDeg(fallback);
              gameRef.current?.setMapEditorTool(activeToolId, fallback, activeScale);
            }
          };

          return (
            <div className={`mil-editor-dock ${editorCollapsed ? 'collapsed' : ''}`}>
              {/* 1. CABEÇALHO COMPACTO & BOTÃO RECOLHER (1 LINHA LIMPA) */}
              <div className="mil-editor-topbar">
                <button
                  type="button"
                  className="mil-ed-topbtn exit"
                  onClick={() => {
                    setEditorDrawerOpen(false);
                    setEditorCollapsed(false);
                    gameRef.current?.setMapEditorOpen(false);
                  }}
                  title="Sair do Editor de Mapa e retomar a partida"
                >
                  ✕ SAIR DO EDITOR
                </button>

                <button
                  type="button"
                  className="mil-ed-topbtn save"
                  onClick={() => gameRef.current?.saveCustomMapForDeploy()}
                  title="Gravar layout em src/game/data/customMaps.json para subir no deploy"
                >
                  💾 SALVAR MAPA
                </button>

                <button
                  type="button"
                  className="mil-ed-topbtn collapse"
                  onClick={() => setEditorCollapsed((v) => !v)}
                  title={
                    editorCollapsed
                      ? 'Expandir painel do Editor de Mapa'
                      : 'Recolher menu lateral para ver o mapa em tela cheia enquanto posiciona itens'
                  }
                >
                  {editorCollapsed ? '▶ Expandir Menu' : '◀ Recolher Menu'}
                </button>
              </div>

              {/* BARRA DE CÂMERA EM 1 LINHA (34PX DE ALTURA) */}
              <div className="mil-editor-cambar">
                <button
                  type="button"
                  className="mil-ed-cambtn"
                  onClick={() => gameRef.current?.adjustEditorZoom(-280)}
                  title="Aproximar câmera (Zoom In)"
                >
                  🔍+
                </button>
                <button
                  type="button"
                  className="mil-ed-cambtn"
                  onClick={() => gameRef.current?.adjustEditorZoom(340)}
                  title="Afastar câmera (Zoom Out)"
                >
                  🔍-
                </button>
                <button
                  type="button"
                  className="mil-ed-cambtn overview"
                  onClick={() => gameRef.current?.setEditorOverviewZoom()}
                  title="Visão panorâmica de todo o campo de batalha"
                >
                  🌐 Visão Geral
                </button>
              </div>

              {!editorCollapsed && (
                <>
                  {/* 2. BARRA FIXA DE TRANSFORMAÇÃO DO OBJETO (ROTAÇÃO, ESCALA & BORRACHA) */}
                  <div className="mil-editor-transform-box">
                    <div className="mil-ed-tf-row">
                      <span className="mil-ed-tf-label">ROTAÇÃO:</span>
                      <div className="mil-ed-tf-controls">
                        <button
                          type="button"
                          className="mil-ed-mini-btn"
                          onClick={() => rotateBy(-45)}
                          title="Girar -45°"
                        >
                          ↺ -45°
                        </button>
                        <span className="mil-ed-angle-badge">{activeAngle}°</span>
                        <button
                          type="button"
                          className="mil-ed-mini-btn"
                          onClick={() => rotateBy(45)}
                          title="Girar +45° (Atalho: Tecla R)"
                        >
                          ↻ +45° (Tecla R)
                        </button>
                      </div>
                    </div>

                    <div className="mil-ed-tf-row">
                      <span className="mil-ed-tf-label">ESCALA:</span>
                      <div className="mil-ed-tf-controls">
                        {[
                          { val: 0.8, label: '0.8x' },
                          { val: 1.0, label: '1x' },
                          { val: 1.25, label: '1.25x' },
                          { val: 1.5, label: '1.5x' },
                        ].map((sc) => (
                          <button
                            key={sc.val}
                            type="button"
                            className={`mil-ed-mini-btn ${
                              Math.abs(activeScale - sc.val) < 0.05 ? 'active' : ''
                            }`}
                            onClick={() => {
                              setEditorScale(sc.val);
                              gameRef.current?.setMapEditorTool(activeToolId, activeAngle, sc.val);
                            }}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mil-ed-eraser-row">
                      <button
                        type="button"
                        className={`mil-ed-moveobj-btn ${
                          activeToolId === 'select_move' ? 'active' : ''
                        }`}
                        onClick={() => selectTool('select_move')}
                        title="Clicar e arrastar qualquer casa, muro, árvore ou carcaça já colocada para mover ou girar"
                      >
                        ✋ Mover / Girar
                      </button>
                      <button
                        type="button"
                        className={`mil-ed-eraser-btn ${activeToolId === 'eraser' ? 'active' : ''}`}
                        onClick={() => selectTool('eraser')}
                        title="Excluir casa, muro, árvore, trincheira ou carcaça clicada no mapa"
                      >
                        🗑️ Apagar
                      </button>
                      <button
                        type="button"
                        className={`mil-ed-eraser-btn area ${
                          activeToolId === 'eraser_area' ? 'active' : ''
                        }`}
                        onClick={() => selectTool('eraser_area')}
                        title="Limpar todos os itens num raio de 15m do clique"
                      >
                        🧹 Área
                      </button>
                    </div>
                  </div>

                  {/* 3. NAVEGAÇÃO POR 4 ABAS LIMPAS (SEM LISTA INFINITA) */}
                  <div className="mil-editor-tabs">
                    {[
                      { id: 'buildings', label: '🏠 PRÉDIOS' },
                      { id: 'walls', label: '🧱 MUROS & DEFESAS' },
                      { id: 'nature', label: '🌲 NATUREZA' },
                      { id: 'sectors', label: '🚩 SETORES' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`mil-ed-tab ${editorTab === t.id ? 'active' : ''}`}
                        onClick={() => {
                          setEditorTab(t.id);
                          if (t.id === 'sectors') {
                            selectTool('move_sector');
                          }
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* CONTEÚDO DA ABA ATIVA (GRADE COMPACTA DE 2 COLUNAS COM SCROLLBAR GRAFITE 4PX) */}
                  <div className="mil-editor-body">
                    {editorTab !== 'sectors' ? (
                      <div className="mil-editor-grid-2col">
                        {(EDITOR_CATALOG[editorTab] || []).map((item) => {
                          const isSelected = activeToolId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`mil-ed-card ${isSelected ? 'active' : ''}`}
                              onClick={() => selectTool(item.id)}
                            >
                              <span className="mil-ed-card-icon">{item.icon}</span>
                              <span className="mil-ed-card-title">{item.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mil-editor-sectors-pane">
                        <button
                          type="button"
                          className={`mil-ed-move-flag-btn ${
                            activeToolId === 'move_sector' ? 'active' : ''
                          }`}
                          onClick={() => selectTool('move_sector')}
                        >
                          🚩 Mover Bandeira Selecionada (Clique ou Arraste no Mapa 3D)
                        </button>

                        <div className="mil-editor-grid-2col">
                          {(hud.sectors || []).map((sec, idx) => {
                            const isSel =
                              activeToolId === 'move_sector' &&
                              hud.selectedEditorSectorId === sec.id;
                            return (
                              <button
                                key={sec.id}
                                type="button"
                                className={`mil-ed-card sector-card ${isSel ? 'active' : ''}`}
                                onClick={() => {
                                  setEditorTool('move_sector');
                                  gameRef.current?.selectEditorSector(sec.id);
                                }}
                                title={`Centralizar em ${sec.name} e selecionar para mover`}
                              >
                                <span className="mil-ed-card-icon">🚩</span>
                                <span className="mil-ed-card-title">
                                  S{idx + 1} — {sec.shortName || sec.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          className="mil-ed-reset-btn"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Restaurar o mapa atual para o layout original de fábrica?'
                              )
                            ) {
                              gameRef.current?.resetCustomMapToDefault();
                            }
                          }}
                        >
                          🔄 Restaurar Mapa Original de Fábrica
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 4. ETIQUETA FIXA NO RODAPÉ COM FEEDBACK DO OBJETO ATIVO */}
              <div className="mil-editor-footer-tag">
                {hud.selectedEditorObject ? (
                  <span>
                    Selecionado: <strong>{hud.selectedEditorObject.label}</strong> (
                    {hud.selectedEditorObject.angleDeg}°) • <strong>Arraste</strong> p/ Mover |{' '}
                    <kbd>[Botão Dir. + Arrastar]</kbd> ou <kbd>[R]</kbd> Girar
                  </span>
                ) : (
                  <span>
                    Ativo: <strong>{activeLabel}</strong> • Clique no mapa para colocar |{' '}
                    <kbd>[R]</kbd> Girar | <kbd>[Botão Dir.]</kbd> Cancelar
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {!hasAirCommand && airLockNotice && (
          <div className="air-lock-warning">
            Construa o <strong>Comando Aéreo / Radar</strong> no Menu de Construções para desbloquear os ataques aéreos!
          </div>
        )}

        {/* MENU DE CONSTRUÇÕES DA BASE (ABERTO AO CLICAR EM CONSTRUÇÕES DA BASE) */}
        {baseDrawerOpen && (
          <div className="base-command-card">
            <div className="drawer-header-bar">
              <span>🏗️ CONSTRUÇÕES DA BASE</span>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setBaseDrawerOpen(false)}
                title="Fechar painel (ESC)"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="base-tabs">
              <button
                type="button"
                className={`base-tab-btn ${activeBaseTab === 'command' ? 'active' : ''}`}
                onClick={() => setActiveBaseTab('command')}
              >
                🏢 COMANDO
              </button>
              <button
                type="button"
                className={`base-tab-btn ${activeBaseTab === 'defenses' ? 'active' : ''}`}
                onClick={() => setActiveBaseTab('defenses')}
              >
                🧱 DEFESAS
              </button>
              <button
                type="button"
                className={`base-tab-btn ${activeBaseTab === 'logistics' ? 'active' : ''}`}
                onClick={() => setActiveBaseTab('logistics')}
              >
                ⚡ LOGÍSTICA
              </button>
            </div>

            {activeBaseTab === 'command' && (
              <div className="base-grid">
                {/* QUARTEL-GENERAL: EVOLUÇÃO NÍVEL 1 -> 2 -> 3 */}
                <div className="hq-progress-card">
                  <div className="hq-progress-top">
                    <strong>🏛️ Quartel-General (QG Nv. {hud.hqLevel || 1}/3)</strong>
                    <span>{Math.round(((hud.hqLevel || 1) / 3) * 100)}%</span>
                  </div>
                  <div className="hq-progress-track">
                    <div
                      className="hq-progress-fill"
                      style={{ width: `${((hud.hqLevel || 1) / 3) * 100}%` }}
                    />
                  </div>
                  <div className="hq-unlock-list">
                    <div className={(hud.hqLevel || 1) >= 1 ? 'done' : ''}>
                      Nv. 1: Infantaria Básica, Transporte, Trincheiras e Muros
                    </div>
                    <div className={(hud.hqLevel || 1) >= 2 ? 'done' : ''}>
                      Nv. 2: Snipers, Antitanque, Humvee, APC Stryker e Bunkers
                    </div>
                    <div className={(hud.hqLevel || 1) >= 3 ? 'done' : ''}>
                      Nv. 3: Tanque MBT 120mm, Artilharia e Ataques Aéreos
                    </div>
                  </div>
                  {(hud.hqLevel || 1) < 3 && HQ_UPGRADES[(hud.hqLevel || 1) + 1] && (
                    <button
                      type="button"
                      className="base-item-btn hq-up-btn"
                      onClick={() => gameRef.current?.upgradeHq()}
                    >
                      <div className="base-item-top">
                        <strong>⬆ Evoluir para QG Nível {(hud.hqLevel || 1) + 1}</strong>
                        <span>
                          {HQ_UPGRADES[(hud.hqLevel || 1) + 1].supplyCost} SUP •{' '}
                          {HQ_UPGRADES[(hud.hqLevel || 1) + 1].fuelCost} COMB
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                {BASE_BUILDINGS.map((b) => {
                  const isBuilt = builtSet.has(b.id);
                  const canAfford = hud.supplies >= b.cost && hud.fuel >= (b.fuelCost || 0);
                  const customDesc =
                    b.id === 'spec_ops_center'
                      ? 'Libera Snipers, Equipe Antitanque e Paraquedistas.'
                      : b.id === 'motor_pool'
                      ? 'Libera Caminhão, Humvee, APC Stryker e Tanque MBT.'
                      : b.id === 'air_command'
                      ? 'Revela radar no minimapa e DESBLOQUEIA o Menu de Ataques Aéreos.'
                      : b.id === 'pow_camp'
                      ? 'Permite escoltar e interrogar Comandantes rendidos.'
                      : b.subtitle;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`base-item-btn ${isBuilt ? 'built' : ''} ${
                        !canAfford && !isBuilt ? 'locked' : ''
                      }`}
                      onClick={() => gameRef.current?.constructBaseBuilding(b.id)}
                      title={`${b.name} — ${customDesc}`}
                    >
                      <div className="base-item-top">
                        <strong>{b.short}</strong>
                        <span>
                          {isBuilt ? '✓ OPERACIONAL' : `${b.cost} SUP • ${b.fuelCost} COMB`}
                        </span>
                      </div>
                      <div className="base-item-sub">{customDesc}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeBaseTab === 'defenses' && (
              <div className="base-grid">
                {['build_wall', 'build_bunker', 'build_trench', 'build_watchtower', 'build_wire', 'build_barricade'].map(
                  (id) => {
                    const cmd = COMMAND_BY_ID[id];
                    if (!cmd) return null;
                    const canAfford =
                      hud.supplies >= (cmd.cost || 0) &&
                      hud.ammo >= (cmd.ammoCost || 0) &&
                      hud.fuel >= (cmd.fuelCost || 0);
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        className={`base-item-btn ${!canAfford ? 'locked' : ''}`}
                        onClick={() => gameRef.current?.triggerActionById(cmd.id)}
                      >
                        <div className="base-item-top">
                          <strong>{cmd.short || cmd.name}</strong>
                          <span>
                            {cmd.cost || 0} SUP{cmd.ammoCost ? ` • ${cmd.ammoCost} MUN` : ''}
                          </span>
                        </div>
                        <div className="base-item-sub">{cmd.subtitle}</div>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {activeBaseTab === 'logistics' && (
              <div className="base-grid">
                {['build_outpost', 'build_emplacement'].map((id) => {
                  const cmd = COMMAND_BY_ID[id];
                  if (!cmd) return null;
                  const canAfford =
                    hud.supplies >= (cmd.cost || 0) &&
                    hud.ammo >= (cmd.ammoCost || 0) &&
                    hud.fuel >= (cmd.fuelCost || 0);
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      className={`base-item-btn ${!canAfford ? 'locked' : ''}`}
                      onClick={() => gameRef.current?.triggerActionById(cmd.id)}
                    >
                      <div className="base-item-top">
                        <strong>{cmd.short || cmd.name}</strong>
                        <span>
                          {cmd.cost || 0} SUP{cmd.fuelCost ? ` • ${cmd.fuelCost} COMB` : ''}
                        </span>
                      </div>
                      <div className="base-item-sub">{cmd.subtitle}</div>
                    </button>
                  );
                })}
                <div className="base-req-warn">
                  💡 Capture <strong>Setores de Suprimento, Munição e Combustível</strong> no mapa ou construa o <strong>Campo de Prisioneiros</strong> (+5 SUP/s por cela) para expandir sua economia de guerra.
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAINEL EXCLUSIVO DE ATAQUES AÉREOS (SÓ ABRE APÓS CONSTRUIR O COMANDO AÉREO / RADAR) */}
        {hasAirCommand && airDrawerOpen && (
          <div className="air-doctrine-card">
            <div className="drawer-header-bar">
              <span style={{ color: '#38bdf8' }}>✈️ COMANDO AÉREO & RADAR</span>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setAirDrawerOpen(false)}
                title="Fechar painel aéreo (ESC)"
              >
                ✕ Fechar
              </button>
            </div>
            <div className="air-doctrine-list">
              {AIR_DOCTRINES.map((doc) => {
                const cd = hud.airCooldowns?.[doc.id] || 0;
                const maxCd = doc.cooldown || 30;
                const readyPct = cd > 0 ? Math.max(0, Math.min(100, ((maxCd - cd) / maxCd) * 100)) : 100;
                const isTargeting = hud.activeAirStrikeMode === doc.id;
                const canUse =
                  cd <= 0 &&
                  hud.supplies >= (doc.cost || 0) &&
                  hud.ammo >= (doc.ammoCost || 0);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    className={`air-btn ${isTargeting ? 'active' : ''} ${!canUse ? 'locked' : ''}`}
                    onClick={() => gameRef.current?.triggerAirDoctrine(doc.id)}
                    title={`${doc.name} — ${doc.subtitle}`}
                  >
                    <div className="air-btn-top">
                      <strong>
                        [{doc.key}] {doc.short}
                      </strong>
                      <span>
                        {cd > 0 ? `⏳ ${Math.ceil(cd)}s` : `${doc.cost} SUP • ${doc.ammoCost} MUN`}
                      </span>
                    </div>
                    <div className="air-btn-sub">{doc.subtitle}</div>
                    <div className="air-cooldown-track">
                      <div
                        className={`air-cooldown-fill ${cd > 0 ? 'recharging' : 'ready'}`}
                        style={{ width: `${readyPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </HudPanel>

      {/* BASE CENTRO: Barra Inferior Separada por 4 Categorias/Abas + Botão TODOS (Oculta quando Editor de Mapa está aberto) */}
      {!editorDrawerOpen && (
      <HudPanel id="hotbar" className="hud-bottom-center" layoutApi={layoutApi}>
        <div className="bottom-command-deck">
          {/* ABAS TÁTICAS DA BARRA INFERIOR ([F1] a [F5]) */}
          <div className="bottom-cat-tabs">
            {BOTTOM_BAR_CATEGORIES.map((cat) => {
              const tabLabel = cat.label || cat.title;
              const tabKey = cat.hotkey || cat.key;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`bottom-cat-tab ${activeBottomCat === cat.id ? 'active' : ''}`}
                  onClick={() => gameRef.current?.setBottomCategory(cat.id)}
                  title={`Categoria ${tabLabel} (${tabKey})`}
                >
                  <span className="cat-tab-icon">
                    <GameCategoryIcon catId={cat.id} size={13} />
                  </span>
                  <span className="cat-tab-label">{tabLabel}</span>
                  <small className="cat-tab-key">[{tabKey}]</small>
                </button>
              );
            })}
            <button
              type="button"
              className={`bottom-cat-tab all-tab ${activeBottomCat === 'all' ? 'active' : ''}`}
              onClick={() => gameRef.current?.setBottomCategory('all')}
              title="Exibir todos os grupos empilhados ([F5])"
            >
              <span className="cat-tab-icon">
                <GameCategoryIcon catId="all" size={13} />
              </span>
              <span className="cat-tab-label">TODOS</span>
              <small className="cat-tab-key">[F5]</small>
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS: VISÃO DE CATEGORIA ÚNICA OU VISÃO "TODOS" SEPARADA POR CAIXAS */}
          {activeBottomCat === 'all' ? (
            <div className="bottom-all-groups">
              {BOTTOM_BAR_CATEGORIES.map((cat) => (
                <div key={cat.id} className="bottom-cat-group-box">
                  <div className="bottom-cat-group-title">
                    <span>
                      {cat.icon} {cat.shortLabel || cat.label || cat.title}
                    </span>
                    <small>[{cat.hotkey || cat.key}]</small>
                  </div>
                  <div className="bottom-cat-group-slots">
                    {cat.actionIds.map((actId, idx) => renderActionSlot(actId, idx, true))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="hotbar rts-hotbar categorized-hotbar">
              {(
                BOTTOM_BAR_CATEGORIES.find((c) => c.id === activeBottomCat) ||
                BOTTOM_BAR_CATEGORIES[0]
              ).actionIds.map((actId, idx) => renderActionSlot(actId, idx, false))}
            </div>
          )}

          {/* Batalhões Especiais Desbloqueados por XP da Conta (incluindo Lançar Paraquedistas) */}
          {(() => {
            const unlockedSet = new Set(hud.unlockedBattalions || []);
            const available = BATTALION_UNLOCKS.filter(
              (b) => hud.sandboxMode || unlockedSet.has(b.id)
            );
            if (available.length === 0) return null;
            return (
              <div className="account-battalions-strip">
                {available.map((b) =>
                  b.isSpecialDrop ? (
                    <button
                      key={b.id}
                      type="button"
                      className={`hud-btn ${hud.activeCommandMode === 'paradrop' ? 'active' : ''}`}
                      onClick={() => gameRef.current?.activateParatrooperDrop()}
                      title={b.desc}
                    >
                      <IconParachute size={13} /> Lançar Paraquedistas
                      {hud.paradropCooldown > 0 ? ` (${hud.paradropCooldown}s)` : ` (${b.costSup} SUP)`}
                    </button>
                  ) : (
                    <button
                      key={b.id}
                      type="button"
                      className="hud-btn"
                      onClick={() =>
                        gameRef.current?.deployUnlockedBattalion(b.id, b.unitType, b.costSup)
                      }
                      title={b.desc}
                    >
                      <IconShield size={13} /> {b.name.split('(')[0].trim()} ({b.costSup} SUP)
                    </button>
                  )
                )}
              </div>
            );
          })()}
        </div>
      </HudPanel>
      )}

      {/* BASE DIREITA: Exibida apenas quando houver Tropa ou Prédio da Base selecionado (Oculta quando Editor de Mapa está aberto) */}
      {!editorDrawerOpen && (selectedBld || hud.selectedCount > 0) && (
      <HudPanel id="squad" className="hud-bottom-right rts-selection-panel" layoutApi={layoutApi}>
        {selectedBld && hud.selectedCount === 0 ? (
          <div className="building-prod-panel">
            <div className="selection-header">
              <span>🏭 {selectedBld.name.toUpperCase()}</span>
              <strong>
                {selectedBld.hp}/{selectedBld.maxHp} HP
              </strong>
            </div>

            <div className="stat-track" style={{ marginBottom: 8 }}>
              <div
                className="stat-fill hp"
                style={{ width: `${Math.round((selectedBld.hp / selectedBld.maxHp) * 100)}%` }}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="hud-btn"
                style={{ width: '100%' }}
                disabled={selectedBld.hp >= selectedBld.maxHp}
                onClick={() => gameRef.current?.repairSelectedWallOrBuilding()}
              >
                🔧 Reparar Estrutura ({hud.sandboxMode ? '0' : '60'} SUP)
              </button>
            </div>

            {/* Fila de Produção Visual 1 a 5 Slots + Barra de Progresso (Clique Direito cancela e reembolsa 100%) */}
            <div className="bprod-queue-box">
              <div className="bprod-progress-head">
                <span>
                  {selectedBld.productionQueue?.length > 0
                    ? `⚙ ${selectedBld.productionQueue[0].name}`
                    : '▪ Fila de Produção (Clique Dir. p/ cancelar)'}
                </span>
                <strong>
                  {selectedBld.productionQueue?.length > 0
                    ? `${selectedBld.productionProgress}% • ⏱ ${selectedBld.productionRemainingSec || 0}s`
                    : '0/5'}
                </strong>
              </div>
              <div className="stat-track">
                <div
                  className="stat-fill prod-fill"
                  style={{ width: `${selectedBld.productionProgress || 0}%` }}
                />
              </div>
              <div className="prod-slots-5">
                {[0, 1, 2, 3, 4].map((slotIdx) => {
                  const q = selectedBld.productionQueue?.[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className={`prod-slot-box ${q ? 'filled' : 'empty'} ${slotIdx === 0 && q ? 'active' : ''}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (q) gameRef.current?.cancelBuildingQueueItem(selectedBld.id, slotIdx);
                      }}
                      title={
                        q
                          ? `${q.name} (${q.remainingSec || 0}s) — Clique Direito para cancelar e reembolsar 100%`
                          : `Slot ${slotIdx + 1} livre`
                      }
                    >
                      <span className="prod-slot-num">{slotIdx + 1}</span>
                      <span className="prod-slot-name">{q ? q.short : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botões de Produção de Tropas / Tanques do Prédio */}
            {selectedBld.produces && selectedBld.produces.length > 0 ? (
              <div className="bprod-units-grid">
                {selectedBld.produces.map((unitId) => {
                  const uSpec = COMMAND_BY_ID[unitId];
                  if (!uSpec) return null;
                  const reqHq = uSpec.requiredHqLevel || 1;
                  const hqUnlocked = (hud.hqLevel || 1) >= reqHq;
                  const canAfford =
                    hqUnlocked &&
                    hud.supplies >= (uSpec.cost || 0) &&
                    hud.ammo >= (uSpec.ammoCost || 0) &&
                    hud.fuel >= (uSpec.fuelCost || 0);
                  return (
                    <button
                      key={unitId}
                      type="button"
                      className={`base-item-btn ${!canAfford ? 'locked' : ''}`}
                      onClick={() => gameRef.current?.queueUnitAtBuilding(selectedBld.id, unitId)}
                      title={`Produzir ${uSpec.name} (${uSpec.subtitle})`}
                    >
                      <div className="base-item-top">
                        <strong>▸ {uSpec.short}</strong>
                        <span>
                          {!hqUnlocked
                            ? `🔒 Req. QG Nv.${reqHq}`
                            : `${uSpec.cost} SUP${uSpec.ammoCost ? ` • ${uSpec.ammoCost} MUN` : ''}${uSpec.fuelCost ? ` • ${uSpec.fuelCost} COMB` : ''}${uSpec.buildTime ? ` • ⏱ ${Math.round(uSpec.buildTime)}s` : ''}`}
                        </span>
                      </div>
                      <div className="base-item-sub">
                        {uSpec.unitSpec?.isTransport
                          ? '[Transporte 12x] '
                          : uSpec.unitSpec?.antiArmorBonus
                            ? '[Anti-Blindado] '
                            : uSpec.unitSpec?.range >= 520
                              ? '[Alcance Longo] '
                              : ''}
                        {uSpec.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : selectedBld.buildingType === 'drone_factory' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <div
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>🛸 Hangar de Drones:</span>
                  <strong style={{ color: '#38bdf8' }}>
                    {(hud.droneStock?.uav_recon || 0) + (hud.droneStock?.fpv_kamikaze || 0)}/
                    {hud.maxDroneStock || 3} estoque • {hud.activeDronesCount || 0}/
                    {hud.maxActiveDrones || 2} ativos
                  </strong>
                </div>

                {[
                  {
                    id: 'uav_recon',
                    name: '🛸 Drone UAV Recon',
                    cost: '350 SUP • 120 MUN • 7s',
                    desc: 'Reconhecimento aéreo contínuo que revela névoa de guerra.',
                  },
                  {
                    id: 'fpv_kamikaze',
                    name: '💥 Drone Kamikaze FPV',
                    cost: '500 SUP • 200 MUN • 9s',
                    desc: 'Mergulho explosivo de alta penetração contra tanques e bases.',
                  },
                ].map((dr) => {
                  const researched = completedTechSet.has(dr.id);
                  const stockCount = hud.droneStock?.[dr.id] || 0;
                  return (
                    <div key={dr.id} className="base-item-btn" style={{ cursor: 'default' }}>
                      <div className="base-item-top">
                        <strong>{dr.name}</strong>
                        <span>{dr.cost}</span>
                      </div>
                      <div className="base-item-sub">{dr.desc}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          type="button"
                          className="mil-pill"
                          disabled={!researched || (hud.hqLevel || 1) < 3}
                          onClick={() => gameRef.current?.queueDroneProduction(dr.id)}
                        >
                          {researched && (hud.hqLevel || 1) >= 3
                            ? '🏭 Fabricar'
                            : '🔒 Req. QG Nv.3 + Pesquisa [T]'}
                        </button>
                        <button
                          type="button"
                          className={`mil-pill ${hud.activeDroneLaunchMode === dr.id ? 'active' : ''}`}
                          disabled={stockCount <= 0}
                          onClick={() => gameRef.current?.triggerDroneLaunchMode(dr.id)}
                        >
                          🚀 Lançar ({stockCount})
                        </button>
                      </div>
                    </div>
                  );
                })}
                {hud.droneQueue?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>
                    ⏳ Fabricando drone... {hud.droneQueue[0].remaining}s restantes
                  </div>
                )}
              </div>
            ) : selectedBld.buildingType === 'pow_camp' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <div
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>⛓️ Prisioneiros na Cela:</span>
                  <strong style={{ color: '#facc15' }}>
                    {hud.powPrisonersCount || 0}/{hud.powPrisonersMax || 10} (+{hud.powIncomePerSec || 0} SUP/s)
                  </strong>
                </div>
                <button
                  type="button"
                  className="base-item-btn"
                  style={{
                    borderColor: 'rgba(234, 179, 8, 0.7)',
                    background: 'rgba(161, 98, 7, 0.25)',
                  }}
                  onClick={() => gameRef.current?.openPowInterrogation()}
                >
                  <div className="base-item-top">
                    <strong>🕵️ ABRIR SALA DE INTERROGATÓRIO</strong>
                    <span>{hud.powPrisonersCount > 0 ? 'PRONTO' : 'CELA VAZIA'}</span>
                  </div>
                  <div className="base-item-sub">
                    Interrogue prisioneiros capturados para extrair mapas, comboios ou códigos.
                  </div>
                </button>
              </div>
            ) : (
              <div className="bprod-idle-hint">
                Esta instalação habilita o Suporte Aéreo ([Z], [X], [C]) no painel direito.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ABAS CLICÁVEIS DE MÚLTIPLAS UNIDADES SELECIONADAS */}
            {hud.selectedUnits.length > 1 && (
              <div className="multi-unit-tabs">
                {hud.selectedUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`multi-unit-tab ${leadSquad?.id === u.id ? 'active' : ''}`}
                    onClick={() => gameRef.current?.focusSelectedUnit(u.id)}
                    title={`Focar em ${u.short} (${u.hp}/${u.maxHp} HP)`}
                  >
                    <span>{u.short}</span>
                    <small>{Math.round((u.hp / Math.max(1, u.maxHp)) * 100)}%</small>
                  </button>
                ))}
              </div>
            )}
            {hud.selectedCount === 0 ? (
              <div className="selection-empty">
                Clique/Toque em Tropas para selecionar. Clique Direito ou Toque perto de Muros/Trincheiras para Encaixar em Cobertura (Cover Snap).
              </div>
            ) : (
              <>
                {/* STATUS DE COBERTURA FÍSICA / ENCAIXE EM MURO OU TRINCHEIRA */}
                {(hud.anySelectedSnappedToCover || hud.anySelectedCrouching) && (
                  <div className="cover-snap-status-banner">
                    <span>🛡 ENCAIXADO EM COBERTURA (POSTURA AGACHADA)</span>
                    <small>85%+ Bloqueio Frontal contra Tiros</small>
                  </div>
                )}

                {/* PAINEL EXCLUSIVO DE VEÍCULO VS CONTROLES DE INFANTARIA */}
                {leadSquad && !leadSquad.isInfantry ? (
                  <div className="vehicle-exclusive-box">
                    <div className="veh-stat-grid">
                      <div className="veh-stat-cell">
                        <span>BLINDAGEM</span>
                        <strong>{leadSquad.armorPct || 35}%</strong>
                      </div>
                      <div className="veh-stat-cell">
                        <span>ARMAMENTO</span>
                        <strong>
                          {leadSquad.weaponLabel === 'tank_cannon'
                            ? 'Canhão 120mm HE/AP'
                            : leadSquad.weaponLabel === 'autocannon'
                              ? 'Canhão 30mm'
                              : leadSquad.weaponLabel === 'rocket_pod'
                                ? 'Foguetes'
                                : 'Metralhadora .50'}
                        </strong>
                      </div>
                      {leadSquad.isTransport && (
                        <div className="veh-stat-cell">
                          <span>PASSAGEIROS</span>
                          <strong>
                            {leadSquad.cargoSoldiersCount || 0}/{leadSquad.maxCargoSoldiers || 12}
                          </strong>
                        </div>
                      )}
                    </div>
                    <div className="stance-toolbar" style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="stance-btn rtb-btn"
                        onClick={() => gameRef.current?.returnSelectedToBase()}
                      >
                        ▸ RETORNAR À BASE / REPARAR [B]
                      </button>
                      <button
                        type="button"
                        className={`stance-btn ${hud.selectedHoldPosition ? 'active hold-active' : ''}`}
                        onClick={() => gameRef.current?.toggleSelectedHoldPosition()}
                      >
                        {hud.selectedHoldPosition ? '▪ MODO ARTILHARIA / FIXO [H]' : '▸ FOGO LIVRE [H]'}
                      </button>
                      {leadSquad.isTransport && (leadSquad.cargoSquadsCount || 0) > 0 && (
                        <button
                          type="button"
                          className="stance-btn"
                          onClick={() => gameRef.current?.disembarkAllFromTransport(leadSquad.id)}
                        >
                          ▸ DESEMBARCAR ({leadSquad.cargoSoldiersCount}) [U]
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                {/* 1. BOTÕES DE FORMAÇÃO TÁTICA */}
                <div className="formation-toolbar">
                  {Object.values(SQUAD_FORMATIONS).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`formation-btn ${hud.selectedFormation === f.id ? 'active' : ''}`}
                      onClick={() => gameRef.current?.setSelectedFormation(f.id)}
                      title={`${f.name}: ${f.desc}`}
                    >
                      {f.short}
                    </button>
                  ))}
                </div>

                {/* 2. ESPAÇAMENTO TÁTICO COMPACTO EM 1 LINHA (SEM OCUPAR MEIA TELA) */}
                <div className="compact-spacing-bar">
                  <span className="compact-spacing-label">ESPAÇO:</span>
                  {SPACING_PRESETS.map((preset) => {
                    const isPresetActive =
                      Math.abs((hud.selectedSpacing || 3.0) - preset.meters) < 0.2;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`spacing-preset-btn ${isPresetActive ? 'active' : ''}`}
                        onClick={() => gameRef.current?.setSelectedSpacing(preset.meters)}
                        title={`${preset.label} (${preset.meters}m)`}
                      >
                        {preset.meters}m
                      </button>
                    );
                  })}
                </div>

                {/* 3. TRAVAR POSIÇÃO [H], RETORNAR À BASE [B/R] & DESOCUPAR GUARNIÇÃO [U] */}
                <div className="stance-toolbar">
                  <button
                    type="button"
                    className={`stance-btn ${hud.selectedHoldPosition ? 'active hold-active' : ''}`}
                    onClick={() => gameRef.current?.toggleSelectedHoldPosition()}
                    title="Travar Posição [H]: O esquadrão não sai da cobertura/trincheira para perseguir inimigos"
                  >
                    {hud.selectedHoldPosition ? <IconLock size={12} /> : <IconUnlock size={12} />}{' '}
                    {hud.selectedHoldPosition ? 'POSIÇÃO TRAVADA [H]' : 'TRAVAR POSIÇÃO [H]'}
                  </button>
                  {leadSquad && (
                    <button
                      type="button"
                      className="stance-btn rtb-btn"
                      onClick={() => gameRef.current?.returnSelectedToBase()}
                      title="Recuar rápido para o QG para se curar [Tecla R]"
                    >
                      RECUAR P/ QG [R]
                    </button>
                  )}
                  {hud.anySelectedGarrisoned && (
                    <button
                      type="button"
                      className="stance-btn ungarrison-btn"
                      onClick={() => gameRef.current?.ungarrisonSelected()}
                      title="Desocupar Casa/Prédio [U]"
                    >
                      SAIR DO PRÉDIO [U]
                    </button>
                  )}
                  {leadSquad && (leadSquad.unitType === 'engineers' || leadSquad.canBuild) && (
                    <button
                      type="button"
                      className="stance-btn"
                      style={{ borderColor: '#38bdf8', color: '#7dd3fc' }}
                      onClick={() => gameRef.current?.repairNearestVehicleForSelected()}
                      title="Enviar Engenheiros para consertar o veículo aliado danificado mais próximo"
                    >
                      <IconWrench size={12} /> Consertar Veículo
                    </button>
                  )}
                </div>
                  </>
                )}

                {/* HABILIDADES TÁTICAS & POSTURA DO ESQUADRÃO */}
                {leadSquad && leadSquad.isInfantry && (
                  <div className="squad-abilities-box">
                    <div className="squad-abilities-row">
                      {(() => {
                        const cdG = leadSquad.abilityCooldowns?.grenade || 0;
                        const cdF = leadSquad.abilityCooldowns?.suppression || 0;
                        const cdC = leadSquad.abilityCooldowns?.medkit || 0;
                        return (
                          <>
                            <button
                              type="button"
                              className={`ability-btn ${cdG > 0 ? 'on-cd' : ''}`}
                              onClick={() => gameRef.current?.throwSelectedGrenade()}
                              title="Lançar Granada Fragmentação [G] (15 MUN • Recarga 12s)"
                            >
                              <span>
                                <IconGrenade size={12} /> Granada [G]
                              </span>
                              <small>{cdG > 0 ? `${cdG}s` : '15 MUN'}</small>
                            </button>
                            <button
                              type="button"
                              className={`ability-btn ${leadSquad.suppressionMode ? 'active' : ''} ${cdF > 0 && !leadSquad.suppressionMode ? 'on-cd' : ''}`}
                              onClick={() => gameRef.current?.toggleSelectedSuppression()}
                              title="Fogo de Supressão [F] (2x Cadência • Pinned -70% vel. • 10 MUN • 15s)"
                            >
                              <span>
                                <IconFlame size={12} /> Supressão [F]
                              </span>
                              <small>{leadSquad.suppressionMode ? 'ATIVO' : cdF > 0 ? `${cdF}s` : '10 MUN'}</small>
                            </button>
                            <button
                              type="button"
                              className={`ability-btn ${leadSquad.medkitHealing ? 'active-heal' : ''} ${cdC > 0 && !leadSquad.medkitHealing ? 'on-cd' : ''}`}
                              onClick={() => gameRef.current?.useSelectedMedkit()}
                              title="Kit Médico [C] (+45 HP em 5s • 20 SUP • Recarga 20s)"
                            >
                              <span>
                                <IconMedkit size={12} /> Médico [C]
                              </span>
                              <small>{leadSquad.medkitHealing ? 'CURANDO' : cdC > 0 ? `${cdC}s` : '20 SUP'}</small>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* PAINEL DE CARGA DO VEÍCULO DE TRANSPORTE DE TROPAS */}
                {leadSquad && leadSquad.isTransport && (
                  <div className="transport-cargo-box">
                    <div className="transport-cargo-head">
                      <span>
                        🚛 TROPAS A BORDO: {leadSquad.cargoSquadsCount}/{leadSquad.maxCargoSquads}{' '}
                        ({leadSquad.cargoSoldiersCount}/{leadSquad.maxCargoSoldiers} Sold.)
                      </span>
                    </div>
                    {leadSquad.cargoNames && leadSquad.cargoNames.length > 0 ? (
                      <div className="transport-cargo-list">
                        {leadSquad.cargoNames.map((cn, idx) => (
                          <span key={idx} className="transport-cargo-pill">
                            🪖 {cn}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="transport-cargo-empty">
                        Selecione infantaria e clique neste veículo para embarcar.
                      </div>
                    )}
                    <button
                      type="button"
                      className="stance-btn ungarrison-btn"
                      style={{ width: '100%', marginTop: 6 }}
                      disabled={!leadSquad.cargoSquadsCount}
                      onClick={() => gameRef.current?.disembarkAllFromTransport(leadSquad.id)}
                      title="Abrir rampa traseira e desembarcar tropas em formação [Tecla U]"
                    >
                      🚪 DESEMBARCAR TROPAS [TECLA U]
                    </button>
                  </div>
                )}

                {/* 4. VIDA INDIVIDUAL POR SOLDADO (CARDS COM HP PRÓPRIO, ARMA E SELEÇÃO INDIVIDUAL) */}
                {leadSquad && leadSquad.isInfantry && leadSquad.soldiers ? (
                  <div className="individual-soldiers-section">
                    <div className="sel-unit-top" style={{ marginBottom: 5 }}>
                      <strong>
                        {leadSquad.short} ({leadSquad.soldiersAlive}/{leadSquad.maxSoldiers}{' '}
                        Soldados)
                      </strong>
                      <span>
                        {leadSquad.garrisonedBuildingId
                          ? '🏠 Guarnição (+75%)'
                          : leadSquad.camouflagedInForest
                            ? '🌲 CAMUFLADO NA MATA (+50% DEF • Furtivo)'
                            : leadSquad.inForestStealth
                              ? '🌲 NA MATA (+50% DEF • Revelado)'
                              : leadSquad.inTrench
                                ? '🛡 Trincheira (+65%)'
                                : leadSquad.inHeavyCover
                                  ? '🟢 Muro Pesado (+75%)'
                                  : leadSquad.inLightCover
                                    ? '🟡 Cobertura Leve (+40%)'
                                    : leadSquad.inTreelineCover
                                      ? '🌲 Árvores (+35%)'
                                      : `${leadSquad.hp}/${leadSquad.maxHp} HP Total`}
                      </span>
                    </div>

                    <div className="soldier-cards-grid">
                      {leadSquad.soldiers.map((s) => {
                        const hpPct = Math.max(0, Math.min(100, Math.round((s.hp / s.maxHp) * 100)));
                        const hpColorClass =
                          hpPct > 50 ? 'hp-green' : hpPct >= 25 ? 'hp-yellow' : 'hp-red';
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`soldier-card-btn ${s.selected ? 'selected' : ''}`}
                            onClick={(e) =>
                              gameRef.current?.toggleSelectSoldierInUnit(
                                leadSquad.id,
                                s.id,
                                e.ctrlKey
                              )
                            }
                            title={`Clique para selecionar/desmarcar ${s.name} (${s.weapon} • ${s.hp}/${s.maxHp} HP)`}
                          >
                            <div className="soldier-card-top">
                              <span className="soldier-name">
                                <svg className="mil-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  {s.selected ? (
                                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                                  ) : (
                                    <path d="M12 3a8 8 0 0 0-8 8v3h16v-3a8 8 0 0 0-8-8zm-9 13v2h18v-2H3z" />
                                  )}
                                </svg>
                                {s.name}
                              </span>
                              <span className="soldier-hp-num">
                                {s.hp}/{s.maxHp}
                              </span>
                            </div>
                            <div className="soldier-weapon-row">
                              <span>
                                <svg className="mil-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M2 10h14l2-2h4v3h-3l-2 2H9l-1 4H5l1-4H2v-3z" />
                                </svg>
                                {s.weapon}
                              </span>
                            </div>
                            <div className="soldier-hp-track">
                              <div
                                className={`soldier-hp-fill ${hpColorClass}`}
                                style={{ width: `${hpPct}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* 5. TRANSFERIR SOLDADOS ENTRE ESQUADRÕES E DESTACAR SOLDADO (ESTILO MEN OF WAR) */}
                    <div className="soldier-ops-toolbar">
                      <button
                        type="button"
                        className="soldier-op-btn split-btn"
                        disabled={leadSquad.soldiersAlive < 2}
                        onClick={() => gameRef.current?.splitSelectedSoldiers(leadSquad.id)}
                        title="Destacar 1 ou mais soldados selecionados como um novo Esquadrão Independente (Tecla K)"
                      >
                        ✂ Separar Soldado [K]
                        {selectedSoldierCount > 0 ? ` (${selectedSoldierCount})` : ' (1)'}
                      </button>

                      {hud.selectedCount >= 2 ? (
                        <button
                          type="button"
                          className="soldier-op-btn transfer-btn"
                          onClick={() => gameRef.current?.mergeSelectedSquads()}
                          title="Mesclar soldados dos esquadrões selecionados em um único esquadrão reforçado"
                        >
                          ⇄ Mesclar Esquadrões ({hud.selectedCount})
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`soldier-op-btn transfer-btn ${showTransferPicker ? 'active' : ''
                            }`}
                          disabled={
                            !hud.otherAlliedInfantrySquads ||
                            hud.otherAlliedInfantrySquads.length === 0
                          }
                          onClick={() => {
                            const others = hud.otherAlliedInfantrySquads || [];
                            if (others.length === 1) {
                              gameRef.current?.transferSoldiersToSquad(leadSquad.id, others[0].id);
                              setShowTransferPicker(false);
                            } else {
                              setShowTransferPicker((v) => !v);
                            }
                          }}
                          title="Transferir soldado(s) selecionado(s) para outro esquadrão aliado"
                        >
                          Transferir ➡️
                          {selectedSoldierCount > 0 ? ` (${selectedSoldierCount})` : ''}
                        </button>
                      )}
                    </div>

                    {showTransferPicker &&
                      hud.otherAlliedInfantrySquads &&
                      hud.otherAlliedInfantrySquads.length > 0 && (
                        <div className="transfer-target-picker">
                          <div className="transfer-picker-title">
                            Escolha o Esquadrão Destino para Reforçar:
                          </div>
                          <div className="transfer-picker-list">
                            {hud.otherAlliedInfantrySquads.map((targetSq) => (
                              <button
                                key={targetSq.id}
                                type="button"
                                className="transfer-target-btn"
                                onClick={() => {
                                  gameRef.current?.transferSoldiersToSquad(
                                    leadSquad.id,
                                    targetSq.id
                                  );
                                  setShowTransferPicker(false);
                                }}
                              >
                                <span>➡️ {targetSq.short}</span>
                                <small>
                                  {targetSq.soldiersAlive}/{targetSq.maxSoldiers} ef.
                                </small>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  /* Lista padrão quando veículos ou múltiplos grupos estão selecionados */
                  <div className="selection-list">
                    {hud.selectedUnits.slice(0, 4).map((u) => (
                      <div key={u.id} className="sel-unit-row">
                        <div className="sel-unit-top">
                          <strong>{u.short}</strong>
                          <span>
                            {u.hp}/{u.maxHp} HP
                          </span>
                        </div>
                        <div className="stat-track">
                          <div
                            className="stat-fill hp"
                            style={{
                              width: `${Math.round((u.hp / u.maxHp) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hud.selectedUnits.length > 1 && (
                  <div className="sel-more">
                    +{hud.selectedUnits.length - 1} outra(s) unidade(s) selecionada(s) no grupo
                  </div>
                )}
              </>
            )}
          </>
        )}
      </HudPanel>
      )}

      {/* BARRA SANDBOX COMPACTA E RECOLHÍVEL (Sem colidir com o topo direito ou avisos) */}
      {!editorDrawerOpen && isAdmin && hud.sandboxMode && (
        <div className="sandbox-floating-dock">
          <button
            type="button"
            className="hud-btn active"
            style={{ fontSize: 10.5, padding: '3px 8px' }}
            onClick={() => setSandboxCollapsed((v) => !v)}
          >
            <IconWrench size={12} /> SANDBOX {sandboxCollapsed ? '▸' : '▾'}
          </button>
          {!sandboxCollapsed && (
            <>
              {[
                { label: '+Fuzileiros', fac: 'player', id: 'rifle_squad' },
                { label: '+Assalto', fac: 'player', id: 'assault_squad' },
                { label: '+AT Bazuca', fac: 'player', id: 'at_javelin_squad' },
                { label: '+Snipers', fac: 'player', id: 'sniper_squad' },
                { label: '+Engenheiros', fac: 'player', id: 'engineer_squad' },
                { label: '+Humvee', fac: 'player', id: 'humvee' },
                { label: '+APC', fac: 'player', id: 'apc_stryker' },
                { label: '+Tanque MBT', fac: 'player', id: 'mbt_tank' },
                { label: '+Artilharia', fac: 'player', id: 'rocket_artillery' },
              ].map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  className="hud-btn"
                  style={{ fontSize: 10, padding: '3px 6px' }}
                  onClick={() => gameRef.current?.sandboxSpawnUnit(sp.fac, sp.id)}
                >
                  {sp.label}
                </button>
              ))}
              <button
                type="button"
                className="hud-btn"
                style={{ fontSize: 10, padding: '3px 6px', borderColor: '#7f1d1d' }}
                onClick={() => gameRef.current?.sandboxSpawnUnit('enemy_1', 'rifle_squad')}
              >
                +Inimigos
              </button>
              <button
                type="button"
                className="hud-btn"
                style={{ fontSize: 10, padding: '3px 6px', borderColor: '#7f1d1d' }}
                onClick={() => gameRef.current?.sandboxSpawnUnit('enemy_1', 'mbt_tank', { holdPosition: true })}
              >
                +Tanque Inim.
              </button>
              <button
                type="button"
                className={`hud-btn ${hud.sandboxFogDisabled ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '3px 6px' }}
                onClick={() => gameRef.current?.sandboxToggleFog()}
              >
                Névoa
              </button>
              <button
                type="button"
                className={`hud-btn ${hud.sandboxAiPaused ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '3px 6px' }}
                onClick={() => gameRef.current?.sandboxToggleAi()}
              >
                {hud.sandboxAiPaused ? 'IA Pausada' : 'IA Ativa'}
              </button>
              <button
                type="button"
                className="hud-btn"
                style={{ fontSize: 10, padding: '3px 6px' }}
                onClick={() => gameRef.current?.sandboxHealAll()}
              >
                Curar
              </button>
              <button
                type="button"
                className="hud-btn"
                style={{ fontSize: 10, padding: '3px 6px' }}
                onClick={() => gameRef.current?.sandboxDestroySelected()}
              >
                Destruir Sel.
              </button>
            </>
          )}
        </div>
      )}

      {systemMenuOpen && (
        <div className="sys-modal-backdrop" onClick={() => setSystemMenuOpen(false)}>
          <div className="sys-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sys-modal-header">
              <strong>⚙️ OPÇÕES DO SISTEMA</strong>
              <button type="button" className="hud-btn" onClick={() => setSystemMenuOpen(false)}>
                ✕ FECHAR
              </button>
            </div>

            <div className="sys-modal-section">
              <div className="sys-sec-title">💾 SALVAR / CARREGAR PARTIDA</div>
              <div className="sys-btn-row">
                <button
                  type="button"
                  className="hud-btn save-pill"
                  onClick={() => {
                    gameRef.current?.saveBattle();
                    setSystemMenuOpen(false);
                  }}
                >
                  💾 SALVAR BATALHA [F5/F9]
                </button>
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => {
                    setSystemMenuOpen(false);
                    if (onOpenSaves) onOpenSaves();
                    else onPause();
                  }}
                >
                  📂 CARREGAR ({hud.savedBattles?.length || 0})
                </button>
              </div>
            </div>

            <div className="sys-modal-section">
              <div className="sys-sec-title">🔊 ÁUDIO E MÚSICA</div>
              <div className="sys-slider-row">
                <span>Volume Geral ({Math.round((hud.settings?.volume ?? 0.35) * 100)}%)</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.settings?.volume ?? 0.35}
                  onChange={(e) =>
                    gameRef.current?.updateSettings({ volume: Number(e.target.value) })
                  }
                />
              </div>
              <div className="sys-btn-row">
                <button type="button" className="hud-btn" onClick={onToggleMute}>
                  {hud.muted ? '🔇 ÁUDIO: MUTADO [M]' : '🔊 ÁUDIO: ATIVO [M]'}
                </button>
              </div>
            </div>

            <div className="sys-modal-section">
              <div className="sys-sec-title">⏱ RITMO TÁTICO & MODO TOUCH</div>
              <div className="sys-btn-row" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={`hud-btn ${hud.timeScale === 0 ? 'active' : ''}`}
                  onClick={() => gameRef.current?.toggleTacticalPause()}
                >
                  ⏸ PAUSAR [ESPAÇO]
                </button>
                {[
                  { mult: 0.5, label: '0.5x LENTO' },
                  { mult: 1.0, label: '1.0x NORMAL' },
                  { mult: 1.5, label: '1.5x RÁPIDO' },
                ].map((sp) => (
                  <button
                    key={sp.label}
                    type="button"
                    className={`hud-btn ${hud.timeScale === sp.mult ? 'active' : ''}`}
                    onClick={() => setSpeed(sp.mult)}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
              <div className="sys-btn-row">
                <button
                  type="button"
                  className={`hud-btn ${(hud.touchControlMode || 'select') === 'select' ? 'active' : ''}`}
                  onClick={() => gameRef.current?.setTouchControlMode('select')}
                >
                  ▭ MODO SELEÇÃO
                </button>
                <button
                  type="button"
                  className={`hud-btn ${hud.touchControlMode === 'camera' ? 'active' : ''}`}
                  onClick={() => gameRef.current?.setTouchControlMode('camera')}
                >
                  ✋ MODO CÂMERA
                </button>
              </div>
            </div>

            <div className="sys-modal-section">
              <div className="sys-sec-title">🖥️ TELA E INTERFACE</div>
              <div className="sys-btn-row">
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen?.().catch(() => {});
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                    }
                  }}
                >
                  ⛶ TELA CHEIA
                </button>
                <button
                  type="button"
                  className={`hud-btn ${layoutApi.allPinned ? 'active' : ''}`}
                  onClick={() => layoutApi.setAllPinned(!layoutApi.allPinned)}
                >
                  {layoutApi.allPinned ? '🔓 SOLTAR MENUS' : '📌 FIXAR MENUS'}
                </button>
                <button type="button" className="hud-btn" onClick={() => layoutApi.resetAll()}>
                  ⟲ RESTAURAR LAYOUT
                </button>
                <button
                  type="button"
                  className={`hud-btn ${hud.touchControlMode === 'camera' ? 'active' : ''}`}
                  onClick={() =>
                    gameRef.current?.setTouchControlMode(
                      hud.touchControlMode === 'camera' ? 'select' : 'camera'
                    )
                  }
                >
                  {hud.touchControlMode === 'camera' ? '✋ MODO CÂMERA' : '🎯 MODO SELEÇÃO'}
                </button>
              </div>
            </div>

            <div className="sys-modal-section">
              <div className="sys-sec-title">🎮 GRÁFICOS E PERFORMANCE</div>
              <div className="sys-btn-row">
                {[
                  { label: '🌿 Vegetação Baixa', val: 0.35 },
                  { label: '🌿 Média', val: 0.7 },
                  { label: '🌲 Alta (100%)', val: 1.0 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    className={`hud-btn ${(hud.settings?.vegDensity ?? 1.0) === opt.val ? 'active' : ''}`}
                    onClick={() => gameRef.current?.updateSettings({ vegDensity: opt.val })}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`hud-btn ${hud.settings?.highQuality !== false ? 'active' : ''}`}
                  onClick={() =>
                    gameRef.current?.updateSettings({
                      highQuality: !(hud.settings?.highQuality !== false),
                    })
                  }
                >
                  {hud.settings?.highQuality !== false ? '☀ SOMBRAS: ON' : '☀ SOMBRAS: OFF'}
                </button>
              </div>
            </div>

            <div className="sys-modal-section">
              <button
                type="button"
                className="hud-btn sys-exit-btn"
                onClick={() => {
                  setSystemMenuOpen(false);
                  onPause();
                }}
              >
                🚪 PAUSAR / ABANDONAR OPERAÇÃO [ESC]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU INTERATIVO DA MURALHA / PORTÃO SELECIONADO */}
      {hud.selectedWall && (
        <div className="structure-context-menu">
          <div className="struct-ctx-head">
            <div>
              <strong>
                {hud.selectedWall.isGate ? '🚧 Portão Blindado Automático' : '🧱 Muralha Defensiva'}
              </strong>
              <small>
                Integridade: {hud.selectedWall.hp}/{hud.selectedWall.maxHp} HP
                {hud.selectedWall.reinforced ? ' • Blindada' : ''}
              </small>
            </div>
            <button
              type="button"
              className="hud-btn"
              onClick={() => {
                if (gameRef.current) {
                  gameRef.current.selectedWallId = null;
                  gameRef.current._emitHud();
                }
              }}
            >
              ✕
            </button>
          </div>
          <div className="struct-ctx-hpbar">
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (hud.selectedWall.hp / Math.max(1, hud.selectedWall.maxHp)) * 100)
                )}%`,
              }}
            />
          </div>
          <div className="struct-ctx-actions">
            <button
              type="button"
              className="hud-btn"
              disabled={hud.selectedWall.hp >= hud.selectedWall.maxHp}
              onClick={() => gameRef.current?.repairSelectedWallOrBuilding()}
            >
              🔧 Reparar Estrutura ({hud.sandboxMode ? '0' : '60'} SUP)
            </button>
            <button
              type="button"
              className="hud-btn active"
              onClick={() => gameRef.current?.convertSelectedWallToGate()}
            >
              {hud.selectedWall.isGate
                ? '🧱 Converter em Muro Fechado'
                : '🚧 Converter Trecho em Portão'}
            </button>
            <button
              type="button"
              className="hud-btn"
              disabled={hud.selectedWall.reinforced}
              onClick={() => gameRef.current?.reinforceSelectedWall()}
            >
              {hud.selectedWall.reinforced
                ? '✓ Muralha Reforçada (+50% HP)'
                : `⬆️ Reforçar Muralha (+50% HP • ${hud.sandboxMode ? '0' : '80'} SUP)`}
            </button>
          </div>
        </div>
      )}

      {/* MENU TÁTICO FLUTUANTE DA CONSTRUÇÃO SELECIONADA */}
      {hud.selectedStructure && (
        <div className="structure-context-menu">
          <div className="struct-ctx-head">
            <div>
              <strong>🏠 {hud.selectedStructure.name}</strong>
              <small>
                Integridade: {hud.selectedStructure.hp}/{hud.selectedStructure.maxHp} HP
              </small>
            </div>
            <button
              type="button"
              className="hud-btn"
              onClick={() => {
                if (gameRef.current) {
                  gameRef.current.selectedStructureId = null;
                  gameRef.current._emitHud();
                }
              }}
            >
              ✕
            </button>
          </div>
          <div className="struct-ctx-hpbar">
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (hud.selectedStructure.hp / Math.max(1, hud.selectedStructure.maxHp)) * 100
                  )
                )}%`,
              }}
            />
          </div>

          {!hud.selectedStructure.garrisonUnitId && (
            <div className="struct-ctx-actions">
              {hud.selectedStructure.garrisonable && (
                <button
                  type="button"
                  className="hud-btn active"
                  onClick={() => gameRef.current?.structureGarrisonOrder(hud.selectedStructure.id)}
                >
                  🏠 ENTRAR / OCUPAR CONSTRUÇÃO
                </button>
              )}
              <button
                type="button"
                className="hud-btn"
                onClick={() => gameRef.current?.structureExternalCoverOrder(hud.selectedStructure.id)}
              >
                🛡️ USAR PAREDES COMO COBERTURA EXTERNA
              </button>
            </div>
          )}

          {hud.selectedStructure.garrisonUnitId &&
            hud.selectedStructure.garrisonTeam === 'allies' && (
              <div className="struct-ctx-actions">
                <div className="struct-ctx-status ally">
                  ✓ Guarnecido por: {hud.selectedStructure.garrisonUnitName || 'Esquadrão Aliado'} (+70% Defesa)
                </div>
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => gameRef.current?.structureUngarrisonOrder(hud.selectedStructure.id)}
                >
                  🚪 SAIR DA CONSTRUÇÃO (DESOCUPAR) — Tecla U
                </button>
                <button
                  type="button"
                  className="hud-btn active"
                  onClick={() => gameRef.current?.structureSelectGarrisonedUnit(hud.selectedStructure.id)}
                >
                  🎯 SELECIONAR TROPA DENTRO DO PRÉDIO
                </button>
                <button
                  type="button"
                  className={`hud-btn ${hud.selectedStructure.observationBoosted ? 'active' : ''}`}
                  onClick={() => gameRef.current?.structureObservationPost(hud.selectedStructure.id)}
                >
                  🔭 POSTO DE OBSERVAÇÃO
                </button>
              </div>
            )}

          {hud.selectedStructure.garrisonUnitId &&
            hud.selectedStructure.garrisonTeam !== 'allies' && (
              <div className="struct-ctx-actions">
                <div className="struct-ctx-status enemy">
                  ⚠ Ocupada por Forças Inimigas
                </div>
                <button
                  type="button"
                  className="hud-btn active"
                  onClick={() => gameRef.current?.structureAssaultWithGrenades(hud.selectedStructure.id)}
                >
                  💣 ASSALTAR / LANÇAR GRANADAS NO PRÉDIO
                </button>
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => gameRef.current?.structureDemolishOrder(hud.selectedStructure.id)}
                >
                  💥 DEMOLIR ESTRUTURA (Tanques / Engenheiros)
                </button>
              </div>
            )}
        </div>
      )}

      {/* JANELA DE TUTORIAL & GUIA TÁTICO */}
      {tutorialOpen && (
        <TutorialModal
          onClose={() => setTutorialOpen(false)}
          onStartGuided={() => {
            setTutorialOpen(false);
            gameRef.current?.startGuidedTraining();
          }}
          onStartAssaultDrill={() => {
            setTutorialOpen(false);
            gameRef.current?.startAssaultSandboxDrill();
          }}
        />
      )}

      {/* BANNER DO TREINAMENTO GUIADO PASSO A PASSO */}
      {hud.guidedTrainingTip && (
        <div className="guided-training-banner">
          <div className="guided-training-body">
            <strong>{hud.guidedTrainingTip.title}</strong>
            <span>{hud.guidedTrainingTip.text}</span>
          </div>
          <div className="guided-training-actions">
            {hud.guidedTrainingTip.step < 5 ? (
              <button
                type="button"
                className="hud-btn active"
                onClick={() => {
                  const g = gameRef.current;
                  if (g) {
                    g.guidedTrainingStep = Math.min(4, (g.guidedTrainingStep || 0) + 1);
                    g._emitHud();
                  }
                }}
              >
                ▸ PRÓXIMO
              </button>
            ) : null}
            <button
              type="button"
              className="hud-btn"
              onClick={() => gameRef.current?.stopGuidedTraining()}
            >
              ✕ FECHAR
            </button>
          </div>
        </div>
      )}

      {/* AVISO DE MODO PAISAGEM EM CELULARES NO MODO RETRATO */}
      <div className="mobile-landscape-hint">
        <div className="mobile-landscape-card">
          <span>📱 ↻</span>
          <strong>GIRE O APARELHO PARA A HORIZONTAL</strong>
          <p>Para melhor visualização tática no campo de batalha, utilize o modo paisagem (deitado).</p>
        </div>
      </div>
    </div>
  );
}
