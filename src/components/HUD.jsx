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
  POWER_BUILDINGS,
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
  const [hoverTip, setHoverTip] = useState('');
  const [consolePage, setConsolePage] = useState('main'); // 'main' | 'extra' | 'air'
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

          {!hud.isMultiplayer && (
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
          )}

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

      {/* BARRA SUPERIOR FINA ESTILO OUTLIVE (36px) */}
      {!editorDrawerOpen && (() => {
        const p = hud.powerStats || { producedMw: 60, consumedMw: 0, efficiencyPct: 100, isLowPower: false };
        const pColor = p.isLowPower ? '#ef4444' : p.efficiencyPct <= 115 ? '#facc15' : '#4ade80';
        const ownedSec = (hud.sectors || []).filter((s) => s.owner === 'allies').length;
        const totalSec = (hud.sectors || []).length || 1;
        const lvl = hud.hqLevel || 1;
        const cp = hud.commandPoints || 0;
        const nextSpec = lvl < 3 ? HQ_UPGRADES[lvl + 1] : null;
        return (
          <header className="outlive-top-bar">
            <div className="outlive-top-group">
              <span className="outlive-res-item" title="Suprimentos Militares">
                📦 SUP: <strong>{hud.supplies}</strong> <small>+{hud.supplyIncome}</small>
              </span>
              <span className="outlive-res-item" title="Munição Tática">
                💣 MUN: <strong>{hud.ammo}</strong> <small>+{hud.ammoIncome}</small>
              </span>
              <span className="outlive-res-item" title="Combustível Militar">
                ⛽ COMB: <strong>{hud.fuel}</strong> <small>+{hud.fuelIncome}</small>
              </span>
            </div>

            <div className="outlive-top-group">
              <div
                className="outlive-power-pill"
                style={{ borderColor: pColor, color: pColor }}
                title="Balanço Energético da Base (Produção / Consumo MW)"
              >
                <span>⚡ ENERGIA: {p.producedMw} / {p.consumedMw} MW ({p.efficiencyPct}%)</span>
                <div className="outlive-power-bar-track">
                  <div
                    className="outlive-power-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(8, p.efficiencyPct))}%`, background: pColor }}
                  />
                </div>
              </div>

              <span className="outlive-res-item" title="Setores sob domínio Aliado">
                🚩 TERRITÓRIOS: <strong>{ownedSec} / {totalSec}</strong>
              </span>
              <span className="outlive-res-item" title="Próxima onda de ataque / Pontos">
                ⏱️ Onda {hud.aiWaveTimer}s • 🏆 {hud.victoryPoints || 0}
              </span>
            </div>

            <div className="outlive-top-group">
              {nextSpec && (
                <button
                  type="button"
                  className="outlive-top-btn"
                  onClick={() => gameRef.current?.upgradeHq()}
                  title={`Evoluir para ${nextSpec.name}: ${nextSpec.unlocks}`}
                >
                  ⬆ QG Nv.{lvl + 1} ({nextSpec.supplyCost}S)
                </button>
              )}
              <button
                type="button"
                className={`outlive-top-btn ${hud.techModalOpen ? 'active' : ''}`}
                onClick={() => gameRef.current?.toggleTechModal()}
                title={
                  hud.sandboxMode || hud.researchCenterActive
                    ? 'Árvore de Pesquisa & Tecnologia [Y]'
                    : '🔒 Construa o Centro de Pesquisa na sua base para liberar pesquisas!'
                }
              >
                <IconResearch size={12} /> {hud.sandboxMode || hud.researchCenterActive ? '[Y]' : '🔒 [Y]'}
              </button>
              <button
                type="button"
                className={`outlive-top-btn ${hud.tacticalMapOpen ? 'active' : ''}`}
                onClick={() => gameRef.current?.toggleTacticalMap()}
                title="Mapa Tático [TAB]"
              >
                <IconCompass size={12} /> [TAB]
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`outlive-top-btn ${hud.sandboxMode ? 'active' : ''}`}
                  onClick={() => gameRef.current?.toggleSandboxMode()}
                  title="Sandbox [F10]"
                >
                  <IconWrench size={12} /> F10
                </button>
              )}
              {isLocalHost && (
                <button
                  type="button"
                  className="outlive-top-btn"
                  onClick={() => {
                    setEditorDrawerOpen(true);
                    gameRef.current?.setMapEditorOpen?.(true, editorTool);
                  }}
                  title="Editor de Mapas 3D Local"
                >
                  🛠️ Editor
                </button>
              )}
              <button
                type="button"
                className={`outlive-top-btn ${!hud.muted ? 'active' : ''}`}
                onClick={onToggleMute}
                title="Ativar / Silenciar Áudio Procedural [M]"
              >
                {hud.muted ? '🔇 Som Off' : '🔊 Som On'}
              </button>
              <button
                type="button"
                className={`outlive-top-btn ${tutorialOpen ? 'active' : ''}`}
                onClick={() => setTutorialOpen((v) => !v)}
                title="Guia Tático"
              >
                <IconBook size={12} /> GUIA
              </button>
              <button
                type="button"
                className={`outlive-top-btn ${systemMenuOpen ? 'active' : ''}`}
                onClick={() => setSystemMenuOpen((v) => !v)}
                title="Menu do Sistema [ESC]"
              >
                ☰ Menu
              </button>
            </div>
          </header>
        );
      })()}

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

      {/* MODO EDITOR DE MAPA 3D (Mantido intacto quando editorDrawerOpen === true) */}
      {editorDrawerOpen && (
      <HudPanel id="command" className="hud-top-right" layoutApi={layoutApi}>
        <div className="toolbar-row compact-combat-bar" style={{ display: 'none' }} />
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
            terrain: [
              { id: 'sculpt_hill', icon: '⛰️', title: 'Elevar Morro / Colina' },
              { id: 'sculpt_mountain', icon: '🏔️', title: 'Montanha Rochosa' },
              { id: 'sculpt_valley', icon: '🕳️', title: 'Rebaixar / Vale / Cratera' },
              { id: 'sculpt_flatten', icon: '📏', title: 'Aplainar Terreno' },
            ],
          };

          const allItems = [
            ...EDITOR_CATALOG.buildings,
            ...EDITOR_CATALOG.walls,
            ...EDITOR_CATALOG.nature,
            ...EDITOR_CATALOG.terrain,
            { id: 'select_move', icon: '✋', title: 'Mover / Girar Objeto' },
            { id: 'move_sector', icon: '🚩', title: 'Mover Bandeira (Setor)' },
            { id: 'create_sector', icon: '➕', title: 'Criar Ponto de Conquista' },
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

                  {/* 3. NAVEGAÇÃO POR 5 ABAS LIMPAS */}
                  <div className="mil-editor-tabs">
                    {[
                      { id: 'buildings', label: '🏠 PRÉDIOS' },
                      { id: 'walls', label: '🧱 MUROS' },
                      { id: 'nature', label: '🌲 NATUREZA' },
                      { id: 'terrain', label: '⛰️ RELEVO' },
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
                          } else if (t.id === 'terrain') {
                            selectTool('sculpt_hill');
                          }
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* CONTEÚDO DA ABA ATIVA */}
                  <div className="mil-editor-body">
                    {editorTab === 'terrain' ? (
                      <div className="mil-editor-sectors-pane">
                        <div className="mil-editor-grid-2col">
                          {EDITOR_CATALOG.terrain.map((item) => {
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
                        <div style={{ marginTop: 8, padding: '8px', background: 'rgba(15,20,15,0.8)', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.74rem', marginBottom: 4 }}>
                            Raio do Pincel: <strong>{gameRef.current?.editorBrushRadiusMeters || 18}m</strong>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={40}
                            defaultValue={gameRef.current?.editorBrushRadiusMeters || 18}
                            onChange={(e) =>
                              gameRef.current?.setEditorTerrainBrush({
                                radiusMeters: Number(e.target.value),
                              })
                            }
                            style={{ width: '100%' }}
                          />
                          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                            {[
                              { id: 'low', label: 'Baixa' },
                              { id: 'medium', label: 'Média' },
                              { id: 'high', label: 'Alta' },
                            ].map((lv) => (
                              <button
                                key={lv.id}
                                type="button"
                                className={`mil-pill ${(gameRef.current?.editorBrushIntensity || 'medium') === lv.id ? 'active' : ''}`}
                                style={{ flex: 1, fontSize: '0.72rem' }}
                                onClick={() =>
                                  gameRef.current?.setEditorTerrainBrush({ intensity: lv.id })
                                }
                              >
                                {lv.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : editorTab !== 'sectors' ? (
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
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <button
                            type="button"
                            className={`mil-ed-move-flag-btn ${activeToolId === 'create_sector' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => selectTool('create_sector')}
                          >
                            ➕ CRIAR NOVO PONTO DE CONQUISTA
                          </button>
                          <button
                            type="button"
                            className={`mil-ed-move-flag-btn ${activeToolId === 'move_sector' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => selectTool('move_sector')}
                          >
                            🚩 Mover Bandeira
                          </button>
                        </div>

                        <div className="mil-editor-grid-2col">
                          {(hud.sectors || []).map((sec, idx) => {
                            const isSel = hud.selectedEditorSectorId === sec.id;
                            return (
                              <button
                                key={sec.id}
                                type="button"
                                className={`mil-ed-card sector-card ${isSel ? 'active' : ''}`}
                                onClick={() => {
                                  setEditorTool('move_sector');
                                  gameRef.current?.selectEditorSector(sec.id);
                                }}
                                title={`Centralizar em ${sec.name} e editar`}
                              >
                                <span className="mil-ed-card-icon">🚩</span>
                                <span className="mil-ed-card-title">
                                  S{idx + 1} — {sec.shortName || sec.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {(() => {
                          const selSec = (hud.sectors || []).find(
                            (s) => s.id === hud.selectedEditorSectorId
                          );
                          if (!selSec) return null;
                          return (
                            <div
                              style={{
                                marginTop: 8,
                                padding: 8,
                                borderRadius: 6,
                                background: 'rgba(15, 20, 15, 0.9)',
                                border: '1px solid rgba(250, 204, 21, 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fde047' }}>
                                CONFIGURAR SETOR SELECIONADO
                              </div>
                              <input
                                type="text"
                                className="mil-input"
                                value={selSec.name || ''}
                                onChange={(e) =>
                                  gameRef.current?.updateEditorSector(selSec.id, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Nome do Setor"
                              />
                              <select
                                className="mil-input"
                                value={selSec.type || 'supplies'}
                                onChange={(e) =>
                                  gameRef.current?.updateEditorSector(selSec.id, {
                                    type: e.target.value,
                                  })
                                }
                              >
                                <option value="supplies">📦 Suprimentos (+15 SUP/min)</option>
                                <option value="ammo">💣 Munição (+12 MUN/min)</option>
                                <option value="fuel">⛽ Combustível (+12 COMB/min)</option>
                                <option value="strategic">⭐ Ponto Estratégico (+10S/+5M/+5C)</option>
                              </select>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {[
                                  { id: 'neutral', label: 'Neutro' },
                                  { id: 'allies', label: 'Time 1 (Azul)' },
                                  { id: 'enemies', label: 'Time 2 (Verm.)' },
                                ].map((ow) => (
                                  <button
                                    key={ow.id}
                                    type="button"
                                    className={`mil-pill ${(selSec.owner || 'neutral') === ow.id ? 'active' : ''}`}
                                    style={{ flex: 1, fontSize: '0.7rem' }}
                                    onClick={() =>
                                      gameRef.current?.updateEditorSector(selSec.id, {
                                        initialOwner: ow.id,
                                      })
                                    }
                                  >
                                    {ow.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="mil-pill"
                                style={{ borderColor: '#ef4444', color: '#fca5a5' }}
                                onClick={() => gameRef.current?.deleteEditorSector(selSec.id)}
                              >
                                🗑️ Excluir Este Ponto de Conquista
                              </button>
                            </div>
                          );
                        })()}

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
      </HudPanel>
      )}

      {/* CONSOLE TÁTICO INFERIOR CLÁSSICO ESTILO OUTLIVE (175px • 3 MÓDULOS FIXOS) */}
      {!editorDrawerOpen && (() => {
        const pStats = hud.powerStats || { producedMw: 60, consumedMw: 0, efficiencyPct: 100, isLowPower: false };
        const defaultTip = selectedBld
          ? `${selectedBld.name} — Clique no mapa com Botão Direito para definir o Ponto de Encontro.`
          : leadSquad
            ? `${leadSquad.name} — Clique Direito no terreno/inimigo para mover ou atacar.`
            : "Passe o mouse sobre qualquer botão da grade 4x2 para ver detalhes e requisitos.";

        const renderConsoleGrid = () => {
          const mkBtn = (key, icon, name, cost, tip, onClick, opts = {}) => (
            <button
              key={key}
              type="button"
              className={`outlive-cmd-slot ${opts.locked ? "locked" : ""} ${opts.active ? "active" : ""}`}
              onMouseEnter={() => setHoverTip(tip)}
              onMouseLeave={() => setHoverTip("")}
              onClick={onClick}
            >
              {opts.badge && <span className="outlive-cmd-queue-badge">{opts.badge}</span>}
              <span className="outlive-cmd-slot-icon">{icon}</span>
              <span className="outlive-cmd-slot-name">{name}</span>
              <span className="outlive-cmd-slot-cost">{cost}</span>
              {typeof opts.progress === "number" && (
                <div className="outlive-cmd-progress">
                  <div className="outlive-cmd-progress-fill" style={{ width: `${opts.progress}%` }} />
                </div>
              )}
            </button>
          );

          // 1. PRÉDIO SELECIONADO (Grade Contextual Dinâmica)
          if (selectedBld && consolePage === "main") {
            const bType = selectedBld.buildingType;
            const rallyBtn = mkBtn(
              "rally",
              "📍",
              "Ponto Encontro",
              "Botão Dir.",
              "Clique com o Botão Direito em qualquer ponto do mapa para definir o Ponto de Encontro.",
              () => gameRef.current?.notify("📍 PONTO DE ENCONTRO", "Clique com o Botão Direito no mapa para definir onde as tropas irão.", "#38bdf8")
            );

            if (bType === "drone_factory") {
              const uavStock = hud.droneStock?.uav_recon || 0;
              const fpvStock = hud.droneStock?.fpv_kamikaze || 0;
              const intStock = hud.droneStock?.interceptor_drone || 0;
              const dMode = hud.droneControlMode || "fixed";
              return (
                <div className="outlive-cmd-grid">
                  {mkBtn(
                    "make_uav",
                    "🛸",
                    "Fabricar UAV",
                    "350S • 120M",
                    "Fabricar Drone Recon (UAV) e armazenar no Hangar.",
                    () => gameRef.current?.queueDroneProduction("uav_recon"),
                    { locked: !completedTechSet.has("uav_recon") }
                  )}
                  {mkBtn(
                    "make_fpv",
                    "💥",
                    "Fabricar FPV",
                    "500S • 200M",
                    "Fabricar Drone Kamikaze (FPV) e armazenar no Hangar.",
                    () => gameRef.current?.queueDroneProduction("fpv_kamikaze"),
                    { locked: !completedTechSet.has("fpv_kamikaze") }
                  )}
                  {mkBtn(
                    "make_int",
                    "🛡️",
                    "Fabricar Int.",
                    "280S • 90M",
                    "Fabricar Drone Interceptador e armazenar no Hangar.",
                    () => gameRef.current?.queueDroneProduction("interceptor_drone")
                  )}
                  {mkBtn(
                    "drone_mode_toggle",
                    dMode === "patrol" ? "🔄" : "🎯",
                    dMode === "patrol" ? "Modo: Patrulha" : "Modo: Fixo",
                    "Alternar",
                    "Alterna o modo de lançamento entre Ponto Fixo (órbita) e Patrulha/Caça autônoma.",
                    () => gameRef.current?.setDroneControlMode(dMode === "fixed" ? "patrol" : "fixed"),
                    { active: dMode === "patrol" }
                  )}
                  {mkBtn(
                    "launch_uav",
                    "🚀",
                    "Lançar UAV",
                    `Hangar: ${uavStock}`,
                    "Selecionar ponto no mapa para lançar Drone Recon (UAV) do Hangar.",
                    () => gameRef.current?.triggerDroneLaunchMode("uav_recon"),
                    { badge: uavStock > 0 ? `x${uavStock}` : null, active: hud.activeDroneLaunchMode === "uav_recon", locked: uavStock === 0 }
                  )}
                  {mkBtn(
                    "launch_fpv",
                    "🚀",
                    "Lançar FPV",
                    `Hangar: ${fpvStock}`,
                    "Selecionar ponto no mapa para lançar Drone Kamikaze (FPV) do Hangar.",
                    () => gameRef.current?.triggerDroneLaunchMode("fpv_kamikaze"),
                    { badge: fpvStock > 0 ? `x${fpvStock}` : null, active: hud.activeDroneLaunchMode === "fpv_kamikaze", locked: fpvStock === 0 }
                  )}
                  {mkBtn(
                    "launch_int",
                    "🚀",
                    "Lançar Int.",
                    `Hangar: ${intStock}`,
                    "Selecionar ponto no mapa para lançar Drone Interceptador do Hangar.",
                    () => gameRef.current?.triggerDroneLaunchMode("interceptor_drone"),
                    { badge: intStock > 0 ? `x${intStock}` : null, active: hud.activeDroneLaunchMode === "interceptor_drone", locked: intStock === 0 }
                  )}
                  {mkBtn(
                    "drone_return",
                    "🏠",
                    "Recolher Base",
                    `${hud.activeDronesCount || 0} ativos`,
                    "Retornar todos os drones em voo para a Fábrica de Drones para recarregar bateria.",
                    () => gameRef.current?.returnAllDronesToBase(),
                    { locked: (hud.activeDronesCount || 0) === 0 }
                  )}
                </div>
              );
            }

            if (bType === "research_center") {
              const techSlots = [
                { id: "reactive_armor", icon: "🛡️", name: "Blind. Reativa", cost: "750S • 220C" },
                { id: "ap_ammo", icon: "🎯", name: "Mun. Perfurante", cost: "500S • 150M" },
                { id: "turbo_diesel", icon: "⚙️", name: "Motor Turbo", cost: "750S • 220C" },
                { id: "high_eff_grid", icon: "⚡", name: "Rede Alta Efic.", cost: "400S • 60M" },
                { id: "uav_recon", icon: "🛸", name: "Drones UAV", cost: "1200S" },
                { id: "fpv_kamikaze", icon: "💣", name: "Enxame FPV", cost: "1800S" },
                { id: "kevlar_vests", icon: "🦺", name: "Coletes Kevlar", cost: "500S • 150M" },
              ];
              return (
                <div className="outlive-cmd-grid">
                  {techSlots.map((ts) => {
                    const node = TECH_NODE_BY_ID[ts.id];
                    const done = completedTechSet.has(ts.id);
                    const running = hud.activeResearch?.techId === ts.id;
                    const pct = running ? Math.round((hud.activeResearch.progress / Math.max(1, hud.activeResearch.duration)) * 100) : undefined;
                    return mkBtn(
                      ts.id,
                      ts.icon,
                      ts.name,
                      done ? "✅ Concluído" : running ? `${pct}%` : ts.cost,
                      `${node?.name || ts.name}: ${node?.effectText || ""}`,
                      () => gameRef.current?.startResearch(ts.id),
                      { locked: done, progress: pct }
                    );
                  })}
                  {mkBtn("open_full_tech", "🔬", "Painel [Y]", "Completo", "Abrir Árvore Completa de Pesquisas [Y].", () => gameRef.current?.toggleTechModal())}
                </div>
              );
            }

            if (bType === "air_command") {
              return (
                <div className="outlive-cmd-grid">
                  {AIR_DOCTRINES.map((doc) => {
                    const cd = hud.airCooldowns?.[doc.id] || 0;
                    return mkBtn(
                      doc.id,
                      "✈️",
                      `[${doc.key}] ${doc.short}`,
                      cd > 0 ? `⏳ ${Math.ceil(cd)}s` : `${doc.cost}S • ${doc.ammoCost}M`,
                      `[${doc.key}] ${doc.name}: ${doc.subtitle}`,
                      () => gameRef.current?.triggerAirDoctrine(doc.id),
                      { locked: cd > 0 }
                    );
                  })}
                  {rallyBtn}
                  {mkBtn("back", "↩️", "Base", "Construir", "Voltar ao menu de Construções.", () => gameRef.current?.selectBaseBuilding(null))}
                </div>
              );
            }

            if (bType === "pow_camp") {
              return (
                <div className="outlive-cmd-grid">
                  {mkBtn(
                    "pow_interrogate",
                    "🕵️",
                    "Interrogar",
                    `${hud.powPrisonersCount || 0}/${hud.powPrisonersMax || 10}`,
                    "Abrir Sala de Interrogatório de Prisioneiros (+SUP/s e Inteligência).",
                    () => gameRef.current?.openPowInterrogation()
                  )}
                  {mkBtn("back", "↩️", "Base", "Construir", "Voltar ao menu de Construções.", () => gameRef.current?.selectBaseBuilding(null))}
                </div>
              );
            }

            // QG, Fábrica de Blindados, Operações Especiais, Refinaria
            const unitIcon = (uid, uSpec) =>
              uSpec?.unitSpec?.isConstructor
                ? "🏗️"
                : uSpec?.unitSpec?.isHarvester
                  ? "🚜"
                  : uid === "humvee"
                    ? "🚙"
                    : uSpec?.unitSpec?.isTransport
                      ? "🚛"
                      : uid === "mbt_tank"
                        ? "🛡️"
                        : uid === "rocket_artillery"
                          ? "🚀"
                          : uSpec?.unitSpec?.type === "vehicle"
                            ? "🚜"
                            : "🪖";

            const slots = (selectedBld.produces || []).slice(0, bType === "hq_command" ? 5 : 6);
            return (
              <div className="outlive-cmd-grid">
                {slots.map((unitId) => {
                  const uSpec = COMMAND_BY_ID[unitId];
                  if (!uSpec) return null;
                  const reqHq = uSpec.requiredHqLevel || 1;
                  const hqOk = (hud.hqLevel || 1) >= reqHq;
                  const canAfford =
                    hqOk &&
                    hud.supplies >= (uSpec.cost || 0) &&
                    hud.ammo >= (uSpec.ammoCost || 0) &&
                    hud.fuel >= (uSpec.fuelCost || 0);
                  const queuedCount = (selectedBld.productionQueue || []).filter((q) => q.unitId === unitId).length;
                  const isProducingThis = selectedBld.productionQueue?.[0]?.unitId === unitId;
                  return mkBtn(
                    unitId,
                    unitIcon(unitId, uSpec),
                    uSpec.short,
                    !hqOk ? `🔒 QG${reqHq}` : `${uSpec.cost || 0} SUP`,
                    `${uSpec.name}: ${uSpec.subtitle}${!hqOk ? ` (Requer QG Nv.${reqHq})` : ""}`,
                    () => gameRef.current?.queueUnitAtBuilding(selectedBld.id, unitId),
                    {
                      locked: !canAfford,
                      badge: queuedCount > 0 ? `x${queuedCount}` : null,
                      progress: isProducingThis ? selectedBld.productionProgress || 0 : undefined,
                    }
                  );
                })}
                {bType === "hq_command" &&
                  mkBtn(
                    "upgrade_hq",
                    "⬆️",
                    `Evoluir QG`,
                    (hud.hqLevel || 1) < 3 ? `${HQ_UPGRADES[(hud.hqLevel || 1) + 1]?.supplyCost || 650}S` : "MAX",
                    "Evoluir Quartel-General para desbloquear tanques pesados e tecnologias.",
                    () => gameRef.current?.upgradeHq(),
                    { locked: (hud.hqLevel || 1) >= 3 }
                  )}
                {bType === "hq_command" &&
                  mkBtn(
                    "build_research",
                    "🔬",
                    "Centro Pesq.",
                    "350S • 80M",
                    "Posicionar Centro de Pesquisa Tecnológica (obrigatório para pesquisas).",
                    () => gameRef.current?.startPlaceBaseBuilding("research_center")
                  )}
                {rallyBtn}
              </div>
            );
          }

          // 2. TROPAS DE INFANTARIA / ENGENHEIROS SELECIONADOS -> FORTIFICAÇÕES DE CAMPO NO FRONT
          if (!selectedBld && leadSquad && leadSquad.isInfantry && consolePage === "main") {
            const cdG = leadSquad.abilityCooldowns?.grenade || 0;
            const cdF = leadSquad.abilityCooldowns?.suppression || 0;
            const cdC = leadSquad.abilityCooldowns?.medkit || 0;
            return (
              <div className="outlive-cmd-grid">
                {mkBtn(
                  "field_trench",
                  "🪖",
                  "Cavar Trincheira",
                  "60 SUP",
                  "Infantaria corre até o ponto e cava Trincheira Conectada (+65% cobertura).",
                  () => gameRef.current?.triggerActionById("build_trench")
                )}
                {mkBtn(
                  "field_sandbag",
                  "🧱",
                  "Sacos de Areia",
                  `${COMMAND_BY_ID.build_barricade?.cost || 45} SUP`,
                  "Montar Barricada de Sacos de Areia rápida na linha de frente.",
                  () => gameRef.current?.triggerActionById("build_barricade")
                )}
                {mkBtn(
                  "field_wire",
                  "🚧",
                  "Arame & Ouriços",
                  `${COMMAND_BY_ID.build_barricade?.cost || 45} SUP`,
                  "Instalar Arame Farpado e Ouriços Antitanque contra avanços inimigos.",
                  () => gameRef.current?.triggerActionById("build_barricade")
                )}
                {mkBtn(
                  "field_mine",
                  "💣",
                  "Plantar Mina",
                  `${COMMAND_BY_ID.build_mine?.cost || 70} SUP`,
                  "Engenheiros/Tropas plantam campo de minas terrestres/antitanque no front.",
                  () => gameRef.current?.triggerActionById("build_mine")
                )}
                {mkBtn(
                  "sq_grenade",
                  "💥",
                  "Granada [G]",
                  cdG > 0 ? `${cdG}s` : "15 MUN",
                  "Lançar Granada de Fragmentação [G].",
                  () => gameRef.current?.throwSelectedGrenade(),
                  { locked: cdG > 0 }
                )}
                {mkBtn(
                  "sq_suppression",
                  "🔥",
                  "Supressão [F]",
                  leadSquad.suppressionMode ? "ATIVO" : cdF > 0 ? `${cdF}s` : "10 MUN",
                  "Fogo de Supressão [F]: 2x cadência, reduz velocidade inimiga.",
                  () => gameRef.current?.toggleSelectedSuppression(),
                  { active: leadSquad.suppressionMode }
                )}
                {mkBtn(
                  "sq_medkit",
                  "🩹",
                  "Médico [C]",
                  leadSquad.medkitHealing ? "CURANDO" : cdC > 0 ? `${cdC}s` : "20 SUP",
                  "Aplicar Kit Médico de Campo [C].",
                  () => gameRef.current?.useSelectedMedkit()
                )}
                {mkBtn(
                  "sq_extra",
                  "🏗️",
                  "+Base",
                  "Prédios",
                  "Alternar para catálogo de Construções da Base.",
                  () => setConsolePage("extra")
                )}
              </div>
            );
          }

          // 2b. VEÍCULOS SELECIONADOS -> PAINEL DE COMANDOS TÁTICOS ESTILO OUTLIVE
          if (!selectedBld && leadSquad && leadSquad.isVehicle && !leadSquad.isConstructor && consolePage === "main") {
            const stance = leadSquad.combatStance || "aggressive";
            const stanceLabel = stance === "passive" ? "Passiva" : stance === "defensive" ? "Defensiva" : "Agressiva";
            const canQuickRepair = leadSquad.hp < leadSquad.maxHp;
            return (
              <div className="outlive-cmd-grid">
                {mkBtn(
                  "veh_repair",
                  "🔧",
                  hud.hasRepairUnit ? "Chamar Reparo" : "Treinar Eng.",
                  canQuickRepair ? `${Math.round((leadSquad.hp / Math.max(1, leadSquad.maxHp)) * 100)}% HP` : "100% HP",
                  hud.hasRepairUnit
                    ? "Envia o Engenheiro ou Carro Construtor mais próximo para soldar e reparar o veículo."
                    : "Sem Engenheiro no mapa! Clique para retornar à Base ou treine Engenheiros no QG.",
                  () => {
                    if (hud.hasRepairUnit) {
                      gameRef.current?.callRepairForSelectedVehicles();
                    } else {
                      gameRef.current?.returnSelectedToBase();
                    }
                  },
                  { locked: !canQuickRepair }
                )}
                {mkBtn(
                  "veh_patrol",
                  "🔄",
                  "Patrulhar",
                  "Ida/Volta",
                  "Clique e marque o destino B (segure Shift para vários pontos): patrulha contínua.",
                  () => gameRef.current?.setActiveCommandMode?.("vehicle_patrol"),
                  { active: hud.activeCommandMode === "vehicle_patrol" }
                )}
                {mkBtn(
                  "veh_line_move",
                  "➡️",
                  "Linha Reta",
                  "Sincronizar",
                  "Move o grupo em formação alinhada na velocidade do tanque mais lento.",
                  () => gameRef.current?.setActiveCommandMode?.("vehicle_line_move"),
                  { active: hud.activeCommandMode === "vehicle_line_move" }
                )}
                {mkBtn(
                  "veh_hold",
                  "⚓",
                  "Manter Pos.",
                  leadSquad.holdPosition ? "TRAVADO" : "Livre",
                  "Trava rodas/esteiras no local e atira sem sair da cobertura.",
                  () => gameRef.current?.toggleSelectedHoldPosition(),
                  { active: leadSquad.holdPosition }
                )}
                {mkBtn(
                  "veh_attack_move",
                  "⚔️",
                  "Atacar Mov.",
                  "Avançar",
                  "Avança até o destino parando para destruir inimigos no caminho.",
                  () => gameRef.current?.setActiveCommandMode?.("attack_move"),
                  { active: hud.activeCommandMode === "attack_move" }
                )}
                {mkBtn(
                  "veh_stance",
                  "🛡️",
                  "Postura",
                  stanceLabel,
                  "Alterna entre Agressiva (persegue), Defensiva (fixo) e Passiva (foge sem atirar).",
                  () => gameRef.current?.cycleSelectedVehicleStance(),
                  { active: stance !== "aggressive" }
                )}
                {mkBtn(
                  "veh_rtb",
                  "🏠",
                  "Recuar Base",
                  "Reparo QG",
                  "Recua o veículo imediatamente para a área de reparo do QG/Fábrica.",
                  () => gameRef.current?.returnSelectedToBase()
                )}
                {mkBtn(
                  "veh_extra",
                  "🏗️",
                  "+Base",
                  "Prédios",
                  "Abrir catálogo de Construções da Base.",
                  () => setConsolePage("extra")
                )}
              </div>
            );
          }

          if (consolePage === "air") {
            return (
              <div className="outlive-cmd-grid">
                {AIR_DOCTRINES.map((doc) => {
                  const cd = hud.airCooldowns?.[doc.id] || 0;
                  const canUse = hasAirCommand && cd <= 0 && hud.supplies >= (doc.cost || 0) && hud.ammo >= (doc.ammoCost || 0);
                  return mkBtn(
                    doc.id,
                    "✈️",
                    `[${doc.key}] ${doc.short}`,
                    !hasAirCommand ? "🔒 Radar" : cd > 0 ? `⏳ ${Math.ceil(cd)}s` : `${doc.cost}S`,
                    `[${doc.key}] ${doc.name}: ${doc.subtitle}`,
                    () => {
                      if (!hasAirCommand) {
                        gameRef.current?.notify("COMANDO AÉREO BLOQUEADO", "Construa o Comando Aéreo / Radar primeiro!", "#fbbf24");
                        return;
                      }
                      gameRef.current?.triggerAirDoctrine(doc.id);
                    },
                    { locked: !canUse }
                  );
                })}
                {mkBtn("back_main", "↩️", "Voltar", "Principal", "Voltar para a grade principal.", () => setConsolePage("main"))}
              </div>
            );
          }

          if (consolePage === "extra") {
            const extraButtons = [
              { id: "air_command", icon: "📡", name: "Comando Aéreo", cost: `${BASE_BUILDING_BY_ID.air_command?.cost || 250}S`, tip: "Comando Aéreo / Radar: Desbloqueia Drone Recon [Z], A-10 [X] e Bombardeio [C].", onClick: () => gameRef.current?.startPlaceBaseBuilding("air_command") },
              { id: "thermal_plant", icon: "⚛️", name: "Termelétrica", cost: "420S • 80C", tip: "Usina Termelétrica: Gera +140 MW e conecta prédios em 36m.", onClick: () => gameRef.current?.startPlaceBaseBuilding("thermal_plant") },
              { id: "pow_camp", icon: "⛓️", name: "Campo POW", cost: "260S • 40C", tip: "Campo de Prisioneiros: Gera +5 SUP/s por prisioneiro.", onClick: () => gameRef.current?.startPlaceBaseBuilding("pow_camp") },
              { id: "build_bunker", icon: "🏰", name: "Bunker .50cal", cost: `${COMMAND_BY_ID.build_bunker?.cost || 180}S`, tip: "Bunker Blindado .50cal conectado à Rede Elétrica.", onClick: () => gameRef.current?.triggerActionById("build_bunker") },
              { id: "build_fortified_wall", icon: "🧱", name: "Muralha", cost: `${COMMAND_BY_ID.build_fortified_wall?.cost || 80}S`, tip: "Muralha Contínua de Concreto.", onClick: () => gameRef.current?.triggerActionById("build_fortified_wall") },
              { id: "build_outpost", icon: "📦", name: "Posto SUP", cost: "160S", tip: "Posto de Suprimentos: Aumenta renda do setor dominado.", onClick: () => gameRef.current?.triggerActionById("build_outpost") },
              { id: "air_tab", icon: "✈️", name: "Ataques Aéreos", cost: hasAirCommand ? "Pronto" : "🔒 Radar", tip: "Abrir comandos de Suporte Aéreo ([Z], [X], [C]).", onClick: () => setConsolePage("air") },
              { id: "back_main", icon: "↩️", name: "Voltar", cost: "Principal", tip: "Voltar para o catálogo principal da Base.", onClick: () => setConsolePage("main") },
            ];
            return (
              <div className="outlive-cmd-grid">
                {extraButtons.map((btn) => mkBtn(btn.id, btn.icon, btn.name, btn.cost, btn.tip, btn.onClick))}
              </div>
            );
          }

          // 3. CARRO CONSTRUTOR SELECIONADO ou BASE PADRÃO -> CATÁLOGO DE CONSTRUÇÕES DA BASE
          const mainBuildSlots = [
            { id: "wind_turbine", icon: "🌬️", name: "Usina Eólica", cost: "180 SUP • +45MW", tip: "Usina Eólica (+45 MW): Carro Construtor ergue e conecta prédios em 32m.", canAfford: hud.supplies >= 180, onClick: () => gameRef.current?.startPlaceBaseBuilding("wind_turbine") },
            { id: "power_relay", icon: "🗼", name: "Relé Energia", cost: "90 SUP • +28m", tip: "Relé / Torre de Transmissão: Estende o raio da Rede Elétrica em +28m.", canAfford: hud.supplies >= 90, onClick: () => gameRef.current?.startPlaceBaseBuilding("power_relay") },
            { id: "refinery", icon: "⛏️", name: "Refinaria", cost: "300 SUP • +Coletor", tip: "Refinaria: Envia 1 Caminhão Coletor automático para minerar jazidas.", canAfford: hud.supplies >= 300, onClick: () => gameRef.current?.startPlaceBaseBuilding("refinery") },
            { id: "motor_pool", icon: "🏭", name: "Fáb. Blindados", cost: `${BASE_BUILDING_BY_ID.motor_pool?.cost || 280} SUP`, tip: "Fábrica de Blindados: Produz Humvees, APCs, Tanques MBT e Carros Construtores.", canAfford: hud.supplies >= (BASE_BUILDING_BY_ID.motor_pool?.cost || 280), onClick: () => gameRef.current?.startPlaceBaseBuilding("motor_pool") },
            { id: "spec_ops_center", icon: "🪖", name: "Op. Especiais", cost: `${BASE_BUILDING_BY_ID.spec_ops_center?.cost || 220} SUP`, tip: "Operações Especiais: Recruta Snipers, Antitanque, Choque e Oficial.", canAfford: hud.supplies >= (BASE_BUILDING_BY_ID.spec_ops_center?.cost || 220), onClick: () => gameRef.current?.startPlaceBaseBuilding("spec_ops_center") },
            { id: "research_center", icon: "🔬", name: "Centro Pesq.", cost: "350S • 80M", tip: "Centro de Pesquisa: Obrigatório para liberar pesquisas tecnológicas [Y].", canAfford: hud.supplies >= 350 && hud.ammo >= 80, onClick: () => gameRef.current?.startPlaceBaseBuilding("research_center") },
            { id: "drone_factory", icon: "🛸", name: "Fáb. Drones", cost: "320S • 50C", tip: "Fábrica de Drones Táticos: Produz UAV Recon, FPV Kamikaze e Interceptador.", canAfford: hud.supplies >= 320 && hud.fuel >= 50, onClick: () => gameRef.current?.startPlaceBaseBuilding("drone_factory") },
            { id: "more_base", icon: "➕", name: "+Defesas/Ar", cost: "Mais", tip: "Abrir Termelétrica, Comando Aéreo, Bunkers, Muralhas e Campo POW.", canAfford: true, onClick: () => setConsolePage("extra") },
          ];

          return (
            <div className="outlive-cmd-grid">
              {mainBuildSlots.map((slot) =>
                mkBtn(slot.id, slot.icon, slot.name, slot.cost, slot.tip, slot.onClick, { locked: !slot.canAfford })
              )}
            </div>
          );
        };

        return (
          <footer className="outlive-bottom-console">
            <div className="outlive-console-left">
              <Minimap gameRef={gameRef} compact />
            </div>

            <div className="outlive-console-center">
              {selectedBld ? (
                <>
                  <div className="outlive-visor-head">
                    <div className="outlive-visor-title">
                      <div className="outlive-visor-portrait">🏭</div>
                      <div>
                        <strong style={{ fontSize: 13 }}>{selectedBld.name}</strong>
                        <div style={{ fontSize: 10.5, color: selectedBld.underConstruction ? "#38bdf8" : selectedBld.powerConnected ? "#4ade80" : "#ef4444", fontWeight: 700 }}>
                          {selectedBld.underConstruction
                            ? `🚧 Em Construção (${selectedBld.buildProgress || 0}%)`
                            : selectedBld.powerConnected
                              ? "⚡ Conectado à Rede (100%)"
                              : "⚠️ Sem Energia — Construa Usina/Relé"}
                        </div>
                      </div>
                    </div>
                    <strong style={{ fontSize: 12, color: "#86efac" }}>
                      {selectedBld.hp}/{selectedBld.maxHp} HP
                    </strong>
                  </div>
                  <div className="stat-track" style={{ marginTop: 4 }}>
                    <div className="stat-fill hp" style={{ width: `${Math.round((selectedBld.hp / Math.max(1, selectedBld.maxHp)) * 100)}%` }} />
                  </div>
                  <div className="outlive-visor-stats">
                    <div className="outlive-stat-box"><span>Integridade</span><strong>{Math.round((selectedBld.hp / Math.max(1, selectedBld.maxHp)) * 100)}%</strong></div>
                    <div className="outlive-stat-box"><span>Rede Elétrica</span><strong style={{ color: pStats.isLowPower ? "#facc15" : "#4ade80" }}>{selectedBld.powerConnected ? `${pStats.efficiencyPct}%` : "OFFLINE"}</strong></div>
                    <div className="outlive-stat-box"><span>Fila</span><strong>{selectedBld.productionQueue?.length || 0} / 5</strong></div>
                    <div className="outlive-stat-box">
                      <span>{selectedBld.underConstruction ? "Obra" : "Progresso"}</span>
                      <strong>
                        {selectedBld.underConstruction
                          ? `${selectedBld.buildProgress || 0}%`
                          : selectedBld.productionQueue?.length > 0
                            ? `${selectedBld.productionProgress}% (${selectedBld.productionRemainingSec || 0}s)`
                            : "Ocioso"}
                      </strong>
                    </div>
                  </div>
                </>
              ) : leadSquad ? (
                <>
                  <div className="outlive-visor-head">
                    <div className="outlive-visor-title">
                      <div className="outlive-visor-portrait">{leadSquad.isConstructor ? "🏗️" : leadSquad.isHarvester ? "🚜" : leadSquad.unitType === "humvee" ? "🚙" : leadSquad.isVehicle ? "🛡️" : "🪖"}</div>
                      <div>
                        <strong style={{ fontSize: 13 }}>{leadSquad.name} {hud.selectedCount > 1 ? `(+${hud.selectedCount - 1})` : ""}</strong>
                        <div style={{ fontSize: 10.5, color: "#93c5fd" }}>
                          {leadSquad.isHarvester
                            ? `Estado: ${leadSquad.harvesterState === "harvesting" ? "Minerando Jazida" : leadSquad.harvesterState === "to_refinery" ? "Retornando à Refinaria" : "Em Rota"}`
                            : leadSquad.inTrench
                              ? "🛡 Em Trincheira (+65% Cobertura)"
                              : leadSquad.camouflagedInForest
                                ? "🌲 Camuflado na Mata (+50% DEF)"
                                : leadSquad.holdPosition
                                  ? "🔒 Posição Travada [H]"
                                  : "⚡ Pronto para Combate"}
                        </div>
                      </div>
                    </div>
                    <strong style={{ fontSize: 12, color: "#86efac" }}>{leadSquad.hp}/{leadSquad.maxHp} HP</strong>
                  </div>
                  <div className="stat-track" style={{ marginTop: 4 }}>
                    <div className="stat-fill hp" style={{ width: `${Math.round((leadSquad.hp / Math.max(1, leadSquad.maxHp)) * 100)}%` }} />
                  </div>
                  {hud.selectedUnits.length > 1 ? (
                    <div className="outlive-multi-grid">
                      {hud.selectedUnits.map((u) => {
                        const pct = Math.max(0, Math.min(100, Math.round((u.hp / Math.max(1, u.maxHp)) * 100)));
                        return (
                          <button
                            key={u.id}
                            type="button"
                            className={`outlive-mini-unit-btn ${leadSquad.id === u.id ? "active" : ""}`}
                            onClick={() => gameRef.current?.focusSelectedUnit(u.id)}
                          >
                            <span>{u.short}</span>
                            <div className="outlive-mini-hp-track">
                              <div className="outlive-mini-hp-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="outlive-visor-stats">
                      <div className="outlive-stat-box"><span>{leadSquad.isHarvester ? "Carga" : "Ataque"}</span><strong>{leadSquad.isHarvester ? `${leadSquad.harvesterLoad || 0}%` : leadSquad.attack || 0}</strong></div>
                      <div className="outlive-stat-box"><span>Blindagem</span><strong>{leadSquad.armor || 0}%</strong></div>
                      <div className="outlive-stat-box"><span>Alcance</span><strong>{leadSquad.range || 0}m</strong></div>
                      <div className="outlive-stat-box"><span>Efetivo</span><strong>{leadSquad.isInfantry ? `${leadSquad.soldiersAlive}/${leadSquad.maxSoldiers}` : "1 Veículo"}</strong></div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="outlive-visor-head">
                    <div className="outlive-visor-title">
                      <div className="outlive-visor-portrait">🏛️</div>
                      <div>
                        <strong style={{ fontSize: 13 }}>COMANDO CENTRAL — QG NV. {hud.hqLevel || 1}/3</strong>
                        <div style={{ fontSize: 10.5, color: "#9ca3af" }}>
                          Aliados: {hud.allyUnitsCount} • Eixo Avistado: {hud.enemyUnitsCount} • {hud.commandPoints || 0} CP
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="outlive-top-btn"
                      onClick={() => setConsolePage((p) => (p === "extra" ? "main" : "extra"))}
                    >
                      {consolePage === "extra" ? "↩ Principal" : "+Mais Prédios"}
                    </button>
                  </div>
                  <div className="outlive-multi-grid">
                    {(hud.alliedBaseBuildings || []).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="outlive-mini-unit-btn"
                        style={{ width: "auto", minWidth: 82 }}
                        onClick={() => {
                          gameRef.current?.selectBaseBuilding(b.id);
                          setConsolePage("main");
                        }}
                      >
                        <span>🏭 {b.short}</span>
                        <div className="outlive-mini-hp-track">
                          <div className="outlive-mini-hp-fill" style={{ width: `${Math.round((b.hp / Math.max(1, b.maxHp)) * 100)}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="outlive-console-right">
              <div className="outlive-quick-orders">
                <button
                  type="button"
                  className={`outlive-quick-btn ${hud.activeCommandMode === "attack_move" ? "active" : ""}`}
                  onMouseEnter={() => setHoverTip("Atacar / Avançar: Ordena tropas atacarem qualquer inimigo no caminho.")}
                  onMouseLeave={() => setHoverTip("")}
                  onClick={() => gameRef.current?.setActiveCommandMode?.("attack_move")}
                >
                  ⚔️ Atacar
                </button>
                <button
                  type="button"
                  className={`outlive-quick-btn ${hud.selectedHoldPosition ? "active" : ""}`}
                  onMouseEnter={() => setHoverTip("Defender / Manter Posição [H]: Impede perseguição automática.")}
                  onMouseLeave={() => setHoverTip("")}
                  onClick={() => gameRef.current?.toggleSelectedHoldPosition?.()}
                >
                  🛡️ Defender
                </button>
                <button
                  type="button"
                  className="outlive-quick-btn"
                  onMouseEnter={() => setHoverTip("Parar / Recuar para Base [R]: Interrompe ordens atuais.")}
                  onMouseLeave={() => setHoverTip("")}
                  onClick={() => gameRef.current?.returnSelectedToBase?.()}
                >
                  🛑 Parar
                </button>
                <button
                  type="button"
                  className="outlive-quick-btn"
                  disabled={!selectedBld}
                  onMouseEnter={() =>
                    setHoverTip(
                      selectedBld && !selectedBld.isMainHQ && selectedBld.hp >= selectedBld.maxHp
                        ? "Vender Prédio Selecionado (reembolsa 50% dos Suprimentos)."
                        : "Reparar Prédio / Estrutura Selecionada."
                    )
                  }
                  onMouseLeave={() => setHoverTip("")}
                  onClick={() => {
                    if (!selectedBld) return;
                    if (selectedBld.hp < selectedBld.maxHp) {
                      gameRef.current?.repairSelectedWallOrBuilding?.();
                    } else if (!selectedBld.isMainHQ) {
                      gameRef.current?.sellSelectedBuilding?.();
                    }
                  }}
                >
                  {selectedBld && !selectedBld.isMainHQ && selectedBld.hp >= selectedBld.maxHp ? "💰 Vender" : "🔄 Reparar"}
                </button>
              </div>

              {renderConsoleGrid()}

              <div className="outlive-tooltip-bar">
                💡 {hoverTip || defaultTip}
              </div>
            </div>
          </footer>
        );
      })()}

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
              {hud.isMultiplayer ? (
                <div
                  style={{
                    marginBottom: 8,
                    padding: '6px 10px',
                    borderRadius: 5,
                    background: 'rgba(194, 142, 56, 0.14)',
                    border: '1px solid rgba(250, 204, 21, 0.35)',
                    color: '#fde047',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  🔒 VELOCIDADE ONLINE TRAVADA EM 1.0x (SINCRONIA MULTIPLAYER)
                </div>
              ) : (
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
              )}
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
