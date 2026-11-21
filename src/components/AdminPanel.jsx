import React, { useEffect, useState } from 'react';
import { networkManager } from '../game/net/NetworkManager.js';
import {
  ACCOUNT_RANKS,
  BATTALION_UNLOCKS,
  CAMPAIGN_PACKS,
} from '../game/data/accountData.js';

export default function AdminPanel({ onLaunchSandbox }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(
    networkManager.currentUser?.uid || ''
  );
  const [goldInput, setGoldInput] = useState('1000');
  const [banReasonInput, setBanReasonInput] = useState('Violação das regras de combate.');
  const [toast, setToast] = useState({ text: '', type: 'ok' });
  const [searchFilter, setSearchFilter] = useState('');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState('players'); // 'players' | 'economy' | 'items' | 'server'

  const flashMsg = (text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast((prev) => (prev.text === text ? { text: '', type: 'ok' } : prev)), 4500);
  };

  const refreshPlayers = async () => {
    setLoading(true);
    try {
      const list = await networkManager.getAllPlayers();
      setPlayers(list);
      setSelectedPlayerUid((prev) => {
        if (prev && list.some((p) => p.uid === prev)) return prev;
        if (networkManager.currentUser?.uid && list.some((p) => p.uid === networkManager.currentUser.uid)) {
          return networkManager.currentUser.uid;
        }
        return list[0]?.uid || '';
      });
    } catch (err) {
      flashMsg(`Erro ao carregar contas: ${err?.message || 'Firebase indisponível'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPlayers();
  }, []);

  const runAdminAction = async (actionFn, successMsg) => {
    if (actionBusy) return;
    if (!selectedPlayer?.uid || selectedPlayer.uid === 'local') {
      flashMsg('Nenhum jogador válido selecionado.', 'error');
      return;
    }
    setActionBusy(true);
    try {
      const res = await actionFn();
      if (res && res.ok === false) {
        flashMsg(`Falha: ${res.error || 'Ação não autorizada ou erro no Firebase.'}`, 'error');
        return;
      }
      flashMsg(typeof successMsg === 'function' ? successMsg(res) : successMsg, 'ok');
      await refreshPlayers();
    } catch (err) {
      flashMsg(`Erro: ${err?.message || 'Falha inesperada.'}`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const selectedPlayer =
    players.find((p) => p.uid === selectedPlayerUid) ||
    players[0] || {
      uid: networkManager.currentUser?.uid || 'local',
      callsign: networkManager.currentUser?.callsign || 'Comandante',
      militaryGold: networkManager.currentUser?.militaryGold || 0,
      level: networkManager.currentUser?.level || 1,
      rank: networkManager.currentUser?.rank || 'Recruta',
      unlockedBattalions: networkManager.currentUser?.unlockedBattalions || [],
      ownedCampaignPacks: networkManager.currentUser?.ownedCampaignPacks || [],
    };

  const filteredPlayers = players.filter(
    (p) =>
      p.callsign?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.uid?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const bannedCount = players.filter((p) => p.banned).length;
  const selfUid = networkManager.currentUser?.uid;

  return (
    <div className="admin-panel-container">
      {/* CABEÇALHO DO PAINEL ADMIN */}
      <div className="admin-header-card">
        <div className="admin-header-main">
          <div className="admin-badge-icon">🛡️</div>
          <div>
            <div className="mp-kicker" style={{ color: '#ef4444' }}>
              COMANDO SUPREMO • CONTROLE OPERACIONAL DO SERVIDOR
            </div>
            <h2 style={{ margin: 0, color: '#fca5a5' }}>
              PAINEL DE ADMINISTRAÇÃO MILITAR
            </h2>
          </div>
        </div>

        <div className="admin-quick-actions">
          <span
            className="mp-ping-badge"
            style={{
              borderColor: networkManager.isOnline ? '#22c55e' : '#eab308',
              color: networkManager.isOnline ? '#86efac' : '#fde047',
            }}
          >
            {networkManager.isOnline ? '🟢 Firebase Conectado' : '🟡 Modo Local'}
          </span>
          {onLaunchSandbox && (
            <button
              type="button"
              className="mil-pill"
              style={{ borderColor: '#f59e0b', background: 'rgba(217, 119, 6, 0.22)', color: '#fde68a', fontWeight: 800 }}
              onClick={onLaunchSandbox}
            >
              🛠️ Modo Sandbox (Admin)
            </button>
          )}
          <button
            type="button"
            className="mil-pill"
            style={{ borderColor: '#ef4444', color: '#fca5a5' }}
            onClick={refreshPlayers}
            disabled={loading || actionBusy}
          >
            {loading ? '⟳ Atualizando...' : '⟳ Atualizar Lista'}
          </button>
        </div>
      </div>

      {/* RESUMO RÁPIDO DO COMANDO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div className="mp-card" style={{ padding: '10px 12px', margin: 0 }}>
          <small style={{ color: '#9ca3af' }}>CONTAS REGISTRADAS</small>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f3f4f6' }}>{players.length}</div>
        </div>
        <div className="mp-card" style={{ padding: '10px 12px', margin: 0 }}>
          <small style={{ color: '#9ca3af' }}>CONTAS BANIDAS</small>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: bannedCount > 0 ? '#f87171' : '#86efac' }}>
            {bannedCount}
          </div>
        </div>
        <div className="mp-card" style={{ padding: '10px 12px', margin: 0 }}>
          <small style={{ color: '#9ca3af' }}>OURO DO ALVO</small>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fde047' }}>
            💰 {selectedPlayer.militaryGold || 0}
          </div>
        </div>
        <div className="mp-card" style={{ padding: '10px 12px', margin: 0 }}>
          <small style={{ color: '#9ca3af' }}>DESBLOQUEIOS DO ALVO</small>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#93c5fd' }}>
            {(selectedPlayer.unlockedBattalions || []).length}/{BATTALION_UNLOCKS.length} Bat •{' '}
            {(selectedPlayer.ownedCampaignPacks || []).length}/{CAMPAIGN_PACKS.length} VIP
          </div>
        </div>
      </div>

      {toast.text && (
        <div
          className="admin-status-toast"
          style={
            toast.type === 'error'
              ? {
                  borderColor: '#ef4444',
                  background: 'rgba(127, 29, 29, 0.72)',
                  color: '#fecaca',
                }
              : {
                  borderColor: '#22c55e',
                  background: 'rgba(20, 83, 45, 0.72)',
                  color: '#bbf7d0',
                }
          }
        >
          {toast.text}
        </div>
      )}

      {/* SUB-ABAS DO PAINEL ADMIN */}
      <div className="mil-subbar" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={`mil-pill ${activeAdminSubTab === 'players' ? 'active' : ''}`}
          style={activeAdminSubTab === 'players' ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.2)' } : {}}
          onClick={() => setActiveAdminSubTab('players')}
        >
          👥 JOGADORES & PUNIÇÕES ({players.length})
        </button>
        <button
          type="button"
          className={`mil-pill ${activeAdminSubTab === 'economy' ? 'active' : ''}`}
          style={activeAdminSubTab === 'economy' ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.2)' } : {}}
          onClick={() => setActiveAdminSubTab('economy')}
        >
          💰 OURO & ECONOMIA
        </button>
        <button
          type="button"
          className={`mil-pill ${activeAdminSubTab === 'items' ? 'active' : ''}`}
          style={activeAdminSubTab === 'items' ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.2)' } : {}}
          onClick={() => setActiveAdminSubTab('items')}
        >
          🎁 CONCEDER ITENS & BATALHÕES
        </button>
        <button
          type="button"
          className={`mil-pill ${activeAdminSubTab === 'server' ? 'active' : ''}`}
          style={activeAdminSubTab === 'server' ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.2)' } : {}}
          onClick={() => setActiveAdminSubTab('server')}
        >
          ⚙️ PATENTE & RESET DE TESTE
        </button>
      </div>

      {/* SELETOR RÁPIDO DO JOGADOR ALVO */}
      <div className="admin-target-bar">
        <span>JOGADOR ALVO:</span>
        <select
          className="mil-input"
          style={{ maxWidth: 340, padding: '4px 10px', height: 34 }}
          value={selectedPlayer.uid}
          onChange={(e) => setSelectedPlayerUid(e.target.value)}
        >
          {players.map((p) => (
            <option key={p.uid} value={p.uid}>
              {p.callsign} (Nv.{p.level} • {p.militaryGold} Ouro) {p.banned ? '[BANIDO]' : ''}{' '}
              {p.uid === selfUid ? '★ (Você)' : ''}
            </option>
          ))}
        </select>
        {selfUid && selectedPlayer.uid !== selfUid && (
          <button
            type="button"
            className="mil-pill"
            onClick={() => setSelectedPlayerUid(selfUid)}
          >
            ★ Minha Conta
          </button>
        )}
        <span className="mp-ping-badge" style={{ color: '#fde047' }}>
          Ouro: {selectedPlayer.militaryGold || 0}
        </span>
        <span className="mp-ping-badge">
          Nv.{selectedPlayer.level || 1} {selectedPlayer.rank || 'Recruta'}
        </span>
      </div>

      {/* ABA 1: GERENCIAMENTO DE JOGADORES, BANIMENTO E RESTRIÇÕES */}
      {activeAdminSubTab === 'players' && (
        <div className="admin-content-grid">
          <div className="mp-card">
            <div className="mp-card-head">
              <div>
                <span className="mp-kicker">CADASTRO MILITAR</span>
                <h3>LISTA DE CONTAS & STATUS</h3>
              </div>
              <input
                type="text"
                className="mil-input"
                style={{ maxWidth: 220, height: 32 }}
                placeholder="Filtrar por nome/UID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            <div className="admin-player-table">
              {filteredPlayers.map((p) => {
                const isTarget = p.uid === selectedPlayer.uid;
                const isSelf = p.uid === selfUid;
                return (
                  <div
                    key={p.uid}
                    className={`admin-player-row ${isTarget ? 'selected' : ''}`}
                    onClick={() => setSelectedPlayerUid(p.uid)}
                  >
                    <div className="admin-player-info">
                      <strong>
                        {p.banned ? '🚫 ' : p.muted ? '🔇 ' : '🟢 '}
                        {p.callsign} {isSelf ? '★ (Você)' : ''}{' '}
                        {p.role === 'admin' ? '[ADMIN]' : ''}
                      </strong>
                      <small style={{ color: '#a1a1aa' }}>
                        UID: {p.uid} • Nv.{p.level} ({p.rank}) • 💰 {p.militaryGold} Ouro
                      </small>
                      {p.banned && (
                        <div style={{ color: '#f87171', fontSize: '0.75rem' }}>
                          Banido: {p.banReason || 'Suspenso'}
                        </div>
                      )}
                    </div>

                    <div className="admin-row-actions">
                      {p.banned ? (
                        <button
                          type="button"
                          className="mil-pill"
                          disabled={actionBusy}
                          style={{ borderColor: '#4ade80', color: '#4ade80' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            runAdminAction(
                              () => networkManager.adminUnbanPlayer(p.uid),
                              (res) => res?.message || 'Jogador desbanido.'
                            );
                          }}
                        >
                          ✅ Desbanir
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mil-pill"
                          disabled={actionBusy}
                          style={{ borderColor: '#ef4444', color: '#f87171' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = window.prompt(
                              `Motivo do banimento para ${p.callsign}:`,
                              banReasonInput
                            );
                            if (reason) {
                              runAdminAction(
                                () => networkManager.adminBanPlayer(p.uid, reason),
                                (res) => res?.message || 'Jogador banido.'
                              );
                            }
                          }}
                        >
                          🚫 Banir Conta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PAINEL DE CONTROLE DA CONTA SELECIONADA */}
          <div className="mp-card">
            <div className="mp-card-head">
              <div>
                <span className="mp-kicker">AÇÕES DISCIPLINARES</span>
                <h3>{selectedPlayer.callsign}</h3>
              </div>
              <span className={`mp-ping-badge ${selectedPlayer.banned ? 'status-danger' : 'status-ok'}`}>
                {selectedPlayer.banned ? 'CONTA BANIDA' : 'CONTA ATIVA'}
              </span>
            </div>

            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <span className="mil-cfg-label">Motivo do Banimento / Alerta:</span>
                <input
                  type="text"
                  className="mil-input"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedPlayer.banned ? (
                  <button
                    type="button"
                    className="mil-btn-primary"
                    disabled={actionBusy}
                    style={{ borderColor: '#4ade80', background: '#166534' }}
                    onClick={() =>
                      runAdminAction(
                        () => networkManager.adminUnbanPlayer(selectedPlayer.uid),
                        (res) => res?.message || 'Jogador desbanido.'
                      )
                    }
                  >
                    ✅ Desbanir Jogador Imediatamente
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mil-btn-primary"
                    disabled={actionBusy}
                    style={{ borderColor: '#ef4444', background: '#991b1b' }}
                    onClick={() =>
                      runAdminAction(
                        () => networkManager.adminBanPlayer(selectedPlayer.uid, banReasonInput),
                        (res) => res?.message || 'Jogador banido.'
                      )
                    }
                  >
                    🚫 Aplicar Banimento Completo
                  </button>
                )}

                <button
                  type="button"
                  className="mil-btn-secondary"
                  disabled={actionBusy}
                  onClick={() => {
                    const nextMute = !selectedPlayer.muted;
                    runAdminAction(
                      () =>
                        networkManager.adminSetPlayerRestrictions(selectedPlayer.uid, {
                          muted: nextMute,
                        }),
                      nextMute ? 'Jogador silenciado.' : 'Silenciamento removido.'
                    );
                  }}
                >
                  {selectedPlayer.muted ? '🔊 Desmutar Chat' : '🔇 Silenciar (Mutar Chat)'}
                </button>

                <button
                  type="button"
                  className="mil-btn-secondary"
                  disabled={actionBusy}
                  onClick={() => {
                    const nextRestr = !selectedPlayer.restricted;
                    runAdminAction(
                      () =>
                        networkManager.adminSetPlayerRestrictions(selectedPlayer.uid, {
                          restricted: nextRestr,
                        }),
                      nextRestr ? 'Restrição de PvP ativada.' : 'Restrição removida.'
                    );
                  }}
                >
                  {selectedPlayer.restricted ? '🔓 Liberar PvP / Salas' : '⚠️ Bloquear Acesso a Salas PvP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: OURO MILITAR & ECONOMIA */}
      {activeAdminSubTab === 'economy' && (
        <div className="mp-card">
          <div className="mp-card-head">
            <div>
              <span className="mp-kicker">GERADOR DE RECURSOS MILITARES</span>
              <h3>DEFINIR OURO DE {selectedPlayer.callsign.toUpperCase()}</h3>
            </div>
            <span className="mp-ping-badge" style={{ fontSize: '1rem', color: '#fde047' }}>
              Saldo Atual: 💰 {selectedPlayer.militaryGold || 0} Ouro
            </span>
          </div>

          <div style={{ padding: 12 }}>
            <p style={{ color: '#d4d4d8' }}>
              Adicione ouro militar à conta selecionada ou defina uma quantia exata diretamente na nuvem.
            </p>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              <input
                type="number"
                className="mil-input"
                style={{ width: 180 }}
                value={goldInput}
                onChange={(e) => setGoldInput(e.target.value)}
                placeholder="Quantidade de Ouro..."
              />
              <button
                type="button"
                className="mil-btn-primary"
                disabled={actionBusy}
                onClick={() => {
                  const val = Math.max(0, Math.round(Number(goldInput) || 0));
                  runAdminAction(
                    () =>
                      networkManager.adminSetPlayerGold(
                        selectedPlayer.uid,
                        (selectedPlayer.militaryGold || 0) + val
                      ),
                    `+${val} Ouro adicionado a ${selectedPlayer.callsign}!`
                  );
                }}
              >
                ➕ Injetar Ouro
              </button>
              <button
                type="button"
                className="mil-btn-secondary"
                disabled={actionBusy}
                onClick={() => {
                  const val = Math.max(0, Math.round(Number(goldInput) || 0));
                  runAdminAction(
                    () => networkManager.adminSetPlayerGold(selectedPlayer.uid, val),
                    `Saldo de ${selectedPlayer.callsign} definido para ${val} Ouro.`
                  );
                }}
              >
                Definir Saldo Exato
              </button>
              <button
                type="button"
                className="mil-btn-secondary"
                disabled={actionBusy}
                style={{ borderColor: '#ef4444', color: '#f87171' }}
                onClick={() =>
                  runAdminAction(
                    () => networkManager.adminSetPlayerGold(selectedPlayer.uid, 0),
                    `Saldo de ${selectedPlayer.callsign} zerado com sucesso!`
                  )
                }
              >
                🪙 Zerar Ouro (0)
              </button>
            </div>

            <div className="mil-section-label">ATALHOS RÁPIDOS DE INJEÇÃO DE OURO:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[500, 1000, 2500, 5000, 10000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="mil-pill"
                  disabled={actionBusy}
                  style={{ borderColor: '#eab308', color: '#fde047' }}
                  onClick={() =>
                    runAdminAction(
                      () =>
                        networkManager.adminSetPlayerGold(
                          selectedPlayer.uid,
                          (selectedPlayer.militaryGold || 0) + amt
                        ),
                      `+${amt} Ouro injetado em ${selectedPlayer.callsign}!`
                    )
                  }
                >
                  +{amt} Ouro
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CONCESSÃO DE ITENS & BATALHÕES */}
      {activeAdminSubTab === 'items' && (
        <div className="admin-content-grid">
          {/* BATALHÕES MILITARES */}
          <div className="mp-card">
            <div className="mp-card-head">
              <div>
                <span className="mp-kicker">DESBLOQUEIO DE UNIDADES</span>
                <h3>BATALHÕES ESPECIAIS</h3>
              </div>
              <button
                type="button"
                className="mil-btn-primary"
                disabled={actionBusy}
                style={{ minHeight: 32, padding: '0 12px' }}
                onClick={() =>
                  runAdminAction(
                    () => networkManager.adminGrantBattalion(selectedPlayer.uid, 'ALL'),
                    `TODOS os Batalhões liberados para ${selectedPlayer.callsign}!`
                  )
                }
              >
                ⭐ Liberar TODOS os Batalhões
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {BATTALION_UNLOCKS.map((b) => {
                const hasIt = (selectedPlayer.unlockedBattalions || []).includes(b.id);
                return (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#1c1917',
                      border: '1px solid #3f3f46',
                      padding: '8px 12px',
                      borderRadius: 4,
                    }}
                  >
                    <div>
                      <strong>
                        {b.icon} {b.name}
                      </strong>
                      <small style={{ display: 'block', color: '#a1a1aa' }}>
                        Nv.{b.requiredLevel} ({b.rankName}) • {b.priceGold || 200} Ouro
                      </small>
                    </div>

                    {hasIt ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mp-ping-badge" style={{ color: '#4ade80' }}>
                          ✓ Liberado
                        </span>
                        <button
                          type="button"
                          className="mil-pill"
                          disabled={actionBusy}
                          style={{ borderColor: '#ef4444', color: '#fca5a5' }}
                          onClick={() =>
                            runAdminAction(
                              () => networkManager.adminRevokeBattalion(selectedPlayer.uid, b.id),
                              `${b.name} removido de ${selectedPlayer.callsign}.`
                            )
                          }
                        >
                          ✕ Remover
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mil-pill"
                        disabled={actionBusy}
                        style={{ borderColor: '#4ade80', color: '#4ade80' }}
                        onClick={() =>
                          runAdminAction(
                            () => networkManager.adminGrantBattalion(selectedPlayer.uid, b.id),
                            `${b.name} liberado para ${selectedPlayer.callsign}!`
                          )
                        }
                      >
                        + Conceder
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PACOTES DE CAMPANHA & VIP */}
          <div className="mp-card">
            <div className="mp-card-head">
              <div>
                <span className="mp-kicker">SUPRIMENTOS & BENEFÍCIOS</span>
                <h3>PACOTES DE CAMPANHA</h3>
              </div>
              <button
                type="button"
                className="mil-btn-primary"
                disabled={actionBusy}
                style={{ minHeight: 32, padding: '0 12px' }}
                onClick={() =>
                  runAdminAction(
                    () => networkManager.adminGrantCampaignPack(selectedPlayer.uid, 'vip_combo'),
                    `COMBO VIP COMPLETO concedido a ${selectedPlayer.callsign}!`
                  )
                }
              >
                👑 Conceder COMBO VIP
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {CAMPAIGN_PACKS.map((pk) => {
                const hasIt = (selectedPlayer.ownedCampaignPacks || []).includes(pk.id);
                return (
                  <div
                    key={pk.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#1c1917',
                      border: '1px solid #3f3f46',
                      padding: '8px 12px',
                      borderRadius: 4,
                    }}
                  >
                    <div>
                      <strong>
                        {pk.icon} {pk.name}
                      </strong>
                      <small style={{ display: 'block', color: '#a1a1aa' }}>
                        {pk.badge} • Valor: {pk.priceGold} Ouro
                      </small>
                    </div>

                    {hasIt ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mp-ping-badge" style={{ color: '#4ade80' }}>
                          ✓ Possui
                        </span>
                        <button
                          type="button"
                          className="mil-pill"
                          disabled={actionBusy}
                          style={{ borderColor: '#ef4444', color: '#fca5a5' }}
                          onClick={() =>
                            runAdminAction(
                              () => networkManager.adminRevokeCampaignPack(selectedPlayer.uid, pk.id),
                              `${pk.name} removido de ${selectedPlayer.callsign}.`
                            )
                          }
                        >
                          ✕ Remover
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mil-pill"
                        disabled={actionBusy}
                        style={{ borderColor: '#4ade80', color: '#4ade80' }}
                        onClick={() =>
                          runAdminAction(
                            () => networkManager.adminGrantCampaignPack(selectedPlayer.uid, pk.id),
                            `${pk.name} concedido a ${selectedPlayer.callsign}!`
                          )
                        }
                      >
                        + Conceder
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: AJUSTE DE PATENTE & RESET DE TESTE */}
      {activeAdminSubTab === 'server' && (
        <div className="mp-card">
          <div className="mp-card-head">
            <div>
              <span className="mp-kicker">PROGRESSÃO & TESTES LIMPOS</span>
              <h3>DEFINIR PATENTE OU RESETAR CONTA</h3>
            </div>
            <span className="mp-ping-badge">
              Patente Atual: Nv.{selectedPlayer.level || 1} {selectedPlayer.rank || 'Recruta'}
            </span>
          </div>

          <div style={{ padding: 12 }}>
            <div className="mil-section-label">DEFINIR PATENTE DIRETA:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {ACCOUNT_RANKS.map((r) => (
                <button
                  key={r.level}
                  type="button"
                  disabled={actionBusy}
                  className={`mil-pill ${selectedPlayer.level === r.level ? 'active' : ''}`}
                  onClick={() =>
                    runAdminAction(
                      () => networkManager.adminSetPlayerLevel(selectedPlayer.uid, r.level),
                      `Patente de ${selectedPlayer.callsign} alterada para Nv.${r.level} (${r.rank})!`
                    )
                  }
                >
                  Nv.{r.level} {r.rank}
                </button>
              ))}
            </div>

            <div className="mil-section-label">AÇÕES DE PURGA & TESTE LIMPO:</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="mil-btn-secondary"
                disabled={actionBusy}
                style={{ borderColor: '#ef4444', color: '#fca5a5' }}
                onClick={() => {
                  if (
                    window.confirm(
                      `ATENÇÃO: Deseja zerar completamente a conta de ${selectedPlayer.callsign} para Nível 1, 0 XP, 0 Ouro e sem itens?`
                    )
                  ) {
                    runAdminAction(
                      () => networkManager.adminResetPlayerAccount(selectedPlayer.uid),
                      `Conta de ${selectedPlayer.callsign} resetada com sucesso para Nível 1 (0 Ouro, 0 XP)!`
                    );
                  }
                }}
              >
                ⚠️ Resetar Conta para Nv.1 (0 Ouro, 0 XP, Bloquear Tudo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
