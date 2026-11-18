import React, { useState } from 'react';
import Minimap from './Minimap.jsx';
import TutorialModal from './TutorialModal.jsx';
import { BATTALION_UNLOCKS } from '../game/data/accountData.js';
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
  const [activeBaseTab, setActiveBaseTab] = useState('buildings'); // 'buildings' | 'spec_ops' | 'armor'
  const [baseDrawerOpen, setBaseDrawerOpen] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const layoutApi = useHudLayout(); // Menus responsivos, redimensionáveis e fixáveis

  if (!hud) return null;

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

      {/* TOPO ESQUERDO: Mini-Mapa / Quadro de Planejamento Tático Interativo */}
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

      {/* TOPO DIREITO: Apenas Recursos + Nível do QG + 3 Ícones Compactos (🔬 [T], 🗺️ [TAB], ⚙️) */}
      <HudPanel id="command" className="hud-top-right" layoutApi={layoutApi}>
        <div className="toolbar-row compact-combat-bar">
          {completedTechSet.has('uav_recon') && (
            <button
              type="button"
              className={`hud-btn ${hud.activeDroneLaunchMode === 'uav_recon' ? 'active' : ''}`}
              onClick={() => gameRef.current?.triggerDroneLaunchMode('uav_recon')}
              title="Lançar Drone UAV 3D (350 SUP + 120 MUN)"
            >
              🛸 UAV
            </button>
          )}
          {completedTechSet.has('fpv_kamikaze') && (
            <button
              type="button"
              className={`hud-btn ${hud.activeDroneLaunchMode === 'fpv_kamikaze' ? 'active' : ''}`}
              onClick={() => gameRef.current?.triggerDroneLaunchMode('fpv_kamikaze')}
              title="Lançar Drone Kamikaze FPV (500 SUP + 200 MUN)"
            >
              💥 FPV
            </button>
          )}

          <button
            type="button"
            className={`hud-btn ${hud.techModalOpen ? 'active' : ''}`}
            onClick={() => gameRef.current?.toggleTechModal()}
            title="Árvore de Pesquisa & Drones [T]"
          >
            🔬 [T]
          </button>
          <button
            type="button"
            className={`hud-btn ${hud.tacticalMapOpen ? 'active' : ''}`}
            onClick={() => gameRef.current?.toggleTacticalMap()}
            title="Mapa Estratégico [TAB]"
          >
            🗺️ [TAB]
          </button>
          <button
            type="button"
            className={`hud-btn ${hud.sandboxMode ? 'active' : ''}`}
            onClick={() => gameRef.current?.toggleSandboxMode()}
            title="Modo Caixa de Areia / Campo de Testes [F10]"
          >
            🛠️ SANDBOX — F10
          </button>
          <button
            type="button"
            className={`hud-btn ${tutorialOpen ? 'active' : ''}`}
            onClick={() => setTutorialOpen((v) => !v)}
            title="Tutorial Completo & Guia Tático de Campo"
          >
            📖 TUTORIAL
          </button>
          <button
            type="button"
            className={`hud-btn gear-btn ${systemMenuOpen ? 'active' : ''}`}
            onClick={() => setSystemMenuOpen((v) => !v)}
            title="Opções do Sistema [ESC]"
          >
            ⚙️
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
              <span className="hq-lvl-badge">🏛 QG NV. {lvl}/3</span>
              <span className="hq-cp-badge">⭐ {cp} CP</span>
              {nextSpec ? (
                <button
                  type="button"
                  className={`hud-btn hq-upgrade-btn ${canUpgradeHq ? 'ready' : 'locked'}`}
                  onClick={() => gameRef.current?.upgradeHq()}
                  title={`${nextSpec.name}: ${nextSpec.unlocks}`}
                >
                  ⬆ QG NV.{lvl + 1} ({nextSpec.supplyCost}S/{nextSpec.fuelCost}C • {nextSpec.requiredCp}CP)
                </button>
              ) : (
                <span className="hq-max-badge">🎖 COMANDO SUPREMO</span>
              )}
            </div>
          );
        })()}

        <div className="resources-bar">
          <div className="res-pill sup" title="Suprimentos Militares">
            <span>⚙ {hud.supplies} SUP</span>
            <small>+{hud.supplyIncome}</small>
          </div>
          <div className="res-pill ammo" title="Munição Tática (Tropas de Elite e Suporte Aéreo)">
            <span>弹 {hud.ammo} MUN</span>
            <small>+{hud.ammoIncome}</small>
          </div>
          <div
            className="res-pill fuel"
            title="Combustível Militar (Prédios de Base e Blindados Pesados)"
          >
            <span>⛽ {hud.fuel} COMB</span>
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
                  <span>🏭 {b.short}</span>
                  {b.queueLength > 0 && (
                    <small className="bstrip-prog">
                      ⚙ {b.progress}% ({b.queueLength})
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* PAINEL DE CONSTRUÇÃO DE BASE MILITAR & UNIDADES DE ELITE / TANQUES (Minimiza para [–]) */}
        <div className="base-command-card">
          <div className="base-tabs">
            <button
              type="button"
              className={`base-tab-btn ${baseDrawerOpen && activeBaseTab === 'buildings' ? 'active' : ''}`}
              onClick={() => {
                setActiveBaseTab('buildings');
                setBaseDrawerOpen(true);
              }}
            >
              🏗 BASE ({Math.max(0, builtSet.size - 1)}/3)
            </button>
            <button
              type="button"
              className={`base-tab-btn ${baseDrawerOpen && activeBaseTab === 'spec_ops' ? 'active' : ''}`}
              onClick={() => {
                setActiveBaseTab('spec_ops');
                setBaseDrawerOpen(true);
              }}
            >
              🎯 OP. ESPECIAIS
            </button>
            <button
              type="button"
              className={`base-tab-btn ${baseDrawerOpen && activeBaseTab === 'armor' ? 'active' : ''}`}
              onClick={() => {
                setActiveBaseTab('armor');
                setBaseDrawerOpen(true);
              }}
            >
              🛡 BLINDADOS
            </button>
            <button
              type="button"
              className="base-tab-btn base-collapse-btn"
              onClick={() => setBaseDrawerOpen((v) => !v)}
              title={baseDrawerOpen ? 'Minimizar painel da Base' : 'Expandir painel da Base & Comando Aéreo'}
            >
              {baseDrawerOpen ? '–' : '+'}
            </button>
          </div>

          {baseDrawerOpen && activeBaseTab === 'buildings' && (
            <div className="base-grid">
              {BASE_BUILDINGS.map((b) => {
                const isBuilt = builtSet.has(b.id);
                const canAfford = hud.supplies >= b.cost && hud.fuel >= (b.fuelCost || 0);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`base-item-btn ${isBuilt ? 'built' : ''} ${!canAfford && !isBuilt ? 'locked' : ''
                      }`}
                    onClick={() => gameRef.current?.constructBaseBuilding(b.id)}
                    title={`${b.name} — ${b.subtitle}`}
                  >
                    <div className="base-item-top">
                      <strong>{b.short}</strong>
                      <span>
                        {isBuilt ? '✓ SELECIONAR PRÉDIO' : `${b.cost} SUP • ${b.fuelCost} COMB`}
                      </span>
                    </div>
                    <div className="base-item-sub">{b.subtitle}</div>
                  </button>
                );
              })}
            </div>
          )}

          {baseDrawerOpen && activeBaseTab === 'spec_ops' && (
            <div className="base-grid">
              {!builtSet.has('spec_ops_center') && (
                <div className="base-req-warn">
                  Requer construir <strong>Quartel Op. Especiais</strong> na aba Base.
                </div>
              )}
              {specOpsUnits.map((u) => {
                const unlocked = builtSet.has('spec_ops_center');
                const canAfford =
                  unlocked && hud.supplies >= u.cost && hud.ammo >= (u.ammoCost || 0);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`base-item-btn ${!canAfford ? 'locked' : ''}`}
                    onClick={() => gameRef.current?.queueUnitAtBuilding(null, u.id)}
                    title={`${u.name} — ${u.subtitle}`}
                  >
                    <div className="base-item-top">
                      <strong>{u.short}</strong>
                      <span>
                        {u.cost} SUP{u.ammoCost ? ` • ${u.ammoCost} MUN` : ''}
                      </span>
                    </div>
                    <div className="base-item-sub">{u.subtitle}</div>
                  </button>
                );
              })}
            </div>
          )}

          {baseDrawerOpen && activeBaseTab === 'armor' && (
            <div className="base-grid">
              {!builtSet.has('motor_pool') && (
                <div className="base-req-warn">
                  Requer construir <strong>Fábrica de Blindados</strong> na aba Base.
                </div>
              )}
              {armorUnits.map((u) => {
                const unlocked = builtSet.has('motor_pool');
                const canAfford =
                  unlocked && hud.supplies >= u.cost && hud.fuel >= (u.fuelCost || 0);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`base-item-btn ${!canAfford ? 'locked' : ''}`}
                    onClick={() => gameRef.current?.queueUnitAtBuilding(null, u.id)}
                    title={`${u.name} — ${u.subtitle}`}
                  >
                    <div className="base-item-top">
                      <strong>{u.short}</strong>
                      <span>
                        {u.cost} SUP • {u.fuelCost} COMB
                      </span>
                    </div>
                    <div className="base-item-sub">{u.subtitle}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BARRA LATERAL DE SUPORTE AÉREO E RECONHECIMENTO (COMANDO AÉREO / RADAR) */}
        {baseDrawerOpen && (
        <div className="air-doctrine-card">
          <div className="air-doctrine-title">
            <span>✈ COMANDO AÉREO & RADAR</span>
            <small>{builtSet.has('air_command') ? 'ONLINE' : 'REQUER RADAR'}</small>
          </div>
          <div className="air-doctrine-list">
            {AIR_DOCTRINES.map((doc) => {
              const unlocked = builtSet.has('air_command');
              const cd = hud.airCooldowns?.[doc.id] || 0;
              const isTargeting = hud.activeAirStrikeMode === doc.id;
              const canUse =
                unlocked &&
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
                      {cd > 0 ? `⏳ ${cd}s` : `${doc.cost} SUP • ${doc.ammoCost} MUN`}
                    </span>
                  </div>
                  <div className="air-btn-sub">{doc.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </HudPanel>

      {/* BASE CENTRO: Barra Inferior Separada por 4 Categorias/Abas + Botão TODOS */}
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
                  <span className="cat-tab-icon">{cat.icon}</span>
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
              <span className="cat-tab-icon">▪</span>
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
                      🪂 Lançar Paraquedistas
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
                      {b.icon} {b.name.split('(')[0].trim()} ({b.costSup} SUP)
                    </button>
                  )
                )}
              </div>
            );
          })()}
        </div>
      </HudPanel>

      {/* BASE DIREITA: Exibida apenas quando houver Tropa ou Prédio da Base selecionado */}
      {(selectedBld || hud.selectedCount > 0) && (
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
                  const canAfford =
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
                          {uSpec.cost} SUP
                          {uSpec.ammoCost ? ` • ${uSpec.ammoCost} MUN` : ''}
                          {uSpec.fuelCost ? ` • ${uSpec.fuelCost} COMB` : ''}
                          {uSpec.buildTime ? ` • ⏱ ${Math.round(uSpec.buildTime)}s` : ''}
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

                {/* 2. CONTROLE DE DISTÂNCIA / ESPAÇAMENTO ENTRE SOLDADOS (1m a 8m + Presets Rápidos) */}
                <div className="spacing-control-box">
                  <div className="spacing-header-row">
                    <span>↔ DISTANCIAMENTO TÁTICO (SPACING)</span>
                    <strong>{(hud.selectedSpacing || 3.0).toFixed(1)}m</strong>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.5"
                    value={hud.selectedSpacing || 3.0}
                    onChange={(e) =>
                      gameRef.current?.setSelectedSpacing(parseFloat(e.target.value))
                    }
                    className="spacing-slider"
                    title="Ajustar distância em metros entre os soldados 3D do esquadrão (1m a 8m)"
                  />
                  <div className="spacing-presets-row">
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
                          {preset.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. TRAVAR POSIÇÃO [H], RETORNAR À BASE [B/R] & DESOCUPAR GUARNIÇÃO [U] */}
                <div className="stance-toolbar">
                  <button
                    type="button"
                    className={`stance-btn ${hud.selectedHoldPosition ? 'active hold-active' : ''}`}
                    onClick={() => gameRef.current?.toggleSelectedHoldPosition()}
                    title="Travar Posição [H]: O esquadrão não sai da cobertura/trincheira para perseguir inimigos"
                  >
                    {hud.selectedHoldPosition ? '🔒 POSIÇÃO TRAVADA [H]' : '🔓 TRAVAR POSIÇÃO [H]'}
                  </button>
                  {leadSquad && (
                    <button
                      type="button"
                      className="stance-btn rtb-btn"
                      onClick={() => gameRef.current?.returnSelectedToBase()}
                      title="Recuar rápido para o QG para se curar [Tecla R]"
                    >
                      ▸ RECUAR P/ QG [R]
                    </button>
                  )}
                  {hud.anySelectedGarrisoned && (
                    <button
                      type="button"
                      className="stance-btn ungarrison-btn"
                      onClick={() => gameRef.current?.ungarrisonSelected()}
                      title="Desocupar Casa/Prédio [U]"
                    >
                      ▸ SAIR DO PRÉDIO [U]
                    </button>
                  )}
                  {leadSquad && (leadSquad.unitType === 'engineers' || leadSquad.canBuild) && (
                    <button
                      type="button"
                      className="stance-btn"
                      style={{ borderColor: '#38bdf8', color: '#7dd3fc' }}
                      onClick={() => gameRef.current?.repairNearestVehicleForSelected()}
                      title="Enviar Engenheiros para consertar o veículo aliado danificado mais próximo (+40 HP/s grátis)"
                    >
                      🔧 Consertar Veículo Mais Próximo
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
                              <span>💣 Granada [G]</span>
                              <small>{cdG > 0 ? `⏳ ${cdG}s` : '15 MUN'}</small>
                            </button>
                            <button
                              type="button"
                              className={`ability-btn ${leadSquad.suppressionMode ? 'active' : ''} ${cdF > 0 && !leadSquad.suppressionMode ? 'on-cd' : ''}`}
                              onClick={() => gameRef.current?.toggleSelectedSuppression()}
                              title="Fogo de Supressão [F] (2x Cadência • Pinned -70% vel. • 10 MUN • 15s)"
                            >
                              <span>🔥 Supressão [F]</span>
                              <small>{leadSquad.suppressionMode ? 'ATIVO' : cdF > 0 ? `⏳ ${cdF}s` : '10 MUN'}</small>
                            </button>
                            <button
                              type="button"
                              className={`ability-btn ${leadSquad.medkitHealing ? 'active-heal' : ''} ${cdC > 0 && !leadSquad.medkitHealing ? 'on-cd' : ''}`}
                              onClick={() => gameRef.current?.useSelectedMedkit()}
                              title="Kit Médico [C] (+45 HP em 5s • 20 SUP • Recarga 20s)"
                            >
                              <span>🩹 Médico [C]</span>
                              <small>{leadSquad.medkitHealing ? 'CURANDO' : cdC > 0 ? `⏳ ${cdC}s` : '20 SUP'}</small>
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

      {/* MODAL DE OPÇÕES DO SISTEMA (ENGRENAGEM ⚙️) */}
      {hud.sandboxMode && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            background: 'rgba(18, 20, 18, 0.94)',
            border: '1px solid #c28e38',
            borderRadius: 4,
            padding: '6px 10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            maxWidth: '92vw',
            pointerEvents: 'auto',
            alignItems: 'center',
          }}
        >
          <strong style={{ fontSize: 11, color: '#c28e38', marginRight: 4 }}>🛠️ SANDBOX:</strong>
          {[
            { label: '+Fuzileiros', fac: 'player', id: 'rifle_squad' },
            { label: '+Assalto', fac: 'player', id: 'assault_squad' },
            { label: '+AT Bazuca', fac: 'player', id: 'at_javelin_squad' },
            { label: '+Snipers', fac: 'player', id: 'sniper_squad' },
            { label: '+Engenheiros', fac: 'player', id: 'engineer_squad' },
            { label: '+Caminhão', fac: 'player', id: 'troop_transport' },
            { label: '+Humvee', fac: 'player', id: 'humvee' },
            { label: '+APC Stryker', fac: 'player', id: 'apc_stryker' },
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
            +Tanque Inimigo
          </button>
          <button
            type="button"
            className="hud-btn"
            style={{ fontSize: 10, padding: '3px 6px', borderColor: '#c28e38', color: '#facc15' }}
            onClick={() => gameRef.current?.sandboxSpawnUnit('enemy_1', 'command_officer', { surrendered: true })}
          >
            +★ Comandante Rendido
          </button>
          <button
            type="button"
            className={`hud-btn ${hud.sandboxFogDisabled ? 'active' : ''}`}
            style={{ fontSize: 10, padding: '3px 6px' }}
            onClick={() => gameRef.current?.sandboxToggleFog()}
          >
            👁️ Névoa
          </button>
          <button
            type="button"
            className={`hud-btn ${hud.sandboxAiPaused ? 'active' : ''}`}
            style={{ fontSize: 10, padding: '3px 6px' }}
            onClick={() => gameRef.current?.sandboxToggleAi()}
          >
            🤖 {hud.sandboxAiPaused ? 'IA Pausada' : 'IA Ativa'}
          </button>
          <button
            type="button"
            className="hud-btn"
            style={{ fontSize: 10, padding: '3px 6px' }}
            onClick={() => gameRef.current?.sandboxHealAll()}
          >
            💚 Curar Tudo
          </button>
          <button
            type="button"
            className="hud-btn"
            style={{ fontSize: 10, padding: '3px 6px' }}
            onClick={() => gameRef.current?.sandboxDestroySelected()}
          >
            💥 Destruir Sel.
          </button>
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
